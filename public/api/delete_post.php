<?php
/**
 * VonCMS - Delete Post API
 * Deletes a post from the database
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
sendApiHeaders('POST, DELETE, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

$currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
$canManagePosts = in_array($currentRole, ['admin', 'root', 'moderator', 'writer'], true);

if (!$canManagePosts) {
  ResponseHelper::sendError('Not authorized to manage posts', 403);
}

try {
  if (isset($pdo)) {
    voncms_ensure_content_audit_logs_table($pdo);
  }
} catch (Throwable $auditBootstrapError) {
}

$input = json_decode(CSRFProtection::getRequestBody(), true);

$postId = $input['id'] ?? null;

if (!$postId || !is_numeric($postId)) {
  ResponseHelper::sendError('Valid post ID is required', 400);
}

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  $stmt = $pdo->prepare('SELECT id, title, status, slug FROM posts WHERE id = ?');
  $stmt->execute([$postId]);
  $post = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$post) {
    ResponseHelper::sendError('Post not found', 404);
  }

  // Delete the post
  $stmt = $pdo->prepare('DELETE FROM posts WHERE id = :id');
  $stmt->execute(['id' => $postId]);

  $rowsAffected = $stmt->rowCount();

  if ($rowsAffected > 0) {
    try {
      voncms_record_content_audit(
        $pdo,
        'post',
        (int) $postId,
        'delete',
        $_SESSION['user'] ?? [],
        'Post deleted',
        [
          'title' => (string) ($post['title'] ?? ''),
          'old_status' => strtolower((string) ($post['status'] ?? '')),
          'old_slug' => (string) ($post['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
    }

    echo json_encode([
      'success' => true,
      'message' => 'Post deleted',
      'id' => (string) $postId,
    ]);
  } else {
    echo json_encode([
      'success' => false,
      'message' => 'Post not found',
    ]);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
