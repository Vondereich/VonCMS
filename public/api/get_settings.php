<?php

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

$configFile = __DIR__ . '/../von_config.php';
if (!file_exists($configFile)) {
  echo json_encode(['installed' => false]);
  exit();
}
require_once $configFile;

// Extra Cache-Control for settings integrity
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Allow both GET and POST for settings retrieval
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// Check if user is authenticated (for sensitive settings)
// Session already started in security.php
$isAdmin = SessionManager::isAdmin();
$isPrimaryAdmin = SessionManager::isPrimaryAdmin();
$publicSettingsCacheKey = voncms_public_cache_key('settings-public', ['scope' => 'guest']);

if (!$isAdmin) {
  $cachedPublicSettings = voncms_public_cache_get($publicSettingsCacheKey, 60);
  if (is_string($cachedPublicSettings)) {
    echo $cachedPublicSettings;
    exit();
  }
}

/** @var PDOStatement|null $stmt */
$stmt = null;

try {
  try {
    // Build query based on user role
    if ($isAdmin) {
      // Admin gets ALL settings
      $stmt = $pdo->query(
        'SELECT setting_group, setting_key, setting_value, setting_type FROM settings ORDER BY setting_group, setting_key',
      );
    } else {
      // Public users only get non-sensitive settings
      try {
        $stmt = $pdo->query(
          'SELECT setting_group, setting_key, setting_value, setting_type FROM settings WHERE is_public = 1 ORDER BY setting_group, setting_key',
        );
      } catch (PDOException $qe) {
        // 1.3 Fallback settings leak (Fix)
        // If 'is_public' column doesn't exist (during OTA upgrade),
        // we pull ONLY a known-safe whitelist of keys instead of everything.
        if (strpos($qe->getMessage(), 'is_public') !== false) {
          $safeKeys = [
            'site_name',
            'site_description',
            'site_logo',
            'site_icon',
            'logo_url',
            'favicon_url',
            'active_theme_id',
            'permalink_structure',
            'site_language',
            'domain_url',
            'discussion_enabled',
            'indexnow_enabled',
          ];
          $placeholders = implode(',', array_fill(0, count($safeKeys), '?'));
          $stmt = $pdo->prepare(
            "SELECT setting_group, setting_key, setting_value, setting_type FROM settings WHERE setting_key IN ($placeholders) ORDER BY setting_group, setting_key",
          );
          $stmt->execute($safeKeys);
        } else {
          throw $qe;
        }
      }
    }
  } catch (Throwable $e) {
    ResponseHelper::sendError($e);
  }

  if (!($stmt instanceof PDOStatement)) {
    ResponseHelper::sendError('Settings query failed', 500);
  }

  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Reconstruct settings object
  $settings = [];

  foreach ($rows as $row) {
    $group = $row['setting_group'];
    $key = $row['setting_key'];
    $value = $row['setting_value'];
    $type = $row['setting_type'];

    if (!$isAdmin && $group === 'api' && $key === 'config') {
      continue;
    }

    // Parse value based on type
    if ($type === 'json' || $type === 'array') {
      $value = json_decode($value, true);
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
          $settings['siteUrl'] = ResponseHelper::scrubUrl($value); // Legacy support
        } elseif ($key === 'posts_per_page') {
          $settings['postsPerPage'] = max(6, min(50, (int) $value));
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
        // Modern 'ads_config': Accept ONLY if verified non-empty/valid
        if ($key === 'ads_config' && !empty($value)) {
          $settings['ads'] = $value;
        }
        // Legacy 'configuration': Accept only if we don't have a valid value yet
        elseif ($key === 'configuration') {
          if (!isset($settings['ads']) || empty($settings['ads'])) {
            $settings['ads'] = $value;
          }
        }
        break;
      case 'newsletter':
        if ($key === 'newsletter_config' && !empty($value)) {
          $settings['newsletter'] = $value;
        } elseif ($key === 'configuration') {
          if (!isset($settings['newsletter']) || empty($settings['newsletter'])) {
            $settings['newsletter'] = $value;
          }
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
        if (!isset($settings['media'])) {
          $settings['media'] = [];
        }
        // Handle snake_case to camelCase for default_view
        if ($key === 'default_view') {
          $settings['media']['defaultView'] = $value;
        } else {
          // Scrub URLs for logo/favicon
          if ($key === 'logo_url' || $key === 'favicon_url') {
            $value = ResponseHelper::scrubUrl($value);
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
          $settings['activePlugins'] = $value;
        } elseif ($key === 'custom_plugins') {
          $settings['customPlugins'] = $value;
        } elseif ($key === 'plugin_config') {
          $settings['pluginConfig'] = $value;
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

  // Merge authoritative category labels from the posts table so editors can reuse
  // historical categories even if the settings row was never manually updated.
  try {
    $categorySql = $isAdmin
      ? "SELECT DISTINCT category FROM posts WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC"
      : "SELECT DISTINCT category FROM posts WHERE (status = 'published' OR status IS NULL) AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC";

    $categoryStmt = $pdo->prepare($categorySql);
    if (!$isAdmin) {
      $categoryStmt->bindValue(':currentTime', date('Y-m-d H:i:s'));
    }
    $categoryStmt->execute();
    $dbCategories = $categoryStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    $mergedCategories = ['Uncategorized'];
    foreach (array_merge($settings['categories'] ?? [], $dbCategories) as $rawCategory) {
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
    if (!isset($settings['categories']) || !is_array($settings['categories'])) {
      $settings['categories'] = ['Uncategorized'];
    }
  }

  // --- SMART BRIDGE: Fallback to JSON for Contact Forms if DB is empty ---
  if (empty($settings['contactForms'])) {
    $jsonPath = __DIR__ . '/../data/site_settings.json';
    if (file_exists($jsonPath)) {
      $json = json_decode(file_get_contents($jsonPath), true);
      if (isset($json['contactForms'])) {
        $settings['contactForms'] = $json['contactForms'];
        $settings['_source_details'] = 'Database with JSON Fallback (Contact Forms)';
      }
    }
  }

  $settings['_canManageSecrets'] = $isPrimaryAdmin;
  $adminProfilePublicEmail = null;
  if (
    isset($settings['adminProfile']) &&
    is_array($settings['adminProfile']) &&
    isset($settings['adminProfile']['email'])
  ) {
    $adminProfilePublicEmail = (string) $settings['adminProfile']['email'];
  }

  // --- SERVER INFO INJECTION (Smart Check) ---
  if ($isPrimaryAdmin) {
    $settings['_serverInfo'] = [
      'phpVersion' => PHP_VERSION,
      'uploadMaxFilesize' => ini_get('upload_max_filesize'),
      'postMaxSize' => ini_get('post_max_size'),
      'memoryLimit' => ini_get('memory_limit'),
      'integrityNeeded' => SecurityHelper::isIntegrityCompromised(),
    ];
  }

  // SECURITY SCRUBBING: Automated Masking for guests and appointed admins.
  if (!$isPrimaryAdmin) {
    SecurityHelper::maskSensitiveData($settings);
    if (!$isAdmin) {
      // Guest callers do not need the settings adminProfile payload.
      unset($settings['adminProfile']);
    } elseif (
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

  if (!$isAdmin && $publicSettingsCacheKey !== null) {
    voncms_public_cache_set($publicSettingsCacheKey, $settingsJson);
  }

  echo $settingsJson;
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
