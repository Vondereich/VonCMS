<?php
declare(strict_types=1);

// Actual read controller and shared helpers, disposable SQLite only. Never load a site's config.
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
$root = dirname(__DIR__, 2);
$checks = 0;
function newsCheck(bool $ok, string $message): void
{
  if (!$ok) {
    throw new RuntimeException($message);
  }
  $GLOBALS['checks']++;
}
function newsRemove(string $path): void
{
  if (is_dir($path) && !is_link($path)) {
    foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $entry) {
      newsRemove($path . '/' . $entry);
    }
    rmdir($path);
  } else {
    unlink($path);
  }
}

// Each request runs the unchanged copied sitemap.php in a fresh process, including exit/status.
if (($argv[1] ?? '') === '--request') {
  $directory = $argv[2];
  $request = json_decode($argv[3], true, 512, JSON_THROW_ON_ERROR);
  $_SERVER['SCRIPT_NAME'] = $request['base'] . 'index.php';
  $_SERVER['REQUEST_URI'] = $request['uri'];
  $_SERVER['HTTP_HOST'] = 'untrusted-host.invalid';
  $_GET = $request['query'] ?? [];
  ob_start();
  register_shutdown_function(static function () use ($directory): void {
    $output = ob_get_clean();
    file_put_contents(
      $directory . '/response.json',
      json_encode(
        [
          'status' => http_response_code() ?: 200,
          'body' => $output,
          'fatal' => error_get_last(),
        ],
        JSON_THROW_ON_ERROR,
      ),
    );
  });
  require $directory . '/index.php';
  exit();
}

function newsRequest(string $directory, string $uri, string $base = '/', array $query = []): array
{
  $process = proc_open(
    [
      PHP_BINARY,
      '-d',
      'opcache.enable_cli=0',
      __FILE__,
      '--request',
      $directory,
      json_encode(['uri' => $uri, 'base' => $base, 'query' => $query], JSON_THROW_ON_ERROR),
    ],
    [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
  );
  if (!is_resource($process)) {
    throw new RuntimeException('Cannot start News sitemap request fixture');
  }
  $stdout = stream_get_contents($pipes[1]);
  $stderr = stream_get_contents($pipes[2]);
  fclose($pipes[1]);
  fclose($pipes[2]);
  $exit = proc_close($process);
  $unexpectedDiagnostics = preg_replace(
    '/^(?:News sitemap unavailable|Sitemap Generation Error):[^\r\n]*(?:\r?\n|$)/m',
    '',
    $stderr,
  );
  newsCheck(
    $exit === 0 && $stdout === '' && trim($unexpectedDiagnostics) === '',
    'Request failed: ' . $stderr . $stdout,
  );
  $result = json_decode(
    file_get_contents($directory . '/response.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
  );
  newsCheck($result['fatal'] === null, 'Request emitted a PHP diagnostic');
  return $result;
}

function newsXml(array $result): SimpleXMLElement
{
  $xml = simplexml_load_string($result['body']);
  newsCheck($xml !== false, 'The real endpoint did not return valid XML');
  $xml->registerXPathNamespace('s', 'http://www.sitemaps.org/schemas/sitemap/0.9');
  $xml->registerXPathNamespace('n', 'http://www.google.com/schemas/sitemap-news/0.9');
  return $xml;
}

$directory = sys_get_temp_dir() . '/voncms-news-' . bin2hex(random_bytes(8));
try {
  foreach (['api', 'core', 'data'] as $subdirectory) {
    mkdir($directory . '/' . $subdirectory, 0700, true);
  }
  foreach (
    [
      'index.php',
      'sitemap.php',
      'news_sitemap_helper.php',
      'seo_schema_helper.php',
      'seo_route_helper.php',
      'seo_response_helper.php',
      'search_query_helper.php',
      'api/publication_time_helper.php',
      'api/post_query_helper.php',
      'core/DataBoundary.php',
    ]
    as $file
  ) {
    copy($root . '/public/' . $file, $directory . '/' . $file);
  }
  file_put_contents(
    $directory . '/security.php',
    '<?php function voncms_apply_site_timezone(PDO $pdo): void { date_default_timezone_set("Asia/Kuala_Lumpur"); }',
  );
  file_put_contents(
    $directory . '/von_config.php',
    '<?php $pdo = new PDO("sqlite:" . __DIR__ . "/qa.sqlite", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);',
  );
  require $directory . '/news_sitemap_helper.php';
  $pdo = new PDO('sqlite:' . $directory . '/qa.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  $pdo->exec('CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT)');
  $pdo->exec(
    'CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, slug TEXT, category TEXT, created_at TEXT, updated_at TEXT, scheduled_at TEXT, published_at TEXT, status TEXT)',
  );
  $pdo->exec(
    'CREATE TABLE pages (id INTEGER PRIMARY KEY, slug TEXT, status TEXT, created_at TEXT, updated_at TEXT)',
  );
  $insertSetting = $pdo->prepare('INSERT INTO settings VALUES (?, ?, ?)');
  foreach (
    [
      ['general', 'domain_url', 'https://news.example.test/blog'],
      ['general', 'site_name', 'Skrip &amp; Dunia'],
      ['general', 'site_language', 'ms-MY'],
      ['general', 'permalink_structure', 'category'],
      ['seo', 'site_config', '{}'],
    ]
    as $setting
  ) {
    $insertSetting->execute($setting);
  }
  $config = ['enabled' => true, 'scope' => 'categories', 'categories' => ['Berita']];
  $saveConfig = static function (array $news, bool $master = true) use ($pdo): void {
    $pdo
      ->prepare("UPDATE settings SET setting_value=? WHERE setting_group='seo'")
      ->execute([
        json_encode(['sitemapEnabled' => $master, 'newsSitemap' => $news], JSON_THROW_ON_ERROR),
      ]);
  };
  newsCheck(voncms_news_sitemap_settings(null)['enabled'] === false, 'Default must be OFF');
  $disabled = newsRequest($directory, '/blog/sitemap-news.xml', '/blog/');
  newsCheck($disabled['status'] === 404, 'Disabled feed must return 404');
  newsCheck(
    !str_contains(
      newsRequest($directory, '/blog/sitemap.xml', '/blog/')['body'],
      'sitemap-news.xml',
    ),
    'Disabled News must not be advertised',
  );

  foreach (
    [
      false,
      'enabled',
      ['enabled' => 1],
      ['scope' => 'other'],
      ['categories' => 'Berita'],
      ['categories' => [[]]],
      ['language' => 'ms-MY'],
      ['language' => 'zh'],
      ['language' => '<x>'],
      ['publicationName' => []],
      ['publicationName' => str_repeat('a', 201)],
      ['enabled' => true, 'scope' => 'categories', 'categories' => []],
    ]
    as $invalid
  ) {
    try {
      voncms_news_sitemap_settings($invalid);
      throw new RuntimeException('Invalid News settings were accepted: ' . json_encode($invalid));
    } catch (InvalidArgumentException) {
      $checks++;
    }
  }
  newsCheck(
    voncms_news_sitemap_settings(['language' => 'EN'])['language'] === 'en',
    'Language normalization failed',
  );
  newsCheck(
    voncms_news_sitemap_settings(['categories' => ['Berita', 'Berita']])['categories'] === [
      'Berita',
    ],
    'Categories must be deduplicated',
  );
  foreach (['/', '/blog/'] as $base) {
    newsCheck(
      voncms_match_seo_endpoint($base . 'sitemap-news.xml?page=2', $base) === 'sitemap.php',
      'Exact News route not mapped',
    );
    foreach (['foo/sitemap-news.xml', 'sitemap-news.xml/', '/sitemap-news.xml'] as $lookalike) {
      newsCheck(
        voncms_match_seo_endpoint($base . $lookalike, $base) === null,
        'Nested/ambiguous News route captured',
      );
    }
  }
  $saveConfig($config);
  $empty = newsRequest($directory, '/blog/sitemap-news.xml', '/blog/');
  newsCheck(
    $empty['status'] === 200 && count(newsXml($empty)->xpath('/s:urlset/s:url')) === 0,
    'Empty feed must be valid without old article backfill',
  );
  newsCheck(
    str_contains(
      newsRequest($directory, '/blog/sitemap.xml', '/blog/')['body'],
      'https://news.example.test/blog/sitemap-news.xml',
    ),
    'Index must advertise the stable News route',
  );

  date_default_timezone_set('Asia/Kuala_Lumpur');
  $now = new DateTimeImmutable();
  $recent = $now->modify('-1 hour')->format('Y-m-d H:i:s');
  $old = $now->modify('-3 days')->format('Y-m-d H:i:s');
  $future = $now->modify('+1 day')->format('Y-m-d H:i:s');
  $insert = $pdo->prepare('INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?)');
  // 1,001 selected posts must be paginated AFTER filtering; old created dates retain old URLs.
  $pdo->beginTransaction();
  for ($id = 1; $id <= 1001; $id++) {
    $insert->execute([
      $id,
      "Berita $id",
      "berita-$id",
      'Berita',
      $old,
      $recent,
      null,
      $recent,
      'published',
    ]);
  }
  foreach (
    [
      [2001, 'old edited today', 'Berita', $old, null, $old, 'published'],
      [2002, 'future scheduled', 'Berita', $recent, $future, $recent, 'published'],
      [2003, 'future original publication', 'Berita', $recent, null, $future, 'published'],
      [2004, 'draft', 'Berita', $recent, null, $recent, 'draft'],
      [2005, 'unselected', 'Promosi', $recent, null, $recent, 'published'],
      [2006, 'legacy null publication', 'Berita', $recent, null, null, 'published'],
      [2007, 'legacy null status', 'Berita', $recent, null, $recent, null],
    ]
    as [$id, $title, $category, $created, $scheduled, $published, $status]
  ) {
    $insert->execute([
      $id,
      $title,
      "post-$id",
      $category,
      $created,
      $recent,
      $scheduled,
      $published,
      $status,
    ]);
  }
  $pdo->commit();
  file_put_contents(
    $directory . '/data/schema-capabilities.json',
    json_encode(['version' => 1, 'published_at' => ['posts' => true]]),
  );
  $first = newsXml(newsRequest($directory, '/blog/sitemap-news.xml', '/blog/'));
  $second = newsXml(
    newsRequest($directory, '/blog/sitemap-news.xml?page=2', '/blog/', ['page' => '2']),
  );
  newsCheck(
    count($first->xpath('/s:urlset/s:url')) === 1000,
    'First News file exceeds/is below the eligible 1,000 boundary',
  );
  newsCheck(
    count($second->xpath('/s:urlset/s:url')) === 2,
    'Second file must contain the two remaining eligible articles',
  );
  $urls = array_map('strval', array_merge($first->xpath('//s:loc'), $second->xpath('//s:loc')));
  newsCheck(count(array_unique($urls)) === 1002, 'Pagination duplicates or loses an article');
  $saveConfig(['enabled' => true]);
  $allFirst = newsXml(newsRequest($directory, '/blog/sitemap-news.xml', '/blog/'));
  $allSecond = newsXml(
    newsRequest($directory, '/blog/sitemap-news.xml?page=2', '/blog/', ['page' => 2]),
  );
  newsCheck(
    count($allFirst->xpath('//n:news')) + count($allSecond->xpath('//n:news')) === 1003,
    'All-category mode must retain the additional eligible category',
  );
  newsCheck(
    in_array(
      'https://news.example.test/blog/promosi/post-2005',
      array_map('strval', $allFirst->xpath('//s:loc')),
      true,
    ),
    'All-category mode incorrectly filters another category',
  );
  $saveConfig($config);
  foreach ([2001, 2002, 2003, 2004, 2005, 2007] as $excluded) {
    newsCheck(
      !in_array('https://news.example.test/blog/berita/post-' . $excluded, $urls, true),
      'Ineligible post leaked: ' . $excluded,
    );
  }
  newsCheck(
    (string) $first->xpath('//n:name')[0] === 'Skrip & Dunia',
    'Publication name entity fallback double-encoded',
  );
  newsCheck(
    (string) $first->xpath('//n:language')[0] === 'ms',
    'Regional language fallback not reduced to ISO code',
  );
  newsCheck(
    (string) $first->xpath('//n:publication_date')[0] ===
      (new DateTimeImmutable($recent))->format('c'),
    'Original publication date/timezone lost',
  );
  $index = newsXml(newsRequest($directory, '/blog/sitemap.xml', '/blog/'));
  newsCheck(
    count($index->xpath('/s:sitemapindex/s:sitemap[contains(s:loc,"sitemap-news.xml")]')) === 2,
    'Index misses eligible News chunk',
  );
  foreach ([0, -1, '3', '999999999999999999999', '1.5', '1e0', [1]] as $badPage) {
    $response = newsRequest($directory, '/blog/sitemap-news.xml', '/blog/', ['page' => $badPage]);
    newsCheck(
      $response['status'] === 404 && count(newsXml($response)->xpath('//n:news')) === 0,
      'Invalid/out-of-range page returned news',
    );
  }

  // Actual fallback behavior on an unrepaired installation does not inspect a missing column.
  unlink($directory . '/data/schema-capabilities.json');
  $insert->execute([
    2008,
    'legacy scheduled',
    'legacy-scheduled',
    'Berita',
    $old,
    $recent,
    $recent,
    null,
    'published',
  ]);
  $legacy = newsXml(newsRequest($directory, '/blog/sitemap-news.xml', '/blog/'));
  newsCheck(
    count($legacy->xpath('//n:news')) === 3,
    'Legacy created/scheduled fallback must not make old edited posts fresh',
  );
  file_put_contents(
    $directory . '/data/schema-capabilities.json',
    json_encode(['version' => 1, 'published_at' => ['posts' => true]]),
  );

  $GLOBALS['voncms_publication_capability_cache'] = [
    'version' => 1,
    'published_at' => ['posts' => true],
  ];
  $beforeBoundary = voncms_news_sitemap_query($pdo, $config, $now);
  $baselineCount = (int) $beforeBoundary->fetchColumn();
  $beforeBoundary->closeCursor();
  foreach ([2009 => -172800, 2010 => -172801, 2011 => 1] as $id => $seconds) {
    $timestamp = $now->setTimestamp($now->getTimestamp() + $seconds)->format('Y-m-d H:i:s');
    $insert->execute([
      $id,
      'Boundary',
      "boundary-$id",
      'Berita',
      $old,
      $recent,
      null,
      $timestamp,
      'published',
    ]);
  }
  $afterBoundary = voncms_news_sitemap_query($pdo, $config, $now);
  newsCheck(
    (int) $afterBoundary->fetchColumn() === $baselineCount + 1,
    'Exactly 48 hours qualifies; one second older/future must not',
  );
  $afterBoundary->closeCursor();

  // Isolate one Unicode headline, including a comparison and XML metacharacters.
  $pdo->exec('DELETE FROM posts');
  $headline = '<b>Économie 中文</b> &amp; x<y "Nur\'Aini"';
  $insert->execute([
    1,
    $headline,
    'actualité',
    'Berita',
    $old,
    $recent,
    null,
    $recent,
    'published',
  ]);
  $GLOBALS['voncms_publication_capability_cache'] = [
    'version' => 1,
    'published_at' => ['posts' => true],
  ];
  foreach (['slug', 'post_name', 'plain', 'category', 'date', 'day_name', 'month_name'] as $style) {
    foreach (
      [
        'https://news.example.test',
        'https://edition.example.test',
        'https://news.example.test/blog',
      ]
      as $baseUrl
    ) {
      $pdo
        ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='domain_url'")
        ->execute([$baseUrl]);
      $pdo
        ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='permalink_structure'")
        ->execute([$style]);
      $pathBase = str_ends_with($baseUrl, '/blog') ? '/blog/' : '/';
      $xml = newsXml(newsRequest($directory, $pathBase . 'sitemap-news.xml', $pathBase));
      $expected =
        $baseUrl .
        buildCanonicalContentPath(
          ['id' => 1, 'slug' => 'actualité', 'category' => 'Berita', 'created_at' => $old],
          $style,
        );
      newsCheck(
        (string) $xml->xpath('//s:loc')[0] === $expected,
        'Canonical mismatch: ' . $baseUrl . '/' . $style,
      );
      newsCheck(
        (string) $xml->xpath('//n:title')[0] === 'Économie 中文 & x<y "Nur\'Aini"',
        'Unicode/full headline/XML text changed',
      );
      newsCheck(
        !str_contains($xml->asXML(), 'untrusted-host.invalid'),
        'Request Host leaked into canonical URL',
      );
    }
  }
  foreach (
    [
      'zh-Hans-CN' => 'zh-cn',
      'zh-Hant-TW' => 'zh-tw',
      'en_US' => 'en',
      'en, fr' => 'en',
      'fr-CA, en' => 'fr',
      'ar, en' => 'ar',
      'ja, en' => 'ja',
      'de, fr, en' => 'de',
      '  PT_br , en  ' => 'pt',
      'zh_CN, en' => 'zh-cn',
      'zh-Hant-TW, en' => 'zh-tw',
      'eng, fra' => 'eng',
      '' => 'en',
    ]
    as $siteLanguage => $newsLanguage
  ) {
    $pdo
      ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='site_language'")
      ->execute([$siteLanguage]);
    newsCheck(
      voncms_news_sitemap_publication($pdo, voncms_news_sitemap_settings($config))['language'] ===
        $newsLanguage,
      'Language fallback failed',
    );
  }
  $pdo
    ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='site_language'")
    ->execute(['en, fr']);
  foreach (['Article', 'NewsArticle', 'BlogPosting'] as $schemaType) {
    $pdo
      ->prepare("UPDATE settings SET setting_value=? WHERE setting_group='seo'")
      ->execute([
        json_encode(
          ['sitemapEnabled' => true, 'articleSchemaType' => $schemaType, 'newsSitemap' => $config],
          JSON_THROW_ON_ERROR,
        ),
      ]);
    $response = newsRequest($directory, '/blog/sitemap-news.xml', '/blog/');
    newsCheck(
      $response['status'] === 200,
      'Language list must work independently of schema type: ' . $schemaType,
    );
    $xml = newsXml($response);
    newsCheck(
      (string) $xml->xpath('//n:language')[0] === 'en',
      'News must inherit only the first language',
    );
    $index = newsRequest($directory, '/blog/sitemap.xml', '/blog/');
    newsCheck(
      $index['status'] === 200 && str_contains($index['body'], 'sitemap-news.xml'),
      'Language list must not hide News from the sitemap index',
    );
  }
  foreach (['<en>, fr', ', fr', 'zh, en'] as $invalidLanguage) {
    $pdo
      ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='site_language'")
      ->execute([$invalidLanguage]);
    try {
      voncms_news_sitemap_publication($pdo, voncms_news_sitemap_settings($config));
      throw new RuntimeException('Invalid/ambiguous first language was silently replaced');
    } catch (RuntimeException $error) {
      newsCheck(
        $error->getMessage() === 'Configure a News publication name and language in VonSEO.',
        'Unexpected language failure',
      );
    }
  }
  $pdo
    ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='site_language'")
    ->execute(['en, fr']);
  $saveConfig($config + ['publicationName' => 'Override & Co', 'language' => 'fr']);
  $xml = newsXml(newsRequest($directory, '/blog/sitemap-news.xml', '/blog/'));
  newsCheck(
    (string) $xml->xpath('//n:name')[0] === 'Override & Co' &&
      (string) $xml->xpath('//n:language')[0] === 'fr',
    'Explicit publication overrides ignored',
  );
  $saveConfig($config, false);
  newsCheck(
    newsRequest($directory, '/blog/sitemap-news.xml', '/blog/')['status'] === 404,
    'Master switch does not disable News',
  );
  $saveConfig($config);
  $pdo->exec("UPDATE settings SET setting_value='' WHERE setting_key='site_name'");
  newsCheck(
    newsRequest($directory, '/blog/sitemap-news.xml', '/blog/')['status'] === 503,
    'Missing publisher must not invent metadata',
  );
  $index = newsRequest($directory, '/blog/sitemap.xml', '/blog/');
  newsCheck(
    $index['status'] === 200 && !str_contains($index['body'], 'sitemap-news.xml'),
    'Bad optional metadata broke the ordinary sitemap',
  );
  $pdo->exec("UPDATE settings SET setting_value='Publisher' WHERE setting_key='site_name'");
  $saveConfig(['enabled' => true, 'scope' => 'categories', 'categories' => ["Berita') OR 1=1 --"]]);
  $xml = newsXml(newsRequest($directory, '/blog/sitemap-news.xml', '/blog/'));
  newsCheck(count($xml->xpath('//n:news')) === 0, 'Category input changed SQL semantics');
  newsCheck(
    (int) $pdo->query('SELECT COUNT(*) FROM posts')->fetchColumn() === 1,
    'Read feed changed posts',
  );
  $saveConfig($config);
  $pdo->exec('ALTER TABLE posts DROP COLUMN published_at');
  newsCheck(
    newsRequest($directory, '/blog/sitemap-news.xml', '/blog/')['status'] === 503,
    'Failed News query must not return successful empty XML',
  );
  $index = newsRequest($directory, '/blog/sitemap.xml', '/blog/');
  newsCheck(
    $index['status'] === 200 && !str_contains($index['body'], 'sitemap-news.xml'),
    'Optional News SQL failure broke the ordinary index',
  );
} finally {
  // Exception traces retain their PDO arguments until released, including on Windows.
  unset($error, $saveConfig, $insert, $insertSetting, $beforeBoundary, $afterBoundary);
  $pdo = null;
  newsRemove($directory);
}
echo "PASS News sitemap: $checks checks (actual read controller, SQLite, root/subdomain/subfolder, 1,000 boundaries, metadata and failure fallbacks).\n";
