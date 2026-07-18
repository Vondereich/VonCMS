<?php
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

// Enforce Security
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

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
  error_log('VonCMS Audit Bootstrap: ' . $auditBootstrapError->getMessage());
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
$clientUpdatedAt = trim((string) ($input['baseUpdatedAt'] ?? ''));

if (
  !isset($input['title']) ||
  trim($input['title']) === '' ||
  !isset($input['slug']) ||
  trim($input['slug']) === ''
) {
  ResponseHelper::sendError('Title and Slug are required', 400);
}

// Content length limit (prevent DoS - max 1MB)
if (isset($input['content']) && strlen($input['content']) > 1048576) {
  ResponseHelper::sendError('Content too large. Maximum 1MB allowed.', 400);
}

// Sanitize input - but preserve fields that should not be HTML encoded
$rawContent = $input['content'] ?? '';
$rawTitle = $input['title'] ?? '';
$rawSlug = $input['slug'] ?? '';
$rawExcerpt = $input['excerpt'] ?? '';
$rawMeta = $input['metaDescription'] ?? ($input['meta_description'] ?? '');
$rawKeywords = $input['keywords'] ?? '';

if (function_exists('mb_strlen') ? mb_strlen($rawTitle) > 255 : strlen($rawTitle) > 255) {
  ResponseHelper::sendError('Title is too long. Maximum 255 characters allowed.', 400);
}

// SECURITY: Match post-save hardening for page content too
if (!SessionManager::isAdmin()) {
  $allowedTags =
    '<h1><h2><h3><h4><h5><h6><p><b><strong><i><em><u><ul><ol><li><a><img><figure><figcaption><iframe><blockquote><pre><code><br><hr><table><thead><tbody><tr><th><td><span><div>';
  $rawContent = strip_tags($rawContent, $allowedTags);
}

$rawContent = preg_replace('/on[a-z]+\s*=\s*(?:["\'][^"\']*["\']|[^\s>]+)/i', '', $rawContent);
$rawContent = preg_replace('/javascript\s*:/i', '', $rawContent);

if (function_exists('sanitize_input')) {
  $input = sanitize_input($input);
}

$input['content'] = $rawContent;
$input['title'] = $rawTitle;
$input['slug'] = $rawSlug;
$input['excerpt'] = $rawExcerpt;
$input['metaDescription'] = $rawMeta;
$input['meta_description'] = $rawMeta;
$input['keywords'] = $rawKeywords;

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  // Start Transaction (Critical for Atomic Slug Check)
  $pdo->beginTransaction();

  $pageId = $input['id'] ?? null;
  $isUpdate = $pageId && is_numeric($pageId);

  // Ensure slug uniqueness (prevent SEO issues) - LOCKING READ
  $checkSlug = $pdo->prepare('SELECT id FROM pages WHERE slug = ? AND id != ? FOR UPDATE');
  $checkSlug->execute([$input['slug'], $pageId ?? 0]);
  if ($checkSlug->fetch()) {
    // Collision detected - append timestamp
    $input['slug'] .= '-' . time();
  }

  // Get meta description and keywords
  $metaDescription = $input['meta_description'] ?? '';
  $keywords = $input['keywords'] ?? '';

  if ($isUpdate) {
    // SECURITY: Check ownership before update
    $checkOwner = $pdo->prepare(
      'SELECT author_id, status, slug, updated_at FROM pages WHERE id = ? FOR UPDATE',
    );
    $checkOwner->execute([$pageId]);
    $existingPage = $checkOwner->fetch(PDO::FETCH_ASSOC);

    if (!$existingPage) {
      ResponseHelper::sendError('Page not found', 404);
    }

    $isOwner = $existingPage['author_id'] == $currentUser['id'];
    $isAdminOrModerator = SessionManager::isAdmin() || $currentRole === 'moderator';

    if (!$isOwner && !$isAdminOrModerator) {
      ResponseHelper::sendError('Not authorized to edit this page', 403);
    }

    if ($clientUpdatedAt !== '' && !empty($existingPage['updated_at'])) {
      $clientTimestamp = strtotime($clientUpdatedAt);
      $serverTimestamp = strtotime((string) $existingPage['updated_at']);
      if (
        $clientTimestamp !== false &&
        $serverTimestamp !== false &&
        $serverTimestamp > $clientTimestamp
      ) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
          'success' => false,
          'error' => 'Content changed in another tab. Reload before saving again.',
        ]);
        exit();
      }
    }

    // Update existing page
    $stmt = $pdo->prepare("UPDATE pages SET 
            title = :title, 
            slug = :slug, 
            content = :content, 
            excerpt = :excerpt, 
            status = :status, 
            keywords = :keywords,
            meta_description = :meta_description,
            updated_at = NOW() 
        WHERE id = :id");
    $status = $input['status'] ?? 'draft';
    $validStatuses = ['published', 'draft', 'archived'];
    if (!in_array($status, $validStatuses, true)) {
      $status = 'draft';
    }

    $stmt->execute([
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $input['excerpt'] ?? '',
      'status' => $status,
      'keywords' => $keywords,
      'meta_description' => $metaDescription,
      'id' => $pageId,
    ]);

    try {
      $oldStatus = strtolower((string) ($existingPage['status'] ?? ''));
      $newStatus = strtolower((string) ($input['status'] ?? 'draft'));
      $summary =
        $oldStatus !== '' && $oldStatus !== $newStatus
          ? sprintf(
            'Page updated: status changed from %s to %s',
            ucfirst($oldStatus),
            ucfirst($newStatus),
          )
          : 'Page updated';

      voncms_record_content_audit(
        $pdo,
        'page',
        (int) $pageId,
        'update',
        $currentUser ?? [],
        $summary,
        [
          'title' => (string) ($input['title'] ?? ''),
          'old_status' => $oldStatus,
          'new_status' => $newStatus,
          'old_slug' => (string) ($existingPage['slug'] ?? ''),
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Update: ' . $auditError->getMessage());
    }

    // Commit Transaction
    $savedUpdatedAt = date('Y-m-d H:i:s');
    $savedUpdatedAtStmt = $pdo->prepare('SELECT updated_at FROM pages WHERE id = ?');
    $savedUpdatedAtStmt->execute([$pageId]);
    $savedUpdatedAt = (string) ($savedUpdatedAtStmt->fetchColumn() ?: $savedUpdatedAt);

    $pdo->commit();
    voncms_public_cache_clear();

    if (ob_get_length()) {
      ob_clean();
    }
    echo json_encode([
      'success' => true,
      'message' => 'Page updated',
      'id' => (string) $pageId,
      'slug' => $input['slug'],
      'updated_at' => $savedUpdatedAt,
      'updatedAt' => $savedUpdatedAt,
    ]);
  } else {
    // Insert new page
    $stmt = $pdo->prepare(
      'INSERT INTO pages (title, slug, content, excerpt, status, keywords, meta_description, author_id, created_at, updated_at) VALUES (:title, :slug, :content, :excerpt, :status, :keywords, :meta_description, :author_id, NOW(), NOW())',
    );
    $status = $input['status'] ?? 'draft';
    $validStatuses = ['published', 'draft', 'archived'];
    if (!in_array($status, $validStatuses, true)) {
      $status = 'draft';
    }

    $stmt->execute([
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $input['excerpt'] ?? '',
      'status' => $status,
      'keywords' => $keywords,
      'meta_description' => $metaDescription,
      'author_id' => $currentUser['id'],
    ]);

    $newId = $pdo->lastInsertId();

    try {
      voncms_record_content_audit(
        $pdo,
        'page',
        (int) $newId,
        'create',
        $currentUser ?? [],
        sprintf('Page created as %s', ucfirst((string) ($input['status'] ?? 'draft'))),
        [
          'title' => (string) ($input['title'] ?? ''),
          'new_status' => strtolower((string) ($input['status'] ?? 'draft')),
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Create: ' . $auditError->getMessage());
    }

    // Commit Transaction
    $savedUpdatedAt = date('Y-m-d H:i:s');
    $savedUpdatedAtStmt = $pdo->prepare('SELECT updated_at FROM pages WHERE id = ?');
    $savedUpdatedAtStmt->execute([$newId]);
    $savedUpdatedAt = (string) ($savedUpdatedAtStmt->fetchColumn() ?: $savedUpdatedAt);

    $pdo->commit();
    voncms_public_cache_clear();

    if (ob_get_length()) {
      ob_clean();
    }
    echo json_encode([
      'success' => true,
      'message' => 'Page created',
      'id' => (string) $newId,
      'slug' => $input['slug'],
      'updated_at' => $savedUpdatedAt,
      'updatedAt' => $savedUpdatedAt,
    ]);
  }
} catch (Exception $e) {
  // Rollback on error
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
