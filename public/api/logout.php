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

// Logout action
SessionManager::destroy();

echo json_encode(['success' => true, 'message' => 'Logged out']);
