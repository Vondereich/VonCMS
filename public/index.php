<?php

/**
 * VonCMS - Server-Side SEO Engine
 * Handles dynamic meta tags for better search engine crawling
 */

// PHP Version Enforcement (clear HTML error page)
if (version_compare(PHP_VERSION, '8.2.0', '<')) {
  http_response_code(500);
  exit('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VonCMS - PHP Version Error</title><style>body{font-family:system-ui,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;line-height:1.6}h1{color:#dc2626}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style></head><body><h1>VonCMS Requires PHP 8.2+</h1><p>Your server is running <code>' . htmlspecialchars(PHP_VERSION) . '</code>.</p><p>Please upgrade to <strong>PHP 8.2</strong> or higher via your hosting control panel, then refresh this page.</p></body></html>');
}

// ============================================
// ULTRA-EARLY INTERCEPTOR: Robots, Sitemap & RSS
// ============================================
// Catch these before any heavy SEO or security logic
if (isset($_SERVER['REQUEST_URI'])) {
  $uri = $_SERVER['REQUEST_URI'];
  // Strip query string for matching
  $uriPath = parse_url($uri, PHP_URL_PATH) ?? '';
  if (
    preg_match(
      '/(robots\.txt|llms\.txt|sitemap\.xml|rss|rss\.xml|feed|feed\.xml)$/i',
      $uriPath,
      $matches,
    )
  ) {
    $file = strtolower($matches[1]);
    $map = [
      'robots.txt' => 'robots.php',
      'llms.txt' => 'llms.php',
      'sitemap.xml' => 'sitemap.php',
      'rss' => 'rss.php',
      'rss.xml' => 'rss.php',
      'feed' => 'rss.php',
      'feed.xml' => 'rss.php',
    ];
    if (isset($map[$file])) {
      $target = __DIR__ . '/' . $map[$file];
      if (file_exists($target)) {
        header('X-VonCMS-Source: SEO-Engine-Ultra');
        require_once $target;
        exit();
      }
    }
  }
}

$rawDir = dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
$scriptDir = trim(str_replace('\\', '/', $rawDir), '/.');
$basePath = $scriptDir === '' ? '/' : '/' . $scriptDir . '/';

// ============================================
// SECURITY: Block /install if already installed
// ============================================
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$currentPath = (string)(parse_url($requestUri, PHP_URL_PATH) ?? '');
if ($basePath !== '/' && stripos($currentPath, $basePath) === 0) {
  $currentPath = substr($currentPath, strlen($basePath));
}
$currentPath = trim($currentPath, '/');
$path = $currentPath;

if (in_array(strtolower($currentPath), ['index.html', 'index.php'], true)) {
  header('Location: ' . $basePath, true, 301);
  exit();
}

// ============================================
// CANONICAL REDIRECT (Trailing Slashes & Double Slashes)
// ============================================
$rawPath = parse_url($requestUri, PHP_URL_PATH) ?? '';
if (strpos($rawPath, '//') !== false || ($rawPath !== '/' && substr($rawPath, -1) === '/')) {
  // Only redirect if not an API or Assets request to prevent breaking functionality
  if (!preg_match('/^\/?(api|assets)/i', $currentPath)) {
    $cleanUrl = $basePath . ltrim($currentPath, '/');
    // Safety: only redirect if it actually changes the URL path
    if ($rawPath !== $cleanUrl) {
      $queryString = isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '';
      header('Location: ' . $cleanUrl . $queryString, true, 301);
      exit();
    }
  }
}

// ============================================
// MAINTENANCE MODE (File-based Check)
// ============================================
// 1. Initialise Security Layer (Handles Session & Headers)
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/media_variants.php';
require_once __DIR__ . '/scheduler_helper.php';

$maintenanceFlag = __DIR__ . '/data/maintenance.flag';

// ============================================
// INSTALLATION ENFORCER (Fix for Nested Path Loophole)
// ============================================
$configFile = __DIR__ . '/von_config.php';
$lockFile = __DIR__ . '/install.lock';

if (!file_exists($configFile)) {
  // If config is missing but LOCK exists, block everything (Security Clamp)
  if (file_exists($lockFile)) {
    http_response_code(403);
    die('<h1>System Locked</h1><p>Manual intervention required. Configuration missing but installation is locked. Please restore <code>von_config.php</code>.</p>');
  }

  // Allow only: /install, /api/*, /assets/*
  // We use strict checking to prevent /install/install/ loops
  $isInstall = strtolower($currentPath) === 'install';
  $isApi = stripos($currentPath, 'api/') === 0;
  $isAssets = stripos($currentPath, 'assets/') === 0;

  if (!$isInstall && !$isApi && !$isAssets) {
    header('Location: ' . $basePath . 'install');
    exit();
  }
}
if (file_exists($maintenanceFlag)) {
  // SECURITY BYPASS:
  // 1. Allow /login and /admin (so you can reach the door)
  // 2. Allow logged-in ADMINS (so you can see the whole house)

  $isLoginOrAdminPath = preg_match('/^(login|admin)/', $currentPath);
  $isAdminUser =
    isset($_SESSION['user']) &&
    isset($_SESSION['user']['role']) &&
    strtolower($_SESSION['user']['role']) === 'admin';

  $bypass = $isLoginOrAdminPath || $isAdminUser;

  if (!$bypass) {

    http_response_code(503);
    header('Retry-After: 3600');

    // Simple standalone HTML
?>
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Site Maintenance</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #f8fafc;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }

        .card {
          background: white;
          padding: 2.5rem;
          border-radius: 1rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 450px;
          width: 90%;
        }

        h1 {
          color: #0f172a;
          margin: 0 0 1rem 0;
          font-size: 1.8rem;
        }

        p {
          margin: 0;
          line-height: 1.6;
        }

        .icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
      </style>
    </head>

    <body>
      <div class="card">
        <div class="icon">&#128736;&#65039;</div>
        <h1>Under Maintenance</h1>
        <p>We are currently performing scheduled maintenance to improve our systems. We will be back shortly.</p>
      </div>
    </body>

    </html>
    <?php exit();
  }
}

// SECURITY: Block /install route if config file exists (= already installed)
// We check file existence, not DB connection, because:
// - Config file or LOCK file presence = installation completed
// - DB may be temporarily down (maintenance/restart)
// - Don't want users accessing install wizard during DB outage
if (strtolower($currentPath) === 'install') {
  if (file_exists($configFile) || file_exists($lockFile)) {
    header('Location: ' . $basePath);
    exit();
  }
}
// ============================================
// DATABASE CONNECTION CHECK
// ============================================
$isInstallPath = strtolower($currentPath) === 'install' || stripos($currentPath, 'install') === 0;

// Only check if config exists AND not on install page
if (file_exists($configFile) && !$isInstallPath) {
  require_once $configFile;
  voncms_apply_site_timezone($pdo ?? null);

  // If config exists but $pdo is null = DB connection failed
  if (!isset($pdo) || $pdo === null) {
    // Check if credentials are actually configured (not empty defaults)
    if (!empty($db_host) && !empty($db_name)) {
      // Credentials exist but connection failed = show error
      http_response_code(503); ?>
      <!DOCTYPE html>
      <html lang="en">

      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Database Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f1f5f9;
          }

          .error-box {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }

          h1 {
            color: #dc2626;
            margin: 0 0 16px;
            font-size: 24px;
          }

          p {
            color: #64748b;
            margin: 0;
            line-height: 1.6;
          }
        </style>
      </head>

      <body>
        <div class="error-box">
          <h1>Error establishing a database connection</h1>
          <p>This either means that the database server is down, or the database credentials are incorrect.</p>
        </div>
      </body>

      </html>
<?php exit();
    }
    // If credentials empty = not installed yet, let it continue to install wizard
  }

  // ============================================
  if (isset($pdo) && $pdo) {
    voncms_run_scheduler_if_due($pdo, __DIR__ . '/data/scheduler.lock');
  }

  // VONSEO REDIRECT ENGINE (INTEGRATED)
  // ============================================
  if (isset($pdo) && $pdo) {
    try {
      $reqUri = $_SERVER['REQUEST_URI'] ?? '/';
      $parsed = parse_url($reqUri);
      $path = $parsed['path'] ?? '/';

      // Normalize subfolder path
      if (isset($basePath) && $basePath !== '/' && stripos($path, $basePath) === 0) {
        $path = substr($path, strlen($basePath));
      }
      if (empty($path) || $path[0] !== '/') {
        $path = '/' . $path;
      }
      $path = rtrim($path, '/') ?: '/';

      $publicRedirectIgnorePaths = ['/api/', '/assets/', '/uploads/', '/admin'];
      $skipPublicRedirect = false;
      foreach ($publicRedirectIgnorePaths as $ignorePath) {
        if (strpos($path, $ignorePath) === 0) {
          $skipPublicRedirect = true;
          break;
        }
      }
      if (!$skipPublicRedirect) {
        $stmt = $pdo->prepare(
          'SELECT target_url, redirect_type FROM redirects WHERE source_url = ? LIMIT 1',
        );
        $stmt->execute([$path]);
        $redirect = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($redirect) {
          $pdo
            ->prepare('UPDATE redirects SET hit_count = hit_count + 1 WHERE source_url = ?')
            ->execute([$path]);
          // Security validation for target
          $target = $redirect['target_url'];
          $code = (int) ($redirect['redirect_type'] ?? 301);
          $targetPathNormalized = (string) (parse_url($target, PHP_URL_PATH) ?? '');
          if (!empty($targetPathNormalized) && $targetPathNormalized[0] !== '/') {
            $targetPathNormalized = '/' . ltrim($targetPathNormalized, '/');
          }
          if ($targetPathNormalized !== '/' && $targetPathNormalized !== '') {
            $targetPathNormalized = rtrim($targetPathNormalized, '/');
          }

          // Validate redirect target: block empty, javascript:, data: URIs
          $targetHostNormalized = parse_url($target, PHP_URL_HOST);
          $currentHostNormalized = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
          $isSafe = !empty($target) && (
            $target[0] === '/' ||                                       // Relative path
            ($targetHostNormalized && strcasecmp($targetHostNormalized, $currentHostNormalized) === 0) || // Same domain
            filter_var($target, FILTER_VALIDATE_URL)                     // Valid external URL (admin-set)
          ) && !preg_match('/^(javascript|data|vbscript):/i', $target);
          $isSamePathLoop =
            $targetPathNormalized !== '' &&
            $targetPathNormalized === $path &&
            (empty($targetHostNormalized) || strcasecmp((string) $targetHostNormalized, $currentHostNormalized) === 0);

          if ($isSafe && !$isSamePathLoop) {
            header("Location: $target", true, $code);
            header('X-Redirect-By: VonCMS-Public');
            exit();
          }
        }
      }
    } catch (Exception $e) {
      /* Silent fail */
    }
  }
}

// ============================================
// BRANDING
// ============================================
header('X-Powered-By: VonCMS', true);

// ============================================
// SERVER-SIDE SEO ENGINE
// ============================================

// Default SEO values (white-label friendly)
$seoTitle = 'My Website';
$seoDescription = 'Built with CMS Core';
$seoImage = '';
$seoOgType = 'website';
$seoRobots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
$homepagePosts = [];
$htmlLang = 'en'; // Global fallback for site language
$runtimeSettings = [];
$permalinkStructureValue = 'slug';
$activeThemeId = '';
$themeCustomization = null;
$discussionEnabledValue = true;
$siteName = $seoTitle;
$siteDescription = $seoDescription;
$logoUrl = '';
$faviconUrl = '';
$faviconVersion = '';
$adsenseVerification = '';
$seo = [];
$selectedCategoryParam = trim((string) ($_GET['category'] ?? ''));
$isCategoryLanding = $selectedCategoryParam !== '';
$selectedCategoryName = '';
$categoryPostCount = 0;
$homepageDiscoveryCategory = $_GET['category'] ?? '';
$homepageDiscoverySearch = $_GET['search'] ?? '';
$hasHomepageDiscoveryQuery =
  (is_string($homepageDiscoveryCategory) && trim($homepageDiscoveryCategory) !== '') ||
  (is_string($homepageDiscoverySearch) && trim($homepageDiscoverySearch) !== '');

// Initialize domain URL with safe default (fallback)
// This ensures $domainUrl is available even if DB connection fails (fresh install)
$protocol = is_https() ? 'https://' : 'http://';
$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
$domainUrl = rtrim($protocol . $host . $basePath, '/');
$seoUrl = $domainUrl . '/'; // Homepage is the canonical directory URL.

if (!function_exists('voncms_category_slug')) {
  /**
   * @param mixed $category
   * @return string
   */
  function voncms_category_slug($category)
  {
    $categorySlug = html_entity_decode(trim((string) $category), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($categorySlug === '') {
      return 'uncategorized';
    }

    $categorySlug = function_exists('mb_strtolower')
      ? mb_strtolower($categorySlug, 'UTF-8')
      : strtolower($categorySlug);
    $categorySlug = preg_replace('/[^\p{L}\p{N}\s_-]+/u', '', $categorySlug);
    $categorySlug = str_replace('_', ' ', $categorySlug ?? '');
    $categorySlug = preg_replace('/\s+/u', '-', $categorySlug);
    $categorySlug = preg_replace('/-+/', '-', $categorySlug);
    $categorySlug = trim((string) $categorySlug, '-');

    return $categorySlug !== '' ? $categorySlug : 'uncategorized';
  }
}

if (!function_exists('voncms_is_homepage_path')) {
  /**
   * @param mixed $path
   * @return bool
   */
  function voncms_is_homepage_path($path)
  {
    return $path === '' || $path === '/';
  }
}

if (!function_exists('buildCanonicalContentPath')) {
  /**
   * @param array<string, mixed> $content
   * @param string $permalinkStyle
   * @param string $contentType
   * @return string
   */
  function buildCanonicalContentPath($content, $permalinkStyle, $contentType = 'post')
  {
    if ($contentType !== 'post') {
      return '/' . ltrim((string) ($content['slug'] ?? ''), '/');
    }

    $postSlug = $content['slug'] ?: $content['id'];
    switch ($permalinkStyle) {
      case 'category':
        $catSlug = voncms_category_slug($content['category'] ?? 'uncategorized');
        return '/' . $catSlug . '/' . $postSlug;
      case 'date':
      case 'day_name':
        $postDate = new DateTime(!empty($content['created_at']) ? $content['created_at'] : 'now');
        return (
          '/' .
          $postDate->format('Y') .
          '/' .
          $postDate->format('m') .
          '/' .
          $postDate->format('d') .
          '/' .
          $postSlug
        );
      case 'month_name':
        $postDate = new DateTime(!empty($content['created_at']) ? $content['created_at'] : 'now');
        return '/' . $postDate->format('Y') . '/' . $postDate->format('m') . '/' . $postSlug;
      case 'post_name':
      case 'slug':
        return '/' . $postSlug;
      case 'plain':
        return '/post/' . $content['id'];
      default:
        return '/' . $postSlug; // Fallback to slug (safer than /post/{id})
    }
  }
}

if (!function_exists('voncms_fetch_public_post')) {
  /**
   * @param PDO $pdo
   * @param string $slugOrId
   * @param bool $isId
   * @param string $currentTime
   * @param string $authorNameSql
   * @param string $authorDisplayNameSql
   * @return array<string, mixed>|null
   */
  function voncms_fetch_public_post($pdo, $slugOrId, $isId, $currentTime, $authorNameSql, $authorDisplayNameSql)
  {
    $lookupColumn = $isId ? 'p.id' : 'p.slug';
    $sql =
      'SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.image_url, p.category, p.created_at, p.updated_at, ' .
      $authorNameSql .
      ' as author_name, u.username as author_username, ' .
      $authorDisplayNameSql .
      ' as author_display_name, u.avatar as author_avatar FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE ' .
      $lookupColumn .
      " = ? AND (p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$slugOrId, $currentTime]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($post) ? $post : null;
  }
}

if (!function_exists('voncms_clean_seo_description')) {
  /**
   * @param mixed $description
   * @return string
   */
  function voncms_clean_seo_description($description)
  {
    $description = (string) $description;
    if ($description === '') {
      return '';
    }

    if (preg_match('/content=["\']([^"\']+)["\']/', $description, $matches)) {
      $description = $matches[1];
    }

    $description = strip_tags($description);
    $description = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $description = str_replace('"', "'", $description);

    return mb_substr($description, 0, 160);
  }
}

if (!function_exists('voncms_apply_content_schema')) {
  /**
   * @param mixed $schemaData
   * @param array<string, mixed> $content
   * @param string $contentType
   * @param string $seoDescription
   * @param string $seoImage
   * @param string $seoUrl
   * @param string $siteName
   * @param string $domainUrl
   * @param string $logoUrl
   * @return void
   */
  function voncms_apply_content_schema(&$schemaData, $content, $contentType, $seoDescription, $seoImage, $seoUrl, $siteName, $domainUrl, $logoUrl)
  {
    if (!is_array($schemaData)) {
      $schemaData = ['@context' => 'https://schema.org'];
    }

    $schemaTitle = html_entity_decode((string) ($content['title'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $schemaData['@type'] = $contentType === 'page' ? 'WebPage' : 'Article';
    $schemaData['name'] = $schemaTitle;
    $schemaData['headline'] = $schemaTitle;
    $schemaData['description'] = $seoDescription;
    $schemaData['url'] = $seoUrl;
    if ($seoImage !== '') {
      $schemaData['image'] = [$seoImage];
    }
    $schemaData['datePublished'] = !empty($content['created_at'])
      ? date('c', strtotime((string) $content['created_at']))
      : date('c');

    if (!empty($content['author_name']) || !empty($content['author'])) {
      $schemaAuthor = (string) ($content['author_name'] ?? $content['author']);
      $schemaAuthorUsername = (string) ($content['author_username'] ?? ($content['author'] ?? $schemaAuthor));
      $schemaData['author'] = [
        '@type' => 'Person',
        'name' => html_entity_decode($schemaAuthor, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'url' => $domainUrl . '/profile/' . rawurlencode($schemaAuthorUsername),
      ];
    }

    if ($contentType === 'post') {
      $schemaData['publisher'] = voncms_build_schema_publisher($siteName, $domainUrl, $logoUrl);
    }
    $schemaData['dateModified'] = !empty($content['updated_at'])
      ? date('c', strtotime((string) $content['updated_at']))
      : $schemaData['datePublished'];
  }
}

if (!function_exists('voncms_apply_404_seo_metadata')) {
  /**
   * @param mixed $seoTitle
   * @param mixed $seoDescription
   * @param mixed $seoUrl
   * @param mixed $seoRobots
   * @param mixed $schemaData
   * @param mixed $siteName
   * @param string $domainUrl
   * @param string $requestPath
   * @return void
   */
  function voncms_apply_404_seo_metadata(&$seoTitle, &$seoDescription, &$seoUrl, &$seoRobots, &$schemaData, $siteName, $domainUrl, $requestPath)
  {
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

if (!function_exists('voncms_is_spa_shell_route')) {
  /**
   * Keep PHP fallback aligned with React routes that can render without a
   * resolved public post/page/profile payload.
   *
   * @param mixed $path
   * @return bool
   */
  function voncms_is_spa_shell_route($path): bool
  {
    $normalizedPath = strtolower(trim((string) $path, '/'));
    if ($normalizedPath === '') {
      return true;
    }

    if (in_array($normalizedPath, ['login', 'install'], true)) {
      return true;
    }

    if (preg_match('#^admin(/|$)#i', $normalizedPath)) {
      return true;
    }

    return false;
  }
}

if (!function_exists('voncms_extract_plaintext_for_noscript')) {
  /**
   * @param mixed $content
   * @return string
   */
  function voncms_extract_plaintext_for_noscript($content)
  {
    $content = (string) $content;
    if ($content === '') {
      return '';
    }

    $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $content = preg_replace('/<(br|hr)\s*\/?>/i', "\n", $content);
    $content = preg_replace(
      '/<\/(p|div|section|article|blockquote|figure|figcaption|h[1-6]|li)>/i',
      "\n",
      $content,
    );
    $content = strip_tags($content);
    $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $content = str_replace("\xC2\xA0", ' ', $content);
    $content = preg_replace('/[ \t\r\f\v]+/', ' ', $content);
    $content = preg_replace("/\n[ \t]+/", "\n", $content);
    $content = preg_replace("/\n{3,}/", "\n\n", $content);

    return trim($content);
  }
}

if (!function_exists('voncms_absolute_public_url')) {
  /**
   * @param mixed $url
   * @param string $domainUrl
   * @return string
   */
  function voncms_absolute_public_url($url, $domainUrl)
  {
    $url = trim((string) $url);
    if ($url === '' || preg_match('/^https?:\/\//i', $url)) {
      return $url;
    }

    $relativeUrl = ltrim($url, '/');
    $domainPath = trim((string) (parse_url($domainUrl, PHP_URL_PATH) ?: ''), '/');
    if ($domainPath !== '') {
      $domainPrefix = $domainPath . '/';
      if (stripos($relativeUrl, $domainPrefix) === 0) {
        $relativeUrl = substr($relativeUrl, strlen($domainPrefix));
      } elseif (strcasecmp($relativeUrl, $domainPath) === 0) {
        $relativeUrl = '';
      }
    }

    return rtrim($domainUrl, '/') . ($relativeUrl === '' ? '' : '/' . $relativeUrl);
  }
}

if (!function_exists('voncms_build_schema_publisher')) {
  /**
   * @param string $siteName
   * @param string $domainUrl
   * @param string $logoUrl
   * @return array<string, mixed>
   */
  function voncms_build_schema_publisher($siteName, $domainUrl, $logoUrl)
  {
    $publisher = [
      '@type' => 'Organization',
      'name' => $siteName,
      'url' => $domainUrl,
    ];

    $absoluteLogoUrl = voncms_absolute_public_url($logoUrl, $domainUrl);
    if ($absoluteLogoUrl !== '') {
      $publisher['logo'] = [
        '@type' => 'ImageObject',
        'url' => $absoluteLogoUrl,
      ];
    }

    return $publisher;
  }
}

// Try to load site settings from database
try {
  if (file_exists($configFile)) {
    require_once $configFile;
    voncms_apply_site_timezone($pdo ?? null);
    $publicContentCurrentTime = date('Y-m-d H:i:s');

    if (isset($pdo)) {
      $runtimeSettingsStmt = $pdo->prepare(
        "SELECT setting_group, setting_key, setting_value FROM settings
         WHERE (setting_group = 'general' AND setting_key IN ('site_language', 'site_name', 'site_description', 'domain_url', 'logo_url', 'invert_logo_in_dark_mode', 'favicon_url', 'og_image_url', 'discussion_enabled', 'permalink_structure'))
            OR (setting_group = 'ads' AND setting_key = 'ads_config')
            OR (setting_group = 'seo' AND setting_key = 'site_config')
            OR (setting_group = 'theme' AND setting_key IN ('active_theme_id', 'customization'))",
      );
      $runtimeSettingsStmt->execute();
      foreach ($runtimeSettingsStmt->fetchAll(PDO::FETCH_ASSOC) as $settingRow) {
        $runtimeSettings[$settingRow['setting_group']][$settingRow['setting_key']] =
          $settingRow['setting_value'];
      }

      $permalinkStructureValue =
        $runtimeSettings['general']['permalink_structure'] ?? 'slug';
      $activeThemeId = $runtimeSettings['theme']['active_theme_id'] ?? '';
      $themeCustomizationRaw = $runtimeSettings['theme']['customization'] ?? '';
      if ($themeCustomizationRaw !== '') {
        $decodedThemeCustomization = json_decode($themeCustomizationRaw, true);
        if (is_array($decodedThemeCustomization)) {
          $themeCustomization = $decodedThemeCustomization;
        }
      }
      if (array_key_exists('discussion_enabled', $runtimeSettings['general'] ?? [])) {
        $discussionEnabledValue = filter_var(
          $runtimeSettings['general']['discussion_enabled'],
          FILTER_VALIDATE_BOOLEAN,
        );
      }

      $siteLanguageValue = $runtimeSettings['general']['site_language'] ?? '';
      if ($siteLanguageValue !== '') {
        $rawLang = strip_tags($siteLanguageValue);
        $langs = array_map('trim', explode(',', $rawLang));
        if (!empty($langs[0])) {
          $htmlLang = strtolower($langs[0]); // Ensure strict lowercase ISO code (e.g., 'ms' from 'ms, en')
        }
      }

      $siteNameValue = trim((string) ($runtimeSettings['general']['site_name'] ?? ''));
      if ($siteNameValue !== '') {
        $siteName = html_entity_decode($siteNameValue, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $seoTitle = $siteName;
      }

      $siteDescriptionValue = $runtimeSettings['general']['site_description'] ?? '';
      if ($siteDescriptionValue !== '') {
        $val = $siteDescriptionValue;
        // Smart Extract: If user pasted full tag, get only the content attribute
        if (preg_match('/content=["\']([^"\']+)["\']/', $val, $m)) {
          $val = $m[1];
        }

        // Triple-step sanitization for base site description
        $cleanSiteDesc = strip_tags($val);
        $cleanSiteDesc = html_entity_decode($cleanSiteDesc, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $cleanSiteDesc = str_replace('"', "'", $cleanSiteDesc);
        // Standard SEO limit: 160 chars
        $seoDescription = mb_substr($cleanSiteDesc, 0, 160);
        $siteDescription = $seoDescription;
      }

      $configuredDomainUrl = $runtimeSettings['general']['domain_url'] ?? '';
      if ($configuredDomainUrl !== '') {
        $domainUrl = rtrim($configuredDomainUrl, '/');
      }

      $logoUrl = $runtimeSettings['general']['logo_url'] ?? '';
      $invertLogoInDarkMode = filter_var(
        $runtimeSettings['general']['invert_logo_in_dark_mode'] ?? false,
        FILTER_VALIDATE_BOOLEAN,
      );

      $faviconUrl = $runtimeSettings['general']['favicon_url'] ?? '';
      if ($faviconUrl !== '') {
        // Cache-busting: Use file mtime if local, else hash of URL
        $localPath = __DIR__ . '/' . ltrim(parse_url($faviconUrl, PHP_URL_PATH) ?? '', '/');
        if (file_exists($localPath)) {
          $faviconVersion = filemtime($localPath);
        } else {
          $faviconVersion = substr(md5($faviconUrl), 0, 8);
        }
      }

      // Fallback if domain_url not set
      if (empty($domainUrl)) {
        $protocol = is_https() ? 'https://' : 'http://';
        $safeHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
        $domainUrl = rtrim($protocol . $safeHost . $basePath, '/');
      }
      $seoUrl = $domainUrl . '/';

      $adsConfigValue = $runtimeSettings['ads']['ads_config'] ?? '';
      if ($adsConfigValue !== '') {
        $adsSettings = json_decode($adsConfigValue, true);
        if ($adsSettings && !empty($adsSettings['adsenseVerification'])) {
          $adsenseVerification = $adsSettings['adsenseVerification'];
        }
      }

      $seoConfigValue = $runtimeSettings['seo']['site_config'] ?? '';
      if ($seoConfigValue !== '') {
        $seo = json_decode($seoConfigValue, true) ?: [];
      }

      // Prepare Schema.org Data (VonSEO)
      $schemaData = [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $seoTitle,
        'url' => $seoUrl,
        'description' => $seoDescription,
      ];

      if ($isCategoryLanding && voncms_is_homepage_path($path)) {
        $selectedCategoryName = html_entity_decode(
          strip_tags($selectedCategoryParam),
          ENT_QUOTES | ENT_HTML5,
          'UTF-8',
        );
        $selectedCategoryName = trim((string) preg_replace('/\s+/u', ' ', $selectedCategoryName));
        $selectedCategoryName = mb_substr($selectedCategoryName, 0, 100);
        if ($selectedCategoryName === '') {
          $selectedCategoryName = 'Uncategorized';
        }

        try {
          $categoryCountStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) AND category = :category",
          );
          $categoryCountStmt->bindValue(':currentTime', $publicContentCurrentTime);
          $categoryCountStmt->bindValue(':category', $selectedCategoryName);
          $categoryCountStmt->execute();
          $categoryPostCount = (int) $categoryCountStmt->fetchColumn();
        } catch (Throwable $categorySeoError) {
          $categoryPostCount = 0;
        }

        $seoTitle = $selectedCategoryName . ' - ' . $siteName;
        $seoDescription =
          $categoryPostCount > 0
            ? mb_substr(
              'Latest ' .
                $selectedCategoryName .
                ' articles, news, and updates on ' .
                $siteName .
                '.',
              0,
              160,
            )
            : mb_substr(
              'Browse ' .
                $selectedCategoryName .
                ' articles and updates on ' .
                $siteName .
                '.',
              0,
              160,
            );
        $seoUrl = $domainUrl . '/?category=' . rawurlencode($selectedCategoryName);
        $seoRobots = $categoryPostCount > 0 ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow';
        $schemaData = [
          '@context' => 'https://schema.org',
          '@type' => 'CollectionPage',
          'name' => $selectedCategoryName . ' - ' . $siteName,
          'url' => $seoUrl,
          'description' => $seoDescription,
        ];
      }

      $hasDisplayNameColumn = false;
      try {
        $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
        $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
      } catch (Throwable $e) {
        $hasDisplayNameColumn = false;
      }
      $authorNameSql = $hasDisplayNameColumn
        ? "COALESCE(NULLIF(u.display_name, ''), u.username)"
        : 'u.username';
      $authorDisplayNameSql = $hasDisplayNameColumn ? 'u.display_name' : 'NULL';

      // Parse URL to detect post/page slug
      $requestUri = $_SERVER['REQUEST_URI'] ?? '';
      $path = (string)(parse_url($requestUri, PHP_URL_PATH) ?? '');

      // Remove base path from URL
      if ($basePath !== '/' && strpos($path, $basePath) === 0) {
        $path = substr($path, strlen($basePath));
      }
      $path = trim($path, '/');

      // Check for /post/{slug} or /blog/{slug} pattern
      if (preg_match('/^(post|blog)\/([^\/]+)$/i', $path, $matches)) {
        $slugOrId = $matches[2];
        $isId = is_numeric($slugOrId);

        $post = voncms_fetch_public_post(
          $pdo,
          $slugOrId,
          $isId,
          $publicContentCurrentTime,
          $authorNameSql,
          $authorDisplayNameSql,
        );

        if ($post) {
          // Collapse any legacy /post|/blog route to the configured canonical permalink,
          // but avoid redirecting when the request is already on the canonical path.
          if (!empty($post['slug'])) {
            $targetPath = buildCanonicalContentPath(
              $post,
              $permalinkStructureValue,
              'post',
            );
            $normalizedRequestPath = '/' . ltrim($path, '/');
            if ($normalizedRequestPath !== $targetPath) {
              $queryString =
                isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING'])
                  ? '?' . $_SERVER['QUERY_STRING']
                  : '';
              header('Location: ' . $domainUrl . $targetPath . $queryString, true, 301);
              exit();
            }
          }

          $cleanTitle = html_entity_decode($post['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $seoTitle = $cleanTitle . ' | ' . $seoTitle;

          $desc = $post['meta_description'] ?: $post['excerpt'] ?: '';
          $cleanDesc = voncms_clean_seo_description($desc);
          if ($cleanDesc !== '') {
            $seoDescription = $cleanDesc;
          }

          $seoImage = $post['image_url'] ?? '';
          $seoImage = voncms_absolute_public_url($seoImage, $domainUrl);

          $seoOgType = 'article';

          // --------------------------------------------
          // Construct Absolute URLs for Open Graph
          // --------------------------------------------

          // Construct Full URL for og:url & Canonical
          // FIX: Use calculated permalink instead of mirroring the request path
          $canonicalPath = buildCanonicalContentPath(
            $post,
            $permalinkStructureValue,
            'post',
          );
          $seoUrl = $domainUrl . $canonicalPath;
          voncms_apply_content_schema(
            $schemaData,
            $post,
            'post',
            $seoDescription,
            $seoImage,
            $seoUrl,
            $siteName ?? $seoTitle,
            $domainUrl,
            $logoUrl,
          );
        } else {
          // SOFT 404 FIX: If URL looks like a post but not found, send 404
          http_response_code(404);
          voncms_apply_404_seo_metadata($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
        }
      }

      // Check for public profile route. Keep SSR profile SEO on public-safe fields only:
      // username, display_name, avatar, and bio. Do not expose role/email/joined date/internal IDs here.
      elseif (preg_match('/^profile\/([^\/]+)$/i', $path, $profileMatches)) {
        $profileUsername = rawurldecode($profileMatches[1]);
        $profileSelect = $hasDisplayNameColumn
          ? 'SELECT username, display_name, avatar, bio FROM users WHERE username = ? LIMIT 1'
          : 'SELECT username, NULL AS display_name, avatar, bio FROM users WHERE username = ? LIMIT 1';
        $stmt = $pdo->prepare($profileSelect);
        $stmt->execute([$profileUsername]);
        $profileUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($profileUser) {
          $profileDisplayName = trim((string) ($profileUser['display_name'] ?? ''));
          $profileName = html_entity_decode($profileDisplayName !== '' ? $profileDisplayName : (string) ($profileUser['username'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $profileBio = trim((string) ($profileUser['bio'] ?? ''));
          $profileDescription = $profileBio !== ''
            ? html_entity_decode(strip_tags($profileBio), ENT_QUOTES | ENT_HTML5, 'UTF-8')
            : 'Profile of ' . $profileName . ' on ' . ($siteName ?? $seoTitle);
          $profileDescription = mb_substr(str_replace('"', "'", $profileDescription), 0, 160);
          $profileAvatar = ResponseHelper::scrubAvatarUrl((string) ($profileUser['avatar'] ?? ''));
          $profileAvatar = voncms_absolute_public_url($profileAvatar, $domainUrl);
          $profilePath = '/profile/' . rawurlencode((string) ($profileUser['username'] ?? $profileUsername));

          $seoTitle = $profileName . ' | ' . $seoTitle;
          $seoDescription = $profileDescription;
          $seoImage = $profileAvatar;
          $seoUrl = $domainUrl . $profilePath;
          $seoOgType = 'profile';
          $schemaPerson = [
            '@type' => 'Person',
            'name' => $profileName,
            'url' => $seoUrl,
          ];
          if ($profileDescription !== '') {
            $schemaPerson['description'] = $profileDescription;
          }
          if (!empty($profileAvatar)) {
            $schemaPerson['image'] = $profileAvatar;
          }
          $schemaData = [
            '@context' => 'https://schema.org',
            '@type' => 'ProfilePage',
            'name' => $profileName . ' | ' . ($siteName ?? 'Profile'),
            'url' => $seoUrl,
            'description' => $profileDescription,
            'mainEntity' => $schemaPerson,
          ];
        } else {
          http_response_code(404);
          voncms_apply_404_seo_metadata($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
        }
      }

      // Check for plain slug (could be post or page)
      // Reserved words: only actual PHP endpoints (admin, api, login, etc.)
      // NOT SPA routes: search, tags, category, page are handled by React SPA
      elseif (!empty($path) && !preg_match('/^(admin|api|login|install|assets|profile|register|reset-password)(\/|$)/', $path)) {
        // Handle Permalink Structures (Date/Category/Plain)
        // e.g. /2023/12/my-slug or /category/my-slug -> extract 'my-slug'
        $slugOrId = basename($path);
        $isId = is_numeric($slugOrId);
        $resolvedContentType = 'post';

        // Try posts first
        $post = voncms_fetch_public_post(
          $pdo,
          $slugOrId,
          $isId,
          $publicContentCurrentTime,
          $authorNameSql,
          $authorDisplayNameSql,
        );

        if (!$post) {
          // Try pages
          $stmt = $pdo->prepare(
            "SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.created_at, p.updated_at, p.status, $authorNameSql AS author_name, u.username AS author_username, $authorDisplayNameSql AS author_display_name, u.avatar AS author_avatar FROM pages p LEFT JOIN users u ON p.author_id = u.id WHERE p.slug = ? AND p.status = 'published' LIMIT 1"
          );
          $stmt->execute([$path]);
          $post = $stmt->fetch(PDO::FETCH_ASSOC);
          if ($post) {
            $resolvedContentType = 'page';
          }
        }

        if ($post) {
          $cleanTitle = html_entity_decode($post['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $seoTitle = $cleanTitle . ' | ' . $seoTitle;

          $desc = $post['meta_description'] ?? ($post['excerpt'] ?? ($post['content'] ?? ''));
          $cleanDesc = voncms_clean_seo_description($desc);
          if ($cleanDesc !== '') {
            $seoDescription = $cleanDesc;
          }

          $seoImage = $post['image_url'] ?? '';

          // Previous Logo Fallback Removed via cleanup -
          // We now enforce og-default.jpg later for consistent 1200x630 sizing

          // --------------------------------------------
          // Construct Absolute URLs for Open Graph (Plain Slug)
          // --------------------------------------------
          // $domainUrl is now defined globally above
          $canonicalQueryString =
            isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING'])
              ? '?' . $_SERVER['QUERY_STRING']
              : '';

          if ($resolvedContentType === 'post') {
            $canonicalPath = buildCanonicalContentPath(
              $post,
              $permalinkStructureValue,
              'post',
            );
            $normalizedRequestPath = '/' . ltrim($path, '/');

            // Canonical Permalink Redirect: keep fallback slug matching, but always collapse to the official permalink.
            if ($normalizedRequestPath !== $canonicalPath) {
              header('Location: ' . $domainUrl . $canonicalPath . $canonicalQueryString, true, 301);
              exit();
            }

            $seoUrl = $domainUrl . $canonicalPath;
          } else {
            $canonicalPath = buildCanonicalContentPath($post, 'slug', 'page');
            $seoUrl = $domainUrl . $canonicalPath;
          }
          // Construct Absolute Image URL for og:image
          $seoImage = voncms_absolute_public_url($seoImage, $domainUrl);

          $seoOgType = $resolvedContentType === 'page' ? 'website' : 'article';
          voncms_apply_content_schema(
            $schemaData,
            $post,
            $resolvedContentType,
            $seoDescription,
            $seoImage,
            $seoUrl,
            $siteName ?? $seoTitle,
            $domainUrl,
            $logoUrl,
          );
        } else {
          // SOFT 404 FIX: If URL looks like a slug but not found in Posts or Pages
          http_response_code(404);
          voncms_apply_404_seo_metadata($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
        }
      }

      $isPreheadNotFoundRoute =
        !empty($path) &&
        empty($post) &&
        empty($profileUser) &&
        !voncms_is_spa_shell_route($path);

      if ($isPreheadNotFoundRoute) {
        http_response_code(404);
        voncms_apply_404_seo_metadata($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
      }

      // ============================================
      // HOMEPAGE SEO: Latest posts for noscript + Schema
      // ============================================
      if (empty($path)) {
        try {
          $hpStmt = $pdo->prepare("SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.image_url, p.category, p.created_at, p.updated_at, CASE WHEN p.scheduled_at IS NOT NULL THEN p.scheduled_at ELSE p.created_at END AS effective_publish_at, $authorNameSql as author_name, u.username as author_username, $authorDisplayNameSql as author_display_name, u.avatar as author_avatar FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.status='published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) ORDER BY effective_publish_at DESC, p.created_at DESC LIMIT 5");
          $hpStmt->execute([$publicContentCurrentTime]);
          $homepagePosts = $hpStmt->fetchAll(PDO::FETCH_ASSOC);

          foreach ($homepagePosts as &$hp) {
            $responsiveImage = voncms_build_responsive_image_data($hp['image_url'] ?? '', __DIR__ . '/uploads/');
            $hp['image'] = !empty($hp['image_url']) ? ResponseHelper::scrubUrl($hp['image_url']) : '';
            $hp['imageSrcSet'] = $responsiveImage['srcSet'];

            // Smart Author Detection: display byline can differ from stable username route.
            $hp['author'] = $hp['author_name'] ?? ($hp['author'] ?? '');
            $hp['author_data'] = [
              'username' => $hp['author_username'] ?? ($hp['author'] ?? ''),
              'display_name' => $hp['author_display_name'] ?? '',
              'avatar'   => ResponseHelper::scrubAvatarUrl($hp['author_avatar'] ?? '')
            ];

            $chars = isset($hp['content']) ? strlen(strip_tags($hp['content'])) : 0;
            $hp['readTime'] = max(1, ceil($chars / 1000)) . ' min read';
            unset($hp['content']); // Remove from payload to save memory and frontend size
            $hpSlug = $hp['slug'] ?: $hp['id'];
            $hp['url'] = ''; // Wait for switch statement
            switch ($permalinkStructureValue) {
              case 'date':
              case 'day_name':
                $hpD = new DateTime($hp['created_at']);
                $hp['url'] = '/' . $hpD->format('Y') . '/' . $hpD->format('m') . '/' . $hpD->format('d') . '/' . $hpSlug;
                break;
              case 'month_name':
                $hpD = new DateTime($hp['created_at']);
                $hp['url'] = '/' . $hpD->format('Y') . '/' . $hpD->format('m') . '/' . $hpSlug;
                break;
              case 'category':
                $hpCat = voncms_category_slug($hp['category'] ?? 'uncategorized');
                $hp['url'] = '/' . $hpCat . '/' . $hpSlug;
                break;
              case 'post_name':
              case 'slug':
                $hp['url'] = '/' . $hpSlug;
                break;
              case 'plain':
                $hp['url'] = '/post/' . $hp['id'];
                break;
              default:
                $hp['url'] = '/' . $hpSlug; // Fallback to slug (consistent with canonical/content routing)
                break;
            }

            $hp = ResponseHelper::shapeContentPayload($hp, false);
          }
          unset($hp);
        } catch (Exception $e) {
          $homepagePosts = [];
        }
      }
    }
  }
} catch (Exception $e) {
  // Silently fail - use defaults
}

// ============================================
// AUTO-DETECT ASSET FILENAMES
// ============================================
$assetsDir = __DIR__ . '/assets/';

// FINAL FALLBACK & SPECS FOR OG:IMAGE
if (empty($seoImage)) {
  $seoImage = trim((string) ($runtimeSettings['general']['og_image_url'] ?? ''));
  if (preg_match('/content=["\']([^"\']+)["\']/', $seoImage, $matches)) {
    $seoImage = $matches[1];
  }
  if ($seoImage === '') {
    $seoImage = $domainUrl . '/og-default.png';
  } else {
    $seoImage = voncms_absolute_public_url($seoImage, $domainUrl);
  }
}
$jsFile = '';
$cssFile = '';

if (is_dir($assetsDir)) {
  $files = scandir($assetsDir);
  foreach ($files as $file) {
    if (preg_match('/^index-.*\.js$/', $file)) {
      $jsFile = $file;
    }
    if (preg_match('/^index-.*\.css$/', $file)) {
      $cssFile = $file;
    }
  }
}

// Fallback if not found
if (!$jsFile) {
  $jsFile = 'index.js';
}
if (!$cssFile) {
  $cssFile = 'index.css';
}

// Asset Prefixer for Root Shim
$assetPrefix = (defined('VON_ROOT_SHIM') && VON_ROOT_SHIM) ? 'dist/assets/' : 'assets/';
?>
<!DOCTYPE html>
<html lang="<?php echo htmlspecialchars($htmlLang ?? 'en', ENT_COMPAT, 'UTF-8', false); ?>">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="<?php echo htmlspecialchars($seoRobots, ENT_COMPAT, 'UTF-8', false); ?>" />
  <?php
  $faviconHref = !empty($faviconUrl) ? $faviconUrl : $basePath . 'favicon.ico';
  if (!empty($faviconVersion)) {
    $faviconHref .= (strpos($faviconHref, '?') !== false ? '&' : '?') . 'v=' . $faviconVersion;
  }
  ?>
  <link rel="icon" href="<?php echo htmlspecialchars($faviconHref, ENT_COMPAT, 'UTF-8', false); ?>" />

  <!-- Dynamic SEO Meta Tags -->
  <title><?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?></title>
  <meta name="csrf-token" content="<?php echo CSRFProtection::getToken(); ?>">
  <meta name="description" content="<?php echo htmlspecialchars($seoDescription, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if (isset($post) && (!empty($post['author_name']) || !empty($post['author']))): ?>
    <meta name="author" content="<?php echo htmlspecialchars($post['author_name'] ?? $post['author'], ENT_COMPAT, 'UTF-8', false); ?>">
  <?php endif; ?>

  <!-- Open Graph / Social Media -->
  <meta property="og:title" content="<?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:description" content="<?php echo htmlspecialchars($seoDescription, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php
  $socialImage = $seoImage;
  $twitterCard = !empty($socialImage) ? 'summary_large_image' : 'summary';
  ?>
  <meta property="og:image" content="<?php echo htmlspecialchars($socialImage, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:image:alt" content="<?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:url" content="<?php echo htmlspecialchars($seoUrl, ENT_COMPAT, 'UTF-8', false); ?>">
  <link rel="canonical" href="<?php echo htmlspecialchars($seoUrl, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if (isset($domainUrl) && !empty($domainUrl)): ?>
  <link rel="alternate" type="application/rss+xml" href="<?php echo htmlspecialchars($domainUrl, ENT_COMPAT, 'UTF-8', false); ?>/rss.xml" title="<?php echo htmlspecialchars($siteName ?? 'RSS Feed', ENT_COMPAT, 'UTF-8', false); ?> RSS Feed">
  <?php endif; ?>
  <meta property="og:site_name" content="<?php echo htmlspecialchars($siteName ?? $seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:type" content="<?php echo htmlspecialchars($seoOgType, ENT_COMPAT, 'UTF-8', false); ?>">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="<?php echo $twitterCard; ?>">
  <meta name="twitter:image" content="<?php echo htmlspecialchars($socialImage, ENT_COMPAT, 'UTF-8', false); ?>">

  <!-- Google Search Console Verification -->
  <?php if (!empty($seo['googleSearchConsole'])):

    $gsc = $seo['googleSearchConsole'];
    // Smart Extract: If user pasted full tag, get only the content attribute
    if (preg_match('/content=["\']([^"\']+)["\']/', $gsc, $m)) {
      $gsc = $m[1];
    }
  ?>
    <meta name="google-site-verification" content="<?php echo htmlspecialchars($gsc, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php
  endif; ?>

  <?php if (!empty($adsenseVerification)):
    $adv = $adsenseVerification;
    // Smart Extract: If user pasted full tag, get only the content attribute
    if (preg_match('/content=["\']([^"\']+)["\']/', $adv, $m)) {
      $adv = $m[1];
    }
    // Also handle if user pasted "ca-pub-..." or "pub-..." directly.
    // Ensure we have the "ca-pub" prefix if it's missing.
    // SMART FIX: If user pasted a full ads.txt line (domain, pub-id, relation, cert), extract only the pub-id.
    if (preg_match('/pub-\d+/', $adv, $m)) {
      $adv = $m[0];
    }
    // Prepend 'ca-' if it's missing but pub- is present
    if (stripos($adv, 'pub-') === 0) {
      $adv = 'ca-' . $adv;
    }
  ?>
    <!-- Google AdSense Verification -->
    <meta name="google-adsense-account" content="<?php echo htmlspecialchars($adv, ENT_COMPAT, 'UTF-8', false); ?>">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?php echo htmlspecialchars($adv, ENT_COMPAT, 'UTF-8', false); ?>" crossorigin="anonymous"></script>
  <?php
  endif; ?>

  <?php if (!empty($schemaData)): ?>
    <!-- Schema.org JSON-LD (VonSEO) -->
    <script type="application/ld+json">
      <?php
      // Homepage Enhancement: Add ItemList of latest posts
      if (voncms_is_homepage_path($path) && !$hasHomepageDiscoveryQuery && !empty($homepagePosts)) {
        $homepageCollectionPage = [
          '@type' => 'CollectionPage',
          'name' => $siteName,
          'url' => $domainUrl . '/',
          'description' => $siteDescription,
        ];
        $seoItemList = [];
        foreach ($homepagePosts as $idx => $hp) {
          $cleanName = html_entity_decode($hp['title'] ?? '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $cleanExcerpt = html_entity_decode(strip_tags($hp['excerpt'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $seoItemList[] = [
            '@type' => 'ListItem',
            'position' => $idx + 1,
            'item' => [
              '@type' => 'Article',
              'name' => $cleanName,
              'url' => $domainUrl . $hp['url'],
              'description' => mb_substr($cleanExcerpt, 0, 160),
              'image' => !empty($hp['image_url']) ? voncms_absolute_public_url($hp['image_url'], $domainUrl) : ''
            ]
          ];
        }
        $homepageCollectionPage['mainEntity'] = [
          '@type' => 'ItemList',
          'itemListElement' => $seoItemList
        ];
        $schemaData = [
          '@context' => 'https://schema.org',
          '@graph' => [
            $schemaData,
            $homepageCollectionPage
          ]
        ];
      }

      if (
        !empty($path) &&
        isset($post) &&
        $post &&
        (($resolvedContentType ?? 'post') === 'post')
      ) {
        $breadcrumbCategoryName = trim((string) ($post['category'] ?? ''));
        if ($breadcrumbCategoryName === '') {
          $breadcrumbCategoryName = 'Uncategorized';
        }
        $breadcrumbCategorySlug = voncms_category_slug($breadcrumbCategoryName);
        $breadcrumbPostName = html_entity_decode($post['title'] ?? $seoTitle, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $schemaData['breadcrumb'] = [
          '@type' => 'BreadcrumbList',
          'itemListElement' => [
            [
              '@type' => 'ListItem',
              'position' => 1,
              'name' => 'Home',
              'item' => $domainUrl,
            ],
            [
              '@type' => 'ListItem',
              'position' => 2,
              'name' => $breadcrumbCategoryName,
              'item' => $domainUrl . '/?category=' . rawurlencode($breadcrumbCategoryName),
            ],
            [
              '@type' => 'ListItem',
              'position' => 3,
              'name' => $breadcrumbPostName,
              'item' => $seoUrl ?: ($domainUrl . '/' . $breadcrumbCategorySlug . '/' . ($post['slug'] ?? $post['id'] ?? '')),
            ],
          ],
        ];
      }

      // Final safety: decode all top-level text fields to prevent &amp; chains
      foreach (['name', 'description', 'headline'] as $field) {
        if (!empty($schemaData[$field])) {
          $schemaData[$field] = html_entity_decode($schemaData[$field], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }
      }
      echo json_encode($schemaData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
      ?>
    </script>
  <?php endif; ?>


  <script>
    window.VON_BASE = '<?php echo $basePath; ?>';
  </script>
  <?php
  // 1.20.0 FIX: Settings Hydration to prevent default fallbacks in bot crawls
  $homepageHeroStrategy = '';

  $themeManifestPaths = [__DIR__ . '/themes/' . $activeThemeId . '/theme.json'];
  $sourceThemeManifestPaths = glob(dirname(__DIR__) . '/src/themes/*/theme.json');
  if (is_array($sourceThemeManifestPaths)) {
    $themeManifestPaths = array_merge($themeManifestPaths, $sourceThemeManifestPaths);
  }

  if (preg_match('/^[a-z0-9][a-z0-9-]*$/i', $activeThemeId)) {
    foreach ($themeManifestPaths as $themeManifestPath) {
      if (!is_file($themeManifestPath) || filesize($themeManifestPath) > 16384) {
        continue;
      }

      $themeManifestJson = file_get_contents($themeManifestPath);
      $themeManifest = is_string($themeManifestJson)
        ? json_decode($themeManifestJson, true)
        : null;
      if (!is_array($themeManifest) || ($themeManifest['id'] ?? '') !== $activeThemeId) {
        continue;
      }

      $manifestHeroStrategy = $themeManifest['performance']['homepageHero'] ?? '';
      $homepageHeroStrategy = $manifestHeroStrategy === 'first-post-image'
        ? 'first-post-image'
        : '';
      break;
    }
  }

  $homepageDiscoveryCategory = $_GET['category'] ?? '';
  $homepageDiscoverySearch = $_GET['search'] ?? '';
  $hasHomepageDiscoveryQuery =
    (is_string($homepageDiscoveryCategory) && trim($homepageDiscoveryCategory) !== '') ||
    (is_string($homepageDiscoverySearch) && trim($homepageDiscoverySearch) !== '');

  $heroPreloadHref = '';
  $heroPreloadSrcSet = '';
  if (
    voncms_is_homepage_path($path) &&
    !$hasHomepageDiscoveryQuery &&
    $homepageHeroStrategy === 'first-post-image' &&
    !empty($homepagePosts[0]['image'])
  ) {
    $heroPreloadHref = voncms_absolute_public_url($homepagePosts[0]['image'], $domainUrl);
    $rawHeroSrcSet = trim((string) ($homepagePosts[0]['imageSrcSet'] ?? ''));
    if ($rawHeroSrcSet !== '') {
      $absoluteCandidates = [];
      foreach (explode(',', $rawHeroSrcSet) as $candidate) {
        if (preg_match('/^\s*(.+?)\s+(\d+w)\s*$/', $candidate, $matches)) {
          $candidateUrl = voncms_absolute_public_url($matches[1], $domainUrl);
          if ($candidateUrl !== '') {
            $absoluteCandidates[] = $candidateUrl . ' ' . $matches[2];
          }
        }
      }
      $heroPreloadSrcSet = implode(', ', $absoluteCandidates);
    }
  }
  ?>
  <?php if ($heroPreloadHref !== ''): ?>
    <link rel="preload" as="image" href="<?php echo htmlspecialchars($heroPreloadHref, ENT_QUOTES, 'UTF-8'); ?>"<?php if ($heroPreloadSrcSet !== ''): ?> imagesrcset="<?php echo htmlspecialchars($heroPreloadSrcSet, ENT_QUOTES, 'UTF-8'); ?>"<?php endif; ?> imagesizes="100vw" fetchpriority="high">
  <?php endif; ?>
  <script>
    window.__INITIAL_SETTINGS__ = <?php echo json_encode([
                                    'siteName'             => $siteName ?? 'My Website',
                                    'siteDescription'      => $siteDescription ?? '',
                                    'domainUrl'            => $domainUrl ?? '',
                                     'siteUrl'              => $domainUrl ?? '',
                                     'activeThemeId'        => $activeThemeId ?: '',
                                     'faviconUrl'           => $faviconUrl ?? '',
                                    'logoUrl'              => $logoUrl ?? '',
                                    'invertLogoInDarkMode' => $invertLogoInDarkMode ?? false,
                                     'theme'                => $themeCustomization ?? (object)[],
                                    'permalinkStructure'   => $permalinkStructureValue,
                                    'discussionEnabled'      => $discussionEnabledValue,
                                  ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE); ?>;
  </script>
  <?php if (!empty($homepagePosts)): ?>
    <!-- Homepage posts seed - prevents "No results found" on slow API -->
    <script>
      window.__INITIAL_DATA__ = <?php echo json_encode($homepagePosts, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE); ?>;
    </script>
  <?php endif; ?>

  <?php
  // ============================================================
  // CONTENT HYDRATION (Prevent Soft 404 / Wrong First Render)
  // ============================================================
  $initialState = ['status' => 'idle', 'contentType' => null, 'post' => null, 'page' => null];

  if (!empty($path) && isset($post) && $post) {
    $hydratedType = ($resolvedContentType ?? 'post') === 'page' ? 'page' : 'post';

    if ($hydratedType === 'page') {
      $initialPagePayload = [
        'id'               => $post['id'] ?? 0,
        'title'            => $post['title'] ?? '',
        'slug'             => $post['slug'] ?? '',
        'content'          => $post['content'] ?? '',
        'excerpt'          => $post['excerpt'] ?? '',
        'meta_description' => $post['meta_description'] ?? '',
        'keywords'         => $post['keywords'] ?? '',
        'author'           => $post['author_name'] ?? ($post['author'] ?? ''),
        'author_data'      => [
          'username' => $post['author_username'] ?? ($post['author'] ?? ($post['author_name'] ?? '')),
          'display_name' => $post['author_display_name'] ?? '',
          'avatar'   => ResponseHelper::scrubAvatarUrl($post['author_avatar'] ?? ''),
        ],
        'author_id'        => isset($post['author_id']) ? (string) $post['author_id'] : null,
        'created_at'       => $post['created_at'] ?? '',
        'updated_at'       => $post['updated_at'] ?? '',
        'status'           => $post['status'] ?? 'published',
      ];
      $initialState = [
        'status'      => 'loaded',
        'contentType' => 'page',
        'slug'        => basename($path),
        'page'        => ResponseHelper::shapeContentPayload($initialPagePayload, false),
        'post'        => null,
      ];
    } else {
      // PHP fetched the post for SEO -> Pass it to React
      $initialResponsiveImage = voncms_build_responsive_image_data($post['image_url'] ?? '', __DIR__ . '/uploads/');
      $initialPostPayload = [
        'id'               => $post['id']               ?? 0,
        'title'            => $post['title']            ?? '',
        'slug'             => $post['slug']             ?? '',
        'content'          => $post['content']          ?? '',
        'excerpt'          => $post['excerpt']          ?? '',
        'readTime'         => max(1, ceil((strlen(strip_tags($post['content'] ?? ''))) / 1000)) . ' min read',
        'meta_description' => $post['meta_description'] ?? '',
        'image_url'        => $post['image_url']        ?? '',
        'imageSrcSet'      => $initialResponsiveImage['srcSet'],
        'category'         => $post['category']         ?? 'General',
        'author'           => $post['author_name']      ?? ($post['author'] ?? ''),
        'author_data'      => [
          'username' => $post['author_username'] ?? ($post['author'] ?? ($post['author_name'] ?? '')),
          'display_name' => $post['author_display_name'] ?? '',
          'avatar'   => ResponseHelper::scrubAvatarUrl($post['author_avatar'] ?? ''),
        ],
        'author_id'        => isset($post['author_id']) ? (string) $post['author_id'] : null,
        'created_at'       => $post['created_at']       ?? '',
        'updated_at'       => $post['updated_at']       ?? '',
        'keywords'         => $post['keywords']         ?? '',
      ];
      $initialState = [
        'status'      => 'loaded',
        'contentType' => 'post',
        'slug'        => basename($path),
        'post'        => ResponseHelper::shapeContentPayload($initialPostPayload, false),
        'page'        => null,
      ];
    }
  } elseif (!empty($path) && empty($post) && empty($profileUser)) {
    // SPA ROUTE SAFETY CHECK:
    // Don't mark as 404 if it's a known React shell route. Auth/setup routes are exact.
    // This prevents "Killer 404" where /login renders the NotFound page while
    // keeping /login/not-a-real-route, /register/*, and /install/* as real 404s.
    $isSpaRoute = voncms_is_spa_shell_route($path);

      if (!$isSpaRoute) {
        // URL exists but post not found AND not an App route -> It's a real 404
        http_response_code(404); // SOFT 404 FIX: Force HTTP header
        if (empty($isPreheadNotFoundRoute)) {
          voncms_apply_404_seo_metadata($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
        }
        $initialState = [
          'status'      => 'not_found',
          'contentType' => null,
          'slug'        => basename($path),
          'post'        => null,
          'page'        => null,
        ];
    }
  }
  ?>
  <!-- Single post hydration - prevents race condition NotFound on first render -->
  <script>
    window.__INITIAL_STATE__ = <?php echo json_encode(
                                  $initialState,
                                  JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE
                                ); ?>;
  </script>
  <style>
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 99px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .dark ::-webkit-scrollbar-thumb {
      background: #475569;
    }

    body {
      font-family: 'Inter', sans-serif;
      scroll-behavior: smooth;
    }

    .prose img {
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
  </style>

  <link rel="stylesheet" href="<?php echo $basePath . 'skeleton.css'; ?>" />
  <link rel="stylesheet" href="<?php echo $basePath . 'fonts/inter/inter.css'; ?>" />

  <!-- Theme Guard: Instant Dark Mode detection to prevent FOUC -->
  <script>
    (function() {
      const darkMode = localStorage.getItem('von_dark_mode') === 'true';
      if (darkMode) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
  <link rel="stylesheet" crossorigin href="<?php echo $basePath . $assetPrefix . $cssFile; ?>">

</head>

<body class="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
  <?php if (isset($post) && !empty($post)): ?>
    <?php $noscriptPostContent = voncms_extract_plaintext_for_noscript($post['content'] ?? ''); ?>
    <noscript>
      <article>
        <header>
          <h1><?php echo htmlspecialchars($post['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?></h1>
        </header>
        <div class="content"><?php echo nl2br(htmlspecialchars($noscriptPostContent, ENT_QUOTES, 'UTF-8')); ?></div>
      </article>
    </noscript>
  <?php elseif (!empty($homepagePosts)): ?>
    <noscript>
      <header>
        <?php if (!empty($logoUrl)): ?>
          <img src="<?php echo htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8'); ?>" alt="<?php echo htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8'); ?>" style="max-width: 140px; max-height: 45px; width: auto; height: auto; object-fit: contain;">
        <?php endif; ?>
        <h1><?php echo htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8'); ?></h1>
        <p><?php echo htmlspecialchars($seoDescription, ENT_QUOTES, 'UTF-8'); ?></p>
      </header>
      <main>
        <?php foreach ($homepagePosts as $hp): ?>
          <article>
            <h2><a href="<?php echo htmlspecialchars(rtrim($basePath, '/') . $hp['url'], ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($hp['title'], ENT_QUOTES, 'UTF-8'); ?></a></h2>
            <?php if (!empty($hp['excerpt'])): ?>
              <p><?php echo htmlspecialchars(mb_substr(strip_tags($hp['excerpt']), 0, 160), ENT_QUOTES, 'UTF-8'); ?></p>
            <?php endif; ?>
          </article>
        <?php endforeach; ?>
      </main>
    </noscript>
  <?php endif; ?>
  <noscript>
    <style>
      #root {
        display: none !important;
      }
    </style>
  </noscript>
  <div id="root">
    <div class="skeleton-loader" role="status" aria-label="Loading content" aria-busy="true">
      <div class="sk-nav"></div>
      <div class="sk-hero"></div>
      <div class="sk-grid">
        <div class="sk-card"></div>
        <div class="sk-card"></div>
        <div class="sk-card"></div>
        <div class="sk-card sk-card-tablet" aria-hidden="true"></div>
      </div>
    </div>
  </div>
  <script type="module" crossorigin src="<?php echo $basePath . $assetPrefix . $jsFile; ?>"></script>
</body>

</html>
