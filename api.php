<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-CSRF-TOKEN");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'von_config.php';
require_once 'security.php';

// Start session for CSRF and session management
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Helper to get JSON input
function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

// Helper to save settings
function saveSettings($settings) {
    $file = __DIR__ . '/data/site_settings.json';
    if (!is_dir(dirname($file))) mkdir(dirname($file), 0755, true);
    return file_put_contents($file, json_encode($settings, JSON_PRETTY_PRINT));
}

// Helper to get settings
function getSettings() {
    $file = __DIR__ . '/data/site_settings.json';
    if (file_exists($file)) {
        return json_decode(file_get_contents($file), true);
    }
    return [];
}

switch ($action) {
    case 'get_settings':
        $file = __DIR__ . '/data/site_settings.json';
        // Check if site_settings.json exists - if not, it's a fresh install
        if (!file_exists($file)) {
            echo json_encode(['installed' => false]);
        } else {
            echo json_encode(getSettings());
        }
        break;
    
    case 'get_csrf_token':
        // Endpoint to get CSRF token for frontend
        echo json_encode(['csrf_token' => CSRFProtection::getToken()]);
        break;

    case 'save_settings':
        // Validate CSRF token for write operations
        CSRFProtection::requireToken();
        
        // Validate session
        SessionManager::requireValidSession();
        
        // Check if it's FormData (POST) or JSON Body
        $settings = null;
        if (isset($_POST['settings'])) {
            $settings = json_decode($_POST['settings'], true);
        } else {
            $input = getJsonInput();
            $settings = $input['settings'] ?? $input;
        }

        if ($settings) {
            // Merge with existing settings to prevent data loss
            $current = getSettings();
            $newSettings = array_merge($current, $settings);
            
            if (saveSettings($newSettings)) {
                echo json_encode(['success' => true, 'message' => 'Settings saved']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to save settings']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No settings provided']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
?>
