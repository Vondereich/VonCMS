<?php
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

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Authenticate and Authorize (Admin only)
SessionManager::requireAdmin();

try {
  // Check if database connection exists
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database connection not established.');
  }

  // Pagination and search
  $limit = isset($_GET['limit']) ? max(1, min(2000, (int) $_GET['limit'])) : 100;
  $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
  $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
  $offset = 0;
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $displayNameSelect = $hasDisplayNameColumn ? 'display_name' : 'NULL AS display_name';

  $where = '';
  $searchBindings = [];
  if ($search !== '') {
    $displayNameSearch = $hasDisplayNameColumn ? ' OR display_name LIKE :search' : '';
    $where = " WHERE (username LIKE :search$displayNameSearch OR email LIKE :search OR role LIKE :search)";
    $searchBindings[':search'] = '%' . $search . '%';
  }

  $countStmt = $pdo->prepare('SELECT COUNT(*) FROM users' . $where);
  foreach ($searchBindings as $key => $value) {
    $countStmt->bindValue($key, $value, PDO::PARAM_STR);
  }
  $countStmt->execute();
  $totalUsers = (int) $countStmt->fetchColumn();
  $totalPages = max(1, (int) ceil($totalUsers / $limit));
  if ($page > $totalPages) {
    $page = $totalPages;
  }
  $offset = ($page - 1) * $limit;

  $stmt = $pdo->prepare(
    "SELECT id, username, $displayNameSelect, email, role, avatar, bio, email_verified, verification_token IS NOT NULL AS has_pending_verification, created_at AS createdAt FROM users" .
      $where .
      ' ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset',
  );
  foreach ($searchBindings as $key => $value) {
    $stmt->bindValue($key, $value, PDO::PARAM_STR);
  }
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();

  $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Transform specifically to cast IDs to string (Contract Enforcement)
  $result = array_map(function ($user) {
    $user['id'] = (string) $user['id'];
    $user['email_verified'] = isset($user['email_verified'])
      ? (bool) $user['email_verified']
      : true;
    $user['has_pending_verification'] = isset($user['has_pending_verification'])
      ? (bool) $user['has_pending_verification']
      : false;
    return $user;
  }, $users);

  echo json_encode([
    'success' => true,
    'users' => $result,
    'meta' => [
      'total' => $totalUsers,
      'page' => $page,
      'limit' => $limit,
      'totalPages' => $totalPages,
      'hasMore' => $page * $limit < $totalUsers,
    ],
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
