<?php
/**
 * VonCMS - Get Single Post API
 * Fetch a single post by ID or slug
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
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}
require_once __DIR__ . '/../media_variants.php';
require_once __DIR__ . '/../scheduler_helper.php';

$id = isset($_GET['id']) ? trim((string) $_GET['id']) : null;
$slug = isset($_GET['slug']) ? trim((string) $_GET['slug']) : null;

if ($id !== null && $id !== '' && !preg_match('/^\d+$/', $id)) {
  ResponseHelper::sendError('Post ID must be numeric; use slug parameter for slugs', 400);
}

if (($id === null || $id === '') && ($slug === null || $slug === '')) {
  ResponseHelper::sendError('ID or slug required', 400);
}

if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

try {
  voncms_apply_site_timezone($pdo ?? null);
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $authorNameSql = $hasDisplayNameColumn
    ? "COALESCE(NULLIF(u.display_name, ''), u.username)"
    : 'u.username';
  $authorDisplayNameSql = $hasDisplayNameColumn ? 'u.display_name' : 'NULL';

  $isAdmin = SessionManager::isAdmin();
  $canReadProtectedPost = SessionManager::isStaff();
  $currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
  $currentUserId = (string) ($_SESSION['user']['id'] ?? '');
  $currentTimestamp = date('Y-m-d H:i:s');

  // Keep dashboard behavior practical: when admin opens edit view, due scheduled posts are advanced.
  if ($canReadProtectedPost) {
    voncms_run_scheduler_if_due($pdo, dirname(__DIR__) . '/data/scheduler.lock');
  }

  $publicStatusClause =
    "(p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?)";
  if ($canReadProtectedPost && $currentRole === 'writer') {
    $statusClause = " AND (($publicStatusClause) OR p.author_id = ?)";
  } elseif ($canReadProtectedPost) {
    $statusClause = '';
  } else {
    $statusClause = " AND $publicStatusClause";
  }

  if ($id !== null && $id !== '') {
    $sql =
      "SELECT p.*, 
            p.created_at AS createdAt, p.updated_at AS updatedAt, p.scheduled_at AS scheduledAt,
            $authorNameSql AS author_name,
            u.username AS author_username,
            $authorDisplayNameSql AS author_display_name,
            u.avatar AS author_avatar
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.id = ?" . $statusClause;
    $stmt = $pdo->prepare($sql);
    $params = [(int) $id];
    if (!$canReadProtectedPost || $currentRole === 'writer') {
      $params[] = $currentTimestamp;
    }
    if ($canReadProtectedPost && $currentRole === 'writer') {
      $params[] = $currentUserId;
    }
    $stmt->execute($params);
  } else {
    $sql =
      "SELECT p.*, 
            p.created_at AS createdAt, p.updated_at AS updatedAt, p.scheduled_at AS scheduledAt,
            $authorNameSql AS author_name,
            u.username AS author_username,
            $authorDisplayNameSql AS author_display_name,
            u.avatar AS author_avatar
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.slug = ?" . $statusClause;
    $stmt = $pdo->prepare($sql);
    $params = [$slug];
    if (!$canReadProtectedPost || $currentRole === 'writer') {
      $params[] = $currentTimestamp;
    }
    if ($canReadProtectedPost && $currentRole === 'writer') {
      $params[] = $currentUserId;
    }
    $stmt->execute($params);
  }

  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$row) {
    ResponseHelper::sendError('Post not found', 404);
  }

  if (!$canReadProtectedPost) {
    // View tracking must not change the content freshness timestamp used by editor conflict checks.
    $pdo
      ->prepare('UPDATE posts SET views = views + 1, updated_at = updated_at WHERE id = ?')
      ->execute([$row['id']]);
  }

  $normalized = array_change_key_case($row, CASE_LOWER);

  $authorName = $normalized['author_name'] ?? ($normalized['author'] ?? '');
  $authorUsername = $normalized['author_username'] ?? ($normalized['author'] ?? $authorName);
  $authorDisplayName = $normalized['author_display_name'] ?? '';
  $authorAvatar = ResponseHelper::scrubAvatarUrl($normalized['author_avatar'] ?? '');
  $createdAt = $normalized['created_at'] ?? ($normalized['createdat'] ?? date('Y-m-d H:i:s'));
  $updatedAt = $normalized['updated_at'] ?? ($normalized['updatedat'] ?? $createdAt);
  $scheduledAt = $normalized['scheduled_at'] ?? ($normalized['scheduledat'] ?? null);

  $chars = isset($normalized['content']) ? strlen(strip_tags($normalized['content'])) : 0;
  $readTimeMins = max(1, ceil($chars / 1000));
  $readTime = $readTimeMins . ' min read';

  $imagePath = $normalized['image_url'] ?? '';
  $responsiveImage = voncms_build_responsive_image_data($imagePath, dirname(__DIR__) . '/uploads/');

  $post = [
    'id' => (string) ($normalized['id'] ?? ''),
    'title' => $normalized['title'] ?? '',
    'slug' => $normalized['slug'] ?? '',
    'content' => $normalized['content'] ?? '',
    'excerpt' =>
      $normalized['excerpt'] ??
      (isset($normalized['content']) ? substr(strip_tags($normalized['content']), 0, 200) : ''),
    'readTime' => $readTime,
    'status' => $normalized['status'] ?? 'published',
    'category' => $normalized['category'] ?? 'Uncategorized',
    'views' => (int) ($normalized['views'] ?? 0),
    'image' => ResponseHelper::scrubUrl($imagePath),
    'imageSrcSet' => $responsiveImage['srcSet'],

    'author' => $authorName,
    'author_data' => [
      'username' => $authorUsername,
      'display_name' => $authorDisplayName,
      'avatar' => $authorAvatar,
    ],
    'author_id' => $normalized['author_id'] ?? null,

    'created_at' => $createdAt,
    'updated_at' => $updatedAt,
    'scheduled_at' => $scheduledAt,

    'keywords' => $normalized['keywords'] ?? '',
    'meta_description' => $normalized['meta_description'] ?? '',
  ];

  $post = ResponseHelper::shapeContentPayload($post, $isAdmin);

  if (isset($post['content']) && is_https()) {
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host) {
      $post['content'] = str_replace('http://' . $host, 'https://' . $host, $post['content']);
    }
  }

  echo json_encode(
    [
      'success' => true,
      'post' => $post,
    ],
    JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
  );
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
