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

if (!function_exists('voncms_project_public_admin_profile')) {
  function voncms_project_public_admin_profile(mixed $profile): ?array
  {
    if (!is_array($profile)) {
      return null;
    }

    $publicProfile = [
      'name' => trim((string) ($profile['name'] ?? '')),
      'email' => trim((string) ($profile['email'] ?? '')),
      'bio' => trim((string) ($profile['bio'] ?? '')),
      'avatar' => ResponseHelper::scrubAvatarUrl((string) ($profile['avatar'] ?? '')),
    ];

    if (
      $publicProfile['name'] === '' &&
      $publicProfile['email'] === '' &&
      $publicProfile['bio'] === '' &&
      $publicProfile['avatar'] === ''
    ) {
      return null;
    }

    return $publicProfile;
  }
}

if (!function_exists('voncms_normalize_public_categories')) {
  /**
   * @param mixed $categories
   * @return array<int, string>
   */
  function voncms_normalize_public_categories($categories): array
  {
    if (!is_array($categories)) {
      return [];
    }

    $normalized = [];
    foreach ($categories as $rawCategory) {
      $category = trim((string) $rawCategory);
      if ($category === '') {
        continue;
      }

      $category = function_exists('mb_substr')
        ? mb_substr($category, 0, 100, 'UTF-8')
        : substr($category, 0, 100);

      $exists = false;
      foreach ($normalized as $existing) {
        if (strcasecmp($existing, $category) === 0) {
          $exists = true;
          break;
        }
      }

      if (!$exists) {
        $normalized[] = $category;
      }

      if (count($normalized) >= 200) {
        break;
      }
    }

    return $normalized;
  }
}

if (!function_exists('voncms_project_public_navigation_hrefs')) {
  /**
   * @param mixed $navigation
   * @return array<int, array<string, mixed>>
   */
  function voncms_project_public_navigation_hrefs(PDO $pdo, $navigation): array
  {
    if (!is_array($navigation)) {
      return [];
    }

    $pageIds = [];
    $postIds = [];
    foreach ($navigation as $item) {
      if (!is_array($item)) {
        continue;
      }
      $target = trim((string) ($item['url'] ?? ''));
      if (str_starts_with($target, 'page:')) {
        $pageId = trim(substr($target, 5));
        if ($pageId !== '') {
          $pageIds[$pageId] = true;
        }
      } elseif (str_starts_with($target, 'post:')) {
        $postId = trim(substr($target, 5));
        if ($postId !== '') {
          $postIds[$postId] = true;
        }
      }
    }

    $pageHrefs = [];
    if ($pageIds !== []) {
      try {
        $ids = array_slice(array_keys($pageIds), 0, 100);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
          "SELECT id, slug FROM pages WHERE id IN ($placeholders) AND (status = 'published' OR status IS NULL)",
        );
        $stmt->execute($ids);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $page) {
          $slug = trim((string) ($page['slug'] ?? ''));
          if ($slug !== '') {
            $pageHrefs[(string) ($page['id'] ?? '')] = '/' . ltrim($slug, '/');
          }
        }
      } catch (Throwable $e) {
        $pageHrefs = [];
      }
    }

    $postHrefs = [];
    if ($postIds !== []) {
      try {
        $ids = array_slice(array_keys($postIds), 0, 100);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
          "SELECT id FROM posts WHERE id IN ($placeholders) AND (status = 'published' OR status IS NULL) AND (scheduled_at IS NULL OR scheduled_at <= ?)",
        );
        $stmt->execute([...$ids, date('Y-m-d H:i:s')]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $post) {
          $postId = trim((string) ($post['id'] ?? ''));
          if ($postId !== '') {
            $postHrefs[$postId] = '/post/' . rawurlencode($postId);
          }
        }
      } catch (Throwable $e) {
        $postHrefs = [];
      }
    }

    return array_map(static function ($item) use ($pageHrefs, $postHrefs): array {
      if (!is_array($item)) {
        return [];
      }
      unset($item['resolvedHref']);
      $target = trim((string) ($item['url'] ?? ''));
      if ($target === 'home' || $target === '/') {
        $item['resolvedHref'] = '/';
      } elseif (str_starts_with($target, 'page:')) {
        $pageId = trim(substr($target, 5));
        if (isset($pageHrefs[$pageId])) {
          $item['resolvedHref'] = $pageHrefs[$pageId];
        }
      } elseif (str_starts_with($target, 'post:')) {
        $postId = trim(substr($target, 5));
        if (isset($postHrefs[$postId])) {
          $item['resolvedHref'] = $postHrefs[$postId];
        }
      }
      return $item;
    }, $navigation);
  }
}

if (!function_exists('voncms_normalize_plugin_settings_value')) {
  function voncms_normalize_plugin_settings_value(string $key, mixed $value): array
  {
    if ($key === 'active_plugins') {
      if (!is_array($value)) {
        return [];
      }

      $pluginIds = array_filter(
        $value,
        static fn($pluginId): bool => is_string($pluginId) &&
          $pluginId !== '' &&
          strlen($pluginId) <= 100 &&
          preg_match('/^[A-Za-z0-9._-]+$/', $pluginId) === 1,
      );
      return array_values(array_unique($pluginIds));
    }

    if ($key === 'custom_plugins') {
      if (!is_array($value)) {
        return [];
      }

      $allowedLocations = ['header_top', 'footer_bottom', 'sidebar_top', 'post_after'];
      $plugins = array_filter($value, static function ($plugin) use ($allowedLocations): bool {
        return is_array($plugin) &&
          is_string($plugin['id'] ?? null) &&
          is_string($plugin['name'] ?? null) &&
          is_string($plugin['location'] ?? null) &&
          is_string($plugin['htmlContent'] ?? null) &&
          in_array($plugin['location'], $allowedLocations, true);
      });
      return array_values($plugins);
    }

    if (!is_array($value)) {
      return [];
    }

    if ($key === 'plugin_config' && isset($value['pluginStatus'])) {
      if (!is_array($value['pluginStatus'])) {
        unset($value['pluginStatus']);
        return $value;
      }

      $value['pluginStatus'] = array_filter(
        $value['pluginStatus'],
        static fn($status, $pluginId): bool => is_string($pluginId) &&
          $pluginId !== '' &&
          strlen($pluginId) <= 100 &&
          preg_match('/^[A-Za-z0-9._-]+$/', $pluginId) === 1 &&
          is_string($status) &&
          in_array($status, ['active', 'inactive', 'not_installed'], true),
        ARRAY_FILTER_USE_BOTH,
      );
    }

    return $value;
  }
}

if (!function_exists('voncms_decode_public_setting_value')) {
  function voncms_decode_public_setting_value(mixed $value, string $type): mixed
  {
    if ($type === 'json' || $type === 'array') {
      $decoded = json_decode((string) $value, true);
      return is_array($decoded) ? $decoded : [];
    }
    if ($type === 'number') {
      return is_numeric($value) ? (int) $value : $value;
    }
    if ($type === 'boolean') {
      return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }
    return $value;
  }
}

if (!function_exists('voncms_build_public_settings_projection')) {
  /**
   * Build the complete, safe settings projection used by both first render and the guest API.
   * Only explicitly public rendering keys are selected; credentials and admin-only settings never
   * enter this projection even if a database row is accidentally marked public.
   *
   * @return array<string, mixed>
   */
  function voncms_build_public_settings_projection(PDO $pdo): array
  {
    $stmt = $pdo->prepare(
      "SELECT setting_group, setting_key, setting_value, setting_type FROM settings
       WHERE (setting_group = 'general' AND setting_key IN (
         'site_language', 'site_name', 'site_description', 'site_tagline', 'domain_url',
         'logo_url', 'header_identity_mode', 'use_logo_as_title', 'invert_logo_in_dark_mode',
         'favicon_url', 'og_image_url', 'og_image_square_url', 'discussion_enabled',
         'registration_enabled', 'maintenance_mode', 'permalink_structure', 'time_zone',
         'date_format', 'posts_per_page', 'admin_profile'
       ))
       OR (setting_group = 'ads' AND setting_key IN ('ads_config', 'configuration'))
       OR (setting_group = 'analytics' AND setting_key = 'config')
       OR (setting_group = 'content' AND setting_key = 'categories')
       OR (setting_group = 'footer' AND setting_key = 'links')
       OR (setting_group = 'media' AND setting_key IN ('optimization', 'performance'))
       OR (setting_group = 'navigation' AND setting_key = 'menu_items')
       OR (setting_group = 'newsletter' AND setting_key IN ('newsletter_config', 'configuration'))
       OR (setting_group = 'plugins' AND setting_key IN ('active_plugins', 'custom_plugins', 'plugin_config'))
       OR (setting_group = 'seo' AND setting_key = 'site_config')
       OR (setting_group = 'share' AND setting_key IN ('share_placement', 'sharePlacement'))
       OR (setting_group = 'sidebar' AND setting_key = 'layout')
       OR (setting_group = 'theme' AND setting_key IN ('active_theme_id', 'customization'))
       ORDER BY setting_group, setting_key",
    );
    $stmt->execute();

    $settings = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
      $group = (string) ($row['setting_group'] ?? '');
      $key = (string) ($row['setting_key'] ?? '');
      $value = voncms_decode_public_setting_value(
        $row['setting_value'] ?? '',
        (string) ($row['setting_type'] ?? 'string'),
      );

      switch ($group) {
        case 'general':
          if ($key === 'permalink_structure') {
            $settings['permalinkStructure'] = $value;
          } elseif ($key === 'admin_profile') {
            $settings['adminProfile'] = $value;
          } elseif ($key === 'domain_url') {
            $settings['domainUrl'] = $value;
            $settings['siteUrl'] = ResponseHelper::scrubUrl($value);
          } elseif ($key === 'posts_per_page') {
            $settings['postsPerPage'] = max(6, min(50, (int) $value));
          } elseif ($key === 'site_language') {
            $settings['site_language'] = $value;
            $settings['siteLanguage'] = $value;
          } elseif ($key === 'site_name') {
            $settings['siteName'] = trim((string) $value);
          } else {
            $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
            $settings[$camelKey] = $value;
          }
          break;

        case 'ads':
          if ($key === 'ads_config' && !empty($value)) {
            $settings['ads'] = $value;
          } elseif ($key === 'configuration' && empty($settings['ads'])) {
            $settings['ads'] = $value;
          }
          break;

        case 'analytics':
          if ($key === 'config') {
            $settings['analytics'] = $value;
          }
          break;

        case 'content':
          if ($key === 'categories') {
            $settings['categories'] = $value;
          }
          break;

        case 'footer':
          if ($key === 'links') {
            $settings['footerLinks'] = $value;
          }
          break;

        case 'media':
          $settings['media'] ??= [];
          $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
          $settings['media'][$camelKey] = $value;
          break;

        case 'navigation':
          if ($key === 'menu_items') {
            $settings['navigation'] = $value;
          }
          break;

        case 'newsletter':
          if ($key === 'newsletter_config' && !empty($value)) {
            $settings['newsletter'] = $value;
          } elseif ($key === 'configuration' && empty($settings['newsletter'])) {
            $settings['newsletter'] = $value;
          }
          break;

        case 'plugins':
          if ($key === 'active_plugins') {
            $settings['activePlugins'] = voncms_normalize_plugin_settings_value($key, $value);
          } elseif ($key === 'custom_plugins') {
            $settings['customPlugins'] = voncms_normalize_plugin_settings_value($key, $value);
          } elseif ($key === 'plugin_config') {
            $settings['pluginConfig'] = voncms_normalize_plugin_settings_value($key, $value);
          }
          break;

        case 'seo':
          if ($key === 'site_config') {
            $settings['seo'] = $value;
          }
          break;

        case 'share':
          if ($key === 'sharePlacement') {
            $settings['sharePlacement'] = $value;
          } elseif ($key === 'share_placement' && !isset($settings['sharePlacement'])) {
            $settings['sharePlacement'] = $value;
          }
          break;

        case 'sidebar':
          if ($key === 'layout') {
            $settings['sidebarLayout'] = $value;
          }
          break;

        case 'theme':
          if ($key === 'active_theme_id') {
            $settings['activeThemeId'] = $value;
          } elseif ($key === 'customization') {
            $settings['theme'] = $value;
          }
          break;
      }
    }

    $currentTime = date('Y-m-d H:i:s');
    $categoryStmt = $pdo->prepare(
      "SELECT DISTINCT category FROM posts
       WHERE (status = 'published' OR status IS NULL)
         AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)
         AND category IS NOT NULL
         AND TRIM(category) <> ''
       ORDER BY category ASC",
    );
    $categoryStmt->bindValue(':currentTime', $currentTime);
    $categoryStmt->execute();
    $publicCategories = voncms_normalize_public_categories(
      $categoryStmt->fetchAll(PDO::FETCH_COLUMN) ?: [],
    );
    $settings['publicCategories'] = $publicCategories;
    $settings['categories'] = voncms_normalize_public_categories([
      'Uncategorized',
      ...$settings['categories'] ?? [],
      ...$publicCategories,
    ]);
    $settings['navigation'] = voncms_project_public_navigation_hrefs(
      $pdo,
      $settings['navigation'] ?? [],
    );

    $publicAdminProfileEmail = null;
    if (
      isset($settings['adminProfile']) &&
      is_array($settings['adminProfile']) &&
      isset($settings['adminProfile']['email'])
    ) {
      $publicAdminProfileEmail = (string) $settings['adminProfile']['email'];
    }

    SecurityHelper::maskSensitiveData($settings);
    $publicAdminProfile = voncms_project_public_admin_profile($settings['adminProfile'] ?? null);
    if ($publicAdminProfile !== null) {
      if ($publicAdminProfileEmail !== null) {
        $publicAdminProfile['email'] = $publicAdminProfileEmail;
      }
      $settings['adminProfile'] = $publicAdminProfile;
    } else {
      unset($settings['adminProfile']);
    }
    $settings['_canManageSecrets'] = false;

    return $settings;
  }
}

if (!function_exists('voncms_load_public_runtime_context')) {
  /**
   * Load and normalize the complete allowlisted settings projection required by public SSR.
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
    $publicSettings = voncms_build_public_settings_projection($pdo);
    $permalinkStructure = (string) ($publicSettings['permalinkStructure'] ?? 'slug');
    $listingLimit = max(6, min(50, (int) ($publicSettings['postsPerPage'] ?? 6)));
    $listingOffset = (max(1, $publicListingPage) - 1) * $listingLimit;

    $timeZone = 'UTC';
    $storedTimeZone = trim((string) ($publicSettings['timeZone'] ?? ''));
    if (in_array($storedTimeZone, timezone_identifiers_list(), true)) {
      $timeZone = $storedTimeZone;
    }

    $dateFormat = 'month_day_year_long';
    $storedDateFormat = (string) ($publicSettings['dateFormat'] ?? '');
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

    $activeThemeId = (string) ($publicSettings['activeThemeId'] ?? '');
    $themeCustomization = is_array($publicSettings['theme'] ?? null)
      ? $publicSettings['theme']
      : null;

    $discussionEnabled = true;
    if (array_key_exists('discussionEnabled', $publicSettings)) {
      $discussionEnabled = (bool) $publicSettings['discussionEnabled'];
    }

    $schemaLanguage = '';
    $htmlLang = 'en';
    $openGraphLocale = '';
    $siteLanguage = (string) ($publicSettings['site_language'] ?? '');
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
    $siteNameValue = trim((string) ($publicSettings['siteName'] ?? ''));
    if ($siteNameValue !== '') {
      $siteName = html_entity_decode($siteNameValue, ENT_QUOTES | ENT_HTML5, 'UTF-8');
      $seoTitle = $siteName;
    }

    $seoDescription = $defaultSeoDescription;
    $siteDescription = $defaultSeoDescription;
    $siteDescriptionValue = (string) ($publicSettings['siteDescription'] ?? '');
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
    $configuredDomainUrl = trim((string) ($publicSettings['domainUrl'] ?? ''));
    if ($configuredDomainUrl !== '') {
      $domainUrl = rtrim($configuredDomainUrl, '/');
    }
    if ($domainUrl === '') {
      $protocol = function_exists('is_https') && is_https() ? 'https://' : 'http://';
      $safeHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
      $domainUrl = rtrim($protocol . $safeHost . $basePath, '/');
    }

    $logoUrl = (string) ($publicSettings['logoUrl'] ?? '');
    $useLogoAsTitle = filter_var(
      $publicSettings['useLogoAsTitle'] ?? false,
      FILTER_VALIDATE_BOOLEAN,
    );
    $headerIdentityMode = trim((string) ($publicSettings['headerIdentityMode'] ?? ''));
    if (!in_array($headerIdentityMode, ['logo_and_text', 'logo_only', 'text_only'], true)) {
      $headerIdentityMode = $useLogoAsTitle ? 'logo_only' : 'logo_and_text';
    }
    $useLogoAsTitle = $headerIdentityMode === 'logo_only';
    $invertLogoInDarkMode = filter_var(
      $publicSettings['invertLogoInDarkMode'] ?? false,
      FILTER_VALIDATE_BOOLEAN,
    );

    $faviconUrl = voncms_normalize_public_media_url($publicSettings['faviconUrl'] ?? '');
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
    $adsSettings = $publicSettings['ads'] ?? null;
    if (is_array($adsSettings) && !empty($adsSettings['adsenseVerification'])) {
      $adsenseVerification = (string) $adsSettings['adsenseVerification'];
    }

    $seo = is_array($publicSettings['seo'] ?? null) ? $publicSettings['seo'] : [];
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
      'publicSettingsSnapshot' => $publicSettings,
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
