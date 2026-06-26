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
  // No valid session
  echo json_encode([
    'success' => true,
    'authenticated' => false,
    'user' => null,
  ]);
}
