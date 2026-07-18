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
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
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
$isOwnProfile = (string) ($currentUser['id'] ?? '') === (string) $input['id'];
if (!$isOwnProfile && !SessionManager::isAdmin()) {
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
  $isPrimaryAdminActor = SessionManager::isPrimaryAdmin();

  $targetStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
  $targetStmt->execute([$userId]);
  $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

  if (!$targetUser) {
    ResponseHelper::sendError('User not found', 404);
  }

  $targetUserId = (string) ($targetUser['id'] ?? '');
  $targetUserRole = strtolower((string) ($targetUser['role'] ?? ''));

  if (
    !$isOwnProfile &&
    !$isPrimaryAdminActor &&
    ($targetUserId === '1' || $targetUserRole === 'root')
  ) {
    ResponseHelper::sendError('Only admin 1 can update this account', 403);
  }

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

    $pdo->beginTransaction();
    try {
      // 3. Update Password
      $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
      $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
      if (!$stmt->execute([$newHash, $userId])) {
        throw new Exception('Failed to update password');
      }

      try {
        $revokeRememberStmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
        $revokeRememberStmt->execute([$userId]);
      } catch (PDOException $e) {
        if ($e->getCode() !== '42S02') {
          throw $e;
        }
      }

      $pdo->commit();
    } catch (Throwable $e) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      throw $e;
    }
  }

  // Update Profile Fields
  $stmt = $pdo->prepare('UPDATE users SET display_name = ?, bio = ?, avatar = ? WHERE id = ?');
  $result = $stmt->execute([$displayName !== '' ? $displayName : null, $bio, $avatar, $userId]);

  if ($result) {
    voncms_public_cache_clear();

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
