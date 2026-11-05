<?php

require_once __DIR__ . '/../core/DataBoundary.php';
/**
 * Login API with Rate Limiting and Session Management
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/publication_time_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// Ensure the request method is POST for login
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method Not Allowed', 405);
}

// Login changes session identity; guest writers already receive a token via vonFetch.
CSRFProtection::requireToken();

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

require_once __DIR__ . '/security/SecurityLogger.php';

/** Verify credentials with identical bcrypt work for known and unknown names.
 * @param array<array-key,scalar|null>|false $user
 */
function voncms_verify_login_candidate(array|false $user, string $password): bool
{
  // Match PHP 8.4's native bcrypt work even for legacy PHP cost-10 hashes.
  // Only the login check is padded; stored credentials stay intact.
  $workCost = max(12, PASSWORD_BCRYPT_DEFAULT_COST);
  $dummyHash =
    '$2y$' .
    str_pad((string) $workCost, 2, '0', STR_PAD_LEFT) .
    '$Y/WenUfcK5/BYcJfj1jW6u4aC30x72xhTV3Kgot/qgPhh/ANxj3zC';
  $hasHash = $user !== false && is_string($user['password'] ?? null);
  $hash = $hasHash ? $user['password'] : $dummyHash;
  $hashInfo = password_get_info($hash);
  if ($hashInfo['algoName'] === 'unknown') {
    $hasHash = false;
    $hash = $dummyHash;
    $hashInfo = password_get_info($hash);
  }
  $matches = password_verify($password, $hash);
  if ($hashInfo['algoName'] === 'bcrypt') {
    $costValue = $hashInfo['options']['cost'] ?? null;
    $cost = is_int($costValue) ? $costValue : $workCost;
    $remainingChecks = (1 << max(0, $workCost - $cost)) - 1;
    while ($remainingChecks-- > 0) {
      password_verify($password, $hash);
    }
  }
  return $hasHash && $matches;
}

/**
 * Bind new authentication credentials to the password that actually passed bcrypt.
 * Password writers lock this same users row before revoking persistent tokens.
 *
 * @param array<array-key,scalar|null> $user
 * @return array{}|array{selector: string, validator: string, expiresAt: int}|false
 */
function voncms_issue_login_credentials(
  PDO $db,
  array $user,
  string $verifiedPasswordHash,
  bool $rememberMe,
): array|false {
  if ($db->inTransaction()) {
    throw new RuntimeException('Authentication requires its own credential transaction.');
  }
  if (!$db->beginTransaction()) {
    throw new RuntimeException('Unable to start credential transaction.');
  }
  try {
    $lock = $db->prepare('SELECT password FROM users WHERE id = ? FOR UPDATE');
    $lock->execute([$user['id']]);
    $currentHash = $lock->fetchColumn();
    if (!is_string($currentHash) || !hash_equals($verifiedPasswordHash, $currentHash)) {
      $db->rollBack();
      return false;
    }

    $remember = [];
    if ($rememberMe) {
      $selector = bin2hex(random_bytes(12));
      $validator = bin2hex(random_bytes(32));
      try {
        $insert = $db->prepare(
          'INSERT INTO remember_tokens (user_id, selector, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
        );
        $insert->execute([$user['id'], $selector, hash('sha256', $validator)]);
        $remember = [
          'selector' => $selector,
          'validator' => $validator,
          'expiresAt' => time() + 86400 * 30,
        ];
      } catch (PDOException $error) {
        // Older installations may lack optional remember storage. The mandatory
        // users-row guard must still commit successfully before ordinary login.
        $state = (string) ($error->errorInfo[0] ?? $error->getCode());
        if (!in_array($state, ['42S02', '42S22'], true) || !$db->inTransaction()) {
          throw $error;
        }
        error_log('Remember storage requires Database Repair; issuing a session only.');
      }
    }
    if (!$db->commit()) {
      throw new RuntimeException('Unable to commit credential transaction.');
    }
    return $remember;
  } catch (Throwable $error) {
    if ($db->inTransaction()) {
      $db->rollBack();
    }
    throw $error;
  }
}

/** Credentials are already verified; an email-only caller cannot rotate another user's link.
 * @param array<array-key,scalar|null> $user
 */
function voncms_resend_login_verification(PDO $db, array $user, string $loginIdentifier): never
{
  require_once __DIR__ . '/mail_helper.php';
  $read = $db->prepare(
    'SELECT email_verified, verification_token FROM users WHERE id=? AND password=? AND email=?',
  );
  $read->execute([$user['id'], $user['password'], $user['email']]);
  $verification = DataBoundary::row($read->fetch(PDO::FETCH_ASSOC));
  if (!$verification) {
    ResponseHelper::sendError('Account changed. Please try again.', 409);
  }
  if ((int) $verification['email_verified'] === 1) {
    RateLimiter::refundSuccessfulAttempt($loginIdentifier);
    echo json_encode([
      'success' => true,
      'message' => 'Your email is already verified. Sign in normally.',
    ]);
    exit();
  }
  if (
    !RateLimiter::consumeFixedWindows(
      [
        'verification:cooldown:' . $user['id'] => [1, 60],
        'verification:account:' . $user['id'] => [3, 900],
      ],
      'verification-resend',
    )
  ) {
    ResponseHelper::sendError('Please wait before requesting another verification email.', 429);
  }
  $baseUrl = voncms_resolve_trusted_public_base_url($db);
  if ($baseUrl === '') {
    ResponseHelper::sendError('Verification email is temporarily unavailable.', 503);
  }
  $token = generateVerificationToken();
  $update = $db->prepare(
    'UPDATE users SET verification_token=?, verification_token_expires=DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id=? AND password=? AND email=? AND email_verified=0 AND (verification_token=? OR (verification_token IS NULL AND ? IS NULL))',
  );
  $oldToken = $verification['verification_token'];
  $update->execute([
    voncms_account_token_digest($token),
    $user['id'],
    $user['password'],
    $user['email'],
    $oldToken,
    $oldToken,
  ]);
  if ($update->rowCount() !== 1) {
    ResponseHelper::sendError('Account changed. Please try again.', 409);
  }
  RateLimiter::refundSuccessfulAttempt($loginIdentifier);
  if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
  }
  $mail = sendVerificationEmail(
    $db,
    (string) $user['email'],
    (string) $user['username'],
    $token,
    $baseUrl,
  );
  if (empty($mail['success'])) {
    error_log('Verification resend delivery failed.');
    // Keep the account unverified; do not expose SMTP details or invalidate a newer token.
    ResponseHelper::sendError(
      'Verification email could not be sent. Please retry later or contact the administrator.',
      503,
    );
  }
  echo json_encode([
    'success' => true,
    'message' => 'Verification email sent. Only the latest link is valid; it expires in 24 hours.',
  ]);
  exit();
}

// Reserve the attempt atomically before authentication work begins.
$loginRateIdentifier =
  'login:ip:' .
  RateLimiter::normalizeLoginAddress(DataBoundary::serverString('REMOTE_ADDR', '0.0.0.0'));
RateLimiter::requireAttempt($loginRateIdentifier);

// Get JSON input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid request body', 400);
}

foreach (['username', 'password', 'hp_field', 'remember_me'] as $field) {
  if (array_key_exists($field, $input) && $input[$field] !== null && !is_scalar($input[$field])) {
    ResponseHelper::sendError('Invalid request body', 400);
  }
}

$username = trim((string) ($input['username'] ?? ''));
$password = (string) ($input['password'] ?? '');
$honeypot = (string) ($input['hp_field'] ?? '');
$rememberMe = filter_var($input['remember_me'] ?? false, FILTER_VALIDATE_BOOLEAN);
$action = $input['action'] ?? 'login';
if (!is_string($action)) {
  ResponseHelper::sendError('Invalid login action', 400);
}
// Older clients may include an unrelated action field; only the explicit resend action is new.

if (strlen($username) > 254 || strlen($password) > 4096) {
  ResponseHelper::sendError('Invalid credentials', 401);
}

// Honeypot check - bots will fill this hidden field
if ($honeypot !== '') {
  // Log suspicious activity but don't reveal it's a honeypot
  SecurityLogger::log(
    'honeypot_caught',
    'critical',
    ['ip' => $_SERVER['REMOTE_ADDR'], 'endpoint' => 'login.php'],
    true,
  );
  error_log('Honeypot triggered from IP: ' . DataBoundary::serverString('REMOTE_ADDR', 'unknown'));
  ResponseHelper::sendError('Login failed', 400);
}

if (empty($username) || empty($password)) {
  ResponseHelper::sendError('Username and password required', 400);
}

// Check if database connection exists
if (!isset($pdo)) {
  // No database - return error
  ResponseHelper::sendError(
    'Database not configured. Please set up database connection in von_config.php',
    503,
  );
}

try {
  $hasDisplayNameColumn = voncms_has_display_name_column($pdo);
  $displayNameSelect = $hasDisplayNameColumn ? 'display_name' : 'NULL AS display_name';

  // Authenticate against database
  $stmt = $pdo->prepare(
    "SELECT id, username, $displayNameSelect, email, role, avatar, bio, created_at AS createdAt, password FROM users WHERE email = ? OR username = ? LIMIT 1",
  );
  $stmt->execute([$username, $username]);
  $user = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

  if (voncms_verify_login_candidate($user, $password) && $user !== false) {
    if ($action === 'resend_verification') {
      voncms_resend_login_verification($pdo, $user, $loginRateIdentifier);
    }
    $authPasswordHash = (string) $user['password'];
    try {
      $verificationStmt = $pdo->prepare(
        'SELECT email_verified, verification_token FROM users WHERE id = ? LIMIT 1',
      );
      $verificationStmt->execute([$user['id']]);
      $verification = DataBoundary::row($verificationStmt->fetch(PDO::FETCH_ASSOC)) ?: [];

      $isVerified =
        !isset($verification['email_verified']) || (int) $verification['email_verified'] === 1;
      $hasPendingVerification = !empty($verification['verification_token']);

      if (!$isVerified && $hasPendingVerification) {
        ResponseHelper::sendError('Please verify your email before logging in.', 403);
      }
    } catch (Throwable $e) {
      // Older installs may not have verification columns yet. Keep login backward-compatible.
    }

    // Hash verification stays outside the lock; credential issuance is serialized
    // with resets/profile/admin password writers before session or cookie changes.
    $rememberCredentials = voncms_issue_login_credentials(
      $pdo,
      $user,
      $authPasswordHash,
      $rememberMe,
    );
    if ($rememberCredentials === false) {
      ResponseHelper::sendError('Invalid credentials', 401);
    }

    // Login success
    unset($user['password']); // Remove password from session

    // Scrub avatar URL for consistent output
    if (!empty($user['avatar'])) {
      $user['avatar'] = ResponseHelper::scrubAvatarUrl($user['avatar']);
    }

    // SECURITY: Regenerate session ID to prevent Session Fixation attacks
    session_regenerate_id(true);

    SessionManager::establishAuthenticatedSession($user, $authPasswordHash);

    // Generate CSRF token for this session
    $csrfToken = CSRFProtection::generateToken();

    // Success must not erase the shared-IP attack budget.
    RateLimiter::refundSuccessfulAttempt($loginRateIdentifier);

    // HANDLE REMEMBER ME (30 Days)
    $rememberCookieName = 'voncms_remember';
    $rawRememberCookie = $_COOKIE[$rememberCookieName] ?? '';
    $rememberCookie = is_string($rawRememberCookie) ? $rawRememberCookie : '';
    $params = session_get_cookie_params();

    if ($rememberCookie !== '') {
      $rememberParts = explode(':', $rememberCookie, 2);
      $existingSelector = $rememberParts[0] ?? '';

      if (preg_match('/^[a-f0-9]{24}$/', $existingSelector)) {
        try {
          $deleteRememberStmt = $pdo->prepare('DELETE FROM remember_tokens WHERE selector = ?');
          $deleteRememberStmt->execute([$existingSelector]);
        } catch (Throwable $e) {
          // Older installs may not have the remember token table until first use or repair.
        }
      }

      setcookie($rememberCookieName, '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
      ]);
    }

    if ($rememberCredentials !== []) {
      try {
        // Best-effort expired-row cleanup stays outside the credential lock.
        $pdo->exec('DELETE FROM remember_tokens WHERE expires_at <= NOW()');
      } catch (Throwable $e) {
        error_log('Expired remember token cleanup failed');
      }
      setcookie(
        $rememberCookieName,
        $rememberCredentials['selector'] . ':' . $rememberCredentials['validator'],
        [
          'expires' => $rememberCredentials['expiresAt'],
          'path' => $params['path'],
          'domain' => $params['domain'],
          'secure' => $params['secure'],
          'httponly' => true,
          'samesite' => 'Lax',
        ],
      );
    }

    echo json_encode([
      'success' => true,
      'user' => $user,
      'csrf_token' => $csrfToken,
    ]);
  } else {
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
  ResponseHelper::sendError($e);
}
