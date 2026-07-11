<?php
// Suppress PHP error output that breaks JSON
require_once __DIR__ . '/../../security.php';
require_once __DIR__ . '/../public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

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
  $str = preg_replace('/[^a-z0-9-]/', '-', $str);
  return preg_replace('/-+/', '-', $str);
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
    $stmt = $conn->prepare(
      'INSERT INTO media (filename, filepath, filetype, filesize, uploaded_by) VALUES (?, ?, ?, ?, ?)',
    );
    $stmt->execute([
      $filename,
      'uploads/' . ltrim(str_replace('\\', '/', $relativePath), '/'),
      $mimeType,
      (int) $size,
      $uploadedBy,
    ]);
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
  $name = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $name);

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

  if (stripos($ip, '::ffff:') === 0) {
    $mappedIp = substr($ip, 7);
    if (filter_var($mappedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
      return filter_var(
        $mappedIp,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
      ) !== false;
    }
  }

  return filter_var(
    $ip,
    FILTER_VALIDATE_IP,
    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
  ) !== false;
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
 * @return array<string, mixed>
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
    CURLOPT_WRITEFUNCTION => function ($curlHandle, $data) use ($handle, &$currentStatus) {
      if ($currentStatus >= 300 && $currentStatus < 400) {
        return strlen($data);
      }

      $written = fwrite($handle, $data);
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
 * @return array<string, mixed>
 */
function fetch_import_image_hop_with_stream($url, $tempPath)
{
  $context = stream_context_create([
    'http' => [
      'method' => 'GET',
      'timeout' => 30,
      'follow_location' => 0,
      'user_agent' => 'VonCMS WP Importer/1.25.2',
      'ignore_errors' => true,
    ],
    'ssl' => [
      'verify_peer' => true,
      'verify_peer_name' => true,
    ],
  ]);

  $data = false;
  $headers = [];
  $stream = @fopen($url, 'rb', false, $context);
  if (is_resource($stream)) {
    $data = stream_get_contents($stream);
    $metadata = stream_get_meta_data($stream);
    $headers =
      isset($metadata['wrapper_data']) && is_array($metadata['wrapper_data'])
        ? $metadata['wrapper_data']
        : [];
    fclose($stream);
  }
  $httpCode = 0;
  $redirectLocation = '';

  foreach ($headers as $header) {
    if (preg_match('~^HTTP/\S+\s+(\d{3})~i', $header, $matches)) {
      $httpCode = (int) $matches[1];
      $redirectLocation = '';
    } elseif (stripos($header, 'Location:') === 0) {
      $redirectLocation = trim(substr($header, 9));
    }
  }

  if (import_remote_http_code_is_redirect($httpCode)) {
    return ['redirect' => true, 'location' => $redirectLocation, 'http_code' => $httpCode];
  }

  if (
    $data !== false &&
    $httpCode >= 200 &&
    $httpCode < 300 &&
    @file_put_contents($tempPath, $data) !== false
  ) {
    return ['success' => true, 'http_code' => $httpCode];
  }

  return ['success' => false, 'http_code' => $httpCode, 'error' => 'HTTP ' . $httpCode];
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
  /** @var array<string, string> $cache */
  static $cache = [];

  $absoluteUrl = absolutize_import_media_url($url, $sourceBaseUrls);
  if (!should_rehost_import_image($absoluteUrl, $sourceBaseUrls, $targetSiteUrl)) {
    return null;
  }

  if (isset($cache[$absoluteUrl])) {
    return $cache[$absoluteUrl];
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
  if ($size === false || $size <= 0 || $size > 10 * 1024 * 1024) {
    debug_log('Media localizer skipped unsupported file size for: ' . $absoluteUrl);
    @unlink($tempPath);
    return null;
  }

  $imageInfo = @getimagesize($tempPath);
  $mimeType = is_array($imageInfo) ? $imageInfo['mime'] ?? '' : '';
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
  $filename = $safeName . '_' . uniqid() . '.' . $extension;
  $targetPath = $uploadContext['absolute_dir'] . $filename;

  if (!@rename($tempPath, $targetPath)) {
    if (!@copy($tempPath, $targetPath)) {
      debug_log('Media localizer failed to move downloaded image for: ' . $absoluteUrl);
      @unlink($tempPath);
      return null;
    }
    @unlink($tempPath);
  }

  // Ensure uploaded media is world-readable (Apache needs 0644, not 0600 from restrictive umask)
  @chmod($targetPath, 0644);

  $relativePath = $uploadContext['relative_dir'] . $filename;
  register_imported_media($conn, $relativePath, $mimeType, $size, $uploadedBy, $filename);

  $localUrl = $uploadContext['url_prefix'] . $filename;
  $cache[$absoluteUrl] = $localUrl;

  return $localUrl;
}

/**
 * @param DOMNode $node
 * @return string
 */
function get_dom_inner_html($node)
{
  $html = '';
  foreach ($node->childNodes as $childNode) {
    $html .= $node->ownerDocument->saveHTML($childNode);
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
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $configured = normalize_import_url($row['setting_value'] ?? '');
    if ($configured !== '') {
      return $configured;
    }
  } catch (Throwable $e) {
    debug_log('Target URL lookup failed: ' . $e->getMessage());
  }

  $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
  if ($host === '') {
    return '';
  }

  $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
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
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
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
  $slug = trim((string) $slug, '/');
  if ($postType === 'page') {
    return '/' . $slug;
  }

  $timestamp = strtotime((string) $date);
  switch ($permalinkStructure) {
    case 'date':
    case 'day_name':
      if ($timestamp === false) {
        return '/' . $slug;
      }
      return '/' .
        date('Y', $timestamp) .
        '/' .
        date('m', $timestamp) .
        '/' .
        date('d', $timestamp) .
        '/' .
        $slug;

    case 'month_name':
      if ($timestamp === false) {
        return '/' . $slug;
      }
      return '/' . date('Y', $timestamp) . '/' . date('m', $timestamp) . '/' . $slug;

    case 'category':
      $categorySlug = strtolower(trim((string) $category));
      $categorySlug = preg_replace('/\s+/', '-', $categorySlug ?: 'uncategorized');
      return '/' . trim($categorySlug, '/') . '/' . $slug;

    case 'plain':
      return '/post/' . $postId;

    case 'post_name':
    case 'slug':
    default:
      return '/' . $slug;
  }
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
    $html = preg_replace_callback(
      $pattern,
      /**
       * @param array<string|int, string> $matches
       * @return string
       */
      function ($matches) {
        $rawUrl = $matches['href'] ?? ($matches['url'] ?? '');
        $embedHtml = build_embed_html_from_url($rawUrl);
        return $embedHtml ?: $matches[0];
      },
      $html,
    );
  }

  return $html;
}

/**
 * @param string $html
 * @return string
 */
function strip_gutenberg_comments($html)
{
  return preg_replace('/<!--\s*\/?wp:[\s\S]*?-->/i', '', $html);
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
    function ($matches) use ($sourceBaseUrls, $targetBaseUrl) {
      $href = html_entity_decode($matches['href'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
      if (!should_remap_internal_href($href)) {
        return $matches[0];
      }

      foreach ($sourceBaseUrls as $sourceBaseUrl) {
        if ($sourceBaseUrl === '') {
          continue;
        }

        if (stripos($href, $sourceBaseUrl) === 0) {
          $suffix = substr($href, strlen($sourceBaseUrl));
          $newHref = rtrim($targetBaseUrl, '/') . ($suffix === false ? '' : $suffix);
          return str_replace(
            $matches['href'],
            htmlspecialchars($newHref, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            $matches[0],
          );
        }
      }

      return $matches[0];
    },
    $html,
  );
}

/**
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
  $cleaned = preg_replace('/<p>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/i', '', $cleaned);
  $cleaned = preg_replace('/\n{3,}/', "\n\n", $cleaned);

  return trim((string) $cleaned);
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

$input = json_decode(CSRFProtection::getRequestBody(), true);
$filename = $input['temp_file'] ?? '';
$batchIndex = $input['batch_index'] ?? 0;
$limit = $input['limit'] ?? 10;
$sourceSiteUrl = normalize_import_url($input['source_site_url'] ?? '');
$sourceBlogUrl = normalize_import_url($input['source_blog_url'] ?? '');

if (empty($filename)) {
  ResponseHelper::sendError('Filename required', 400);
}

$filePath = __DIR__ . '/../../uploads/temp/' . basename($filename);
if (!file_exists($filePath)) {
  ResponseHelper::sendError('Temp file not found', 404);
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

try {
  // XXE Protection - disable external entity loading
  if (PHP_VERSION_ID < 80000 && function_exists('libxml_disable_entity_loader')) {
    call_user_func('libxml_disable_entity_loader', true);
  }
  libxml_use_internal_errors(true);

  // --- PASS 0: Pre-scan attachments to build { wp_post_id -> attachment_url } map ---
  // This is needed because WordPress stores featured images as _thumbnail_id postmeta
  // referencing attachment post IDs, not as <image> tags or <img> in content.
  /** @var array<string, string> $attachmentMap */
  $attachmentMap = [];
  $preScanReader = new XMLReader();
  if ($preScanReader->open($filePath)) {
    while ($preScanReader->read()) {
      if (
        $preScanReader->nodeType == XMLReader::ELEMENT &&
        ($preScanReader->name == 'item' || $preScanReader->name == 'post')
      ) {
        $preScanNode = $preScanReader->expand();
        if (!$preScanNode) {
          $preScanReader->next();
          continue;
        }
        $preScanDom = new DOMDocument();
        $preScanN = $preScanDom->importNode($preScanNode, true);
        $preScanDom->appendChild($preScanN);
        $preScanSxe = simplexml_import_dom($preScanN);
        $preScanNs = $preScanSxe->getNamespaces(true);
        $preScanWp = isset($preScanNs['wp']) ? $preScanSxe->children($preScanNs['wp']) : null;
        if (
          $preScanWp &&
          isset($preScanWp->post_type) &&
          (string) $preScanWp->post_type === 'attachment'
        ) {
          $attachId = (string) ($preScanWp->post_id ?? '');
          $attachUrl = (string) ($preScanWp->attachment_url ?? '');
          if ($attachId !== '' && $attachUrl !== '') {
            $attachmentMap[$attachId] = $attachUrl;
          }
        }
        $preScanReader->next();
      }
    }
    $preScanReader->close();
    debug_log('Attachment map built: ' . count($attachmentMap) . ' entries');
  }

  $reader = new XMLReader();
  if (!$reader->open($filePath)) {
    throw new Exception("Cannot open XML at $filePath");
  }
  debug_log("XML Reader opened for batch $batchIndex");

  // Skip to correct batch
  $count = 0;
  $startIndex = $batchIndex * $limit;

  while ($reader->read()) {
    if (
      $reader->nodeType == XMLReader::ELEMENT &&
      ($reader->name == 'item' || $reader->name == 'post')
    ) {
      // Process Item
      $node = $reader->expand();
      if (!$node) {
        debug_log("Node expand failed at index $count");
        $reader->next();
        continue;
      }

      $dom = new DOMDocument();
      $n = $dom->importNode($node, true);
      $dom->appendChild($n);
      $sxe = simplexml_import_dom($n);

      $namespaces = $sxe->getNamespaces(true);

      // Safety: Check if namespaces exist
      $wp = isset($namespaces['wp']) ? $sxe->children($namespaces['wp']) : null;
      $content = isset($namespaces['content']) ? $sxe->children($namespaces['content']) : null;

      $postType = '';
      $postStatus = 'publish';
      $slug = '';
      $date = '';

      // 1. Try WP Format (Namespace)
      if ($wp) {
        $postType = (string) $wp->post_type;
        $postStatus = (string) $wp->status;
        $slug = (string) $wp->post_name;
        $date = (string) $wp->post_date;
      }

      // 2. Try Generic Format (Flat tags)
      if (empty($postType)) {
        if (isset($sxe->post_type)) {
          $postType = (string) $sxe->post_type;
        } elseif ($reader->name == 'post') {
          $postType = 'post'; // Implicit
        }

        // Fallback defaults
        if (empty($postType)) {
          $postType = 'post';
        }
        $postStatus = 'publish';
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

      if ($count < $startIndex) {
        $count++;
        $reader->next();
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
          // Double-import guard: skip if already localized via content import
          $path = (string) (parse_url($attachmentUrl, PHP_URL_PATH) ?? '');
          $filename = basename($path);
          $alreadyLocalized = false;
          if ($filename !== '' && import_media_table_exists($conn)) {
            try {
              $check = $conn->prepare('SELECT id FROM media WHERE filename = ?');
              $check->execute([$filename]);
              $alreadyLocalized = (bool) $check->fetch(PDO::FETCH_ASSOC);
            } catch (Throwable $e) {
              // Media table may not exist yet
            }
          }
          if (!$alreadyLocalized) {
            $uploadBy = $_SESSION['user']['id'] ?? null;
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
          } else {
            debug_log("Already localized attachment: $attachmentUrl");
          }
        }
        $processed++;
        $reader->next();
        continue;
      }

      if ($postType !== 'post' && $postType !== 'page') {
        $count++;
        $reader->next();
        continue;
      }

      if (empty($sourceBaseUrls) && isset($sxe->link)) {
        $inferredSourceUrl = normalize_import_url((string) $sxe->link);
        $sourceBaseUrls = collect_source_base_urls($inferredSourceUrl, '');
        if ($sourceSiteUrl === '') {
          $sourceSiteUrl = get_url_origin($inferredSourceUrl) ?: $inferredSourceUrl;
        }
      }

      if ($postType === 'post' || $postType === 'page') {
        $title = (string) $sxe->title;
        if (empty($slug)) {
          $slug = sanitize_title($title);
        }

        $targetStatus = $postStatus === 'publish' ? 'published' : 'draft';

        $table = $postType === 'post' ? 'posts' : 'pages';
        $stmt = $conn->prepare("SELECT id FROM $table WHERE slug = ?");
        $stmt->execute([$slug]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        // Normalize author logic
        $authorName = $_SESSION['user']['username'] ?? 'Admin';
        $authorId = $_SESSION['user']['id'] ?? null;

        if ($existing) {
          $skipped++;
          debug_log("Skipped duplicate (Check): $slug");

          // Self-Healing: Fix invisible posts from previous partial imports
          if ($postType === 'post') {
            $fix = $conn->prepare(
              'UPDATE posts SET author_id = ? WHERE id = ? AND author_id IS NULL',
            );
            $fix->execute([$authorId, $existing['id']]);
            if ($fix->rowCount() > 0) {
              debug_log("Fixed missing author for: $slug");
            }
          } elseif ($postType === 'page') {
            $fix = $conn->prepare(
              'UPDATE pages SET author_id = ? WHERE id = ? AND author_id IS NULL',
            );
            $fix->execute([$authorId, $existing['id']]);
            if ($fix->rowCount() > 0) {
              debug_log("Fixed missing author for: $slug");
            }
          }
        } else {
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

            $localizedContent = localize_imported_media_references(
              $rawContent,
              $sourceBaseUrls,
              $targetSiteUrl,
              $conn,
              $authorId,
            );
            $encodedContent = normalize_imported_content(
              $localizedContent['html'] ?? $rawContent,
              $sourceBaseUrls,
              $targetSiteUrl,
            );
            $localizedMedia += (int) ($localizedContent['localized'] ?? 0);

            $category = 'Uncategorized';
            if ($postType === 'post') {
              // Handle Category
              if (isset($sxe->category)) {
                foreach ($sxe->category as $c) {
                  // 1. WP Style: Check for domain="category"
                  if (isset($c['domain']) && (string) $c['domain'] === 'category') {
                    $category = (string) $c;
                    break;
                  }
                  // 2. Generic Style: Just take the first <category> tag found if it has no attributes or domain isn't 'post_tag'
                  // We wait to see if we find a better one, but keep this as fallback
                  if (!isset($c['domain']) && $category === 'Uncategorized') {
                    $category = (string) $c;
                  }
                }
                // If still 'Uncategorized' but we found a fallback, use it (logic simplified above)
              }

              // Image Strategy: 1. _thumbnail_id postmeta (WordPress), 2. <image> Tag, 3. Content Regex
              $imageUrl = '';

              // Strategy 1: Resolve _thumbnail_id from WordPress postmeta
              if (empty($imageUrl) && $wp && isset($wp->postmeta) && !empty($attachmentMap)) {
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
                    debug_log(
                      "Featured image resolved via _thumbnail_id $thumbnailId -> $imageUrl",
                    );
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
                  $imageUrl = (string) $sxe->image;
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
              $insert = $conn->prepare(
                'INSERT INTO posts (title, slug, content, status, author, author_id, category, created_at, updated_at, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              );
              $insert->execute([
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
              ]);
              $insertedId = (string) $conn->lastInsertId();
              $imported++;
              debug_log("Imported Post: $title" . ($imageUrl ? ' [Has Image]' : ''));
            } elseif ($postType === 'page') {
              // Insert with author_id
              $insert = $conn->prepare(
                'INSERT INTO pages (title, slug, content, status, author, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              );
              $insert->execute([
                $title,
                $slug,
                $encodedContent,
                $targetStatus,
                $authorName,
                $authorId,
                $date,
                $date,
              ]);
              $insertedId = (string) $conn->lastInsertId();
              $imported++;
              debug_log("Imported Page: $title");
            }

            // --- AUTO-REDIRECT GENERATOR (WP Bridge) ---
            // If post/page imported successfully, map old WP permalink to the configured canonical path
            try {
              // Standard WP Permalink: /yyyy/mm/slug/ or /slug/
              // We support both by default 301 rules

              $sourceUrl = '';
              if ($postType === 'post') {
                $year = date('Y', strtotime($date));
                $month = date('m', strtotime($date));
                $sourceUrl = "/$year/$month/$slug"; // Typical WP structure
              } else {
                $sourceUrl = "/$slug"; // Pages are usually root
              }

              // 1. Check if redirect already exists
              $chkRed = $conn->prepare('SELECT id FROM redirects WHERE source_url = ?');
              $chkRed->execute([$sourceUrl]);

              if ($chkRed->rowCount() === 0 && !empty($sourceUrl)) {
                $targetUrl = build_import_target_path(
                  $postType,
                  $insertedId ?? '',
                  $slug,
                  $date,
                  $category,
                  $permalinkStructure,
                );

                // Skip self-redirects - source and target are the same path
                $normalizedSource = '/' . ltrim($sourceUrl, '/');
                $normalizedTarget = '/' . ltrim($targetUrl, '/');
                if ($normalizedSource === $normalizedTarget) {
                  debug_log(" -> Skipped self-redirect: $sourceUrl === $targetUrl");
                } else {
                  $addRed = $conn->prepare(
                    "INSERT INTO redirects (source_url, target_url, redirect_type, created_at) VALUES (?, ?, '301', NOW())",
                  );
                  $addRed->execute([$sourceUrl, $targetUrl]);
                  debug_log(" -> Auto-Redirect created: $sourceUrl -> $targetUrl");
                }
              }
            } catch (Exception $e) {
              // Silent fail: Don't stop import if redirect fails
              debug_log(' -> Redirect Error: ' . $e->getMessage());
            }
            // -------------------------------------------
          } catch (PDOException $e) {
            if ($e->getCode() == '23000') {
              // Duplicate detected during INSERT (race condition or check failed)
              $skipped++;
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
              $errors[] = "Failed to insert $postType: $title. Error: " . $e->getMessage();
              debug_log('Insert Error: ' . $e->getMessage());
            }
          }
        }
      }

      $processed++;
      $count++;
      $reader->next();
    }
  }
  $reader->close();

  $hasMore = $processed >= $limit;
  if (!$hasMore) {
    @unlink($filePath);
  }
  if ($imported > 0) {
    voncms_public_cache_clear();
  }

  echo json_encode([
    'success' => true,
    'batch_index' => $batchIndex,
    'processed_in_batch' => $processed,
    'imported_in_batch' => $imported,
    'skipped_in_batch' => $skipped,
    'total_imported' => $imported,
    'total_skipped' => $skipped,
    'next_batch_index' => $batchIndex + ($processed > 0 ? 1 : 0),
    'has_more' => $hasMore, // If we processed a full batch, assume there might be more.
    'errors' => $errors,
    'localized_media_in_batch' => $localizedMedia,
    'source_site_url' => $sourceSiteUrl,
    'source_blog_url' => $sourceBlogUrl,
    'target_site_url' => $targetSiteUrl,
    'debug_start' => $startIndex,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
