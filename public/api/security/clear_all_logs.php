<?php
/**
 * Clear Security Logs API
 * SECURITY: Admin-only access
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}
require_once __DIR__ . '/../../scheduler_helper.php';

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

try {
  $mode = $_GET['mode'] ?? 'purge'; // 'purge' or 'full'

  if ($mode === 'full') {
    // Truncate table to reset ID and clear all data
    $pdo->exec('TRUNCATE TABLE security_logs');
    $deleted = null;
    $message = 'All security logs cleared successfully';
  } else {
    // Default: Only purge logs older than 30 days
    $deleted = voncms_purge_expired_security_logs($pdo, 30);
    $message =
      $deleted > 0
        ? sprintf('%d expired security log%s removed.', $deleted, $deleted === 1 ? '' : 's')
        : 'No security logs are older than 30 days yet.';
  }

  echo json_encode([
    'success' => true,
    'message' => $message,
    'deleted' => $deleted,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
