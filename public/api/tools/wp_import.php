<?php

require_once __DIR__ . '/../../core/DataBoundary.php';
// Suppress PHP error output that breaks JSON
require_once __DIR__ . '/../../security.php';
require_once __DIR__ . '/../public_cache_helper.php';
require_once __DIR__ . '/../publication_time_helper.php';
require_once __DIR__ . '/../content_embed_helper.php';
require_once __DIR__ . '/../content_slug_helper.php';
require_once __DIR__ . '/../../seo_schema_helper.php';
require_once __DIR__ . '/../../seo_response_helper.php';
require_once __DIR__ . '/../redirect_loop_helper.php';
define('VONCMS_WP_IMPORT_CONTEXT', true);
require_once __DIR__ . '/wp_wxr_reader_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

const VONCMS_WP_IMPORT_MAX_XML_BYTES = 64 * 1024 * 1024;
const VONCMS_WP_IMPORT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// Debug Logger
/**
 * @param mixed $msg
 * @return void
 */
function debug_log($msg)
{
  // Production mode: logging disabled
  // file_put_contents(__DIR__ . '/../../uploads/wp_debug.log', $msg . "\n", FILE_APPEND);
}

// Helper: Sanitize Title for Slug fallback
/**
 * @param string $str
 * @return string
 */
function sanitize_title($str)
{
  $str = strtolower(trim($str));
  $str = preg_replace('/[^a-z0-9-]/', '-', $str) ?? '';
  return preg_replace('/-+/', '-', $str) ?? '';
}

/**
 * @param string $url
 * @return string
 */
function normalize_import_url($url)
{
  $trimmed = trim(html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  return $trimmed !== '' ? rtrim($trimmed, '/') : '';
}

/**
 * @param string $url
 * @return string
 */
function get_url_origin($url)
{
  $parts = parse_url((string) $url);
  if (empty($parts['scheme']) || empty($parts['host'])) {
    return '';
  }

  $origin = $parts['scheme'] . '://' . $parts['host'];
  if (!empty($parts['port'])) {
    $origin .= ':' . $parts['port'];
  }

  return rtrim($origin, '/');
}

/**
 * @param string $sourceSiteUrl
 * @param string $sourceBlogUrl
 * @return array<int, string>
 */
function collect_source_base_urls($sourceSiteUrl, $sourceBlogUrl)
{
  $urls = [];

  foreach ([$sourceSiteUrl, $sourceBlogUrl] as $sourceUrl) {
    $normalized = normalize_import_url($sourceUrl);
    if ($normalized === '') {
      continue;
    }

    $urls[$normalized] = true;

    $origin = get_url_origin($normalized);
    if ($origin !== '') {
      $urls[$origin] = true;
    }
  }

  return array_keys($urls);
}

/**
 * @param array<int, string> $sourceBaseUrls
 * @return string
 */
function get_primary_source_origin($sourceBaseUrls)
{
  foreach ($sourceBaseUrls as $sourceBaseUrl) {
    $origin = get_url_origin($sourceBaseUrl);
    if ($origin !== '') {
      return $origin;
    }
  }

  return '';
}

/**
 * @param string $url
 * @param array<int, string> $sourceBaseUrls
 * @return string
 */
function absolutize_import_media_url($url, $sourceBaseUrls)
{
  $normalized = trim(html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($normalized === '' || preg_match('/^(?:data:|mailto:|tel:|javascript:)/i', $normalized)) {
    return '';
  }

  if (preg_match('~^https?://~i', $normalized)) {
    return $normalized;
  }

  $origin = get_primary_source_origin($sourceBaseUrls);
  if ($origin === '') {
    return '';
  }

  if (strpos($normalized, '//') === 0) {
    $scheme = parse_url($origin, PHP_URL_SCHEME) ?: 'https';
    return $scheme . ':' . $normalized;
  }

  if (strpos($normalized, '/') === 0) {
    return rtrim($origin, '/') . $normalized;
  }

  if (preg_match('~^(?:\.?/)?(?:wp-content/|uploads/)~i', $normalized)) {
    return rtrim($origin, '/') . '/' . ltrim($normalized, './');
  }

  return '';
}

/**
 * @param string $absoluteUrl
 * @param array<int, string> $sourceBaseUrls
 * @param string $targetSiteUrl
 * @return bool
 */
function should_rehost_import_image($absoluteUrl, $sourceBaseUrls, $targetSiteUrl)
{
  if ($absoluteUrl === '' || !preg_match('~^https?://~i', $absoluteUrl)) {
    return false;
  }

  $normalizedTarget = normalize_import_url($targetSiteUrl);
  if ($normalizedTarget !== '' && stripos($absoluteUrl, $normalizedTarget) === 0) {
    return false;
  }

  foreach ($sourceBaseUrls as $sourceBaseUrl) {
    if ($sourceBaseUrl !== '' && stripos($absoluteUrl, $sourceBaseUrl) === 0) {
      return true;
    }
  }

  $path = (string) (parse_url($absoluteUrl, PHP_URL_PATH) ?? '');
  return stripos($path, '/wp-content/uploads/') !== false;
}

/**
 * @param string $targetSiteUrl
 * @return array{absolute_dir: string, relative_dir: string, url_prefix: string}|null
 */
function get_import_upload_context($targetSiteUrl)
{
  /** @var array<string, array{absolute_dir: string, relative_dir: string, url_prefix: string}> $contexts */
  static $contexts = [];

  $cacheKey = $targetSiteUrl !== '' ? $targetSiteUrl : '_default';
  if (isset($contexts[$cacheKey])) {
    return $contexts[$cacheKey];
  }

  $year = date('Y');
  $month = date('m');
  $baseUploadDir = __DIR__ . '/../../uploads/';
  $absoluteDir = $baseUploadDir . $year . '/' . $month . '/';

  if (!is_dir($absoluteDir) && !mkdir($absoluteDir, 0755, true) && !is_dir($absoluteDir)) {
    debug_log('Media localizer could not create upload directory: ' . $absoluteDir);
    return null;
  }

  $path = trim((string) (parse_url($targetSiteUrl, PHP_URL_PATH) ?? ''), '/');
  $basePath = $path !== '' ? '/' . $path : '';

  $contexts[$cacheKey] = [
    'absolute_dir' => $absoluteDir,
    'relative_dir' => $year . '/' . $month . '/',
    'url_prefix' => $basePath . '/uploads/' . $year . '/' . $month . '/',
  ];

  return $contexts[$cacheKey];
}

/**
 * @param PDO $conn
 * @return bool
 */
function import_media_table_exists($conn)
{
  /** @var bool $checked */
  static $checked = false;

  /** @var bool $exists */
  static $exists = false;

  if ($checked) {
    return $exists;
  }

  try {
    $stmt = $conn->query("SHOW TABLES LIKE 'media'");
    $exists = $stmt && $stmt->rowCount() > 0;
  } catch (Throwable $e) {
    $exists = false;
  }

  $checked = true;
  return $exists;
}

/**
 * @param PDO $conn
 * @param string $relativePath
 * @param string $mimeType
 * @param int|float $size
 * @param int $uploadedBy
 * @param string $filename
 * @return void
 */
function register_imported_media($conn, $relativePath, $mimeType, $size, $uploadedBy, $filename)
{
  if (!$conn || !$uploadedBy || !import_media_table_exists($conn)) {
    return;
  }

  try {
    $storedPath = 'uploads/' . ltrim(str_replace('\\', '/', $relativePath), '/');
    $existing = $conn->prepare('SELECT id FROM media WHERE filepath = ? LIMIT 1');
    $existing->execute([$storedPath]);
    if (DataBoundary::row($existing->fetch(PDO::FETCH_ASSOC))) {
      return;
    }

    $stmt = $conn->prepare(
      'INSERT INTO media (filename, filepath, filetype, filesize, uploaded_by) VALUES (?, ?, ?, ?, ?)',
    );
    $stmt->execute([$filename, $storedPath, $mimeType, (int) $size, $uploadedBy]);
  } catch (Throwable $e) {
    debug_log('Media register skipped: ' . $e->getMessage());
  }
}

/**
 * @param string $sourceUrl
 * @param string $fallback
 * @return string
 */
function sanitize_import_media_name($sourceUrl, $fallback = 'wp-image')
{
  $path = (string) (parse_url($sourceUrl, PHP_URL_PATH) ?? '');
  $name = pathinfo($path, PATHINFO_FILENAME);
  $name = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $name) ?? '';

  if ($name === '') {
    $name = $fallback;
  }

  return substr($name, 0, 50);
}

/**
 * @param string $sourceUrl
 * @param string $mimeType
 * @return string
 */
function get_import_image_extension($sourceUrl, $mimeType)
{
  $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'ico'];
  $path = (string) (parse_url($sourceUrl, PHP_URL_PATH) ?? '');
  $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

  if (in_array($extension, $allowedExtensions, true)) {
    return $extension;
  }

  $mimeMap = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    'image/x-icon' => 'ico',
  ];

  return $mimeMap[$mimeType] ?? '';
}

/**
 * @param string $url
 * @return string
 */
function normalize_import_remote_fetch_url($url)
{
  $normalized = trim(html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($normalized === '') {
    return '';
  }

  $scheme = strtolower((string) (parse_url($normalized, PHP_URL_SCHEME) ?? ''));
  $host = (string) (parse_url($normalized, PHP_URL_HOST) ?? '');

  if ($scheme !== 'http' && $scheme !== 'https') {
    debug_log('Unsupported WordPress media redirect protocol: ' . $normalized);
    return '';
  }

  if ($host === '') {
    return '';
  }

  return $normalized;
}

/**
 * @param string $ip
 * @return bool
 */
function import_remote_ip_is_public($ip)
{
  $ip = trim((string) $ip);
  $ip = trim($ip, '[]');

  if ($ip === '') {
    return false;
  }

  $packedIp = @inet_pton($ip);
  if ($packedIp === false) {
    return false;
  }

  // HTTP media origins must be unicast, not multicast destinations.
  if (strlen($packedIp) === 4 && (ord($packedIp[0]) & 0xf0) === 0xe0) {
    return false;
  }
  if (strlen($packedIp) === 16) {
    // Inspect embedded IPv4 bytes, including hexadecimal mapped-address aliases.
    $prefix = substr($packedIp, 0, 12);
    if (
      $prefix === str_repeat("\0", 10) . "\xff\xff" ||
      $prefix === hex2bin('0064ff9b0000000000000000')
    ) {
      $embeddedIp = inet_ntop(substr($packedIp, 12));
      return is_string($embeddedIp) && import_remote_ip_is_public($embeddedIp);
    }
    // Local-use translation, deprecated tunnels and IPv4-compatible addresses
    // are not ordinary globally routable media origins.
    if (
      $prefix === str_repeat("\0", 12) ||
      (ord($packedIp[0]) & 0xe0) !== 0x20 ||
      (substr($packedIp, 0, 2) === hex2bin('3fff') && (ord($packedIp[2]) & 0xf0) === 0) ||
      substr($packedIp, 0, 6) === hex2bin('0064ff9b0001') ||
      substr($packedIp, 0, 2) === hex2bin('2002') ||
      substr($packedIp, 0, 4) === hex2bin('20010000')
    ) {
      return false;
    }
  }

  // PHP 8.2+ excludes shared, documentation and benchmark ranges as well as LANs.
  return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE) !== false;
}

/**
 * @param string $host
 * @return array<int, string>
 */
function import_remote_resolve_public_ips($host)
{
  $host = strtolower(trim((string) $host));
  $host = trim($host, '[]');
  $host = rtrim($host, '.');

  if (
    $host === '' ||
    $host === 'localhost' ||
    $host === 'localhost.localdomain' ||
    substr($host, -10) === '.localhost'
  ) {
    return [];
  }

  if (filter_var($host, FILTER_VALIDATE_IP)) {
    return import_remote_ip_is_public($host) ? [$host] : [];
  }

  $ips = [];

  if (function_exists('dns_get_record')) {
    $records = @dns_get_record($host, DNS_A + DNS_AAAA);
    if (is_array($records)) {
      foreach ($records as $record) {
        if (!empty($record['ip'])) {
          $ips[] = $record['ip'];
        }
        if (!empty($record['ipv6'])) {
          $ips[] = $record['ipv6'];
        }
      }
    }
  }

  $ipv4s = @gethostbynamel($host);
  if (is_array($ipv4s)) {
    $ips = array_merge($ips, $ipv4s);
  }

  if (empty($ips)) {
    $resolved = @gethostbyname($host);
    if ($resolved !== $host) {
      $ips[] = $resolved;
    }
  }

  $ips = array_values(array_unique($ips));
  if (empty($ips)) {
    debug_log('Remote import host did not resolve: ' . $host);
    return [];
  }

  $publicIps = [];
  foreach ($ips as $ip) {
    if (!import_remote_ip_is_public($ip)) {
      debug_log(
        'Blocked SSRF attempt: host resolved to private/reserved IP ' . $host . ' -> ' . $ip,
      );
      return [];
    }
    $publicIps[] = $ip;
  }

  return array_values(array_unique($publicIps));
}

/**
 * @param string $host
 * @return bool
 */
function import_remote_host_resolves_publicly($host)
{
  return !empty(import_remote_resolve_public_ips($host));
}

/**
 * @param string $url
 * @return string
 */
function validate_import_remote_fetch_url($url)
{
  $normalized = normalize_import_remote_fetch_url($url);
  if ($normalized === '') {
    return '';
  }

  $host = (string) (parse_url($normalized, PHP_URL_HOST) ?? '');
  if (!import_remote_host_resolves_publicly($host)) {
    debug_log('Blocked SSRF attempt: private/reserved URL ' . $normalized);
    return '';
  }

  return $normalized;
}

/**
 * @param string $location
 * @param string $currentUrl
 * @return string
 */
function resolve_import_remote_redirect_url($location, $currentUrl)
{
  $location = trim(html_entity_decode((string) $location, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($location === '') {
    return '';
  }

  if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $location)) {
    return $location;
  }

  $parts = parse_url($currentUrl);
  if (empty($parts['scheme']) || empty($parts['host'])) {
    return '';
  }

  $scheme = strtolower((string) $parts['scheme']);
  if (strpos($location, '//') === 0) {
    return $scheme . ':' . $location;
  }

  $origin = $scheme . '://' . $parts['host'];
  if (!empty($parts['port'])) {
    $origin .= ':' . $parts['port'];
  }

  if (strpos($location, '/') === 0) {
    return $origin . $location;
  }

  $path = (string) ($parts['path'] ?? '/');
  $basePath = preg_replace('~/[^/]*$~', '/', $path);
  if ($basePath === null || $basePath === '') {
    $basePath = '/';
  }

  return $origin . $basePath . $location;
}

/**
 * @param int $httpCode
 * @return bool
 */
function import_remote_http_code_is_redirect($httpCode)
{
  return in_array((int) $httpCode, [301, 302, 303, 307, 308], true);
}

/**
 * @param string $url
 * @param string $tempPath
 * @return array{transport_failed?: bool, success?: bool, error?: string, http_code?: int, redirect?: bool, location?: string}
 */
function fetch_import_image_hop_with_curl($url, $tempPath)
{
  $handle = @fopen($tempPath, 'wb');
  if (!$handle) {
    return ['transport_failed' => true, 'error' => 'Unable to open temp media file'];
  }

  $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?? ''));
  $scheme = strtolower((string) (parse_url($url, PHP_URL_SCHEME) ?? ''));
  $port = (int) (parse_url($url, PHP_URL_PORT) ?: ($scheme === 'https' ? 443 : 80));
  $publicIps = import_remote_resolve_public_ips($host);
  if ($host === '' || empty($publicIps)) {
    fclose($handle);
    return ['transport_failed' => true, 'error' => 'Remote host did not resolve publicly'];
  }

  $ch = curl_init($url);
  if ($ch === false) {
    fclose($handle);
    return ['transport_failed' => true, 'error' => 'Unable to initialize cURL'];
  }

  $httpCode = 0;
  $redirectLocation = '';
  $currentStatus = 0;
  $downloadedBytes = 0;

  $options = [
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_USERAGENT => 'VonCMS WP Importer/1.25.2',
    CURLOPT_FAILONERROR => false,
    CURLOPT_HEADER => false,
    CURLOPT_FOLLOWLOCATION => false,
    /**
     * @param CurlHandle|resource $curlHandle
     * @param string $headerLine
     * @return int
     */
    CURLOPT_HEADERFUNCTION => function ($curlHandle, $headerLine) use (
      &$redirectLocation,
      &$currentStatus,
    ) {
      $trimmed = trim($headerLine);
      if (preg_match('~^HTTP/\S+\s+(\d{3})~i', $trimmed, $matches)) {
        $currentStatus = (int) $matches[1];
        $redirectLocation = '';
      } elseif (stripos($trimmed, 'Location:') === 0) {
        $redirectLocation = trim(substr($trimmed, 9));
      }

      return strlen($headerLine);
    },
    /**
     * @param CurlHandle|resource $curlHandle
     * @param string $data
     * @return int
     */
    CURLOPT_WRITEFUNCTION => function ($curlHandle, $data) use (
      $handle,
      &$currentStatus,
      &$downloadedBytes,
    ) {
      if ($currentStatus >= 300 && $currentStatus < 400) {
        return strlen($data);
      }

      $chunkLength = strlen($data);
      if ($downloadedBytes + $chunkLength > VONCMS_WP_IMPORT_MAX_IMAGE_BYTES) {
        return 0;
      }

      $written = fwrite($handle, $data);
      if ($written !== false) {
        $downloadedBytes += $written;
      }
      return $written === false ? 0 : $written;
    },
  ];

  if (defined('CURLOPT_RESOLVE')) {
    $options[CURLOPT_RESOLVE] = [$host . ':' . $port . ':' . $publicIps[0]];
  }

  if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
    $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
  }

  if (
    defined('CURLOPT_REDIR_PROTOCOLS') &&
    defined('CURLPROTO_HTTP') &&
    defined('CURLPROTO_HTTPS')
  ) {
    $options[CURLOPT_REDIR_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
  }

  curl_setopt_array($ch, $options);

  $exec = curl_exec($ch);
  $httpCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $redirectInfo = defined('CURLINFO_REDIRECT_URL') ? curl_getinfo($ch, CURLINFO_REDIRECT_URL) : '';
  if ($redirectLocation === '' && is_string($redirectInfo)) {
    $redirectLocation = $redirectInfo;
  }
  $curlError = curl_error($ch);

  $ch = null;
  fclose($handle);

  if ($exec !== false && $httpCode >= 200 && $httpCode < 300) {
    return ['success' => true, 'http_code' => $httpCode];
  }

  if ($exec !== false && import_remote_http_code_is_redirect($httpCode)) {
    return ['redirect' => true, 'location' => $redirectLocation, 'http_code' => $httpCode];
  }

  return [
    'success' => false,
    'http_code' => $httpCode,
    'error' => $curlError !== '' ? $curlError : 'HTTP ' . $httpCode,
  ];
}

/**
 * @param string $url
 * @param string $tempPath
 * @return bool
 */
function fetch_import_image_url_with_redirect_validation($url, $tempPath)
{
  $currentUrl = validate_import_remote_fetch_url($url);
  if ($currentUrl === '') {
    return false;
  }

  if (!function_exists('curl_init')) {
    debug_log('WordPress media import skipped: cURL is required for DNS-pinned remote fetch.');
    return false;
  }

  $maxRedirects = 5;

  for ($redirects = 0; $redirects <= $maxRedirects; $redirects++) {
    $hop = fetch_import_image_hop_with_curl($currentUrl, $tempPath);

    if (!empty($hop['success'])) {
      return true;
    }

    if (!empty($hop['redirect'])) {
      if ($redirects >= $maxRedirects) {
        debug_log('Maximum WordPress media redirect depth exceeded for: ' . $url);
        return false;
      }

      $nextUrl = resolve_import_remote_redirect_url($hop['location'] ?? '', $currentUrl);
      $currentUrl = validate_import_remote_fetch_url($nextUrl);
      if ($currentUrl === '') {
        return false;
      }

      @file_put_contents($tempPath, '');
      continue;
    }

    debug_log(
      'Media download failed for ' . $currentUrl . ': ' . ($hop['error'] ?? 'unknown error'),
    );
    return false;
  }

  debug_log('Maximum WordPress media redirect depth exceeded for: ' . $url);
  return false;
}

/**
 * @param string $url
 * @return string|null
 */
function fetch_remote_import_image_to_temp($url)
{
  $safeUrl = validate_import_remote_fetch_url($url);
  if ($safeUrl === '') {
    return null;
  }

  $tempPath = tempnam(sys_get_temp_dir(), 'vonwp_');
  if ($tempPath === false) {
    return null;
  }

  if (!fetch_import_image_url_with_redirect_validation($safeUrl, $tempPath)) {
    @unlink($tempPath);
    return null;
  }

  return $tempPath;
}

/**
 * @param string $url
 * @param array<int, string> $sourceBaseUrls
 * @param string $targetSiteUrl
 * @param PDO $conn
 * @param int $uploadedBy
 * @return string|null
 */
function rehost_import_image_url($url, $sourceBaseUrls, $targetSiteUrl, $conn, $uploadedBy)
{
  /** @var array<string, array{url: string, physical_path: string}> $cache */
  static $cache = [];

  $absoluteUrl = absolutize_import_media_url($url, $sourceBaseUrls);
  if (!should_rehost_import_image($absoluteUrl, $sourceBaseUrls, $targetSiteUrl)) {
    return null;
  }

  if (isset($cache[$absoluteUrl])) {
    // An earlier item in this batch may have rolled back and deleted this image.
    if (is_file($cache[$absoluteUrl]['physical_path'])) {
      return $cache[$absoluteUrl]['url'];
    }
    unset($cache[$absoluteUrl]);
  }

  $uploadContext = get_import_upload_context($targetSiteUrl);
  if (!$uploadContext) {
    return null;
  }

  $tempPath = fetch_remote_import_image_to_temp($absoluteUrl);
  if ($tempPath === null) {
    return null;
  }

  $size = @filesize($tempPath);
  if ($size === false || $size <= 0 || $size > VONCMS_WP_IMPORT_MAX_IMAGE_BYTES) {
    debug_log('Media localizer skipped unsupported file size for: ' . $absoluteUrl);
    @unlink($tempPath);
    return null;
  }

  $imageInfo = @getimagesize($tempPath);
  $mimeType = is_array($imageInfo) ? $imageInfo['mime'] : '';
  $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (!in_array($mimeType, $allowedMimes, true)) {
    debug_log('Media localizer skipped unsupported mime type for: ' . $absoluteUrl);
    @unlink($tempPath);
    return null;
  }

  $extension = get_import_image_extension($absoluteUrl, $mimeType);
  if ($extension === '') {
    @unlink($tempPath);
    return null;
  }

  $safeName = sanitize_import_media_name($absoluteUrl);
  $filename = $safeName . '_' . substr(hash('sha256', $absoluteUrl), 0, 16) . '.' . $extension;
  $targetPath = $uploadContext['absolute_dir'] . $filename;

  if (is_file($targetPath)) {
    @unlink($tempPath);
    $relativePath = $uploadContext['relative_dir'] . $filename;
    register_imported_media($conn, $relativePath, $mimeType, $size, $uploadedBy, $filename);
    $localUrl = $uploadContext['url_prefix'] . $filename;
    $cache[$absoluteUrl] = ['url' => $localUrl, 'physical_path' => $targetPath];
    return $localUrl;
  }

  if (!@rename($tempPath, $targetPath)) {
    if (!@copy($tempPath, $targetPath)) {
      if (is_file($targetPath)) {
        @unlink(__DIR__ . '/../../data/storage_usage.json');
      }
      debug_log('Media localizer failed to move downloaded image for: ' . $absoluteUrl);
      @unlink($tempPath);
      return null;
    }
    @unlink($tempPath);
  }

  // Attachment-only batches also change disk usage, even when no article is inserted.
  @unlink(__DIR__ . '/../../data/storage_usage.json');

  // Ensure uploaded media is world-readable (Apache needs 0644, not 0600 from restrictive umask)
  @chmod($targetPath, 0644);

  $relativePath = $uploadContext['relative_dir'] . $filename;
  register_imported_media($conn, $relativePath, $mimeType, $size, $uploadedBy, $filename);

  if (!is_array($GLOBALS['voncms_wp_import_created_media'] ?? null)) {
    $GLOBALS['voncms_wp_import_created_media'] = [];
  }
  $GLOBALS['voncms_wp_import_created_media'][] = [
    'physical_path' => $targetPath,
    'stored_path' => 'uploads/' . ltrim(str_replace('\\', '/', $relativePath), '/'),
  ];

  $localUrl = $uploadContext['url_prefix'] . $filename;
  $cache[$absoluteUrl] = ['url' => $localUrl, 'physical_path' => $targetPath];

  return $localUrl;
}

/**
 * @param DOMNode $node
 * @return string
 */
function get_dom_inner_html($node)
{
  $document = $node->ownerDocument;
  if (!($document instanceof DOMDocument)) {
    throw new RuntimeException('Imported HTML has no owner document.');
  }
  $html = '';
  foreach ($node->childNodes as $childNode) {
    $html .= $document->saveHTML($childNode);
  }

  return $html;
}

/**
 * @param string $html
 * @param array<int, string> $sourceBaseUrls
 * @param string $targetSiteUrl
 * @param PDO $conn
 * @param int $uploadedBy
 * @return array{html: string, localized: int}
 */
function localize_imported_media_references(
  $html,
  $sourceBaseUrls,
  $targetSiteUrl,
  $conn,
  $uploadedBy,
) {
  $html = (string) $html;
  if ($html === '' || !class_exists('DOMDocument')) {
    return ['html' => $html, 'localized' => 0];
  }

  $dom = new DOMDocument('1.0', 'UTF-8');
  $wrapperId = 'voncms-import-root';
  $markup =
    '<!DOCTYPE html><html><body><div id="' . $wrapperId . '">' . $html . '</div></body></html>';

  if (
    !@$dom->loadHTML(
      '<?xml encoding="UTF-8" ?>' . $markup,
      LIBXML_HTML_NODEFDTD | LIBXML_HTML_NOIMPLIED,
    )
  ) {
    libxml_clear_errors();
    return ['html' => $html, 'localized' => 0];
  }

  $root = null;
  foreach ($dom->getElementsByTagName('div') as $div) {
    if (!($div instanceof DOMElement)) {
      continue;
    }

    if ($div->getAttribute('id') === $wrapperId) {
      $root = $div;
      break;
    }
  }

  if (!$root) {
    libxml_clear_errors();
    return ['html' => $html, 'localized' => 0];
  }

  $localized = 0;

  /** @var array<string, string> $replacements */
  $replacements = [];

  foreach ($root->getElementsByTagName('img') as $img) {
    if (!($img instanceof DOMElement)) {
      continue;
    }

    $sourceValue = '';
    foreach (['src', 'data-src', 'data-lazy-src'] as $attr) {
      if ($img->hasAttribute($attr) && trim($img->getAttribute($attr)) !== '') {
        $sourceValue = $img->getAttribute($attr);
        break;
      }
    }

    if ($sourceValue === '') {
      continue;
    }

    $localUrl = rehost_import_image_url(
      $sourceValue,
      $sourceBaseUrls,
      $targetSiteUrl,
      $conn,
      $uploadedBy,
    );
    if ($localUrl === null) {
      continue;
    }

    $absoluteSource = absolutize_import_media_url($sourceValue, $sourceBaseUrls);
    if ($absoluteSource !== '') {
      $replacements[$absoluteSource] = $localUrl;
    }

    foreach (['src', 'data-src', 'data-lazy-src'] as $attr) {
      if ($img->hasAttribute($attr)) {
        $img->setAttribute($attr, $localUrl);
      }
    }

    foreach (['srcset', 'data-srcset', 'data-lazy-srcset', 'sizes'] as $attr) {
      if ($img->hasAttribute($attr)) {
        $img->removeAttribute($attr);
      }
    }

    $localized++;
  }

  foreach ($root->getElementsByTagName('a') as $anchor) {
    if (!($anchor instanceof DOMElement)) {
      continue;
    }

    $href = $anchor->getAttribute('href');
    $absoluteHref = absolutize_import_media_url($href, $sourceBaseUrls);
    if ($absoluteHref !== '' && isset($replacements[$absoluteHref])) {
      $anchor->setAttribute('href', $replacements[$absoluteHref]);
    }
  }

  $updatedHtml = get_dom_inner_html($root);
  libxml_clear_errors();

  return ['html' => $updatedHtml, 'localized' => $localized];
}

/**
 * @param PDO $conn
 * @return string
 */
function get_target_site_url($conn)
{
  try {
    $stmt = $conn->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'domain_url' LIMIT 1",
    );
    $stmt->execute();
    $row = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));
    $configured = normalize_import_url((string) ($row['setting_value'] ?? ''));
    if ($configured !== '') {
      return $configured;
    }
  } catch (Throwable $e) {
    debug_log('Target URL lookup failed: ' . $e->getMessage());
  }

  $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', DataBoundary::serverString('HTTP_HOST', ''));
  if ($host === '') {
    return '';
  }

  $scriptName = str_replace('\\', '/', DataBoundary::serverString('SCRIPT_NAME', ''));
  $basePath = trim(dirname(dirname(dirname($scriptName))), '/.');
  $protocol = is_https() ? 'https://' : 'http://';

  return rtrim($protocol . $host . ($basePath !== '' ? '/' . $basePath : ''), '/');
}

/**
 * @param PDO $conn
 * @return string
 */
function get_permalink_structure($conn)
{
  try {
    $stmt = $conn->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'permalink_structure' LIMIT 1",
    );
    $stmt->execute();
    $row = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));
    $value = (string) ($row['setting_value'] ?? '');
    return $value !== '' ? $value : 'slug';
  } catch (Throwable $e) {
    debug_log('Permalink lookup failed: ' . $e->getMessage());
    return 'slug';
  }
}

/**
 * @param string $postType
 * @param int|string $postId
 * @param string $slug
 * @param string $date
 * @param string $category
 * @param string $permalinkStructure
 * @return string
 */
function build_import_target_path($postType, $postId, $slug, $date, $category, $permalinkStructure)
{
  return buildCanonicalContentPath(
    [
      'id' => $postId,
      'slug' => trim((string) $slug, '/'),
      'created_at' => $date,
      'category' => $category,
    ],
    $permalinkStructure,
    $postType,
  );
}

/** Match an actual source authority, not a host/path prefix lookalike.
 * @param array<int,string> $bases
 * @return array{key: string, path: string, query: string, fragment: string, url: string}|null
 */
function voncms_wp_source_link(string $url, array $bases, string $currentUrl = ''): ?array
{
  $url = trim(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($url === '' || $url[0] === '#' || preg_match('/[\x00-\x20\\\\]/', $url)) {
    return null;
  }
  $base = $currentUrl !== '' ? $currentUrl : (string) ($bases[0] ?? '');
  $baseParts = parse_url($base);
  if (str_starts_with($url, '//')) {
    $url = ($baseParts['scheme'] ?? 'https') . ':' . $url;
  } elseif (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $url)) {
    if (empty($baseParts['host'])) {
      return null;
    }
    $origin =
      ($baseParts['scheme'] ?? 'https') .
      '://' .
      $baseParts['host'] .
      (isset($baseParts['port']) ? ':' . $baseParts['port'] : '');
    $path = (string) ($baseParts['path'] ?? '/');
    $url =
      $origin .
      ($url[0] === '/'
        ? $url
        : ($url[0] === '?'
          ? $path . $url
          : preg_replace('~/[^/]*$~', '/', $path) . $url));
  }
  $parts = parse_url($url);
  if (
    !is_array($parts) ||
    !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) ||
    isset($parts['user']) ||
    isset($parts['pass']) ||
    empty($parts['host'])
  ) {
    return null;
  }
  $authority =
    strtolower(rtrim((string) ($parts['host'] ?? ''), '.')) .
    ':' .
    (int) ($parts['port'] ?? (($parts['scheme'] ?? '') === 'http' ? 80 : 443));
  $trusted = false;
  foreach ($bases as $candidate) {
    $candidateParts = parse_url($candidate);
    $candidateAuthority =
      strtolower(rtrim((string) ($candidateParts['host'] ?? ''), '.')) .
      ':' .
      (int) ($candidateParts['port'] ?? (($candidateParts['scheme'] ?? '') === 'http' ? 80 : 443));
    if ($authority === $candidateAuthority) {
      $trusted = true;
      break;
    }
  }
  if (!$trusted) {
    return null;
  }
  $segments = [];
  foreach (explode('/', (string) ($parts['path'] ?? '/')) as $segment) {
    if ($segment === '..') {
      array_pop($segments);
    } elseif ($segment !== '' && $segment !== '.') {
      $segments[] = $segment;
    }
  }
  $path = '/' . implode('/', $segments);
  $query = isset($parts['query']) && $parts['query'] !== '' ? '?' . $parts['query'] : '';
  $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
  $absolute =
    ($parts['scheme'] ?? 'https') .
    '://' .
    $parts['host'] .
    (isset($parts['port']) ? ':' . $parts['port'] : '') .
    $path .
    $query .
    $fragment;
  return [
    'key' => $authority . $path . $query,
    'path' => $path,
    'query' => $query,
    'fragment' => $fragment,
    'url' => $absolute,
  ];
}

/** Keep supported metadata in the editor's existing columns, with explicit cap warnings.
 * @param list<string> $warnings
 * @return array{excerpt: string, meta_description: string, keywords: string}
 */
function voncms_wp_import_metadata(
  SimpleXMLElement $item,
  ?SimpleXMLElement $wp,
  array &$warnings,
): array {
  $excerpt = (string) ($item->excerpt ?? '');
  foreach ($item->getNamespaces(true) as $namespace) {
    if (preg_match('~^https?://wordpress\.org/export/1\.[012]/excerpt/$~', $namespace)) {
      $excerpt = (string) $item->children($namespace)->encoded;
      break;
    }
  }
  $description = '';
  $tags = [];
  foreach ($item->category as $category) {
    if ((string) $category['domain'] === 'post_tag') {
      $tag = trim((string) $category);
      if ($tag !== '') {
        $tags[$tag] = $tag;
      }
    }
  }
  if ($wp !== null) {
    foreach ($wp->postmeta as $meta) {
      if (
        in_array(
          (string) $meta->meta_key,
          ['_yoast_wpseo_metadesc', 'rank_math_description'],
          true,
        ) &&
        $description === ''
      ) {
        $description = (string) $meta->meta_value;
      }
    }
  }
  $values = [
    'excerpt' => $excerpt,
    'meta_description' => $description,
    'keywords' => implode(', ', $tags),
  ];
  foreach (['excerpt' => 220, 'meta_description' => 5000, 'keywords' => 255] as $key => $limit) {
    $plain = voncms_clean_seo_description($values[$key], max(5000, mb_strlen($values[$key])), true);
    if (mb_strlen($plain) > $limit) {
      $warnings[] =
        ucfirst(str_replace('_', ' ', $key)) .
        ' shortened to the editor limit (' .
        $limit .
        ' characters): ' .
        (string) $item->title;
      $plain = voncms_truncate_word_safe($plain, $limit, '');
    }
    $values[$key] = $plain;
  }
  return $values;
}

/**
 * @param string $url
 * @return string|null
 */
function build_embed_html_from_url($url)
{
  $normalizedUrl = trim(html_entity_decode((string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($normalizedUrl === '') {
    return null;
  }

  $portraitStyle =
    'width:100%; max-width:380px; aspect-ratio: 9 / 16; height:auto; border:none; overflow:hidden;';

  if (preg_match('/youtube\.com\/shorts\/([^"&?\/\s]{11})/i', $normalizedUrl, $ytShortsMatch)) {
    return '<div style="max-width: 380px; margin-left: auto; margin-right: auto;"><iframe width="100%" height="676" src="https://www.youtube.com/embed/' .
      htmlspecialchars($ytShortsMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') .
      '?playsinline=1&amp;von_vertical=shorts" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="' .
      $portraitStyle .
      '" title="YouTube Shorts embed"></iframe></div>';
  }

  if (
    preg_match(
      '/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i',
      $normalizedUrl,
      $ytMatch,
    )
  ) {
    return '<iframe width="100%" height="400" src="https://www.youtube.com/embed/' .
      htmlspecialchars($ytMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') .
      '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="rounded-lg shadow-lg"></iframe>';
  }

  if (
    preg_match('/tiktok\.com\/(?:@[^\/]+\/video\/|player\/v1\/)(\d+)/i', $normalizedUrl, $ttMatch)
  ) {
    return '<div style="max-width: 380px; margin-left: auto; margin-right: auto;"><iframe width="100%" height="676" src="https://www.tiktok.com/player/v1/' .
      htmlspecialchars($ttMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') .
      '" frameborder="0" scrolling="no" allowfullscreen title="TikTok video embed" style="' .
      $portraitStyle .
      '" class="rounded-lg shadow-lg"></iframe></div>';
  }

  if (preg_match('/instagram\.com\/(?:reel|reels)\/([a-zA-Z0-9_-]+)/i', $normalizedUrl, $igMatch)) {
    return '<div style="max-width: 380px; margin-left: auto; margin-right: auto;"><iframe width="100%" height="676" src="https://www.instagram.com/reel/' .
      htmlspecialchars($igMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') .
      '/embed" frameborder="0" scrolling="no" allowfullscreen title="Instagram Reel embed" style="' .
      $portraitStyle .
      '"></iframe></div>';
  }

  if (preg_match('/(?:vimeo\.com\/(?:video\/)?)(\d+)/i', $normalizedUrl, $vimeoMatch)) {
    return '<iframe width="100%" height="400" src="https://player.vimeo.com/video/' .
      htmlspecialchars($vimeoMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') .
      '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="rounded-lg shadow-lg"></iframe>';
  }

  if (
    stripos($normalizedUrl, 'facebook.com') !== false ||
    stripos($normalizedUrl, 'fb.watch') !== false
  ) {
    $isFacebookReel = preg_match('/facebook\.com\/(?:reel|reels)\//i', $normalizedUrl) === 1;
    return '<iframe src="https://www.facebook.com/plugins/video.php?href=' .
      rawurlencode($normalizedUrl) .
      '&show_text=false&width=' .
      ($isFacebookReel ? '380' : '560') .
      '" width="100%" height="' .
      ($isFacebookReel ? '676' : '400') .
      '" style="' .
      ($isFacebookReel ? $portraitStyle : 'border:none;overflow:hidden') .
      '" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true" class="rounded-lg shadow-lg"></iframe>';
  }

  return null;
}

/**
 * @param string $html
 * @return string
 */
function convert_supported_embeds($html)
{
  $patterns = [
    '/<figure\b[^>]*wp-block-embed[^>]*>[\s\S]*?<div\b[^>]*wp-block-embed__wrapper[^>]*>\s*(?<url>https?:\/\/[^<\s]+)\s*<\/div>[\s\S]*?<\/figure>/i',
    '/<div\b[^>]*wp-block-embed__wrapper[^>]*>\s*(?<url>https?:\/\/[^<\s]+)\s*<\/div>/i',
    '/<p>\s*(?<url>https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|vimeo\.com)[^<\s]*)\s*<\/p>/i',
    '/<p>\s*<a\b[^>]*href=(["\'])(?<href>https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|vimeo\.com)[^"\']*)\1[^>]*>.*?<\/a>\s*<\/p>/is',
  ];

  foreach ($patterns as $pattern) {
    $html =
      preg_replace_callback(
        $pattern,
        /**
         * @param array<string|int, string> $matches
         * @return string
         */
        function ($matches) {
          $rawUrl = $matches['href'] ?? $matches['url'];
          $embedHtml = build_embed_html_from_url($rawUrl);
          return $embedHtml ?: $matches[0];
        },
        $html,
      ) ?? $html;
  }

  return $html;
}

/**
 * @param string $html
 * @return string
 */
function strip_gutenberg_comments($html)
{
  return preg_replace('/<!--\s*\/?wp:[\s\S]*?-->/i', '', $html) ?? $html;
}

/**
 * @param string $href
 * @return bool
 */
function should_remap_internal_href($href)
{
  $path = (string) (parse_url($href, PHP_URL_PATH) ?? '');
  if ($path === '') {
    return true;
  }

  if (preg_match('~/(wp-admin|wp-content|wp-includes)(/|$)~i', $path)) {
    return false;
  }

  if (
    preg_match(
      '/\.(?:jpe?g|png|gif|webp|svg|pdf|zip|rar|docx?|xlsx?|pptx?|mp3|mp4|avi|mov|webm)$/i',
      $path,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * @param string $html
 * @param array<int, string> $sourceBaseUrls
 * @param string $targetBaseUrl
 * @return string
 */
function remap_internal_links($html, $sourceBaseUrls, $targetBaseUrl)
{
  if (empty($sourceBaseUrls) || empty($targetBaseUrl)) {
    return $html;
  }

  return preg_replace_callback(
    '/<a\b([^>]*?)href=(["\'])(?<href>[^"\']+)\2([^>]*)>/i',
    /**
     * @param array<string|int, string> $matches
     * @return string
     */
    function ($matches) use ($sourceBaseUrls) {
      $href = html_entity_decode($matches['href'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
      if (!should_remap_internal_href($href)) {
        return $matches[0];
      }

      $source = voncms_wp_source_link(
        $href,
        $sourceBaseUrls,
        is_string($GLOBALS['voncms_wp_import_current_url'] ?? null)
          ? $GLOBALS['voncms_wp_import_current_url']
          : '',
      );
      $rawMap = $GLOBALS['voncms_wp_import_link_map'] ?? [];
      $map = is_array($rawMap) ? array_filter($rawMap, 'is_string') : [];
      $newHref = $source !== null ? $map[$source['key']] ?? null : null;
      if ($source !== null && $map === [] && !empty($GLOBALS['voncms_wp_import_current_url'])) {
        // Preserve legitimate query/directory-relative links through the existing URL sanitizer.
        return str_replace(
          $matches['href'],
          htmlspecialchars($source['url'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
          $matches[0],
        );
      }
      if ($source !== null && $newHref === null && $source['query'] !== '') {
        $keyWithoutQuery = substr($source['key'], 0, -strlen($source['query']));
        if (isset($map[$keyWithoutQuery])) {
          $newHref = $map[$keyWithoutQuery] . $source['query'];
        }
      }
      if ($source !== null && $newHref !== null) {
        return str_replace(
          $matches['href'],
          htmlspecialchars($newHref . $source['fragment'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
          $matches[0],
        );
      }

      return $matches[0];
    },
    $html,
  ) ?? $html;
}

/** Strip active imported HTML before storage; public rendering retains its own safeguards. */
function sanitize_imported_content_html(string $html): string
{
  return voncms_sanitize_content_attributes($html, true);
}

/**
 * Normalize both post/page imports before their prepared INSERT statements.
 * @param string $html
 * @param array<int, string> $sourceBaseUrls
 * @param string $targetBaseUrl
 * @return string
 */
function normalize_imported_content($html, $sourceBaseUrls, $targetBaseUrl)
{
  $cleaned = convert_supported_embeds((string) $html);
  $cleaned = strip_gutenberg_comments($cleaned);
  $cleaned = remap_internal_links($cleaned, $sourceBaseUrls, $targetBaseUrl);
  $cleaned = preg_replace('/<p>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/i', '', $cleaned) ?? $cleaned;
  $cleaned = preg_replace('/\n{3,}/', "\n\n", $cleaned) ?? $cleaned;

  return trim(sanitize_imported_content_html(voncms_sanitize_content_iframes((string) $cleaned)));
}

/** An automatic migration redirect must not replace a destination site's existing route.
 * @param array{type: string, id: string} $record
 */
function voncms_wp_redirect_path_reserved(
  PDO $conn,
  string $path,
  string $style,
  array $record,
): bool {
  if ($path === '/' || voncms_is_private_spa_shell_route($path)) {
    return true;
  }
  $slug = rawurldecode(basename($path));
  if (substr_count(trim($path, '/'), '/') === 0) {
    $page = $conn->prepare('SELECT id FROM pages WHERE slug = ? LIMIT 1');
    $page->execute([$slug]);
    $id = $page->fetchColumn();
    if ($id !== false && !($record['type'] === 'page' && (string) $id === (string) $record['id'])) {
      return true;
    }
  }
  $idHint = preg_match('~^/post/([0-9]+)$~', $path, $match) === 1 ? ltrim($match[1], '0') : '';
  $posts = $conn->prepare(
    'SELECT id, slug, category, created_at FROM posts WHERE slug = ? OR id = ? LIMIT 2',
  );
  $posts->execute([$slug, $idHint !== '' ? $idHint : '0']);
  foreach (DataBoundary::rows($posts->fetchAll(PDO::FETCH_ASSOC)) as $post) {
    if ($record['type'] === 'post' && (string) $post['id'] === (string) $record['id']) {
      continue;
    }
    if (
      ($idHint !== '' && (string) $post['id'] === $idHint) ||
      buildCanonicalContentPath($post, $style, 'post') === $path
    ) {
      return true;
    }
  }
  return false;
}

/** Resolve forward links only after all destinations (including numeric IDs) are known.
 * @param array{records: array<array-key,array{type: string, id: string, slug: string, source: string, path: string, hash: string, created: bool, public: bool}>, links_offset: int, permalinks: string, offset: int, imported: int, skipped: int, warning_count: int, ...} $state
 * @param array<int,string> $bases
 * @param list<string> $warnings
 */
function voncms_wp_finalize_links(
  PDO $conn,
  array &$state,
  array $bases,
  string $target,
  int $limit,
  array &$warnings,
): bool {
  $records = array_values($state['records']);
  $map = [];
  $targetPaths = [];
  foreach ($records as $record) {
    $link = voncms_wp_source_link($record['source'], $bases);
    if ($link !== null) {
      $map[$link['key']] = rtrim($target, '/') . $record['path'];
    }
    $targetPaths[$record['path']] = true;
  }
  $GLOBALS['voncms_wp_import_link_map'] = $map;
  $end = min(count($records), $state['links_offset'] + $limit);
  for ($index = $state['links_offset']; $index < $end; $index++) {
    $record = $records[$index];
    if (!$record['created']) {
      $state['links_offset'] = $index + 1;
      continue;
    }
    $table = $record['type'] === 'post' ? 'posts' : 'pages';
    $conn->beginTransaction();
    try {
      $lockSql = $conn->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ' FOR UPDATE';
      $read = $conn->prepare("SELECT slug, content FROM $table WHERE id = ?" . $lockSql);
      $read->execute([$record['id']]);
      $row = DataBoundary::row($read->fetch(PDO::FETCH_ASSOC));
      if (
        !$row ||
        $row['slug'] !== $record['slug'] ||
        !hash_equals($record['hash'], hash('sha256', (string) $row['content']))
      ) {
        $warnings[] =
          'Link update skipped because the imported item changed or was removed: ' .
          $record['slug'];
      } else {
        $GLOBALS['voncms_wp_import_current_url'] = $record['source'];
        $updated = remap_internal_links((string) $row['content'], $bases, $target);
        if ($updated !== $row['content']) {
          $write = $conn->prepare(
            "UPDATE $table SET content = ?, updated_at = updated_at WHERE id = ?",
          );
          $write->execute([$updated, $record['id']]);
        }
      }
      $conn->commit();
    } catch (Throwable $error) {
      if ($conn->inTransaction()) {
        $conn->rollBack();
      }
      throw $error;
    }
    $source = voncms_wp_source_link($record['source'], $bases);
    if ($record['public'] && $source !== null) {
      $basePath = (string) (parse_url($target, PHP_URL_PATH) ?? '/');
      $oldPath = voncms_normalize_public_redirect_path($source['path'], $basePath);
      $destination = $record['path'];
      if ($source['query'] !== '') {
        $warnings[] =
          'Query-based source URL was mapped in article links but needs a server-level redirect for external visitors: ' .
          $record['slug'];
      } elseif ($oldPath !== $destination && !voncms_is_public_redirect_ignored_path($oldPath)) {
        if (
          isset($targetPaths[$oldPath]) ||
          voncms_wp_redirect_path_reserved($conn, $oldPath, $state['permalinks'], $record)
        ) {
          $warnings[] =
            'Redirect skipped because its old path belongs to an existing route: ' .
            $record['slug'];
        } else {
          try {
            $lookup = $conn->prepare(
              'SELECT target_url FROM redirects WHERE source_url = ? LIMIT 1',
            );
            $lookup->execute([$oldPath]);
            $existing = $lookup->fetchColumn();
            $browserTarget = rtrim($basePath, '/') . $destination;
            if ($existing === false) {
              $conflict = voncms_store_permalink_redirect($conn, [
                'source' => $oldPath,
                'target' => $browserTarget,
                'targetSource' => $destination,
              ]);
              if ($conflict !== null) {
                $warnings[] = 'Redirect conflict left unchanged: ' . $record['slug'];
              }
            } elseif ($existing !== $browserTarget) {
              $warnings[] = 'Existing redirect left unchanged: ' . $record['slug'];
            }
          } catch (Throwable $error) {
            throw new RuntimeException(
              'Unable to save imported redirects. Resume after checking database availability.',
              0,
              $error,
            );
          }
        }
      }
    }
    $state['links_offset'] = $index + 1;
  }
  unset($GLOBALS['voncms_wp_import_current_url'], $GLOBALS['voncms_wp_import_link_map']);
  return $state['links_offset'] >= count($records);
}

debug_log('Import script started');

$configPath = __DIR__ . '/../../von_config.php';
if (!file_exists($configPath)) {
  ResponseHelper::sendError('Server Config Error: Config file not found', 500);
}

require_once $configPath;
// SECURITY: Require Admin Session
SessionManager::requireValidSession();
SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

$importUserId = (int) DataBoundary::userText('id');
$importUsername = trim(DataBoundary::userText('username')) ?: 'Admin';
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

function rollback_imported_media_since(PDO $conn, int $checkpoint): void
{
  $createdMedia = $GLOBALS['voncms_wp_import_created_media'] ?? [];
  if (!is_array($createdMedia) || $checkpoint < 0 || $checkpoint >= count($createdMedia)) {
    return;
  }

  $rollbackItems = array_slice($createdMedia, $checkpoint);
  foreach (array_reverse($rollbackItems) as $item) {
    if (!is_array($item)) {
      throw new RuntimeException('Invalid import media rollback record.');
    }
    $physicalPath = is_string($item['physical_path'] ?? null) ? $item['physical_path'] : '';
    $storedPath = is_string($item['stored_path'] ?? null) ? $item['stored_path'] : '';
    if ($physicalPath !== '' && @unlink($physicalPath)) {
      @unlink(__DIR__ . '/../../data/storage_usage.json');
    }
    if ($storedPath !== '' && import_media_table_exists($conn)) {
      try {
        $deleteStmt = $conn->prepare('DELETE FROM media WHERE filepath = ?');
        $deleteStmt->execute([$storedPath]);
      } catch (Throwable $error) {
        debug_log('Media rollback row cleanup skipped: ' . $error->getMessage());
      }
    }
  }

  $GLOBALS['voncms_wp_import_created_media'] = array_slice($createdMedia, 0, $checkpoint);
}
$filename = is_string($input['temp_file'] ?? null) ? trim($input['temp_file']) : '';
$batchIndex = filter_var($input['batch_index'] ?? 0, FILTER_VALIDATE_INT);
$limit = filter_var($input['limit'] ?? 10, FILTER_VALIDATE_INT);
$batchIndex = $batchIndex === false ? -1 : $batchIndex;
$limit = $limit === false ? 0 : $limit;
$sourceSiteUrl = normalize_import_url(DataBoundary::inputText($input['source_site_url'] ?? ''));
$sourceBlogUrl = normalize_import_url(DataBoundary::inputText($input['source_blog_url'] ?? ''));

if (!preg_match('/\Awp_import_[a-f0-9]{32}\.xml\z/', $filename)) {
  ResponseHelper::sendError('Invalid temporary import filename', 400);
}

if ($batchIndex < 0 || $batchIndex > 100000 || $limit < 1 || $limit > 50) {
  ResponseHelper::sendError('Invalid import batch parameters', 400);
}

$filePath = __DIR__ . '/../../uploads/temp/' . $filename;
if (!file_exists($filePath)) {
  ResponseHelper::sendError('Temp file not found', 404);
}

$xmlSize = @filesize($filePath);
if ($xmlSize === false || $xmlSize <= 0 || $xmlSize > VONCMS_WP_IMPORT_MAX_XML_BYTES) {
  @unlink($filePath);
  ResponseHelper::sendError('WordPress XML file exceeds the 64MB import limit', 400);
}

// Security: Validate File Extension
$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
if (strtolower($ext) !== 'xml') {
  ResponseHelper::sendError('Invalid file type. Only XML allowed.', 400);
}

// Helper to get DB connection from global scope (since von_config.php creates $pdo)
/**
 * @return PDO|null
 */
function get_db_connection()
{
  global $pdo;
  if (isset($pdo)) {
    return $pdo;
  }
  return null;
}

$conn = get_db_connection();
if (!$conn) {
  ResponseHelper::sendError('DB Connection Failed', 500);
}
debug_log('DB Connected');

$sourceBaseUrls = collect_source_base_urls($sourceSiteUrl, $sourceBlogUrl);
$targetSiteUrl = get_target_site_url($conn);
$permalinkStructure = get_permalink_structure($conn);

$processed = 0;
$imported = 0;
$skipped = 0;
$localizedMedia = 0;
$errors = [];
$warnings = [];
$batchFailed = false;
$importLock = null;
$reader = null;
$statePath = $filePath . '.state.json';
$GLOBALS['voncms_wp_import_created_media'] = [];

try {
  $importLock = @fopen($filePath . '.lock', 'c+');
  if ($importLock === false || !flock($importLock, LOCK_EX | LOCK_NB)) {
    throw new RuntimeException('This import is already running. Please try again.', 409);
  }
  $fingerprint = hash_file('sha256', $filePath);
  if (is_file($statePath)) {
    if (filesize($statePath) > 16 * 1024 * 1024) {
      throw new RuntimeException(
        'Import checkpoint exceeds its size limit. Rescan a smaller export.',
      );
    }
    $state = voncms_wp_validate_import_state(
      json_decode((string) file_get_contents($statePath), true, 512, JSON_THROW_ON_ERROR),
    );
    if (
      ($state['version'] ?? null) !== 1 ||
      ($state['fingerprint'] ?? '') !== $fingerprint ||
      ($state['target'] ?? '') !== $targetSiteUrl ||
      ($state['permalinks'] ?? '') !== $permalinkStructure
    ) {
      throw new RuntimeException(
        'The import file, target or permalink configuration changed. Rescan before continuing.',
      );
    }
  } else {
    $inspection = voncms_wp_inspect_document($filePath);
    $state = [
      'version' => 1,
      'fingerprint' => $fingerprint,
      'target' => $targetSiteUrl,
      'permalinks' => $permalinkStructure,
      'inspection' => $inspection,
      'offset' => 0,
      'imported' => 0,
      'skipped' => 0,
      'records' => [],
      'import_complete' => false,
      'links_offset' => 0,
      'warning_count' => 0,
    ];
    voncms_wp_save_import_state($statePath, $state);
  }
  $inspection = $state['inspection'];
  $sourceSiteUrl = $inspection['source_site_url'] ?: $state['source_site_url'] ?? $sourceSiteUrl;
  $sourceBlogUrl = $inspection['source_blog_url'] ?: $state['source_blog_url'] ?? $sourceBlogUrl;
  $sourceBaseUrls = collect_source_base_urls($sourceSiteUrl, $sourceBlogUrl);
  if ($state['import_complete']) {
    $complete = voncms_wp_finalize_links(
      $conn,
      $state,
      $sourceBaseUrls,
      $targetSiteUrl,
      $limit,
      $warnings,
    );
    $state['warning_count'] += count($warnings);
    voncms_wp_save_import_state($statePath, $state);
    voncms_public_cache_clear();
    if ($complete) {
      @unlink($filePath);
      @unlink($statePath);
    }
    echo json_encode([
      'success' => true,
      'phase' => 'links',
      'has_more' => !$complete,
      'processed_in_batch' => 0,
      'imported_in_batch' => 0,
      'skipped_in_batch' => 0,
      'processed_total' => $state['offset'],
      'imported_total' => $state['imported'],
      'skipped_total' => $state['skipped'],
      'next_batch_index' => (int) floor($state['offset'] / $limit),
      'warnings' => $warnings,
      'warning_count' => $state['warning_count'],
      'errors' => [],
      'source_site_url' => $sourceSiteUrl,
      'source_blog_url' => $sourceBlogUrl,
    ]);
    return;
  }
  // XXE Protection - disable external entity loading
  if (PHP_VERSION_ID < 80000 && function_exists('libxml_disable_entity_loader')) {
    call_user_func('libxml_disable_entity_loader', true);
  }
  libxml_use_internal_errors(true);

  // --- PASS 0: Pre-scan attachments to build { wp_post_id -> attachment_url } map ---
  // This is needed because WordPress stores featured images as _thumbnail_id postmeta
  // referencing attachment post IDs, not as <image> tags or <img> in content.
  /** @var array<string, string> $attachmentMap */
  $attachmentMap = $inspection['attachments'];

  $reader = new XMLReader();
  if (!$reader->open($filePath, null, LIBXML_NONET | LIBXML_COMPACT)) {
    throw new Exception("Cannot open XML at $filePath");
  }
  debug_log("XML Reader opened for batch $batchIndex");

  // Skip to correct batch
  $count = 0;
  $startIndex = $state['offset'];

  while (($node = voncms_wp_read_next_item($reader)) !== null) {
    // Process Item
    $dom = new DOMDocument();
    $n = $dom->importNode($node, true);
    $dom->appendChild($n);
    $sxe = simplexml_import_dom($n);
    if (!($sxe instanceof SimpleXMLElement)) {
      throw new RuntimeException('Unable to read the import item.');
    }

    $namespaces = $sxe->getNamespaces(true);

    // Safety: Check if namespaces exist
    $wp = voncms_wp_fields($sxe);
    $content = isset($namespaces['content']) ? $sxe->children($namespaces['content']) : null;

    $postType = '';
    $postStatus = 'publish';
    $slug = '';
    $date = '';

    // 1. Try WP Format (Namespace)
    if ($wp !== null) {
      $postType = (string) $wp->post_type;
      $postStatus = (string) $wp->status;
      $slug = (string) $wp->post_name;
      $date = (string) $wp->post_date;
    }

    // 2. Try Generic Format (Flat tags)
    if (empty($postType)) {
      if (isset($sxe->post_type)) {
        $postType = (string) $sxe->post_type;
      } elseif ($node->nodeName === 'post') {
        $postType = 'post'; // Implicit
      }

      // Untyped <item> records are not implicit posts; keep scan/import offsets aligned.
      $postStatus =
        $wp !== null
          ? (string) $wp->status
          : (isset($sxe->status)
            ? (string) $sxe->status
            : 'publish');
      $slug = sanitize_title((string) $sxe->title);

      // Try parsing date
      $date = (string) $sxe->date;
      if (empty($date)) {
        $date = date('Y-m-d H:i:s');
      }
    }

    // Fallback for date if empty
    if (empty($date)) {
      $date = date('Y-m-d H:i:s');
    }

    if (!in_array($postType, ['post', 'page', 'attachment'], true)) {
      continue;
    }

    if ($count < $startIndex) {
      $count++;
      continue;
    }

    if ($processed >= $limit) {
      break;
    }

    // Handle WordPress attachment items (media library entries)
    if ($postType === 'attachment') {
      $count++;
      if ($wp && isset($wp->attachment_url)) {
        $attachmentUrl = (string) $wp->attachment_url;
        // Infer source base URLs from attachment URL if not yet set
        if (empty($sourceBaseUrls) && preg_match('~^https?://~i', $attachmentUrl)) {
          $inferredOrigin = get_url_origin($attachmentUrl);
          if ($inferredOrigin !== '') {
            $sourceBaseUrls = collect_source_base_urls($inferredOrigin, '');
            debug_log("Inferred source base URLs from attachment: $inferredOrigin");
          }
        }
        $uploadBy = $importUserId;
        $localized = rehost_import_image_url(
          $attachmentUrl,
          $sourceBaseUrls,
          $targetSiteUrl,
          $conn,
          $uploadBy,
        );
        if ($localized) {
          $localizedMedia++;
          debug_log("Localized attachment: $attachmentUrl -> $localized");
        } else {
          debug_log("Skipped attachment: $attachmentUrl");
        }
      }
      $processed++;
      continue;
    }

    if (empty($sourceBaseUrls) && isset($sxe->link)) {
      $inferredSourceUrl = normalize_import_url((string) $sxe->link);
      $sourceBaseUrls = collect_source_base_urls($inferredSourceUrl, '');
      if ($sourceSiteUrl === '') {
        $sourceSiteUrl = get_url_origin($inferredSourceUrl) ?: $inferredSourceUrl;
      }
    }

    // Unsupported types and attachments returned above; only Post/Page reach this block.
    $title = mb_substr(trim((string) $sxe->title), 0, 255);
    if (empty($slug)) {
      $slug = sanitize_title($title);
    }
    $slug = mb_substr(trim(sanitize_title($slug), '-'), 0, 255);
    if ($title === '' || $slug === '') {
      $errors[] = 'Skipped an item with an empty title or no supported slug: ' . $title;
      $skipped++;
      $processed++;
      $count++;
      continue;
    }

    $protected = voncms_wp_item_is_protected($sxe);
    $targetStatus = $postStatus === 'publish' && !$protected ? 'published' : 'draft';
    if ($protected) {
      $warnings[] =
        'Password-protected item imported as Draft; WordPress passwords are not transferred: ' .
        $title;
    }
    $parsedDate = strtotime($date);
    $date = $parsedDate === false ? date('Y-m-d H:i:s') : date('Y-m-d H:i:s', $parsedDate);

    $table = $postType === 'post' ? 'posts' : 'pages';
    $existingCategory = $postType === 'post' ? ', category' : '';
    $stmt = $conn->prepare(
      "SELECT id, created_at, status{$existingCategory} FROM $table WHERE slug = ?",
    );
    $stmt->execute([$slug]);
    $existing = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

    // Normalize author logic
    $authorName = $importUsername;
    $authorId = $importUserId;
    $insertedId = $existing ? (string) $existing['id'] : '';
    $category = $existing['category'] ?? 'Uncategorized';
    $encodedContent = '';
    $created = false;

    if ($existing) {
      $skipped++;
      debug_log("Skipped duplicate (Check): $slug");

      // Self-Healing: Fix invisible posts from previous partial imports
      if ($postType === 'post') {
        $fix = $conn->prepare('UPDATE posts SET author_id = ? WHERE id = ? AND author_id IS NULL');
        $fix->execute([$authorId, $existing['id']]);
        if ($fix->rowCount() > 0) {
          debug_log("Fixed missing author for: $slug");
        }
      } elseif ($postType === 'page') {
        $fix = $conn->prepare('UPDATE pages SET author_id = ? WHERE id = ? AND author_id IS NULL');
        $fix->execute([$authorId, $existing['id']]);
        if ($fix->rowCount() > 0) {
          debug_log("Fixed missing author for: $slug");
        }
      }
    } else {
      $createdMedia = $GLOBALS['voncms_wp_import_created_media'] ?? [];
      $mediaCheckpoint = is_array($createdMedia) ? count($createdMedia) : 0;
      // Try INSERT. If it fails with duplicate, handle it.
      try {
        // Content fallback: encoded -> content (generic) -> description -> empty
        if ($content && isset($content->encoded)) {
          $rawContent = (string) $content->encoded;
        } elseif (isset($sxe->content)) {
          $rawContent = (string) $sxe->content;
        } else {
          $rawContent = (string) $sxe->description;
        }

        if (strlen($rawContent) > 1048576) {
          throw new RuntimeException(
            'Article exceeds the 1MB editor limit. Split or shorten this item before importing.',
          );
        }
        $metadata = voncms_wp_import_metadata($sxe, $wp, $warnings);
        $localizedContent = localize_imported_media_references(
          $rawContent,
          $sourceBaseUrls,
          $targetSiteUrl,
          $conn,
          $authorId,
        );
        $GLOBALS['voncms_wp_import_current_url'] = (string) $sxe->link;
        try {
          $encodedContent = normalize_imported_content(
            $localizedContent['html'] ?? $rawContent,
            $sourceBaseUrls,
            $targetSiteUrl,
          );
        } finally {
          unset($GLOBALS['voncms_wp_import_current_url']);
        }
        $localizedMedia += (int) ($localizedContent['localized'] ?? 0);

        $category = 'Uncategorized';
        if ($postType === 'post') {
          // Handle Category
          if (isset($sxe->category)) {
            foreach ($sxe->category as $c) {
              // 1. WP Style: Check for domain="category"
              if (isset($c['domain']) && (string) $c['domain'] === 'category') {
                $category = mb_substr(trim((string) $c), 0, 100);
                break;
              }
              // 2. Generic Style: Just take the first <category> tag found if it has no attributes or domain isn't 'post_tag'
              // We wait to see if we find a better one, but keep this as fallback
              if (!isset($c['domain']) && $category === 'Uncategorized') {
                $category = mb_substr(trim((string) $c), 0, 100);
              }
            }
            // If still 'Uncategorized' but we found a fallback, use it (logic simplified above)
          }

          // Image Strategy: 1. _thumbnail_id postmeta (WordPress), 2. <image> Tag, 3. Content Regex
          $imageUrl = '';

          // Strategy 1: Resolve _thumbnail_id from WordPress postmeta
          if ($wp && isset($wp->postmeta) && !empty($attachmentMap)) {
            $thumbnailId = '';
            foreach ($wp->postmeta as $pm) {
              if (isset($pm->meta_key) && (string) $pm->meta_key === '_thumbnail_id') {
                $thumbnailId = trim((string) $pm->meta_value);
                break;
              }
            }
            if ($thumbnailId !== '' && isset($attachmentMap[$thumbnailId])) {
              $featuredImageUrl = $attachmentMap[$thumbnailId];
              $localizedFeaturedImage = rehost_import_image_url(
                $featuredImageUrl,
                $sourceBaseUrls,
                $targetSiteUrl,
                $conn,
                $authorId,
              );
              if ($localizedFeaturedImage !== null) {
                $imageUrl = $localizedFeaturedImage;
                $localizedMedia++;
                debug_log("Featured image resolved via _thumbnail_id $thumbnailId -> $imageUrl");
              }
            }
          }

          // Strategy 2: Explicit <image> Tag (Generic XML)
          if (empty($imageUrl) && isset($sxe->image) && !empty($sxe->image)) {
            $localizedFeaturedImage = rehost_import_image_url(
              (string) $sxe->image,
              $sourceBaseUrls,
              $targetSiteUrl,
              $conn,
              $authorId,
            );
            if ($localizedFeaturedImage !== null) {
              $imageUrl = $localizedFeaturedImage;
              $localizedMedia++;
            } else {
              $imageUrl = voncms_normalize_public_media_url((string) $sxe->image);
            }
          }

          // Strategy 3: First <img> in content fallback
          if (
            empty($imageUrl) &&
            preg_match('/<img.+src=[\'"](?P<src>.+?)[\'"].*>/i', $encodedContent, $imageMatch)
          ) {
            $imageUrl = $imageMatch['src'];
          }

          // Insert with author_id AND image_url
          $hasPostPublishedAt = voncms_has_publication_column($conn, 'posts');
          $postPublishedColumn = $hasPostPublishedAt ? ', published_at' : '';
          $postPublishedPlaceholder = $hasPostPublishedAt ? ', ?' : '';
          $insert = $conn->prepare(
            "INSERT INTO posts (title, slug, content, status, author, author_id, category, created_at, updated_at, image_url, excerpt, keywords, meta_description{$postPublishedColumn}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?{$postPublishedPlaceholder})",
          );
          $postInsertValues = [
            $title,
            $slug,
            $encodedContent,
            $targetStatus,
            $authorName,
            $authorId,
            $category,
            $date,
            $date,
            $imageUrl,
            $metadata['excerpt'],
            $metadata['keywords'],
            $metadata['meta_description'],
          ];
          if ($hasPostPublishedAt) {
            $postInsertValues[] = $targetStatus === 'published' ? $date : null;
          }
          $insertedId = voncms_insert_with_slug_reservation(
            $conn,
            'post',
            $slug,
            $insert,
            $postInsertValues,
          );
          $created = true;
          $imported++;
          debug_log("Imported Post: $title" . ($imageUrl ? ' [Has Image]' : ''));
        } elseif ($postType === 'page') {
          // Insert with author_id
          $hasPagePublishedAt = voncms_has_publication_column($conn, 'pages');
          $pagePublishedColumn = $hasPagePublishedAt ? ', published_at' : '';
          $pagePublishedPlaceholder = $hasPagePublishedAt ? ', ?' : '';
          $insert = $conn->prepare(
            "INSERT INTO pages (title, slug, content, status, author, author_id, created_at, updated_at, excerpt, keywords, meta_description{$pagePublishedColumn}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?{$pagePublishedPlaceholder})",
          );
          $pageInsertValues = [
            $title,
            $slug,
            $encodedContent,
            $targetStatus,
            $authorName,
            $authorId,
            $date,
            $date,
            $metadata['excerpt'],
            $metadata['keywords'],
            $metadata['meta_description'],
          ];
          if ($hasPagePublishedAt) {
            $pageInsertValues[] = $targetStatus === 'published' ? $date : null;
          }
          $insertedId = voncms_insert_with_slug_reservation(
            $conn,
            'page',
            $slug,
            $insert,
            $pageInsertValues,
          );
          $created = true;
          $imported++;
          debug_log("Imported Page: $title");
        }
      } catch (Throwable $e) {
        rollback_imported_media_since($conn, $mediaCheckpoint);
        $duplicate = $conn->prepare(
          "SELECT id, created_at, status{$existingCategory} FROM $table WHERE slug = ?",
        );
        $duplicate->execute([$slug]);
        $racedItem = DataBoundary::row($duplicate->fetch(PDO::FETCH_ASSOC));
        if ($e instanceof PDOException && $e->getCode() == '23000' && $racedItem) {
          // Duplicate detected during INSERT (race condition or check failed)
          $skipped++;
          $existing = $racedItem;
          $insertedId = (string) $racedItem['id'];
          debug_log("Skipped duplicate (Insert Catch): $slug");

          // Run Self-Healing here too
          $table = $postType === 'post' ? 'posts' : 'pages';
          $fix = $conn->prepare(
            "UPDATE $table SET author_id = ? WHERE slug = ? AND author_id IS NULL",
          );
          $fix->execute([$authorId, $slug]);
          if ($fix->rowCount() > 0) {
            debug_log("Fixed missing author for: $slug");
          }
        } else {
          // Actual error
          $errors[] =
            "Import paused at $postType: $title. " .
            ($e instanceof PDOException
              ? 'Database write failed. Check server logs before resuming.'
              : $e->getMessage());
          $batchFailed = true;
          debug_log('Insert Error: ' . $e->getMessage());
        }
      }
    }
    if ($batchFailed) {
      break;
    }
    if ($insertedId !== '') {
      $recordDate = (string) ($existing['created_at'] ?? $date);
      $recordCategory = (string) ($existing['category'] ?? $category);
      $state['records'][(string) $count] = [
        'type' => $postType,
        'id' => $insertedId,
        'slug' => $slug,
        'source' => (string) $sxe->link,
        'path' => build_import_target_path(
          $postType,
          $insertedId,
          $slug,
          $recordDate,
          $recordCategory,
          $permalinkStructure,
        ),
        'hash' => hash('sha256', $encodedContent),
        'created' => $created,
        'public' => $targetStatus === 'published',
      ];
    }

    $processed++;
    $count++;
  }
  $reader->close();

  $hasMore = $processed >= $limit;
  $state['offset'] = $startIndex + $processed;
  $state['imported'] += $imported;
  $state['skipped'] += $skipped;
  $state['import_complete'] = !$hasMore && !$batchFailed;
  $state['warning_count'] += count($warnings);
  $state['source_site_url'] = $sourceSiteUrl;
  $state['source_blog_url'] = $sourceBlogUrl;
  voncms_wp_save_import_state($statePath, $state);
  if ($imported > 0) {
    voncms_public_cache_clear();
  }

  echo json_encode([
    'success' => true,
    'paused' => $batchFailed,
    'phase' => $state['import_complete'] ? 'links' : 'import',
    'batch_index' => $batchIndex,
    'processed_in_batch' => $processed,
    'imported_in_batch' => $imported,
    'skipped_in_batch' => $skipped,
    'total_imported' => $imported,
    'total_skipped' => $skipped,
    'next_batch_index' => (int) floor($state['offset'] / $limit),
    'has_more' => true, // The server checkpoint owns import and final link-resolution cursors.
    'processed_total' => $state['offset'],
    'imported_total' => $state['imported'],
    'skipped_total' => $state['skipped'],
    'errors' => $errors,
    'warnings' => $warnings,
    'warning_count' => $state['warning_count'],
    'localized_media_in_batch' => $localizedMedia,
    'source_site_url' => $sourceSiteUrl,
    'source_blog_url' => $sourceBlogUrl,
    'target_site_url' => $targetSiteUrl,
    'debug_start' => $startIndex,
  ]);
} catch (Throwable $e) {
  error_log('VonCMS WordPress import stopped: ' . $e->getMessage());
  ResponseHelper::sendError(
    $e instanceof PDOException
      ? 'WordPress import paused because a database operation failed.'
      : $e->getMessage(),
    $e->getCode() === 409 ? 409 : 400,
  );
} finally {
  if ($reader instanceof XMLReader) {
    $reader->close();
  }
  if (is_resource($importLock)) {
    flock($importLock, LOCK_UN);
    fclose($importLock);
  }
}
