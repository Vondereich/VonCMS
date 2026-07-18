<?php
/**
 * Check Auth API - Verify if user has valid session
 * Returns user data if logged in, or error if not
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Session already started in security.php

// Check if user is logged in and session is valid
if (isset($_SESSION['user']) && SessionManager::isValid()) {
  // Touch session to extend expiry
  SessionManager::touch();

  // Return user data with scrubbed avatar URL
  $user = $_SESSION['user'];
  if (!empty($user['avatar'])) {
    $user['avatar'] = ResponseHelper::scrubAvatarUrl($user['avatar']);
  }
  echo json_encode([
    'success' => true,
    'authenticated' => true,
    'user' => $user,
  ]);
} else {
  $rememberCookieName = 'voncms_remember';
  $rememberCookie = (string) ($_COOKIE[$rememberCookieName] ?? '');
  $rememberSelector = '';
  $rememberRotationConflict = false;

  if ($rememberCookie !== '' && isset($pdo) && $pdo instanceof PDO) {
    $rememberParts = explode(':', $rememberCookie, 2);
    $rememberSelector = $rememberParts[0] ?? '';
    $rememberValidator = $rememberParts[1] ?? '';

    if (
      preg_match('/^[a-f0-9]{24}$/', $rememberSelector) &&
      preg_match('/^[a-f0-9]{64}$/', $rememberValidator)
    ) {
      try {
        $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
        $displayNameSelect =
          $columnStmt && $columnStmt->rowCount() > 0 ? 'u.display_name' : 'NULL AS display_name';
        $rememberStmt = $pdo->prepare(
          "SELECT rt.id AS remember_token_id, rt.token_hash, u.id, u.username, $displayNameSelect, u.email, u.role, u.avatar, u.bio, u.created_at AS createdAt
           FROM remember_tokens rt
           JOIN users u ON u.id = rt.user_id
           WHERE rt.selector = ? AND rt.expires_at > NOW()
           LIMIT 1",
        );
        $rememberStmt->execute([$rememberSelector]);
        $rememberUser = $rememberStmt->fetch(PDO::FETCH_ASSOC);
        $candidateHash = hash('sha256', $rememberValidator);

        if ($rememberUser && hash_equals((string) $rememberUser['token_hash'], $candidateHash)) {
          $nextValidator = bin2hex(random_bytes(32));
          $nextTokenHash = hash('sha256', $nextValidator);
          $nextExpiresAt = time() + 86400 * 30;
          $rotateStmt = $pdo->prepare(
            'UPDATE remember_tokens SET token_hash = ?, expires_at = ?, last_used_at = NOW() WHERE id = ? AND token_hash = ?',
          );
          $rotateStmt->execute([
            $nextTokenHash,
            date('Y-m-d H:i:s', $nextExpiresAt),
            $rememberUser['remember_token_id'],
            $rememberUser['token_hash'],
          ]);

          if ($rotateStmt->rowCount() === 1) {
            unset($rememberUser['remember_token_id'], $rememberUser['token_hash']);
            if (!empty($rememberUser['avatar'])) {
              $rememberUser['avatar'] = ResponseHelper::scrubAvatarUrl($rememberUser['avatar']);
            }

            $_SESSION = [];
            session_regenerate_id(true);
            $_SESSION['user'] = $rememberUser;
            $_SESSION['ua_bind'] = hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
            $csrfToken = CSRFProtection::generateToken();
            SessionManager::touch();

            $params = session_get_cookie_params();
            setcookie($rememberCookieName, $rememberSelector . ':' . $nextValidator, [
              'expires' => $nextExpiresAt,
              'path' => $params['path'],
              'domain' => $params['domain'],
              'secure' => $params['secure'],
              'httponly' => true,
              'samesite' => 'Lax',
            ]);

            echo json_encode([
              'success' => true,
              'authenticated' => true,
              'user' => $rememberUser,
              'csrf_token' => $csrfToken,
            ]);
            exit();
          }

          require_once __DIR__ . '/security/SecurityLogger.php';
          SecurityLogger::log('remember_rotation_conflict', 'low', [
            'user_id' => (int) ($rememberUser['id'] ?? 0),
            'reason' => 'compare_and_swap_lost',
          ]);
          $rememberRotationConflict = true;
        }
      } catch (Throwable $e) {
        // Fail closed when the token table is unavailable or the stored token is invalid.
      }
    }
  }

  if ($rememberCookie !== '' && !$rememberRotationConflict) {
    $params = session_get_cookie_params();
    setcookie($rememberCookieName, '', [
      'expires' => time() - 42000,
      'path' => $params['path'],
      'domain' => $params['domain'],
      'secure' => $params['secure'],
      'httponly' => true,
      'samesite' => 'Lax',
    ]);
  }

  echo json_encode(['success' => true, 'authenticated' => false, 'user' => null]);
}
