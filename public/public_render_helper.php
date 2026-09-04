<?php
/**
 * VonCMS - Public Render Helpers
 * Normalizes public runtime settings and resolves built frontend assets.
 */

$publicRenderHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($publicRenderHelperPath !== false && $requestedScriptPath === $publicRenderHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($publicRenderHelperPath, $requestedScriptPath);

require_once __DIR__ . '/seo_route_helper.php';
require_once __DIR__ . '/seo_schema_helper.php';

if (!function_exists('voncms_load_public_runtime_context')) {
  /**
   * Load and normalize the small settings subset required by public SSR.
   * Response decisions, redirects, and HTML output remain owned by index.php.
   *
   * @return array<string, mixed>
   */
  function voncms_load_public_runtime_context(
    PDO $pdo,
    string $basePath,
    string $path,
    int $publicListingPage,
    string $defaultDomainUrl,
    string $defaultSeoTitle,
    string $defaultSeoDescription,
  ): array {
    $runtimeSettings = [];
    $runtimeSettingsStmt = $pdo->prepare(
      "SELECT setting_group, setting_key, setting_value FROM settings
       WHERE (setting_group = 'general' AND setting_key IN ('site_language', 'site_name', 'site_description', 'domain_url', 'logo_url', 'header_identity_mode', 'use_logo_as_title', 'invert_logo_in_dark_mode', 'favicon_url', 'og_image_url', 'og_image_square_url', 'discussion_enabled', 'permalink_structure', 'time_zone', 'date_format', 'posts_per_page'))
          OR (setting_group = 'ads' AND setting_key = 'ads_config')
          OR (setting_group = 'seo' AND setting_key = 'site_config')
          OR (setting_group = 'theme' AND setting_key IN ('active_theme_id', 'customization'))",
    );
    $runtimeSettingsStmt->execute();
    foreach ($runtimeSettingsStmt->fetchAll(PDO::FETCH_ASSOC) as $settingRow) {
      $runtimeSettings[$settingRow['setting_group']][$settingRow['setting_key']] =
        $settingRow['setting_value'];
    }

    $generalSettings = $runtimeSettings['general'] ?? [];
    $permalinkStructure = (string) ($generalSettings['permalink_structure'] ?? 'slug');
    $listingLimit = max(6, min(50, (int) ($generalSettings['posts_per_page'] ?? 6)));
    $listingOffset = (max(1, $publicListingPage) - 1) * $listingLimit;

    $timeZone = 'UTC';
    $storedTimeZone = trim((string) ($generalSettings['time_zone'] ?? ''));
    if (in_array($storedTimeZone, timezone_identifiers_list(), true)) {
      $timeZone = $storedTimeZone;
    }

    $dateFormat = 'month_day_year_long';
    $storedDateFormat = (string) ($generalSettings['date_format'] ?? '');
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
      $dateFormat = $storedDateFormat;
    }

    $activeThemeId = (string) ($runtimeSettings['theme']['active_theme_id'] ?? '');
    $themeCustomization = null;
    $themeCustomizationRaw = (string) ($runtimeSettings['theme']['customization'] ?? '');
    if ($themeCustomizationRaw !== '') {
      $decodedThemeCustomization = json_decode($themeCustomizationRaw, true);
      if (is_array($decodedThemeCustomization)) {
        $themeCustomization = $decodedThemeCustomization;
      }
    }

    $discussionEnabled = true;
    if (array_key_exists('discussion_enabled', $generalSettings)) {
      $discussionEnabled = filter_var(
        $generalSettings['discussion_enabled'],
        FILTER_VALIDATE_BOOLEAN,
      );
    }

    $schemaLanguage = '';
    $htmlLang = 'en';
    $openGraphLocale = '';
    $siteLanguage = (string) ($generalSettings['site_language'] ?? '');
    if ($siteLanguage !== '') {
      $schemaLanguage = voncms_normalize_schema_language($siteLanguage);
      if ($schemaLanguage !== '') {
        $htmlLang = $schemaLanguage;
        if ($schemaLanguage === 'ms') {
          $openGraphLocale = 'ms_MY';
        } elseif (preg_match('/^[a-z]{2,3}-[A-Z]{2}$/', $schemaLanguage)) {
          $openGraphLocale = str_replace('-', '_', $schemaLanguage);
        }
      }
    }

    $seoTitle = $defaultSeoTitle;
    $siteName = $defaultSeoTitle;
    $siteNameValue = trim((string) ($generalSettings['site_name'] ?? ''));
    if ($siteNameValue !== '') {
      $siteName = html_entity_decode($siteNameValue, ENT_QUOTES | ENT_HTML5, 'UTF-8');
      $seoTitle = $siteName;
    }

    $seoDescription = $defaultSeoDescription;
    $siteDescription = $defaultSeoDescription;
    $siteDescriptionValue = (string) ($generalSettings['site_description'] ?? '');
    if ($siteDescriptionValue !== '') {
      if (preg_match('/content=["\']([^"\']+)["\']/', $siteDescriptionValue, $matches)) {
        $siteDescriptionValue = $matches[1];
      }
      $cleanSiteDescription = strip_tags($siteDescriptionValue);
      $cleanSiteDescription = html_entity_decode(
        $cleanSiteDescription,
        ENT_QUOTES | ENT_HTML5,
        'UTF-8',
      );
      $cleanSiteDescription = str_replace('"', "'", $cleanSiteDescription);
      $seoDescription = mb_substr($cleanSiteDescription, 0, 160);
      $siteDescription = $seoDescription;
    }

    $domainUrl = $defaultDomainUrl;
    $configuredDomainUrl = trim((string) ($generalSettings['domain_url'] ?? ''));
    if ($configuredDomainUrl !== '') {
      $domainUrl = rtrim($configuredDomainUrl, '/');
    }
    if ($domainUrl === '') {
      $protocol = function_exists('is_https') && is_https() ? 'https://' : 'http://';
      $safeHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
      $domainUrl = rtrim($protocol . $safeHost . $basePath, '/');
    }

    $logoUrl = (string) ($generalSettings['logo_url'] ?? '');
    $useLogoAsTitle = filter_var(
      $generalSettings['use_logo_as_title'] ?? false,
      FILTER_VALIDATE_BOOLEAN,
    );
    $headerIdentityMode = trim((string) ($generalSettings['header_identity_mode'] ?? ''));
    if (!in_array($headerIdentityMode, ['logo_and_text', 'logo_only', 'text_only'], true)) {
      $headerIdentityMode = $useLogoAsTitle ? 'logo_only' : 'logo_and_text';
    }
    $useLogoAsTitle = $headerIdentityMode === 'logo_only';
    $invertLogoInDarkMode = filter_var(
      $generalSettings['invert_logo_in_dark_mode'] ?? false,
      FILTER_VALIDATE_BOOLEAN,
    );

    $faviconUrl = voncms_normalize_public_media_url($generalSettings['favicon_url'] ?? '');
    $faviconUrl = voncms_absolute_public_url($faviconUrl, $domainUrl);
    $faviconVersion = '';
    if ($faviconUrl !== '') {
      $localPath =
        __DIR__ . '/' . ltrim((string) (parse_url($faviconUrl, PHP_URL_PATH) ?? ''), '/');
      $faviconVersion = file_exists($localPath)
        ? (string) filemtime($localPath)
        : substr(md5($faviconUrl), 0, 8);
    }

    $adsenseVerification = '';
    $adsConfigValue = (string) ($runtimeSettings['ads']['ads_config'] ?? '');
    if ($adsConfigValue !== '') {
      $adsSettings = json_decode($adsConfigValue, true);
      if (is_array($adsSettings) && !empty($adsSettings['adsenseVerification'])) {
        $adsenseVerification = (string) $adsSettings['adsenseVerification'];
      }
    }

    $seo = [];
    $seoConfigValue = (string) ($runtimeSettings['seo']['site_config'] ?? '');
    if ($seoConfigValue !== '') {
      $decodedSeo = json_decode($seoConfigValue, true);
      if (is_array($decodedSeo)) {
        $seo = $decodedSeo;
      }
    }
    $articleSchemaType = voncms_normalize_article_schema_type($seo['articleSchemaType'] ?? null);
    $seoUrl = $domainUrl . '/';
    $schemaData = voncms_is_private_spa_shell_route($path)
      ? null
      : [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $seoTitle,
        'url' => $seoUrl,
        'description' => $seoDescription,
      ];

    return [
      'runtimeSettings' => $runtimeSettings,
      'publicContentCurrentTime' => date('Y-m-d H:i:s'),
      'permalinkStructureValue' => $permalinkStructure,
      'publicListingLimit' => $listingLimit,
      'publicListingOffset' => $listingOffset,
      'timeZoneValue' => $timeZone,
      'dateFormatValue' => $dateFormat,
      'activeThemeId' => $activeThemeId,
      'themeCustomization' => $themeCustomization,
      'discussionEnabledValue' => $discussionEnabled,
      'htmlLang' => $htmlLang,
      'schemaLanguage' => $schemaLanguage,
      'openGraphLocale' => $openGraphLocale,
      'siteName' => $siteName,
      'siteDescription' => $siteDescription,
      'seoTitle' => $seoTitle,
      'seoDescription' => $seoDescription,
      'domainUrl' => $domainUrl,
      'seoUrl' => $seoUrl,
      'logoUrl' => $logoUrl,
      'headerIdentityMode' => $headerIdentityMode,
      'useLogoAsTitle' => $useLogoAsTitle,
      'invertLogoInDarkMode' => $invertLogoInDarkMode,
      'faviconUrl' => $faviconUrl,
      'faviconVersion' => $faviconVersion,
      'adsenseVerification' => $adsenseVerification,
      'seo' => $seo,
      'articleSchemaType' => $articleSchemaType,
      'schemaData' => $schemaData,
    ];
  }
}

if (!function_exists('voncms_resolve_public_assets')) {
  /**
   * @return array{assetPrefix:string, jsFile:string, cssFile:string}
   */
  function voncms_resolve_public_assets(string $assetsDir, bool $rootShim): array
  {
    $jsFile = '';
    $cssFile = '';
    if (is_dir($assetsDir)) {
      $files = scandir($assetsDir);
      if (is_array($files)) {
        foreach ($files as $file) {
          if (preg_match('/^index-.*\.js$/', $file)) {
            $jsFile = $file;
          }
          if (preg_match('/^index-.*\.css$/', $file)) {
            $cssFile = $file;
          }
        }
      }
    }

    return [
      'assetPrefix' => $rootShim ? 'dist/assets/' : 'assets/',
      'jsFile' => $jsFile !== '' ? $jsFile : 'index.js',
      'cssFile' => $cssFile !== '' ? $cssFile : 'index.css',
    ];
  }
}
