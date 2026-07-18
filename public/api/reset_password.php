<?php
/**
 * VonCMS - Password Reset API
 * Handles password reset request and token verification
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}
require_once __DIR__ . '/mail_helper.php';

// Rate limit check
RateLimiter::requireNotLimited();
CSRFProtection::requireToken();

$input = json_decode(CSRFProtection::getRequestBody(), true);
$action = $input['action'] ?? 'request'; // 'request' or 'reset'
$honeypot = $input['hp_field'] ?? '';

// Honeypot check
if (!empty($honeypot)) {
  RateLimiter::recordAttempt();
  error_log(
    'Honeypot triggered during password reset from IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
  );
  // Return fake success to not alert the bot (matching request-success pattern)
  echo json_encode([
    'success' => true,
    'message' => 'If this email exists, a reset link has been sent.',
  ]);
  exit();
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

// Auto-migration: Add reset token columns if not exist
try {
  $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('reset_token', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN reset_token VARCHAR(64) DEFAULT NULL');
  }
  if (!in_array('reset_token_expires', $columns)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL');
  }
} catch (PDOException $e) {
  error_log('Migration check: ' . $e->getMessage());
}

if ($action === 'request') {
  // REQUEST PASSWORD RESET
  $email = trim($input['email'] ?? '');

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ResponseHelper::sendError('Valid email required', 400);
  }

  try {
    // Find user by email
    $stmt = $pdo->prepare('SELECT id, username, email FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Always return success to prevent email enumeration
    if (!$user) {
      echo json_encode([
        'success' => true,
        'message' => 'If this email exists, a reset link has been sent.',
      ]);
      exit();
    }

    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Store token
    $stmt = $pdo->prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?');
    $stmt->execute([$token, $expires, $user['id']]);

    // Build reset URL (Standardized v1.22.0)
    $protocol = is_https() ? 'https' : 'http';

    // Prefer configured domain_url over HTTP_HOST (prevents Host header injection)
    try {
      $duStmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='domain_url' LIMIT 1",
      );
      $duStmt->execute();
      $duRow = $duStmt->fetch(PDO::FETCH_ASSOC);
      $domainUrl = $duRow ? rtrim($duRow['setting_value'], '/') : '';
    } catch (Exception $e) {
      $domainUrl = '';
    }

    if ($domainUrl) {
      $domainScheme = strtolower((string) parse_url($domainUrl, PHP_URL_SCHEME));
      if (
        filter_var($domainUrl, FILTER_VALIDATE_URL) === false ||
        !in_array($domainScheme, ['http', 'https'], true)
      ) {
        $domainUrl = '';
      }
    }

    if ($domainUrl) {
      $resetUrl = "$domainUrl/?reset_token=$token";
    } else {
      // Fallback: derive from request (only when domain_url is not configured)
      $host = preg_replace(
        '/[^a-zA-Z0-9.\-:]/',
        '',
        (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'),
      );
      $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
      $basePath = preg_replace('#/api(/.*)?$#i', '', (string) $scriptName);
      $basePath = $basePath === '/' || $basePath === '\\' ? '' : rtrim($basePath, '/');
      $resetUrl = "$protocol://$host$basePath/?reset_token=$token";
    }

    // Send email
    $subject = 'Password Reset - VonCMS';
    $htmlBody =
      '
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #333; font-size: 16px;">Hi <strong>' .
      htmlspecialchars($user['username']) .
      '</strong>,</p>
                    <p style="color: #666;">You requested a password reset. Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="' .
      htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8') .
      '" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
                    </div>
                    <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn\'t request this, ignore this email.</p>
                </div>
            </div>
        </body>
        </html>';
    $htmlBody = preg_replace(
      '~<h1 style="color: white; margin: 0; font-size: 24px;">.*?Password Reset</h1>~',
      '<h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>',
      $htmlBody,
      1,
    );

    vonSendMail($email, $subject, $htmlBody);

    echo json_encode([
      'success' => true,
      'message' => 'If this email exists, a reset link has been sent.',
    ]);
  } catch (Exception $e) {
    ResponseHelper::sendError($e);
  }
} elseif ($action === 'reset') {
  // RESET PASSWORD WITH TOKEN
  $token = $input['token'] ?? '';
  $newPassword = $input['password'] ?? '';

  if (strlen($token) !== 64) {
    ResponseHelper::sendError('Invalid token', 400);
  }

  // Password strength validation
  if (
    strlen($newPassword) < 8 ||
    !preg_match('/[A-Z]/', $newPassword) ||
    !preg_match('/[0-9]/', $newPassword) ||
    !preg_match('/[!@#$%^&*(),.?":{}|<>]/', $newPassword)
  ) {
    ResponseHelper::sendError(
      'Password must be at least 8 characters with uppercase letter, number, and special character',
      400,
    );
  }

  try {
    // Find user with valid token
    $stmt = $pdo->prepare(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
      ResponseHelper::sendError('Invalid or expired token', 400);
    }

    $pdo->beginTransaction();
    try {
      // Update password
      $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
      $stmt = $pdo->prepare(
        'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      );
      $stmt->execute([$hashedPassword, $user['id']]);

      try {
        $revokeRememberStmt = $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?');
        $revokeRememberStmt->execute([$user['id']]);
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

    echo json_encode([
      'success' => true,
      'message' => 'Password updated successfully. You can now log in.',
    ]);
  } catch (Exception $e) {
    ResponseHelper::sendError($e);
  }
} else {
  ResponseHelper::sendError('Invalid action', 400);
}
