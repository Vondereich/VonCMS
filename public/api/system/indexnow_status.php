<?php
/**
 * VonCMS - IndexNow Status API
 * Returns current IndexNow configuration status
 *
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// Enforce Security (primary admin only can inspect IndexNow key status)
SessionManager::requireValidSession();
SessionManager::requirePrimaryAdmin();

require_once __DIR__ . '/IndexNow.php';

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  $indexNow = new IndexNow($pdo);

  $key = $indexNow->getKey();
  $enabled = $indexNow->isEnabled();
  $keyFileExists = $indexNow->keyFileExists();

  echo json_encode([
    'success' => true,
    'enabled' => $enabled,
    'key_configured' => !empty($key),
    'key_file_exists' => $keyFileExists,
    'key_preview' => $key ? substr($key, 0, 8) . '...' : null, // Show only first 8 chars for security
    'status' => $enabled && !empty($key) && $keyFileExists ? 'ready' : 'incomplete',
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
