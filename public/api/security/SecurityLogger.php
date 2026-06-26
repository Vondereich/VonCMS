<?php
/**
 * SecurityLogger Utility
 * Central handling for logging security events
 */

class SecurityLogger
{
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

    // Ensure PDO is available
    if (!isset($pdo) || $pdo === null) {
      // Try to include config if not available
      if (file_exists(__DIR__ . '/../../von_config.php')) {
        require_once __DIR__ . '/../../von_config.php';
      } else {
        error_log('SecurityLogger: Database not connected');
        return;
      }
    }

    try {
      $stmt = $pdo->prepare("
                INSERT INTO security_logs 
                (event_type, ip_address, user_agent, endpoint, severity, details, blocked)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

      $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
      $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
      $endpoint = $_SERVER['REQUEST_URI'] ?? 'unknown';
      $jsonDetails = json_encode($details);
      $isBlocked = $blocked ? 1 : 0;

      $stmt->execute([$eventType, $ip, $userAgent, $endpoint, $severity, $jsonDetails, $isBlocked]);

      // Auto-Purge: Delete data older than 30 days (Reliable: check on every log event)
      $pdo->exec('DELETE FROM security_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    } catch (Exception $e) {
      // Silently fail to log to DB, but log to error log
      error_log('SecurityLogger Error: ' . $e->getMessage());
    }
  }
}
