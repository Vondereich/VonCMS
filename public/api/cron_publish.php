<?php
/**
 * VonCMS - Cron Publish
 * Optional: shared-hosting cron can call this endpoint for quiet sites.
 * Normal public traffic already runs the shared scheduler.
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../scheduler_helper.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

voncms_apply_site_timezone($pdo ?? null);

// SECURITY: Keep long-lived cron credentials out of URL logs and browser history.
// Define CRON_KEY in von_config.php and send it only through X-Cron-Key.
$providedKey = (string) ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
$configuredKey = defined('CRON_KEY') ? (string) constant('CRON_KEY') : '';

if (!empty($configuredKey) && !hash_equals($configuredKey, $providedKey)) {
  ResponseHelper::sendError('Unauthorized: Invalid Cron Key', 401);
}

// Fallback: If no key is set, require valid session for manual triggers
if (empty($configuredKey)) {
  if (!SessionManager::isAdmin()) {
    ResponseHelper::sendError('Unauthorized: Admin access or CRON_KEY required', 403);
  }
}

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  $count = voncms_publish_scheduled_posts($pdo);

  echo json_encode([
    'success' => true,
    'message' => 'Publish job completed',
    'published_count' => $count,
    'timestamp' => date('Y-m-d H:i:s'),
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
