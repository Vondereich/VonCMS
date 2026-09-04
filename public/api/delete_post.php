<?php
/**
 * VonCMS - Delete Post API
 * Deletes a post from the database
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/role_capability_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, DELETE, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

$currentUser = $_SESSION['user'] ?? null;
$currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
$canManagePosts =
  voncms_role_has_capability($currentRole, 'posts.delete_any') ||
  voncms_role_has_capability($currentRole, 'posts.delete_own_draft');

if (!$canManagePosts) {
  ResponseHelper::sendError('Not authorized to manage posts', 403);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);

$postId = $input['id'] ?? null;

if (!is_scalar($postId) || !preg_match('/^\d+$/', (string) $postId) || (int) $postId < 1) {
  ResponseHelper::sendError('Valid post ID is required', 400);
}

$db = null;

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    ResponseHelper::sendError('Database not configured', 503);
  }
  /** @var PDO $db */
  $db = $pdo;
  $db->beginTransaction();

  $stmt = $db->prepare(
    'SELECT id, author_id, title, status, slug FROM posts WHERE id = ? FOR UPDATE',
  );
  $stmt->execute([$postId]);
  $post = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$post) {
    $db->rollBack();
    ResponseHelper::sendError('Post not found', 404);
  }

  $isPostOwner = (string) ($post['author_id'] ?? '') === (string) ($currentUser['id'] ?? '');
  $status = strtolower(trim((string) ($post['status'] ?? 'draft')));
  $canDeleteAny = voncms_role_has_capability($currentRole, 'posts.delete_any');
  $canDeleteOwnDraft =
    $isPostOwner &&
    $status === 'draft' &&
    voncms_role_has_capability($currentRole, 'posts.delete_own_draft');

  if (!$canDeleteAny && !$canDeleteOwnDraft) {
    $db->rollBack();
    ResponseHelper::sendError('Not authorized to delete this post', 403);
  }

  // Delete the post
  $stmt = $db->prepare('DELETE FROM posts WHERE id = :id');
  $stmt->execute(['id' => $postId]);

  $rowsAffected = $stmt->rowCount();

  if ($rowsAffected > 0) {
    try {
      voncms_record_content_audit(
        $db,
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

    $db->commit();
    voncms_public_cache_clear();

    echo json_encode([
      'success' => true,
      'message' => 'Post deleted',
      'id' => (string) $postId,
    ]);
  } else {
    $db->rollBack();
    echo json_encode([
      'success' => false,
      'message' => 'Post not found',
    ]);
  }
} catch (Exception $e) {
  if ($db instanceof PDO && $db->inTransaction()) {
    $db->rollBack();
  }
  ResponseHelper::sendError($e);
}
