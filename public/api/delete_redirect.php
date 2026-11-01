<?php
/**
 * VonCMS - Delete Redirect API
 * Deletes a redirect rule by ID.
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'], true)) {
  ResponseHelper::sendError('Method not allowed', 405);
}

require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/redirect_loop_helper.php';

// Security: Admin Only
SessionManager::requireAdmin();
CSRFProtection::requireToken();

// Get ID from JSON or query string
$body = CSRFProtection::getRequestBody();
$data = trim($body) === '' ? [] : json_decode($body, true);
if (!is_array($data) || ($data !== [] && array_is_list($data))) {
  ResponseHelper::sendError('Invalid redirect payload.', 400);
}
$id = voncms_parse_redirect_id($data['id'] ?? ($_GET['id'] ?? null));

if ($id === null) {
  ResponseHelper::sendError('Invalid redirect ID.', 400);
}

$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
try {
  $stmt = $pdo->prepare('DELETE FROM redirects WHERE id = ?');
  $stmt->execute([$id]);

  if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => true, 'message' => 'Redirect deleted.']);
  } else {
    ResponseHelper::sendError('Redirect not found.', 404);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
