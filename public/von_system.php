<?php
define('IN_API', true);
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/von_config.php';

// Standardize Headers
sendApiHeaders('GET, POST, OPTIONS');

$actionValue = $_GET['action'] ?? ($_POST['action'] ?? '');
$action = is_scalar($actionValue) ? (string) $actionValue : '';

// Helper to get JSON input
function getJsonInput(): array
{
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  return is_array($input) ? $input : [];
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
    // OTA is owner-only: accept root or the primary administrator ID.
    SessionManager::requirePrimaryAdmin();

    require_once __DIR__ . '/api/system/updater.php';
    $updater = new SystemUpdater();
    echo json_encode([
      'status' => 'success',
      'data' => $updater->checkPermissions(),
      'csrf_token' => CSRFProtection::getToken(),
    ]);
    break;

  case 'system_update_start':
    // OTA is owner-only: accept root or the primary administrator ID.
    SessionManager::requirePrimaryAdmin();

    // Only accept POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      exit(json_encode(['error' => 'POST required', 'method' => $_SERVER['REQUEST_METHOD']]));
    }

    $input = getJsonInput();

    // The shared CSRF reader uses the same cached request body.
    CSRFProtection::requireToken();

    foreach (['download_url', 'version', 'expected_hash'] as $field) {
      if (
        array_key_exists($field, $input) &&
        $input[$field] !== null &&
        !is_scalar($input[$field])
      ) {
        ResponseHelper::sendError('Invalid update request payload.', 400);
      }
    }

    require_once __DIR__ . '/api/system/updater.php';
    $url = trim((string) ($input['download_url'] ?? ''));
    $version = trim((string) ($input['version'] ?? 'unknown'));
    $expectedHash = isset($input['expected_hash']) ? trim((string) $input['expected_hash']) : null;

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
