<?php
declare(strict_types=1);

// In-memory fixtures only; never load the site's database configuration.
require_once dirname(__DIR__, 2) . '/public/security.php';
require_once dirname(__DIR__, 2) . '/public/public_render_helper.php';

function check(bool $condition, string $label): void
{
  if (!$condition) {
    throw new RuntimeException($label);
  }
}

$stored = [
  'discussionEnabled' => false,
  'registrationEnabled' => false,
  'sidebarLayout' => [],
  'navigation' => [],
  'footerLinks' => [],
  'ads' => ['headerAd' => '', 'popupEnabled' => false, 'inFeedFrequency' => 0],
  'activePlugins' => ['vp_promo_bar', 'vp_related_posts', 'vp_ai_summary', 'vp_gift_widget'],
  'pluginConfig' => [
    'pluginStatus' => [
      'vp_promo_bar' => 'inactive',
      'vp_related_posts' => 'active',
      'vp_ai_summary' => 'not_installed',
    ],
    'vp_promo_bar' => ['text' => 'QA_DISABLED_PROMO', 'linkUrl' => 'https://example.test'],
    'vp_related_posts' => ['enabled' => false, 'count' => 0, 'titleText' => '', 'items' => []],
    'vp_ai_summary' => ['labelText' => 'QA_NOT_INSTALLED'],
    'vp_gift_widget' => ['targetUrl' => 'https://example.test/gift', 'targetBlank' => false],
    'vp_unlisted' => ['text' => 'QA_UNLISTED_CONFIG'],
  ],
  'customPlugins' => [
    ['id' => 'off', 'enabled' => false, 'htmlContent' => 'QA_DISABLED_CUSTOM'],
    ['id' => 'on', 'enabled' => true, 'htmlContent' => '<b>QA_ENABLED_CUSTOM</b>'],
    ['id' => 'string', 'enabled' => 'true', 'htmlContent' => 'QA_STRING_ENABLED'],
  ],
];
$before = $stored;
$public = voncms_project_public_plugin_settings($stored);
check($stored === $before, 'Projection must not mutate stored/admin settings');
check(
  $public['activePlugins'] === ['vp_related_posts', 'vp_gift_widget'],
  'Only effective active IDs remain',
);
check(
  $public['pluginConfig']['pluginStatus'] === ['vp_related_posts' => 'active'],
  'Active statuses stay aligned',
);
check(
  $public['pluginConfig']['vp_related_posts'] === $stored['pluginConfig']['vp_related_posts'],
  'Active false/zero/empty values stay exact',
);
check(
  $public['pluginConfig']['vp_gift_widget'] === $stored['pluginConfig']['vp_gift_widget'],
  'Legacy active IDs without status retain config',
);
check(
  count($public['customPlugins']) === 1 && $public['customPlugins'][0]['id'] === 'on',
  'Custom plugins use strict boolean activation',
);
foreach (
  ['discussionEnabled', 'registrationEnabled', 'sidebarLayout', 'navigation', 'footerLinks', 'ads']
  as $key
) {
  check($public[$key] === $stored[$key], 'Non-plugin settings must remain unchanged: ' . $key);
}
check(
  !str_contains(json_encode($public, JSON_THROW_ON_ERROR), 'QA_DISABLED') &&
    !str_contains(json_encode($public), 'QA_NOT_INSTALLED') &&
    !str_contains(json_encode($public), 'QA_UNLISTED'),
  'Inactive payload contents must be absent',
);

$stored['pluginConfig']['pluginStatus']['vp_promo_bar'] = 'active';
$reactivated = voncms_project_public_plugin_settings($stored);
check(
  $reactivated['pluginConfig']['vp_promo_bar'] === $before['pluginConfig']['vp_promo_bar'],
  'Reactivation restores saved configuration',
);
$empty = voncms_project_public_plugin_settings([]);
check(
  $empty['activePlugins'] === [] && $empty['customPlugins'] === [],
  'Missing plugin collections stay explicitly empty',
);
check(
  json_encode($empty['pluginConfig']) === '{}',
  'Empty configuration keeps the object contract',
);

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec(
  'CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT, setting_type TEXT)',
);
$pdo->exec('CREATE TABLE posts (category TEXT, status TEXT, scheduled_at TEXT)');
$insert = $pdo->prepare('INSERT INTO settings VALUES (?, ?, ?, ?)');
foreach (
  [
    ['general', 'discussion_enabled', 'false', 'boolean'],
    ['general', 'registration_enabled', 'false', 'boolean'],
    ['general', 'posts_per_page', '13', 'number'],
    ['general', 'domain_url', 'https://example.test/zangetsu', 'string'],
    ['sidebar', 'layout', '[]', 'json'],
    ['navigation', 'menu_items', '[]', 'json'],
    ['plugins', 'active_plugins', json_encode($before['activePlugins']), 'json'],
    ['plugins', 'plugin_config', json_encode($before['pluginConfig']), 'json'],
    [
      'plugins',
      'custom_plugins',
      json_encode([
        [
          'id' => 'off',
          'name' => 'Off',
          'location' => 'header_top',
          'enabled' => false,
          'htmlContent' => 'QA_DISABLED_CUSTOM',
        ],
        [
          'id' => 'on',
          'name' => 'On',
          'location' => 'header_top',
          'enabled' => true,
          'htmlContent' => '<b>QA_ENABLED_CUSTOM</b>',
        ],
      ]),
      'json',
    ],
  ]
  as $row
) {
  $insert->execute($row);
}
$rowsBefore = $pdo->query('SELECT * FROM settings')->fetchAll(PDO::FETCH_ASSOC);
$projection = voncms_build_public_settings_projection($pdo);
check(
  $pdo->query('SELECT * FROM settings')->fetchAll(PDO::FETCH_ASSOC) === $rowsBefore,
  'Public settings reads must not rewrite the database',
);
check(
  $projection['discussionEnabled'] === false && $projection['registrationEnabled'] === false,
  'Full projection retains disabled controls',
);
check(
  $projection['sidebarLayout'] === [] && $projection['navigation'] === [],
  'Full projection retains empty layout lists',
);
check(
  $projection['postsPerPage'] === 13 &&
    $projection['domainUrl'] === 'https://example.test/zangetsu',
  'Public limits and subfolder URLs stay unchanged',
);
check(
  $projection['activePlugins'] === $public['activePlugins'] &&
    $projection['pluginConfig'] === $public['pluginConfig'],
  'Real HTML/API projection uses the selective filter',
);
check(
  count($projection['customPlugins']) === 1 && $projection['customPlugins'][0]['id'] === 'on',
  'Full projection omits disabled custom markup',
);
echo "PASS Public plugin settings: selective projection, legacy status, reactivation, database preservation and discussion/empty-value controls.\n";
