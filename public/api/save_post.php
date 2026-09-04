<?php
/**
 * VonCMS - Save Post API
 * Creates or updates a post in the database
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../seo_schema_helper.php';
require_once __DIR__ . '/content_audit_helper.php';
require_once __DIR__ . '/role_capability_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/publication_time_helper.php';
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
$canManagePosts = voncms_role_has_capability($currentRole, 'posts.create');

if (!$canManagePosts) {
  ResponseHelper::sendError('Not authorized to manage posts', 403);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}
$workflowActionWasExplicit =
  array_key_exists('workflowAction', $input) || array_key_exists('workflow_action', $input);
$requestedWorkflowAction = $input['workflowAction'] ?? ($input['workflow_action'] ?? null);
if ($workflowActionWasExplicit && !voncms_is_post_workflow_action($requestedWorkflowAction)) {
  ResponseHelper::sendError('Invalid post workflow action.', 400);
}
$expectedStatus = is_scalar($input['expectedStatus'] ?? null)
  ? strtolower(trim((string) $input['expectedStatus']))
  : '';
$clientUpdatedAt = trim((string) ($input['baseUpdatedAt'] ?? ''));

if (
  !isset($input['title']) ||
  !is_scalar($input['title']) ||
  trim((string) $input['title']) === ''
) {
  ResponseHelper::sendError('Title is required', 400);
}

// Content length limit (prevent DoS - max 1MB)
if (
  isset($input['content']) &&
  (!is_scalar($input['content']) || strlen((string) $input['content']) > 1048576)
) {
  ResponseHelper::sendError('Content too large. Maximum 1MB allowed.', 400);
}

// Sanitize input - but preserve fields that shouldn't be HTML encoded
$rawContent = (string) ($input['content'] ?? '');
$rawTitle = (string) ($input['title'] ?? '');
$rawSlug = is_scalar($input['slug'] ?? '') ? (string) ($input['slug'] ?? '') : '';
$rawExcerpt = is_scalar($input['excerpt'] ?? '') ? (string) ($input['excerpt'] ?? '') : '';
$rawMetaValue = $input['metaDescription'] ?? ($input['meta_description'] ?? '');
$rawMeta = is_scalar($rawMetaValue) ? (string) $rawMetaValue : '';
$rawKeywords = is_scalar($input['keywords'] ?? '') ? (string) ($input['keywords'] ?? '') : '';

if (function_exists('mb_strlen') ? mb_strlen($rawTitle) > 255 : strlen($rawTitle) > 255) {
  ResponseHelper::sendError('Title is too long. Maximum 255 characters allowed.', 400);
}
if (mb_strlen($rawExcerpt) > 220) {
  ResponseHelper::sendError('Excerpt is too long. Maximum 220 characters allowed.', 400);
}
if (mb_strlen($rawMeta) > 5000 || mb_strlen($rawKeywords) > 255) {
  ResponseHelper::sendError('Post metadata exceeds the allowed length.', 400);
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
if ($input['slug'] === '') {
  ResponseHelper::sendError('A valid slug is required.', 400);
}
$input['slug'] = mb_substr($input['slug'], 0, 255);

// Ensure slug uniqueness (prevent SEO issues)
// Note: Dead code removed here; uniqueness is checked safely inside the transaction block later.

// Handle image field (frontend uses 'image', database uses 'image_url')
$featuredImage = $input['image'] ?? ($input['featured_image'] ?? ($input['image_url'] ?? ''));
$featuredImage = is_scalar($featuredImage) ? trim((string) $featuredImage) : '';
if (mb_strlen($featuredImage) > 255) {
  ResponseHelper::sendError('Featured image URL is too long.', 400);
}

// Auto-detect first image from content if no featured image provided
if (empty($featuredImage) && !empty($rawContent)) {
  // Match first img src in content
  if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $rawContent, $matches)) {
    $featuredImage = $matches[1];
  }
}
if (mb_strlen($featuredImage) > 255) {
  ResponseHelper::sendError('Featured image URL is too long.', 400);
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
  $hasPublishedAtColumn = voncms_has_publication_column($db, 'posts');
  $publishedAtSelect = voncms_publication_column_sql($db, 'posts');

  // Start Transaction (Critical for Concurrency)
  $db->beginTransaction();

  // Check if this is an update (has numeric ID) or insert (no ID or temp ID)
  $postId = $input['id'] ?? null;
  $isUpdate = is_scalar($postId) && preg_match('/^\d+$/', (string) $postId) && (int) $postId > 0;
  $existingPost = null;
  $isPostOwner = !$isUpdate;

  if ($isUpdate) {
    $checkOwner = $db->prepare(
      "SELECT id, author_id, title, status, slug, category, scheduled_at, updated_at, image_url, {$publishedAtSelect} FROM posts WHERE id = ? FOR UPDATE",
    );
    $checkOwner->execute([$postId]);
    $ownerPost = $checkOwner->fetch(PDO::FETCH_ASSOC);

    if (!$ownerPost) {
      $db->rollBack();
      ResponseHelper::sendError('Post not found', 404);
    }

    $isPostOwner = (string) ($ownerPost['author_id'] ?? '') === (string) ($currentUser['id'] ?? '');
    $canEditAnyPost = voncms_role_has_capability($currentRole, 'posts.edit_any');

    if (!$isPostOwner && !$canEditAnyPost) {
      $db->rollBack();
      ResponseHelper::sendError('Not authorized to edit this post', 403);
    }

    $existingPost = $ownerPost;
  }

  $workflowAction = voncms_normalize_post_workflow_action(
    $requestedWorkflowAction,
    $input['status'] ?? 'draft',
  );
  $sourceStatus = $isUpdate ? strtolower((string) ($existingPost['status'] ?? 'draft')) : null;
  $transitionActions = [
    'submit_review',
    'withdraw_review',
    'return_draft',
    'publish',
    'schedule',
    'archive',
  ];

  if ($isUpdate && $workflowActionWasExplicit && $expectedStatus === '') {
    $db->rollBack();
    ResponseHelper::sendError('Expected post status is required for this workflow action.', 400);
  }

  $clientUpdatedTimestamp = $clientUpdatedAt !== '' ? strtotime($clientUpdatedAt) : false;
  if (
    $isUpdate &&
    !$workflowActionWasExplicit &&
    in_array($workflowAction, $transitionActions, true) &&
    $clientUpdatedTimestamp === false
  ) {
    $db->rollBack();
    ResponseHelper::sendError(
      'Post version is required for this legacy workflow action. Reload before trying again.',
      400,
    );
  }

  if ($isUpdate && $expectedStatus !== '' && $expectedStatus !== $sourceStatus) {
    $db->rollBack();
    ResponseHelper::sendError(
      'Post status changed. Reload before applying this workflow action.',
      409,
    );
  }

  $workflow = voncms_resolve_post_workflow(
    $currentRole,
    $sourceStatus,
    $workflowAction,
    $isPostOwner,
    !$isUpdate,
  );
  if (!$workflow['allowed']) {
    $db->rollBack();
    ResponseHelper::sendError($workflow['message'], 403);
  }

  $status = $workflow['status'];
  $statusOnlyTransition = $workflow['status_only'];
  $workflowAuditAction = $workflow['audit_action'];
  $workflowMessage = $workflow['message'];

  // Get category (default to Uncategorized if not provided)
  $category = is_scalar($input['category'] ?? null)
    ? mb_substr(trim((string) $input['category']), 0, 100)
    : 'Uncategorized';
  if ($category === '') {
    $category = 'Uncategorized';
  }

  // Get meta description
  $metaDescription = $input['meta_description'] ?? '';

  // --- Handling Scheduled Logic ---
  $scheduledAt = $input['scheduledAt'] ?? null;

  // The workflow helper is authoritative; keep a defensive status allowlist at the SQL boundary.
  $validStatuses = ['published', 'draft', 'scheduled', 'archived', 'pending_review'];
  if (!in_array($status, $validStatuses, true)) {
    $db->rollBack();
    ResponseHelper::sendError('Invalid post workflow status.', 500);
  }

  // Logic: If status is 'scheduled', valid date is required. Otherwise reset to draft or clear date.
  if ($status === 'scheduled') {
    if ($scheduledAt) {
      $scheduledInput = str_replace('T', ' ', trim((string) $scheduledAt));
      $scheduledTimezone = new DateTimeZone(date_default_timezone_get());
      $scheduledDate = false;

      foreach (['Y-m-d H:i:s', 'Y-m-d H:i'] as $format) {
        $candidate = DateTime::createFromFormat($format, $scheduledInput, $scheduledTimezone);
        $dateErrors = DateTime::getLastErrors();
        $hasDateErrors =
          is_array($dateErrors) &&
          (($dateErrors['warning_count'] ?? 0) > 0 || ($dateErrors['error_count'] ?? 0) > 0);
        if (
          $candidate instanceof DateTime &&
          !$hasDateErrors &&
          $candidate->format($format) === $scheduledInput
        ) {
          $scheduledDate = $candidate;
          break;
        }
      }

      if ($scheduledDate instanceof DateTime) {
        $scheduledAt = $scheduledDate->format('Y-m-d H:i:s');
      } else {
        $db->rollBack();
        ResponseHelper::sendError('A valid schedule date is required.', 400);
      }
    } else {
      $db->rollBack();
      ResponseHelper::sendError('A schedule date is required.', 400);
    }
  } else {
    // Not scheduled status = no scheduled date
    $scheduledAt = null;
  }

  // Updates already own a row lock from the authorization check above.
  $dbPost = $existingPost;

  $storedFeaturedImage = is_array($dbPost) ? trim((string) ($dbPost['image_url'] ?? '')) : '';
  if ($statusOnlyTransition && is_array($dbPost)) {
    $featuredImage = $storedFeaturedImage;
    $input['slug'] = (string) ($dbPost['slug'] ?? $input['slug']);
    $category = (string) ($dbPost['category'] ?? $category);
  } else {
    $featuredImageResolution = voncms_resolve_featured_image_input(
      $featuredImage,
      $storedFeaturedImage,
      $isUpdate && is_array($dbPost),
    );
    if (!$featuredImageResolution['accepted']) {
      $db->rollBack();
      ResponseHelper::sendError('Featured image URL is invalid.', 400);
    }
    $featuredImage = $featuredImageResolution['value'];
  }

  $publicCategoriesChanged = !$isUpdate;
  if ($isUpdate && $dbPost) {
    $previousCategory = trim((string) ($dbPost['category'] ?? 'Uncategorized'));
    $previousStatus = strtolower(trim((string) ($dbPost['status'] ?? '')));
    $previousScheduledAt = trim((string) ($dbPost['scheduled_at'] ?? ''));
    $savedScheduledAt = $scheduledAt === null ? '' : trim((string) $scheduledAt);
    $publicCategoriesChanged =
      $previousCategory !== $category ||
      $previousStatus !== strtolower((string) $status) ||
      $previousScheduledAt !== $savedScheduledAt;
  }

  if (
    (!$statusOnlyTransition || !$workflowActionWasExplicit) &&
    $isUpdate &&
    $dbPost &&
    $clientUpdatedAt !== '' &&
    !empty($dbPost['updated_at'])
  ) {
    $clientTimestamp = $clientUpdatedTimestamp;
    $serverTimestamp = strtotime((string) $dbPost['updated_at']);
    if (
      $clientTimestamp !== false &&
      $serverTimestamp !== false &&
      $serverTimestamp !== $clientTimestamp
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

  if ($statusOnlyTransition) {
    // Workflow-only mutations keep the canonical content fields already stored in the locked row.
  } elseif (is_array($dbPost) && $dbPost['slug'] === $input['slug']) {
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
      !$statusOnlyTransition &&
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

    // Update an existing post. Workflow-only transitions cannot overwrite content fields.
    $publishedAtAssignment = $hasPublishedAtColumn
      ? "published_at = CASE WHEN :publish_now = 1 AND published_at IS NULL THEN NOW() ELSE published_at END,\n            "
      : '';
    if ($statusOnlyTransition) {
      $stmt = $db->prepare("UPDATE posts SET
            status = :status,
            scheduled_at = :scheduled_at,
            {$publishedAtAssignment}
            updated_at = NOW()
        WHERE id = :id");
      $updateParams = [
        'status' => $status,
        'scheduled_at' => $scheduledAt,
        'id' => $postId,
      ];
    } else {
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
            {$publishedAtAssignment}
            updated_at = NOW()
        WHERE id = :id");
      $updateParams = [
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
      ];
    }
    if ($hasPublishedAtColumn) {
      $updateParams['publish_now'] = $status === 'published' ? 1 : 0;
    }
    $stmt->execute($updateParams);

    try {
      $oldStatus = strtolower((string) ($existingPost['status'] ?? ''));
      $newStatus = strtolower((string) $status);
      $summary = $workflowMessage;

      voncms_record_content_audit(
        $db,
        'post',
        (int) $postId,
        $workflowAuditAction,
        $_SESSION['user'] ?? [],
        $summary,
        [
          'title' => $statusOnlyTransition
            ? (string) ($existingPost['title'] ?? '')
            : (string) ($input['title'] ?? ''),
          'old_status' => $oldStatus,
          'new_status' => $newStatus,
          'old_slug' => (string) ($existingPost['slug'] ?? ''),
          'new_slug' => $statusOnlyTransition
            ? (string) ($existingPost['slug'] ?? '')
            : (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Update: ' . $auditError->getMessage());
    }

    $finalId = (string) $postId;
    $message = $workflowMessage;
  } else {
    // Insert new post
    $publishedAtColumn = $hasPublishedAtColumn ? ', published_at' : '';
    $publishedAtValue = $hasPublishedAtColumn
      ? ', CASE WHEN :publish_now = 1 THEN NOW() ELSE NULL END'
      : '';
    $stmt = $db->prepare("INSERT INTO posts 
            (title, slug, content, excerpt, status, image_url, keywords, category, meta_description, author_id, scheduled_at{$publishedAtColumn}, created_at, updated_at)
            VALUES 
            (:title, :slug, :content, :excerpt, :status, :image_url, :keywords, :category, :meta_description, :author_id, :scheduled_at{$publishedAtValue}, NOW(), NOW())");

    $insertParams = [
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
    ];
    if ($hasPublishedAtColumn) {
      $insertParams['publish_now'] = $status === 'published' ? 1 : 0;
    }
    $stmt->execute($insertParams);

    $finalId = (string) $db->lastInsertId();

    try {
      voncms_record_content_audit(
        $db,
        'post',
        (int) $finalId,
        $workflowAuditAction,
        $_SESSION['user'] ?? [],
        $workflowMessage,
        [
          'title' => (string) ($input['title'] ?? ''),
          'new_status' => strtolower((string) $status),
          'new_slug' => (string) ($input['slug'] ?? ''),
        ],
      );
    } catch (Throwable $auditError) {
      error_log('VonCMS Audit Create: ' . $auditError->getMessage());
    }

    $message = $workflowMessage;
  }

  $savedUpdatedAt = date('Y-m-d H:i:s');
  $savedUpdatedAtStmt = $db->prepare(
    "SELECT updated_at, {$publishedAtSelect} FROM posts WHERE id = ?",
  );
  $savedUpdatedAtStmt->execute([$finalId]);
  $savedTimestamps = $savedUpdatedAtStmt->fetch(PDO::FETCH_ASSOC);
  $savedTimestamps = is_array($savedTimestamps) ? $savedTimestamps : [];
  $savedUpdatedAt = (string) ($savedTimestamps['updated_at'] ?? null ?: $savedUpdatedAt);
  $savedPublishedAt = $savedTimestamps['published_at'] ?? null;

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
    'status' => $status,
    'scheduled_at' => $scheduledAt,
    'scheduledAt' => $scheduledAt,
    'published_at' => $savedPublishedAt,
    'publishedAt' => $savedPublishedAt,
    'public_categories_changed' => $publicCategoriesChanged,
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
