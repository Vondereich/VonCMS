<?php
// Simple save_settings.php
// Accepts POST JSON body and saves to data/site_settings.json
// Returns JSON { success: true } on success

header('Content-Type: application/json');

// Require an admin token to prevent public access
$expectedToken = getenv('ADMIN_SAVE_TOKEN');
$appEnv = getenv('APP_ENV') ?: '';
// Require ADMIN_SAVE_TOKEN to be set. Do not allow a dev-local fallback in production code.
if (!$expectedToken) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server misconfigured: ADMIN_SAVE_TOKEN not set. Configure ADMIN_SAVE_TOKEN in the environment.']);
    exit;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$headers = array_change_key_case($headers, CASE_LOWER);
$provided = $headers['x-admin-token'] ?? null;
if (!$provided && isset($headers['authorization'])) {
    if (preg_match('/Bearer\s+(.+)$/i', $headers['authorization'], $m)) $provided = $m[1];
}

// Require correct token
if (!$provided || $provided !== $expectedToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$input = file_get_contents('php://input');
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Empty request body']);
    exit;
}

$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON: ' . json_last_error_msg()]);
    exit;
}

$base = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($base)) {
    mkdir($base, 0755, true);
}

$path = $base . DIRECTORY_SEPARATOR . 'site_settings.json';

// Optionally, perform basic sanitization/whitelisting here
try {
    $written = file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    if ($written === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to write file']);
    } else {
        echo json_encode(['success' => true, 'message' => 'Settings saved']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
