<?php
/**
 * VonCMS - Delete Page API
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
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

$currentUser = $_SESSION['user'] ?? null;
$currentRole = strtolower((string) ($currentUser['role'] ?? ''));
$canManagePages = in_array($currentRole, ['admin', 'root', 'moderator'], true);

if (!$canManagePages) {
  ResponseHelper::sendError('Page management access required', 403);
}

try {
  if (isset($pdo)) {
    voncms_ensure_content_audit_logs_table($pdo);
  }
} catch (Throwable $auditBootstrapError) {
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
$pageId = $input['id'] ?? null;

if (!$pageId || !is_numeric($pageId)) {
  ResponseHelper::sendError('Valid page ID is required', 400);
}

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  // SECURITY: Check ownership before delete
  $stmt = $pdo->prepare('SELECT author_id, title, status, slug FROM pages WHERE id = ?');
  $stmt->execute([$pageId]);
  $page = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$page) {
    ResponseHelper::sendError('Page not found', 404);
  }

  $isOwner = $page['author_id'] == $currentUser['id'];
  $isAdminOrModerator = SessionManager::isAdmin() || $currentRole === 'moderator';

  if (!$isOwner && !$isAdminOrModerator) {
    ResponseHelper::sendError('Not authorized to delete this page', 403);
  }

  $stmt = $pdo->prepare('DELETE FROM pages WHERE id = :id');
  $stmt->execute(['id' => $pageId]);

  if ($stmt->rowCount() > 0) {
    voncms_public_cache_clear();

    try {
      voncms_record_content_audit(
        $pdo,
        'page',
        (int) $pageId,
        'delete',
        $currentUser ?? [],
        'Page deleted',
        [
          'title' => (string) ($page['title'] ?? ''),
          'old_status' => strtolower((string) ($page['status'] ?? '')),
          'old_slug' => (string) ($page['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
    }

    echo json_encode(['success' => true, 'message' => 'Page deleted', 'id' => (string) $pageId]);
  } else {
    ResponseHelper::sendError('Page not found', 404);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
