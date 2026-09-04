<?php
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/publication_time_helper.php';
require_once __DIR__ . '/role_capability_helper.php';
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

$hasPublishedAtColumn =
  isset($pdo) && $pdo instanceof PDO ? voncms_has_publication_column($pdo, 'pages') : false;
$publishedAtSelect =
  isset($pdo) && $pdo instanceof PDO
    ? voncms_publication_column_sql($pdo, 'pages')
    : 'NULL AS published_at';

SessionManager::requireValidSession();
CSRFProtection::requireToken();

$currentUser = $_SESSION['user'] ?? null;
$currentRole = strtolower((string) ($currentUser['role'] ?? ''));
$canManagePages = voncms_role_has_capability($currentRole, 'pages.create');

if (!$canManagePages) {
  ResponseHelper::sendError('Page management access required', 403);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

foreach (
  [
    'id',
    'baseUpdatedAt',
    'title',
    'slug',
    'content',
    'excerpt',
    'metaDescription',
    'meta_description',
    'keywords',
    'status',
  ]
  as $field
) {
  if (array_key_exists($field, $input) && $input[$field] !== null && !is_scalar($input[$field])) {
    ResponseHelper::sendError('Invalid page payload', 400);
  }
}

$clientUpdatedAt = trim((string) ($input['baseUpdatedAt'] ?? ''));

if (
  !isset($input['title']) ||
  trim((string) $input['title']) === '' ||
  !isset($input['slug']) ||
  trim((string) $input['slug']) === ''
) {
  ResponseHelper::sendError('Title and Slug are required', 400);
}

// Content length limit (prevent DoS - max 1MB)
if (isset($input['content']) && strlen((string) $input['content']) > 1048576) {
  ResponseHelper::sendError('Content too large. Maximum 1MB allowed.', 400);
}

// Sanitize input - but preserve fields that should not be HTML encoded
$rawContent = (string) ($input['content'] ?? '');
$rawTitle = (string) ($input['title'] ?? '');
$rawSlug = (string) ($input['slug'] ?? '');
$rawExcerpt = (string) ($input['excerpt'] ?? '');
$rawMeta = (string) ($input['metaDescription'] ?? ($input['meta_description'] ?? ''));
$rawKeywords = (string) ($input['keywords'] ?? '');

if (function_exists('mb_strlen') ? mb_strlen($rawTitle) > 255 : strlen($rawTitle) > 255) {
  ResponseHelper::sendError('Title is too long. Maximum 255 characters allowed.', 400);
}
if (mb_strlen($rawSlug) > 255) {
  ResponseHelper::sendError('Slug is too long. Maximum 255 characters allowed.', 400);
}
if (mb_strlen($rawExcerpt) > 220) {
  ResponseHelper::sendError('Excerpt is too long. Maximum 220 characters allowed.', 400);
}
if (mb_strlen($rawMeta) > 5000 || mb_strlen($rawKeywords) > 255) {
  ResponseHelper::sendError('Page metadata exceeds the allowed length.', 400);
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
      "SELECT author_id, status, slug, updated_at, {$publishedAtSelect} FROM pages WHERE id = ? FOR UPDATE",
    );
    $checkOwner->execute([$pageId]);
    $existingPage = $checkOwner->fetch(PDO::FETCH_ASSOC);

    if (!$existingPage) {
      ResponseHelper::sendError('Page not found', 404);
    }

    $isOwner = $existingPage['author_id'] == $currentUser['id'];
    $isAdminOrModerator = voncms_role_has_capability($currentRole, 'pages.edit_any');

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

    $status = $input['status'] ?? 'draft';
    $validStatuses = ['published', 'draft', 'archived'];
    if (!in_array($status, $validStatuses, true)) {
      $status = 'draft';
    }

    // Update existing page
    $publishedAtAssignment = $hasPublishedAtColumn
      ? "published_at = CASE WHEN :publish_now = 1 AND published_at IS NULL THEN NOW() ELSE published_at END,\n            "
      : '';
    $stmt = $pdo->prepare("UPDATE pages SET 
            title = :title, 
            slug = :slug, 
            content = :content, 
            excerpt = :excerpt, 
            status = :status, 
            keywords = :keywords,
            meta_description = :meta_description,
            {$publishedAtAssignment}
            updated_at = NOW() 
        WHERE id = :id");

    $updateParams = [
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $input['excerpt'] ?? '',
      'status' => $status,
      'keywords' => $keywords,
      'meta_description' => $metaDescription,
      'id' => $pageId,
    ];
    if ($hasPublishedAtColumn) {
      $updateParams['publish_now'] = $status === 'published' ? 1 : 0;
    }
    $stmt->execute($updateParams);

    try {
      $oldStatus = strtolower((string) ($existingPage['status'] ?? ''));
      $newStatus = $status;
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
    $savedUpdatedAtStmt = $pdo->prepare(
      "SELECT updated_at, {$publishedAtSelect} FROM pages WHERE id = ?",
    );
    $savedUpdatedAtStmt->execute([$pageId]);
    $savedTimestamps = $savedUpdatedAtStmt->fetch(PDO::FETCH_ASSOC);
    $savedTimestamps = is_array($savedTimestamps) ? $savedTimestamps : [];
    $savedUpdatedAt = (string) ($savedTimestamps['updated_at'] ?? null ?: $savedUpdatedAt);
    $savedPublishedAt = $savedTimestamps['published_at'] ?? null;

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
      'status' => $status,
      'published_at' => $savedPublishedAt,
      'publishedAt' => $savedPublishedAt,
      'updated_at' => $savedUpdatedAt,
      'updatedAt' => $savedUpdatedAt,
    ]);
  } else {
    // Insert new page
    $publishedAtColumn = $hasPublishedAtColumn ? ', published_at' : '';
    $publishedAtValue = $hasPublishedAtColumn
      ? ', CASE WHEN :publish_now = 1 THEN NOW() ELSE NULL END'
      : '';
    $stmt = $pdo->prepare(
      "INSERT INTO pages (title, slug, content, excerpt, status, keywords, meta_description, author_id{$publishedAtColumn}, created_at, updated_at) VALUES (:title, :slug, :content, :excerpt, :status, :keywords, :meta_description, :author_id{$publishedAtValue}, NOW(), NOW())",
    );
    $status = $input['status'] ?? 'draft';
    $validStatuses = ['published', 'draft', 'archived'];
    if (!in_array($status, $validStatuses, true)) {
      $status = 'draft';
    }

    $insertParams = [
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $input['excerpt'] ?? '',
      'status' => $status,
      'keywords' => $keywords,
      'meta_description' => $metaDescription,
      'author_id' => $currentUser['id'],
    ];
    if ($hasPublishedAtColumn) {
      $insertParams['publish_now'] = $status === 'published' ? 1 : 0;
    }
    $stmt->execute($insertParams);

    $newId = $pdo->lastInsertId();

    try {
      voncms_record_content_audit(
        $pdo,
        'page',
        (int) $newId,
        'create',
        $currentUser ?? [],
        sprintf('Page created as %s', ucfirst($status)),
        [
          'title' => (string) ($input['title'] ?? ''),
          'new_status' => $status,
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Create: ' . $auditError->getMessage());
    }

    // Commit Transaction
    $savedUpdatedAt = date('Y-m-d H:i:s');
    $savedUpdatedAtStmt = $pdo->prepare(
      "SELECT updated_at, {$publishedAtSelect} FROM pages WHERE id = ?",
    );
    $savedUpdatedAtStmt->execute([$newId]);
    $savedTimestamps = $savedUpdatedAtStmt->fetch(PDO::FETCH_ASSOC);
    $savedTimestamps = is_array($savedTimestamps) ? $savedTimestamps : [];
    $savedUpdatedAt = (string) ($savedTimestamps['updated_at'] ?? null ?: $savedUpdatedAt);
    $savedPublishedAt = $savedTimestamps['published_at'] ?? null;

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
      'status' => $status,
      'published_at' => $savedPublishedAt,
      'publishedAt' => $savedPublishedAt,
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
