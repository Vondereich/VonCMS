<?php
ob_start(); // Buffer output to prevent warnings from corrupting JSON
/**
 * VonCMS - Update Profile API
 * Updates user bio and avatar from profile page
 * SECURITY: No CORS wildcard - same-origin only for password changes
 */

// Dynamic CORS - Only allow same-origin or configured origins
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// Load database connection
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);

if (!$input || !isset($input['id'])) {
  ResponseHelper::sendError('Invalid input or missing user ID', 400);
}

// Authorization: Only allow updating self OR if current user is admin
$currentUser = $_SESSION['user'];
if ($currentUser['id'] != $input['id'] && !SessionManager::isAdmin()) {
  ResponseHelper::sendError('Unauthorized to update this profile', 403);
}

// Check database connection
if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

try {
  $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
  if (!$columnStmt || $columnStmt->rowCount() === 0) {
    $pdo->exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL');
  }
} catch (Throwable $e) {
  ResponseHelper::sendError('Database schema update required. Run Database Repair first.', 503);
}

try {
  $userId = $input['id'];
  $displayName = trim((string) ($input['display_name'] ?? ''));
  if (function_exists('sanitize_input')) {
    $displayName = sanitize_input($displayName);
  }
  $displayNameLength = function_exists('mb_strlen')
    ? mb_strlen($displayName)
    : strlen($displayName);
  if ($displayNameLength > 100) {
    ResponseHelper::sendError('Display name must be 100 characters or fewer', 400);
  }
  $bio = trim((string) ($input['bio'] ?? ''));

  $avatar = $input['avatar'] ?? '';
  $avatar = ResponseHelper::scrubAvatarUrl($avatar);

  // Handle Password Change
  if (!empty($input['new_password'])) {
    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'];

    // 1. Verify Current Password
    $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($currentPassword, $user['password'])) {
      ResponseHelper::sendError('Incorrect current password', 400);
    }

    // 2. Enforce Strong Password Policy (8 chars, 1 Upper, 1 Number, 1 Symbol)
    if (
      strlen($newPassword) < 8 ||
      !preg_match('/[A-Z]/', $newPassword) ||
      !preg_match('/[0-9]/', $newPassword) ||
      !preg_match('/[!@#$%^&*(),.?":{}|<>]/', $newPassword)
    ) {
      ResponseHelper::sendError('Password must be 8+ chars with uppercase, number & symbol', 400);
    }

    // 3. Update Password
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
    if (!$stmt->execute([$newHash, $userId])) {
      throw new Exception('Failed to update password');
    }
  }

  // Update Profile Fields
  $stmt = $pdo->prepare('UPDATE users SET display_name = ?, bio = ?, avatar = ? WHERE id = ?');
  $result = $stmt->execute([$displayName !== '' ? $displayName : null, $bio, $avatar, $userId]);

  if ($result) {
    // Update session if updating own profile
    if ($currentUser['id'] == $userId) {
      $_SESSION['user']['bio'] = $bio;
      $_SESSION['user']['display_name'] = $displayName;
      $_SESSION['user']['avatar'] = $avatar;
    }

    echo json_encode([
      'success' => true,
      'message' => 'Profile updated successfully',
      'user' => [
        'display_name' => $displayName,
        'bio' => $bio,
        'avatar' => ResponseHelper::scrubAvatarUrl($avatar),
      ],
    ]);
  } else {
    ResponseHelper::sendError('Failed to update database', 500);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
