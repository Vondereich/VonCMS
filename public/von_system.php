<?php
define('IN_API', true);
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/von_config.php';

// Standardize Headers
sendApiHeaders('GET, POST, OPTIONS');

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Helper to get JSON input
function getJsonInput()
{
  $input = file_get_contents('php://input');
  return json_decode($input, true) ?? [];
}

switch ($action) {
  case 'get_settings':
    require_once __DIR__ . '/api/get_settings.php';
    break;

  case 'get_csrf_token':
    // Endpoint to get CSRF token for frontend
    echo json_encode(['csrf_token' => CSRFProtection::getToken()]);
    break;

  case 'save_settings':
    require_once __DIR__ . '/api/save_settings.php';
    break;

  case 'system_update_check':
    // Ensure admin
    SessionManager::requireValidSession();
    if (strtolower($_SESSION['user']['role'] ?? '') !== 'admin') {
      http_response_code(403);
      exit(json_encode(['error' => 'Admin required']));
    }

    require_once __DIR__ . '/api/system/updater.php';
    $updater = new SystemUpdater();
    echo json_encode([
      'status' => 'success',
      'data' => $updater->checkPermissions(),
      'csrf_token' => CSRFProtection::getToken(),
    ]);
    break;

  case 'system_update_start':
    // Ensure admin
    SessionManager::requireValidSession();
    if (strtolower($_SESSION['user']['role'] ?? '') !== 'admin') {
      http_response_code(403);
      exit(json_encode(['error' => 'Admin required']));
    }

    // Only accept POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      exit(json_encode(['error' => 'POST required', 'method' => $_SERVER['REQUEST_METHOD']]));
    }

    $input = getJsonInput();

    // Manual CSRF Check (since we consumed stream)
    $csrfToken = $input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $sessionToken = CSRFProtection::getToken();

    if (!$csrfToken || !hash_equals($sessionToken, $csrfToken)) {
      http_response_code(403);
      exit(json_encode(['error' => 'CSRF validation failed']));
    }

    require_once __DIR__ . '/api/system/updater.php';
    $url = $input['download_url'] ?? '';
    $version = $input['version'] ?? 'unknown';
    $expectedHash = $input['expected_hash'] ?? null;

    if (!$url) {
      exit(json_encode(['error' => 'No download URL provided']));
    }

    try {
      $updater = new SystemUpdater();
      echo json_encode($updater->startUpdate($version, $url, $expectedHash));
    } catch (Throwable $e) {
      ResponseHelper::sendError(new Exception($e->getMessage()));
    }
    break;

  default:
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
    break;
}
