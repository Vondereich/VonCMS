<?php
/** Shared server-owned consent policy for both native tracking endpoints. */
if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/../core/DataBoundary.php';

/** @param array<array-key,mixed> $cookies */
function voncms_native_analytics_allowed(PDO $pdo, array $cookies, ?string &$mode = null): bool
{
  $mode = null;
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_group, setting_key, setting_value
       FROM settings
       WHERE (setting_group = 'plugins' AND setting_key IN ('active_plugins', 'plugin_config'))
          OR (setting_group = 'analytics' AND setting_key = 'config')",
    );
    $stmt->execute();
    $values = [];
    foreach (DataBoundary::rows($stmt->fetchAll(PDO::FETCH_ASSOC)) as $row) {
      $key = (string) $row['setting_group'] . '.' . (string) $row['setting_key'];
      $values[$key] = json_decode((string) $row['setting_value'], false, 512, JSON_THROW_ON_ERROR);
    }

    $values += [
      'plugins.active_plugins' => [],
      'plugins.plugin_config' => new stdClass(),
      'analytics.config' => new stdClass(),
    ];
    $activePlugins = $values['plugins.active_plugins'];
    $pluginConfig = $values['plugins.plugin_config'];
    $analyticsConfig = $values['analytics.config'];
    // Missing optional config uses existing defaults. Malformed stored policy never grants consent.
    if (
      !is_array($activePlugins) ||
      !in_array('vp_analytics', $activePlugins, true) ||
      !($pluginConfig instanceof stdClass) ||
      !($analyticsConfig instanceof stdClass)
    ) {
      return false;
    }
    $statuses = $pluginConfig->pluginStatus ?? new stdClass();
    if (!($statuses instanceof stdClass)) {
      return false;
    }
    $status = $statuses->vp_analytics ?? null;
    if ($status !== null && $status !== 'active') {
      return false;
    }

    $consentRequired = $analyticsConfig->cookieConsent ?? false;
    $configuredMode = property_exists($analyticsConfig, 'measurementMode')
      ? $analyticsConfig->measurementMode
      : 'strict';
    if (!is_string($configuredMode) || !in_array($configuredMode, ['strict', 'balanced'], true)) {
      return false;
    }
    if (
      !is_bool($consentRequired) ||
      ($consentRequired && ($cookies['von_consent'] ?? null) !== 'true')
    ) {
      return false;
    }
    $mode = $configuredMode;
    return true;
  } catch (Throwable $error) {
    // Analytics is optional: unavailable or corrupt policy disables visitor recording, not views.
    return false;
  }
}

function voncms_analytics_cookie_path(): string
{
  $script = str_replace(
    '\\',
    '/',
    DataBoundary::serverString('SCRIPT_NAME', '/api/track_visit.php'),
  );
  $base = rtrim(dirname(dirname($script)), '/.');
  return ($base === '' ? '' : $base) . '/';
}

function voncms_analytics_identity_cookie(?string $identity, int $now): void
{
  // Analytics-only identifier, not a login credential. Consent withdrawal may remove it in JS.
  setcookie(voncms_analytics_identity_name(), $identity ?? '', [
    'expires' => $identity === null ? 1 : $now + 30 * 86400,
    'path' => voncms_analytics_cookie_path(),
    'secure' => function_exists('is_https') && is_https(),
    'httponly' => false,
    'samesite' => 'Lax',
  ]);
}

function voncms_analytics_identity_name(): string
{
  return 'von_analytics_id_' . bin2hex(voncms_analytics_cookie_path());
}

/** Analytics-only proxy policy. Authentication and transport detection are unchanged. */
function voncms_analytics_client_address(): string
{
  $remote = $_SERVER['REMOTE_ADDR'] ?? '';
  $remote =
    is_string($remote) && filter_var($remote, FILTER_VALIDATE_IP) !== false ? $remote : '0.0.0.0';
  $header = strtolower(trim((string) getenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER')));
  if (
    !in_array($header, ['cf-connecting-ip', 'x-forwarded-for'], true) ||
    !function_exists('voncms_is_trusted_proxy_address') ||
    !voncms_is_trusted_proxy_address($remote)
  ) {
    return $remote;
  }
  $raw =
    $_SERVER[$header === 'cf-connecting-ip' ? 'HTTP_CF_CONNECTING_IP' : 'HTTP_X_FORWARDED_FOR'] ??
    null;
  if (!is_string($raw) || strlen($raw) > 2048 || preg_match('/[\x00-\x08\x0a-\x1f\x7f]/', $raw)) {
    return $remote;
  }
  $hops = explode(',', $raw);
  if (count($hops) > 32 || ($header === 'cf-connecting-ip' && count($hops) !== 1)) {
    return $remote;
  }
  $client = $remote;
  // Peel only the trusted suffix. A client can forge any unused left-hand prefix.
  while ($hops !== [] && voncms_is_trusted_proxy_address($client)) {
    $hop = trim(array_pop($hops));
    if (filter_var($hop, FILTER_VALIDATE_IP) === false) {
      return $remote;
    }
    $client = $hop;
  }
  return $client;
}

/** Tracking admission never shares authentication/recovery quota storage. */
function voncms_analytics_request_allowed(): bool
{
  $ip = RateLimiter::normalizeLoginAddress(voncms_analytics_client_address());
  return RateLimiter::consumeFixedWindow('tracking:request:' . $ip, 120, 60, 'analytics-request');
}

/** An installation-owned signing key, separate from login and CSRF credentials. */
function voncms_analytics_signing_key(): string
{
  $file =
    PHP_SAPI === 'cli' && defined('VONCMS_ANALYTICS_TEST_KEY_FILE')
      ? (string) constant('VONCMS_ANALYTICS_TEST_KEY_FILE')
      : __DIR__ . '/../data/analytics_signing.key';
  if (is_link($file) || is_link(dirname($file))) {
    throw new RuntimeException('Analytics signing storage is unavailable.');
  }
  $mask = umask(0077);
  try {
    $handle = @fopen($file, 'c+b');
  } finally {
    umask($mask);
  }
  if ($handle === false) {
    throw new RuntimeException('Analytics signing storage is unavailable.');
  }
  try {
    if (!flock($handle, LOCK_EX)) {
      throw new RuntimeException('Analytics signing storage is unavailable.');
    }
    $key = stream_get_contents($handle, 65);
    if ($key === '') {
      $key = bin2hex(random_bytes(32));
      if (fwrite($handle, $key) !== 64 || !fflush($handle)) {
        throw new RuntimeException('Analytics signing storage is unavailable.');
      }
      @chmod($file, 0600);
    }
    if (!is_string($key) || preg_match('/^[a-f0-9]{64}$/D', $key) !== 1) {
      throw new RuntimeException('Analytics signing storage is invalid.');
    }
    return $key;
  } finally {
    flock($handle, LOCK_UN);
    fclose($handle);
  }
}

function voncms_analytics_signed_identity(string $id, int $expires, string $key): string
{
  $payload = 'v1.' . $id . '.' . $expires;
  return $payload .
    '.' .
    hash_hmac('sha256', voncms_analytics_cookie_path() . ':' . $payload, $key);
}

/** Cookie issuance and session-row admission have distinct per-IP budgets. */
function voncms_analytics_identity_budget(string $purpose): bool
{
  if (!in_array($purpose, ['issue', 'session'], true)) {
    return false;
  }
  $ip = RateLimiter::normalizeLoginAddress(voncms_analytics_client_address());
  return RateLimiter::consumeFixedWindow(
    'tracking:' . $purpose . ':' . $ip,
    120,
    3600,
    'analytics-' . $purpose,
  );
}

function voncms_analytics_issue_identity(int $now, string $key): bool
{
  if (!voncms_analytics_identity_budget('issue')) {
    return false;
  }
  voncms_analytics_identity_cookie(
    voncms_analytics_signed_identity(bin2hex(random_bytes(32)), $now + 30 * 86400, $key),
    $now,
  );
  return true;
}

function voncms_analytics_mode_storage_ready(PDO $pdo): bool
{
  try {
    $pdo->query('SELECT measurement_mode FROM analytics WHERE 1=0');
    return true;
  } catch (Throwable $error) {
    return false;
  }
}

/** Call only after applying the server-owned plugin, consent and mode policy.
 * @param array<array-key,mixed> $cookies
 * @return array{visit: bool, throttled: bool, retry: bool, needsRepair?: bool}
 */
function voncms_record_native_visit(
  PDO $pdo,
  string $mode,
  array $cookies,
  string $url,
  string $referrer,
  string $userAgent,
  ?int $now = null,
): array {
  $now ??= time();
  $modeReady = voncms_analytics_mode_storage_ready($pdo);
  $result = ['visit' => false, 'throttled' => false, 'retry' => false];
  if ($mode === 'strict') {
    if (isset($cookies[voncms_analytics_identity_name()])) {
      voncms_analytics_identity_cookie(null, $now);
    }
    $identity = hash_hmac(
      'sha256',
      'strict:' . voncms_analytics_client_address() . ':' . date('Y-m', $now),
      voncms_analytics_signing_key(),
    );
    $modePredicate = $modeReady ? " AND measurement_mode='strict'" : '';
    $recent = $pdo->prepare(
      'SELECT 1 FROM analytics WHERE ip_hash IN (?,?) AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)' .
        $modePredicate .
        ' LIMIT 1',
    );
    // Read legacy rows only for their remaining window; all new rows use the keyed identity.
    $recent->execute([
      $identity,
      hash('sha256', voncms_analytics_client_address() . date('Y-m', $now)),
    ]);
    if ($recent->fetchColumn()) {
      return array_replace($result, ['throttled' => true]);
    }
  } elseif ($mode === 'balanced') {
    if (!$modeReady) {
      return $result + ['needsRepair' => true];
    }
    $pdo->query('SELECT visitor_hash,last_seen,expires_at FROM analytics_sessions WHERE 1=0');
    $key = voncms_analytics_signing_key();
    $raw = $cookies[voncms_analytics_identity_name()] ?? null;
    $parts = [];
    if (
      !is_string($raw) ||
      preg_match('/^v1\.([a-f0-9]{64})\.([0-9]{10})\.([a-f0-9]{64})$/D', $raw, $parts) !== 1 ||
      (int) $parts[2] <= $now ||
      (int) $parts[2] > $now + 30 * 86400 ||
      !hash_equals(voncms_analytics_signed_identity($parts[1], (int) $parts[2], $key), $raw)
    ) {
      // A single client retry proves cookies work; blocked cookies never create visit rows.
      $issued = voncms_analytics_issue_identity($now, $key);
      return array_replace($result, ['retry' => $issued, 'throttled' => !$issued]);
    }
    $identity = hash('sha256', $parts[1]);
    $expires = (int) $parts[2];
    $existing = $pdo->prepare('SELECT 1 FROM analytics_sessions WHERE visitor_hash=?');
    $existing->execute([$identity]);
    $hasSession = (bool) $existing->fetchColumn();
    $existing->closeCursor();
    if (!$hasSession && !voncms_analytics_identity_budget('session')) {
      return array_replace($result, ['throttled' => true]);
    }
    $pdo->beginTransaction();
    try {
      $pdo
        ->prepare(
          'INSERT INTO analytics_sessions (visitor_hash,last_seen,expires_at) VALUES (?,0,?) ON DUPLICATE KEY UPDATE visitor_hash=visitor_hash',
        )
        ->execute([$identity, $expires]);
      $read = $pdo->prepare(
        'SELECT last_seen,expires_at FROM analytics_sessions WHERE visitor_hash=? FOR UPDATE',
      );
      $read->execute([$identity]);
      $session = DataBoundary::row($read->fetch(PDO::FETCH_ASSOC));
      if ($session === false) {
        throw new RuntimeException('Analytics session reservation could not be read.');
      }
      if ((int) $session['expires_at'] <= $now) {
        $pdo->prepare('DELETE FROM analytics_sessions WHERE visitor_hash=?')->execute([$identity]);
        $pdo->commit();
        $issued = voncms_analytics_issue_identity($now, $key);
        return array_replace($result, ['retry' => $issued, 'throttled' => !$issued]);
      }
      $freshSession = (int) $session['last_seen'] <= $now - 1800;
      $pdo
        ->prepare('UPDATE analytics_sessions SET last_seen=? WHERE visitor_hash=?')
        ->execute([$now, $identity]);
      if (!$freshSession) {
        $pdo->commit();
        return array_replace($result, ['throttled' => true]);
      }
      voncms_insert_native_visit($pdo, $identity, 'balanced', $url, $referrer, $userAgent);
      $pdo->commit();
      return array_replace($result, ['visit' => true]);
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      throw $error;
    }
  } else {
    return $result;
  }
  voncms_insert_native_visit(
    $pdo,
    $identity,
    $modeReady ? 'strict' : null,
    $url,
    $referrer,
    $userAgent,
  );
  return array_replace($result, ['visit' => true]);
}

function voncms_insert_native_visit(
  PDO $pdo,
  string $identity,
  ?string $mode,
  string $url,
  string $referrer,
  string $userAgent,
): void {
  $column = $mode === null ? '' : ',measurement_mode';
  $placeholder = $mode === null ? '' : ',?';
  $values = [$url, $referrer, $userAgent, $identity];
  if ($mode !== null) {
    $values[] = $mode;
  }
  $pdo
    ->prepare(
      'INSERT INTO analytics (page_url,referrer,user_agent,ip_hash,visit_date,visit_time,created_at' .
        $column .
        ') VALUES (?,?,?,?,CURDATE(),CURTIME(),NOW()' .
        $placeholder .
        ')',
    )
    ->execute($values);
}

function voncms_prune_analytics_sessions(PDO $pdo, int $now): void
{
  $read = $pdo->prepare(
    'SELECT visitor_hash FROM analytics_sessions WHERE expires_at < ? ORDER BY expires_at LIMIT 100',
  );
  $read->execute([$now]);
  $hashes = DataBoundary::column($read->fetchAll(PDO::FETCH_COLUMN));
  if ($hashes) {
    $pdo
      ->prepare(
        'DELETE FROM analytics_sessions WHERE visitor_hash IN (' .
          implode(',', array_fill(0, count($hashes), '?')) .
          ')',
      )
      ->execute($hashes);
  }
}
