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

// Security: Admin Only
SessionManager::requireAdmin();
CSRFProtection::requireToken();

// Get ID from JSON or query string
$data = json_decode(file_get_contents('php://input'), true);
$id = (int) ($data['id'] ?? ($_GET['id'] ?? 0));

if ($id <= 0) {
  ResponseHelper::sendError('Invalid redirect ID.', 400);
}

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
