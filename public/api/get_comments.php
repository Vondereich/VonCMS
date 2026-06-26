<?php
/**
 * VonCMS - Get Comments API
 * Returns all comments from database
 */
require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, OPTIONS');

// Handle preflight
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

// Check database connection
if (!isset($pdo)) {
  ResponseHelper::sendError('Database not configured', 503);
}

try {
  // Get filter and pagination params
  $postId = isset($_GET['post_id']) ? intval($_GET['post_id']) : null;
  $flat = isset($_GET['flat']) && $_GET['flat'] === 'true';
  $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';
  $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
  $profileUserId = isset($_GET['user_id']) ? trim((string) $_GET['user_id']) : '';
  $profileUsername = isset($_GET['user']) ? trim((string) $_GET['user']) : '';
  $limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : 10;
  $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
  $allowedStatuses = ['approved', 'pending', 'spam'];
  if (!in_array($status, $allowedStatuses, true)) {
    $status = '';
  }

  // 1. Get Total Count (for hasMore logic)
  $countParams = [];
  $where = [];

  if ($postId) {
    $where[] = 'c.post_id = ?';
    $countParams[] = $postId;
  }

  // Security: Only staff can see pending/spam comments
  $isStaff = SessionManager::isStaff();
  $isPrimaryAdmin = SessionManager::isPrimaryAdmin();
  if (!$isStaff) {
    $where[] = "c.status = 'approved'";
  } elseif ($flat && !$postId && $status !== '' && $search === '') {
    $where[] = 'c.status = ?';
    $countParams[] = $status;
  }

  if ($flat && !$postId && $search !== '') {
    $searchLike = '%' . $search . '%';
    $where[] = '(c.content LIKE ? OR c.user_name LIKE ?)';
    $countParams[] = $searchLike;
    $countParams[] = $searchLike;
  }

  if ($flat && !$postId && $profileUserId !== '' && preg_match('/^\d+$/', $profileUserId)) {
    $where[] = 'c.user_id = ?';
    $countParams[] = $profileUserId;
  } elseif (
    $flat &&
    !$postId &&
    $profileUsername !== '' &&
    preg_match('/^[a-zA-Z0-9_.-]+$/', $profileUsername)
  ) {
    $where[] = 'c.user_name = ?';
    $countParams[] = $profileUsername;
  }

  $whereSql = !empty($where) ? ' WHERE ' . implode(' AND ', $where) : '';

  $countStmt = $pdo->prepare('SELECT COUNT(*) FROM comments c' . $whereSql);
  $countStmt->execute($countParams);
  $totalComments = (int) $countStmt->fetchColumn();
  $totalPages = max(1, (int) ceil($totalComments / $limit));
  if ($page > $totalPages) {
    $page = $totalPages;
  }
  $offset = ($page - 1) * $limit;

  // 2. Fetch Paginated Comments
  // Fetch ALL comments with user email (via JOIN)
  $orderBy = $flat && !$postId ? ' ORDER BY c.created_at DESC' : ' ORDER BY c.created_at ASC';
  $query =
    "SELECT c.id, c.post_id AS postId, c.user_id AS userId, c.parent_id AS parentId, 
                     c.user_name AS username, c.user_avatar AS userAvatar, c.content, c.likes, c.status, 
                     c.created_at AS createdAt,
                     u.email AS user_email,
                     u.avatar AS user_live_avatar
              FROM comments c
              LEFT JOIN users u ON c.user_id = u.id" .
    $whereSql .
    $orderBy .
    " LIMIT $limit OFFSET $offset";

  $stmt = $pdo->prepare($query);

  // Bind parameters for WHERE clause
  foreach ($countParams as $idx => $val) {
    $stmt->bindValue($idx + 1, $val);
  }

  $stmt->execute();
  $allComments = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // 2. Process comments into a lookup map
  $commentMap = [];
  foreach ($allComments as $c) {
    $id = $c['id'];
    // Avatar URL is public data (user-provided). Email hash remains staff-gated.
    $email = $isStaff && isset($c['user_email']) ? $c['user_email'] : '';
    $emailHash = $email ? md5(strtolower(trim($email))) : '';

    $commentAvatar = !empty($c['userId'])
      ? $c['user_live_avatar'] ?? ''
      : $c['user_live_avatar'] ?? ($c['userAvatar'] ?? '');

    $commentMap[$id] = [
      'id' => ($c['parentId'] ? 'r-' : 'c-') . $id,
      'dbId' => $id,
      'postId' => (string) $c['postId'],
      'userId' => $c['userId'],
      'parentId' => $c['parentId'],
      'username' => $c['username'],
      'userAvatar' => ResponseHelper::scrubAvatarUrl($commentAvatar),
      'emailHash' => $emailHash,
      'content' => $c['content'],
      'likes' => (int) $c['likes'],
      'status' => $c['status'] ?? 'approved',
      'createdAt' => $c['createdAt'],
      'replies' => [],
    ];

    $commentMap[$id] = ResponseHelper::shapeCommentPayload(
      $commentMap[$id],
      $isStaff,
      $isPrimaryAdmin,
    );
  }

  // 4. Build Tree or return Flat list
  if ($flat && !$postId) {
    // For admin dashboard flat view if requested, or just return map
    echo json_encode([
      'comments' => array_values($commentMap),
      'meta' => [
        'total' => (int) $totalComments,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => $totalPages,
        'hasMore' => $page * $limit < $totalComments,
      ],
      'success' => true,
    ]);
    exit();
  }

  $tree = [];
  // Use a separate tracker for root comments in this batch
  $rootComments = [];

  foreach ($commentMap as $id => &$comment) {
    if ($comment['parentId'] && isset($commentMap[$comment['parentId']])) {
      $commentMap[$comment['parentId']]['replies'][] = &$comment;
    } else {
      // It's a root comment in this batch (or orphan from previous page parent)
      $rootComments[] = &$comment;
    }
  }

  echo json_encode([
    'comments' => array_values($rootComments),
    'meta' => [
      'total' => (int) $totalComments,
      'page' => $page,
      'limit' => $limit,
      'totalPages' => $totalPages,
      'hasMore' => $page * $limit < $totalComments,
    ],
    'success' => true,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
