<?php
/**
 * VonCMS - Get Posts API
 * Returns posts with pagination meta for Load More support
 */
require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

ob_start(); // Buffer output to prevent warnings from corrupting JSON
require_once __DIR__ . '/public_cache_helper.php';

$queryValue = static function (string $key, ?string $default = null): ?string {
  if (!array_key_exists($key, $_GET)) {
    return $default;
  }

  $value = $_GET[$key];
  return is_scalar($value) || $value === null ? (string) $value : $default;
};

// Public cache eligibility and keying must be resolved before loading von_config.php.
$configFile = __DIR__ . '/../von_config.php';
$defaultLimit = 15;
$settingsFile = __DIR__ . '/../data/site_settings.json';
if (file_exists($settingsFile)) {
  $siteSettings = json_decode((string) file_get_contents($settingsFile), true);
  if (is_array($siteSettings)) {
    $filePostsPerPage = $siteSettings['posts_per_page'] ?? ($siteSettings['postsPerPage'] ?? null);
    if ($filePostsPerPage !== null) {
      $defaultLimit = max(6, min(50, (int) $filePostsPerPage));
    }
  }
}

$forcePublic = filter_var($queryValue('public', 'false'), FILTER_VALIDATE_BOOLEAN);
$page = max(1, min(100000, (int) $queryValue('page', '1')));
$requestedLimit = (int) $queryValue('limit', (string) $defaultLimit);
$limit = max(1, min(200, $requestedLimit));
$offset = ($page - 1) * $limit;
$category = $queryValue('category');
$normalizedCategory = trim((string) $category);
$authorQuery = $queryValue('author');
$search = trim((string) $queryValue('search', ''));
if ($search !== '') {
  $search = function_exists('mb_substr')
    ? mb_substr($search, 0, 120, 'UTF-8')
    : substr($search, 0, 120);
}
$statusFilterValue = $queryValue('status');
$statusFilter = $statusFilterValue === null ? null : strtolower(trim($statusFilterValue));
$allowedStatusFilters = ['published', 'draft', 'scheduled', 'archived', 'pending_review'];
if ($statusFilter === '') {
  $statusFilter = null;
} elseif ($statusFilter !== null && !in_array($statusFilter, $allowedStatusFilters, true)) {
  ResponseHelper::sendError('Invalid post status filter', 400);
}
$includeTotal = $queryValue('includeTotal', 'true') !== 'false';
$countOnly = filter_var($queryValue('countOnly', 'false'), FILTER_VALIDATE_BOOLEAN);
$countScope = strtolower((string) $queryValue('scope', ''));
$canUsePublicPostsCache =
  file_exists($configFile) &&
  $forcePublic &&
  !$includeTotal &&
  !$countOnly &&
  $authorQuery === null &&
  $statusFilter === null &&
  ($search === '' || strlen($search) >= 2);
$publicPostsCacheKey = $canUsePublicPostsCache
  ? voncms_public_cache_key('posts-list', [
    'page' => $page,
    'limit' => $limit,
    'category' => $normalizedCategory,
    'search' => $search,
    'includeTotal' => false,
    'public' => true,
  ])
  : null;
$publicPostsCacheGate = null;

if ($canUsePublicPostsCache && is_string($publicPostsCacheKey)) {
  if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
  }

  $cachedPublicPosts = voncms_public_cache_get($publicPostsCacheKey, 60);
  if (is_string($cachedPublicPosts)) {
    if (ob_get_length()) {
      ob_clean();
    }
    echo $cachedPublicPosts;
    exit();
  }

  $publicPostsCacheGate = voncms_public_cache_acquire_gate();
  if (is_resource($publicPostsCacheGate)) {
    $cachedPublicPosts = voncms_public_cache_get($publicPostsCacheKey, 60);
    if (is_string($cachedPublicPosts)) {
      voncms_public_cache_release_gate($publicPostsCacheGate);
      if (ob_get_length()) {
        ob_clean();
      }
      echo $cachedPublicPosts;
      exit();
    }
  }
}

if (file_exists($configFile)) {
  require_once $configFile;
}
require_once __DIR__ . '/../media_variants.php';
require_once __DIR__ . '/../content_metrics_helper.php';
require_once __DIR__ . '/../scheduler_helper.php';
require_once __DIR__ . '/../search_query_helper.php';
require_once __DIR__ . '/publication_time_helper.php';
require_once __DIR__ . '/role_capability_helper.php';

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    ResponseHelper::sendError('Database not configured', 503);
    return;
  }
  /** @var PDO $db */
  $db = $pdo;

  voncms_apply_site_timezone($db);
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $db->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $authorNameSql = $hasDisplayNameColumn
    ? "COALESCE(NULLIF(u.display_name, ''), u.username)"
    : 'u.username';
  $authorDisplayNameSql = $hasDisplayNameColumn ? 'u.display_name' : 'NULL';

  $isAdmin = !$forcePublic && SessionManager::isAdmin();
  $currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
  $canReviewPosts = !$forcePublic && voncms_role_can_review_posts($currentRole);
  $canReadOwnProtectedPosts =
    !$forcePublic && voncms_role_has_capability($currentRole, 'posts.read_own_protected');
  $canReadProtectedPosts = $canReviewPosts || $canReadOwnProtectedPosts;
  $mustOwnProtectedPosts = $canReadOwnProtectedPosts && !$canReviewPosts;
  $currentUserId = (string) ($_SESSION['user']['id'] ?? '');
  $currentTimestamp = date('Y-m-d H:i:s');
  if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
  }

  // Keep dashboard behavior practical: when admin opens post manager, due scheduled posts are advanced.
  if ($canReadProtectedPosts) {
    voncms_run_scheduler_if_due($db, dirname(__DIR__) . '/data/scheduler.lock');
  }

  // Initialize search variables to avoid "undefined variable" warnings
  $searchTerm = null;
  $searchLike = null;

  // Build Query
  if ($canReadProtectedPosts && $mustOwnProtectedPosts) {
    $statusClause = ' WHERE p.author_id = :currentUserId';
  } elseif ($canReadProtectedPosts) {
    $statusClause = ' WHERE 1=1';
  } else {
    $statusClause =
      " WHERE (p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= :currentTime)";
  }

  if ($normalizedCategory !== '') {
    $statusClause .= ' AND p.category = :category';
  }

  if ($statusFilter !== null) {
    $statusClause .= ' AND p.status = :statusFilter';
  }

  if ($search !== '' && strlen($search) >= 2) {
    $fulltextSearch = voncms_normalize_fulltext_search($search);
    $searchLike = '%' . voncms_escape_like_search($search) . '%';
    if ($fulltextSearch !== '' && strlen($fulltextSearch) >= 2) {
      $statusClause .=
        " AND (MATCH(p.title, p.content) AGAINST(:searchTerm IN BOOLEAN MODE) OR p.title LIKE :searchLike ESCAPE '\\\\')";
      $searchTerm = $fulltextSearch;
    } else {
      $statusClause .= " AND p.title LIKE :searchLike ESCAPE '\\\\'";
    }
  }

  if ($authorQuery && preg_match('/^[a-zA-Z0-9_.-]+$/', $authorQuery)) {
    $statusClause .= ' AND (u.username = :authorName OR p.author = :authorName)';
  }

  $countStatusClause =
    $canReadProtectedPosts && $canReviewPosts && $countScope === 'all'
      ? ' WHERE 1=1' . ($statusFilter !== null ? ' AND p.status = :statusFilter' : '')
      : $statusClause;
  $canSkipTotal = !$isAdmin && !$includeTotal && $authorQuery === null;
  $queryLimit = $canSkipTotal ? $limit + 1 : $limit;
  $total = 0;

  if ($countOnly || !$canSkipTotal) {
    // Count total for admin, profile activity, and callers that need numbered pagination.
    $countSql =
      'SELECT COUNT(*) FROM posts p LEFT JOIN users u ON p.author_id = u.id ' . $countStatusClause;
    $totalStmt = $db->prepare($countSql);
    if (strpos($countSql, ':currentUserId') !== false) {
      $totalStmt->bindValue(':currentUserId', $currentUserId);
    }
    if (strpos($countSql, ':currentTime') !== false) {
      $totalStmt->bindValue(':currentTime', $currentTimestamp);
    }
    if (strpos($countSql, ':category') !== false) {
      $totalStmt->bindValue(':category', $normalizedCategory);
    }
    if (strpos($countSql, ':searchTerm') !== false) {
      $totalStmt->bindValue(':searchTerm', $searchTerm);
    }
    if (strpos($countSql, ':searchLike') !== false) {
      $totalStmt->bindValue(':searchLike', $searchLike);
    }
    if (strpos($countSql, ':authorName') !== false) {
      $totalStmt->bindValue(':authorName', $authorQuery);
    }
    if (strpos($countSql, ':statusFilter') !== false) {
      $totalStmt->bindValue(':statusFilter', $statusFilter);
    }
    $totalStmt->execute();
    $total = (int) $totalStmt->fetchColumn();
  }

  if ($countOnly) {
    echo json_encode([
      'success' => true,
      'posts' => [],
      'meta' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'totalPages' => 0,
        'hasMore' => false,
        'totalIsExact' => true,
      ],
      'source' => 'database',
    ]);
    exit();
  }

  $totalPages = $total > 0 ? (int) ceil($total / $limit) : 0;
  if (!$canSkipTotal && $page > 1 && $page > $totalPages) {
    echo json_encode([
      'success' => true,
      'posts' => [],
      'meta' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'totalPages' => $totalPages,
        'hasMore' => false,
        'totalIsExact' => true,
      ],
      'source' => 'database',
    ]);
    exit();
  }

  // Keep list payloads bounded: full content is intentionally left to get_post.php.
  $publishedAtSql = voncms_publication_column_sql($db, 'posts', 'p');
  $publicationExpression = voncms_publication_expression_sql($db, 'posts', 'p');
  $sql = "SELECT
    p.id,
    p.title,
    p.slug,
    CHAR_LENGTH(p.content) AS content_chars,
    COALESCE(NULLIF(p.excerpt, ''), SUBSTRING(p.content, 1, 200)) as excerpt,
    p.status,
    p.image_url,
    p.category,
    p.keywords,
    p.views,
    p.author_id,
    p.author,
    p.created_at,
    p.updated_at,
    p.scheduled_at,
    {$publishedAtSql},
    {$publicationExpression} AS effective_publish_at,
    $authorNameSql AS author_name,
    u.username AS author_username,
    $authorDisplayNameSql AS author_display_name,
    u.avatar AS author_avatar
  FROM posts p
  LEFT JOIN users u ON p.author_id = u.id
  $statusClause
  ORDER BY effective_publish_at DESC, p.created_at DESC, p.id DESC
  LIMIT :limit OFFSET :offset";

  $stmt = $db->prepare($sql);
  $stmt->bindValue(':limit', $queryLimit, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  if (strpos($sql, ':currentUserId') !== false) {
    $stmt->bindValue(':currentUserId', $currentUserId);
  }
  if (strpos($sql, ':currentTime') !== false) {
    $stmt->bindValue(':currentTime', $currentTimestamp);
  }
  if (strpos($sql, ':category') !== false) {
    $stmt->bindValue(':category', $normalizedCategory);
  }
  if (strpos($sql, ':searchTerm') !== false) {
    $stmt->bindValue(':searchTerm', $searchTerm);
  }
  if (strpos($sql, ':searchLike') !== false) {
    $stmt->bindValue(':searchLike', $searchLike);
  }
  if (strpos($sql, ':authorName') !== false) {
    $stmt->bindValue(':authorName', $authorQuery);
  }
  if (strpos($sql, ':statusFilter') !== false) {
    $stmt->bindValue(':statusFilter', $statusFilter);
  }
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  $hasMore = false;
  if ($canSkipTotal) {
    $hasMore = count($rows) > $limit;
    if ($hasMore) {
      $rows = array_slice($rows, 0, $limit);
    }
    $total = $offset + count($rows) + ($hasMore ? 1 : 0);
  }

  // --- DOUBLE CONTRACT PAYLOAD ---
  $result = array_map(function ($row) use ($isAdmin) {
    $authorDisplayName = $row['author_name'] ?? ($row['author'] ?? '');
    $authorUsername = $row['author_username'] ?? ($row['author'] ?? $authorDisplayName);
    $authorDisplayNameRaw = $row['author_display_name'] ?? '';
    $avatar = ResponseHelper::scrubAvatarUrl($row['author_avatar'] ?? '');
    $createdAt = $row['created_at'] ?? date('Y-m-d H:i:s');
    $updatedAt = $row['updated_at'] ?? $createdAt;
    $scheduledAt = $row['scheduled_at'] ?? null;
    $publishedAt = $row['published_at'] ?? null;

    // Match the shared raw-content character contract without fetching full bodies.
    $chars = (int) ($row['content_chars'] ?? 0);
    $readTime = voncms_format_read_time($chars);

    $imagePath = $row['image_url'] ?? '';
    $responsiveImage = voncms_build_responsive_image_data(
      $imagePath,
      dirname(__DIR__) . '/uploads/',
    );

    $post = [
      'id' => (string) ($row['id'] ?? ''),
      'title' => $row['title'] ?? '',
      'slug' => $row['slug'] ?? '',
      'excerpt' => strip_tags($row['excerpt'] ?? ''),
      'readTime' => $readTime,
      'status' => $row['status'] ?? 'published',
      'category' => $row['category'] ?? 'Uncategorized',
      'keywords' => $row['keywords'] ?? '',
      'views' => (int) ($row['views'] ?? 0),
      'image' => ResponseHelper::scrubUrl($imagePath),
      'imageSrcSet' => $responsiveImage['srcSet'],

      // Standardized Author Contract
      'author' => $authorDisplayName,
      'author_data' => [
        'username' => $authorUsername,
        'display_name' => $authorDisplayNameRaw,
        'avatar' => $avatar,
      ],
      'author_id' => $isAdmin ? $row['author_id'] ?? null : null,

      // Standardized Date Contract
      'created_at' => $createdAt,
      'updated_at' => $updatedAt,
      'scheduled_at' => $scheduledAt,
      'published_at' => $publishedAt,
    ];

    return ResponseHelper::shapeContentPayload($post, $isAdmin);
  }, $rows);

  $responseJson = json_encode([
    'posts' => $result,
    'meta' => [
      'page' => $page,
      'limit' => $limit,
      'total' => $total,
      'totalPages' => ceil($total / $limit) ?: 1,
      'hasMore' => $canSkipTotal ? $hasMore : $page * $limit < $total,
      'totalIsExact' => !$canSkipTotal,
    ],
  ]);

  if (!is_string($responseJson)) {
    ResponseHelper::sendError('Failed to encode posts response', 500);
  }

  if (
    $canUsePublicPostsCache &&
    is_string($publicPostsCacheKey) &&
    is_resource($publicPostsCacheGate)
  ) {
    voncms_public_cache_set($publicPostsCacheKey, $responseJson, $publicPostsCacheGate);
  }

  voncms_public_cache_release_gate($publicPostsCacheGate);

  echo $responseJson;
} catch (Throwable $e) {
  voncms_public_cache_release_gate($publicPostsCacheGate);
  ResponseHelper::sendError($e);
}
