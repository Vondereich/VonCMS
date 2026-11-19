<?php
// This template may be copied and included as the live private configuration,
// but it must never execute as the browser's requested entry point.
$configSamplePath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($configSamplePath !== false && $requestedScriptPath === $configSamplePath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($configSamplePath, $requestedScriptPath);

// VonCMS Configuration
// Generated Manually

// Keep safe host logging even during a files-only rollback without the optional helper.
if (PHP_SAPI !== 'cli') {
  ini_set('display_errors', '0');
  ini_set('log_errors', '1');
}
$runtimeLogging = __DIR__ . '/core/RuntimeLogging.php';
if (is_file($runtimeLogging)) {
  require_once $runtimeLogging;
  RuntimeLogging::configure(__DIR__);
}
unset($runtimeLogging);

$db_host = '';
$db_name = '';
$db_user = '';
$db_pass = '';

try {
  $dsn = "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4";
  $pdo = new PDO($dsn, $db_user, $db_pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (PDOException $e) {
  // Connection failed.
  // If we are in the middle of an installation, or this is a fresh install,
  // we should NOT die here. We should let the application handle the 'not installed' state.
  $pdo = null;
  // In production, log this
  // error_log('Database connection failed: ' . $e->getMessage());
}

// Helper functions (Added to ensure compatibility with files including this)
if (!function_exists('check_auth')) {
  function check_auth()
  {
    if (session_status() == PHP_SESSION_NONE) {
      session_start();
    }
    return isset($_SESSION['user_id']);
  }
}

if (!function_exists('sanitize_input')) {
  /**
   * @param mixed $data
   * @return ($data is array ? array<array-key, mixed> : string)
   */
  function sanitize_input($data)
  {
    if (is_array($data)) {
      foreach ($data as $key => $value) {
        $data[$key] = sanitize_input($value);
      }
    } else {
      $data = trim((string) ($data ?? ''));
      $data = stripslashes($data);
      $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    }
    return $data;
  }
}
