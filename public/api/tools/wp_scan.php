<?php
require_once __DIR__ . '/../../security.php';
define('VONCMS_WP_IMPORT_CONTEXT', true);
require_once __DIR__ . '/wp_wxr_reader_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

const VONCMS_WP_IMPORT_MAX_XML_BYTES = 64 * 1024 * 1024;

$configPath = __DIR__ . '/../../von_config.php';
if (!file_exists($configPath)) {
  ResponseHelper::sendError('Server Config Error: Config file not found', 500);
}

require_once $configPath;
// Session already handled in security.php
SessionManager::requireValidSession();
CSRFProtection::requireToken();

SessionManager::requirePrimaryAdmin();
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Invalid request method', 405);
}

$file = $_FILES['xml_file'] ?? null;
if (
  !is_array($file) ||
  ($file['error'] ?? null) !== UPLOAD_ERR_OK ||
  !is_string($file['name'] ?? null) ||
  !is_string($file['tmp_name'] ?? null) ||
  !is_int($file['size'] ?? null)
) {
  ResponseHelper::sendError('File upload failed', 400);
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);

if (strtolower($ext) !== 'xml') {
  ResponseHelper::sendError('Invalid file type. Only XML allowed.', 400);
}

$uploadSize = $file['size'];
if ($uploadSize <= 0 || $uploadSize > VONCMS_WP_IMPORT_MAX_XML_BYTES) {
  ResponseHelper::sendError('XML file must be between 1 byte and 64MB.', 400);
}

if (!is_uploaded_file($file['tmp_name'])) {
  ResponseHelper::sendError('Invalid uploaded file.', 400);
}

// Move to temp directory
$uploadDir = __DIR__ . '/../../uploads/temp/';

if (!file_exists($uploadDir)) {
  if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    ResponseHelper::sendError('Failed to create temporary import directory', 500);
  }
}

foreach (glob($uploadDir . 'wp_import_*') ?: [] as $oldImportFile) {
  if (
    !preg_match(
      '/\Awp_import_[a-f0-9]{32}\.xml(?:\.state\.json(?:\.tmp)?|\.lock)?\z/',
      basename($oldImportFile),
    )
  ) {
    continue;
  }
  if (is_file($oldImportFile) && filemtime($oldImportFile) < time() - 86400) {
    @unlink($oldImportFile);
  }
}

$tempShield = $uploadDir . '.htaccess';
if (!file_exists($tempShield)) {
  $shieldRule = "Require all denied\nDeny from all\n";
  $shieldBytes = @file_put_contents($tempShield, $shieldRule, LOCK_EX);
  if ($shieldBytes !== strlen($shieldRule)) {
    @unlink($tempShield);
    ResponseHelper::sendError('Failed to protect the temporary import directory', 500);
  }
}

$tempPath = $uploadDir . 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';

if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
  ResponseHelper::sendError('Failed to save temporary file', 500);
}

try {
  $inspection = voncms_wp_inspect_document($tempPath);

  echo json_encode([
    'success' => true,
    'message' => 'Scan complete',
    'stats' => $inspection['stats'],
    'source_site_url' => $inspection['source_site_url'],
    'source_blog_url' => $inspection['source_blog_url'],
    'temp_file' => basename($tempPath), // Send back filename for next step
  ]);
} catch (Throwable $e) {
  @unlink($tempPath);
  ResponseHelper::sendError('Unable to scan the WordPress XML file. ' . $e->getMessage(), 400);
}
