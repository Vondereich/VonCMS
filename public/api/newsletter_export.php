<?php
/**
 * VonCMS - Newsletter Export API (Admin Only)
 * SECURITY: Admin authentication, CSRF protection
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Authenticate, Authorize, and Verify CSRF
SessionManager::requireValidSession();
CSRFProtection::requireToken();

SessionManager::requireAdmin();

try {
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  $status = $input['status'] ?? 'active';

  // Build query
  $where = '';
  $params = [];
  if ($status !== 'all' && in_array($status, ['active', 'unsubscribed'])) {
    $where = 'WHERE status = ?';
    $params[] = $status;
  }

  $stmt = $pdo->prepare(
    "SELECT email, status, subscribed_at, source FROM newsletter_subscribers $where ORDER BY subscribed_at DESC",
  );
  $stmt->execute($params);

  // Generate CSV - stream rows one-by-one instead of loading all into memory
  header('Content-Type: text/csv');
  header(
    'Content-Disposition: attachment; filename="newsletter_subscribers_' . date('Y-m-d') . '.csv"',
  );
  header('Pragma: no-cache');
  header('Expires: 0');

  $output = fopen('php://output', 'w');

  // Header row
  fputcsv($output, ['Email', 'Status', 'Subscribed At', 'Source']);

  // Stream data rows - O(1) memory instead of O(N)
  while ($sub = $stmt->fetch(PDO::FETCH_ASSOC)) {
    fputcsv($output, [$sub['email'], $sub['status'], $sub['subscribed_at'], $sub['source']]);
  }

  fclose($output);
} catch (PDOException $e) {
  ResponseHelper::sendError($e);
}
