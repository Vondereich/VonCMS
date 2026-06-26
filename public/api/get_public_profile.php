<?php
/**
 * VonCMS - Public Profile API
 * Returns public profile data for any user (accessible by guests)
 * Only returns safe, public information - no email, numeric user ID, role, or sensitive data
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers immediately
sendApiHeaders('GET, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Get username from query parameter
$username = isset($_GET['username']) ? trim($_GET['username']) : '';

if (empty($username)) {
  ResponseHelper::sendError('Username is required', 400);
}

try {
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database connection not established.');
  }

  // Select public presentation fields only.
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $displayNameSelect = $hasDisplayNameColumn ? 'display_name' : 'NULL AS display_name';
  $stmt = $pdo->prepare(
    "SELECT username, $displayNameSelect, avatar, bio FROM users WHERE username = ? LIMIT 1",
  );
  $stmt->execute([$username]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($user) {
    if (isset($user['avatar'])) {
      $user['avatar'] = ResponseHelper::scrubAvatarUrl($user['avatar']);
    }
    echo json_encode([
      'success' => true,
      'user' => $user,
    ]);
  } else {
    ResponseHelper::sendError('User not found', 404);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
