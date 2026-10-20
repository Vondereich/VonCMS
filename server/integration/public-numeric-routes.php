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

$source = (string) file_get_contents($root . '/public/index.php');
$start = strpos($source, '// Parse URL to detect post/page slug');
$end = strpos($source, '// HOMEPAGE SEO: Latest posts for noscript + Schema', $start ?: 0);
if ($start === false || $end === false || $end <= $start) {
  throw new RuntimeException('Could not isolate the actual public router.');
}
$router = substr($source, $start, $end - $start);
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec(
  'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, avatar TEXT)',
);
$pdo->exec("INSERT INTO users VALUES (1, 'editor', 'Editor', '')");
$columns =
  'id INTEGER PRIMARY KEY, title TEXT, slug TEXT, content TEXT, excerpt TEXT, author TEXT, author_id INTEGER, meta_description TEXT, keywords TEXT, created_at TEXT, updated_at TEXT, status TEXT';
$pdo->exec(
  'CREATE TABLE posts (' . $columns . ', image_url TEXT, category TEXT, scheduled_at TEXT)',
);
$pdo->exec('CREATE TABLE pages (' . $columns . ')');
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
) use ($pdo, $router): array {
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
  http_response_code(200);
  try {
    eval($router);
    return [
      'status' => http_response_code(),
      'id' => $post ? (int) $post['id'] : null,
      'type' => $schemaData['@type'] ?? null,
      'url' => $seoUrl,
      'robots' => $seoRobots,
      'description' => $seoDescription,
    ];
  } catch (NumericRouteRedirect $redirect) {
    return ['status' => $redirect->status, 'location' => $redirect->location];
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
echo "PASS {$checks} public numeric-route checks (source router, in-memory SQLite)\n";
