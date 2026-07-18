<?php
/**
 * VonCMS - List Redirects API
 * Returns all redirect rules with pagination.
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

require_once __DIR__ . '/../von_config.php';

// Security: Admin Only
SessionManager::requireAdmin();

// Pagination
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(10, (int) ($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

// Search
$search = mb_substr(trim((string) ($_GET['search'] ?? '')), 0, 120);

try {
  // Build query
  $where = '';
  $params = [];

  if (!empty($search)) {
    $where = "WHERE source_url LIKE ? ESCAPE '\\\\' OR target_url LIKE ? ESCAPE '\\\\'";
    $escapedSearch = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
    $params = ["%$escapedSearch%", "%$escapedSearch%"];
  }

  // Get total count
  $countStmt = $pdo->prepare("SELECT COUNT(*) FROM redirects $where");
  $countStmt->execute($params);
  $total = (int) $countStmt->fetchColumn();

  // Get redirects (parameterized LIMIT/OFFSET for SQL injection prevention)
  $stmt = $pdo->prepare(
    "SELECT * FROM redirects $where ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
  );
  // Bind search params + pagination
  $bindIndex = 1;
  foreach ($params as $param) {
    $stmt->bindValue($bindIndex++, $param, PDO::PARAM_STR);
  }
  $stmt->bindValue($bindIndex++, $limit, PDO::PARAM_INT);
  $stmt->bindValue($bindIndex, $offset, PDO::PARAM_INT);
  $stmt->execute();
  $redirects = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode([
    'success' => true,
    'data' => $redirects,
    'pagination' => [
      'page' => $page,
      'limit' => $limit,
      'total' => $total,
      'pages' => ceil($total / $limit),
    ],
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
