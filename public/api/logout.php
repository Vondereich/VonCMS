<?php
require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// 1.5 Logout without CSRF (Fix)
// Enforce CSRF token verification for logout to prevent unauthorized logout attacks.
CSRFProtection::requireToken();

$rememberCookieName = 'voncms_remember';
$rememberCookie = (string) ($_COOKIE[$rememberCookieName] ?? '');
$rememberParts = explode(':', $rememberCookie, 2);
$rememberSelector = $rememberParts[0] ?? '';

if (preg_match('/^[a-f0-9]{24}$/', $rememberSelector) && isset($pdo) && $pdo instanceof PDO) {
  try {
    $deleteRememberStmt = $pdo->prepare('DELETE FROM remember_tokens WHERE selector = ?');
    $deleteRememberStmt->execute([$rememberSelector]);
  } catch (Throwable $e) {
    // Logout must still complete when an older install has no remember token table.
  }
}

$params = session_get_cookie_params();
setcookie($rememberCookieName, '', [
  'expires' => time() - 42000,
  'path' => $params['path'],
  'domain' => $params['domain'],
  'secure' => $params['secure'],
  'httponly' => true,
  'samesite' => 'Lax',
]);

// Logout action
SessionManager::destroy();

echo json_encode(['success' => true, 'message' => 'Logged out']);
