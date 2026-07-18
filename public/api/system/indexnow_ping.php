<?php
/**
 * VonCMS - IndexNow Manual Ping API
 * Manually trigger IndexNow ping for a specific URL or the homepage
 *
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

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();
SessionManager::requirePrimaryAdmin();

require_once __DIR__ . '/IndexNow.php';

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  $input = json_decode(CSRFProtection::getRequestBody(), true);
  $url = $input['url'] ?? null;

  $indexNow = new IndexNow($pdo);

  if (!$indexNow->isEnabled()) {
    ResponseHelper::sendError('IndexNow is not enabled', 400);
  }

  // If no URL provided, ping the homepage
  if (empty($url)) {
    $url = $indexNow->buildPostUrl('');
  }

  // Validate URL
  if (!filter_var($url, FILTER_VALIDATE_URL)) {
    ResponseHelper::sendError('Invalid URL format', 400);
  }

  $result = $indexNow->ping($url);

  echo json_encode([
    'success' => $result['success'],
    'message' => $result['message'],
    'url' => $url,
    'status_code' => $result['status_code'] ?? null,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
