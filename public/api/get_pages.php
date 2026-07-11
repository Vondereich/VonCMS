<?php
/**
 * VonCMS - Get Pages API
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

if (!function_exists('voncms_normalize_fulltext_search')) {
  function voncms_normalize_fulltext_search(string $value): string
  {
    $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text);
    if (!is_string($normalized)) {
      $normalized = preg_replace('/[^a-zA-Z0-9\s]+/', ' ', $text);
    }
    $normalized = is_string($normalized) ? trim(preg_replace('/\s+/u', ' ', $normalized)) : '';
    return is_string($normalized) ? $normalized : '';
  }
}

if (!function_exists('voncms_escape_like_search')) {
  function voncms_escape_like_search(string $value): string
  {
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], (string) $value);
  }
}

// Check session
try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  // 1.1 Draft pages exposed to unauthenticated users (Fix)
  $currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
  $canReadProtectedPages = in_array($currentRole, ['admin', 'root', 'moderator'], true);
  $isAdmin = $canReadProtectedPages;
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
  $whereClauses = [];
  $params = [];

  if (!$isAdmin) {
    $whereClauses[] = "p.status = 'published'";
  }

  if (isset($_GET['id']) && $_GET['id'] !== '') {
    $whereClauses[] = 'p.id = :id';
    $params[':id'] = (string) $_GET['id'];
  } elseif (isset($_GET['slug']) && $_GET['slug'] !== '') {
    $whereClauses[] = 'p.slug = :slug';
    $params[':slug'] = (string) $_GET['slug'];
  }

  $search = trim((string) ($_GET['search'] ?? ''));
  if ($search !== '') {
    $search = function_exists('mb_substr')
      ? mb_substr($search, 0, 120, 'UTF-8')
      : substr($search, 0, 120);
  }
  if ($search !== '' && strlen($search) >= 2) {
    $hasFulltextSearch = false;
    $fulltextSearch = voncms_normalize_fulltext_search($search);
    $searchLike = '%' . voncms_escape_like_search($search) . '%';

    try {
      $indexStmt = $pdo->query("SHOW INDEX FROM pages WHERE Key_name = 'ft_title_content'");
      $hasFulltextSearch = $indexStmt && $indexStmt->fetch(PDO::FETCH_ASSOC) !== false;
    } catch (Throwable $e) {
      $hasFulltextSearch = false;
    }

    if ($hasFulltextSearch && $fulltextSearch !== '' && strlen($fulltextSearch) >= 2) {
      $whereClauses[] =
        "(p.title LIKE :searchLike ESCAPE '\\\\' OR p.content LIKE :searchLike ESCAPE '\\\\' OR MATCH(p.title, p.content) AGAINST(:searchTerm IN BOOLEAN MODE))";
      $params[':searchTerm'] = $fulltextSearch;
      $params[':searchLike'] = $searchLike;
    } else {
      $whereClauses[] =
        "(p.title LIKE :searchLike ESCAPE '\\\\' OR p.content LIKE :searchContentLike ESCAPE '\\\\')";
      $params[':searchLike'] = $searchLike;
      $params[':searchContentLike'] = $searchLike;
    }
  }

  $statusClause = $whereClauses ? ' WHERE ' . implode(' AND ', $whereClauses) : '';
  $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
  $requestedLimit = isset($_GET['limit']) ? (int) $_GET['limit'] : 200;
  $limit = max(1, min(200, $requestedLimit));
  $offset = ($page - 1) * $limit;

  // Count total (same WHERE clause as SELECT below)
  $countSql = "SELECT COUNT(*) FROM pages p LEFT JOIN users u ON p.author_id = u.id $statusClause";
  $totalStmt = $pdo->prepare($countSql);
  foreach ($params as $key => $value) {
    $totalStmt->bindValue($key, $value, is_numeric($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $totalStmt->execute();
  $total = (int) $totalStmt->fetchColumn();

  $stmt = $pdo->prepare(
    "SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.status, p.keywords, p.meta_description, p.author_id, p.created_at, p.updated_at, $authorNameSql as author_name, u.username as author_username, $authorDisplayNameSql as author_display_name
     FROM pages p
     LEFT JOIN users u ON p.author_id = u.id
     $statusClause
     ORDER BY p.created_at DESC
     LIMIT :limit OFFSET :offset",
  );
  foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value, is_numeric($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();
  $pages = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Transform for frontend compatibility (Page interface)
  $result = array_map(function ($page) use ($isAdmin) {
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    $publicPage = [
      'id' => (string) $page['id'],
      'title' => $page['title'] ?? '',
      'slug' => $page['slug'] ?? '',
      'content' =>
        is_https() && $host && isset($page['content'])
          ? str_replace('http://' . $host, 'https://' . $host, $page['content'])
          : $page['content'] ?? '',
      'excerpt' => $page['excerpt'] ?? '',
      'status' => $page['status'] ?? 'draft',
      'keywords' => $page['keywords'] ?? '',
      'meta_description' => $page['meta_description'] ?? '',
      'created_at' => $page['created_at'] ?? date('Y-m-d H:i:s'),
      'updated_at' => $page['updated_at'] ?? ($page['created_at'] ?? date('Y-m-d H:i:s')),
      'author' => $page['author_name'] ?? '',
      'author_data' => [
        'username' => $page['author_username'] ?? ($page['author_name'] ?? ''),
        'display_name' => $page['author_display_name'] ?? '',
      ],
      'author_id' => $isAdmin && isset($page['author_id']) ? (string) $page['author_id'] : null,
    ];

    return ResponseHelper::shapeContentPayload($publicPage, $isAdmin);
  }, $pages);

  echo json_encode(
    [
      'success' => true,
      'pages' => $result,
      'meta' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'totalPages' => ceil($total / $limit) ?: 1,
        'hasMore' => $page * $limit < $total,
      ],
    ],
    JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
  );
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
