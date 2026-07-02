<?php
// VonCMS Configuration
// Generated Manually

// Production Error Reporting (Security Enhancement)
if (php_sapi_name() !== 'cli') {
  $isProduction = !in_array(
    preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')),
    ['localhost', '127.0.0.1', 'localhost:8080'],
  );
  if ($isProduction) {
    // HIDE errors from user, but LOG them to file
    error_reporting(E_ALL);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');

    // Ensure logs directory exists (Auto-Fix)
    $logDir = __DIR__ . '/logs';
    if (!file_exists($logDir)) {
      @mkdir($logDir, 0755, true);
    }

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
    ini_set('error_log', __DIR__ . '/logs/php_error_dev.log');
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
      $data = trim($data);
      $data = stripslashes($data);
      $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    }
    return $data;
  }
}
