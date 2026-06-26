<?php
/**
 * VonCMS - Get Contact Submissions (Leads)
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

try {
  $page = max(1, intval($_GET['page'] ?? 1));
  $limit = min(100, max(10, intval($_GET['limit'] ?? 20)));
  $offset = ($page - 1) * $limit;

  $countStmt = $pdo->query('SELECT COUNT(*) as total FROM contact_submissions');
  $total = (int) ($countStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

  $stmt = $pdo->query("
        SELECT s.*, f.title as form_name 
        FROM contact_submissions s
        LEFT JOIN contact_forms f ON s.form_id = f.id
        ORDER BY s.created_at DESC
        LIMIT $limit OFFSET $offset
    ");
  $submissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode([
    'success' => true,
    'submissions' => $submissions,
    'pagination' => [
      'page' => $page,
      'limit' => $limit,
      'total' => $total,
      'pages' => (int) ceil($total / $limit),
    ],
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
