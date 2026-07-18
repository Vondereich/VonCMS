<?php
/**
 * VonCMS - Email Verification API
 * Handles verification link clicks
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers (Standardized)
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

// Get token from URL
$token = $_GET['token'] ?? '';

if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/i', $token)) {
  showResult(false, 'Invalid verification link.');
  exit();
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  showResult(false, 'Database not configured.');
  exit();
}

try {
  // Find user with this token
  $stmt = $pdo->prepare(
    'SELECT id, username, email FROM users WHERE verification_token = ? AND email_verified = 0',
  );
  $stmt->execute([$token]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    showResult(false, 'Invalid or expired verification link. The email may already be verified.');
    exit();
  }

  // Check token expiry (24 hours)
  $stmt = $pdo->prepare('SELECT verification_token_expires FROM users WHERE id = ?');
  $stmt->execute([$user['id']]);
  $expires = $stmt->fetchColumn();

  if ($expires && strtotime($expires) < time()) {
    showResult(false, 'Verification link has expired. Please request a new one.');
    exit();
  }

  // Mark email as verified
  $stmt = $pdo->prepare(
    'UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
  );
  $stmt->execute([$user['id']]);

  showResult(
    true,
    'Email verified successfully! You can now log in and participate in discussions.',
    $user['username'],
  );
} catch (PDOException $e) {
  error_log('Email verification error: ' . $e->getMessage());
  showResult(false, 'Verification failed. Please try again later.');
}

/**
 * Show styled result page
 *
 * @param bool $success
 * @param string $message
 * @param string $username
 * @return void
 */
function showResult($success, $message, $username = '')
{
  $icon = $success ? '&#9989;' : '&#10060;';
  $color = $success ? '#10b981' : '#ef4444';
  $bgColor = $success ? '#ecfdf5' : '#fef2f2';
  $title = $success ? 'Email Verified!' : 'Verification Failed';
  $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
  $basePath = preg_replace('#/api(/.*)?$#i', '', (string) $scriptName);
  $basePath = $basePath === '/' || $basePath === '\\' ? '' : rtrim($basePath, '/');
  $homeHref = ($basePath !== '' ? $basePath : '') . '/';

  echo '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>' .
    $title .
    ' - VonCMS</title>
        <style>
            * { box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                margin: 0;
            }
            .card {
                background: white;
                border-radius: 16px;
                padding: 40px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25);
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #1f2937; margin: 0 0 10px; font-size: 24px; }
            p { color: #6b7280; margin: 0 0 25px; line-height: 1.6; }
            .highlight { color: ' .
    $color .
    '; font-weight: bold; }
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 14px 32px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: bold;
                transition: transform 0.2s;
            }
            .btn:hover { transform: scale(1.05); }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">' .
    $icon .
    '</div>
            <h1>' .
    $title .
    '</h1>
            <p>' .
    htmlspecialchars($message) .
    '</p>
            ' .
    ($success
      ? '<a href="' . htmlspecialchars($homeHref) . '" class="btn">Go to Homepage</a>'
      : '<a href="' . htmlspecialchars($homeHref) . '" class="btn">Back to Site</a>') .
    '
        </div>
    </body>
    </html>';
}
