<?php

require_once __DIR__ . '/../core/DataBoundary.php';
ob_start(); // Buffer output to prevent warnings from corrupting JSON
/**
 * VonCMS - Update Profile API
 * Updates user bio and avatar from profile page
 * SECURITY: No CORS wildcard - same-origin only for password changes
 */

// Dynamic CORS - Only allow same-origin or configured origins
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', DataBoundary::serverString('HTTP_HOST', ''));

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/schema_repair_helper.php';
require_once __DIR__ . '/role_capability_helper.php';
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

if (!is_array($input) || !$input || !isset($input['id'])) {
  ResponseHelper::sendError('Invalid input or missing user ID', 400);
}

// Authorization: Only allow updating self OR if current user is admin
$currentUser = DataBoundary::actor();
// Private self-only User Manager saves are also bound against a browser session/account switch.
if (
  array_key_exists('ownAccount', $input) &&
  ($input['ownAccount'] !== true ||
    !is_string($input['expectedUserId'] ?? null) ||
    !hash_equals($currentUser['id'], $input['expectedUserId']) ||
    ($input['id'] ?? null) !== $currentUser['id'])
) {
  ResponseHelper::sendError('Your signed-in account changed. Reload before saving.', 409);
}
if (!is_scalar($input['id'])) {
  ResponseHelper::sendError('Invalid user ID', 400);
}
$isOwnProfile = $currentUser['id'] === (string) $input['id'];
if (!$isOwnProfile && !SessionManager::isAdmin()) {
  ResponseHelper::sendError('Unauthorized to update this profile', 403);
}

// Check database connection
if (!isset($pdo)) {
  ResponseHelper::sendError('Database not configured', 503);
}

try {
  $userId = $input['id'];
  $isPrimaryAdminActor = SessionManager::isPrimaryAdmin();

  $targetStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
  $targetStmt->execute([$userId]);
  $targetUser = DataBoundary::row($targetStmt->fetch(PDO::FETCH_ASSOC));

  if (!$targetUser) {
    ResponseHelper::sendError('User not found', 404);
  }

  $targetUserId = (string) ($targetUser['id'] ?? '');
  $targetUserRole = strtolower((string) ($targetUser['role'] ?? ''));

  if (
    !$isOwnProfile &&
    !$isPrimaryAdminActor &&
    voncms_user_target_requires_primary_admin($targetUserId, $targetUserRole)
  ) {
    ResponseHelper::sendError(
      'System owner permission is required to update this protected account',
      403,
    );
  }

  if (isset($input['display_name']) && !is_string($input['display_name'])) {
    ResponseHelper::sendError('Display name must be text.', 400);
  }
  // Presentation text, not HTML: validate/store the characters the user submitted.
  $displayName = trim((string) ($input['display_name'] ?? ''));
  $displayNameLength = function_exists('mb_strlen')
    ? mb_strlen($displayName)
    : strlen($displayName);
  if ($displayNameLength > 100) {
    ResponseHelper::sendError('Display name must be 100 characters or fewer', 400);
  }
  if (isset($input['bio']) && !is_string($input['bio'])) {
    ResponseHelper::sendError('Bio must be text.', 400);
  }
  $bio = trim((string) ($input['bio'] ?? ''));

  $avatar = $input['avatar'] ?? '';
  $avatar = ResponseHelper::scrubAvatarUrl($avatar);

  $newPasswordValue = $input['new_password'] ?? '';
  $currentPasswordValue = $input['current_password'] ?? '';
  $passwordChangeRequested = array_key_exists('new_password', $input) && $newPasswordValue !== '';

  if ($passwordChangeRequested) {
    if (!is_string($currentPasswordValue) || !is_string($newPasswordValue)) {
      ResponseHelper::sendError('Invalid password input', 400);
    }

    if (strlen($currentPasswordValue) > 4096 || strlen($newPasswordValue) > 4096) {
      ResponseHelper::sendError('Password input is too long', 400);
    }
    $newPasswordValue = SecurityHelper::requireNewPasswordLength($newPasswordValue);

    if (
      strlen($newPasswordValue) < 8 ||
      !preg_match('/[A-Z]/', $newPasswordValue) ||
      !preg_match('/[0-9]/', $newPasswordValue) ||
      !SecurityHelper::hasPasswordSpecialCharacter($newPasswordValue)
    ) {
      ResponseHelper::sendError('Password must be 8+ chars with uppercase, number & symbol', 400);
    }
  }

  $result = false;
  $transactionStarted = false;
  try {
    if ($passwordChangeRequested) {
      $pdo->beginTransaction();
      $transactionStarted = true;

      // Lock the credential row so two concurrent password changes cannot overwrite each other.
      $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ? FOR UPDATE');
      $stmt->execute([$userId]);
      $user = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

      if (!$user || !password_verify($currentPasswordValue, (string) $user['password'])) {
        $pdo->rollBack();
        $transactionStarted = false;
        ResponseHelper::sendError('Incorrect current password', 400);
      }

      $newHash = password_hash($newPasswordValue, PASSWORD_BCRYPT);

      $stmt = $pdo->prepare(
        'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      );
      if (!$stmt->execute([$newHash, $userId])) {
        throw new Exception('Failed to update password');
      }

      $revokeRememberStmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
      $revokeRememberStmt->execute([$userId]);
    }

    // Keep profile fields and a requested password change in one transaction.
    $stmt = $pdo->prepare('UPDATE users SET display_name = ?, bio = ?, avatar = ? WHERE id = ?');
    $result = $stmt->execute([$displayName !== '' ? $displayName : null, $bio, $avatar, $userId]);

    if (!$result) {
      throw new Exception('Failed to update database');
    }

    if ($transactionStarted) {
      $pdo->commit();
      $transactionStarted = false;
    }
  } catch (Throwable $e) {
    if ($transactionStarted && $pdo->inTransaction()) {
      $pdo->rollBack();
    }

    if (voncms_schema_mutation_error_requires_repair($e)) {
      ResponseHelper::sendError('Database schema update required. Run Database Repair first.', 503);
    }

    if ($e instanceof Exception) {
      ResponseHelper::sendError($e);
    }

    error_log('VonCMS profile update error: ' . $e->getMessage());
    ResponseHelper::sendError('Failed to update profile');
  }

  voncms_public_cache_clear();

  // Update session if updating own profile
  if ($currentUser['id'] == $userId && is_array($_SESSION['user'] ?? null)) {
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
} catch (Throwable $e) {
  if (voncms_schema_mutation_error_requires_repair($e)) {
    ResponseHelper::sendError('Database schema update required. Run Database Repair first.', 503);
  }

  if ($e instanceof Exception) {
    ResponseHelper::sendError($e);
  }

  error_log('VonCMS profile update error: ' . $e->getMessage());
  ResponseHelper::sendError('Failed to update profile');
}
