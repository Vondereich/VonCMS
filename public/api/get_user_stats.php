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

SessionManager::requireStaff();

try {
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database connection not established.');
  }

  $stmt = $pdo->query('SELECT COUNT(*) FROM users');
  $totalUsers = (int) $stmt->fetchColumn();

  echo json_encode([
    'success' => true,
    'meta' => [
      'total' => $totalUsers,
    ],
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
