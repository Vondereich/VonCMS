<?php
/**
 * VonCMS - Save Post API
 * Creates or updates a post in the database
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

voncms_apply_site_timezone($pdo ?? null);

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

$currentUser = $_SESSION['user'] ?? null;
$currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
$canManagePosts = in_array($currentRole, ['admin', 'root', 'moderator', 'writer'], true);

if (!$canManagePosts) {
  ResponseHelper::sendError('Not authorized to manage posts', 403);
}

try {
  if (isset($pdo) && $pdo instanceof PDO) {
    voncms_ensure_content_audit_logs_table($pdo);
  }
} catch (Throwable $auditBootstrapError) {
  error_log('VonCMS Audit Bootstrap: ' . $auditBootstrapError->getMessage());
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
$clientUpdatedAt = trim((string) ($input['baseUpdatedAt'] ?? ''));

if (!isset($input['title']) || trim($input['title']) === '') {
  ResponseHelper::sendError('Title is required', 400);
}

// Content length limit (prevent DoS - max 1MB)
if (isset($input['content']) && strlen($input['content']) > 1048576) {
  ResponseHelper::sendError('Content too large. Maximum 1MB allowed.', 400);
}

// Sanitize input - but preserve fields that shouldn't be HTML encoded
$rawContent = $input['content'] ?? '';
$rawTitle = $input['title'] ?? '';
$rawSlug = $input['slug'] ?? '';
$rawExcerpt = $input['excerpt'] ?? '';
$rawMeta = $input['metaDescription'] ?? ($input['meta_description'] ?? '');
$rawKeywords = $input['keywords'] ?? '';

if (function_exists('mb_strlen') ? mb_strlen($rawTitle) > 255 : strlen($rawTitle) > 255) {
  ResponseHelper::sendError('Title is too long. Maximum 255 characters allowed.', 400);
}

// SECURITY: Prevent Stored XSS
// 1. Admins get "God Mode" (full tags), non-admins get safe tags only
if (!SessionManager::isAdmin()) {
  $allowedTags =
    '<h1><h2><h3><h4><h5><h6><p><b><strong><i><em><u><ul><ol><li><a><img><figure><figcaption><iframe><blockquote><pre><code><br><hr><table><thead><tbody><tr><th><td><span><div>';
  $rawContent = strip_tags($rawContent, $allowedTags);
}

// 2. Extra Paranoid: Remove inline event handlers (onload, onerror, etc.) FOR ALL USERS
// Handles quoted and UNQUOTED attributes to prevent logic bypasses
$rawContent = preg_replace('/on[a-z]+\s*=\s*(?:["\'][^"\']*["\']|[^\s>]+)/i', '', $rawContent);

// 3. Remove javascript: protocol FOR ALL USERS
$rawContent = preg_replace('/javascript\s*:/i', '', $rawContent);

if (function_exists('sanitize_input')) {
  $input = sanitize_input($input);
}

// Restore raw values (don't HTML-encode these)
$input['content'] = $rawContent;
$input['title'] = $rawTitle;
$input['excerpt'] = $rawExcerpt;
$input['metaDescription'] = $rawMeta;
$input['meta_description'] = $rawMeta;
$input['keywords'] = $rawKeywords;

// Generate slug if not provided (use raw title)
if (empty($rawSlug)) {
  $input['slug'] = preg_replace('/[^a-z0-9\-]+/', '-', strtolower($rawTitle));
} else {
  $input['slug'] = $rawSlug;
}
$input['slug'] = preg_replace('/[^a-z0-9\-]+/', '-', strtolower((string) $input['slug']));
$input['slug'] = preg_replace('/-+/', '-', (string) $input['slug']);
$input['slug'] = trim((string) $input['slug'], '-');

// Ensure slug uniqueness (prevent SEO issues)
// Note: Dead code removed here; uniqueness is checked safely inside the transaction block later.

// Handle image field (frontend uses 'image', database uses 'image_url')
$featuredImage = $input['image'] ?? ($input['featured_image'] ?? ($input['image_url'] ?? ''));

// Auto-detect first image from content if no featured image provided
if (empty($featuredImage) && !empty($rawContent)) {
  // Match first img src in content
  if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $rawContent, $matches)) {
    $featuredImage = $matches[1];
  }
}

// Auto-generate excerpt from content if not provided
$excerpt = $input['excerpt'] ?? '';
if (empty(trim($excerpt)) && !empty($rawContent)) {
  // Strip HTML tags and get first 160 characters
  $plainText = strip_tags($rawContent);
  $plainText = preg_replace('/\s+/', ' ', $plainText); // Normalize whitespace
  $excerpt = trim(substr($plainText, 0, 160));
  if (strlen($plainText) > 160) {
    $excerpt .= '...';
  }
}

$db = null;

try {
  // Check if database connection exists
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    ResponseHelper::sendError('Database not configured', 503);
    return;
  }
  /** @var PDO $db */
  $db = $pdo;

  // Start Transaction (Critical for Concurrency)
  $db->beginTransaction();

  // Check if this is an update (has numeric ID) or insert (no ID or temp ID)
  $postId = $input['id'] ?? null;
  $isUpdate = $postId && is_numeric($postId);

  if ($isUpdate) {
    $checkOwner = $db->prepare('SELECT id, author_id, status, slug FROM posts WHERE id = ?');
    $checkOwner->execute([$postId]);
    $ownerPost = $checkOwner->fetch(PDO::FETCH_ASSOC);

    if (!$ownerPost) {
      $db->rollBack();
      ResponseHelper::sendError('Post not found', 404);
    }

    $isPostOwner = (string) ($ownerPost['author_id'] ?? '') === (string) ($currentUser['id'] ?? '');
    $isAdminOrModerator = SessionManager::isAdmin() || $currentRole === 'moderator';

    if (!$isPostOwner && !$isAdminOrModerator) {
      $db->rollBack();
      ResponseHelper::sendError('Not authorized to edit this post', 403);
    }

    $existingPost = $ownerPost;
  }

  // Get category (default to Uncategorized if not provided)
  $category = $input['category'] ?? 'Uncategorized';

  // Get meta description
  $metaDescription = $input['meta_description'] ?? '';

  // --- Handling Scheduled Logic ---
  $scheduledAt = $input['scheduledAt'] ?? null;
  $status = $input['status'] ?? 'draft';

  // Whitelist status check for security
  $validStatuses = ['published', 'draft', 'scheduled', 'archived'];
  if (!in_array($status, $validStatuses, true)) {
    $status = 'draft';
  }

  // Logic: If status is 'scheduled', valid date is required. Otherwise reset to draft or clear date.
  if ($status === 'scheduled') {
    if ($scheduledAt) {
      $scheduledInput = str_replace('T', ' ', trim((string) $scheduledAt));
      $scheduledTimezone = new DateTimeZone(date_default_timezone_get());
      $scheduledDate = false;

      foreach (['Y-m-d H:i:s', 'Y-m-d H:i'] as $format) {
        $candidate = DateTime::createFromFormat($format, $scheduledInput, $scheduledTimezone);
        if ($candidate instanceof DateTime) {
          $scheduledDate = $candidate;
          break;
        }
      }

      if ($scheduledDate instanceof DateTime) {
        $scheduledAt = $scheduledDate->format('Y-m-d H:i:s');
      } else {
        // Invalid date
        $scheduledAt = null;
        $status = 'draft';
      }
    } else {
      // Missing date
      $status = 'draft';
    }
  } else {
    // Not scheduled status = no scheduled date
    $scheduledAt = null;
  }

  // --- Slug Uniqueness Check (INSIDE TRANSACTION) ---
  // We check for collision right before write to minimize race condition window
  // Also fetch current status for SEO Safety check
  $checkExisting = $db->prepare(
    'SELECT status, slug, updated_at FROM posts WHERE id = ? FOR UPDATE',
  );
  $checkExisting->execute([$postId ?? 0]);
  $dbPost = $checkExisting->fetch();

  if ($isUpdate && $dbPost && $clientUpdatedAt !== '' && !empty($dbPost['updated_at'])) {
    $clientTimestamp = strtotime($clientUpdatedAt);
    $serverTimestamp = strtotime((string) $dbPost['updated_at']);
    if (
      $clientTimestamp !== false &&
      $serverTimestamp !== false &&
      $serverTimestamp > $clientTimestamp
    ) {
      $db->rollBack();
      http_response_code(409);
      echo json_encode([
        'success' => false,
        'error' => 'Content changed in another tab. Reload before saving again.',
      ]);
      exit();
    }
  }

  // --- SERVER-SIDE SEO SAFETY ---
  if ($dbPost && $dbPost['status'] === 'published' && $status === 'scheduled') {
    throw new Exception('Cannot schedule an already published post (SEO Safety).');
  }

  if (isset($dbPost) && $dbPost['slug'] === $input['slug']) {
    // Slug matches current, no change needed
  } else {
    $checkSlug = $db->prepare('SELECT id FROM posts WHERE slug = ? AND id != ? FOR UPDATE');
    $checkSlug->execute([$input['slug'], $postId ?? 0]);
    if ($checkSlug->fetch()) {
      // Collision detected - append timestamp to make it unique
      $input['slug'] .= '-' . time();
    }
  }
  if ($isUpdate) {
    // SMART SLUG PROTECTION: Auto-create redirect on slug change (Gold Standard)
    if (
      $existingPost['status'] === 'published' &&
      !empty($existingPost['slug']) &&
      $existingPost['slug'] !== $input['slug']
    ) {
      try {
        $oldUrl = '/' . ltrim($existingPost['slug'], '/');
        $newUrl = '/' . ltrim($input['slug'], '/');

        $redirectStmt = $db->prepare(
          'INSERT IGNORE INTO redirects (source_url, target_url, redirect_type) VALUES (?, ?, ?)',
        );
        $redirectStmt->execute([$oldUrl, $newUrl, '301']);
      } catch (Exception $re) {
        // Silent fail for redirects if table missing
      }
    }

    // Update existing post
    $stmt = $db->prepare("UPDATE posts SET 
            title = :title, 
            slug = :slug, 
            content = :content, 
            excerpt = :excerpt, 
            status = :status, 
            image_url = :image_url,
            keywords = :keywords,
            category = :category,
            meta_description = :meta_description,
            scheduled_at = :scheduled_at,
            updated_at = NOW()
        WHERE id = :id");

    $stmt->execute([
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $excerpt,
      'status' => $status,
      'image_url' => $featuredImage,
      'keywords' => $input['keywords'] ?? '',
      'category' => $category,
      'meta_description' => $metaDescription,
      'scheduled_at' => $scheduledAt,
      'id' => $postId,
    ]);

    try {
      $oldStatus = strtolower((string) ($existingPost['status'] ?? ''));
      $newStatus = strtolower((string) $status);
      $summary =
        $oldStatus !== '' && $oldStatus !== $newStatus
          ? sprintf(
            'Post updated: status changed from %s to %s',
            ucfirst($oldStatus),
            ucfirst($newStatus),
          )
          : 'Post updated';

      voncms_record_content_audit(
        $db,
        'post',
        (int) $postId,
        'update',
        $_SESSION['user'] ?? [],
        $summary,
        [
          'title' => (string) ($input['title'] ?? ''),
          'old_status' => $oldStatus,
          'new_status' => $newStatus,
          'old_slug' => (string) ($existingPost['slug'] ?? ''),
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Update: ' . $auditError->getMessage());
    }

    $finalId = (string) $postId;
    $message = 'Post updated';
  } else {
    // Insert new post
    $stmt = $db->prepare("INSERT INTO posts 
            (title, slug, content, excerpt, status, image_url, keywords, category, meta_description, author_id, scheduled_at, created_at, updated_at) 
            VALUES 
            (:title, :slug, :content, :excerpt, :status, :image_url, :keywords, :category, :meta_description, :author_id, :scheduled_at, NOW(), NOW())");

    $stmt->execute([
      'title' => $input['title'],
      'slug' => $input['slug'],
      'content' => $input['content'] ?? '',
      'excerpt' => $excerpt,
      'status' => $status,
      'image_url' => $featuredImage,
      'keywords' => $input['keywords'] ?? '',
      'category' => $category,
      'meta_description' => $metaDescription,
      'author_id' => $_SESSION['user']['id'],
      'scheduled_at' => $scheduledAt,
    ]);

    $finalId = (string) $db->lastInsertId();

    try {
      voncms_record_content_audit(
        $db,
        'post',
        (int) $finalId,
        'create',
        $_SESSION['user'] ?? [],
        sprintf('Post created as %s', ucfirst((string) $status)),
        [
          'title' => (string) ($input['title'] ?? ''),
          'new_status' => strtolower((string) $status),
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Create: ' . $auditError->getMessage());
    }

    $message = 'Post created';
  }

  $savedUpdatedAt = date('Y-m-d H:i:s');
  $savedUpdatedAtStmt = $db->prepare('SELECT updated_at FROM posts WHERE id = ?');
  $savedUpdatedAtStmt->execute([$finalId]);
  $savedUpdatedAt = (string) ($savedUpdatedAtStmt->fetchColumn() ?: $savedUpdatedAt);

  // Commit Transaction
  $db->commit();
  voncms_public_cache_clear();

  // INDEXNOW INTEGRATION: Notify search engines instantly
  // OTA SAFETY: Wrapped in try-catch to prevent blocking if IndexNow class is missing
  if ($status === 'published') {
    try {
      $indexNowFile = __DIR__ . '/system/IndexNow.php';
      if (file_exists($indexNowFile)) {
        require_once $indexNowFile;
        $indexNow = new IndexNow($db);
        if ($indexNow->isEnabled()) {
          $postUrl = $indexNow->buildPostUrlForPost((int) $finalId);
          // Non-blocking: We don't wait for response or care if it fails
          // The main post save is already committed
          $indexNow->ping($postUrl);
        }
      }
    } catch (Exception $indexNowError) {
      // Silent fail - IndexNow is optional enhancement, not critical
      // Log to error_log if debugging is needed
      // error_log('IndexNow ping failed: ' . $indexNowError->getMessage());
    }
  }

  if (ob_get_length()) {
    ob_clean();
  }
  echo json_encode([
    'success' => true,
    'message' => $message,
    'id' => $finalId,
    'slug' => $input['slug'],
    'image' => ResponseHelper::scrubUrl($featuredImage),
    'category' => $category,
    'updated_at' => $savedUpdatedAt,
    'updatedAt' => $savedUpdatedAt,
  ]);
} catch (Exception $e) {
  // Rollback validation
  if ($db instanceof PDO && $db->inTransaction()) {
    $db->rollBack();
  }
  ResponseHelper::sendError($e);
}
