<?php

require_once __DIR__ . '/../core/DataBoundary.php';
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/schema_repair_helper.php';
require_once __DIR__ . '/role_capability_helper.php';
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

$currentRole = DataBoundary::userText('role');
if (!voncms_role_has_capability($currentRole, 'users.manage')) {
  ResponseHelper::sendError('User management access required', 403);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);

if (!is_array($input) || !isset($input['id']) || !is_scalar($input['id'])) {
  ResponseHelper::sendError('User ID is required', 400);
}

$id = $input['id'];
$currentUserId = DataBoundary::userText('id');
$isPrimaryAdminActor = SessionManager::isPrimaryAdmin();

// The first installed administrator is the non-deletable Super Admin account.
if ((int) $id === 1) {
  ResponseHelper::sendError('The Super Admin account cannot be deleted', 403);
}

// Protect Self-Deletion
if ((string) $id === $currentUserId) {
  ResponseHelper::sendError('Cannot delete your own account', 403);
}

$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
try {
  // Keep target authority and all dependent writes bound to the same locked row.
  $pdo->beginTransaction();
  $targetStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ? FOR UPDATE');
  $targetStmt->execute([$id]);
  $targetUser = DataBoundary::row($targetStmt->fetch(PDO::FETCH_ASSOC));

  if (!$targetUser) {
    $pdo->rollBack();
    ResponseHelper::sendError('User not found', 404);
  }

  // MySQL can resolve numeric aliases such as "002" to ID 2. Authorize the stored identity.
  $id = (string) $targetUser['id'];
  if ($id === '1' || $id === $currentUserId) {
    $pdo->rollBack();
    ResponseHelper::sendError(
      $id === '1' ? 'The Super Admin account cannot be deleted' : 'Cannot delete your own account',
      403,
    );
  }
  $targetRole = strtolower((string) ($targetUser['role'] ?? ''));
  if (
    !$isPrimaryAdminActor &&
    voncms_user_target_requires_primary_admin($targetUser['id'], $targetRole)
  ) {
    $pdo->rollBack();
    ResponseHelper::sendError(
      'System owner permission is required to delete this protected account',
      403,
    );
  }

  try {
    $likedCommentStmt = $pdo->prepare(
      'SELECT DISTINCT comment_id FROM comment_likes WHERE user_id = :id',
    );
    $likedCommentStmt->execute(['id' => $id]);
    $likedCommentIds = array_map(
      'intval',
      DataBoundary::column($likedCommentStmt->fetchAll(PDO::FETCH_COLUMN)),
    );

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
  } catch (Throwable $likeStorageError) {
    if (!voncms_schema_error_requires_repair($likeStorageError)) {
      throw $likeStorageError;
    }
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
} catch (Throwable $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
