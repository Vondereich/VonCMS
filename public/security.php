<?php

/**
 * VonCMS Security Middleware
 * Handles CSRF, Session Management, and Rate Limiting
 */

// PHP Version Enforcement
if (version_compare(PHP_VERSION, '8.2.0', '<')) {
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode([
    'error' => 'VonCMS requires PHP 8.2 or higher.',
  ]);
  exit();
}

// Prevent direct access
if (basename($_SERVER['PHP_SELF']) == basename(__FILE__)) {
  die('Direct access not allowed');
}

// Keep the historical entry point and load definitions before any session/error path.
if (!defined('VONCMS_CORE_LOADED')) {
  define('VONCMS_CORE_LOADED', true);
}
require_once __DIR__ . '/core/InstallBootstrap.php';
require_once __DIR__ . '/core/ContentViewDeduplicator.php';
require_once __DIR__ . '/core/RateLimiter.php';
require_once __DIR__ . '/core/ResponseHelper.php';

if (!function_exists('voncms_ip_matches_proxy_rule')) {
  /** Match an exact IP address or CIDR rule without trusting request headers. */
  function voncms_ip_matches_proxy_rule(string $ip, string $rule): bool
  {
    $rule = trim($rule);
    if ($rule === '') {
      return false;
    }

    if (strpos($rule, '/') === false) {
      $packedIp = @inet_pton($ip);
      $packedRule = @inet_pton($rule);
      return $packedIp !== false && $packedRule !== false && hash_equals($packedRule, $packedIp);
    }

    [$network, $prefixValue] = array_pad(explode('/', $rule, 2), 2, '');
    if ($prefixValue === '' || !ctype_digit($prefixValue)) {
      return false;
    }

    $packedIp = @inet_pton($ip);
    $packedNetwork = @inet_pton(trim($network));
    if (
      $packedIp === false ||
      $packedNetwork === false ||
      strlen($packedIp) !== strlen($packedNetwork)
    ) {
      return false;
    }

    $prefix = (int) $prefixValue;
    $maximumPrefix = strlen($packedIp) * 8;
    if ($prefix < 0 || $prefix > $maximumPrefix) {
      return false;
    }

    $wholeBytes = intdiv($prefix, 8);
    $remainingBits = $prefix % 8;
    if (
      $wholeBytes > 0 &&
      substr($packedIp, 0, $wholeBytes) !== substr($packedNetwork, 0, $wholeBytes)
    ) {
      return false;
    }
    if ($remainingBits === 0) {
      return true;
    }

    $mask = (0xff << (8 - $remainingBits)) & 0xff;
    return (ord($packedIp[$wholeBytes]) & $mask) === (ord($packedNetwork[$wholeBytes]) & $mask);
  }
}

if (!function_exists('voncms_is_trusted_proxy_request')) {
  /** Trust forwarded transport headers only from explicitly configured proxies. */
  function voncms_is_trusted_proxy_request(): bool
  {
    $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!is_string($remoteAddress) || filter_var($remoteAddress, FILTER_VALIDATE_IP) === false) {
      return false;
    }

    $rules = ['127.0.0.1', '::1'];
    $configuredRules = getenv('VONCMS_TRUSTED_PROXIES');
    if (is_string($configuredRules) && trim($configuredRules) !== '') {
      $extraRules = preg_split('/[\s,]+/', trim($configuredRules)) ?: [];
      $rules = array_merge($rules, $extraRules);
    }

    foreach ($rules as $rule) {
      if (voncms_ip_matches_proxy_rule($remoteAddress, (string) $rule)) {
        return true;
      }
    }

    return false;
  }
}

if (!function_exists('is_https')) {
  /** Standardized HTTPS detection with an explicit trusted-proxy boundary. */
  function is_https(): bool
  {
    $https = $_SERVER['HTTPS'] ?? '';
    if ($https === 1 || (is_string($https) && strtolower(trim($https)) === 'on')) {
      return true;
    }

    if (!voncms_is_trusted_proxy_request()) {
      return false;
    }

    $forwardedProto = strtolower(
      trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]),
    );
    $forwardedPort = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PORT'] ?? ''))[0]);
    $forwardedSsl = strtolower(
      trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_SSL'] ?? ''))[0]),
    );

    return $forwardedProto === 'https' || $forwardedPort === '443' || $forwardedSsl === 'on';
  }
}

/**
 * Runtime WWW Canonicalization Guard
 * Provides a PHP-level fallback proxy for .htaccess constraints
 */
if (!isset($GLOBALS['VON_CANONICAL_CHECKED'])) {
  $GLOBALS['VON_CANONICAL_CHECKED'] = true;
  // If we have PDO and the API isn't a direct API call (skip for APIs to prevent breakage)
  $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
  $isApiScript =
    strpos($scriptName, '/api/') !== false || preg_match('#/(api|api\.php)$#i', $scriptName);

  $normalizeHost =
    /**
     * @param string|null $host
     * @return string
     */
    function ($host) {
      $host = strtolower(trim((string) $host));
      if ($host === '') {
        return '';
      }

      if (preg_match('/^\[(.*)\](?::\d+)?$/', $host, $matches)) {
        $host = $matches[1];
      } elseif (preg_match('/^(.+):\d+$/', $host, $matches) && substr_count($host, ':') === 1) {
        $host = $matches[1];
      }

      $host = trim($host, '[]');

      if (filter_var($host, FILTER_VALIDATE_IP) === false) {
        $host = preg_replace('/^www\./i', '', $host);
        // Hardened Mandala Sanitization
        $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', $host);
      }

      return $host;
    };

  if (!$isApiScript && isset($_SERVER['HTTP_HOST'])) {
    // Try to load domain_url from settings
    $settingsFile = __DIR__ . '/data/site_settings.json';
    if (file_exists($settingsFile)) {
      $allSettings = json_decode(file_get_contents($settingsFile), true);
      if (is_array($allSettings)) {
        // Nested legacy aliases are not trusted redirect configuration. Settings
        // saves rebuild this flat value from the owner-guarded database setting.
        $configuredDomainUrl = is_string($allSettings['domainUrl'] ?? null)
          ? $allSettings['domainUrl']
          : '';

        if ($configuredDomainUrl !== '') {
          $expectedHostRaw = parse_url($configuredDomainUrl, PHP_URL_HOST);
          $expectedHost = $normalizeHost($expectedHostRaw);
          $currentHost = $normalizeHost($_SERVER['HTTP_HOST'] ?? '');

          $isPrivateIp = false;
          if (filter_var($currentHost, FILTER_VALIDATE_IP) !== false) {
            $isPrivateIp = !filter_var(
              $currentHost,
              FILTER_VALIDATE_IP,
              FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
            );
          }

          $isDevHost =
            in_array($currentHost, ['localhost', '127.0.0.1', '::1', 'localhost:8080'], true) ||
            $isPrivateIp ||
            preg_match('/\.(local|test|localhost)$/i', $currentHost);

          if (
            $expectedHost &&
            $currentHost &&
            !$isDevHost &&
            strcasecmp($expectedHost, $currentHost) !== 0
          ) {
            // Host mismatch (e.g. www vs non-www). Perform canonical redirect.
            $protocol = is_https() ? 'https://' : 'http://';
            $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
            $redirectUrl = $protocol . $expectedHost . $requestUri;

            if (!headers_sent()) {
              header('HTTP/1.1 301 Moved Permanently');
              header('Location: ' . $redirectUrl);
              exit();
            }
          }
        }
      }
    }
  }
}

if (!function_exists('voncms_is_social_preview_crawler')) {
  function voncms_is_social_preview_crawler(string $userAgent): bool
  {
    return (bool) preg_match(
      '/(facebookexternalhit|Facebot|meta-external|meta-webindexer|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot)/i',
      $userAgent,
    );
  }
}

if (!function_exists('voncms_detect_session_cookie_path')) {
  function voncms_detect_session_cookie_path(): string
  {
    $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $cookiePath = '';

    if ($scriptName !== '') {
      if (preg_match('#/api(/|$)#i', $scriptName)) {
        $cookiePath = preg_replace('#/api(/.*)?$#i', '', $scriptName);
      } else {
        $cookiePath = preg_replace('#/[^/]*\.php$#i', '', $scriptName);
      }
    }

    $cookiePath = str_replace('\\', '/', (string) $cookiePath);
    $cookiePath = preg_replace('#/public$#i', '', $cookiePath);
    $cookiePath = '/' . trim((string) $cookiePath, '/');

    return $cookiePath === '/' ? '/' : $cookiePath;
  }
}

// 1. Initialise Session with Secure Parameters
// Must be called BEFORE session_start()
if (session_status() === PHP_SESSION_NONE) {
  $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
  $isBot =
    voncms_is_social_preview_crawler($ua) ||
    preg_match('/(Googlebot|Bingbot|DuckDuckBot|Mediapartners-Google|AdsBot-Google)/i', $ua);

  $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
  $requestMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
  $isApiScript =
    strpos($scriptName, '/api/') !== false || preg_match('#/(api|api\.php)$#i', $scriptName);
  $isCrawlerPageRequest = !$isApiScript && in_array($requestMethod, ['GET', 'HEAD'], true);

  // Keep crawler-facing page renders lightweight without changing API security.
  if ($isBot && $isCrawlerPageRequest) {
    // Public GET/HEAD page shells must remain indexable for known crawler user agents.
    if (!headers_sent()) {
      http_response_code(200);
      header('X-Robots-Tag: index, follow');
    }

    // Mark this request so session-backed helpers can avoid unnecessary page-render work.
    if (!defined('CRAWLER_PAGE_RENDER')) {
      define('CRAWLER_PAGE_RENDER', true);
    }

    // Let index.php render the public page without starting a visitor session.
  } else {
    session_set_cookie_params([
      'lifetime' => 0, // Session cookie (expires on browser close)
      'path' => voncms_detect_session_cookie_path(),
      'domain' => '',
      'secure' => is_https(), // Only Secure if HTTPS is active (Proxy-Aware)
      'httponly' => true, // XSS protection
      'samesite' => 'Lax', // Changed to Lax for better compatibility with redirects
    ]);
    session_start();
  }
}

// 2. Session Binding (Anti-Hijacking)
if (isset($_SESSION['user'])) {
  $uaHash = hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
  if (!isset($_SESSION['ua_bind'])) {
    $_SESSION['ua_bind'] = $uaHash;
  } elseif ($_SESSION['ua_bind'] !== $uaHash) {
    // Potential Session Hijacking detected
    SessionManager::destroy();
    http_response_code(401);
    header('Content-Type: application/json; charset=UTF-8');
    die(
      json_encode([
        'error' => 'Security session mismatch. Please login again.',
        'code' => 'SESSION_HIJACK',
      ])
    );
  }
}

/**
 * Standard API Headers (Smart Unified Version)
 * @param string $methods Allowed HTTP methods
 * @return void
 */
function sendApiHeaders($methods = 'GET, OPTIONS')
{
  if (!headers_sent()) {
    $requestedMethods = trim((string) $methods);
    if ($requestedMethods === '') {
      $requestedMethods = 'GET, OPTIONS';
    }

    $defaultMethods = 'GET, OPTIONS';
    $previousMethods = $GLOBALS['voncms_api_allowed_methods'] ?? null;
    if (
      !is_string($previousMethods) ||
      trim($previousMethods) === '' ||
      $previousMethods === $defaultMethods ||
      $requestedMethods !== $defaultMethods
    ) {
      $GLOBALS['voncms_api_allowed_methods'] = $requestedMethods;
    }
    $effectiveMethods = (string) $GLOBALS['voncms_api_allowed_methods'];

    header('Content-Type: application/json');

    // SECURITY: Mirror only trusted web origins for credentialed requests.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $isTrustedOrigin = false;
    if (!empty($origin)) {
      $originParts = parse_url($origin);
      if (!is_array($originParts)) {
        $originParts = [];
      }
      $originScheme = strtolower($originParts['scheme'] ?? '');
      $originHost = strtolower($originParts['host'] ?? '');
      $currentScheme = is_https() ? 'https' : 'http';
      $serverOriginParts = parse_url(
        $currentScheme . '://' . (string) ($_SERVER['HTTP_HOST'] ?? ''),
      );
      $serverHost = is_array($serverOriginParts)
        ? strtolower((string) ($serverOriginParts['host'] ?? ''))
        : '';
      $originPort = isset($originParts['port'])
        ? (int) $originParts['port']
        : ($originScheme === 'https'
          ? 443
          : 80);
      $serverPort =
        is_array($serverOriginParts) && isset($serverOriginParts['port'])
          ? (int) $serverOriginParts['port']
          : ($currentScheme === 'https'
            ? 443
            : 80);

      $sameHost = $originHost !== '' && $originHost === $serverHost;
      $localhostDev =
        in_array($originHost, ['localhost', '127.0.0.1'], true) &&
        in_array($serverHost, ['localhost', '127.0.0.1'], true);
      $samePort = $originPort === $serverPort;
      $sameScheme = $originScheme === $currentScheme;

      $isTrustedOrigin =
        $sameScheme &&
        $samePort &&
        !isset($originParts['user']) &&
        !isset($originParts['pass']) &&
        ($sameHost || $localhostDev);
    }

    if ($isTrustedOrigin) {
      header("Access-Control-Allow-Origin: {$origin}");
      header('Access-Control-Allow-Credentials: true');
      header('Vary: Origin');
    } elseif (empty($origin)) {
      header('Access-Control-Allow-Origin: *');
    }

    header("Access-Control-Allow-Methods: $effectiveMethods");
    header(
      'Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Admin-Token, x-gemini-key',
    );
    header('X-Content-Type-Options: nosniff');
  }
}

/**
 * CSRF Protection (Buffered & Multi-Reader Compatible)
 */
class CSRFProtection
{
  /** @var string $tokenName */
  private static $tokenName = 'csrf_token';
  /** @var string|false|null $cachedInput */
  private static $cachedInput = null;

  /**
   * Prevent php://input exhaustion by caching the stream
   */
  public static function getRequestBody()
  {
    if (self::$cachedInput === null) {
      self::$cachedInput = file_get_contents('php://input');
    }
    return self::$cachedInput;
  }

  /**
   * Generate CSRF token and store in session
   */
  public static function generateToken()
  {
    if (defined('CRAWLER_PAGE_RENDER') && CRAWLER_PAGE_RENDER === true) {
      return 'crawler-page-render';
    }
    if (!isset($_SESSION[self::$tokenName])) {
      $_SESSION[self::$tokenName] = bin2hex(random_bytes(32));
    }
    return $_SESSION[self::$tokenName];
  }

  /**
   * Get current CSRF token
   */
  public static function getToken()
  {
    if (defined('CRAWLER_PAGE_RENDER') && CRAWLER_PAGE_RENDER === true) {
      return 'crawler-page-render';
    }
    return $_SESSION[self::$tokenName] ?? self::generateToken();
  }

  /**
   * Validate CSRF token from request
   */
  public static function validateToken()
  {
    // Check header first (SPA pattern) - Standardize to X-CSRF-Token
    $headerTokenValue = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $headerToken = is_string($headerTokenValue) ? trim($headerTokenValue) : '';

    // Fallback to POST field (Standard form data)
    $postTokenValue = $_POST['csrf_token'] ?? '';
    $postToken = is_string($postTokenValue) ? trim($postTokenValue) : '';

    // Use Buffered Input for JSON tokens (Multi-reader safe)
    $jsonToken = '';
    $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    if (strpos($contentType, 'application/json') !== false) {
      $input = json_decode(self::getRequestBody(), true);
      $jsonTokenValue = is_array($input) ? $input['csrf_token'] ?? '' : '';
      $jsonToken = is_string($jsonTokenValue) ? trim($jsonTokenValue) : '';
    }

    $submittedToken =
      $headerToken !== '' ? $headerToken : ($postToken !== '' ? $postToken : $jsonToken);
    $sessionToken = self::getToken();

    return !empty($submittedToken) && hash_equals($sessionToken, $submittedToken);
  }

  /**
   * Require valid CSRF token or die
   */
  public static function requireToken()
  {
    if (
      defined('CRAWLER_PAGE_RENDER') &&
      CRAWLER_PAGE_RENDER === true &&
      ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
    ) {
      return; // No state-changing CSRF validation is needed for a public crawler GET.
    }
    if (!self::validateToken()) {
      sendApiHeaders();
      http_response_code(403);
      echo json_encode([
        'success' => false,
        'error' => 'Invalid CSRF token',
        'code' => 'CSRF_INVALID',
      ]);
      exit();
    }
  }
}

/**
 * Session Management with Expiry
 */
class SessionManager
{
  /** @var int $timeout */
  private static $timeout = 3600; // 1 hour in seconds
  /** @var int $absoluteTimeout */
  private static $absoluteTimeout = 43200; // 12 hours in seconds
  /** @var string $lastActivityKey */
  private static $lastActivityKey = 'last_activity';
  /** @var string $startedAtKey */
  private static $startedAtKey = 'auth_started_at';
  /** @var string $fingerprintKey */
  private static $fingerprintKey = 'auth_fingerprint';
  /** @var string $authorizationState */
  private static $authorizationState = 'unchecked';

  /**
   * Bind the authenticated identity to the database role and password state.
   * A password or role change produces a different fingerprint on the next request.
   *
   * @param int|string $userId
   * @param string $role
   * @param string $passwordHash
   * @return string
   */
  private static function buildAuthFingerprint($userId, $role, $passwordHash)
  {
    return hash(
      'sha256',
      (string) $userId . "\0" . strtolower((string) $role) . "\0" . (string) $passwordHash,
    );
  }

  /**
   * Resolve the configured database connection for authorization checks.
   * Protected endpoints do not need to duplicate configuration bootstrap logic.
   *
   * @return PDO|null
   */
  private static function getDatabaseConnection()
  {
    global $pdo;

    if (isset($pdo) && $pdo instanceof PDO) {
      return $pdo;
    }

    $configFile = __DIR__ . '/von_config.php';
    if (!is_file($configFile)) {
      return null;
    }

    try {
      require_once $configFile;
    } catch (Throwable $e) {
      return null;
    }

    return isset($pdo) && $pdo instanceof PDO ? $pdo : null;
  }

  /**
   * Establish a fresh authenticated session after password or remember-token verification.
   *
   * @param array<string, mixed> $user
   * @param string $passwordHash
   * @return void
   */
  public static function establishAuthenticatedSession($user, $passwordHash)
  {
    $userId = (string) ($user['id'] ?? '');
    $role = (string) ($user['role'] ?? '');
    $passwordHash = (string) $passwordHash;

    if ($userId === '' || $role === '' || $passwordHash === '') {
      throw new InvalidArgumentException('Authenticated session identity is incomplete.');
    }

    $_SESSION['user'] = $user;
    $_SESSION['ua_bind'] = hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
    $_SESSION[self::$fingerprintKey] = self::buildAuthFingerprint($userId, $role, $passwordHash);
    $_SESSION[self::$startedAtKey] = time();
    self::$authorizationState = 'valid';
    self::touch();
  }

  /**
   * Remove authenticated state while keeping the PHP session available for a safe remember-token restore.
   *
   * @return void
   */
  private static function clearAuthenticationState()
  {
    unset(
      $_SESSION['user'],
      $_SESSION['ua_bind'],
      $_SESSION[self::$fingerprintKey],
      $_SESSION[self::$startedAtKey],
      $_SESSION[self::$lastActivityKey],
      $_SESSION['csrf_token'],
    );
  }

  /**
   * Revalidate the session identity against the current database record once per request.
   *
   * @return bool
   */
  private static function hasCurrentDatabaseIdentity()
  {
    if (self::$authorizationState !== 'unchecked') {
      return self::$authorizationState === 'valid';
    }

    $database = self::getDatabaseConnection();
    if (!$database) {
      self::$authorizationState = 'unavailable';
      return false;
    }

    $userId = (string) ($_SESSION['user']['id'] ?? '');
    $sessionFingerprint = (string) ($_SESSION[self::$fingerprintKey] ?? '');
    if ($userId === '' || $sessionFingerprint === '') {
      self::$authorizationState = 'revoked';
      self::clearAuthenticationState();
      return false;
    }

    try {
      $stmt = $database->prepare('SELECT id, role, password FROM users WHERE id = ? LIMIT 1');
      $stmt->execute([$userId]);
      $databaseUser = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
      self::$authorizationState = 'unavailable';
      return false;
    }

    if (!$databaseUser) {
      self::$authorizationState = 'revoked';
      self::clearAuthenticationState();
      return false;
    }

    $currentFingerprint = self::buildAuthFingerprint(
      $databaseUser['id'] ?? '',
      $databaseUser['role'] ?? '',
      $databaseUser['password'] ?? '',
    );
    if (!hash_equals($sessionFingerprint, $currentFingerprint)) {
      self::$authorizationState = 'revoked';
      self::clearAuthenticationState();
      return false;
    }

    $_SESSION['user']['role'] = $databaseUser['role'];
    self::$authorizationState = 'valid';
    return true;
  }

  /**
   * Check if session is valid (not expired)
   */
  public static function isValid()
  {
    if (!isset($_SESSION['user'])) {
      self::$authorizationState = 'anonymous';
      return false;
    }

    if (self::isExpired()) {
      self::$authorizationState = 'revoked';
      self::clearAuthenticationState();
      return false;
    }

    return self::hasCurrentDatabaseIdentity();
  }

  /**
   * Check if session is expired
   */
  public static function isExpired()
  {
    if (isset($_SESSION['user'])) {
      $startedAt = (int) ($_SESSION[self::$startedAtKey] ?? 0);
      if ($startedAt <= 0 || time() - $startedAt > self::$absoluteTimeout) {
        return true;
      }
    }

    if (isset($_SESSION[self::$lastActivityKey])) {
      $elapsed = time() - $_SESSION[self::$lastActivityKey];
      return $elapsed > self::$timeout;
    }
    return false;
  }

  /**
   * Update last activity timestamp
   */
  public static function touch()
  {
    $_SESSION[self::$lastActivityKey] = time();
  }

  /**
   * Validate session or terminate
   */
  public static function requireValidSession()
  {
    if (!self::isValid()) {
      sendApiHeaders();
      $authorizationUnavailable = self::$authorizationState === 'unavailable';
      http_response_code($authorizationUnavailable ? 503 : 401);
      echo json_encode([
        'error' => $authorizationUnavailable
          ? 'Authentication service unavailable'
          : 'Session expired or authorization changed',
      ]);
      exit();
    }

    self::touch();
  }

  /**
   * Check if current user is an admin or root
   */
  public static function isAdmin()
  {
    if (!self::isValid() || !isset($_SESSION['user']['role'])) {
      return false;
    }
    $role = strtolower($_SESSION['user']['role']);
    return $role === 'admin' || $role === 'root';
  }

  /**
   * Check if current user owns system-level privileges.
   */
  public static function isPrimaryAdmin()
  {
    if (!self::isValid()) {
      return false;
    }

    $role = strtolower((string) ($_SESSION['user']['role'] ?? ''));
    $userId = (string) ($_SESSION['user']['id'] ?? '');
    return $role === 'root' || $userId === '1';
  }

  /**
   * Check if current user is staff (Admin, Root, Moderator, Writer)
   */
  public static function isStaff()
  {
    if (!self::isValid() || !isset($_SESSION['user']['role'])) {
      return false;
    }
    $role = strtolower($_SESSION['user']['role']);
    return in_array($role, ['admin', 'root', 'moderator', 'writer']);
  }

  /**
   * Check if current user can access media (Admin, Moderator, Writer)
   */
  public static function canAccessMedia()
  {
    return self::isStaff();
  }

  /**
   * Require staff access (Admin, Root, Moderator, Writer) or die
   */
  public static function requireStaff()
  {
    self::requireValidSession();
    if (!self::isStaff()) {
      sendApiHeaders();
      http_response_code(403);
      echo json_encode(['error' => 'Staff access required']);
      exit();
    }
  }

  /**
   * Require media access permission or die
   */
  public static function requireMediaAccess()
  {
    self::requireValidSession();
    if (!self::canAccessMedia()) {
      sendApiHeaders();
      http_response_code(403);
      echo json_encode(['error' => 'Media access required (Staff only)']);
      exit();
    }
  }

  /**
   * Require admin/root role or die
   */
  public static function requireAdmin()
  {
    self::requireValidSession();
    if (!self::isAdmin()) {
      sendApiHeaders();
      http_response_code(403);
      echo json_encode(['error' => 'Admin access required']);
      exit();
    }
  }

  /**
   * Require root/Admin ID 1 ownership privileges or die.
   */
  public static function requirePrimaryAdmin()
  {
    self::requireValidSession();
    if (!self::isPrimaryAdmin()) {
      sendApiHeaders();
      http_response_code(403);
      echo json_encode(['error' => 'Primary admin access required']);
      exit();
    }
  }

  /**
   * Destroy session
   */
  public static function destroy()
  {
    $_SESSION = [];
    self::$authorizationState = 'unchecked';
    if (ini_get('session.use_cookies')) {
      $params = session_get_cookie_params();
      setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly'],
      );
    }
    session_destroy();
  }
  /**
   * Validate CSRF Token Wrapper
   */
  public static function validateCsrfToken()
  {
    return CSRFProtection::requireToken();
  }
}

/**
 * Helper class for sensitive data management
 */
class SecurityHelper
{
  /**
   * New bcrypt credentials must not silently discard a suffix. Legacy login stays compatible.
   * @param mixed $password Raw input is validated here before string operations.
   */
  public static function requireNewPasswordLength($password): void
  {
    if (!is_string($password) || str_contains($password, "\0")) {
      ResponseHelper::sendError('Invalid password input', 400);
    }
    if (strlen($password) > 72) {
      ResponseHelper::sendError('New passwords must not exceed 72 bytes (UTF-8).', 400);
    }
  }

  /**
   * Keys that should NEVER be exposed to public (Regex Patterns)
   * @var array<int, string> $sensitivePatterns
   */
  private static $sensitivePatterns = [
    '/key/i',
    '/pass/i',
    '/secret/i',
    '/token/i',
    '/auth/i',
    '/credential/i',
    '/license/i',
    '/smtp/i',
    '/mail/i',
  ];

  /**
   * Keys that are explicitly allowed for public consumption
   * @var array<int, string> $publicWhitelist
   */
  private static $publicWhitelist = [
    'sitelogo',
    'siteicon',
    'siteversion',
    'maintenancemode',
    'logourl',
    'faviconurl',
    'activethemeid',
    'permalinkstructure',
    'navigation',
    'menuitems',
    'adsenabled',
    'googleanalyticsid',
    'enabletracking',
    'publickey',
    'publishablekey',
    'keywords',
    'defaultkeywords',
    'sitekeywords',
    'metakeywords',
    'adminprofile',
    'sitelanguage',
    'siteurl',
  ];

  /**
   * Check if a key name suggests sensitive content
   * Uses an "Allowlist-First" approach for maximum security.
   * @param string $key
   * @return bool
   */
  public static function isSensitiveKey($key)
  {
    $keyLower = strtolower(trim($key));

    // 1. Whitelist takes absolute precedence
    if (in_array($keyLower, self::$publicWhitelist)) {
      return false;
    }

    // 2. Explicitly Blocked Patterns (Greedy match for keys like 'pass', 'key', 'secret')
    foreach (self::$sensitivePatterns as $pattern) {
      if (preg_match($pattern, $key)) {
        return true;
      }
    }

    // 3. Fallback: Catch sensitive prefixes even in camelCase (Hardened)
    $suspiciousPrefixes = ['db', 'smtp', 'mail', 'api', 'app', 'von', 'secret', 'token', 'pass'];
    foreach ($suspiciousPrefixes as $prefix) {
      if (strpos($keyLower, $prefix) === 0) {
        // Match if it's the full key OR followed by non-alpha (underscore) OR capital letter (camelCase)
        if (
          strlen($keyLower) === strlen($prefix) ||
          !ctype_alpha($key[strlen($prefix)]) ||
          ctype_upper($key[strlen($prefix)])
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Recursively mask sensitive data in an array/object
   * @param mixed $data
   * @return void
   */
  public static function maskSensitiveData(&$data)
  {
    if (!is_array($data)) {
      return;
    }

    foreach ($data as $key => &$value) {
      if (is_array($value)) {
        self::maskSensitiveData($value);
      } elseif (is_string($key) && self::isSensitiveKey($key)) {
        $value = '******** (PROTECTED)';
      }
    }
  }

  /**
   * System Integrity Check (Mandala series)
   * Detects if the Universal .htaccess or Uploads Shield is missing.
   */
  public static function hasUnsafeHostDerivedRedirect(mixed $content): bool
  {
    if (!is_string($content)) {
      return false;
    }

    $managedBlockMatch = preg_match(
      '/^[ \t]*# BEGIN VonCMS\r?$[\s\S]*?^[ \t]*# END VonCMS\r?$/mi',
      $content,
      $managedBlock,
    );
    if ($managedBlockMatch !== 1) {
      return false;
    }

    return preg_match(
      '/^[ \t]*RewriteRule\b[ \t]+\S+[ \t]+["\']?https?:\/\/[^\s"\']*%(?:\{HTTP_HOST\}|[0-9])[^\s"\']*["\']?(?:[ \t]|$)/mi',
      $managedBlock[0],
    ) === 1;
  }

  public static function hasRequiredHtaccessDirectives(mixed $content): bool
  {
    if (!is_string($content)) {
      return false;
    }

    if (self::hasUnsafeHostDerivedRedirect($content)) {
      return false;
    }

    $beginMarkers = preg_match_all('/^[ \t]*# BEGIN VonCMS\r?$/m', $content);
    $endMarkers = preg_match_all('/^[ \t]*# END VonCMS\r?$/m', $content);
    if ($beginMarkers !== 1 || $endMarkers !== 1) {
      return false;
    }

    $requiredDirectiveGroups = [
      ['DirectoryIndex index.php index.html'],
      ['RewriteEngine On'],
      ['RewriteRule \.(sql|md|json|log|bak|env|zip|lock)$ - [F,L]'],
      ['RewriteRule ^von_config\\.php$ - [F,L]'],
      ['RewriteRule ^.+\\.php/ - [R=404,L,NC]'],
      [
        'RewriteRule ^api/(ai_provider_helper|analytics_consent_helper|contact_honeypot_helper|content_audit_helper|content_embed_helper|content_slug_helper|ImageProcessor|mail_helper|media_library_filter_helper|post_query_helper|post_views_helper|publication_time_helper|public_cache_helper|redirect_loop_helper|role_capability_helper|schema_repair_helper|settings_audit_helper)\\.php$ - [F,L,NC]',
      ],
      ['RewriteRule ^api/(system/IndexNow|security/SecurityLogger)\\.php$ - [F,L,NC]'],
      ['RewriteRule ^api/tools/wp_wxr_reader_helper\\.php$ - [F,L,NC]'],
      ['RewriteRule ^api/(.*)$ api/$1 [L]', 'RewriteRule ^api/(.*)$ public/api/$1 [L]'],
      [
        'RewriteRule ^robots\\.txt$ robots.php [L]',
        'RewriteRule ^robots\\.txt$ public/robots.php [L]',
      ],
      [
        'RewriteRule ^sitemap\\.xml$ sitemap.php [L]',
        'RewriteRule ^sitemap\\.xml$ public/sitemap.php [L]',
      ],
      ['RewriteRule ^rss\\.xml$ rss.php [L]', 'RewriteRule ^rss\\.xml$ public/rss.php [L]'],
      ['RewriteRule ^ index.php [L,QSA]'],
      ['Header set X-Content-Type-Options "nosniff"'],
    ];

    foreach ($requiredDirectiveGroups as $alternatives) {
      $hasActiveDirective = false;
      foreach ($alternatives as $directive) {
        $pattern = '/^[ \t]*' . preg_quote($directive, '/') . '[ \t]*\r?$/mi';
        if (preg_match($pattern, $content) === 1) {
          $hasActiveDirective = true;
          break;
        }
      }
      if (!$hasActiveDirective) {
        return false;
      }
    }

    return true;
  }

  public static function isIntegrityCompromised()
  {
    // OTA preserves nested .htaccess files. Signal repair if the new core shield is absent.
    $coreShield = @file_get_contents(__DIR__ . '/core/.htaccess');
    if (
      !is_string($coreShield) ||
      strpos($coreShield, 'Require all denied') === false ||
      strpos($coreShield, 'Options -Indexes') === false
    ) {
      return true;
    }

    // Robust Root Detection (Works in both /public and root)
    $root = __DIR__;
    if (!file_exists($root . '/von_config.php')) {
      if (file_exists(dirname($root) . '/von_config.php')) {
        $root = dirname($root);
      }
    }

    // 1. Check Root .htaccess
    $rootHtaccess = $root . '/.htaccess';
    if (!file_exists($rootHtaccess)) {
      return true;
    }

    $content = @file_get_contents($rootHtaccess);
    if ($content === false || !self::hasRequiredHtaccessDirectives($content)) {
      return true;
    }

    // 2. Check Uploads Shield
    $uploadsDir = $root . '/public/uploads';
    if (!is_dir($uploadsDir)) {
      $uploadsDir = $root . '/uploads';
    }

    if (is_dir($uploadsDir)) {
      $shield = $uploadsDir . '/.htaccess';
      if (!file_exists($shield)) {
        return true;
      }

      $shieldContent = @file_get_contents($shield);
      if (
        $shieldContent === false ||
        strpos($shieldContent, 'VonCMS Uploads Security v2') === false ||
        strpos($shieldContent, '(?i)\.(php|php[0-9]+|phtml|pht|phar|phps') === false ||
        strpos($shieldContent, 'Require all denied') === false ||
        strpos($shieldContent, 'Options -Indexes') === false
      ) {
        return true;
      }
    }

    return false;
  }
}

/**
 * 4. Global Timezone Bootstrapping (VonCMS Breeze)
 * Ensures all PHP date/time functions respect the configured site timezone.
 * This works for index.php, sitemap.php, and llms.php where von_config.php
 * is included BEFORE security.php.
 */
if (!function_exists('voncms_apply_site_timezone')) {
  /**
   * @param PDO|null $pdo
   * @return string|null
   */
  function voncms_apply_site_timezone($pdo): ?string
  {
    if (!($pdo instanceof PDO)) {
      return null;
    }

    try {
      $tzStmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'time_zone' LIMIT 1",
      );
      $tzStmt->execute();
      $tzValue = (string) $tzStmt->fetchColumn();

      if ($tzValue !== '' && @date_default_timezone_set($tzValue)) {
        return $tzValue;
      }
    } catch (Throwable $e) {
      // Fallback to system default if DB fails
    }

    return null;
  }
}

if (!function_exists('voncms_apply_dashboard_timezone')) {
  /**
   * @param PDO|null $pdo
   * @return string|null
   */
  function voncms_apply_dashboard_timezone($pdo): ?string
  {
    return voncms_apply_site_timezone($pdo);
  }
}

voncms_apply_site_timezone($pdo ?? null);
