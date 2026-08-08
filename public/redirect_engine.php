<?php
/**
 * VonCMS - Redirect Engine Compatibility Entry
 * Preserves the lightweight legacy include while sharing the public resolver.
 */

$configPath = __DIR__ . '/von_config.php';
if (!file_exists($configPath)) {
  return;
}

require_once $configPath;
require_once __DIR__ . '/seo_response_helper.php';

if (!isset($pdo) || !$pdo) {
  return;
}

$scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
$basePath = dirname($scriptName);
if ($basePath === '.' || $basePath === '\\') {
  $basePath = '/';
}

try {
  $publicRedirect = voncms_resolve_public_redirect(
    $pdo,
    $_SERVER['REQUEST_URI'] ?? '/',
    $basePath,
    $_SERVER['HTTP_HOST'] ?? '',
  );
  if ($publicRedirect !== null) {
    voncms_record_public_redirect_hit($pdo, $publicRedirect['sourcePath']);
    voncms_send_redirect($publicRedirect['location'], $publicRedirect['status'], 'VonCMS');
  }
} catch (Throwable $error) {
  error_log('VonCMS Redirect Engine Error: ' . $error->getMessage());
}
