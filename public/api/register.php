<?php

require_once __DIR__ . '/../core/DataBoundary.php';
ob_start(); // Buffer output to prevent warnings from corrupting JSON
/**
 * VonCMS - User Registration API
 * Handles new user registration with spam protection
 */

$requestMethod = strtoupper(DataBoundary::serverString('REQUEST_METHOD', 'GET'));

if ($requestMethod !== 'POST' && $requestMethod !== 'OPTIONS') {
  header('Content-Type: application/json');
  header('Allow: POST, OPTIONS');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('X-Content-Type-Options: nosniff');
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
  exit();
}

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/mail_helper.php';
require_once __DIR__ . '/schema_repair_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($requestMethod === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Session already started in security.php

// Check if registration is enabled in settings
$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
try {
  $regCheck = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_key = 'registration_enabled' LIMIT 1",
  );
  $regCheck->execute();
  $regSetting = DataBoundary::row($regCheck->fetch(PDO::FETCH_ASSOC));
  // Match the public UI default without overriding an owner's explicit OFF value.
  $regEnabled =
    !$regSetting || $regSetting['setting_value'] === 'true' || $regSetting['setting_value'] === '1';

  // Also check file-based fallback if DB is not exhaustive
  if (!$regSetting && file_exists(__DIR__ . '/../data/site_settings.json')) {
    $settingsText = file_get_contents(__DIR__ . '/../data/site_settings.json');
    $jsonSettings = is_string($settingsText) ? json_decode($settingsText, true) : null;
    $regEnabled = filter_var(
      is_array($jsonSettings) ? $jsonSettings['registrationEnabled'] ?? true : true,
      FILTER_VALIDATE_BOOLEAN,
    );
  }

  if (!$regEnabled) {
    ResponseHelper::sendError('Registration is currently disabled by the administrator.', 403);
  }
} catch (Exception $e) {
  // If settings table missing, assume enabled for compatibility during updates
}

CSRFProtection::requireToken();
$registrationRateIdentifier =
  'registration:ip:' .
  RateLimiter::normalizeLoginAddress(DataBoundary::serverString('REMOTE_ADDR', '0.0.0.0'));
if (!RateLimiter::consumeFixedWindow($registrationRateIdentifier, 5, 900, 'registration')) {
  header('Retry-After: 900');
  ResponseHelper::sendError('Too many registration attempts. Please try again in 15 minutes.', 429);
}

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid request body', 400);
}

foreach (['username', 'email', 'password', 'confirmPassword', 'hp_field'] as $field) {
  if (array_key_exists($field, $input) && $input[$field] !== null && !is_scalar($input[$field])) {
    ResponseHelper::sendError('Invalid request body', 400);
  }
}

$username = trim((string) ($input['username'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$password = (string) ($input['password'] ?? '');
$confirmPassword = (string) ($input['confirmPassword'] ?? '');
$honeypot = (string) ($input['hp_field'] ?? '');

// Honeypot check
if ($honeypot !== '') {
  error_log(
    'Honeypot triggered during registration from IP: ' .
      DataBoundary::serverString('REMOTE_ADDR', 'unknown'),
  );
  ResponseHelper::sendError('Registration failed', 400);
}

// Validation
$password = SecurityHelper::requireNewPasswordLength($password);
$errors = [];

if (empty($username) || strlen($username) < 3) {
  $errors[] = 'Username must be at least 3 characters';
}
if (strlen($username) > 50) {
  $errors[] = 'Username must not exceed 50 characters';
}

if (strlen($email) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  $errors[] = 'Please enter a valid email address';
}

if (strlen($password) > 4096 || strlen($confirmPassword) > 4096) {
  $errors[] = 'Password is too long';
} elseif (strlen($password) < 8) {
  $errors[] = 'Password must be at least 8 characters';
}
if (!preg_match('/[A-Z]/', $password)) {
  $errors[] = 'Password must contain at least one uppercase letter';
}
if (!preg_match('/[0-9]/', $password)) {
  $errors[] = 'Password must contain at least one number';
}
if (!SecurityHelper::hasPasswordSpecialCharacter($password)) {
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
  ResponseHelper::sendError(implode('. ', $errors), 400);
}

try {
  // Check if username already exists
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
  $stmt->execute([$username, $email]);

  if ($stmt->fetch()) {
    ResponseHelper::sendError('Username or email already taken', 400);
  }

  $trustedBaseUrl = voncms_resolve_trusted_public_base_url($pdo);
  if ($trustedBaseUrl === '') {
    error_log('Registration stopped: canonical Domain URL is not configured.');
    ResponseHelper::sendError(
      'Registration is temporarily unavailable. Please contact the site administrator.',
      503,
    );
  }

  // Hash password
  $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

  // Verification token generation
  $verificationToken = generateVerificationToken();

  // Insert new user (email_verified = 0, let DB handle AUTO_INCREMENT ID)
  $stmt = $pdo->prepare(
    "INSERT INTO users (username, email, password, role, email_verified, verification_token, verification_token_expires, created_at) VALUES (?, ?, ?, 'Member', 0, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())",
  );
  $stmt->execute([
    $username,
    $email,
    $hashedPassword,
    voncms_account_token_digest($verificationToken),
  ]);

  $userId = $pdo->lastInsertId();

  // Send verification email
  $emailResult = sendVerificationEmail(
    $pdo,
    $email,
    $username,
    $verificationToken,
    $trustedBaseUrl,
  );

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
        'Your account was created, but the verification email could not be delivered. Use Resend verification email on the login form, or contact the site administrator.';
    } else {
      $message .=
        'Your account was created, but the verification email could not be sent right now. Use Resend verification email on the login form, or contact the site administrator.';
    }
  }

  echo json_encode([
    'success' => true,
    'message' => $message,
    'user' => null,
    'emailSent' => $emailResult['success'],
    'requiresVerification' => $requiresVerification,
  ]);
} catch (Throwable $e) {
  if (voncms_schema_mutation_error_requires_repair($e)) {
    ResponseHelper::sendError('Registration requires Database Repair by the primary admin.', 503);
  }
  ResponseHelper::sendError($e);
}
