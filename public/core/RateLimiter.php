<?php

// Internal module only; even a server without rewrite rules must refuse direct requests.
if (
  !defined('VONCMS_CORE_LOADED') ||
  (isset($_SERVER['SCRIPT_FILENAME']) &&
    realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  echo 'Forbidden';
  exit();
}

/**
 * Rate Limiting (IP-based)
 */
class RateLimiter
{
  /** @var string $storageDir */
  private static $storageDir = __DIR__ . '/../data/rate_limits/';
  /** @var int $maxAttempts */
  private static $maxAttempts = 5;
  /** @var int $lockoutTime */
  private static $lockoutTime = 900; // 15 minutes in seconds
  /** @var array<string, bool> $reportedStorageFailures */
  private static $reportedStorageFailures = [];

  private static function reportStorageFailure(string $operation, bool $failOpen = true): void
  {
    if (isset(self::$reportedStorageFailures[$operation])) {
      return;
    }

    self::$reportedStorageFailures[$operation] = true;
    error_log(
      'VonCMS Security: rate-limit storage unavailable during ' .
        $operation .
        ($failOpen
          ? '; this request is temporarily fail-open.'
          : '; the protected request is temporarily refused.'),
    );
  }

  private static function ensureStorageDirectory(): bool
  {
    if (is_dir(self::$storageDir)) {
      return is_writable(self::$storageDir);
    }

    return @mkdir(self::$storageDir, 0755, true) || is_dir(self::$storageDir);
  }

  /**
   * Get client IP (secure - does NOT trust X-Forwarded-For)
   */
  private static function getClientIP()
  {
    // SECURITY: Only trust REMOTE_ADDR, not X-Forwarded-For
    // X-Forwarded-For can be spoofed by attackers to bypass rate limiting
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  }

  /**
   * Get rate limit file path
   * @param string $identifier
   * @return string|null
   */
  private static function getFilePath($identifier, bool $failOpen = true)
  {
    if (!self::ensureStorageDirectory()) {
      self::reportStorageFailure('directory preparation', $failOpen);
      return null;
    }
    return self::$storageDir . md5($identifier) . '.json';
  }

  /**
   * Report whether the file-backed limiter can persist and lock a probe.
   *
   * @return array{healthy: bool, message: string}
   */
  public static function getStorageHealth(): array
  {
    if (!self::ensureStorageDirectory()) {
      self::reportStorageFailure('health check');
      return ['healthy' => false, 'message' => 'Rate-limit storage is not writable.'];
    }

    $probe = self::$storageDir . '.health-' . bin2hex(random_bytes(8));
    $handle = @fopen($probe, 'x');
    if ($handle === false) {
      self::reportStorageFailure('health check');
      return ['healthy' => false, 'message' => 'Rate-limit storage is not writable.'];
    }

    $healthy = false;
    try {
      if (@flock($handle, LOCK_EX)) {
        $healthy = @fwrite($handle, 'ok') === 2 && @fflush($handle);
        @flock($handle, LOCK_UN);
      }
    } finally {
      @fclose($handle);
      @unlink($probe);
    }

    if (!$healthy) {
      self::reportStorageFailure('health check');
      return ['healthy' => false, 'message' => 'Rate-limit storage cannot persist locks.'];
    }

    return ['healthy' => true, 'message' => 'Rate-limit storage is healthy.'];
  }

  /**
   * Consume one recovery attempt from a bounded, expiry-pruned ledger.
   * A single locked file prevents attacker-selected emails/IPs creating files.
   * Storage failures refuse recovery only; login storage remains independent.
   *
   * @param string $identifier
   * @param int $maxAttempts
   * @param int $windowSeconds
   * @return bool
   */
  public static function consumeFixedWindow(
    $identifier,
    $maxAttempts,
    $windowSeconds,
    $namespace = 'recovery',
  ) {
    if (!in_array($namespace, ['recovery', 'login'], true)) {
      return false;
    }
    $maxAttempts = max(1, (int) $maxAttempts);
    $windowSeconds = max(1, (int) $windowSeconds);
    $file = self::getFilePath(
      $namespace === 'login' ? 'login-account-ledger:v1' : 'fixed-window-ledger:v1',
      false,
    );
    if ($file === null) {
      return false;
    }
    $handle = @fopen($file, 'c+');

    if ($handle === false) {
      self::reportStorageFailure('fixed-window open', false);
      return false;
    }

    if (!@flock($handle, LOCK_EX)) {
      self::reportStorageFailure('fixed-window lock', false);
      @fclose($handle);
      return false;
    }

    $accepted = false;
    try {
      rewind($handle);
      $raw = stream_get_contents($handle, 1048577);
      $data = $raw === '' ? [] : json_decode(is_string($raw) ? $raw : '', true);
      if (!is_string($raw) || strlen($raw) > 1048576 || !is_array($data) || count($data) > 4096) {
        throw new RuntimeException('Invalid recovery ledger.');
      }
      $now = time();
      foreach ($data as $key => $bucket) {
        if (
          !is_string($key) ||
          strlen($key) !== 64 ||
          !ctype_xdigit($key) ||
          !is_array($bucket) ||
          !is_int($bucket['attempts'] ?? null) ||
          $bucket['attempts'] < 0 ||
          !is_int($bucket['window_started_at'] ?? null) ||
          $bucket['window_started_at'] <= 0 ||
          !is_int($bucket['window_seconds'] ?? null) ||
          $bucket['window_seconds'] < 1
        ) {
          throw new RuntimeException('Invalid recovery bucket.');
        }
        if ($bucket['window_started_at'] <= $now - $bucket['window_seconds']) {
          unset($data[$key]);
        }
      }
      $key = hash('sha256', (string) $identifier);
      if (!isset($data[$key]) && count($data) < 4096) {
        $bucket = [
          'attempts' => 0,
          'window_started_at' => $now,
          'window_seconds' => $windowSeconds,
        ];
        // Preserve active pre-upgrade quotas, without creating or deleting legacy files.
        $legacyFile = self::$storageDir . md5('fixed-window:' . (string) $identifier) . '.json';
        if ($namespace === 'recovery' && is_file($legacyFile)) {
          $legacyHandle = @fopen($legacyFile, 'r');
          if ($legacyHandle === false) {
            throw new RuntimeException('Unreadable legacy recovery quota.');
          }
          try {
            if (!@flock($legacyHandle, LOCK_SH)) {
              throw new RuntimeException('Unavailable legacy recovery lock.');
            }
            $legacyRaw = stream_get_contents($legacyHandle, 1025);
            $legacy = is_string($legacyRaw) ? json_decode($legacyRaw, true) : null;
            if (
              !is_string($legacyRaw) ||
              strlen($legacyRaw) > 1024 ||
              !is_array($legacy) ||
              !is_int($legacy['attempts'] ?? null) ||
              $legacy['attempts'] < 0 ||
              !is_int($legacy['window_started_at'] ?? null) ||
              $legacy['window_started_at'] <= 0
            ) {
              throw new RuntimeException('Invalid legacy recovery quota.');
            }
            if ($legacy['window_started_at'] > $now - $windowSeconds) {
              $bucket['attempts'] = $legacy['attempts'];
              $bucket['window_started_at'] = $legacy['window_started_at'];
            }
          } finally {
            @flock($legacyHandle, LOCK_UN);
            @fclose($legacyHandle);
          }
        }
        $data[$key] = $bucket;
      }
      // Do not evict live quotas when full: existing buckets keep their allowance.
      if (isset($data[$key]) && $data[$key]['attempts'] < $maxAttempts) {
        $data[$key]['attempts']++;
        $accepted = true;
      }
      $payload = json_encode($data);
      rewind($handle);
      if (!is_string($payload) || strlen($payload) > 1048576 || !@ftruncate($handle, 0)) {
        throw new RuntimeException('Cannot persist recovery ledger.');
      }
      $written = 0;
      while ($written < strlen($payload)) {
        $bytes = @fwrite($handle, substr($payload, $written));
        if ($bytes === false || $bytes === 0) {
          throw new RuntimeException('Incomplete recovery ledger write.');
        }
        $written += $bytes;
      }
      if (!@fflush($handle)) {
        throw new RuntimeException('Cannot flush recovery ledger.');
      }
    } catch (Throwable $e) {
      self::reportStorageFailure('fixed-window ledger', false);
      $accepted = false;
    } finally {
      @flock($handle, LOCK_UN);
      @fclose($handle);
    }

    return $accepted;
  }

  /** Refund only this authenticated request, never other failures on a shared IP. */
  public static function refundSuccessfulAttempt(string $identifier): void
  {
    $file = self::getFilePath($identifier);
    if ($file === null || !is_file($file)) {
      return;
    }
    $handle = @fopen($file, 'r+');
    if ($handle === false) {
      self::reportStorageFailure('success refund open');
      return;
    }
    try {
      if (!flock($handle, LOCK_EX)) {
        self::reportStorageFailure('success refund lock');
        return;
      }
      $data = json_decode((string) stream_get_contents($handle), true);
      if (!is_array($data) || !is_int($data['attempts'] ?? null) || $data['attempts'] < 1) {
        return;
      }
      if ($data['attempts'] === self::$maxAttempts) {
        $data['lockout_until'] = 0;
        $data['penalty_level'] = max(0, (int) ($data['penalty_level'] ?? 0) - 1);
      }
      $data['attempts']--;
      $payload = json_encode($data);
      rewind($handle);
      if (
        !is_string($payload) ||
        !ftruncate($handle, 0) ||
        fwrite($handle, $payload) !== strlen($payload) ||
        !fflush($handle)
      ) {
        self::reportStorageFailure('success refund write');
      }
    } finally {
      flock($handle, LOCK_UN);
      fclose($handle);
    }
  }

  /** IPv6 privacy addresses share their subnet's login quota, not forwarded headers. */
  public static function normalizeLoginAddress(string $address): string
  {
    $packed = @inet_pton($address);
    if (
      $packed !== false &&
      strlen($packed) === 16 &&
      substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff"
    ) {
      return (string) inet_ntop(substr($packed, 12));
    }
    if ($packed !== false && strlen($packed) === 16) {
      return bin2hex(substr($packed, 0, 8)) . '/64';
    }
    return $packed !== false ? (string) inet_ntop($packed) : 'unknown';
  }

  /**
   * Reserve one authentication attempt under an exclusive lock.
   * The threshold attempt is allowed, then the escalating lockout applies.
   * Storage faults retain the existing fail-open availability contract.
   *
   * @param string|null $identifier
   * @return bool
   */
  public static function consumeAttempt($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);
    if ($file === null) {
      return true;
    }
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
      self::reportStorageFailure('attempt open');
      return true;
    }

    if (!@flock($handle, LOCK_EX)) {
      self::reportStorageFailure('attempt lock');
      @fclose($handle);
      return true;
    }

    $accepted = true;
    try {
      rewind($handle);
      $raw = stream_get_contents($handle);
      $existing = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
      $data = is_array($existing)
        ? $existing
        : ['attempts' => 0, 'lockout_until' => 0, 'penalty_level' => 0];
      $now = time();
      $lockoutUntil = (int) ($data['lockout_until'] ?? 0);

      if ($lockoutUntil > $now) {
        return false;
      }

      if ($lockoutUntil > 0) {
        $data['attempts'] = 0;
        $data['lockout_until'] = 0;
      }

      $data['attempts'] = (int) ($data['attempts'] ?? 0) + 1;
      $data['penalty_level'] = (int) ($data['penalty_level'] ?? 0);
      if ($data['attempts'] >= self::$maxAttempts) {
        $data['penalty_level']++;
        $multipliers = [1 => 1, 2 => 4];
        $multiplier = $multipliers[$data['penalty_level']] ?? 96;
        $data['lockout_until'] = $now + self::$lockoutTime * $multiplier;
      }

      $payload = json_encode($data);
      rewind($handle);
      $stored =
        is_string($payload) &&
        @ftruncate($handle, 0) &&
        @fwrite($handle, $payload) === strlen($payload) &&
        @fflush($handle);
      if (!$stored) {
        self::reportStorageFailure('attempt write');
      }
    } finally {
      @flock($handle, LOCK_UN);
      @fclose($handle);
    }

    return $accepted;
  }

  /**
   * Check if IP is rate limited
   * @param string|null $identifier
   * @return bool
   */
  public static function isLimited($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);
    if ($file === null) {
      return false;
    }

    if (!file_exists($file)) {
      return false;
    }

    $raw = @file_get_contents($file);
    if (!is_string($raw)) {
      self::reportStorageFailure('attempt read');
      return false;
    }
    $data = json_decode($raw, true);
    $data = is_array($data) ? $data : [];
    $attempts = $data['attempts'] ?? 0;
    $lockoutUntil = $data['lockout_until'] ?? 0;

    // Check if still locked out
    if ($lockoutUntil > time()) {
      return true;
    }

    // Reset attempts if lockout expired, but preserve penalty level
    if ($lockoutUntil > 0 && $lockoutUntil <= time()) {
      $data['attempts'] = 0;
      $data['lockout_until'] = 0;
      $payload = json_encode($data);
      if (!is_string($payload) || @file_put_contents($file, $payload, LOCK_EX) === false) {
        self::reportStorageFailure('attempt reset write');
      }
      return false;
    }

    return false;
  }

  /**
   * Record failed attempt
   * @param string|null $identifier
   * @return void
   */
  public static function recordAttempt($identifier = null)
  {
    self::consumeAttempt($identifier);
  }

  /**
   * Reset attempts (on successful login)
   * @param string|null $identifier
   * @return void
   */
  public static function reset($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);
    if ($file === null) {
      return;
    }

    if (file_exists($file) && !@unlink($file)) {
      self::reportStorageFailure('attempt reset');
    }
  }

  /**
   * Require not rate limited or die
   * @param string|null $identifier
   * @return void
   */
  public static function requireNotLimited($identifier = null)
  {
    if (
      defined('CRAWLER_PAGE_RENDER') &&
      CRAWLER_PAGE_RENDER === true &&
      ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
    ) {
      return; // Avoid visitor rate-limit storage for a public crawler GET.
    }
    if (self::isLimited($identifier)) {
      sendApiHeaders();
      http_response_code(429);
      echo json_encode(['error' => 'Too many requests. Please try again later.']);
      exit();
    }
  }

  /**
   * Atomically reserve an authentication attempt or terminate when locked out.
   *
   * @param string|null $identifier
   * @return void
   */
  public static function requireAttempt($identifier = null)
  {
    if (!self::consumeAttempt($identifier)) {
      sendApiHeaders();
      http_response_code(429);
      echo json_encode(['error' => 'Too many requests. Please try again later.']);
      exit();
    }
  }
}
