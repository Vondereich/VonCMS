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

if (!function_exists('is_https')) {
  /**
   * Standardized HTTPS Detection (Proxy-Aware)
   * Supports cPanel, Cloudflare, and direct SSL
   */
  function is_https()
  {
    return (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === 1)) ||
      (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) &&
        $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
      (isset($_SERVER['HTTP_X_FORWARDED_PORT']) && $_SERVER['HTTP_X_FORWARDED_PORT'] === '443') ||
      (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on');
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
        $legacyDomainUrl =
          isset($allSettings['system']) && is_array($allSettings['system'])
            ? (string) ($allSettings['system']['domainUrl'] ?? '')
            : '';
        $directDomainUrl = (string) ($allSettings['domainUrl'] ?? '');
        $configuredDomainUrl = $legacyDomainUrl !== '' ? $legacyDomainUrl : $directDomainUrl;

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
    $isProduction = !in_array(
      preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')),
      ['localhost', '127.0.0.1', 'localhost:8080'],
    );
    session_set_cookie_params([
      'lifetime' => 0, // Session cookie (expires on browser close)
      'path' => '/',
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
      $originScheme = strtolower($originParts['scheme'] ?? '');
      $originHost = strtolower($originParts['host'] ?? '');
      $originPort = isset($originParts['port']) ? (int) $originParts['port'] : null;

      $hostHeader = preg_replace(
        '/[^a-zA-Z0-9.\-:]/',
        '',
        strtolower((string) ($_SERVER['HTTP_HOST'] ?? '')),
      );
      $serverHost = $hostHeader;
      $serverPort = null;
      if (strpos($hostHeader, ':') !== false) {
        [$serverHost, $serverPortRaw] = explode(':', $hostHeader, 2);
        $serverPort = (int) $serverPortRaw;
      }

      $sameHost = $originHost !== '' && $originHost === $serverHost;
      $localhostDev =
        in_array($originHost, ['localhost', '127.0.0.1'], true) &&
        in_array($serverHost, ['localhost', '127.0.0.1'], true);
      $samePort = $serverPort === null || $originPort === null || $originPort === $serverPort;

      $isTrustedOrigin =
        in_array($originScheme, ['http', 'https'], true) &&
        $samePort &&
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
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    // Fallback to POST field (Standard form data)
    $postToken = $_POST['csrf_token'] ?? '';

    // Use Buffered Input for JSON tokens (Multi-reader safe)
    $jsonToken = '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    if (strpos($contentType, 'application/json') !== false) {
      $input = json_decode(self::getRequestBody(), true);
      $jsonToken = $input['csrf_token'] ?? '';
    }

    $submittedToken = trim($headerToken ?: ($postToken ?: $jsonToken));
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
  /** @var string $lastActivityKey */
  private static $lastActivityKey = 'last_activity';

  /**
   * Check if session is valid (not expired)
   */
  public static function isValid()
  {
    return !self::isExpired();
  }

  /**
   * Check if session is expired
   */
  public static function isExpired()
  {
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
    if (self::isExpired()) {
      self::destroy();
      sendApiHeaders();
      http_response_code(401);
      echo json_encode(['error' => 'Session expired']);
      exit();
    }

    if (!isset($_SESSION['user'])) {
      sendApiHeaders();
      http_response_code(401);
      echo json_encode(['error' => 'Authentication required']);
      exit();
    }

    self::touch();
  }

  /**
   * Check if current user is an admin or root
   */
  public static function isAdmin()
  {
    if (!isset($_SESSION['user']['role'])) {
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
    if (!isset($_SESSION['user'])) {
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
    if (!isset($_SESSION['user']['role'])) {
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
 * Rate Limiting (IP-based)
 */
class RateLimiter
{
  /** @var string $storageDir */
  private static $storageDir = __DIR__ . '/data/rate_limits/';
  /** @var int $maxAttempts */
  private static $maxAttempts = 5;
  /** @var int $lockoutTime */
  private static $lockoutTime = 900; // 15 minutes in seconds

  /**
   * Get client IP (secure - does NOT trust X-Forwarded-For)
   */
  private static function getClientIP()
  {
    // SECURITY: Only trust REMOTE_ADDR, not X-Forwarded-For
    // X-Forwarded-For can be spoofed by attackers to bypass rate limiting
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  }

  /**
   * Get rate limit file path
   * @param string $identifier
   * @return string
   */
  private static function getFilePath($identifier)
  {
    if (!is_dir(self::$storageDir)) {
      mkdir(self::$storageDir, 0755, true);
    }
    return self::$storageDir . md5($identifier) . '.json';
  }

  /**
   * Check if IP is rate limited
   * @param string|null $identifier
   * @return bool
   */
  public static function isLimited($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);

    if (!file_exists($file)) {
      return false;
    }

    $data = json_decode(file_get_contents($file), true);
    $attempts = $data['attempts'] ?? 0;
    $lockoutUntil = $data['lockout_until'] ?? 0;

    // Check if still locked out
    if ($lockoutUntil > time()) {
      return true;
    }

    // Reset attempts if lockout expired, but preserve penalty level
    if ($lockoutUntil > 0 && $lockoutUntil <= time()) {
      $data['attempts'] = 0;
      $data['lockout_until'] = 0;
      file_put_contents($file, json_encode($data));
      return false;
    }

    return false;
  }

  /**
   * Record failed attempt
   * @param string|null $identifier
   * @return void
   */
  public static function recordAttempt($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);

    $data = ['attempts' => 1, 'lockout_until' => 0, 'penalty_level' => 0];

    if (file_exists($file)) {
      $existing = json_decode(file_get_contents($file), true);
      $data['attempts'] = ($existing['attempts'] ?? 0) + 1;
      $data['penalty_level'] = $existing['penalty_level'] ?? 0;
    }

    // Trigger lockout if max attempts reached
    if ($data['attempts'] >= self::$maxAttempts) {
      $data['penalty_level']++;

      // Escalating penalty: 1 = 15m, 2 = 1h, 3+ = 24h
      $multipliers = [1 => 1, 2 => 4];
      $multiplier = $multipliers[$data['penalty_level']] ?? 96;

      $data['lockout_until'] = time() + self::$lockoutTime * $multiplier;
    }

    file_put_contents($file, json_encode($data));
  }

  /**
   * Reset attempts (on successful login)
   * @param string|null $identifier
   * @return void
   */
  public static function reset($identifier = null)
  {
    $identifier = $identifier ?? self::getClientIP();
    $file = self::getFilePath($identifier);

    if (file_exists($file)) {
      unlink($file);
    }
  }

  /**
   * Require not rate limited or die
   * @param string|null $identifier
   * @return void
   */
  public static function requireNotLimited($identifier = null)
  {
    if (
      defined('CRAWLER_PAGE_RENDER') &&
      CRAWLER_PAGE_RENDER === true &&
      ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
    ) {
      return; // Avoid visitor rate-limit storage for a public crawler GET.
    }
    if (self::isLimited($identifier)) {
      sendApiHeaders();
      http_response_code(429);
      echo json_encode(['error' => 'Too many requests. Please try again later.']);
      exit();
    }
  }
}

/**
 * Helper class for sensitive data management
 */
class SecurityHelper
{
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
  public static function isIntegrityCompromised()
  {
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
    if ($content === false || strpos($content, '# BEGIN VonCMS') === false) {
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
      if ($shieldContent === false || strpos($shieldContent, 'Require all denied') === false) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Helper class for standard JSON responses
 */
class ResponseHelper
{
  /**
   * Send Error Response (Secure)
   *
   * @param Exception|string $e The exception object or error message
   * @param int $statusCode HTTP Status code (default 500)
   * @return void
   */
  public static function sendError($e, $statusCode = 500)
  {
    // Ensure headers are sent
    sendApiHeaders();

    // Clear any previous output buffering
    if (ob_get_length()) {
      ob_clean();
    }

    http_response_code($statusCode);

    $message = $e instanceof Exception ? $e->getMessage() : $e;
    $isAdmin = SessionManager::isAdmin();

    // Log the full error internally
    error_log('VonCMS API Error: ' . $message);

    if ($isAdmin || ($statusCode >= 400 && $statusCode < 500)) {
      // Admins or validation errors (4xx) see the actual message
      echo json_encode([
        'success' => false,
        'error' => $message,
        'debug_trace' => $isAdmin && $e instanceof Exception ? $e->getTraceAsString() : null,
      ]);
    } else {
      // Public users see generic message for 5xx to prevent info disclosure
      echo json_encode([
        'success' => false,
        'error' => 'An internal server error occurred. Please contact support.',
        'code' => 'INTERNAL_ERROR',
      ]);
    }
    exit();
  }

  /**
   * Automatically upgrades http:// to https:// for internal assets
   * to prevent Mixed Content warnings.
   *
   * @param string|null $url The URL to scrub
   * @return string|null
   */
  public static function scrubUrl($url)
  {
    if (empty($url) || !is_string($url)) {
      return $url;
    }

    // Only upgrade if we are on HTTPS
    if (is_https() && strpos($url, 'http://') === 0) {
      return 'https://' . substr($url, 7);
    }

    return $url;
  }

  /**
   * Scrub user/avatar URLs more strictly than normal content assets.
   * External avatars must be HTTPS; relative local upload paths remain allowed.
   *
   * @param string|null $url
   * @return string
   */
  public static function scrubAvatarUrl($url)
  {
    if (empty($url) || !is_string($url)) {
      return '';
    }

    $url = trim($url);
    if ($url === '' || preg_match('/^(javascript|data):/i', $url)) {
      return '';
    }

    if (preg_match('/^https:\/\//i', $url)) {
      return self::scrubUrl($url) ?: '';
    }

    if (strpos($url, '/') === 0 && strpos($url, '//') !== 0) {
      return self::scrubUrl($url) ?: '';
    }

    if (preg_match('/^(?:\.\.\/)?(?:public\/)?uploads\//i', $url)) {
      return self::scrubUrl($url) ?: '';
    }

    return '';
  }

  /**
   * Shape post/page payloads so public callers never receive internal author IDs.
   * The published status field is intentionally preserved because public themes use it.
   *
   * @param array<string, mixed> $payload
   * @param bool $isAdmin
   * @return array<string, mixed>
   */
  public static function shapeContentPayload($payload, $isAdmin)
  {
    if (!$isAdmin) {
      unset($payload['author_id']);
    }

    return $payload;
  }

  /**
   * Shape comment payloads consistently for public, staff, and primary-admin callers.
   *
   * @param array<string, mixed> $payload
   * @param bool $isStaff
   * @param bool $isPrimaryAdmin
   * @return array<string, mixed>
   */
  public static function shapeCommentPayload($payload, $isStaff, $isPrimaryAdmin)
  {
    if (!$isStaff) {
      unset($payload['dbId'], $payload['userId'], $payload['status'], $payload['emailHash']);
      return $payload;
    }

    if (!$isPrimaryAdmin) {
      $hasEmailHash = isset($payload['emailHash']) && trim((string) $payload['emailHash']) !== '';
      unset($payload['emailHash']);
      if ($hasEmailHash) {
        $payload['hasEmail'] = true;
      }
    }

    return $payload;
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
