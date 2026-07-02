<?php
/**
 * VonCMS - Clear Public Cache API
 * Primary-admin-only endpoint for clearing guest-safe public JSON cache files.
 */

require_once __DIR__ . '/../../security.php';
require_once __DIR__ . '/../public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

$result = voncms_public_cache_clear();

echo json_encode([
  'success' => empty($result['errors']),
  'message' => empty($result['errors'])
    ? 'Public cache cleared.'
    : 'Public cache cleared with some file warnings.',
  'removed' => $result['removed'],
  'errors' => $result['errors'],
]);
