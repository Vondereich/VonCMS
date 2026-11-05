<?php
/** Real importer controller in disposable SQLite or explicit loopback MySQL sites. */
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
$root = getenv('VONCMS_WP_BRIDGE_ROOT') ?: dirname(__DIR__, 2);
require_once __DIR__ . '/sqlite-compat.php';
$mysqlMode = in_array('--mysql', $argv, true);
$mysqlServer = null;
$mysqlSchema = null;
$fixture = sys_get_temp_dir() . '/voncms-wp-bridge-' . bin2hex(random_bytes(8));
mkdir($fixture . '/api/tools', 0700, true);
mkdir($fixture . '/uploads/temp', 0700, true);
mkdir($fixture . '/data', 0700, true);
mkdir($fixture . '/core', 0700, true);
file_put_contents(
  $fixture . '/core/DataBoundary.php',
  '<?php require_once ' . var_export($root . '/public/core/DataBoundary.php', true) . ';',
);
register_shutdown_function(static function () use ($fixture, &$mysqlServer, &$mysqlSchema) {
  $GLOBALS['setting'] = null;
  $GLOBALS['pdo'] = null;
  gc_collect_cycles();
  if ($mysqlServer instanceof PDO && $mysqlSchema !== null) {
    $mysqlServer->exec("DROP DATABASE `{$mysqlSchema}`");
  }
  $iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($fixture, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::CHILD_FIRST,
  );
  foreach ($iterator as $file) {
    $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
  }
  rmdir($fixture);
});
$checks = 0;
function bridgeCheck(bool $value, string $message): void
{
  global $checks;
  if (!$value) {
    throw new RuntimeException($message);
  }
  $checks++;
}
function bridgeRequest(string $file, int $limit = 50): array
{
  global $fixture;
  $body = json_encode(['temp_file' => $file, 'batch_index' => 0, 'limit' => $limit]);
  $process = proc_open(
    [PHP_BINARY, $fixture . '/api/tools/wp_import.php', $body],
    [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
  );
  $output = stream_get_contents($pipes[1]);
  $error = stream_get_contents($pipes[2]);
  fclose($pipes[1]);
  fclose($pipes[2]);
  $status = proc_close($process);
  $decoded = json_decode($output, true);
  bridgeCheck(
    $status === 0 && is_array($decoded),
    'Importer response failed: ' . $error . ' ' . $output,
  );
  return $decoded;
}
function bridgeItem(
  string $slug,
  string $type = 'post',
  string $password = '',
  string $status = 'publish',
  string $prefix = 'wp',
  string $extraPassword = '',
): string {
  return '<item><title>' .
    $slug .
    '</title><link>https://source.invalid/2025/01/02/' .
    $slug .
    '/</link><content:encoded><![CDATA[<!-- wp:paragraph --><p>R&amp;D café <a href="https://source.invalid/2025/01/02/later-post/?view=all#part">Later query</a><a href="https://source.invalid/2025/01/02/later-post/#part">Later</a><a href="?view=all#relative">Relative query</a><a href="https://source.invalid.other.invalid/path">Foreign</a></p><!-- /wp:paragraph -->]]></content:encoded><excerpt:encoded><![CDATA[Manual R&D summary.]]></excerpt:encoded><' .
    $prefix .
    ':post_type>' .
    $type .
    '</' .
    $prefix .
    ':post_type><' .
    $prefix .
    ':post_name>' .
    $slug .
    '</' .
    $prefix .
    ':post_name><' .
    $prefix .
    ':status>' .
    $status .
    '</' .
    $prefix .
    ':status><' .
    $prefix .
    ':post_password>' .
    htmlspecialchars($password, ENT_XML1) .
    '</' .
    $prefix .
    ':post_password>' .
    $extraPassword .
    '<' .
    $prefix .
    ':post_date>2025-01-02 09:30:00</' .
    $prefix .
    ':post_date><category domain="category">R&amp;D News</category><category domain="post_tag">First</category><category domain="post_tag">Café</category><' .
    $prefix .
    ':postmeta><' .
    $prefix .
    ':meta_key>_yoast_wpseo_metadesc</' .
    $prefix .
    ':meta_key><' .
    $prefix .
    ':meta_value><![CDATA[Compare x<y and R&D.]]></' .
    $prefix .
    ':meta_value></' .
    $prefix .
    ':postmeta></item>';
}
function bridgeXml(string $items, string $scheme = 'https', string $prefix = 'wp'): string
{
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:' .
    $prefix .
    '="' .
    $scheme .
    '://wordpress.org/export/1.2/" xmlns:excerpt="' .
    $scheme .
    '://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><' .
    $prefix .
    ':wxr_version>1.2</' .
    $prefix .
    ':wxr_version><' .
    $prefix .
    ':base_site_url>https://source.invalid</' .
    $prefix .
    ':base_site_url><' .
    $prefix .
    ':base_blog_url>https://source.invalid</' .
    $prefix .
    ':base_blog_url>' .
    $items .
    '</channel></rss>';
}
// Only bootstrap/session/CSRF transport is stubbed; controller, XML, HTML, slug and redirect owners are real.
file_put_contents(
  $fixture . '/security.php',
  '<?php
$_SERVER["REQUEST_METHOD"] = "POST";
$_SESSION["user"] = ["id" => 1, "username" => "FixtureOwner"];
function sendApiHeaders($methods) {}
function is_https() { return true; }
function voncms_has_publication_column(PDO $pdo, string $table): bool { return true; }
class SessionManager { static function requireValidSession() {} static function requirePrimaryAdmin() {} }
class CSRFProtection { static function requireToken() {} static function getRequestBody() { return $GLOBALS["argv"][1]; } }
class ResponseHelper { static function sendError($message, $status = 500) { echo json_encode(["success" => false, "status" => $status, "message" => is_string($message) ? $message : $message->getMessage()]); exit; } }
',
);
file_put_contents(
  $fixture . '/api/public_cache_helper.php',
  '<?php function voncms_public_cache_clear() { return []; }',
);
foreach (
  [
    'public/api/publication_time_helper.php',
    'public/api/content_embed_helper.php',
    'public/api/content_slug_helper.php',
    'public/api/redirect_loop_helper.php',
    'public/seo_schema_helper.php',
    'public/seo_response_helper.php',
  ]
  as $relative
) {
  $destination = $fixture . '/' . substr($relative, 7);
  file_put_contents(
    $destination,
    '<?php require_once ' . var_export($root . '/' . $relative, true) . ';',
  );
}
foreach (['wp_import.php', 'wp_wxr_reader_helper.php'] as $name) {
  copy($root . '/public/api/tools/' . $name, $fixture . '/api/tools/' . $name);
}
$databaseClass = 'VonCmsFixtureSqlitePDO';
$databaseDsn = 'sqlite:' . $fixture . '/fixture.sqlite';
$databaseUser = $databasePassword = null;
if ($mysqlMode) {
  // Never load application config or use a supplied existing schema.
  $serverDsn = (string) getenv('VONCMS_TEST_MYSQL_DSN');
  if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/', $serverDsn)) {
    throw new RuntimeException('Set VONCMS_TEST_MYSQL_DSN to an explicit loopback fixture server');
  }
  $databaseClass = 'PDO';
  $databaseUser = (string) (getenv('VONCMS_TEST_MYSQL_USER') ?: 'root');
  $databasePassword = (string) getenv('VONCMS_TEST_MYSQL_PASSWORD');
  $mysqlServer = new PDO($serverDsn, $databaseUser, $databasePassword, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  $newSchema = 'voncms_bridge_qa_' . bin2hex(random_bytes(6));
  $mysqlServer->exec(
    "CREATE DATABASE `{$newSchema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  $mysqlSchema = $newSchema;
  $databaseDsn = str_replace(';charset=', ";dbname={$mysqlSchema};charset=", $serverDsn);
}
$databaseArgs = implode(
  ', ',
  array_map('var_export', [$databaseDsn, $databaseUser, $databasePassword], [true, true, true]),
);
file_put_contents(
  $fixture . '/von_config.php',
  '<?php require_once ' .
    var_export(__DIR__ . '/sqlite-compat.php', true) .
    '; $pdo = new ' .
    $databaseClass .
    '(' .
    $databaseArgs .
    ', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);',
);
chmod($fixture . '/von_config.php', 0600);
$pdo = new $databaseClass($databaseDsn, $databaseUser, $databasePassword, [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$identityColumn = $mysqlMode
  ? 'INTEGER PRIMARY KEY AUTO_INCREMENT'
  : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$contentColumn = $mysqlMode ? 'LONGTEXT' : 'TEXT';
$metadataColumns = $mysqlMode
  ? 'excerpt TEXT, keywords TEXT, meta_description TEXT'
  : "excerpt TEXT DEFAULT '', keywords TEXT DEFAULT '', meta_description TEXT DEFAULT ''";
foreach (['posts', 'pages'] as $table) {
  $pdo->exec(
    "CREATE TABLE $table (id $identityColumn, title TEXT, slug VARCHAR(255) UNIQUE, content $contentColumn, status TEXT, author TEXT, author_id INTEGER, category TEXT, created_at TEXT, updated_at TEXT, image_url TEXT, published_at TEXT, $metadataColumns)",
  );
}
$pdo->exec('CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT)');
$pdo->exec(
  "CREATE TABLE redirects (id $identityColumn, source_url VARCHAR(700) UNIQUE, target_url TEXT, redirect_type INTEGER, created_at TEXT)",
);
define('VONCMS_WP_IMPORT_CONTEXT', true);
require $root . '/public/api/tools/wp_wxr_reader_helper.php';

foreach (['https', 'http'] as $scheme) {
  foreach (['wp', 'alias'] as $prefix) {
    foreach (['', '/blog'] as $base) {
      foreach (['slug', 'category', 'date', 'plain'] as $style) {
        $pdo->exec(
          'DELETE FROM posts; DELETE FROM pages; DELETE FROM redirects; DELETE FROM settings',
        );
        $setting = $pdo->prepare('INSERT INTO settings VALUES (?, ?, ?)');
        $setting->execute(['general', 'domain_url', 'https://target.invalid' . $base]);
        $setting->execute(['general', 'permalink_structure', $style]);
        $items =
          bridgeItem('first-post', 'post', '', 'publish', $prefix) .
          bridgeItem('later-post', 'post', '', 'publish', $prefix);
        foreach (['post', 'page'] as $type) {
          foreach (['secret', '0', '   ', '&'] as $n => $password) {
            $items .= bridgeItem(
              'protected-' . $type . '-' . $n,
              $type,
              $password,
              'publish',
              $prefix,
            );
          }
          $items .= bridgeItem(
            'duplicate-password-' . $type,
            $type,
            '',
            'publish',
            $prefix,
            '<' . $prefix . ':post_password><![CDATA[not-empty]]></' . $prefix . ':post_password>',
          );
          $items .= bridgeItem('private-' . $type, $type, '', 'private', $prefix);
          $items .= bridgeItem('public-' . $type, $type, '', 'publish', $prefix);
        }
        $file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
        file_put_contents($fixture . '/uploads/temp/' . $file, bridgeXml($items, $scheme, $prefix));
        $first = bridgeRequest($file);
        bridgeCheck(
          (int) $pdo
            ->query(
              "SELECT COUNT(*) FROM posts WHERE slug LIKE 'protected-%' AND status = 'published'",
            )
            ->fetchColumn() === 0,
          'Baseline trigger: password-protected WordPress content became public',
        );
        bridgeCheck(
          ($first['success'] ?? false) &&
            !($first['paused'] ?? false) &&
            $first['phase'] === 'links',
          'Valid WXR import failed',
        );
        $last = bridgeRequest($file);
        bridgeCheck(($last['success'] ?? false) && !$last['has_more'], 'Link finalization failed');
        bridgeCheck(
          !is_file($fixture . '/uploads/temp/' . $file),
          'Successful XML was not cleaned',
        );
        foreach (['posts', 'pages'] as $table) {
          $unsafeCount = $pdo
            ->query(
              "SELECT COUNT(*) FROM $table WHERE (slug LIKE 'protected-%' OR slug LIKE 'duplicate-password-%' OR slug LIKE 'private-%') AND (status != 'draft' OR published_at IS NOT NULL)",
            )
            ->fetchColumn();
          bridgeCheck((int) $unsafeCount === 0, 'Protected/private content became public');
          $public = $pdo
            ->query("SELECT * FROM $table WHERE slug LIKE 'public-%'")
            ->fetch(PDO::FETCH_ASSOC);
          bridgeCheck(
            $public && $public['status'] === 'published' && $public['published_at'] !== null,
            'Public control was rejected',
          );
          bridgeCheck(
            $public['excerpt'] === 'Manual R&D summary.' &&
              $public['keywords'] === 'First, Café' &&
              $public['meta_description'] === 'Compare x<y and R&D.',
            'Native/plugin metadata did not survive',
          );
        }
        $laterId = $pdo->query("SELECT id FROM posts WHERE slug = 'later-post'")->fetchColumn();
        $path = [
          'slug' => '/later-post',
          'category' => '/rd-news/later-post',
          'date' => '/2025/01/02/later-post',
          'plain' => '/post/' . $laterId,
        ][$style];
        $body = $pdo->query("SELECT content FROM posts WHERE slug = 'first-post'")->fetchColumn();
        bridgeCheck(
          str_contains($body, 'https://target.invalid' . $base . $path . '#part'),
          'Forward link/fragment destination differs from canonical',
        );
        bridgeCheck(
          str_contains($body, 'https://target.invalid' . $base . $path . '?view=all#part'),
          'Ordinary query/fragment was lost',
        );
        $firstId = $pdo->query("SELECT id FROM posts WHERE slug = 'first-post'")->fetchColumn();
        $firstPath = [
          'slug' => '/first-post',
          'category' => '/rd-news/first-post',
          'date' => '/2025/01/02/first-post',
          'plain' => '/post/' . $firstId,
        ][$style];
        bridgeCheck(
          str_contains($body, 'https://target.invalid' . $base . $firstPath . '?view=all#relative'),
          'Query-relative href lost its query or fragment: ' . $body,
        );
        bridgeCheck(
          str_contains($body, 'https://source.invalid.other.invalid/path'),
          'Foreign prefix lookalike was rewritten',
        );
        $redirect = $pdo
          ->query("SELECT target_url FROM redirects WHERE source_url = '/2025/01/02/later-post'")
          ->fetchColumn();
        bridgeCheck(
          $path === '/2025/01/02/later-post' ? $redirect === false : $redirect === $base . $path,
          'Actual exported redirect or subfolder prefix is wrong',
        );
        bridgeCheck(
          !str_contains(json_encode($last), 'not-empty') &&
            !str_contains(json_encode($first), 'secret'),
          'Password bytes leaked in import response',
        );
      }
    }
  }
}

// Failure and retry cross a real database error, not a substituted importer branch.
$pdo->exec('DELETE FROM posts; DELETE FROM pages; DELETE FROM redirects; DELETE FROM settings');
$pdo->exec(
  "INSERT INTO settings VALUES ('general','domain_url','https://target.invalid/blog'), ('general','permalink_structure','plain')",
);
$pdo->exec(
  $mysqlMode
    ? "CREATE TRIGGER reject_once BEFORE INSERT ON posts FOR EACH ROW BEGIN IF NEW.slug = 'retry-post' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled fixture failure'; END IF; END"
    : "CREATE TRIGGER reject_once BEFORE INSERT ON posts WHEN NEW.slug = 'retry-post' BEGIN SELECT RAISE(ABORT, 'controlled fixture failure'); END",
);
$file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
file_put_contents(
  $fixture . '/uploads/temp/' . $file,
  bridgeXml(
    bridgeItem('first-post') .
      bridgeItem('prefix-post') .
      bridgeItem('retry-post') .
      bridgeItem('later-post'),
  ),
);
$prefixResult = bridgeRequest($file, 2);
$checkpointPath = $fixture . '/uploads/temp/' . $file . '.state.json';
$checkpointBytes = file_get_contents($checkpointPath);
$checkpoint = json_decode($checkpointBytes, true, 512, JSON_THROW_ON_ERROR);
$rowsBeforeCorruption = [];
foreach (['posts', 'pages', 'redirects', 'settings'] as $table) {
  $rowsBeforeCorruption[$table] = $pdo->query("SELECT * FROM $table")->fetchAll(PDO::FETCH_ASSOC);
}
foreach (['offset', 'record-id', 'record-public', 'attachment-url', 'links-offset'] as $case) {
  $damaged = $checkpoint;
  $firstRecord = array_key_first($damaged['records']);
  switch ($case) {
    case 'offset':
      $damaged['offset'] = [];
      break;
    case 'record-id':
      $damaged['records'][$firstRecord]['id'] = [];
      break;
    case 'record-public':
      $damaged['records'][$firstRecord]['public'] = 'yes';
      break;
    case 'attachment-url':
      $damaged['inspection']['attachments']['123'] = [];
      break;
    case 'links-offset':
      $damaged['links_offset'] = count($damaged['records']) + 1;
      break;
  }
  $damagedBytes = json_encode($damaged, JSON_THROW_ON_ERROR);
  file_put_contents($checkpointPath, $damagedBytes);
  $rejectedCheckpoint = bridgeRequest($file, 2);
  bridgeCheck(
    !($rejectedCheckpoint['success'] ?? false) && ($rejectedCheckpoint['status'] ?? null) === 400,
    "Damaged checkpoint $case was not rejected before resume",
  );
  foreach ($rowsBeforeCorruption as $table => $rows) {
    bridgeCheck(
      $pdo->query("SELECT * FROM $table")->fetchAll(PDO::FETCH_ASSOC) === $rows,
      "Damaged checkpoint $case wrote to $table",
    );
  }
  bridgeCheck(
    file_get_contents($checkpointPath) === $damagedBytes,
    'Rejected checkpoint was overwritten',
  );
}
file_put_contents($checkpointPath, $checkpointBytes);
$paused = bridgeRequest($file, 2);
bridgeCheck(
  ($paused['paused'] ?? false) &&
    $paused['processed_total'] === 2 &&
    is_file($fixture . '/uploads/temp/' . $file),
  'Failed item did not preserve the exact retry cursor/source',
);
bridgeCheck(
  count($paused['errors']) === 1 &&
    !str_contains($paused['errors'][0], 'controlled fixture failure'),
  'Raw database error leaked or failure was silent',
);
$pdo->exec('DROP TRIGGER reject_once');
$resumed = [];
for ($attempt = 0; $attempt < 8; $attempt++) {
  $resumed = bridgeRequest($file, 2);
  if (!($resumed['has_more'] ?? false)) {
    break;
  }
}
bridgeCheck(
  $resumed['success'] &&
    !$resumed['has_more'] &&
    $resumed['processed_total'] === 4 &&
    $resumed['imported_total'] === 4,
  'Retry duplicated/skipped records or failed to finish',
);
bridgeCheck(
  (int) $pdo->query('SELECT COUNT(*) FROM posts')->fetchColumn() === 4,
  'Retry inserted duplicate content',
);

$original = $pdo->query("SELECT content FROM posts WHERE slug = 'first-post'")->fetchColumn();
$file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
file_put_contents(
  $fixture . '/uploads/temp/' . $file,
  bridgeXml(bridgeItem('first-post') . bridgeItem('concurrent-post')),
);
$result = bridgeRequest($file);
bridgeCheck(
  $result['imported_total'] === 1 && $result['skipped_total'] === 1,
  'Existing duplicate was not skipped',
);
$pdo->exec("UPDATE posts SET content = 'Owner edit must survive' WHERE slug = 'concurrent-post'");
$finished = bridgeRequest($file);
bridgeCheck(
  $pdo->query("SELECT content FROM posts WHERE slug = 'first-post'")->fetchColumn() === $original,
  'Existing article was rewritten',
);
bridgeCheck(
  $pdo->query("SELECT content FROM posts WHERE slug = 'concurrent-post'")->fetchColumn() ===
    'Owner edit must survive' && $finished['warning_count'] > 0,
  'Concurrent edit was overwritten or hidden',
);

foreach (['1.0', '1.1'] as $version) {
  $path = $fixture . '/legacy.xml';
  file_put_contents(
    $path,
    str_replace(
      ['export/1.2/', '>1.2<'],
      ['export/' . $version . '/', '>' . $version . '<'],
      bridgeXml(bridgeItem('legacy'), 'http'),
    ),
  );
  bridgeCheck(
    voncms_wp_inspect_document($path)['stats']['posts'] === 1,
    'Supported legacy WXR namespace was rejected',
  );
}
$mixedPassword = simplexml_load_string(
  '<item xmlns:a="http://wordpress.org/export/1.2/" xmlns:b="https://wordpress.org/export/1.2/"><a:post_password/><b:post_password>0</b:post_password></item>',
);
bridgeCheck(
  voncms_wp_item_is_protected($mixedPassword),
  'Alternate namespace password was ignored',
);

foreach (
  [
    '<html><p>Not WXR</p></html>',
    substr(bridgeXml(bridgeItem('broken')), 0, -13),
    '<!DOCTYPE rss [<!ENTITY remote SYSTEM "file:///not-read">]><rss><channel/></rss>',
  ]
  as $badXml
) {
  $path = $fixture . '/bad.xml';
  file_put_contents($path, $badXml);
  $rejected = false;
  try {
    voncms_wp_inspect_document($path);
  } catch (Throwable $error) {
    $rejected = true;
  }
  bridgeCheck($rejected, 'Unrelated/malformed/entity XML was accepted');
}
// Flat generic Post/Page passwords retain the same veto, including zero.
foreach (['post', 'page'] as $type) {
  $file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
  file_put_contents(
    $fixture . '/uploads/temp/' . $file,
    '<posts><post><title>flat-' .
      $type .
      '</title><post_type>' .
      $type .
      '</post_type><status>publish</status><post_password>0</post_password><content>Keep</content></post></posts>',
  );
  $result = bridgeRequest($file);
  $table = $type === 'post' ? 'posts' : 'pages';
  bridgeCheck(
    $pdo->query("SELECT status FROM $table WHERE slug = 'flat-$type'")->fetchColumn() === 'draft',
    'Generic zero password was published',
  );
  bridgeRequest($file);
}
$file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
$queryA = str_replace(
  'https://source.invalid/2025/01/02/query-a/',
  'https://source.invalid/?p=101',
  bridgeItem('query-a'),
);
$queryB = str_replace(
  'https://source.invalid/2025/01/02/query-b/',
  'https://source.invalid/?p=102',
  bridgeItem('query-b'),
);
$queryA = str_replace('?view=all#relative', '?p=102#query-link', $queryA);
file_put_contents($fixture . '/uploads/temp/' . $file, bridgeXml($queryA . $queryB));
bridgeRequest($file);
$queryResult = bridgeRequest($file);
$queryBId = $pdo->query("SELECT id FROM posts WHERE slug = 'query-b'")->fetchColumn();
bridgeCheck(
  str_contains(
    $pdo->query("SELECT content FROM posts WHERE slug = 'query-a'")->fetchColumn(),
    '/blog/post/' . $queryBId . '#query-link',
  ),
  'Query-based WordPress source destination was lost',
);
bridgeCheck(
  $pdo->query("SELECT COUNT(*) FROM redirects WHERE source_url = '/'")->fetchColumn() == 0 &&
    $queryResult['warning_count'] > 0,
  'Query source became a homepage redirect or had no limitation warning',
);

$pdo->exec(
  "INSERT INTO pages (title,slug,content,status,author_id,created_at,updated_at) VALUES ('Existing page','123','Existing page content','published',1,'2025-01-01','2025-01-01')",
);
$collision = str_replace(
  'https://source.invalid/2025/01/02/collision-import/',
  'https://source.invalid/123/',
  bridgeItem('collision-import'),
);
$home = str_replace(
  'https://source.invalid/2025/01/02/source-home/',
  'https://source.invalid/',
  bridgeItem('source-home', 'page'),
);
$file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
file_put_contents($fixture . '/uploads/temp/' . $file, bridgeXml($collision . $home));
bridgeRequest($file);
$collisionResult = bridgeRequest($file);
bridgeCheck(
  $pdo->query("SELECT COUNT(*) FROM redirects WHERE source_url IN ('/123','/')")->fetchColumn() ==
    0,
  'Bridge redirect would hide unrelated existing content or the homepage',
);
bridgeCheck($collisionResult['warning_count'] > 0, 'Redirect collision did not produce a warning');

$file = 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';
$mixedXml =
  '<posts><post><title>typed-count-control</title><content>Keep</content></post><item><title>must-not-import-untyped</title><content>Not a typed record</content></item></posts>';
file_put_contents($fixture . '/uploads/temp/' . $file, $mixedXml);
bridgeCheck(
  voncms_wp_inspect_document($fixture . '/uploads/temp/' . $file)['stats']['posts'] === 1,
  'Mixed scan counted an untyped item',
);
$mixed = bridgeRequest($file);
bridgeCheck(
  $mixed['processed_total'] === 1 &&
    $pdo
      ->query("SELECT COUNT(*) FROM posts WHERE slug = 'must-not-import-untyped'")
      ->fetchColumn() == 0,
  'Importer counted or wrote an untyped item',
);
bridgeRequest($file);

echo 'WordPress Bridge runtime: ' .
  $checks .
  ' assertions passed.' .
  ($mysqlMode ? ' MySQL ' . $mysqlServer->getAttribute(PDO::ATTR_SERVER_VERSION) : '') .
  "\n";
$setting = null;
$pdo = null;
