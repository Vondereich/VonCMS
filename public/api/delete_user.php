<?php
require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

// Check if user is admin
SessionManager::requireAdmin();

$input = json_decode(CSRFProtection::getRequestBody(), true);

if (!isset($input['id'])) {
  ResponseHelper::sendError('User ID is required', 400);
}

$id = $input['id'];
$currentUserId = (string) ($_SESSION['user']['id'] ?? '');
$isPrimaryAdminActor = SessionManager::isPrimaryAdmin();

// Protect Root Admin (ID 1)
if ((int) $id === 1) {
  ResponseHelper::sendError('Only admin 1 can delete this account', 403);
}

// Protect Self-Deletion
if ((string) $id === (string) $_SESSION['user']['id']) {
  ResponseHelper::sendError('Cannot delete your own account', 403);
}

try {
  $targetStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
  $targetStmt->execute([$id]);
  $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

  if (!$targetUser) {
    ResponseHelper::sendError('User not found', 404);
  }

  $targetRole = strtolower((string) ($targetUser['role'] ?? ''));
  if (!$isPrimaryAdminActor && $targetRole === 'root') {
    ResponseHelper::sendError('Only admin 1 can delete this account', 403);
  }

  // Start Transaction (Critical for Multi-Table Cleanup)
  $pdo->beginTransaction();

  // Cascade: Update posts and comments to NULL author (don't delete content)
  $pdo->prepare('UPDATE posts SET author_id = NULL WHERE author_id = :id')->execute(['id' => $id]);
  $pdo->prepare('UPDATE comments SET user_id = NULL WHERE user_id = :id')->execute(['id' => $id]);

  // Now delete the user
  $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
  $stmt->execute(['id' => $id]);

  // Commit logic
  $pdo->commit();

  echo json_encode(['success' => true, 'message' => 'User deleted']);
} catch (Exception $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
