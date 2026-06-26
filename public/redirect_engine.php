<?php
/**
 * VonCMS - Redirect Engine
 * High-performance 301 redirect handler.
 * Loaded via .htaccess BEFORE React SPA boots.
 */

// Minimal bootstrap - no full framework load for speed
$configPath = __DIR__ . '/von_config.php';
if (!file_exists($configPath)) {
  // Config not found, pass through to SPA
  return;
}

require_once $configPath;

// Safety: Check if $pdo exists (config might not initialize it)
if (!isset($pdo) || !$pdo) {
  return; // No database, pass through
}

// Get requested URL (cleaned)
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedUrl = parse_url($requestUri);
$path = $parsedUrl['path'] ?? '/';

// SUBFOLDER AUTO-DETECTION
// If VonCMS is in a subfolder (e.g. example.com/cms/), we must strip '/cms'
// so that the DB lookup matches the relative path stored in the database.
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '/index.php'; // usually /index.php or /sub/index.php
$basePath = dirname($scriptName);

// Normalize slashes (Windows fix)
$basePath = str_replace('\\', '/', $basePath);

// Strip base path if it exists at start of URI
if ($basePath !== '/' && $basePath !== '.' && strpos($path, $basePath) === 0) {
  $path = substr($path, strlen($basePath));
}

// Ensure path starts with /
if (empty($path) || $path[0] !== '/') {
  $path = '/' . $path;
}

// Remove trailing slash for consistency (except root)
if ($path !== '/' && substr($path, -1) === '/') {
  $path = rtrim($path, '/');
}

// Early exit for known non-redirect paths
$ignorePaths = ['/api/', '/assets/', '/uploads/', '/admin'];
foreach ($ignorePaths as $ignore) {
  if (strpos($path, $ignore) === 0) {
    return; // Pass through to normal routing
  }
}

try {
  // Safety: Check if redirects table exists (prevents WSOD on fresh installs)
  $tableCheck = $pdo->query("SHOW TABLES LIKE 'redirects'");
  if ($tableCheck->rowCount() === 0) {
    return; // Table doesn't exist yet, pass through
  }

  // Check for redirect
  $stmt = $pdo->prepare(
    'SELECT target_url, redirect_type FROM redirects WHERE source_url = ? LIMIT 1',
  );
  $stmt->execute([$path]);
  $redirect = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($redirect) {
    // Increment hit counter (async-safe, non-blocking)
    $pdo
      ->prepare('UPDATE redirects SET hit_count = hit_count + 1 WHERE source_url = ?')
      ->execute([$path]);

    // Issue redirect
    $code = (int) $redirect['redirect_type'];
    $target = $redirect['target_url'];
    $targetPath = (string) (parse_url($target, PHP_URL_PATH) ?? '');
    if (!empty($targetPath) && $targetPath[0] !== '/') {
      $targetPath = '/' . ltrim($targetPath, '/');
    }
    if ($targetPath !== '/' && $targetPath !== '') {
      $targetPath = rtrim($targetPath, '/');
    }

    // SECURITY: Validate target URL to prevent open redirect attacks
    $isInternalPath = strpos($target, '/') === 0 && strpos($target, '//') !== 0; // Internal path like /page
    $isFullUrl = preg_match('#^https?://#i', $target); // Full URL like https://example.com
    $targetHost = null;
    $currentHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));

    // For full URLs, validate against current host to prevent external redirect abuse
    if ($isFullUrl) {
      $targetHost = parse_url($target, PHP_URL_HOST);
      // Only allow redirect to same host or if admin explicitly set external URL
      if (!empty($targetHost) && $targetHost !== $currentHost) {
        // External redirect - still allow but log for monitoring
        error_log("VonCMS Redirect Engine: External redirect from {$path} to {$target}");
      }
    }

    $isSamePathLoop =
      $targetPath !== '' &&
      $targetPath === $path &&
      (!$isFullUrl ||
        empty($targetHost) ||
        strcasecmp((string) $targetHost, (string) $currentHost) === 0);

    if (($isInternalPath || $isFullUrl) && !$isSamePathLoop) {
      http_response_code($code);
      header("Location: $target", true, $code);
      header('X-Redirect-By: VonCMS');
      exit();
    }
  }
} catch (Exception $e) {
  // Silently fail - don't break the site
  error_log('VonCMS Redirect Engine Error: ' . $e->getMessage());
}

// No redirect found - continue to normal SPA routing
// (This file is included via .htaccess, so returning allows normal flow)
