<?php
declare(strict_types=1);

// CLI-only fixtures: execute the source router with an in-memory database, never a site's config.
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
  throw new RuntimeException('Public route fixtures require pdo_sqlite.');
}
$root = dirname(__DIR__, 2);
define('VONCMS_CORE_LOADED', true);
$GLOBALS['voncms_publication_capability_cache'] = [];

// Intercept only the terminating redirect emitter so each real route branch can be checked.
final class NumericRouteRedirect extends RuntimeException
{
  public function __construct(public string $location, public int $status)
  {
    parent::__construct($location);
  }
}
function voncms_send_redirect(mixed $location, $status = 301, $source = ''): never
{
  throw new NumericRouteRedirect((string) $location, (int) $status);
}
require_once $root . '/public/seo_schema_helper.php';
require_once $root . '/public/seo_response_helper.php';
require_once $root . '/public/core/ResponseHelper.php';
require_once $root . '/public/content_metrics_helper.php';
require_once $root . '/public/media_variants.php';
require_once $root . '/public/api/system/IndexNow.php';

$source = (string) file_get_contents($root . '/public/index.php');
$start = strpos($source, '// Parse URL to detect post/page slug');
$end = strpos($source, '// HOMEPAGE SEO: Latest posts for noscript + Schema', $start ?: 0);
if ($start === false || $end === false || $end <= $start) {
  throw new RuntimeException('Could not isolate the actual public router.');
}
$router = substr($source, $start, $end - $start);
$hydrationStart = strpos($source, "$" . "initialState = ['status' => 'idle'");
$hydrationEnd = $hydrationStart === false ? false : strpos($source, '?>', $hydrationStart);
if ($hydrationStart === false || $hydrationEnd === false) {
  throw new RuntimeException('Could not isolate actual content hydration.');
}
$hydrator = substr($source, $hydrationStart, $hydrationEnd - $hydrationStart);
final class PublicRouteFixturePDO extends PDO
{
  public int $contentLookups = 0;

  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    if (preg_match('/\bFROM\s+(?:posts|pages)\b/i', $query) === 1) {
      $this->contentLookups++;
    }
    return parent::prepare($query, $options);
  }
}
$pdo = new PublicRouteFixturePDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec(
  'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, avatar TEXT, bio TEXT, email TEXT, role TEXT)',
);
$pdo->exec(
  "INSERT INTO users VALUES (1, 'editor', 'Editor', '', 'Public biography', 'private-profile-canary@example.invalid', 'root')",
);
$columns =
  'id INTEGER PRIMARY KEY, title TEXT, slug TEXT, content TEXT, excerpt TEXT, author TEXT, author_id INTEGER, meta_description TEXT, keywords TEXT, created_at TEXT, updated_at TEXT, status TEXT';
$pdo->exec(
  'CREATE TABLE posts (' . $columns . ', image_url TEXT, category TEXT, scheduled_at TEXT)',
);
$pdo->exec('CREATE TABLE pages (' . $columns . ')');
$pdo->exec('CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT)');
$insertPost = $pdo->prepare(
  'INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
foreach (
  [
    [1, 'original', 'published', null],
    [2, 'original-2', 'published', null],
    [1000, 'original-1000', 'published', null],
    [123, 'original-123', 'published', null],
    [50, '2026', 'published', null],
    [51, '1', 'published', null],
    [52, '0002', 'published', null],
    [53, '1e3', 'published', null],
    [54, '1.0', 'published', null],
    [56, 'ordinary', 'published', null],
    [57, 'draft', 'draft', null],
    [58, '2030', 'published', '2030-01-01 00:00:00'],
    [59, '999', 'draft', null],
    [60, '9999', 'published', '2030-01-01 00:00:00'],
    [61, '+1', 'published', null],
    [62, 'legacy-null-status', null, null],
  ]
  as [$id, $slug, $status, $scheduledAt]
) {
  $insertPost->execute([
    $id,
    'Post ' . $slug,
    $slug,
    'Body',
    'Complete excerpt',
    'editor',
    1,
    'Manual description',
    '',
    '2026-10-01 12:00:00',
    '2026-10-01 12:00:00',
    $status,
    '',
    'Technology',
    $scheduledAt,
  ]);
}
$insertPage = $pdo->prepare('INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach (
  [
    [901, '0001', 'published'],
    [902, 'disclaimer', 'published'],
    [903, '123', 'published'],
    [904, 'draft-page', 'draft'],
  ]
  as [$id, $slug, $status]
) {
  $insertPage->execute([
    $id,
    'Page ' . $slug,
    $slug,
    'Page body',
    'Page excerpt',
    'editor',
    1,
    'Page description',
    '',
    '2026-10-01 12:00:00',
    '2026-10-01 12:00:00',
    $status,
  ]);
}

$runRoute = static function (
  string $request,
  string $basePath,
  string $domainUrl,
  string $style,
) use ($pdo, $router, $hydrator): array {
  $_SERVER['REQUEST_URI'] = $request;
  $_SERVER['QUERY_STRING'] = (string) (parse_url($request, PHP_URL_QUERY) ?? '');
  $publicContentCurrentTime = '2026-10-17 00:00:00';
  $authorNameSql = 'u.username';
  $authorDisplayNameSql = 'u.display_name';
  $hasDisplayNameColumn = true;
  $permalinkStructureValue = $style;
  $siteName = $seoTitle = 'Route QA';
  $seoDescription = $seoUrl = $seoImage = '';
  $seoRobots = 'index, follow';
  $schemaData = [];
  $articleSchemaType = 'NewsArticle';
  $schemaLanguage = 'en';
  $post = null;
  $lookupsBefore = $pdo->contentLookups;
  http_response_code(200);
  try {
    eval($router);
    eval($hydrator);
    return [
      'status' => http_response_code(),
      'id' => $post ? (int) $post['id'] : null,
      'type' => $schemaData['@type'] ?? null,
      'url' => $seoUrl,
      'robots' => $seoRobots,
      'description' => $seoDescription,
      'profile' => $profileUser ?? null,
      'contentLookups' => $pdo->contentLookups - $lookupsBefore,
      'hydration' => $initialState,
    ];
  } catch (NumericRouteRedirect $redirect) {
    return [
      'status' => $redirect->status,
      'location' => $redirect->location,
      'contentLookups' => $pdo->contentLookups - $lookupsBefore,
    ];
  }
};

$checks = 0;
foreach (
  [
    ['/', 'https://example.test'],
    ['/', 'https://news.example.test'],
    ['/zangetsu/', 'http://localhost/zangetsu'],
    ['/news/cms/', 'https://example.test/news/cms'],
  ]
  as [$basePath, $domainUrl]
) {
  foreach (
    [
      'admin',
      'api',
      'api.php',
      'assets',
      'core',
      'data',
      'index.php',
      'index.html',
      'install',
      'login',
      'profile',
      'register',
      'reset-password',
      'temp_update',
      'uploads',
    ]
    as $prefix
  ) {
    $encoded = '%' . bin2hex($prefix[0]) . substr($prefix, 1);
    foreach ([$prefix, strtoupper($prefix), $encoded, str_replace('%', '%25', $encoded)] as $form) {
      foreach (['ordinary', 'draft', '2030', 'draft-page'] as $tail) {
        $request = $basePath . $form . '/' . $tail;
        $result = $runRoute($request, $basePath, $domainUrl, 'slug');
        $expected = strtolower(rawurldecode($form)) === 'admin' ? 200 : 404;
        if (
          ($result['status'] ?? 0) !== $expected ||
          ($result['id'] ?? null) !== null ||
          ($result['contentLookups'] ?? -1) !== 0
        ) {
          throw new RuntimeException(
            'Reserved namespace reached public lookup: ' . $request . ' ' . json_encode($result),
          );
        }
        $checks++;
      }
    }
  }
  foreach (
    ['administrator', 'admin-news', 'ADMIN-news', '%61dministrator', 'rss', 'feed', 'docs', 'fonts']
    as $category
  ) {
    $result = $runRoute($basePath . $category . '/ordinary', $basePath, $domainUrl, 'slug');
    if (
      ($result['status'] ?? 0) !== 301 ||
      ($result['location'] ?? '') !== $domainUrl . '/ordinary'
    ) {
      throw new RuntimeException(
        'Valid category lookalike rejected: ' . $category . ' ' . json_encode($result),
      );
    }
    $checks++;
  }
  foreach (
    ['profile/editor', 'PROFILE/editor', '%70rofile/editor', 'profile/%65ditor']
    as $profilePath
  ) {
    $result = $runRoute($basePath . $profilePath, $basePath, $domainUrl, 'slug');
    if (
      ($result['status'] ?? 0) !== 200 ||
      ($result['type'] ?? '') !== 'ProfilePage' ||
      ($result['profile']['username'] ?? '') !== 'editor' ||
      ($result['url'] ?? '') !== $domainUrl . '/profile/editor' ||
      str_contains(json_encode($result), 'private-profile-canary') ||
      array_key_exists('role', $result['profile'] ?? [])
    ) {
      throw new RuntimeException(
        'Public profile boundary drifted: ' . $profilePath . ' ' . json_encode($result),
      );
    }
    $checks++;
  }
  foreach (
    [
      'admin\\ordinary',
      'admin%2fordinary',
      'admin%5cordinary',
      'admin%252fordinary',
      '%2fADMIN/ordinary',
      'business//ordinary',
      'business/%00ordinary',
      'business/%C2%80ordinary',
      'business/%xx',
      'business/%FF',
      'unrelated/deep/ordinary',
      '2026/13/ordinary',
      '2026/02/29/ordinary',
    ]
    as $invalidPath
  ) {
    $result = $runRoute($basePath . $invalidPath, $basePath, $domainUrl, 'slug');
    if (($result['status'] ?? 0) !== 404 || ($result['id'] ?? null) !== null) {
      throw new RuntimeException(
        'Invalid path reached public lookup: ' . $invalidPath . ' ' . json_encode($result),
      );
    }
    $checks++;
  }
  $result = $runRoute($basePath . '/ADMIN/ordinary', $basePath, $domainUrl, 'slug');
  if (($result['status'] ?? 0) !== 200 || ($result['id'] ?? null) !== null) {
    throw new RuntimeException(
      'Leading slash normalization lost the private namespace: ' . json_encode($result),
    );
  }
  $checks++;
  foreach (
    [
      ['2026', 50, 'NewsArticle'],
      ['1', 51, 'NewsArticle'],
      ['0002', 52, 'NewsArticle'],
      ['1e3', 53, 'NewsArticle'],
      ['1.0', 54, 'NewsArticle'],
      ['+1', 61, 'NewsArticle'],
      ['ordinary', 56, 'NewsArticle'],
      ['legacy-null-status', 62, 'NewsArticle'],
      ['0001', 901, 'WebPage'],
      ['123', 903, 'WebPage'],
      ['disclaimer', 902, 'WebPage'],
    ]
    as [$slug, $id, $type]
  ) {
    $result = $runRoute($basePath . $slug, $basePath, $domainUrl, 'slug');
    if (
      ($result['status'] ?? 0) !== 200 ||
      ($result['id'] ?? null) !== $id ||
      ($result['type'] ?? '') !== $type ||
      ($result['url'] ?? '') !== $domainUrl . '/' . $slug ||
      ($result['description'] ?? '') !==
        ($type === 'WebPage' ? 'Page description' : 'Manual description')
    ) {
      throw new RuntimeException(
        $basePath . $slug . ' exact route drifted: ' . json_encode($result),
      );
    }
    $checks++;
  }
  foreach (['slug', 'post_name', 'category', 'date', 'day_name', 'month_name', 'plain'] as $style) {
    foreach ([[50, '2026'], [51, '1'], [56, 'ordinary']] as [$id, $slug]) {
      $row = [
        'id' => $id,
        'slug' => $slug,
        'category' => 'Technology',
        'created_at' => '2026-10-01 12:00:00',
      ];
      $canonical = buildCanonicalContentPath($row, $style);
      $result = $runRoute(rtrim($basePath, '/') . $canonical, $basePath, $domainUrl, $style);
      if (
        ($result['status'] ?? 0) !== 200 ||
        ($result['id'] ?? null) !== $id ||
        ($result['url'] ?? '') !== $domainUrl . $canonical ||
        ($result['type'] ?? '') !== 'NewsArticle'
      ) {
        throw new RuntimeException($style . ' canonical route drifted: ' . json_encode($result));
      }
      $checks++;
    }
  }
  foreach (
    [
      ['post/1', 1, 'original'],
      ['post/123', 123, 'original-123'],
      ['post/2026', 50, '2026'],
      ['blog/2026', 50, '2026'],
      ['post/0002', 52, '0002'],
      ['post/1e3', 53, '1e3'],
      ['post/ordinary', 56, 'ordinary'],
      ['blog/1', 1, 'original'],
      ['technology/1', 51, '1'],
    ]
    as [$path, $id, $slug]
  ) {
    $result = $runRoute($basePath . $path . '?utm_source=qa', $basePath, $domainUrl, 'slug');
    if (
      ($result['status'] ?? 0) !== 301 ||
      ($result['location'] ?? '') !== $domainUrl . '/' . $slug . '?utm_source=qa'
    ) {
      throw new RuntimeException($path . ' alias drifted: ' . json_encode($result));
    }
    $target = $runRoute($basePath . $slug, $basePath, $domainUrl, 'slug');
    if (($target['id'] ?? null) !== $id || ($target['status'] ?? 0) !== 200) {
      throw new RuntimeException($path . ' alias target drifted: ' . json_encode($target));
    }
    $checks++;
  }
  foreach (
    [
      'missing',
      'draft',
      '2030',
      '999',
      '9999',
      'post/57',
      'post/58',
      'post/999',
      'post/9999',
      'technology/2030',
      'draft-page',
      'admin/settings',
    ]
    as $path
  ) {
    $result = $runRoute($basePath . $path, $basePath, $domainUrl, 'slug');
    $expectedStatus = $path === 'admin/settings' ? 200 : 404;
    if (
      ($result['status'] ?? 0) !== $expectedStatus ||
      ($result['id'] ?? null) !== null ||
      ($expectedStatus === 404 && ($result['robots'] ?? '') !== 'noindex, follow')
    ) {
      throw new RuntimeException(
        $path . ' visibility/missing-route boundary drifted: ' . json_encode($result),
      );
    }
    $checks++;
  }
}

// Literal zero is a valid text slug, not an omitted value or the numeric identity 0.
function numericSourceSpan(string $file, string $begin, string $end): string
{
  $text = (string) file_get_contents($file);
  $start = strpos($text, $begin);
  $stop = $start === false ? false : strpos($text, $end, $start + strlen($begin));
  if ($start === false || $stop === false) {
    throw new RuntimeException('Missing actual zero-slug source span: ' . $file);
  }
  return substr($text, $start, $stop - $start);
}
$sitemapPath = numericSourceSpan($root . '/public/sitemap.php', '$postSlug =', '$date =');
$llmsPath = numericSourceSpan($root . '/public/llms.php', '$postSlug =', '$url =');
$rssBuilder = numericSourceSpan($root . '/public/rss.php', '$buildPostUrl =', '// Query posts');
$saveSlug = numericSourceSpan(
  $root . '/public/api/save_post.php',
  '// Generate slug if not provided',
  '// Ensure slug uniqueness',
);
$profileGuard = numericSourceSpan(
  $root . '/public/api/get_public_profile.php',
  '// Get username from query parameter',
  'try {',
);
$rssQuery = numericSourceSpan($root . '/public/rss.php', '// Query posts', '// Generate RSS');
$insertZero = static function () use ($insertPost): void {
  $insertPost->execute([
    63,
    'Literal zero',
    '0',
    'Zero body',
    'Zero excerpt',
    'editor',
    1,
    'Zero description',
    '',
    '2026-10-01 12:00:00',
    '2026-10-01 12:00:00',
    'published',
    '',
    '0',
    null,
  ]);
};
$insertZero();
$pdo->exec(
  "INSERT INTO users VALUES(2,'0','Public zero','','Zero biography','private-zero-canary@example.invalid','member')",
);
foreach (
  ['0' => '0', '00' => '00', 'news-0' => 'news-0', '0-news' => '0-news', '' => 'different-title']
  as $given => $expected
) {
  $rawSlug = (string) $given;
  $rawTitle = 'Different Title';
  $input = [];
  eval($saveSlug);
  if ($input['slug'] !== $expected) {
    throw new RuntimeException(
      'Actual Post save changed literal slug ' . var_export($rawSlug, true),
    );
  }
  $checks++;
}
foreach (['editor', '0'] as $publicUsername) {
  $_GET = ['username' => $publicUsername];
  eval($profileGuard);
  if ($username !== $publicUsername) {
    throw new RuntimeException('Public profile text identity changed.');
  }
  $checks++;
}
foreach (
  [
    ['/', 'https://example.test'],
    ['/', 'https://news.example.test'],
    ['/zangetsu/', 'http://localhost/zangetsu'],
    ['/news/cms/', 'https://example.test/news/cms'],
  ]
  as [$basePath, $domainUrl]
) {
  foreach (
    [
      'slug' => '/0',
      'post_name' => '/0',
      'category' => '/0/0',
      'date' => '/2026/10/01/0',
      'day_name' => '/2026/10/01/0',
      'month_name' => '/2026/10/0',
      'plain' => '/post/63',
    ]
    as $style => $expectedPath
  ) {
    $row = ['id' => 63, 'slug' => '0', 'category' => '0', 'created_at' => '2026-10-01 12:00:00'];
    if (buildCanonicalContentPath($row, $style) !== $expectedPath) {
      throw new RuntimeException('Canonical substituted the identity for literal zero: ' . $style);
    }
    $checks++;
    foreach ([$sitemapPath, $llmsPath] as $pathCode) {
      $post = $row;
      $permalinkStyle = $style;
      eval($pathCode);
      if ($path !== $expectedPath) {
        throw new RuntimeException('Crawler URL substituted the identity for zero: ' . $style);
      }
      $checks++;
    }
    eval($rssBuilder);
    if ($buildPostUrl($row) !== $domainUrl . $expectedPath) {
      throw new RuntimeException('RSS URL substituted the identity for zero: ' . $style);
    }
    $checks++;
    $pdo->exec('DELETE FROM settings');
    $setting = $pdo->prepare("INSERT INTO settings VALUES('general',?,?)");
    $setting->execute(['domain_url', $domainUrl]);
    $setting->execute(['permalink_structure', $style]);
    if ((new IndexNow($pdo))->buildPostUrlForPost(63) !== $domainUrl . $expectedPath) {
      throw new RuntimeException('IndexNow URL substituted the identity for zero: ' . $style);
    }
    $checks++;
    $result = $runRoute(rtrim($basePath, '/') . $expectedPath, $basePath, $domainUrl, $style);
    if (
      ($result['status'] ?? 0) !== 200 ||
      ($result['id'] ?? null) !== 63 ||
      ($result['hydration']['post']['slug'] ?? null) !== '0' ||
      ($result['url'] ?? '') !== $domainUrl . $expectedPath
    ) {
      throw new RuntimeException(
        'Zero Post routing/hydration drifted: ' . $style . ' ' . json_encode($result),
      );
    }
    $checks++;
  }
  foreach (['post/0', 'blog/0', 'post/63'] as $legacy) {
    $result = $runRoute($basePath . $legacy, $basePath, $domainUrl, 'slug');
    if (($result['status'] ?? 0) !== 301 || ($result['location'] ?? '') !== $domainUrl . '/0') {
      throw new RuntimeException('Zero legacy alias drifted: ' . json_encode($result));
    }
    $checks++;
  }
  $profile = $runRoute($basePath . 'profile/0', $basePath, $domainUrl, 'slug');
  if (
    ($profile['type'] ?? '') !== 'ProfilePage' ||
    ($profile['profile']['username'] ?? '') !== '0' ||
    str_contains(json_encode($profile), 'private-zero-canary')
  ) {
    throw new RuntimeException('Zero public profile projection drifted.');
  }
  $checks++;
  $pdo->exec('DELETE FROM posts WHERE id=63');
  $insertPage->execute([
    905,
    'Zero Page',
    '0',
    'Zero Page body',
    'Zero excerpt',
    'editor',
    1,
    'Zero description',
    '',
    '2026-10-01 12:00:00',
    '2026-10-01 12:00:00',
    'published',
  ]);
  $page = $runRoute($basePath . '0', $basePath, $domainUrl, 'slug');
  if (
    ($page['id'] ?? null) !== 905 ||
    ($page['type'] ?? '') !== 'WebPage' ||
    ($page['url'] ?? '') !== $domainUrl . '/0' ||
    ($page['hydration']['page']['slug'] ?? null) !== '0'
  ) {
    throw new RuntimeException('Zero Page route or hydration drifted: ' . json_encode($page));
  }
  $checks++;
  $pdo->exec("UPDATE pages SET status='draft' WHERE id=905");
  $missing = $runRoute($basePath . '0', $basePath, $domainUrl, 'slug');
  if (
    ($missing['status'] ?? 0) !== 404 ||
    ($missing['hydration']['status'] ?? '') !== 'not_found' ||
    ($missing['robots'] ?? '') !== 'noindex, follow'
  ) {
    throw new RuntimeException('Missing/draft zero Page became homepage or exposed content.');
  }
  $checks++;
  $pdo->exec('DELETE FROM pages WHERE id=905');
  $insertZero();
}
foreach ([null, '0', 'Technology'] as $category) {
  $limit = 100;
  $offset = 0;
  eval($rssQuery);
  $ids = array_column($posts, 'id');
  if (
    $category === '0'
      ? $total !== 1 || $ids !== [63]
      : ($category === null
        ? !in_array(63, $ids, true)
        : in_array(63, $ids, true))
  ) {
    throw new RuntimeException('Actual RSS category zero filter/count/binding drifted.');
  }
  $checks++;
}
if (
  buildCanonicalContentPath(['id' => 63, 'slug' => '', 'category' => 'Technology'], 'slug') !==
    '/63' ||
  buildCanonicalContentPath(['id' => 63, 'slug' => null], 'slug') !== '/63' ||
  voncms_normalize_public_page('0') !== 1 ||
  voncms_is_public_content_path('/2026/00/0')
) {
  throw new RuntimeException('Empty fallback or numeric validation changed.');
}
$checks++;

// Generated category permalinks must not enter a system/folder namespace or
// reinterpret a positive-integer slug as an unrelated legacy Post ID.
$reservedSlugRow = $pdo->query('SELECT * FROM posts WHERE id=56')->fetch(PDO::FETCH_NUM);
foreach (
  [
    64 => 'login',
    65 => 'admin',
    66 => 'rss',
    67 => 'docs',
    68 => 'fonts',
    69 => 'themes',
    70 => 'backups',
    71 => 'docs-news',
    72 => 'FONTS',
    73 => '%62ackups',
    74 => 'public',
    75 => 'server',
    76 => 'src',
  ]
  as $id => $reservedSlug
) {
  $reservedSlugRow[0] = $id;
  $reservedSlugRow[2] = $reservedSlug;
  $insertPost->execute($reservedSlugRow);
}
$categoryCases = [
  ['admin', 'ordinary', 56, '/ordinary'],
  ['ADMIN', 'ordinary', 56, '/ordinary'],
  ['&#97;dmin', 'ordinary', 56, '/ordinary'],
  ['api', 'ordinary', 56, '/ordinary'],
  ['assets', 'ordinary', 56, '/ordinary'],
  ['backups', 'ordinary', 56, '/ordinary'],
  ['core', 'ordinary', 56, '/ordinary'],
  ['data', 'ordinary', 56, '/ordinary'],
  ['docs', 'ordinary', 56, '/ordinary'],
  ['fonts', 'ordinary', 56, '/ordinary'],
  ['themes', 'ordinary', 56, '/ordinary'],
  ['uploads', 'ordinary', 56, '/ordinary'],
  ['install', 'ordinary', 56, '/ordinary'],
  ['login', 'ordinary', 56, '/ordinary'],
  ['profile', 'ordinary', 56, '/ordinary'],
  ['register', 'ordinary', 56, '/ordinary'],
  ['reset-password', 'ordinary', 56, '/ordinary'],
  ['post', '1', 51, '/1'],
  ['blog', '1', 51, '/1'],
  ['post', '0', 63, '/post/0'],
  ['blog', '0002', 52, '/blog/0002'],
  ['post', '1e3', 53, '/post/1e3'],
  ['post', 'ordinary', 56, '/post/ordinary'],
  ['blog', 'ordinary', 56, '/blog/ordinary'],
  ['Business', 'ordinary', 56, '/business/ordinary'],
  ['Admin News', 'ordinary', 56, '/admin-news/ordinary'],
  ['temp_update', 'ordinary', 56, '/temp-update/ordinary'],
  ['admin', 'login', 64, '/post/64'],
  ['core', 'admin', 65, '/post/65'],
  ['install', 'rss', 66, '/post/66'],
  ['Business', 'login', 64, '/business/login'],
  ['admin', 'docs', 67, '/post/67'],
  ['api', 'fonts', 68, '/post/68'],
  ['docs', 'themes', 69, '/post/69'],
  ['install', 'backups', 70, '/post/70'],
  ['Business', 'docs', 67, '/business/docs'],
  ['admin', 'docs-news', 71, '/docs-news'],
  ['admin', 'FONTS', 72, '/post/72'],
  ['admin', '%62ackups', 73, '/post/73'],
  ['admin', 'public', 74, '/post/74'],
  ['core', 'server', 75, '/post/75'],
  ['install', 'src', 76, '/post/76'],
  ['src', 'ordinary', 56, '/src/ordinary'],
];
$originalCategories = $pdo->query('SELECT id, category FROM posts')->fetchAll(PDO::FETCH_KEY_PAIR);
$setCategory = $pdo->prepare('UPDATE posts SET category = ? WHERE id = ?');
foreach (
  [
    ['/', 'https://example.test'],
    ['/', 'https://news.example.test'],
    ['/zangetsu/', 'http://localhost/zangetsu'],
    ['/news/cms/', 'https://example.test/news/cms'],
  ]
  as [$basePath, $domainUrl]
) {
  $permalinkStyle = $permalinkStructureValue = 'category';
  foreach ($categoryCases as [$category, $slug, $id, $expectedPath]) {
    $setCategory->execute([$category, $id]);
    $row = [
      'id' => $id,
      'slug' => $slug,
      'category' => $category,
      'created_at' => '2026-10-01 12:00:00',
    ];
    $canonical = buildCanonicalContentPath($row, 'category');
    if ($canonical !== $expectedPath || $row['category'] !== $category) {
      throw new RuntimeException(
        'Category permalink collision: ' . json_encode([$row, $canonical, $expectedPath]),
      );
    }
    $result = $runRoute(rtrim($basePath, '/') . $canonical, $basePath, $domainUrl, 'category');
    if (
      ($result['status'] ?? 0) !== 200 ||
      ($result['id'] ?? null) !== $id ||
      ($result['url'] ?? '') !== $domainUrl . $expectedPath
    ) {
      throw new RuntimeException(
        'Category canonical reached the wrong record: ' . json_encode($result),
      );
    }
    $checks += 2;
    foreach ([$sitemapPath, $llmsPath] as $pathCode) {
      $post = $row;
      eval($pathCode);
      if ($path !== $expectedPath) {
        throw new RuntimeException(
          'Crawler category URL diverged: ' . json_encode([$category, $path, $expectedPath]),
        );
      }
      $checks++;
    }
    eval($rssBuilder);
    if ($buildPostUrl($row) !== $domainUrl . $expectedPath) {
      throw new RuntimeException('RSS category URL diverged.');
    }
    $pdo->exec('DELETE FROM settings');
    $setting = $pdo->prepare("INSERT INTO settings VALUES('general',?,?)");
    $setting->execute(['domain_url', $domainUrl]);
    $setting->execute(['permalink_structure', 'category']);
    if ((new IndexNow($pdo))->buildPostUrlForPost($id) !== $domainUrl . $expectedPath) {
      throw new RuntimeException('IndexNow category URL diverged.');
    }
    $checks += 2;
  }
  // Legacy incoming URLs retain their established ID priority, never redirecting
  // the private/system namespace to an article to compensate for a bad category.
  foreach (['post/1', 'blog/1'] as $legacyPath) {
    $legacy = $runRoute($basePath . $legacyPath, $basePath, $domainUrl, 'category');
    if (
      ($legacy['status'] ?? 0) !== 301 ||
      ($legacy['location'] ?? '') !== $domainUrl . '/technology/original'
    ) {
      throw new RuntimeException('Legacy numeric ID priority changed: ' . json_encode($legacy));
    }
    $checks++;
  }
}
foreach ($originalCategories as $id => $category) {
  $setCategory->execute([$category, $id]);
}
echo "PASS {$checks} public numeric-route checks (source router, in-memory SQLite)\n";
