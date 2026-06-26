<?php
/**
 * VonCMS - Cron Publish
 * Recommended: Set up a Cron Job to calls this URL every minute
 * e.g. curl https://yoursite.com/api/cron_publish.php
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

// SECURITY: Check for secret cron key or admin session
// You can define CRON_KEY in von_config.php for automated tasks
$providedKey = $_GET['key'] ?? '';
$configuredKey = defined('CRON_KEY') ? (string) constant('CRON_KEY') : '';

if (!empty($configuredKey) && $providedKey !== $configuredKey) {
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
