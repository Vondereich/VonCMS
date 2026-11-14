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

class NewsClockSqlitePDO extends PDO
{
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    // PDO execute(array) binds strings. Unlike MySQL, SQLite does not coerce this
    // untyped placeholder comparison; adapt only that SQL dialect difference.
    return parent::prepare(
      str_replace(':publish_now = 1', 'CAST(:publish_now AS INTEGER) = 1', $query),
      $options,
    );
  }
}

function newsTimezoneBootstrapSource(string $root): string
{
  $source = file_get_contents($root . '/public/security.php');
  if (
    !is_string($source) ||
    preg_match(
      '/  function voncms_apply_site_timezone\(\$pdo\): \?string\s*\{.*?\n  \}/s',
      $source,
      $matches,
    ) !== 1
  ) {
    throw new RuntimeException('Actual timezone bootstrap function not found.');
  }
  return $matches[0];
}

function newsClockPublishScheduled(PDO $pdo, string $root): void
{
  $source = file_get_contents($root . '/public/scheduler_helper.php');
  if (
    !is_string($source) ||
    preg_match(
      '/function voncms_publish_scheduled_posts\(PDO \$pdo\): int\s*\{\s*(\$now = date.*?\$stmt->execute\(\[\$now\]\);)/s',
      $source,
      $matches,
    ) !== 1
  ) {
    throw new RuntimeException('Actual scheduled-publication SQL not found.');
  }
  // Only execute the real timestamp/SQL block, never the site's cache clear.
  eval($matches[1]);
}

/** Execute the real Save SQL/bindings only; session/validation are separate suites. */
function newsClockWrite(
  PDO $pdo,
  string $table,
  string $status,
  ?int $id = null,
  bool $hasPublishedAtColumn = true,
  bool $statusOnlyTransition = false,
): int {
  if (!in_array($table, ['posts', 'pages'], true)) {
    throw new InvalidArgumentException('Invalid fixture table.');
  }
  $source = file_get_contents(
    dirname(__DIR__, 2) . '/public/api/save_' . ($table === 'posts' ? 'post' : 'page') . '.php',
  );
  $pattern =
    $id === null
      ? '/(\$publishedAtColumn = \$hasPublishedAtColumn.*?\$stmt->execute\(\$insertParams\);)/s'
      : '/(\$publishedAtAssignment = \$hasPublishedAtColumn.*?\$stmt->execute\(\$updateParams\);)/s';
  if (!is_string($source) || preg_match($pattern, $source, $matches) !== 1) {
    throw new RuntimeException('Actual Save timestamp SQL/bindings not found.');
  }
  if (preg_match('/voncms_apply_site_timezone\(\$pdo \?\? null\);/', $source, $bootstrap) !== 1) {
    throw new RuntimeException('Save must apply the configured CMS timezone.');
  }
  // Exercise the actual bootstrap after a deliberately wrong PHP initial zone.
  date_default_timezone_set('Pacific/Honolulu');
  eval($bootstrap[0]);
  $db = $pdo;
  $postId = $pageId = $id;
  $currentUser = ['id' => 1];
  $input = [
    'title' => 'Clock QA',
    'slug' => 'clock-' . $table,
    'content' => '<p>Clock fixture</p>',
    'excerpt' => '',
    'status' => $status,
  ];
  $excerpt = $keywords = $metaDescription = $featuredImage = '';
  $category = 'News';
  $scheduledAt = $status === 'scheduled' ? date('Y-m-d H:i:s', time() + 3600) : null;
  eval($matches[1]);
  return $id ?? (int) $pdo->lastInsertId();
}

function newsPublicationClockCases(string $root, bool $mysql = false): void
{
  if (!function_exists('voncms_news_sitemap_query')) {
    require $root . '/public/news_sitemap_helper.php';
  }
  if (!function_exists('voncms_apply_site_timezone')) {
    eval(newsTimezoneBootstrapSource($root));
  }
  $oldZone = date_default_timezone_get();
  $database = '';
  $databaseCreated = false;
  $admin = null;
  $pdo = null;
  try {
    if ($mysql) {
      $dsn = getenv('VONCMS_TEST_MYSQL_DSN') ?: 'mysql:host=127.0.0.1;port=3306';
      if (!str_starts_with($dsn, 'mysql:') || preg_match('/(?:^|;)dbname=/i', $dsn)) {
        throw new RuntimeException('Use a MySQL test DSN without a database.');
      }
      $admin = new PDO(
        $dsn,
        getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
        getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
      );
      $database = 'voncms_news_clock_' . bin2hex(random_bytes(8));
      $admin->exec('CREATE DATABASE `' . $database . '` CHARACTER SET utf8mb4');
      $databaseCreated = true;
    }
    foreach (
      [
        ['UTC', '+08:00'],
        ['Asia/Kuala_Lumpur', '+00:00'],
        ['America/New_York', '+08:00'],
        ['Pacific/Kiritimati', '-05:00'],
        ['UTC', '+00:00'],
      ]
      as [$siteZone, $databaseZone]
    ) {
      date_default_timezone_set($siteZone);
      if ($mysql) {
        $pdo = new PDO(
          $dsn . ';dbname=' . $database . ';charset=utf8mb4',
          getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
          getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
          [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false],
        );
        $pdo->exec('SET time_zone = ' . $pdo->quote($databaseZone));
      } else {
        $pdo = new NewsClockSqlitePDO('sqlite::memory:', null, null, [
          PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->sqliteCreateFunction(
          'NOW',
          static fn(): string => (new DateTimeImmutable(
            'now',
            new DateTimeZone($databaseZone),
          ))->format('Y-m-d H:i:s'),
          0,
        );
      }
      $pdo->exec('DROP TABLE IF EXISTS settings');
      $pdo->exec(
        'CREATE TABLE settings(setting_group VARCHAR(30),setting_key VARCHAR(60),setting_value TEXT)',
      );
      $pdo
        ->prepare('INSERT INTO settings VALUES(?,?,?)')
        ->execute(['general', 'time_zone', $siteZone]);
      $GLOBALS['voncms_publication_capability_cache'] = [
        'version' => 1,
        'published_at' => ['posts' => true, 'pages' => true],
      ];
      foreach (['posts', 'pages'] as $table) {
        $pdo->exec('DROP TABLE IF EXISTS ' . $table);
        $identity = $mysql ? 'INT PRIMARY KEY AUTO_INCREMENT' : 'INTEGER PRIMARY KEY';
        $datetime = $mysql ? 'DATETIME' : 'TEXT';
        $pdo->exec("CREATE TABLE $table (
          id $identity, title TEXT, slug VARCHAR(255), content TEXT, excerpt TEXT,
          status VARCHAR(30), image_url TEXT, keywords TEXT, category TEXT,
          meta_description TEXT, author_id INT, scheduled_at $datetime,
          published_at $datetime, created_at $datetime, updated_at $datetime
        )");
        $start = date('Y-m-d H:i:s');
        $id = newsClockWrite($pdo, $table, 'published');
        $row = $pdo->query("SELECT * FROM $table WHERE id=$id")->fetch(PDO::FETCH_ASSOC);
        newsCheck(
          is_array($row) &&
            $row['published_at'] >= $start &&
            $row['published_at'] <= date('Y-m-d H:i:s'),
          "$table first publication must use CMS $siteZone, not database $databaseZone: " .
            json_encode($row),
        );
        if ($table === 'posts') {
          $selected = voncms_news_sitemap_query(
            $pdo,
            ['enabled' => true],
            new DateTimeImmutable(),
            1,
          )->fetchAll(PDO::FETCH_ASSOC);
          newsCheck(
            count($selected) === 1,
            'Fresh publication missing from News under mismatched clocks.',
          );
          $xml = simplexml_load_string(
            voncms_news_sitemap_xml(
              $selected,
              ['name' => 'Clock QA', 'language' => 'en', 'permalink' => 'date'],
              'https://clock.example.test/blog',
              new DateTimeImmutable(),
            ),
          );
          newsCheck($xml !== false, 'Invalid publication XML.');
          $xml->registerXPathNamespace('n', 'http://www.google.com/schemas/sitemap-news/0.9');
          newsCheck(
            (string) $xml->xpath('//n:publication_date')[0] ===
              (new DateTimeImmutable($row['published_at']))->format(DATE_ATOM),
            'News publication offset must match the CMS timestamp.',
          );
        }
        $legacyCreated = '2002-03-04 10:20:30';
        $legacyPublished = '2018-06-02 11:12:13';
        $pdo
          ->prepare("UPDATE $table SET created_at=?, published_at=? WHERE id=?")
          ->execute([$legacyCreated, $legacyPublished, $id]);
        foreach (['published', 'draft', 'published'] as $nextStatus) {
          newsClockWrite($pdo, $table, $nextStatus, $id);
          $kept = $pdo->query("SELECT * FROM $table WHERE id=$id")->fetch(PDO::FETCH_ASSOC);
          newsCheck(
            $kept['created_at'] === $legacyCreated && $kept['published_at'] === $legacyPublished,
            "$table edit/republish must not reinterpret historical dates.",
          );
        }
        newsCheck(
          buildCanonicalContentPath($kept, 'date', $table === 'posts' ? 'post' : 'page') ===
            ($table === 'posts' ? '/2002/03/04/clock-posts' : '/clock-pages'),
          'Creation-date permalink changed.',
        );
        $draft = newsClockWrite($pdo, $table, 'draft');
        newsCheck(
          $pdo->query("SELECT published_at FROM $table WHERE id=$draft")->fetchColumn() === null,
          'Draft incorrectly received a publication time.',
        );
        $start = date('Y-m-d H:i:s');
        newsClockWrite($pdo, $table, 'published', $draft, true, $table === 'posts');
        $published = $pdo->query("SELECT published_at FROM $table WHERE id=$draft")->fetchColumn();
        newsCheck(
          is_string($published) && $published >= $start && $published <= date('Y-m-d H:i:s'),
          'Draft/workflow first publication used the database clock.',
        );
        if ($table === 'posts') {
          $due = newsClockWrite($pdo, $table, 'scheduled');
          $scheduledAt = date('Y-m-d H:i:s', time() - 3600);
          $pdo
            ->prepare('UPDATE posts SET scheduled_at=? WHERE id=?')
            ->execute([$scheduledAt, $due]);
          $future = newsClockWrite($pdo, $table, 'scheduled');
          newsClockPublishScheduled($pdo, $root);
          $scheduled = $pdo->query('SELECT * FROM posts WHERE id=' . $due)->fetch(PDO::FETCH_ASSOC);
          newsCheck(
            $scheduled['status'] === 'published' && $scheduled['published_at'] === $scheduledAt,
            'Scheduler changed the CMS-local planned publication time.',
          );
          newsCheck(
            $pdo->query('SELECT status FROM posts WHERE id=' . $future)->fetchColumn() ===
              'scheduled',
            'Mismatched clocks published a future schedule early.',
          );
          newsClockWrite($pdo, 'posts', 'published', $due);
          $edited = $pdo->query('SELECT * FROM posts WHERE id=' . $due)->fetch(PDO::FETCH_ASSOC);
          newsCheck(
            $edited['scheduled_at'] === null && $edited['published_at'] === $scheduledAt,
            'Editing an already-scheduled publication changed its original timestamp.',
          );
          $ids = voncms_news_sitemap_query(
            $pdo,
            ['enabled' => true],
            new DateTimeImmutable(),
            1,
          )->fetchAll(PDO::FETCH_COLUMN);
          newsCheck(
            in_array((string) $due, array_map('strval', $ids), true),
            'Edited scheduled publication disappeared from News.',
          );
        }
        // A legacy write is still supported, but News must not claim accurate
        // publication filtering until the existing Repair capability is ready.
        $unrepaired = newsClockWrite($pdo, $table, 'published', null, false);
        $GLOBALS['voncms_publication_capability_cache']['published_at'][$table] = false;
        newsCheck($unrepaired > 0, 'Unrepaired compatibility write failed.');
        if ($table === 'posts') {
          foreach ([null, 1] as $newsPage) {
            try {
              voncms_news_sitemap_query(
                $pdo,
                ['enabled' => true],
                new DateTimeImmutable(),
                $newsPage,
              );
              throw new RuntimeException('Unrepaired News accepted a legacy new-write fallback.');
            } catch (VonCmsNewsPublicationUnavailable $error) {
              newsCheck(
                str_contains($error->getMessage(), 'Database Repair'),
                'Missing Repair guidance.',
              );
            }
          }
        }
        $pdo->exec("ALTER TABLE $table DROP COLUMN published_at");
        newsCheck(
          newsClockWrite($pdo, $table, 'published', null, false) > 0,
          'Missing-column compatibility write failed.',
        );
        if ($table === 'posts') {
          try {
            voncms_news_sitemap_query($pdo, ['enabled' => true], new DateTimeImmutable(), 1);
            throw new RuntimeException('News queried unavailable publication storage.');
          } catch (VonCmsNewsPublicationUnavailable $error) {
            newsCheck(
              str_contains($error->getMessage(), 'Database Repair'),
              'Missing-column News rejection omitted Repair guidance.',
            );
          }
          $createdBeforeRepair = $pdo
            ->query('SELECT created_at FROM posts WHERE id=' . $unrepaired)
            ->fetchColumn();
          $pdo->exec("ALTER TABLE posts ADD COLUMN published_at $datetime NULL");
          $GLOBALS['voncms_publication_capability_cache']['published_at']['posts'] = true;
          $afterRepair = newsClockWrite($pdo, 'posts', 'published');
          $visibleAfterRepair = voncms_news_sitemap_query(
            $pdo,
            ['enabled' => true],
            new DateTimeImmutable(),
            1,
          )->fetchAll(PDO::FETCH_COLUMN);
          newsCheck(
            in_array((string) $afterRepair, array_map('strval', $visibleAfterRepair), true),
            'A new post after readiness did not appear in News.',
          );
          newsCheck(
            $pdo->query('SELECT created_at FROM posts WHERE id=' . $unrepaired)->fetchColumn() ===
              $createdBeforeRepair,
            'Readiness reinterpreted a pre-Repair date.',
          );
        }
      }
      $pdo = null;
    }
  } finally {
    date_default_timezone_set($oldZone);
    $pdo = null;
    if (
      $databaseCreated &&
      $admin instanceof PDO &&
      preg_match('/^voncms_news_clock_[a-f0-9]{16}$/D', $database)
    ) {
      $admin->exec('DROP DATABASE `' . $database . '`');
      $remaining = $admin->prepare(
        'SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',
      );
      $remaining->execute([$database]);
      newsCheck((int) $remaining->fetchColumn() === 0, 'Temporary clock database was not removed.');
    }
  }
}

if (in_array($argv[1] ?? '', ['--publication-clock', '--mysql-publication-clock'], true)) {
  newsPublicationClockCases($root, ($argv[1] ?? '') === '--mysql-publication-clock');
  echo "PASS Publication clocks: $checks checks; actual Save SQL/bindings and News helpers, disposable database only.\n";
  exit();
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
  file_put_contents($directory . '/security.php', '<?php ' . newsTimezoneBootstrapSource($root));
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
      ['general', 'time_zone', 'Asia/Kuala_Lumpur'],
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
  foreach (['/', '/blog/'] as $base) {
    $unready = newsRequest($directory, $base . 'sitemap-news.xml', $base);
    newsCheck(
      $unready['status'] === 503 && str_contains($unready['body'], 'Database Repair'),
      'Unrepaired News must return 503 with Repair guidance, not successful empty XML.',
    );
    $ordinary = newsRequest($directory, $base . 'sitemap.xml', $base);
    newsCheck(
      $ordinary['status'] === 200 && !str_contains($ordinary['body'], 'sitemap-news.xml'),
      'An unrepaired News feed must not break the ordinary sitemap index.',
    );
  }
  // Simulate Repair's trusted final capability activation, not schema DDL.
  voncms_mark_publication_columns_ready();
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

  // Missing/invalid readiness after upgrade or restore cannot silently use the
  // database-clock fallback for News, even if the physical column still exists.
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
  foreach (['/', '/blog/'] as $base) {
    foreach (
      [
        null,
        '{}',
        '{broken',
        '{"version":2,"published_at":{"posts":true}}',
        '{"version":1,"published_at":{"posts":false,"pages":true}}',
      ]
      as $marker
    ) {
      if ($marker === null) {
        if (is_file($directory . '/data/schema-capabilities.json')) {
          unlink($directory . '/data/schema-capabilities.json');
        }
      } else {
        file_put_contents($directory . '/data/schema-capabilities.json', $marker);
      }
      foreach ([[], ['type' => 'news']] as $query) {
        $uri = $query === [] ? $base . 'sitemap-news.xml' : $base . 'sitemap.xml?type=news';
        $unready = newsRequest($directory, $uri, $base, $query);
        newsCheck(
          $unready['status'] === 503 && str_contains($unready['body'], 'Database Repair'),
          'A News route bypassed publication readiness.',
        );
      }
      $ordinary = newsRequest($directory, $base . 'sitemap.xml', $base);
      newsCheck(
        $ordinary['status'] === 200 && !str_contains($ordinary['body'], 'sitemap-news.xml'),
        'Readiness failure broke the ordinary index.',
      );
    }
  }
  unset($GLOBALS['voncms_publication_capability_cache']);
  voncms_mark_publication_columns_ready();
  $restored = newsRequest($directory, '/blog/sitemap-news.xml', '/blog/');
  newsCheck($restored['status'] === 200, 'Trusted readiness did not restore the News feed.');
  $legacy = newsXml($restored);
  $restoredUrls = array_map('strval', $legacy->xpath('//s:loc'));
  newsCheck(
    in_array('https://news.example.test/blog/berita/legacy-scheduled', $restoredUrls, true) &&
      in_array('https://news.example.test/blog/berita/post-2006', $restoredUrls, true),
    'Ready storage must retain scheduled/creation fallback for legacy null rows.',
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
  // Actual read-controller requests, with first-publication values produced by the
  // unchanged Save SQL blocks. Database NOW deliberately differs from CMS time.
  foreach (
    ['content', 'excerpt', 'image_url', 'keywords', 'meta_description', 'author_id']
    as $column
  ) {
    $pdo->exec('ALTER TABLE posts ADD COLUMN ' . $column . ' TEXT');
  }
  $clockPdo = new NewsClockSqlitePDO('sqlite:' . $directory . '/qa.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  if (!function_exists('voncms_apply_site_timezone')) {
    eval(newsTimezoneBootstrapSource($root));
  }
  foreach (
    [['UTC', '+08:00'], ['Asia/Kuala_Lumpur', '+00:00'], ['Pacific/Kiritimati', '-05:00']]
    as [$siteZone, $databaseZone]
  ) {
    $clockPdo->sqliteCreateFunction(
      'NOW',
      static fn(): string => (new DateTimeImmutable(
        'now',
        new DateTimeZone($databaseZone),
      ))->format('Y-m-d H:i:s'),
      0,
    );
    $clockPdo->exec('DELETE FROM posts');
    $clockPdo
      ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='time_zone'")
      ->execute([$siteZone]);
    $saveConfig(['enabled' => true]);
    $id = newsClockWrite($clockPdo, 'posts', 'published');
    $stored = $clockPdo->query('SELECT * FROM posts WHERE id=' . $id)->fetch(PDO::FETCH_ASSOC);
    foreach (
      ['/' => 'https://clock.example.test', '/blog/' => 'https://clock.example.test/blog']
      as $base => $origin
    ) {
      $clockPdo
        ->prepare("UPDATE settings SET setting_value=? WHERE setting_key='domain_url'")
        ->execute([$origin]);
      $response = newsRequest($directory, $base . 'sitemap-news.xml', $base);
      $xml = newsXml($response);
      newsCheck(
        $response['status'] === 200 && count($xml->xpath('//n:news')) === 1,
        "New publication omitted at $base with CMS $siteZone / database $databaseZone.",
      );
      newsCheck(
        (string) $xml->xpath('//n:publication_date')[0] ===
          (new DateTimeImmutable($stored['published_at'], new DateTimeZone($siteZone)))->format(
            DATE_ATOM,
          ),
        'Publication XML changed the first-publication instant or timezone.',
      );
      $index = newsRequest($directory, $base . 'sitemap.xml', $base);
      newsCheck(
        $index['status'] === 200 && str_contains($index['body'], $origin . '/sitemap-news.xml'),
        'Fresh publication was omitted from the index News entry.',
      );
    }
    newsCheck(
      $clockPdo->query('SELECT * FROM posts WHERE id=' . $id)->fetch(PDO::FETCH_ASSOC) === $stored,
      'News reads rewrote publication or creation timestamps.',
    );
  }
  $clockPdo = null;
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
  unset($error, $saveConfig, $insert, $insertSetting, $beforeBoundary, $afterBoundary, $clockPdo);
  $pdo = null;
  newsRemove($directory);
}
newsPublicationClockCases($root);
echo "PASS News sitemap: $checks checks (actual read controller, SQLite, root/subdomain/subfolder, 1,000 boundaries, metadata, failure fallbacks and mismatched publication clocks).\n";
