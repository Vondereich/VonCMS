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

$rawDir = dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
$scriptDir = trim(str_replace('\\', '/', $rawDir), '/.');
$basePath = $scriptDir === '' ? '/' : '/' . $scriptDir . '/';

require_once __DIR__ . '/seo_route_helper.php';
require_once __DIR__ . '/seo_response_helper.php';

// ============================================
// ULTRA-EARLY INTERCEPTOR: Robots, Sitemap & RSS
// ============================================
// Catch exact install-root crawler routes before heavy security and SEO logic.
if (isset($_SERVER['REQUEST_URI'])) {
  $seoEndpointFile = voncms_match_seo_endpoint($_SERVER['REQUEST_URI'], $basePath);
  if ($seoEndpointFile !== null) {
    $seoEndpointTarget = __DIR__ . '/' . $seoEndpointFile;
    if (file_exists($seoEndpointTarget)) {
      header('X-VonCMS-Source: SEO-Engine-Ultra');
      require_once $seoEndpointTarget;
      exit();
    }
  }
}

// ============================================
// SECURITY: Block /install if already installed
// ============================================
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$currentPath = voncms_request_path($requestUri);
if ($basePath !== '/' && stripos($currentPath, $basePath) === 0) {
  $currentPath = substr($currentPath, strlen($basePath));
}
$currentPath = trim($currentPath, '/');
$path = $currentPath;

if (in_array(strtolower($currentPath), ['index.html', 'index.php'], true)) {
  voncms_send_redirect($basePath);
}

// ============================================
// CANONICAL REDIRECT (Trailing Slashes & Double Slashes)
// ============================================
$canonicalRedirectLocation = voncms_canonical_redirect_location(
  $requestUri,
  $_SERVER['QUERY_STRING'] ?? '',
  $basePath,
  $currentPath,
);
if ($canonicalRedirectLocation !== null) {
  voncms_send_redirect($canonicalRedirectLocation);
}

// ============================================
// CORE RUNTIME HELPERS
// ============================================
// Initialise the security layer before installation and maintenance checks.
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/media_variants.php';
require_once __DIR__ . '/content_metrics_helper.php';
require_once __DIR__ . '/scheduler_helper.php';
require_once __DIR__ . '/seo_schema_helper.php';

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
// ============================================
// MAINTENANCE MODE (File-based Check)
// ============================================
if (file_exists($maintenanceFlag)) {
  // SECURITY BYPASS:
  // 1. Allow /login and /admin (so you can reach the door)
  // 2. Allow logged-in ADMINS (so you can see the whole house)

  $isLoginOrAdminPath = preg_match('/^(login|admin)(\/|$)/i', $currentPath);
  $isAdminUser =
    SessionManager::isValid() && strtolower((string) ($_SESSION['user']['role'] ?? '')) === 'admin';

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
$isInstallPath = preg_match('/^install(\/|$)/i', $currentPath) === 1;

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
      $publicRedirect = voncms_resolve_public_redirect(
        $pdo,
        $_SERVER['REQUEST_URI'] ?? '/',
        $basePath,
        $_SERVER['HTTP_HOST'] ?? '',
      );
      if ($publicRedirect !== null) {
        voncms_record_public_redirect_hit($pdo, $publicRedirect['sourcePath']);
        voncms_send_redirect(
          $publicRedirect['location'],
          $publicRedirect['status'],
          'VonCMS-Public',
        );
      }
    } catch (Throwable $e) {
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
$seoImageKind = '';
$seoOgType = 'website';
$seoRobots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
$schemaData = null;
$homepagePosts = [];
$categoryLandingPosts = [];
$htmlLang = 'en'; // Global fallback for site language
$schemaLanguage = '';
$openGraphLocale = '';
$runtimeSettings = [];
$permalinkStructureValue = 'slug';
$activeThemeId = '';
$themeCustomization = null;
$discussionEnabledValue = true;
$timeZoneValue = 'UTC';
$dateFormatValue = 'month_day_year_long';
$siteName = $seoTitle;
$siteDescription = $seoDescription;
$logoUrl = '';
$headerIdentityMode = 'logo_and_text';
$useLogoAsTitle = false;
$faviconUrl = '';
$faviconVersion = '';
$adsenseVerification = '';
$seo = [];
$articleSchemaType = 'Article';
$rawDiscoveryQueryString = $_SERVER['QUERY_STRING'] ?? '';
$firstCategoryQueryValue = voncms_first_query_value($rawDiscoveryQueryString, 'category', 100);
$firstSearchQueryValue = voncms_first_query_value($rawDiscoveryQueryString, 'search', 120);
$selectedCategoryParam = $firstCategoryQueryValue ??
  voncms_normalize_discovery_query($_GET['category'] ?? '', 100);
$isCategoryLanding = $selectedCategoryParam !== '';
$selectedCategoryName = '';
$categoryPostCount = 0;
$homepageDiscoveryCategory = $selectedCategoryParam;
$homepageDiscoverySearch = $firstSearchQueryValue ??
  voncms_normalize_discovery_query($_GET['search'] ?? '', 120);
$hasHomepageDiscoverySearchQuery = voncms_has_nonempty_query_value(
  $rawDiscoveryQueryString,
  'search',
);
$hasHomepageDiscoveryQuery =
  $homepageDiscoveryCategory !== '' || $hasHomepageDiscoverySearchQuery;
if (voncms_is_private_spa_shell_route($path)) {
  $seoRobots = 'noindex, nofollow';
} elseif (voncms_is_homepage_path($path) && $hasHomepageDiscoverySearchQuery) {
  $seoRobots = 'noindex, follow';
}

// Initialize domain URL with safe default (fallback)
// This ensures $domainUrl is available even if DB connection fails (fresh install)
$protocol = is_https() ? 'https://' : 'http://';
$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
$domainUrl = rtrim($protocol . $host . $basePath, '/');
$seoUrl = $domainUrl . '/'; // Homepage is the canonical directory URL.

// Try to load site settings from database
try {
  if (file_exists($configFile)) {
    require_once $configFile;
    $publicContentCurrentTime = date('Y-m-d H:i:s');

    if (isset($pdo)) {
      $runtimeSettingsStmt = $pdo->prepare(
        "SELECT setting_group, setting_key, setting_value FROM settings
         WHERE (setting_group = 'general' AND setting_key IN ('site_language', 'site_name', 'site_description', 'domain_url', 'logo_url', 'header_identity_mode', 'use_logo_as_title', 'invert_logo_in_dark_mode', 'favicon_url', 'og_image_url', 'og_image_square_url', 'discussion_enabled', 'permalink_structure', 'time_zone', 'date_format'))
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
      $storedTimeZone = trim((string) ($runtimeSettings['general']['time_zone'] ?? ''));
      if (in_array($storedTimeZone, timezone_identifiers_list(), true)) {
        $timeZoneValue = $storedTimeZone;
      }
      $storedDateFormat = $runtimeSettings['general']['date_format'] ?? '';
      if (
        in_array(
          $storedDateFormat,
          [
            'month_day_year_long',
            'month_day_year_short',
            'day_month_year_long',
            'day_month_year_short',
            'day_month_year_numeric',
            'month_day_year_numeric',
            'iso',
          ],
          true,
        )
      ) {
        $dateFormatValue = $storedDateFormat;
      }
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
        $schemaLanguage = voncms_normalize_schema_language($siteLanguageValue);
        if ($schemaLanguage !== '') {
          $htmlLang = $schemaLanguage;
          if ($schemaLanguage === 'ms') {
            $openGraphLocale = 'ms_MY';
          } elseif (preg_match('/^[a-z]{2,3}-[A-Z]{2}$/', $schemaLanguage)) {
            $openGraphLocale = str_replace('-', '_', $schemaLanguage);
          }
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
      $useLogoAsTitle = filter_var(
        $runtimeSettings['general']['use_logo_as_title'] ?? false,
        FILTER_VALIDATE_BOOLEAN,
      );
      $storedHeaderIdentityMode = trim(
        (string) ($runtimeSettings['general']['header_identity_mode'] ?? ''),
      );
      if (
        in_array($storedHeaderIdentityMode, ['logo_and_text', 'logo_only', 'text_only'], true)
      ) {
        $headerIdentityMode = $storedHeaderIdentityMode;
        $useLogoAsTitle = $headerIdentityMode === 'logo_only';
      } else {
        $headerIdentityMode = $useLogoAsTitle ? 'logo_only' : 'logo_and_text';
      }
      $invertLogoInDarkMode = filter_var(
        $runtimeSettings['general']['invert_logo_in_dark_mode'] ?? false,
        FILTER_VALIDATE_BOOLEAN,
      );

      $faviconUrl = voncms_normalize_public_media_url(
        $runtimeSettings['general']['favicon_url'] ?? '',
      );
      $faviconUrl = voncms_absolute_public_url($faviconUrl, $domainUrl);
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
      $articleSchemaType = voncms_normalize_article_schema_type($seo['articleSchemaType'] ?? null);

      // Prepare Schema.org Data (VonSEO)
      $schemaData = [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $seoTitle,
        'url' => $seoUrl,
        'description' => $seoDescription,
      ];
      if (voncms_is_private_spa_shell_route($path)) {
        $schemaData = null;
      }

      if ($isCategoryLanding && voncms_is_homepage_path($path)) {
        $selectedCategoryName = $selectedCategoryParam;
        if ($selectedCategoryName === '') {
          $selectedCategoryName = 'Uncategorized';
        }

        try {
          $categoryMatch = voncms_fetch_public_category_match(
            $pdo,
            $selectedCategoryName,
            $publicContentCurrentTime,
          );
          $storedCategoryName = $categoryMatch['name'] ?? '';
          $categoryPostCount = $categoryMatch['postCount'] ?? 0;
          $categoryCaseFolded = $categoryMatch['caseFolded'] ?? false;
          if ($categoryPostCount > 0) {
            $canonicalCategoryQuery = voncms_build_category_canonical_query(
              $rawDiscoveryQueryString,
              $storedCategoryName,
            );
            if (
              $storedCategoryName !== '' &&
              ($storedCategoryName !== $selectedCategoryName ||
                $canonicalCategoryQuery !== $rawDiscoveryQueryString)
            ) {
              voncms_send_redirect($domainUrl . '/?' . $canonicalCategoryQuery);
            }
            if ($storedCategoryName !== '') {
              $selectedCategoryName = $storedCategoryName;
            }
            $categoryLandingPosts = voncms_fetch_category_landing_posts(
              $pdo,
              $selectedCategoryName,
              $publicContentCurrentTime,
              $permalinkStructureValue,
              $categoryCaseFolded,
            );
          }
        } catch (Throwable $categorySeoError) {
          $categoryPostCount = 0;
          $categoryLandingPosts = [];
        }

        $seoTitle = $selectedCategoryName . ' - ' . $siteName;
        $categoryDescriptionContext = trim((string) $siteDescription) !== ''
          ? $siteDescription
          : $siteName;
        $seoDescription = voncms_truncate_word_safe(
          $selectedCategoryName . ' - ' . $categoryDescriptionContext,
          160,
          '',
        );
        $seoUrl = $domainUrl . '/?category=' . rawurlencode($selectedCategoryName);
        $seoRobots = $categoryPostCount > 0 ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow';
        if ($hasHomepageDiscoverySearchQuery) {
          $seoRobots = 'noindex, follow';
        }
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
              voncms_send_redirect($domainUrl . $targetPath . $queryString);
            }
          }

          $cleanTitle = html_entity_decode($post['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
          $seoTitle = $cleanTitle . ' | ' . $seoTitle;

          $desc = voncms_pick_seo_description($post);
          $cleanDesc = voncms_clean_seo_description($desc);
          if ($cleanDesc !== '') {
            $seoDescription = $cleanDesc;
          }

          $seoImage = $post['image_url'] ?? '';
          $seoImageKind = 'featured';

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
            $domainUrl,
            $articleSchemaType,
            $schemaLanguage,
          );
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
          $profileAvatar = voncms_normalize_public_media_url($profileAvatar);
          $profileAvatar = voncms_absolute_public_url($profileAvatar, $domainUrl);
          $profilePath = '/profile/' . rawurlencode((string) ($profileUser['username'] ?? $profileUsername));

          $seoTitle = $profileName . ' | ' . $seoTitle;
          $seoDescription = $profileDescription;
          $seoImage = $profileAvatar;
          $seoImageKind = 'profile';
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

          $desc = voncms_pick_seo_description($post);
          $cleanDesc = voncms_clean_seo_description($desc);
          if ($cleanDesc !== '') {
            $seoDescription = $cleanDesc;
          }

          $seoImage = $post['image_url'] ?? '';
          $seoImageKind = $resolvedContentType === 'post' ? 'featured' : '';

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
              voncms_send_redirect($domainUrl . $canonicalPath . $canonicalQueryString);
            }

            $seoUrl = $domainUrl . $canonicalPath;
          } else {
            $canonicalPath = buildCanonicalContentPath($post, 'slug', 'page');
            $seoUrl = $domainUrl . $canonicalPath;
          }
          $seoOgType = $resolvedContentType === 'page' ? 'website' : 'article';
          voncms_apply_content_schema(
            $schemaData,
            $post,
            $resolvedContentType,
            $seoDescription,
            $seoImage,
            $seoUrl,
            $domainUrl,
            $articleSchemaType,
            $schemaLanguage,
          );
        }
      }

      $isPreheadNotFoundRoute =
        !empty($path) &&
        empty($post) &&
        empty($profileUser) &&
        !voncms_is_spa_shell_route($path);

      if ($isPreheadNotFoundRoute) {
        voncms_apply_not_found_response($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
      }

      // ============================================
      // HOMEPAGE SEO: Latest posts for noscript + Schema
      // ============================================
      if (empty($path)) {
        try {
          $hpStmt = $pdo->prepare("SELECT p.id, p.title, p.slug, CHAR_LENGTH(p.content) AS content_chars, p.excerpt, p.author, p.author_id, p.meta_description, p.keywords, p.image_url, p.category, p.created_at, p.updated_at, p.scheduled_at, CASE WHEN p.scheduled_at IS NOT NULL THEN p.scheduled_at ELSE p.created_at END AS effective_publish_at, $authorNameSql as author_name, u.username as author_username, $authorDisplayNameSql as author_display_name, u.avatar as author_avatar FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.status='published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?) ORDER BY effective_publish_at DESC, p.created_at DESC LIMIT 10");
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

            $hp['readTime'] = voncms_format_read_time((int) ($hp['content_chars'] ?? 0));
            unset($hp['content_chars']);
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

// Resolve one authoritative social image before emitting OG, Twitter, and JSON-LD.
$resolvedSocialImage = voncms_resolve_social_image(
  [
    ['url' => $seoImage, 'kind' => $seoImageKind],
    ['url' => $runtimeSettings['general']['og_image_url'] ?? '', 'kind' => 'large'],
    ['url' => $runtimeSettings['general']['og_image_square_url'] ?? '', 'kind' => 'square'],
    ['url' => $logoUrl, 'kind' => 'logo'],
  ],
  $domainUrl,
);
$seoImage = $resolvedSocialImage['url'];
$twitterCard = $resolvedSocialImage['card'];

if (is_array($schemaData)) {
  $schemaType = (string) ($schemaData['@type'] ?? '');
  if (in_array($schemaType, ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'], true)) {
    if ($seoImage !== '') {
      $schemaData['image'] = [
        [
          '@type' => 'ImageObject',
          'url' => $seoImage,
        ],
      ];
    } else {
      unset($schemaData['image']);
    }
  }
}
$seoImageWidth = 0;
$seoImageHeight = 0;
$seoImageParts = parse_url($seoImage);
$domainUrlParts = parse_url($domainUrl);
if (
  is_array($seoImageParts) &&
  is_array($domainUrlParts) &&
  !empty($seoImageParts['host']) &&
  !empty($domainUrlParts['host']) &&
  strcasecmp((string) $seoImageParts['host'], (string) $domainUrlParts['host']) === 0 &&
  (int) ($seoImageParts['port'] ?? 0) === (int) ($domainUrlParts['port'] ?? 0)
) {
  $seoImagePath = rawurldecode((string) ($seoImageParts['path'] ?? ''));
  $domainBasePath = rtrim((string) ($domainUrlParts['path'] ?? ''), '/');
  if ($domainBasePath !== '' && str_starts_with($seoImagePath, $domainBasePath . '/')) {
    $seoImagePath = substr($seoImagePath, strlen($domainBasePath));
  }

  $publicRootPath = realpath(__DIR__);
  $localImagePath = realpath(
    __DIR__ .
      DIRECTORY_SEPARATOR .
      ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $seoImagePath), DIRECTORY_SEPARATOR),
  );
  if (
    $publicRootPath !== false &&
    $localImagePath !== false &&
    str_starts_with($localImagePath, $publicRootPath . DIRECTORY_SEPARATOR) &&
    is_file($localImagePath)
  ) {
    $imageDimensions = @getimagesize($localImagePath);
    if (is_array($imageDimensions)) {
      $seoImageWidth = max(0, (int) ($imageDimensions[0] ?? 0));
      $seoImageHeight = max(0, (int) ($imageDimensions[1] ?? 0));
    }
  }
}
if (
  $seoImageWidth > 0 &&
  $seoImageHeight > 0 &&
  is_array($schemaData) &&
  isset($schemaData['image'][0]) &&
  is_array($schemaData['image'][0])
) {
  $schemaData['image'][0]['width'] = $seoImageWidth;
  $schemaData['image'][0]['height'] = $seoImageHeight;
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
  $faviconHref = !empty($faviconUrl)
    ? $faviconUrl
    : (is_file(__DIR__ . '/favicon.ico') ? $basePath . 'favicon.ico' : '');
  if (!empty($faviconVersion)) {
    $faviconHref .= (strpos($faviconHref, '?') !== false ? '&' : '?') . 'v=' . $faviconVersion;
  }
  ?>
  <?php if ($faviconHref !== ''): ?>
  <link rel="icon" href="<?php echo htmlspecialchars($faviconHref, ENT_COMPAT, 'UTF-8', false); ?>" />
  <?php endif; ?>

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
  <?php $socialImage = $seoImage; ?>
  <?php if ($socialImage !== ''): ?>
  <meta property="og:image" content="<?php echo htmlspecialchars($socialImage, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:image:alt" content="<?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if ($seoImageWidth > 0 && $seoImageHeight > 0): ?>
  <meta property="og:image:width" content="<?php echo $seoImageWidth; ?>">
  <meta property="og:image:height" content="<?php echo $seoImageHeight; ?>">
  <?php endif; ?>
  <?php endif; ?>
  <meta property="og:url" content="<?php echo htmlspecialchars($seoUrl, ENT_COMPAT, 'UTF-8', false); ?>">
  <link rel="canonical" href="<?php echo htmlspecialchars($seoUrl, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if (isset($domainUrl) && !empty($domainUrl)): ?>
  <link rel="alternate" type="application/rss+xml" href="<?php echo htmlspecialchars($domainUrl, ENT_COMPAT, 'UTF-8', false); ?>/rss.xml" title="<?php echo htmlspecialchars($siteName ?? 'RSS Feed', ENT_COMPAT, 'UTF-8', false); ?> RSS Feed">
  <?php endif; ?>
  <meta property="og:site_name" content="<?php echo htmlspecialchars($siteName ?? $seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta property="og:type" content="<?php echo htmlspecialchars($seoOgType, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if ($openGraphLocale !== ''): ?>
  <meta property="og:locale" content="<?php echo htmlspecialchars($openGraphLocale, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php endif; ?>

  <!-- Twitter Card -->
  <meta name="twitter:card" content="<?php echo $twitterCard; ?>">
  <meta name="twitter:title" content="<?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta name="twitter:description" content="<?php echo htmlspecialchars($seoDescription, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php if ($socialImage !== ''): ?>
  <meta name="twitter:image" content="<?php echo htmlspecialchars($socialImage, ENT_COMPAT, 'UTF-8', false); ?>">
  <meta name="twitter:image:alt" content="<?php echo htmlspecialchars($seoTitle, ENT_COMPAT, 'UTF-8', false); ?>">
  <?php endif; ?>

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
    <script type="application/ld+json" class="vp-seo" data-voncms-schema-source="ssr" data-voncms-schema-url="<?php echo htmlspecialchars($seoUrl, ENT_QUOTES, 'UTF-8'); ?>">
      <?php
      $additionalSchemaNodes = [];
      if (
        $isCategoryLanding &&
        voncms_is_homepage_path($path) &&
        !empty($categoryLandingPosts) &&
        (($schemaData['@type'] ?? '') === 'CollectionPage')
      ) {
        voncms_apply_category_collection_items(
          $schemaData,
          $categoryLandingPosts,
          $categoryPostCount,
          $articleSchemaType,
          $domainUrl,
        );
      }

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
          $homepageItem = [
            '@type' => $articleSchemaType,
            'name' => $cleanName,
            'url' => $domainUrl . $hp['url'],
            'description' => voncms_truncate_word_safe($cleanExcerpt, 200),
          ];
          $homepageItemImage = voncms_normalize_public_media_url($hp['image_url'] ?? '');
          if ($homepageItemImage !== '') {
            $homepageItem['image'] = voncms_absolute_public_url($homepageItemImage, $domainUrl);
          }
          $seoItemList[] = [
            '@type' => 'ListItem',
            'position' => $idx + 1,
            'item' => $homepageItem,
          ];
        }
        $homepageCollectionPage['mainEntity'] = [
          '@type' => 'ItemList',
          'itemListElement' => $seoItemList
        ];
        $additionalSchemaNodes[] = $homepageCollectionPage;
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
        $additionalSchemaNodes[] = [
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
      $schemaData = voncms_build_site_identity_schema_graph(
        $schemaData,
        $siteName ?? $seoTitle,
        $siteDescription ?? $seoDescription,
        $domainUrl,
        $logoUrl,
        $additionalSchemaNodes,
      );
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
  $homepageHeroSizes = '100vw';

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
      $manifestHeroSizes = $themeManifest['performance']['homepageHeroSizes'] ?? null;
      if (
        $homepageHeroStrategy === 'first-post-image' &&
        is_string($manifestHeroSizes) &&
        $manifestHeroSizes !== '' &&
        strlen($manifestHeroSizes) <= 256 &&
        !preg_match('/[\x00-\x1F\x7F<>"\']/', $manifestHeroSizes)
      ) {
        $homepageHeroSizes = $manifestHeroSizes;
      }
      break;
    }
  }

  $heroPreloadHref = '';
  $heroPreloadSrcSet = '';
  if (
    voncms_is_homepage_path($path) &&
    !$hasHomepageDiscoveryQuery &&
    $homepageHeroStrategy === 'first-post-image' &&
    !empty($homepagePosts[0]['image'])
  ) {
    $normalizedHeroPreload = voncms_normalize_public_media_url($homepagePosts[0]['image']);
    $heroPreloadHref = voncms_absolute_public_url($normalizedHeroPreload, $domainUrl);
    $rawHeroSrcSet = trim((string) ($homepagePosts[0]['imageSrcSet'] ?? ''));
    if ($rawHeroSrcSet !== '') {
      $absoluteCandidates = [];
      foreach (explode(',', $rawHeroSrcSet) as $candidate) {
        if (preg_match('/^\s*(.+?)\s+(\d+w)\s*$/', $candidate, $matches)) {
          $normalizedCandidateUrl = voncms_normalize_public_media_url($matches[1]);
          $candidateUrl = voncms_absolute_public_url($normalizedCandidateUrl, $domainUrl);
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
    <link rel="preload" as="image" href="<?php echo htmlspecialchars($heroPreloadHref, ENT_QUOTES, 'UTF-8'); ?>"<?php if ($heroPreloadSrcSet !== ''): ?> imagesrcset="<?php echo htmlspecialchars($heroPreloadSrcSet, ENT_QUOTES, 'UTF-8'); ?>"<?php endif; ?> imagesizes="<?php echo htmlspecialchars($homepageHeroSizes, ENT_QUOTES, 'UTF-8'); ?>" fetchpriority="high">
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
                                      'ogImageUrl'            => $runtimeSettings['general']['og_image_url'] ?? '',
                                      'ogImageSquareUrl'      => $runtimeSettings['general']['og_image_square_url'] ?? '',
                                     'headerIdentityMode'   => $headerIdentityMode ?? 'logo_and_text',
                                     'useLogoAsTitle'       => $useLogoAsTitle ?? false,
                                     'invertLogoInDarkMode' => $invertLogoInDarkMode ?? false,
                                     'theme'                => $themeCustomization ?? (object)[],
                                     'seo'                  => [
                                       'articleSchemaType' => $articleSchemaType,
                                     ],
                                      'permalinkStructure'   => $permalinkStructureValue,
                                      'timeZone'              => $timeZoneValue,
                                      'dateFormat'            => $dateFormatValue,
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
        'readTime'         => voncms_calculate_read_time((string) ($post['content'] ?? '')),
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
        'scheduled_at'     => $post['scheduled_at']     ?? null,
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
      if (empty($isPreheadNotFoundRoute)) {
        voncms_apply_not_found_response($seoTitle, $seoDescription, $seoUrl, $seoRobots, $schemaData, $siteName ?? $seoTitle, $domainUrl, $path);
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
  <?php
  $categoryNoscriptLanding = $isCategoryLanding && voncms_is_homepage_path($path);
  $noscriptListingPosts = $categoryNoscriptLanding ? $categoryLandingPosts : $homepagePosts;
  $showNoscriptLogo = !empty($logoUrl) && $headerIdentityMode !== 'text_only';
  $showNoscriptTitle = $headerIdentityMode !== 'logo_only' || empty($logoUrl);
  ?>
  <?php if (isset($post) && !empty($post)): ?>
    <?php
    $noscriptPostContent = voncms_extract_plaintext_for_noscript($post['content'] ?? '');
    $noscriptPostParagraphs = preg_split('/\n{2,}/', $noscriptPostContent, -1, PREG_SPLIT_NO_EMPTY);
    if ($noscriptPostParagraphs === false) {
      $noscriptPostParagraphs = $noscriptPostContent === '' ? [] : [$noscriptPostContent];
    }
    ?>
    <noscript>
      <article class="voncms-noscript voncms-noscript-article">
        <header class="voncms-noscript-header">
          <a class="voncms-noscript-home" href="<?php echo htmlspecialchars($basePath, ENT_QUOTES, 'UTF-8'); ?>">Back to Home</a>
          <h1><?php echo htmlspecialchars($post['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?></h1>
        </header>
        <div class="voncms-noscript-content">
          <?php foreach ($noscriptPostParagraphs as $noscriptPostParagraph): ?>
            <p><?php echo nl2br(htmlspecialchars(trim($noscriptPostParagraph), ENT_QUOTES, 'UTF-8')); ?></p>
          <?php endforeach; ?>
        </div>
      </article>
    </noscript>
  <?php elseif ($categoryNoscriptLanding || !empty($noscriptListingPosts)): ?>
    <noscript>
      <div class="voncms-noscript">
        <header class="voncms-noscript-header">
          <?php if ($showNoscriptLogo): ?>
            <img class="voncms-noscript-logo" src="<?php echo htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8'); ?>" alt="<?php echo htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8'); ?>">
          <?php endif; ?>
          <?php if ($showNoscriptTitle): ?>
            <h1><?php echo htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8'); ?></h1>
          <?php else: ?>
            <h1 class="voncms-noscript-sr-only"><?php echo htmlspecialchars($seoTitle, ENT_QUOTES, 'UTF-8'); ?></h1>
          <?php endif; ?>
          <p><?php echo htmlspecialchars($seoDescription, ENT_QUOTES, 'UTF-8'); ?></p>
        </header>
        <main class="voncms-noscript-list">
          <?php foreach ($noscriptListingPosts as $hp): ?>
            <article class="voncms-noscript-item">
              <h2><a href="<?php echo htmlspecialchars(rtrim($basePath, '/') . $hp['url'], ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars($hp['title'], ENT_QUOTES, 'UTF-8'); ?></a></h2>
              <?php if (!empty($hp['excerpt'])): ?>
                <p><?php echo htmlspecialchars(voncms_truncate_word_safe(voncms_extract_plaintext_for_noscript($hp['excerpt']), 200), ENT_QUOTES, 'UTF-8'); ?></p>
              <?php endif; ?>
            </article>
          <?php endforeach; ?>
          <?php if ($categoryNoscriptLanding && empty($noscriptListingPosts)): ?>
            <p class="voncms-noscript-empty">No published articles were found in this category.</p>
          <?php endif; ?>
        </main>
      </div>
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
