<?php
/**
 * VonCMS - Delete Contact Form
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

CSRFProtection::requireToken();

$input = json_decode(CSRFProtection::getRequestBody(), true);
$id = $input['id'] ?? '';

if (!$id) {
  ResponseHelper::sendError('Missing ID', 400);
  exit();
}

try {
  $stmt = $pdo->prepare('DELETE FROM contact_forms WHERE id = ?');
  $stmt->execute([$id]);
  echo json_encode(['success' => true]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
