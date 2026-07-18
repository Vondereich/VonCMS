<?php
ob_start(); // Buffer output to prevent warnings from corrupting JSON
/**
 * VonCMS - User Registration API
 * Handles new user registration with spam protection
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Rate limiting handled via requireNotLimited() in security.php
// Session already started in security.php

// Check rate limiting
RateLimiter::requireNotLimited();

// Check if registration is enabled in settings
try {
  $regCheck = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_key = 'registration_enabled' LIMIT 1",
  );
  $regCheck->execute();
  $regSetting = $regCheck->fetch(PDO::FETCH_ASSOC);
  $regEnabled =
    $regSetting &&
    ($regSetting['setting_value'] === 'true' || $regSetting['setting_value'] === '1');

  // Also check file-based fallback if DB is not exhaustive
  if (!$regSetting && file_exists(__DIR__ . '/../data/site_settings.json')) {
    $jsonSettings = json_decode(file_get_contents(__DIR__ . '/../data/site_settings.json'), true);
    $regEnabled = $jsonSettings['registrationEnabled'] ?? true;
  }

  // Default to true if not set (to avoid breaking existing sites)
  if (!isset($regEnabled)) {
    $regEnabled = true;
  }

  if (!$regEnabled) {
    ResponseHelper::sendError('Registration is currently disabled by the administrator.', 403);
  }
} catch (Exception $e) {
  // If settings table missing, assume enabled for compatibility during updates
}

CSRFProtection::requireToken();

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);
$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$confirmPassword = $input['confirmPassword'] ?? '';
$honeypot = $input['hp_field'] ?? '';

// Honeypot check
if (!empty($honeypot)) {
  RateLimiter::recordAttempt();
  error_log(
    'Honeypot triggered during registration from IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
  );
  ResponseHelper::sendError('Registration failed', 400);
}

// Validation
$errors = [];

if (empty($username) || strlen($username) < 3) {
  $errors[] = 'Username must be at least 3 characters';
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  $errors[] = 'Please enter a valid email address';
}

if (strlen($password) < 8) {
  $errors[] = 'Password must be at least 8 characters';
}
if (!preg_match('/[A-Z]/', $password)) {
  $errors[] = 'Password must contain at least one uppercase letter';
}
if (!preg_match('/[0-9]/', $password)) {
  $errors[] = 'Password must contain at least one number';
}
if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
  $errors[] = 'Password must contain at least one special character';
}

if ($password !== $confirmPassword) {
  $errors[] = 'Passwords do not match';
}

// Check for special characters in username
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
  $errors[] = 'Username can only contain letters, numbers, and underscores';
}

if (!empty($errors)) {
  RateLimiter::recordAttempt();
  ResponseHelper::sendError(implode('. ', $errors), 400);
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured. Please complete installation first.', 503);
}

// Auto-migration: Add email verification columns if not exist
try {
  $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);

  if (!in_array('email_verified', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0');
  }
  if (!in_array('display_name', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL');
  }
  if (!in_array('verification_token', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN verification_token VARCHAR(64) DEFAULT NULL');
  }
  if (!in_array('verification_token_expires', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN verification_token_expires DATETIME DEFAULT NULL');
  }
} catch (PDOException $e) {
  error_log('Migration check: ' . $e->getMessage());
}

try {
  // Check if username already exists
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
  $stmt->execute([$username, $email]);

  if ($stmt->fetch()) {
    RateLimiter::recordAttempt();
    ResponseHelper::sendError('Username or email already taken', 400);
  }

  // Hash password
  $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

  // Verification token generation
  require_once __DIR__ . '/mail_helper.php';
  $verificationToken = generateVerificationToken();
  $tokenExpires = date('Y-m-d H:i:s', strtotime('+24 hours'));

  // Insert new user (email_verified = 0, let DB handle AUTO_INCREMENT ID)
  $stmt = $pdo->prepare(
    "INSERT INTO users (username, email, password, role, email_verified, verification_token, verification_token_expires, created_at) VALUES (?, ?, ?, 'Member', 0, ?, ?, NOW())",
  );
  $stmt->execute([$username, $email, $hashedPassword, $verificationToken, $tokenExpires]);

  $userId = $pdo->lastInsertId();

  // Send verification email
  $emailResult = sendVerificationEmail($pdo, $email, $username, $verificationToken);

  // Create user object for response
  $user = [
    'id' => $userId,
    'username' => $username,
    'email' => $email,
    'role' => 'Member',
    'avatar' => '',
    'bio' => '',
    'email_verified' => false,
    'createdAt' => date('Y-m-d H:i:s'),
  ];

  // Keep new accounts unverified until a verification link is actually delivered and used.
  $message = 'Registration successful! ';
  $requiresVerification = true;
  if ($emailResult['success']) {
    $message .= 'Please check your email to verify your account.';
  } else {
    $failedMethod = (string) ($emailResult['method'] ?? 'unknown');
    error_log(
      'Registration verification email failed via ' .
        $failedMethod .
        ': ' .
        ($emailResult['message'] ?? 'unknown error'),
    );

    if ($failedMethod === 'php_mail' || $failedMethod === 'mail') {
      $message .=
        'Your account was created, but the verification email could not be delivered. Please contact the site administrator before signing in.';
    } else {
      $message .=
        'Your account was created, but the verification email could not be sent right now. Please contact the site administrator before signing in.';
    }
  }

  echo json_encode([
    'success' => true,
    'message' => $message,
    'user' => null,
    'emailSent' => $emailResult['success'],
    'requiresVerification' => $requiresVerification,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
