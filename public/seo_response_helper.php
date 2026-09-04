<?php
/**
 * VonCMS - Public SEO Response Helpers
 * Shared redirect resolution, response emission, and public 404 metadata.
 */

$seoResponseHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($seoResponseHelperPath !== false && $requestedScriptPath === $seoResponseHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($seoResponseHelperPath, $requestedScriptPath);

require_once __DIR__ . '/seo_route_helper.php';

if (!function_exists('voncms_normalize_public_redirect_path')) {
  /**
   * Normalize a request path to the installation-relative value stored by the
   * Redirect Manager without treating a prefix lookalike as the base path.
   *
   * @param mixed $requestUri
   * @param mixed $basePath
   * @return string
   */
  function voncms_normalize_public_redirect_path($requestUri, $basePath): string
  {
    $path = voncms_request_path($requestUri);
    $normalizedBasePath = '/' . trim(str_replace('\\', '/', (string) $basePath), '/');

    if ($normalizedBasePath !== '/') {
      if ($path === $normalizedBasePath) {
        $path = '/';
      } elseif (str_starts_with($path, $normalizedBasePath . '/')) {
        $path = substr($path, strlen($normalizedBasePath));
      }
    }

    if ($path === '' || $path[0] !== '/') {
      $path = '/' . ltrim($path, '/');
    }

    return $path === '/' ? '/' : rtrim($path, '/');
  }
}

if (!function_exists('voncms_is_public_redirect_ignored_path')) {
  /**
   * Keep runtime, asset, upload, and admin routes outside user redirects.
   *
   * @param mixed $path
   * @return bool
   */
  function voncms_is_public_redirect_ignored_path($path): bool
  {
    return preg_match('#^/(api|assets|uploads|admin)(/|$)#i', (string) $path) === 1;
  }
}

if (!function_exists('voncms_normalize_redirect_status')) {
  /**
   * @param mixed $status
   * @return int
   */
  function voncms_normalize_redirect_status($status): int
  {
    $status = (int) $status;
    return in_array($status, [301, 302, 307, 308], true) ? $status : 301;
  }
}

if (!function_exists('voncms_is_safe_public_redirect_target')) {
  /**
   * Redirect Manager intentionally supports local paths and explicit HTTP(S)
   * URLs. Scheme-relative URLs and header control characters are rejected.
   *
   * @param mixed $target
   * @return bool
   */
  function voncms_is_safe_public_redirect_target($target): bool
  {
    $target = trim((string) $target);
    if ($target === '' || preg_match('/[\x00-\x1F\x7F]/', $target)) {
      return false;
    }

    if (str_starts_with($target, '/')) {
      return !str_starts_with($target, '//') && !str_contains($target, '\\');
    }

    if (filter_var($target, FILTER_VALIDATE_URL) === false) {
      return false;
    }

    $scheme = strtolower((string) parse_url($target, PHP_URL_SCHEME));
    $host = (string) parse_url($target, PHP_URL_HOST);
    return in_array($scheme, ['http', 'https'], true) && $host !== '';
  }
}

if (!function_exists('voncms_public_redirect_target_path')) {
  /**
   * @param mixed $target
   * @return string
   */
  function voncms_public_redirect_target_path($target): string
  {
    $targetPath = (string) (parse_url((string) $target, PHP_URL_PATH) ?? '');
    if ($targetPath === '') {
      return '';
    }
    if ($targetPath[0] !== '/') {
      $targetPath = '/' . ltrim($targetPath, '/');
    }

    return $targetPath === '/' ? '/' : rtrim($targetPath, '/');
  }
}

if (!function_exists('voncms_normalize_redirect_host')) {
  /**
   * @param mixed $host
   * @return string
   */
  function voncms_normalize_redirect_host($host): string
  {
    $host = trim((string) $host);
    if ($host === '' || preg_match('/[\x00-\x20\x7F]/', $host)) {
      return '';
    }

    $parsed = parse_url(str_contains($host, '://') ? $host : 'http://' . $host);
    if (!is_array($parsed) || empty($parsed['host'])) {
      return '';
    }

    $normalizedHost = strtolower(trim((string) $parsed['host'], '[]'));
    $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
    $portNumber = isset($parsed['port']) ? (int) $parsed['port'] : null;
    if (
      ($scheme === 'http' && $portNumber === 80) ||
      ($scheme === 'https' && $portNumber === 443) ||
      ($scheme === '' && in_array($portNumber, [80, 443], true))
    ) {
      $portNumber = null;
    }
    $port = $portNumber !== null ? ':' . $portNumber : '';
    return $normalizedHost . $port;
  }
}

if (!function_exists('voncms_resolve_public_redirect')) {
  /**
   * Resolve one exact Redirect Manager rule. No response is emitted and the
   * hit counter is not changed until the caller commits to the redirect.
   *
   * @param PDO $pdo
   * @param mixed $requestUri
   * @param mixed $basePath
   * @param mixed $currentHost
   * @return array{location: string, status: int, sourcePath: string}|null
   */
  function voncms_resolve_public_redirect(PDO $pdo, $requestUri, $basePath, $currentHost): ?array
  {
    $path = voncms_normalize_public_redirect_path($requestUri, $basePath);
    if (voncms_is_public_redirect_ignored_path($path)) {
      return null;
    }

    $statement = $pdo->prepare(
      'SELECT target_url, redirect_type FROM redirects WHERE source_url = ? LIMIT 1',
    );
    $statement->execute([$path]);
    $redirect = $statement->fetch(PDO::FETCH_ASSOC);
    if (!is_array($redirect)) {
      return null;
    }

    $target = trim((string) ($redirect['target_url'] ?? ''));
    if (!voncms_is_safe_public_redirect_target($target)) {
      return null;
    }

    $targetPath = voncms_public_redirect_target_path($target);
    $targetComparisonPath = voncms_normalize_public_redirect_path($targetPath, $basePath);
    $targetHost = voncms_normalize_redirect_host($target);
    $currentHost = voncms_normalize_redirect_host($currentHost);
    $isLocalTarget = str_starts_with($target, '/') && !str_starts_with($target, '//');
    $isSameHostTarget = $targetHost !== '' && $targetHost === $currentHost;
    if (
      $targetPath !== '' &&
      $targetComparisonPath === $path &&
      ($isLocalTarget || $isSameHostTarget)
    ) {
      return null;
    }

    return [
      'location' => $target,
      'status' => voncms_normalize_redirect_status($redirect['redirect_type'] ?? 301),
      'sourcePath' => $path,
    ];
  }
}

if (!function_exists('voncms_record_public_redirect_hit')) {
  /**
   * @param PDO $pdo
   * @param string $sourcePath
   * @return void
   */
  function voncms_record_public_redirect_hit(PDO $pdo, string $sourcePath): void
  {
    $pdo
      ->prepare('UPDATE redirects SET hit_count = hit_count + 1 WHERE source_url = ?')
      ->execute([$sourcePath]);
  }
}

if (!function_exists('voncms_send_redirect')) {
  /**
   * Emit a validated redirect and stop the current response.
   *
   * @param mixed $location
   * @param mixed $status
   * @param mixed $source
   * @return never
   */
  function voncms_send_redirect($location, $status = 301, $source = ''): never
  {
    $location = trim((string) $location);
    if (!voncms_is_safe_public_redirect_target($location)) {
      throw new InvalidArgumentException('Unsafe redirect location.');
    }

    $status = voncms_normalize_redirect_status($status);
    http_response_code($status);
    header('Location: ' . $location, true, $status);

    $source = preg_replace('/[^a-zA-Z0-9._-]/', '', (string) $source);
    if ($source !== '') {
      header('X-Redirect-By: ' . $source);
    }
    exit();
  }
}

if (!function_exists('voncms_apply_not_found_response')) {
  /**
   * Apply the complete public 404 contract before the HTML head is emitted.
   *
   * @param mixed $seoTitle
   * @param mixed $seoDescription
   * @param mixed $seoUrl
   * @param mixed $seoRobots
   * @param mixed $schemaData
   * @param mixed $siteName
   * @param mixed $domainUrl
   * @param mixed $requestPath
   * @return void
   */
  function voncms_apply_not_found_response(
    &$seoTitle,
    &$seoDescription,
    &$seoUrl,
    &$seoRobots,
    &$schemaData,
    $siteName,
    $domainUrl,
    $requestPath,
  ): void {
    http_response_code(404);

    $siteName = trim((string) $siteName);
    if ($siteName === '') {
      $siteName = 'Website';
    }

    $seoTitle = 'Page Not Found - ' . $siteName;
    $seoDescription = 'The requested page could not be found on ' . $siteName . '.';
    $seoRobots = 'noindex, follow';
    $schemaData = null;

    $safePath = trim((string) $requestPath);
    $safePath = preg_replace('/[\r\n\t]+/', '', $safePath);
    $safePath = ltrim((string) $safePath, '/');
    $seoUrl = rtrim((string) $domainUrl, '/') . ($safePath !== '' ? '/' . $safePath : '/');
  }
}

if (!function_exists('voncms_apply_discovery_overflow_response')) {
  /**
   * Mark a numbered discovery page outside the real result range without
   * rewriting its already-resolved title or canonical URL.
   *
   * @param mixed $seoRobots
   * @param mixed $schemaData
   * @return void
   */
  function voncms_apply_discovery_overflow_response(&$seoRobots, &$schemaData): void
  {
    http_response_code(404);
    $seoRobots = 'noindex, follow';
    $schemaData = null;
  }
}
