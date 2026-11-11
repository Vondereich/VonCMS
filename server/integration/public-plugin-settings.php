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

if (($argv[1] ?? '') === '--project-json') {
  $cases = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
  if (!is_array($cases)) {
    throw new InvalidArgumentException('Projection cases must be an array.');
  }
  echo json_encode(
    array_map('voncms_project_public_runtime_settings', $cases),
    JSON_THROW_ON_ERROR,
  );
  exit();
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
$themeKeys = [
  'theme-default' => 'default',
  'theme-prism' => 'prism',
  'theme-techpress' => 'techpress',
  'theme-portfolio' => 'portfolio',
  'theme-digest' => 'digest',
  'theme-corporate-pro' => 'corporatePro',
];
$savedTheme = [
  'primaryColor' => '#123456',
  'fontFamily' => '',
  'borderRadius' => '0',
  'customCss' => '',
  'unownedNamespace' => ['text' => 'UNOWNED_THEME_PAYLOAD'],
];
foreach ($themeKeys as $themeKey) {
  $savedTheme[$themeKey] = [
    'title' => 'SAVED_THEME_' . $themeKey,
    'showHero' => false,
    'count' => 0,
    'footerLinks' => [],
    'footerCopyright' => '',
  ];
}
$insert->execute(['theme', 'customization', json_encode($savedTheme), 'json']);
$insert->execute(['theme', 'active_theme_id', 'theme-default', 'string']);
$insert->execute([
  'ads',
  'ads_config',
  json_encode([
    'adsEnabled' => false,
    'headerAd' => 'UNUSED_AD',
    'inFeedAd' => 'UNUSED_FEED',
    'popupAd' => 'UNUSED_POPUP',
    'popupEnabled' => false,
    'inFeedFrequency' => 0,
  ]),
  'json',
]);
$insert->execute([
  'newsletter',
  'newsletter_config',
  '{"enabled":false,"title":"UNUSED_NEWSLETTER"}',
  'json',
]);
$switch = $pdo->prepare(
  "UPDATE settings SET setting_value=? WHERE setting_group='theme' AND setting_key='active_theme_id'",
);
$indexSource = file_get_contents(dirname(__DIR__, 2) . '/public/index.php');
$seedMatch = [];
check(
  is_string($indexSource) &&
    preg_match('/window\.__INITIAL_SETTINGS__ = <\?php (.*?)\?>;/s', $indexSource, $seedMatch) ===
      1,
  'Actual first-render settings injection must be available',
);
$renderSeed = static function (array $context) use ($seedMatch): array {
  extract($context, EXTR_SKIP);
  $articleSchemaType = 'NewsArticle';
  ob_start();
  try {
    // Execute the real JSON injection expression, not a duplicate PHP/JS serializer.
    eval($seedMatch[1]);
    return json_decode(ob_get_contents(), true, 512, JSON_THROW_ON_ERROR);
  } finally {
    ob_end_clean();
  }
};
foreach (['', '/newsroom'] as $basePath) {
  $pdo
    ->prepare(
      "UPDATE settings SET setting_value=? WHERE setting_group='general' AND setting_key='domain_url'",
    )
    ->execute(['https://example.test' . $basePath]);
  foreach ($themeKeys as $themeId => $themeKey) {
    $switch->execute([$themeId]);
    $databaseBefore = $pdo->query('SELECT * FROM settings')->fetchAll(PDO::FETCH_ASSOC);
    $projected = voncms_build_public_settings_projection($pdo);
    check($projected['activeThemeId'] === $themeId, 'Active theme ID stays aligned');
    check(
      $projected['theme'][$themeKey] === $savedTheme[$themeKey],
      'Active false/zero/empty values survive',
    );
    foreach ($themeKeys as $otherKey) {
      check(
        isset($projected['theme'][$otherKey]) === ($otherKey === $themeKey),
        'Only the selected theme namespace is public',
      );
    }
    check(!isset($projected['theme']['unownedNamespace']), 'Unconsumed namespaces are omitted');
    check(
      $projected['theme']['fontFamily'] === '' && $projected['theme']['borderRadius'] === '0',
      'Shared empty/zero appearance is not filtered',
    );
    check(
      $projected['ads'] === [
        'adsEnabled' => false,
        'popupEnabled' => false,
        'inFeedFrequency' => 0,
      ],
      'Disabled ad code is omitted without losing OFF/zero controls',
    );
    check($projected['newsletter'] === ['enabled' => false], 'Newsletter OFF remains explicit');
    check(
      $pdo->query('SELECT * FROM settings')->fetchAll(PDO::FETCH_ASSOC) === $databaseBefore,
      'Projection never deletes saved inactive configuration',
    );
    $context = voncms_load_public_runtime_context(
      $pdo,
      $basePath,
      '/',
      1,
      'https://example.test' . $basePath,
      'Fixture',
      'Description',
    );
    check(
      $context['themeCustomization'] === $projected['theme'],
      'PHP first render and API share one active theme projection',
    );
    check(
      $context['publicSettingsSnapshot']['ads'] === $projected['ads'],
      'SSR/API agree on disabled ads',
    );
    check($context['discussionEnabledValue'] === false, 'SSR never reactivates Discussion');
    check(
      $context['domainUrl'] === 'https://example.test' . $basePath,
      'Root/subfolder origin remains exact',
    );
    $seed = $renderSeed($context);
    check(
      $seed['theme'] === $projected['theme'],
      'Real PHP HTML seed must match the guest theme projection',
    );
    check(
      $seed['ads'] === $projected['ads'] && $seed['newsletter'] === ['enabled' => false],
      'Real PHP HTML seed must retain OFF states',
    );
    check(
      $seed['navigation'] === [] &&
        $seed['sidebarLayout'] === [] &&
        $seed['discussionEnabled'] === false,
      'Real HTML seed must not reactivate empty/OFF controls',
    );
  }
}
foreach (['', 'theme-unknown'] as $fallbackId) {
  $switch->execute([$fallbackId]);
  $fallback = voncms_build_public_settings_projection($pdo);
  check(
    $fallback['activeThemeId'] === 'theme-default' &&
      $fallback['theme']['default'] === $savedTheme['default'],
    'Unknown/missing theme follows the bundled Default fallback',
  );
}
// Canonical empty rows must not revive legacy enabled configuration aliases.
$insert->execute(['ads', 'configuration', '{"adsEnabled":true,"headerAd":"LEGACY_AD"}', 'json']);
$insert->execute([
  'newsletter',
  'configuration',
  '{"enabled":true,"title":"LEGACY_NEWSLETTER"}',
  'json',
]);
foreach (['ads', 'newsletter'] as $group) {
  $key = $group === 'ads' ? 'ads_config' : 'newsletter_config';
  $pdo
    ->prepare('UPDATE settings SET setting_value=? WHERE setting_group=? AND setting_key=?')
    ->execute(['[]', $group, $key]);
}
$emptyCanonical = voncms_build_public_settings_projection($pdo);
check(
  $emptyCanonical['ads'] === [] && $emptyCanonical['newsletter'] === [],
  'Canonical empty configuration beats legacy enabled content',
);
$enabled = $before + ['activeThemeId' => 'theme-digest', 'theme' => $savedTheme];
$enabled['ads'] = [
  'adsEnabled' => true,
  'headerAd' => '',
  'inFeedAd' => '',
  'popupAd' => '',
  'popupEnabled' => false,
  'inFeedFrequency' => 0,
];
$enabled['newsletter'] = ['enabled' => true, 'title' => '', 'items' => []];
$enabledBefore = $enabled;
$enabledPublic = voncms_project_public_runtime_settings($enabled);
check(
  $enabledPublic['ads'] === $enabled['ads'] &&
    $enabledPublic['newsletter'] === $enabled['newsletter'],
  'Enabled empty content/zero values remain exact',
);
check($enabled === $enabledBefore, 'Direct projection also preserves stored values');
$off = $enabled;
$off['ads']['adsEnabled'] = false;
$off['ads']['headerAd'] = 'SAVED_AD';
$off['newsletter'] = ['enabled' => false, 'title' => 'SAVED_NEWSLETTER'];
$offPublic = voncms_project_public_runtime_settings($off);
check(
  !array_key_exists('headerAd', $offPublic['ads']) &&
    !array_key_exists('title', $offPublic['newsletter']),
  'OFF omits dormant content',
);
$off['ads']['adsEnabled'] = true;
$off['newsletter']['enabled'] = true;
$onPublic = voncms_project_public_runtime_settings($off);
check(
  $onPublic['ads']['headerAd'] === 'SAVED_AD' &&
    $onPublic['newsletter']['title'] === 'SAVED_NEWSLETTER',
  'Re-enabling restores retained content',
);
$legacyThemeBytes = strlen(json_encode($savedTheme, JSON_THROW_ON_ERROR));
$activeThemeBytes = strlen(json_encode($enabledPublic['theme'], JSON_THROW_ON_ERROR));
check($activeThemeBytes < $legacyThemeBytes, 'Active-only fixture payload is actually smaller');
echo 'PASS Public settings: six themes/root/subfolder SSR/API parity, retained storage, reactivation, legacy alias precedence, explicit OFF/empty/zero values; fixture theme JSON ' .
  $legacyThemeBytes .
  ' -> ' .
  $activeThemeBytes .
  " bytes (not a page-speed benchmark).\n";
