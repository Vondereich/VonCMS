<?php

/**
 * VonCMS - Save Settings API (Database Version)
 * SECURITY: Admin-only access, validates input, prevents injection
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/settings_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

ob_start(); // Buffer output to prevent warnings from corrupting JSON
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Try to create settings table if missing (hotfix for new installs/migrations)
try {
  $pdo->query('SELECT 1 FROM settings LIMIT 1');
} catch (Throwable $e) {
  // If table doesn't exist, we might be in the middle of a migration or repair
  // Don't die, just continue (will return default below if no rows)
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

// Check if user is admin
SessionManager::requireAdmin();
$isPrimaryAdmin = SessionManager::isPrimaryAdmin();

$userId = $_SESSION['user']['id'] ?? null;

// Get input (Support both JSON and FormData for legacy compatibility)
$input = CSRFProtection::getRequestBody();
$settings = json_decode($input, true);

if (!$settings) {
  if (isset($_POST['settings'])) {
    $settings = json_decode($_POST['settings'], true);
  }
}

if (!$settings || !is_array($settings)) {
  ResponseHelper::sendError('Invalid settings data', 400);
}

function voncms_guard_restricted_settings_for_non_primary_admin(array &$settings): void
{
  $restrictedTopLevelKeys = [
    'api',
    'smtpHost',
    'smtpPort',
    'smtpUser',
    'smtpPass',
    'smtpEncryption',
    'smtpFromName',
    'emailSmtp',
    'indexnowKey',
    'domainUrl',
    'adminProfile',
    'sidebarLayout',
    'media',
    'customPlugins',
  ];

  foreach ($restrictedTopLevelKeys as $key) {
    unset($settings[$key]);
  }

  if (isset($settings['analytics']) && is_array($settings['analytics'])) {
    unset($settings['analytics']['measurementSecret']);
    unset($settings['analytics']['apiSecret']);
  }
}

if (!$isPrimaryAdmin) {
  voncms_guard_restricted_settings_for_non_primary_admin($settings);
}

if (isset($settings['domainUrl'])) {
  $domainUrl = rtrim(trim((string) $settings['domainUrl']), '/');
  if ($domainUrl !== '') {
    $domainScheme = strtolower((string) parse_url($domainUrl, PHP_URL_SCHEME));
    if (
      filter_var($domainUrl, FILTER_VALIDATE_URL) === false ||
      !in_array($domainScheme, ['http', 'https'], true)
    ) {
      ResponseHelper::sendError('Domain URL must use http or https.', 400);
    }
  }
  $settings['domainUrl'] = $domainUrl;
}

function voncms_normalize_active_plugins($value): array
{
  if (!is_array($value) || count($value) > 100) {
    ResponseHelper::sendError('Invalid active plugins configuration.', 400);
  }

  $activePlugins = [];
  foreach ($value as $pluginId) {
    if (!is_string($pluginId)) {
      ResponseHelper::sendError('Invalid active plugin identifier.', 400);
    }

    $pluginId = trim($pluginId);
    if (
      $pluginId === '' ||
      strlen($pluginId) > 100 ||
      !preg_match('/^[A-Za-z0-9._-]+$/', $pluginId)
    ) {
      ResponseHelper::sendError('Invalid active plugin identifier.', 400);
    }

    $activePlugins[$pluginId] = true;
  }

  return array_keys($activePlugins);
}

function voncms_normalize_custom_plugins($value): array
{
  if (!is_array($value) || count($value) > 25) {
    ResponseHelper::sendError('Invalid custom plugins configuration.', 400);
  }

  $allowedLocations = ['header_top', 'footer_bottom', 'sidebar_top', 'post_after'];
  $customPlugins = [];

  foreach ($value as $plugin) {
    if (!is_array($plugin)) {
      ResponseHelper::sendError('Invalid custom plugin entry.', 400);
    }

    foreach (['id', 'name', 'location', 'htmlContent'] as $field) {
      if (!isset($plugin[$field]) || !is_string($plugin[$field])) {
        ResponseHelper::sendError('Invalid custom plugin entry.', 400);
      }
    }

    if (isset($plugin['cssContent']) && !is_string($plugin['cssContent'])) {
      ResponseHelper::sendError('Invalid custom plugin entry.', 400);
    }

    $enabledValue = $plugin['enabled'] ?? false;
    if (!is_bool($enabledValue) && !is_int($enabledValue) && !is_string($enabledValue)) {
      ResponseHelper::sendError('Invalid custom plugin entry.', 400);
    }

    $id = trim((string) ($plugin['id'] ?? ''));
    $name = trim((string) ($plugin['name'] ?? ''));
    $location = trim((string) ($plugin['location'] ?? ''));
    $htmlContent = (string) ($plugin['htmlContent'] ?? '');
    $cssContent = (string) ($plugin['cssContent'] ?? '');

    if (
      $id === '' ||
      strlen($id) > 100 ||
      !preg_match('/^[A-Za-z0-9._-]+$/', $id) ||
      $name === '' ||
      strlen($name) > 150 ||
      !in_array($location, $allowedLocations, true) ||
      strlen($htmlContent) > 100000 ||
      strlen($cssContent) > 50000
    ) {
      ResponseHelper::sendError('Invalid custom plugin entry.', 400);
    }

    $customPlugins[] = [
      'id' => $id,
      'name' => $name,
      'location' => $location,
      'htmlContent' => $htmlContent,
      'cssContent' => $cssContent,
      'enabled' => filter_var($plugin['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
    ];
  }

  return $customPlugins;
}

function voncms_validate_plugin_config_node($value, int $depth = 0): void
{
  if ($depth > 12) {
    ResponseHelper::sendError('Plugin configuration is too deeply nested.', 400);
  }

  if (is_array($value)) {
    if (count($value) > 200) {
      ResponseHelper::sendError('Plugin configuration contains too many entries.', 400);
    }

    foreach ($value as $key => $child) {
      if (is_string($key) && strlen($key) > 100) {
        ResponseHelper::sendError('Plugin configuration key is too long.', 400);
      }
      voncms_validate_plugin_config_node($child, $depth + 1);
    }
    return;
  }

  if (is_string($value) && strlen($value) > 100000) {
    ResponseHelper::sendError('Plugin configuration value is too long.', 400);
  }

  if (!is_null($value) && !is_scalar($value)) {
    ResponseHelper::sendError('Invalid plugin configuration value.', 400);
  }
}

if (array_key_exists('activePlugins', $settings)) {
  $settings['activePlugins'] = voncms_normalize_active_plugins($settings['activePlugins']);
}

if (array_key_exists('customPlugins', $settings)) {
  $settings['customPlugins'] = voncms_normalize_custom_plugins($settings['customPlugins']);
}

if (array_key_exists('pluginConfig', $settings)) {
  if (!is_array($settings['pluginConfig'])) {
    ResponseHelper::sendError('Invalid plugin configuration.', 400);
  }

  voncms_validate_plugin_config_node($settings['pluginConfig']);

  if (isset($settings['pluginConfig']['pluginStatus'])) {
    $pluginStatus = $settings['pluginConfig']['pluginStatus'];
    if (!is_array($pluginStatus) || count($pluginStatus) > 100) {
      ResponseHelper::sendError('Invalid plugin status configuration.', 400);
    }

    $normalizedPluginStatus = [];
    foreach ($pluginStatus as $pluginId => $status) {
      if (
        !is_string($pluginId) ||
        $pluginId === '' ||
        strlen($pluginId) > 100 ||
        !preg_match('/^[A-Za-z0-9._-]+$/', $pluginId) ||
        !is_string($status) ||
        !in_array($status, ['active', 'inactive', 'not_installed'], true)
      ) {
        ResponseHelper::sendError('Invalid plugin status configuration.', 400);
      }
      $normalizedPluginStatus[$pluginId] = $status;
    }
    $settings['pluginConfig']['pluginStatus'] = $normalizedPluginStatus;
  }

  $encodedPluginConfig = json_encode($settings['pluginConfig']);
  if ($encodedPluginConfig === false || strlen($encodedPluginConfig) > 262144) {
    ResponseHelper::sendError('Plugin configuration is too large.', 400);
  }
}

// Remove metadata fields
unset($settings['_source'], $settings['_access_level'], $settings['_warning']);

function voncms_write_settings_json_mirror(string $settingsFile, array $settingsForFile): void
{
  $settingsDir = dirname($settingsFile);
  if (!is_dir($settingsDir) && !mkdir($settingsDir, 0755, true) && !is_dir($settingsDir)) {
    throw new Exception('Could not create settings data directory.');
  }

  $json = json_encode(
    $settingsForFile,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );

  if ($json === false || strlen($json) <= 2) {
    throw new Exception('Could not encode settings mirror JSON.');
  }

  $tempFile = $settingsFile . '.' . bin2hex(random_bytes(6)) . '.tmp';

  try {
    $bytesWritten = file_put_contents($tempFile, $json, LOCK_EX);
    if ($bytesWritten === false || $bytesWritten !== strlen($json)) {
      throw new Exception('Could not write complete settings mirror file.');
    }

    clearstatcache(true, $tempFile);
    if (!file_exists($tempFile) || filesize($tempFile) <= 0) {
      throw new Exception('Temp settings mirror write failed (empty).');
    }

    if (!rename($tempFile, $settingsFile)) {
      if (copy($tempFile, $settingsFile)) {
        unlink($tempFile);
      } else {
        throw new Exception('Failed to commit settings mirror file.');
      }
    }
  } finally {
    if (isset($tempFile) && file_exists($tempFile)) {
      @unlink($tempFile);
    }
  }
}

function voncms_preserve_admin_profile_email_placeholder(PDO $pdo, array &$settings): void
{
  if (!isset($settings['adminProfile']) || !is_array($settings['adminProfile'])) {
    return;
  }

  $email = trim((string) ($settings['adminProfile']['email'] ?? ''));
  if ($email === '' || strpos($email, '******** (PROTECTED)') === false) {
    return;
  }

  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'admin_profile' LIMIT 1",
  );
  $stmt->execute();
  $existingRaw = $stmt->fetchColumn();
  $existingProfile = is_string($existingRaw) ? json_decode($existingRaw, true) : null;

  if (is_array($existingProfile) && !empty($existingProfile['email'])) {
    $settings['adminProfile']['email'] = (string) $existingProfile['email'];
  } else {
    unset($settings['adminProfile']['email']);
  }
}

function voncms_scrub_admin_profile_avatar(array &$settings): void
{
  if (!isset($settings['adminProfile']) || !is_array($settings['adminProfile'])) {
    return;
  }

  $settings['adminProfile']['avatar'] = ResponseHelper::scrubAvatarUrl(
    (string) ($settings['adminProfile']['avatar'] ?? ''),
  );
}

try {
  $pdo->beginTransaction();
  voncms_purge_sensitive_setting_audit_history($pdo);
  voncms_preserve_admin_profile_email_placeholder($pdo, $settings);
  voncms_scrub_admin_profile_avatar($settings);

  // Prepare UPSERT statement (INSERT or UPDATE if exists)
  // This ensures settings are created if they don't exist
  $upsertStmt = $pdo->prepare("
        INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public, updated_by, version)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE 
            setting_value = VALUES(setting_value),
            is_public = VALUES(is_public),
            updated_by = VALUES(updated_by),
            version = version + 1,
            updated_at = NOW()
    ");

  $updated = 0;

  // Map settings to database structure
  $mappings = [
    // General
    ['siteName', 'general', 'site_name', 'string'],
    ['siteDescription', 'general', 'site_description', 'string'],
    ['siteTagline', 'general', 'site_tagline', 'string'],
    ['site_language', 'general', 'site_language', 'string'],
    ['postsPerPage', 'general', 'posts_per_page', 'number'],
    ['maintenanceMode', 'general', 'maintenance_mode', 'boolean'],
    ['emailSmtp', 'general', 'email_smtp', 'string'],
    ['logoUrl', 'general', 'logo_url', 'string'],
    ['useLogoAsTitle', 'general', 'use_logo_as_title', 'boolean'], // New: Replace text with logo
    ['invertLogoInDarkMode', 'general', 'invert_logo_in_dark_mode', 'boolean'],
    ['faviconUrl', 'general', 'favicon_url', 'string'],
    ['ogImageUrl', 'general', 'og_image_url', 'string'], // Social Share Image
    ['ogImageSquareUrl', 'general', 'og_image_square_url', 'string'], // Social Share Square (WhatsApp)
    ['discussionEnabled', 'general', 'discussion_enabled', 'boolean'],
    ['registrationEnabled', 'general', 'registration_enabled', 'boolean'],
    ['permalinkStructure', 'general', 'permalink_structure', 'string'],
    ['spamKeywords', 'general', 'spam_keywords', 'string'],
    ['domainUrl', 'general', 'domain_url', 'string'],
    ['timeZone', 'general', 'time_zone', 'string'],
    // SMTP Settings
    ['smtpHost', 'smtp', 'smtpHost', 'string'],
    ['smtpPort', 'smtp', 'smtpPort', 'number'],
    ['smtpUser', 'smtp', 'smtpUser', 'string'],
    ['smtpPass', 'smtp', 'smtpPass', 'string'],
    ['smtpEncryption', 'smtp', 'smtpEncryption', 'string'],
    ['smtpFromName', 'smtp', 'smtpFromName', 'string'],
    // Share Settings
    ['shareScript', 'share', 'shareScript', 'string'],
    ['sharePlacement', 'share', 'share_placement', 'string'],
    // Contact Settings
    ['contactForms', 'contact', 'forms', 'json'],
    // SEO & API
    ['api', 'api', 'config', 'json'],
    ['seo', 'seo', 'site_config', 'json'],
    // IndexNow (Instant Indexing)
    ['indexnowEnabled', 'seo', 'indexnow_enabled', 'boolean'],
    ['indexnowKey', 'seo', 'indexnow_key', 'string'],
    // Theme
    ['activeThemeId', 'theme', 'active_theme_id', 'string'],
    ['theme', 'theme', 'customization', 'json'],
    // Navigation & Sidebar
    ['navigation', 'navigation', 'menu_items', 'json'],
    ['sidebarLayout', 'sidebar', 'layout', 'json'],
    ['shareTemplates', 'share', 'templates', 'json'],
    // Categories
    ['categories', 'content', 'categories', 'json'],
    // Plugins
    ['activePlugins', 'plugins', 'active_plugins', 'json'],
    ['customPlugins', 'plugins', 'custom_plugins', 'json'],
    ['pluginConfig', 'plugins', 'plugin_config', 'json'],
    // Footer
    ['footerLinks', 'footer', 'links', 'json'],
    // Admin Profile
    ['adminProfile', 'general', 'admin_profile', 'json'],
    // Ads Settings
    ['ads', 'ads', 'ads_config', 'json'],
    // Newsletter Settings
    ['newsletter', 'newsletter', 'newsletter_config', 'json'],
    // Analytics (Modern)
    ['analytics', 'analytics', 'config', 'json'],
  ];

  foreach ($mappings as $mapping) {
    [$jsonKey, $group, $dbKey, $type] = $mapping;

    if (isset($settings[$jsonKey])) {
      $value = $settings[$jsonKey];

      if ($jsonKey === 'siteName' && is_string($value)) {
        $value = trim($value);
      }

      if ($jsonKey === 'postsPerPage') {
        $value = max(6, min(50, (int) $value));
      }

      if ($jsonKey === 'api' && is_array($value)) {
        $existingApiConfig = [];
        try {
          $existingApiStmt = $pdo->prepare(
            "SELECT setting_value FROM settings WHERE setting_group = 'api' AND setting_key = 'config' LIMIT 1",
          );
          $existingApiStmt->execute();
          $existingApiRaw = $existingApiStmt->fetchColumn();
          $decodedApiConfig = is_string($existingApiRaw)
            ? json_decode($existingApiRaw, true)
            : null;
          if (is_array($decodedApiConfig)) {
            $existingApiConfig = $decodedApiConfig;
          }
        } catch (Throwable $e) {
          $existingApiConfig = [];
        }

        $aiKey = trim((string) ($value['aiApiKey'] ?? ''));
        $rotationEnabled = filter_var(
          $value['expireAiKeyAfter30Days'] ?? false,
          FILTER_VALIDATE_BOOLEAN,
        );
        $value['expireAiKeyAfter30Days'] = $rotationEnabled;
        $existingAiKey = trim((string) ($existingApiConfig['aiApiKey'] ?? ''));
        $existingSavedAt = trim((string) ($existingApiConfig['aiKeySavedAt'] ?? ''));
        $existingExpiresAt = trim((string) ($existingApiConfig['aiKeyExpiresAt'] ?? ''));
        $rotationWasEnabled = filter_var(
          $existingApiConfig['expireAiKeyAfter30Days'] ?? false,
          FILTER_VALIDATE_BOOLEAN,
        );
        $aiKeyIsProtectedPlaceholder =
          str_contains($aiKey, '*') || str_starts_with(strtolower($aiKey), 'protected:');
        $existingAiKeyExpired = false;

        if ($rotationEnabled && $existingAiKey !== '' && $existingExpiresAt !== '') {
          try {
            $expiresAt = new DateTimeImmutable($existingExpiresAt);
            $existingAiKeyExpired =
              $expiresAt <= new DateTimeImmutable('now', new DateTimeZone('UTC'));
          } catch (Exception $e) {
            $existingAiKeyExpired = true;
          }
        }

        if ($aiKeyIsProtectedPlaceholder && !$existingAiKeyExpired) {
          $aiKey = $existingAiKey;
          $value['aiApiKey'] = $existingAiKey;
        }

        if (
          $existingAiKeyExpired &&
          ($aiKey === '' || $aiKeyIsProtectedPlaceholder || hash_equals($existingAiKey, $aiKey))
        ) {
          unset($value['aiApiKey'], $value['aiKeySavedAt'], $value['aiKeyExpiresAt']);
        } elseif ($aiKey === '') {
          unset($value['aiKeySavedAt'], $value['aiKeyExpiresAt']);
        } else {
          $refreshSavedAt =
            $existingAiKey !== $aiKey ||
            $existingSavedAt === '' ||
            ($rotationEnabled && !$rotationWasEnabled);

          $value['aiKeySavedAt'] = $refreshSavedAt ? gmdate('c') : $existingSavedAt;

          if ($rotationEnabled) {
            try {
              $savedAt = new DateTimeImmutable($value['aiKeySavedAt']);
            } catch (Exception $e) {
              $savedAt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
              $value['aiKeySavedAt'] = $savedAt->format(DateTimeInterface::ATOM);
            }
            $value['aiKeyExpiresAt'] = $savedAt
              ->modify('+30 days')
              ->format(DateTimeInterface::ATOM);
          } else {
            unset($value['aiKeyExpiresAt']);
          }
        }
      }

      // Type conversion
      if ($type === 'boolean') {
        $value = $value ? 'true' : 'false';
      } elseif ($type === 'number') {
        $value = (string) $value;
      } elseif ($type === 'json' || $type === 'array') {
        $value = json_encode($value);
      }

      $isPublicInDb =
        ($group === 'api' && $dbKey === 'config') || ($group === 'contact' && $dbKey === 'forms')
          ? 0
          : (SecurityHelper::isSensitiveKey($dbKey)
            ? 0
            : 1);
      $auditBefore = voncms_get_setting_audit_snapshot($pdo, $group, $dbKey);

      try {
        $upsertStmt->execute([$group, $dbKey, $value, $type, $isPublicInDb, $userId]);
      } catch (PDOException $qe) {
        // RESILIENCE: If column 'is_public' or 'updated_by' is missing (common during OTA update)
        // Fall back to a simpler legacy UPSERT to prevent blocking the Admin.
        if (
          strpos($qe->getMessage(), 'is_public') !== false ||
          strpos($qe->getMessage(), 'updated_by') !== false
        ) {
          $legacyStmt = $pdo->prepare("
                INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, version)
                VALUES (?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    version = version + 1,
                    updated_at = NOW()
            ");
          $legacyStmt->execute([$group, $dbKey, $value, $type]);
        } else {
          throw $qe;
        }
      }
      voncms_record_setting_audit($pdo, $group, $dbKey, $auditBefore, $value, $userId);
      $updated++;

      // Clean up legacy share key to avoid stale values overriding the canonical one on reload.
      if ($jsonKey === 'sharePlacement') {
        $legacyShareSnapshot = voncms_get_setting_audit_snapshot($pdo, 'share', 'sharePlacement');
        $cleanupStmt = $pdo->prepare(
          "DELETE FROM settings WHERE setting_group = 'share' AND setting_key = 'sharePlacement'",
        );
        $cleanupStmt->execute();
        if ($legacyShareSnapshot && $cleanupStmt->rowCount() > 0) {
          voncms_record_setting_audit(
            $pdo,
            'share',
            'sharePlacement',
            $legacyShareSnapshot,
            null,
            $userId,
            'DELETE',
          );
        }
      }

      // MAINTENANCE MODE FLAG LOGIC (File-based fallback)
      if ($jsonKey === 'maintenanceMode') {
        $flagFile = __DIR__ . '/../data/maintenance.flag';
        // If setting is true, adjust flag file
        if ($value === 'true' || $value === true || $value === '1') {
          if (!file_exists(dirname($flagFile))) {
            @mkdir(dirname($flagFile), 0755, true);
          }
          file_put_contents($flagFile, 'MAINTENANCE_ON');
        } else {
          if (file_exists($flagFile)) {
            unlink($flagFile);
          }
        }
      }
    }
  }

  if (
    isset($settings['seo']) &&
    is_array($settings['seo']) &&
    array_key_exists('robotsTxt', $settings['seo'])
  ) {
    $robotsTxt = preg_replace(
      '/^\s*Crawl-delay\s*:\s*\d+\s*$/mi',
      '',
      (string) $settings['seo']['robotsTxt'],
    );
    $robotsTxt = preg_replace('/^\s*Sitemap\s*:\s*.*$/mi', '', (string) $robotsTxt);
    $robotsTxt = trim((string) preg_replace("/\n{3,}/", "\n\n", (string) $robotsTxt));
    $auditBefore = voncms_get_setting_audit_snapshot($pdo, 'seo', 'robots_txt');

    try {
      $upsertStmt->execute(['seo', 'robots_txt', $robotsTxt, 'string', 1, $userId]);
    } catch (PDOException $qe) {
      if (
        strpos($qe->getMessage(), 'is_public') !== false ||
        strpos($qe->getMessage(), 'updated_by') !== false
      ) {
        $legacyStmt = $pdo->prepare("
              INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, version)
              VALUES (?, ?, ?, ?, 1)
              ON DUPLICATE KEY UPDATE 
                  setting_value = VALUES(setting_value),
                  version = version + 1,
                  updated_at = NOW()
          ");
        $legacyStmt->execute(['seo', 'robots_txt', $robotsTxt, 'string']);
      } else {
        throw $qe;
      }
    }

    voncms_record_setting_audit($pdo, 'seo', 'robots_txt', $auditBefore, $robotsTxt, $userId);
    $updated++;
  }

  // Media settings need custom sub-key mapping
  if (isset($settings['media'])) {
    $media = $settings['media'];
    if (!is_array($media)) {
      ResponseHelper::sendError('Invalid media settings data.', 400);
    }

    if (isset($media['optimization']) && is_array($media['optimization'])) {
      $media['optimization']['maxWidth'] = max(
        320,
        min(7680, (int) ($media['optimization']['maxWidth'] ?? 1920)),
      );
      $media['optimization']['maxHeight'] = max(
        240,
        min(4320, (int) ($media['optimization']['maxHeight'] ?? 1080)),
      );
      $compressionLevel = (string) ($media['optimization']['compressionLevel'] ?? 'medium');
      $media['optimization']['compressionLevel'] = in_array(
        $compressionLevel,
        ['low', 'medium', 'high'],
        true,
      )
        ? $compressionLevel
        : 'medium';
    }

    if (isset($media['storage']) && is_array($media['storage'])) {
      $storageLocation = (string) ($media['storage']['location'] ?? 'local');
      $media['storage']['location'] = in_array($storageLocation, ['local', 'cdn'], true)
        ? $storageLocation
        : 'local';
      $folderStructure = (string) ($media['storage']['folderStructure'] ?? 'year_month');
      $media['storage']['folderStructure'] = in_array(
        $folderStructure,
        ['year_month', 'flat'],
        true,
      )
        ? $folderStructure
        : 'year_month';

      $cdnUrl = rtrim(trim((string) ($media['storage']['cdnUrl'] ?? '')), '/');
      if ($cdnUrl !== '') {
        $cdnScheme = strtolower((string) parse_url($cdnUrl, PHP_URL_SCHEME));
        if (
          filter_var($cdnUrl, FILTER_VALIDATE_URL) === false ||
          !in_array($cdnScheme, ['http', 'https'], true)
        ) {
          ResponseHelper::sendError('CDN URL must use http or https.', 400);
        }
        $media['storage']['cdnUrl'] = $cdnUrl;
      } else {
        unset($media['storage']['cdnUrl']);
      }
    }
    foreach (['optimization', 'storage', 'performance'] as $key) {
      if (isset($media[$key])) {
        $isPublic = SecurityHelper::isSensitiveKey($key) ? 0 : 1;
        $encodedValue = json_encode($media[$key]);
        $auditBefore = voncms_get_setting_audit_snapshot($pdo, 'media', $key);
        try {
          $upsertStmt->execute(['media', $key, $encodedValue, 'json', $isPublic, $userId]);
        } catch (PDOException $qe) {
          // RESILIENCE FALLBACK
          if (
            strpos($qe->getMessage(), 'is_public') !== false ||
            strpos($qe->getMessage(), 'updated_by') !== false
          ) {
            $legacyStmt = $pdo->prepare("
                 INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, version)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE 
                     setting_value = VALUES(setting_value),
                     version = version + 1,
                     updated_at = NOW()
             ");
            $legacyStmt->execute(['media', $key, $encodedValue, 'json']);
          } else {
            throw $qe;
          }
        }
        voncms_record_setting_audit($pdo, 'media', $key, $auditBefore, $encodedValue, $userId);
        $updated++;
      }
    }
    if (isset($media['defaultView'])) {
      $isPublic = SecurityHelper::isSensitiveKey('default_view') ? 0 : 1;
      $auditBefore = voncms_get_setting_audit_snapshot($pdo, 'media', 'default_view');
      try {
        $upsertStmt->execute([
          'media',
          'default_view',
          $media['defaultView'],
          'string',
          $isPublic,
          $userId,
        ]);
      } catch (PDOException $qe) {
        // RESILIENCE FALLBACK
        if (
          strpos($qe->getMessage(), 'is_public') !== false ||
          strpos($qe->getMessage(), 'updated_by') !== false
        ) {
          $legacyStmt = $pdo->prepare("
               INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, version)
               VALUES (?, ?, ?, ?, 1)
               ON DUPLICATE KEY UPDATE 
                   setting_value = VALUES(setting_value),
                   version = version + 1,
                   updated_at = NOW()
           ");
          $legacyStmt->execute(['media', 'default_view', $media['defaultView'], 'string']);
        } else {
          throw $qe;
        }
      }
      voncms_record_setting_audit(
        $pdo,
        'media',
        'default_view',
        $auditBefore,
        (string) $media['defaultView'],
        $userId,
      );
      $updated++;
    }
  }

  $mirrorWarning = null;
  $pdo->commit();
  voncms_public_cache_clear();

  // Legacy JSON mirror for compatibility-only fallback readers.
  $settingsFile = __DIR__ . '/../data/site_settings.json';

  $settingsForFile = $settings;
  if (!$isPrimaryAdmin && file_exists($settingsFile)) {
    $existingSettingsForFile = json_decode((string) file_get_contents($settingsFile), true);
    if (is_array($existingSettingsForFile)) {
      $settingsForFile = array_replace($existingSettingsForFile, $settingsForFile);
    }
  }
  if (isset($settingsForFile['postsPerPage'])) {
    $settingsForFile['postsPerPage'] = max(6, min(50, (int) $settingsForFile['postsPerPage']));
    $settingsForFile['posts_per_page'] = $settingsForFile['postsPerPage'];
  }

  try {
    voncms_write_settings_json_mirror($settingsFile, $settingsForFile);
  } catch (Throwable $mirrorError) {
    $mirrorWarning =
      'Settings saved to database, but the legacy JSON mirror could not be refreshed.';
    error_log('Settings JSON mirror write failed: ' . $mirrorError->getMessage());
  }

  echo json_encode([
    'success' => true,
    'message' => 'Settings saved successfully',
    'updated' => $updated,
    'source' => 'database',
    'warning' => $mirrorWarning,
  ]);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
