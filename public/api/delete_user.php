<?php
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
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

  $pdo->exec(
    'CREATE TABLE IF NOT EXISTS comment_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_comment_like (comment_id, user_id),
        INDEX idx_comment_likes_comment (comment_id),
        INDEX idx_comment_likes_user (user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  );

  // Start Transaction (Critical for Multi-Table Cleanup)
  $pdo->beginTransaction();

  $likedCommentStmt = $pdo->prepare(
    'SELECT DISTINCT comment_id FROM comment_likes WHERE user_id = :id',
  );
  $likedCommentStmt->execute(['id' => $id]);
  $likedCommentIds = array_map('intval', $likedCommentStmt->fetchAll(PDO::FETCH_COLUMN));

  $pdo->prepare('DELETE FROM comment_likes WHERE user_id = :id')->execute(['id' => $id]);

  if (!empty($likedCommentIds)) {
    $placeholders = implode(',', array_fill(0, count($likedCommentIds), '?'));
    $recountStmt = $pdo->prepare(
      "UPDATE comments c
       SET likes = (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)
       WHERE c.id IN ($placeholders)",
    );
    $recountStmt->execute($likedCommentIds);
  }

  // Cascade: Update posts and comments to NULL author (don't delete content)
  $pdo->prepare('UPDATE posts SET author_id = NULL WHERE author_id = :id')->execute(['id' => $id]);
  $pdo->prepare('UPDATE comments SET user_id = NULL WHERE user_id = :id')->execute(['id' => $id]);

  // Now delete the user
  $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
  $stmt->execute(['id' => $id]);

  // Commit logic
  $pdo->commit();
  voncms_public_cache_clear();

  echo json_encode(['success' => true, 'message' => 'User deleted']);
} catch (Exception $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
