<?php
/** Stateless public reads only. Authentication and CSRF still use native sessions. */
if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
    realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  exit('Forbidden');
}

function voncms_is_stateless_public_read(): bool
{
  if (
    !in_array(
      strtoupper(DataBoundary::serverString('REQUEST_METHOD', 'GET')),
      ['GET', 'HEAD'],
      true,
    )
  ) {
    return false;
  }
  $sessionCookie = session_name();
  if (!is_string($sessionCookie)) {
    return false;
  }
  foreach ([$sessionCookie, 'voncms_remember'] as $cookie) {
    if (array_key_exists($cookie, $_COOKIE)) {
      return false;
    }
  }
  if (
    DataBoundary::serverString('HTTP_AUTHORIZATION') !== '' ||
    DataBoundary::serverString('HTTP_X_ADMIN_TOKEN') !== ''
  ) {
    return false;
  }
  $script = strtolower(str_replace('\\', '/', DataBoundary::serverString('SCRIPT_NAME')));
  if (
    preg_match(
      '#/api/(get_posts|get_post|get_settings|get_pages|get_comments|check_auth)\.php$#D',
      $script,
    )
  ) {
    return true;
  }
  if (preg_match('#/(rss|sitemap|llms|robots)\.php$#D', $script)) {
    return true;
  }
  if (str_ends_with($script, '/api.php')) {
    return ($_GET['action'] ?? null) === 'get_settings';
  }
  if (!str_ends_with($script, '/index.php')) {
    return false;
  }
  $path = parse_url(DataBoundary::serverString('REQUEST_URI', '/'), PHP_URL_PATH);
  if (!is_string($path)) {
    return false;
  }
  $base = rtrim(voncms_detect_session_cookie_path(), '/');
  if ($base !== '' && str_starts_with($path, $base . '/')) {
    $path = substr($path, strlen($base));
  }
  $first = strtolower(rawurldecode(explode('/', trim($path, '/'))[0]));
  return !in_array(
    $first,
    [
      'admin',
      'login',
      'register',
      'reset-password',
      'forgot-password',
      'verify-email',
      'install',
      'account',
    ],
    true,
  );
}

function voncms_start_native_session(): void
{
  if (session_status() !== PHP_SESSION_NONE) {
    return;
  }
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => voncms_detect_session_cookie_path(),
    'domain' => '',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}

function voncms_register_public_cache_policy(bool $stateless): void
{
  header_register_callback(static function () use ($stateless): void {
    $cacheable =
      $stateless &&
      session_status() === PHP_SESSION_NONE &&
      !isset($_SESSION['user']) &&
      http_response_code() === 200;
    // Authentication status must never be reused by browsers or shared caches.
    if (strtolower(basename(DataBoundary::serverString('SCRIPT_NAME'))) === 'check_auth.php') {
      $cacheable = false;
    }
    $vary = ['Cookie', 'Origin'];
    foreach (headers_list() as $header) {
      if (stripos($header, 'Set-Cookie:') === 0 || stripos($header, 'Content-Disposition:') === 0) {
        $cacheable = false;
      }
      if (stripos($header, 'Content-Type: text/html') === 0) {
        // HTML carries crawler-specific measurement exclusion metadata.
        $vary[] = 'User-Agent';
      }
      if (stripos($header, 'Vary:') === 0) {
        $vary = array_merge($vary, array_map('trim', explode(',', substr($header, 5))));
      }
    }
    header('Vary: ' . implode(', ', array_unique($vary)));
    header(
      'Cache-Control: ' . ($cacheable ? 'public, max-age=60' : 'private, no-store, max-age=0'),
    );
    if ($cacheable) {
      header_remove('Pragma');
      header_remove('Expires');
    }
  });
}
