<?php
// VonCMS Configuration
// Generated Manually

// Production Error Reporting (Security Enhancement)
if (php_sapi_name() !== 'cli') {
  // Fail closed unless the server owner explicitly opts into a development environment.
  $voncmsEnvironment = strtolower(trim((string) (getenv('VONCMS_ENV') ?: 'production')));
  $isDevelopment = in_array($voncmsEnvironment, ['development', 'dev', 'local'], true);
  $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
  $privateLogRoot =
    is_string($documentRoot) && $documentRoot !== ''
      ? dirname($documentRoot) . DIRECTORY_SEPARATOR . 'voncms-logs'
      : rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'voncms-logs';
  $logDir = $privateLogRoot . DIRECTORY_SEPARATOR . substr(hash('sha256', __DIR__), 0, 16);
  if (
    (!is_dir($logDir) && !@mkdir($logDir, 0700, true) && !is_dir($logDir)) ||
    !is_writable($logDir)
  ) {
    $logDir =
      rtrim(sys_get_temp_dir(), '/\\') .
      DIRECTORY_SEPARATOR .
      'voncms-logs' .
      DIRECTORY_SEPARATOR .
      substr(hash('sha256', __DIR__), 0, 16);
    @mkdir($logDir, 0700, true);
  }

  if (!$isDevelopment) {
    // HIDE errors from user, but LOG them to file
    error_reporting(E_ALL);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');

    $logFile = $logDir . '/php_error.log';
    ini_set('error_log', $logFile);

    // Log Rotation: Check if log file > 5MB
    if (file_exists($logFile) && filesize($logFile) > 5 * 1024 * 1024) {
      rename($logFile, $logFile . '.bak'); // Rotate
    }
  } else {
    error_reporting(E_ALL);
    // FORCE HIDE ERRORS ON API REQUESTS TO PREVENT JSON BREAKAGE
    if (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false) {
      ini_set('display_errors', '0');
    } else {
      ini_set('display_errors', '1');
    }
    ini_set('log_errors', '1');
    ini_set('error_log', $logDir . '/php_error_dev.log');
  }
}

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
   * @return mixed
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
