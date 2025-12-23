<?php
header('Content-Type: application/json');

// Simple theme upload endpoint for admin use.
// Expects multipart/form-data with fields:
// - theme (file) : .zip or single css/js file
// - name (optional)
// - version (optional)
// - uploadedBy (optional)

$root = dirname(__DIR__);
$themesDir = $root . DIRECTORY_SEPARATOR . 'themes';
$dataFile = $root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'themes.json';

if (!is_dir($themesDir)) {
    if (!mkdir($themesDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to create themes directory.']);
        exit;
    }
}

if (!isset($_FILES['theme'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No theme file uploaded (form field name: theme).']);
    exit;
}

$file = $_FILES['theme'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

$name = trim($_POST['name'] ?? basename($file['name']));
$version = trim($_POST['version'] ?? '0.0.0');
$uploadedBy = trim($_POST['uploadedBy'] ?? 'admin');

// Basic validation: allow zip, css, js, txt
$allowedExt = ['zip', 'css', 'js'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unsupported file type. Allowed: zip, css, js']);
    exit;
}

// Create unique id
$id = preg_replace('/[^a-z0-9-_]/i', '-', strtolower(pathinfo($name, PATHINFO_FILENAME))) . '_' . time();
$destDir = $themesDir . DIRECTORY_SEPARATOR . $id;
if (!mkdir($destDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to create theme destination folder.']);
    exit;
}

$uploadedPath = $destDir . DIRECTORY_SEPARATOR . basename($file['name']);
if (!move_uploaded_file($file['tmp_name'], $uploadedPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file.']);
    exit;
}

$checksum = hash_file('sha256', $uploadedPath);
$size = filesize($uploadedPath);

// If zip, extract
if ($ext === 'zip') {
    $zip = new ZipArchive();
    if ($zip->open($uploadedPath) === TRUE) {
        $zip->extractTo($destDir);
        $zip->close();
        // Optionally remove the zip after extraction
        @unlink($uploadedPath);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to open ZIP archive.']);
        exit;
    }
} else {
    // Non-zip: keep the file as-is. If it's a css/js, we expect it to be the theme entrypoint.
}

// Ensure data file exists
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([]));
}

$list = json_decode(file_get_contents($dataFile), true);
if (!is_array($list)) $list = [];

$meta = [
    'id' => $id,
    'name' => $name,
    'version' => $version,
    'uploadedBy' => $uploadedBy,
    'uploadedAt' => date('c'),
    'enabled' => false,
    'checksum' => $checksum,
    'size' => $size,
    'folder' => 'themes/' . $id
];

$list[] = $meta;
if (file_put_contents($dataFile, json_encode($list, JSON_PRETTY_PRINT)) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update metadata file.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Theme uploaded', 'theme' => $meta]);
exit;
