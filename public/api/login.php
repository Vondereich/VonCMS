<?php
/**
 * Login API with Rate Limiting and Session Management
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// Ensure the request method is POST for login
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method Not Allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Rate limiting handled via requireNotLimited()

// Check rate limiting FIRST
require_once __DIR__ . '/security/SecurityLogger.php';

// Check rate limiting FIRST
RateLimiter::requireNotLimited();

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);
$username = $input['username'] ?? '';
$password = $input['password'] ?? '';
$honeypot = $input['hp_field'] ?? '';

// Honeypot check - bots will fill this hidden field
if (!empty($honeypot)) {
  // Log suspicious activity but don't reveal it's a honeypot
  SecurityLogger::log(
    'honeypot_caught',
    'critical',
    ['ip' => $_SERVER['REMOTE_ADDR'], 'endpoint' => 'login.php'],
    true,
  );
  error_log('Honeypot triggered from IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
  ResponseHelper::sendError('Login failed', 400);
}

if (empty($username) || empty($password)) {
  ResponseHelper::sendError('Username and password required', 400);
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  // No database - return error
  RateLimiter::recordAttempt();
  ResponseHelper::sendError(
    'Database not configured. Please set up database connection in von_config.php',
    503,
  );
}

try {
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $displayNameSelect = $hasDisplayNameColumn ? 'display_name' : 'NULL AS display_name';

  // Authenticate against database
  $stmt = $pdo->prepare(
    "SELECT id, username, $displayNameSelect, email, role, avatar, bio, created_at AS createdAt, password FROM users WHERE email = ? OR username = ? LIMIT 1",
  );
  $stmt->execute([$username, $username]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($user && password_verify($password, $user['password'])) {
    try {
      $verificationStmt = $pdo->prepare(
        'SELECT email_verified, verification_token FROM users WHERE id = ? LIMIT 1',
      );
      $verificationStmt->execute([$user['id']]);
      $verification = $verificationStmt->fetch(PDO::FETCH_ASSOC) ?: [];

      $isVerified =
        !isset($verification['email_verified']) || (int) $verification['email_verified'] === 1;
      $hasPendingVerification = !empty($verification['verification_token']);

      if (!$isVerified && $hasPendingVerification) {
        ResponseHelper::sendError('Please verify your email before logging in.', 403);
      }
    } catch (Throwable $e) {
      // Older installs may not have verification columns yet. Keep login backward-compatible.
    }

    // Login success
    unset($user['password']); // Remove password from session

    // Scrub avatar URL for consistent output
    if (!empty($user['avatar'])) {
      $user['avatar'] = ResponseHelper::scrubAvatarUrl($user['avatar']);
    }

    // SECURITY: Regenerate session ID to prevent Session Fixation attacks
    session_regenerate_id(true);

    $_SESSION['user'] = $user;
    $_SESSION['ua_bind'] = hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? 'unknown');

    // Generate CSRF token for this session
    $csrfToken = CSRFProtection::generateToken();

    // Reset rate limiter on successful login
    RateLimiter::reset();

    // Touch session timestamp
    SessionManager::touch();

    // HANDLE REMEMBER ME (30 Days)
    $rememberMe = $input['remember_me'] ?? false;
    if ($rememberMe) {
      $params = session_get_cookie_params();
      setcookie(session_name(), session_id(), [
        'expires' => time() + 86400 * 30,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => 'Lax',
      ]);
    }

    echo json_encode([
      'success' => true,
      'user' => $user,
      'csrf_token' => $csrfToken,
    ]);
  } else {
    // Login failed - record attempt
    RateLimiter::recordAttempt();
    SecurityLogger::log(
      'login_failed',
      'medium',
      ['username' => $username, 'ip' => $_SERVER['REMOTE_ADDR']],
      true,
    );

    ResponseHelper::sendError('Invalid credentials', 401);
  }
} catch (Exception $e) {
  // Database error
  RateLimiter::recordAttempt();
  ResponseHelper::sendError($e);
}
