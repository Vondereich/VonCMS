<?php
/**
 * SecurityLogger Utility
 * Central handling for logging security events
 */

class SecurityLogger
{
  /**
   * Convert untrusted scalar input to valid UTF-8 and cap it by bytes.
   *
   * @param mixed $value
   */
  private static function boundedString($value, string $fallback, int $maxBytes): string
  {
    if (!is_scalar($value) && $value !== null) {
      return $fallback;
    }

    $string = trim((string) ($value ?? ''));
    if ($string === '') {
      $string = $fallback;
    }

    $encoded = json_encode($string, JSON_INVALID_UTF8_SUBSTITUTE);
    if (is_string($encoded)) {
      $decoded = json_decode($encoded, true);
      if (is_string($decoded)) {
        $string = $decoded;
      }
    }

    if (strlen($string) <= $maxBytes) {
      return $string;
    }

    if (function_exists('mb_strcut')) {
      $bounded = mb_strcut($string, 0, $maxBytes, 'UTF-8');
      return is_string($bounded) ? $bounded : $fallback;
    }

    return substr($string, 0, $maxBytes);
  }

  /**
   * @param mixed $details
   */
  private static function encodeDetails($details): string
  {
    if (!is_array($details)) {
      $details =
        is_scalar($details) || $details === null
          ? ['value' => $details]
          : ['value_type' => get_debug_type($details)];
    }

    $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE;
    $json = json_encode($details, $flags);
    if (!is_string($json)) {
      return '{}';
    }

    if (strlen($json) <= 16000) {
      return $json;
    }

    $preview = self::boundedString($json, '', 6000);
    $boundedJson = json_encode(['truncated' => true, 'preview' => $preview], $flags);

    return is_string($boundedJson) ? $boundedJson : '{"truncated":true}';
  }

  /**
   * Log a security event
   *
   * @param string $eventType - 'login_failed', 'honeypot_caught', 'rate_limited', 'csrf_failed'
   * @param string $severity - 'low', 'medium', 'high', 'critical'
   * @param array $details - Associative array of extra details
   * @param bool $blocked - data was blocked/action prevented (default true)
   */
  public static function log($eventType, $severity, $details = [], $blocked = true)
  {
    global $pdo;

    try {
      // Some entry points load the logger before configuration. Re-check the
      // concrete connection type after the optional include and fail open.
      if (!isset($pdo) || !($pdo instanceof PDO)) {
        if (file_exists(__DIR__ . '/../../von_config.php')) {
          require_once __DIR__ . '/../../von_config.php';
        }
      }

      if (!isset($pdo) || !($pdo instanceof PDO)) {
        return;
      }

      $stmt = $pdo->prepare("
                INSERT INTO security_logs 
                (event_type, ip_address, user_agent, endpoint, severity, details, blocked)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

      $event = self::boundedString($eventType, 'security_event', 50);
      $ip = self::boundedString($_SERVER['REMOTE_ADDR'] ?? null, 'unknown', 45);
      $userAgent = self::boundedString($_SERVER['HTTP_USER_AGENT'] ?? null, 'unknown', 1000);
      $requestUri = self::boundedString($_SERVER['REQUEST_URI'] ?? null, 'unknown', 2048);
      $requestPath = parse_url($requestUri, PHP_URL_PATH);
      $endpoint = self::boundedString(
        is_string($requestPath) ? $requestPath : null,
        'unknown',
        255,
      );
      $safeSeverity = strtolower(self::boundedString($severity, 'medium', 20));
      if (!in_array($safeSeverity, ['low', 'medium', 'high', 'critical'], true)) {
        $safeSeverity = 'medium';
      }
      $jsonDetails = self::encodeDetails($details);
      $isBlocked = (bool) $blocked ? 1 : 0;

      $stmt->execute([$event, $ip, $userAgent, $endpoint, $safeSeverity, $jsonDetails, $isBlocked]);
    } catch (Throwable $e) {
      // Security logging is best-effort and must never break the protected request.
      try {
        error_log(
          'SecurityLogger Error: ' .
            self::boundedString($e->getMessage(), 'Unable to record event', 500),
        );
      } catch (Throwable $ignored) {
        // Do not let a secondary logging failure escape either.
      }
    }
  }
}
