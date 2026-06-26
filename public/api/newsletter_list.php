<?php
/**
 * VonCMS - Newsletter List API (Admin Only)
 * SECURITY: Admin authentication required
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Require admin authentication
SessionManager::requireValidSession();
$userRole = strtolower($_SESSION['user']['role'] ?? '');
SessionManager::requireAdmin();

try {
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get pagination params
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(100, max(10, intval($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    $search = trim($_GET['search'] ?? '');
    $status = $_GET['status'] ?? 'all';

    // Build query
    $where = [];
    $params = [];

    if ($search) {
      $where[] = 'email LIKE ?';
      $params[] = "%$search%";
    }

    if ($status !== 'all' && in_array($status, ['active', 'unsubscribed'])) {
      $where[] = 'status = ?';
      $params[] = $status;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Get total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM newsletter_subscribers $whereClause");
    $countStmt->execute($params);
    $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get subscribers
    $sql = "SELECT id, email, status, subscribed_at, unsubscribed_at, source 
                FROM newsletter_subscribers 
                $whereClause 
                ORDER BY subscribed_at DESC 
                LIMIT $limit OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $subscribers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get stats
    $statsStmt = $pdo->query("SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
            FROM newsletter_subscribers");
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
      'success' => true,
      'subscribers' => $subscribers,
      'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => intval($total),
        'pages' => ceil($total / $limit),
      ],
      'stats' => $stats,
    ]);
  } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // CSRF protection for mutations
    CSRFProtection::requireToken();

    $input = json_decode(CSRFProtection::getRequestBody(), true);
    $id = intval($input['id'] ?? 0);

    if (!$id) {
      ResponseHelper::sendError('Invalid subscriber ID', 400);
    }

    $stmt = $pdo->prepare('DELETE FROM newsletter_subscribers WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['success' => true, 'message' => 'Subscriber deleted']);
  }
} catch (PDOException $e) {
  if (strpos($e->getMessage(), "doesn't exist") !== false) {
    echo json_encode([
      'success' => true,
      'subscribers' => [],
      'pagination' => ['page' => 1, 'limit' => 20, 'total' => 0, 'pages' => 0],
      'stats' => ['total' => 0, 'active' => 0, 'unsubscribed' => 0],
      'notice' => 'Newsletter table not initialized',
    ]);
  } else {
    ResponseHelper::sendError($e);
  }
}
