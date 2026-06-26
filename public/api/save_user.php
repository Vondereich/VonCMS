<?php
require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

SessionManager::requireAdmin();

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);

if (!$input) {
  ResponseHelper::sendError('Invalid JSON input', 400);
}

if (!isset($input['username']) || !isset($input['email'])) {
  ResponseHelper::sendError('Username and Email are required', 400);
}

// Sanitize input
if (function_exists('sanitize_input')) {
  // PRESERVE RAW PASSWORD: Passwords containing <, >, &, " symbols must not be HTML-escaped
  // before hashing, otherwise login (which uses raw input) will fail.
  $rawPassword = $input['password'] ?? null;

  $input = sanitize_input($input);

  // Restore raw password if it existed
  if ($rawPassword !== null) {
    $input['password'] = $rawPassword;
  }
}

$displayName = trim((string) ($input['display_name'] ?? ''));
$displayNameLength = function_exists('mb_strlen') ? mb_strlen($displayName) : strlen($displayName);
if ($displayNameLength > 100) {
  ResponseHelper::sendError('Display name must be 100 characters or fewer', 400);
}

// Check if database connection exists
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
  $pdo->beginTransaction();

  $input['avatar'] = ResponseHelper::scrubAvatarUrl($input['avatar'] ?? '');

  $inputId = $input['id'] ?? '';
  $currentUserId = (string) ($_SESSION['user']['id'] ?? '');
  $currentUserRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));
  $isPrimaryAdminActor = $currentUserId === '1' || $currentUserRole === 'root';
  $approveEmail = !empty($input['approve_email']);
  $requestedRole = strtolower(trim((string) ($input['role'] ?? '')));
  $allowedNonPrimaryRoles = ['member', 'writer', 'moderator'];

  if ($approveEmail && !$isPrimaryAdminActor) {
    $pdo->rollBack();
    ResponseHelper::sendError('Only admin 1 can approve email verification', 403);
  }

  // Check database if user already exists (much more reliable than ID format checking)
  $isNewUser = true;
  if (!empty($inputId)) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$inputId]);
    if ($stmt->fetch()) {
      $isNewUser = false;
    }
  }

  if ($isNewUser) {
    // Check for duplicate username/email - LOCKING READ
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? FOR UPDATE');
    $stmt->execute([$input['username'], $input['email']]);
    if ($stmt->fetch()) {
      $pdo->rollBack(); // Release lock
      ResponseHelper::sendError('Username or email already exists', 400);
    }

    // Password strength validation for new users
    $password = $input['password'] ?? '';
    if (
      strlen($password) < 8 ||
      !preg_match('/[A-Z]/', $password) ||
      !preg_match('/[0-9]/', $password) ||
      !preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)
    ) {
      $pdo->rollBack();
      ResponseHelper::sendError(
        'Password must be at least 8 characters with uppercase, number, and special character',
        400,
      );
    }

    if (
      !$isPrimaryAdminActor &&
      $requestedRole !== '' &&
      !in_array($requestedRole, $allowedNonPrimaryRoles, true)
    ) {
      $pdo->rollBack();
      ResponseHelper::sendError('Only admin 1 can assign admin-level roles', 403);
    }

    // Determine if the new user should be auto-verified (staff roles created by admin)
    $newRole = $input['role'] ?? 'Member';
    $isStaffRole = in_array($newRole, ['Admin', 'Root', 'Moderator', 'Writer'], true);

    // Insert new user (ID handled by DB AUTO_INCREMENT)
    $stmt = $pdo->prepare(
      'INSERT INTO users (username, display_name, email, password, role, avatar, bio, email_verified, verification_token, verification_token_expires, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW())',
    );
    $stmt->execute([
      $input['username'],
      $displayName !== '' ? $displayName : null,
      $input['email'],
      password_hash($input['password'], PASSWORD_BCRYPT),
      $newRole,
      $input['avatar'] ?? '',
      $input['bio'] ?? '',
      $isStaffRole ? 1 : 0,
    ]);

    $userId = $pdo->lastInsertId();

    $pdo->commit();
    echo json_encode([
      'success' => true,
      'id' => (string) $userId,
      'message' => 'User created successfully',
    ]);
  } else {
    $targetStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ? FOR UPDATE');
    $targetStmt->execute([$input['id']]);
    $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
      $pdo->rollBack();
      ResponseHelper::sendError('User not found', 404);
    }

    $targetUserId = (string) ($targetUser['id'] ?? '');
    $targetUserRole = strtolower((string) ($targetUser['role'] ?? ''));

    if (!$isPrimaryAdminActor && ($targetUserId === '1' || $targetUserRole === 'root')) {
      $pdo->rollBack();
      ResponseHelper::sendError('Only admin 1 can modify this account', 403);
    }

    if (
      !$isPrimaryAdminActor &&
      $requestedRole !== '' &&
      !in_array($requestedRole, $allowedNonPrimaryRoles, true) &&
      $requestedRole !== $targetUserRole
    ) {
      $pdo->rollBack();
      ResponseHelper::sendError('Only admin 1 can assign admin-level roles', 403);
    }

    // PROTECTION: Prevent modification of Super Admin (ID 1)
    if ($targetUserId === '1') {
      if (
        isset($input['role']) &&
        !(
          strtolower((string) $input['role']) === 'admin' ||
          strtolower((string) $input['role']) === 'root'
        )
      ) {
        $pdo->rollBack();
        ResponseHelper::sendError('Cannot change role of Super Admin', 400);
      }
    }

    // Update existing user
    $sql =
      'UPDATE users SET username = ?, display_name = ?, email = ?, role = ?, avatar = ?, bio = ?';
    $roleToPersist = $input['role'] ?? 'Writer';
    if (
      !$isPrimaryAdminActor &&
      !in_array(strtolower((string) $roleToPersist), $allowedNonPrimaryRoles, true)
    ) {
      $roleToPersist = $targetUser['role'] ?? $roleToPersist;
    }
    $params = [
      $input['username'],
      $displayName !== '' ? $displayName : null,
      $input['email'],
      $roleToPersist,
      $input['avatar'] ?? '',
      $input['bio'] ?? '',
    ];

    if ($approveEmail) {
      $sql .= ', email_verified = 1, verification_token = NULL, verification_token_expires = NULL';
    }

    // Only update password if provided
    if (!empty($input['password'])) {
      // Validate password strength
      $password = $input['password'];
      if (
        strlen($password) < 8 ||
        !preg_match('/[A-Z]/', $password) ||
        !preg_match('/[0-9]/', $password) ||
        !preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)
      ) {
        $pdo->rollBack();
        ResponseHelper::sendError(
          'Password must be at least 8 characters with uppercase, number, and special character',
          400,
        );
      }
      $sql .= ', password = ?';
      $params[] = password_hash($input['password'], PASSWORD_BCRYPT);
    }

    $sql .= ' WHERE id = ?';
    $params[] = $input['id'];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Check if update actually affected any rows (user might have been deleted)
    if ($stmt->rowCount() === 0) {
      $pdo->rollBack();
      ResponseHelper::sendError('User not found or no changes made', 404);
    }

    $pdo->commit();
    echo json_encode([
      'success' => true,
      'id' => $input['id'],
      'message' => 'User updated successfully',
    ]);
  }
} catch (Exception $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
