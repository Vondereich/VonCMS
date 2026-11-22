<?php

// Shared persistence side effects; never an HTTP endpoint.
if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
    realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/DataBoundary.php';

/**
 * Apply the public maintenance flag without allowing a silent filesystem failure.
 */
function voncms_apply_maintenance_flag(string $flagFile, bool $enabled): void
{
  $flagDirectory = dirname($flagFile);

  if ($enabled) {
    if (!is_dir($flagDirectory) && !@mkdir($flagDirectory, 0755, true) && !is_dir($flagDirectory)) {
      throw new RuntimeException('Maintenance mode storage is unavailable.');
    }

    $written = @file_put_contents($flagFile, "MAINTENANCE_ON\n", LOCK_EX);
    if ($written === false || !is_file($flagFile)) {
      throw new RuntimeException('Maintenance mode could not be enabled.');
    }
    return;
  }

  if (is_file($flagFile) && !@unlink($flagFile) && is_file($flagFile)) {
    throw new RuntimeException('Maintenance mode could not be disabled.');
  }
}

/** Credentials belong to the database/private credential store, never the JSON mirror.
 * @param array<array-key, mixed> $settings
 * @return array<array-key, mixed>
 */
function voncms_filter_settings_mirror(array $settings): array
{
  foreach ($settings as $key => $value) {
    if (
      in_array(
        strtolower(str_replace('_', '', (string) $key)),
        [
          'aiapikey',
          'indexnowkey',
          'encryptstoredaikey',
          'replaceaikey',
          'aikeystorage',
          'smtppass',
          'smtppassword',
        ],
        true,
      )
    ) {
      unset($settings[$key]);
    } elseif (is_array($value)) {
      $settings[$key] = voncms_filter_settings_mirror($value);
    }
  }
  return $settings;
}

/** @param array<array-key, mixed> $settingsForFile */
function voncms_write_settings_json_mirror(string $settingsFile, array $settingsForFile): void
{
  $settingsDir = dirname($settingsFile);
  if (!is_dir($settingsDir) && !@mkdir($settingsDir, 0755, true) && !is_dir($settingsDir)) {
    throw new Exception('Could not create settings data directory.');
  }

  $json = json_encode(
    voncms_filter_settings_mirror($settingsForFile),
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );

  if ($json === false || strlen($json) <= 2) {
    throw new Exception('Could not encode settings mirror JSON.');
  }

  $tempFile = $settingsFile . '.' . bin2hex(random_bytes(6)) . '.tmp';

  try {
    // Create empty private staging before writing any credential bytes.
    $previousUmask = umask(0077);
    try {
      $handle = @fopen($tempFile, 'x+b');
    } finally {
      umask($previousUmask);
    }
    if ($handle === false) {
      throw new Exception('Could not create private settings mirror.');
    }
    try {
      if (!@chmod($tempFile, 0600)) {
        throw new Exception('Could not protect settings mirror.');
      }
      $written = 0;
      while ($written < strlen($json)) {
        $bytes = @fwrite($handle, substr($json, $written));
        if ($bytes === false || $bytes === 0) {
          throw new Exception('Incomplete settings mirror write.');
        }
        $written += $bytes;
      }
      if (!@fflush($handle)) {
        throw new Exception('Could not flush settings mirror.');
      }
    } finally {
      fclose($handle);
    }
    if (file_exists($settingsFile) && !@chmod($settingsFile, 0600)) {
      throw new Exception('Could not protect existing settings mirror.');
    }
    // Do not copy secret bytes into a potentially public destination on rename failure.
    if (!@rename($tempFile, $settingsFile)) {
      throw new Exception('Failed to commit private settings mirror.');
    }
  } finally {
    if (file_exists($tempFile)) {
      @unlink($tempFile);
    }
  }
}

/** @param array<array-key, mixed> $settingsForFile
 * @return array<array-key, mixed>
 */
function voncms_prepare_settings_domain_mirror(array $settingsForFile, string $domainUrl): array
{
  $settingsForFile['domainUrl'] = rtrim(trim($domainUrl), '/');
  if (isset($settingsForFile['system']) && is_array($settingsForFile['system'])) {
    unset($settingsForFile['system']['domainUrl']);
    if ($settingsForFile['system'] === []) {
      unset($settingsForFile['system']);
    }
  }
  return $settingsForFile;
}

/** @return list<array{string, string, string, string}> */
function voncms_settings_mappings(): array
{
  return [
    // General
    ['siteName', 'general', 'site_name', 'string'],
    ['siteDescription', 'general', 'site_description', 'string'],
    ['siteTagline', 'general', 'site_tagline', 'string'],
    ['site_language', 'general', 'site_language', 'string'],
    ['postsPerPage', 'general', 'posts_per_page', 'number'],
    ['metaDescriptionLimit', 'general', 'meta_description_limit', 'number'],
    ['maintenanceMode', 'general', 'maintenance_mode', 'boolean'],
    ['emailSmtp', 'general', 'email_smtp', 'string'],
    ['logoUrl', 'general', 'logo_url', 'string'],
    ['headerIdentityMode', 'general', 'header_identity_mode', 'string'],
    ['useLogoAsTitle', 'general', 'use_logo_as_title', 'boolean'],
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
    ['dateFormat', 'general', 'date_format', 'string'],
    ['adminPalette', 'general', 'admin_palette', 'string'],
    // SMTP Settings
    ['smtpHost', 'smtp', 'smtpHost', 'string'],
    ['smtpPort', 'smtp', 'smtpPort', 'number'],
    ['smtpUser', 'smtp', 'smtpUser', 'string'],
    ['smtpPass', 'smtp', 'smtpPass', 'string'],
    ['smtpEncryption', 'smtp', 'smtpEncryption', 'string'],
    ['smtpFromName', 'smtp', 'smtpFromName', 'string'],
    ['smtpFromEmail', 'smtp', 'smtpFromEmail', 'string'],
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
}

/** Rebuild the compatibility snapshot from committed database state, never from a stale draft.
 * @return array<string, mixed>
 */
function voncms_read_settings_mirror(PDO $pdo): array
{
  $statement = $pdo->query(
    'SELECT setting_group, setting_key, setting_value, setting_type FROM settings',
  );
  if (!$statement) {
    throw new RuntimeException('Could not read committed Settings for the compatibility mirror.');
  }
  $rows = DataBoundary::rows($statement->fetchAll(PDO::FETCH_ASSOC));
  $index = [];
  foreach ($rows as $row) {
    $index[(string) $row['setting_group'] . '.' . (string) $row['setting_key']] = $row;
  }
  $settings = [];
  foreach (voncms_settings_mappings() as [$name, $group, $key, $type]) {
    $row = $index[$group . '.' . $key] ?? null;
    if ($row === null) {
      continue;
    }
    $value = $row['setting_value'];
    $settings[$name] = match ($type) {
      'json' => json_decode((string) $value, true, 512, JSON_THROW_ON_ERROR),
      'boolean' => in_array($value, ['1', 'true', 1, true], true),
      'number' => (int) $value,
      default => $value,
    };
  }
  $media = [];
  foreach (['optimization', 'storage', 'performance', 'default_view'] as $key) {
    if (!isset($index['media.' . $key])) {
      continue;
    }
    $row = $index['media.' . $key];
    $name = $key === 'default_view' ? 'defaultView' : $key;
    $media[$name] =
      $row['setting_type'] === 'json'
        ? json_decode((string) $row['setting_value'], true, 512, JSON_THROW_ON_ERROR)
        : $row['setting_value'];
  }
  if ($media !== []) {
    $settings['media'] = $media;
  }
  if (isset($settings['postsPerPage'])) {
    $settings['postsPerPage'] = max(6, min(50, $settings['postsPerPage']));
    $settings['posts_per_page'] = $settings['postsPerPage'];
  }
  $domainUrl = $settings['domainUrl'] ?? '';
  if (!is_string($domainUrl)) {
    throw new RuntimeException('Canonical Domain URL is invalid for the settings mirror.');
  }
  return voncms_prepare_settings_domain_mirror($settings, $domainUrl);
}
