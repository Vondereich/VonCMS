<?php
/**
 * VonCMS - Delete Contact Form
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'], true)) {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

CSRFProtection::requireToken();

$input = json_decode(CSRFProtection::getRequestBody(), true);
$id = $input['id'] ?? '';

if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $id)) {
  ResponseHelper::sendError('Missing ID', 400);
}

try {
  $pdo->beginTransaction();
  $submissionStmt = $pdo->prepare('DELETE FROM contact_submissions WHERE form_id = ?');
  $submissionStmt->execute([$id]);
  $stmt = $pdo->prepare('DELETE FROM contact_forms WHERE id = ?');
  $stmt->execute([$id]);
  $pdo->commit();
  echo json_encode(['success' => true]);
} catch (Exception $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
