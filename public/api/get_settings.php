<?php

require_once __DIR__ . '/../core/DataBoundary.php';

/**
 * VonCMS - Get Settings API (Database Version)
 * SECURITY: Filters sensitive settings based on user role
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// Extra Cache-Control for settings integrity
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Allow both GET and POST for settings retrieval
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

$configFile = __DIR__ . '/../von_config.php';
if (!file_exists($configFile)) {
  echo json_encode(['installed' => false]);
  exit();
}

$hasSessionUser = isset($_SESSION['user']);
$canUsePublicSettingsCache = !$hasSessionUser;
$publicSettingsCacheKey = voncms_public_cache_key('settings-public', ['scope' => 'guest']);
$publicSettingsCacheGate = null;

if ($canUsePublicSettingsCache) {
  if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
  }

  $cachedPublicSettings = voncms_public_cache_get($publicSettingsCacheKey, 60);
  if (is_string($cachedPublicSettings)) {
    echo $cachedPublicSettings;
    exit();
  }

  $publicSettingsCacheGate = voncms_public_cache_acquire_gate();
  if (is_resource($publicSettingsCacheGate)) {
    $cachedPublicSettings = voncms_public_cache_get($publicSettingsCacheKey, 60);
    if (is_string($cachedPublicSettings)) {
      voncms_public_cache_release_gate($publicSettingsCacheGate);
      echo $cachedPublicSettings;
      exit();
    }
  }
}

require_once $configFile;
$pdo = DataBoundary::optionalDatabase($GLOBALS['pdo'] ?? null);
require_once __DIR__ . '/../public_render_helper.php';
require_once __DIR__ . '/ai_provider_helper.php';

// Check if user is authenticated (for sensitive settings).
// Authenticated non-admin sessions receive the same scrubbed projection but do not share the guest cache.
$isAdmin = $hasSessionUser && SessionManager::isAdmin();
$isPrimaryAdmin = $isAdmin && SessionManager::isPrimaryAdmin();
$isStaff = $hasSessionUser && SessionManager::isStaff();
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

/** @var PDOStatement|null $stmt */
$stmt = null;

try {
  $pdo = DataBoundary::database($pdo);
  if (!$isAdmin) {
    $settings = voncms_build_public_settings_projection($pdo);
    if ($isStaff) {
      $settings['aiAssistant'] = voncms_ai_staff_projection($pdo);
    }

    $settingsJson = json_encode($settings);
    if (!is_string($settingsJson)) {
      ResponseHelper::sendError('Failed to encode settings response', 500);
    }

    if ($canUsePublicSettingsCache && is_resource($publicSettingsCacheGate)) {
      voncms_public_cache_set($publicSettingsCacheKey, $settingsJson, $publicSettingsCacheGate);
    }

    voncms_public_cache_release_gate($publicSettingsCacheGate);
    echo $settingsJson;
    exit();
  }

  try {
    // Non-admin requests have already returned through the allowlisted projection above.
    $stmt = $pdo->query(
      'SELECT setting_group, setting_key, setting_value, setting_type FROM settings ORDER BY setting_group, setting_key',
    );
  } catch (Throwable $e) {
    ResponseHelper::sendError($e);
  }

  if (!($stmt instanceof PDOStatement)) {
    ResponseHelper::sendError('Settings query failed', 500);
  }

  $rows = DataBoundary::rows($stmt->fetchAll(PDO::FETCH_ASSOC));

  // Reconstruct settings object
  $settings = [];

  foreach ($rows as $row) {
    $group = (string) $row['setting_group'];
    $key = (string) $row['setting_key'];
    $value = $row['setting_value'];
    $type = $row['setting_type'];

    // Parse value based on type
    if ($type === 'json' || $type === 'array') {
      $value = json_decode((string) $value, true);
    } elseif ($type === 'number') {
      $value = is_numeric($value) ? (int) $value : $value;
    } elseif ($type === 'boolean') {
      $value = $value === 'true' || $value === '1';
    }

    // Map to original structure for backward compatibility
    switch ($group) {
      case 'general':
        // Handle special keys explicitly
        if ($key === 'permalink_structure') {
          $settings['permalinkStructure'] = $value;
        } elseif ($key === 'admin_profile') {
          $settings['adminProfile'] = $value;
        } elseif (
          $key === 'domain_url' ||
          strtolower($key) === 'domainurl' ||
          strtolower($key) === 'siteurl'
        ) {
          $settings['domainUrl'] = $value; // Ensure UI gets domainUrl
          $settings['siteUrl'] = ResponseHelper::scrubUrl((string) DataBoundary::scalar($value)); // Legacy support
        } elseif ($key === 'posts_per_page') {
          $settings['postsPerPage'] = max(6, min(50, (int) DataBoundary::scalar($value)));
        } elseif ($key === 'site_language') {
          // Maintain both for frontend state and internal consistency
          $settings['site_language'] = $value;
          $settings['siteLanguage'] = $value;
        } else {
          // Standardized camelCase assignment (Clean Update)
          $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
          $settings[$camelKey] = $value;
        }
        break;
      case 'seo':
        if ($key === 'site_config') {
          $settings['seo'] = $value;
        } elseif ($key === 'robots_txt') {
          if (!isset($settings['seo']) || !is_array($settings['seo'])) {
            $settings['seo'] = [];
          }
          $settings['seo']['robotsTxt'] = $value;
        } elseif ($key === 'indexnow_enabled') {
          $settings['indexnowEnabled'] = $value;
        } elseif ($key === 'indexnow_key') {
          $settings['indexnowKey'] = $value;
        }
        break;
      case 'ads':
        // Canonical rows remain authoritative even when intentionally empty.
        if (
          $key === 'ads_config' ||
          ($key === 'configuration' && !array_key_exists('ads', $settings))
        ) {
          $settings['ads'] = $value;
        }
        break;
      case 'newsletter':
        if (
          $key === 'newsletter_config' ||
          ($key === 'configuration' && !array_key_exists('newsletter', $settings))
        ) {
          $settings['newsletter'] = $value;
        }
        break;
      case 'theme':
        if ($key === 'active_theme_id') {
          $settings['activeThemeId'] = $value;
        } elseif ($key === 'customization') {
          $settings['theme'] = $value;
        }
        break;
      case 'media':
        if (!isset($settings['media']) || !is_array($settings['media'])) {
          $settings['media'] = [];
        }
        // Handle snake_case to camelCase for default_view
        if ($key === 'default_view') {
          $settings['media']['defaultView'] = $value;
        } else {
          // Scrub URLs for logo/favicon
          if ($key === 'logo_url' || $key === 'favicon_url') {
            $value = ResponseHelper::scrubUrl((string) DataBoundary::scalar($value));
          }
          // Standardized camelCase for media keys (Clean Update)
          $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
          $settings['media'][$camelKey] = $value;
        }
        break;
      case 'navigation':
        if ($key === 'menu_items') {
          $settings['navigation'] = $value;
        }
        break;
      case 'sidebar':
        if ($key === 'layout') {
          $settings['sidebarLayout'] = $value;
        }
        break;
      case 'content':
        if ($key === 'categories') {
          $settings['categories'] = $value;
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
      case 'smtp':
        // Standardized camelCase assignment (Clean Update)
        $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
        $settings[$camelKey] = $value;
        break;
      case 'share':
        if ($key === 'templates') {
          $settings['shareTemplates'] = $value;
        } elseif ($key === 'sharePlacement') {
          // Legacy priority: older buggy saves wrote the real user choice here.
          $settings['sharePlacement'] = $value;
        } elseif ($key === 'share_placement') {
          // Canonical fallback: use the stable snake_case key when no legacy row exists.
          if (!isset($settings['sharePlacement'])) {
            $settings['sharePlacement'] = $value;
          }
        } else {
          $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
          $settings[$camelKey] = $value;
        }
        break;
      case 'footer':
        if ($key === 'links') {
          $settings['footerLinks'] = $value;
        }
        break;
      case 'contact':
        if ($key === 'forms') {
          $settings['contactForms'] = $value;
        }
        break;
      case 'analytics':
        if ($key === 'config') {
          $settings['analytics'] = $value;
        }
        break;
      case 'api':
        if ($key === 'config') {
          $settings['api'] = $value;
        }
        break;
    }
  }

  $allowedAdminPalettes = ['charcoal-blue', 'meadow-gold', 'harbour-amber'];
  if (
    !isset($settings['adminPalette']) ||
    !is_string($settings['adminPalette']) ||
    !in_array($settings['adminPalette'], $allowedAdminPalettes, true)
  ) {
    $settings['adminPalette'] = 'charcoal-blue';
  }

  // Merge authoritative category labels from the posts table so editors can reuse
  // historical categories even if the settings row was never manually updated.
  try {
    $categorySql =
      "SELECT DISTINCT category FROM posts WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC";

    $categoryStmt = $pdo->prepare($categorySql);
    $categoryStmt->execute();
    $dbCategories = DataBoundary::column($categoryStmt->fetchAll(PDO::FETCH_COLUMN)) ?: [];

    $publicCategoryRows = [];
    try {
      $publicCategoryStmt = $pdo->prepare(
        "SELECT DISTINCT category FROM posts WHERE (status = 'published' OR status IS NULL) AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC",
      );
      $publicCategoryStmt->bindValue(':currentTime', date('Y-m-d H:i:s'));
      $publicCategoryStmt->execute();
      $publicCategoryRows =
        DataBoundary::column($publicCategoryStmt->fetchAll(PDO::FETCH_COLUMN)) ?: [];
    } catch (Throwable $e) {
      // Keep the public projection fail-closed without discarding historical editor categories.
      $publicCategoryRows = [];
    }
    $settings['publicCategories'] = voncms_normalize_public_categories($publicCategoryRows);

    $mergedCategories = ['Uncategorized'];
    $savedCategories = is_array($settings['categories'] ?? null) ? $settings['categories'] : [];
    foreach (array_merge($savedCategories, $dbCategories) as $rawCategory) {
      if (!is_scalar($rawCategory)) {
        continue;
      }
      $category = trim((string) $rawCategory);
      if ($category === '') {
        continue;
      }

      $exists = false;
      foreach ($mergedCategories as $existing) {
        if (strcasecmp($existing, $category) === 0) {
          $exists = true;
          break;
        }
      }

      if (!$exists) {
        $mergedCategories[] = $category;
      }
    }
    $settings['categories'] = $mergedCategories;
  } catch (Throwable $e) {
    $settings['publicCategories'] = [];
    if (!isset($settings['categories']) || !is_array($settings['categories'])) {
      $settings['categories'] = ['Uncategorized'];
    }
  }

  $settings['navigation'] = voncms_project_public_navigation_hrefs(
    $pdo,
    $settings['navigation'] ?? [],
  );

  // --- SMART BRIDGE: Fallback to JSON for Contact Forms if DB is empty ---
  if (empty($settings['contactForms'])) {
    $jsonPath = __DIR__ . '/../data/site_settings.json';
    if (file_exists($jsonPath)) {
      $jsonText = file_get_contents($jsonPath);
      $json = is_string($jsonText) ? json_decode($jsonText, true) : null;
      if (is_array($json) && isset($json['contactForms'])) {
        $settings['contactForms'] = $json['contactForms'];
        $settings['_source_details'] = 'Database with JSON Fallback (Contact Forms)';
      }
    }
  }

  $settings['_canManageSecrets'] = $isPrimaryAdmin;
  if ($isPrimaryAdmin && is_array($settings['api'] ?? null)) {
    $settings['api'] = voncms_ai_owner_projection($settings['api']);
  }
  // Readiness hint only: appointed admins also receive complete, secret-masked settings.
  $settings['_settingsScope'] = 'admin';
  $adminProfilePublicEmail = null;
  if (
    isset($settings['adminProfile']) &&
    is_array($settings['adminProfile']) &&
    isset($settings['adminProfile']['email']) &&
    is_scalar($settings['adminProfile']['email'])
  ) {
    $adminProfilePublicEmail = (string) $settings['adminProfile']['email'];
  }

  // --- SERVER INFO INJECTION (Smart Check) ---
  if ($isPrimaryAdmin) {
    $rateLimitStorage = RateLimiter::getStorageHealth();
    $settings['_serverInfo'] = [
      'phpVersion' => PHP_VERSION,
      'uploadMaxFilesize' => ini_get('upload_max_filesize'),
      'postMaxSize' => ini_get('post_max_size'),
      'memoryLimit' => ini_get('memory_limit'),
      'integrityNeeded' => SecurityHelper::isIntegrityCompromised(),
      'rateLimitStorageHealthy' => $rateLimitStorage['healthy'],
      'rateLimitStorageMessage' => $rateLimitStorage['message'],
    ];
  }

  // Eligible staff receive only a safe AI capability projection. The stored
  // key, rotation timestamps, and private API config remain server-side.
  if ($isStaff) {
    $settings['aiAssistant'] = voncms_ai_staff_projection($pdo);
  }

  // SECURITY SCRUBBING: Appointed admins retain a complete but masked settings projection.
  if (!$isPrimaryAdmin) {
    SecurityHelper::maskSensitiveData($settings);
    if (
      $adminProfilePublicEmail !== null &&
      isset($settings['adminProfile']) &&
      is_array($settings['adminProfile'])
    ) {
      $settings['adminProfile']['email'] = $adminProfilePublicEmail;
    }
    $settings['_canManageSecrets'] = false;
  }

  $settingsJson = json_encode($settings);
  if (!is_string($settingsJson)) {
    ResponseHelper::sendError('Failed to encode settings response', 500);
  }

  if ($canUsePublicSettingsCache && is_resource($publicSettingsCacheGate)) {
    voncms_public_cache_set($publicSettingsCacheKey, $settingsJson, $publicSettingsCacheGate);
  }

  voncms_public_cache_release_gate($publicSettingsCacheGate);

  echo $settingsJson;
} catch (Throwable $e) {
  voncms_public_cache_release_gate($publicSettingsCacheGate);
  ResponseHelper::sendError($e);
}
