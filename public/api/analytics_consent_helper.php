<?php
/** Shared server-owned consent policy for both native tracking endpoints. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
  http_response_code(403);
  exit('Forbidden');
}

function voncms_native_analytics_allowed(PDO $pdo, array $cookies): bool
{
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_group, setting_key, setting_value
       FROM settings
       WHERE (setting_group = 'plugins' AND setting_key IN ('active_plugins', 'plugin_config'))
          OR (setting_group = 'analytics' AND setting_key = 'config')",
    );
    $stmt->execute();
    $values = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
      $key = (string) $row['setting_group'] . '.' . (string) $row['setting_key'];
      $values[$key] = json_decode((string) $row['setting_value'], false, 512, JSON_THROW_ON_ERROR);
    }

    $values += [
      'plugins.active_plugins' => [],
      'plugins.plugin_config' => new stdClass(),
      'analytics.config' => new stdClass(),
    ];
    $activePlugins = $values['plugins.active_plugins'];
    $pluginConfig = $values['plugins.plugin_config'];
    $analyticsConfig = $values['analytics.config'];
    // Missing optional config uses existing defaults. Malformed stored policy never grants consent.
    if (
      !is_array($activePlugins) ||
      !in_array('vp_analytics', $activePlugins, true) ||
      !($pluginConfig instanceof stdClass) ||
      !($analyticsConfig instanceof stdClass)
    ) {
      return false;
    }
    $statuses = $pluginConfig->pluginStatus ?? new stdClass();
    if (!($statuses instanceof stdClass)) {
      return false;
    }
    $status = $statuses->vp_analytics ?? null;
    if ($status !== null && $status !== 'active') {
      return false;
    }

    $consentRequired = $analyticsConfig->cookieConsent ?? false;
    if (!is_bool($consentRequired)) {
      return false;
    }
    return !$consentRequired || ($cookies['von_consent'] ?? null) === 'true';
  } catch (Throwable $error) {
    // Analytics is optional: unavailable or corrupt policy disables visitor recording, not views.
    return false;
  }
}
