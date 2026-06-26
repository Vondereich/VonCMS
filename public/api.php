<?php
/**
 * VonCMS - Central API Router (Legacy Bridge)
 * Standardized to "Breeze" Standards
 */

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/von_config.php';

// Standardize Headers
sendApiHeaders();

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Helper to get JSON input
function getJsonInput()
{
  $input = file_get_contents('php://input');
  return json_decode($input, true) ?? [];
}

switch ($action) {
  case 'get_settings':
    // Delegate to the specialized database-aware endpoint
    // This ensures the frontend gets the source-of-truth from DB
    require_once __DIR__ . '/api/get_settings.php';
    break;

  case 'get_csrf_token':
    echo json_encode(['csrf_token' => CSRFProtection::getToken()]);
    break;

  case 'save_settings':
    // Delegate to the specialized database-aware endpoint
    // This fixes the "Settings Reset" issue where api.php was only saving to JSON
    require_once __DIR__ . '/api/save_settings.php';
    break;

  default:
    ResponseHelper::sendError('Invalid action: ' . $action, 400);
    break;
}
