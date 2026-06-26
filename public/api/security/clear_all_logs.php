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

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

try {
  $mode = $_GET['mode'] ?? 'purge'; // 'purge' or 'full'

  if ($mode === 'full') {
    // Truncate table to reset ID and clear all data
    $pdo->exec('TRUNCATE TABLE security_logs');
    $message = 'All security logs cleared successfully';
  } else {
    // Default: Only purge logs older than 30 days
    $pdo->exec('DELETE FROM security_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    $message = 'Logs older than 30 days purged successfully';
  }

  echo json_encode([
    'success' => true,
    'message' => $message,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
