<?php

// Configuration includes this before the normal security bootstrap is available.
if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

final class RuntimeLogging
{
  private static function normalizePath(string $path): string
  {
    $path = str_replace('\\', '/', $path);
    if (!preg_match('~^(?:[a-z]:/|/)~i', $path)) {
      $path = (getcwd() ?: '') . '/' . $path;
    }
    $parts = [];
    foreach (explode('/', $path) as $part) {
      if ($part === '..') {
        array_pop($parts);
      } elseif ($part !== '' && $part !== '.') {
        $parts[] = $part;
      }
    }
    $normalized = (str_starts_with($path, '/') ? '/' : '') . implode('/', $parts);
    return PHP_OS_FAMILY === 'Windows' ? strtolower($normalized) : $normalized;
  }

  private static function allowedPath(string $path): bool
  {
    $restriction = trim((string) ini_get('open_basedir'));
    if ($restriction === '') {
      return true;
    }
    $candidate = self::normalizePath($path);
    foreach (explode(PATH_SEPARATOR, $restriction) as $root) {
      if ($root === '') {
        continue;
      }
      $root = rtrim(self::normalizePath($root), '/');
      if ($candidate === $root || str_starts_with($candidate, $root . '/')) {
        return true;
      }
    }
    return false;
  }

  public static function configure(string $installationRoot): void
  {
    if (PHP_SAPI === 'cli') {
      return;
    }
    $environment = strtolower(trim((string) (getenv('VONCMS_ENV') ?: 'production')));
    $development = in_array($environment, ['development', 'dev', 'local'], true);
    $uri = is_string($_SERVER['REQUEST_URI'] ?? null) ? $_SERVER['REQUEST_URI'] : '';
    $requestPath = parse_url($uri, PHP_URL_PATH);
    $api = is_string($requestPath) && preg_match('~(?:^|/)api(?:/|\.php$)~i', $requestPath) === 1;
    error_reporting(E_ALL);
    ini_set('display_errors', $development && !$api ? '1' : '0');
    ini_set('log_errors', '1');

    $documentRoot = is_string($_SERVER['DOCUMENT_ROOT'] ?? null) ? $_SERVER['DOCUMENT_ROOT'] : '';
    $temporaryRoot = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'voncms-logs';
    $privateRoot =
      $documentRoot !== ''
        ? dirname($documentRoot) . DIRECTORY_SEPARATOR . 'voncms-logs'
        : $temporaryRoot;
    $suffix = DIRECTORY_SEPARATOR . substr(hash('sha256', $installationRoot), 0, 16);
    foreach (array_unique([$privateRoot . $suffix, $temporaryRoot . $suffix]) as $logDir) {
      $publicRoot = rtrim(self::normalizePath($documentRoot), '/');
      $candidate = self::normalizePath($logDir);
      if (
        $documentRoot !== '' &&
        ($candidate === $publicRoot || str_starts_with($candidate, $publicRoot . '/'))
      ) {
        continue;
      }
      // Do not probe outside a host's restriction, even before display_errors is configured.
      if (!self::allowedPath($logDir)) {
        continue;
      }
      if (!@is_dir($logDir) && !@mkdir($logDir, 0700, true) && !@is_dir($logDir)) {
        continue;
      }
      $logFile = $logDir . ($development ? '/php_error_dev.log' : '/php_error.log');
      if (@is_link($logFile)) {
        continue;
      }
      $handle = @fopen($logFile, 'ab');
      if ($handle === false) {
        continue;
      }
      fclose($handle);
      @chmod($logFile, 0600);
      $size = @filesize($logFile);
      if ($size !== false && $size > 5 * 1024 * 1024) {
        @rename($logFile, $logFile . '.bak');
      }
      ini_set('error_log', $logFile);
      return;
    }
    // Keep the host's PHP error_log when neither private directory is permitted.
    // Never fall back to a publicly served plaintext log inside the installation.
  }
}
