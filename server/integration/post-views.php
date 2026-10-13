<?php
declare(strict_types=1);
// Only --mysql creates a disposable loopback QA database; never reads von_config.php.
require_once dirname(__DIR__, 2) . '/public/api/post_views_helper.php';
require_once dirname(__DIR__, 2) . '/public/api/schema_repair_helper.php';
function voncms_apply_site_timezone($pdo): ?string
{
  date_default_timezone_set('Asia/Kuala_Lumpur');
  return 'Asia/Kuala_Lumpur';
}
function verify(bool $condition, string $label): void
{
  if (!$condition) {
    throw new RuntimeException($label);
  }
  echo "PASS {$label}\n";
}
class DailyStatement extends PDOStatement
{
  public function __construct(public DailyPdo $pdo, public string $sql) {}
  public function execute(?array $params = null): bool
  {
    $this->pdo->queries[] = [$this->sql, $params];
    return true;
  }
  public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array
  {
    return [
      [
        'id' => 1,
        'title' => '<b>literal</b>',
        'slug' => 'qa',
        'category' => 'Tech AI',
        'created_at' => '2026-01-02',
        'period_views' => 12,
      ],
    ];
  }
  public function fetchColumn(int $column = 0): mixed
  {
    return 'category';
  }
}
class DailyPdo extends PDO
{
  public array $queries = [];
  public function __construct() {}
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    return new DailyStatement($this, $query);
  }
}
$GLOBALS['voncms_publication_capability_cache'] = [];
$mock = new DailyPdo();
voncms_record_daily_post_view($mock, 1);
verify($mock->queries === [], 'unrepaired installs do no new database work');
try {
  voncms_top_articles($mock, 7, '/');
  throw new LogicException('Unrepaired report unexpectedly succeeded');
} catch (RuntimeException $error) {
  verify(
    str_contains($error->getMessage(), 'Database Repair'),
    'unavailable is not reported as zero',
  );
}
$GLOBALS['voncms_publication_capability_cache'] = [
  'version' => 1,
  'post_daily_views' => true,
  'post_daily_views_since' => time(),
];
voncms_record_daily_post_view($mock, 1);
verify(
  str_contains($mock->queries[0][0], 'ON DUPLICATE KEY UPDATE views = views + 1'),
  'daily increment is atomic',
);
verify($mock->queries[0][1] === [1, date('Y-m-d')], 'daily bucket uses the site date');
verify(
  !preg_match('/ip_hash|user_agent|referrer|session/i', $mock->queries[0][0]),
  'aggregate contains no reader identifiers',
);
$report = voncms_top_articles($mock, 30, '/zangetsu/');
verify(
  $report['articles'][0]['url'] === '/zangetsu/tech-ai/qa',
  'canonical category URL preserves subfolder',
);
verify(
  $report['articles'][0]['title'] === '<b>literal</b>',
  'titles remain text for React escaping',
);
$expectedFrom = new DateTimeImmutable('today');
verify(
  $report['from'] === $expectedFrom->modify('-29 days')->format('Y-m-d'),
  '30-day inclusive date range',
);
verify(
  voncms_top_articles($mock, 999999, '/')['days'] === 7,
  'report window is bounded to 7 or 30 days',
);
verify(
  count(voncms_schema_runtime_column_specs()['post_daily_views']) === 3,
  'shared schema owns the anonymous aggregate',
);

$mode = $argv[1] ?? '';
if ($mode === '--worker') {
  $db = $argv[2] ?? '';
  if (!preg_match('/^voncms_qa_views_[a-f0-9]{12}$/', $db)) {
    throw new RuntimeException('Unsafe QA database');
  }
  $pdo = new PDO("mysql:host=127.0.0.1;dbname={$db};charset=utf8mb4", 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  for ($i = 0; $i < 25; $i++) {
    voncms_record_daily_post_view($pdo, 1);
  }
  exit();
}
if ($mode !== '--mysql') {
  echo "PASS focused daily view checks (no database changes)\n";
  exit();
}
$database = 'voncms_qa_views_' . bin2hex(random_bytes(6));
$admin = null;
$created = false;
$workers = [];
try {
  $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false];
  $admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', '', $options);
  $exists = $admin->prepare('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
  $exists->execute([$database]);
  if ($exists->fetchColumn() !== false) {
    throw new RuntimeException('Refuse existing database');
  }
  $admin->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  $created = true;
  $pdo = new PDO("mysql:host=127.0.0.1;dbname={$database};charset=utf8mb4", 'root', '', $options);
  $schema = (string) file_get_contents(dirname(__DIR__, 2) . '/public/install.sql');
  $schema = preg_replace('/^CREATE DATABASE[^;]*;\s*USE[^;]*;/m', '', $schema);
  if (preg_match('/\b(?:CREATE\s+DATABASE|USE\s+example_db)\b/i', $schema)) {
    throw new RuntimeException('Unexpected database selector');
  }
  $pdo->exec($schema);
  verify(
    voncms_schema_has_capability($pdo, 'post_daily_views'),
    'fresh schema has the required table and indexes',
  );
  $pdo->exec('DROP TABLE post_daily_views');
  verify(
    !voncms_schema_has_capability($pdo, 'post_daily_views'),
    'missing table is detected without runtime DDL',
  );
  voncms_schema_repair_runtime_capabilities($pdo);
  verify(
    voncms_schema_has_capability($pdo, 'post_daily_views'),
    'explicit repair creates compatible daily storage',
  );
  voncms_schema_repair_runtime_capabilities($pdo);
  verify(voncms_schema_has_capability($pdo, 'post_daily_views'), 'repair is repeatable');
  $pdo->exec("SET time_zone = '+00:00'");
  $pdo->exec(
    "INSERT INTO users(id,username,email,password,role) VALUES(1,'qa','qa@example.invalid','not-a-password','Writer')",
  );
  $post = $pdo->prepare(
    'INSERT INTO posts(id,title,slug,category,author_id,status,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,1,?,?,?,?)',
  );
  for ($id = 1; $id <= 15; $id++) {
    $post->execute([
      $id,
      'Article ' . $id,
      'qa-' . $id,
      'Tech AI',
      $id === 14 ? 'draft' : 'published',
      $id === 15 ? '2099-01-01' : null,
      '2026-01-02',
      '2026-01-02',
    ]);
  }
  $pdo->exec(
    "UPDATE settings SET setting_value = 'category' WHERE setting_group = 'general' AND setting_key = 'permalink_structure'",
  );
  $today = new DateTimeImmutable('today');
  $insert = $pdo->prepare('INSERT INTO post_daily_views(post_id,view_date,views) VALUES(?,?,?)');
  for ($id = 1; $id <= 15; $id++) {
    $insert->execute([$id, $today->format('Y-m-d'), $id * 10]);
  }
  $insert->execute([999, $today->format('Y-m-d'), 9999]);
  $insert->execute([1, $today->modify('-6 days')->format('Y-m-d'), 100]);
  $insert->execute([1, $today->modify('-7 days')->format('Y-m-d'), 500]);
  $insert->execute([1, $today->modify('-29 days')->format('Y-m-d'), 1000]);
  $insert->execute([1, $today->modify('-30 days')->format('Y-m-d'), 99999]);
  $insert->execute([1, $today->modify('+1 day')->format('Y-m-d'), 99999]);
  $report7 = voncms_top_articles($pdo, 7, '/zangetsu');
  $report30 = voncms_top_articles($pdo, 30, '/');
  verify(
    count($report7['articles']) === 10 && $report7['articles'][0]['id'] === '13',
    'Top 10 excludes draft, future and orphan rows before limiting',
  );
  verify(
    $report30['articles'][0]['id'] === '1' && $report30['articles'][0]['views'] === 1610,
    '30-day ranking includes the boundary and excludes older/future rows',
  );
  verify(
    $report30['timeZone'] === 'Asia/Kuala_Lumpur',
    'report and write dates share site timezone',
  );
  foreach (
    [
      'slug' => '/qa-1',
      'category' => '/tech-ai/qa-1',
      'date' => '/2026/01/02/qa-1',
      'month_name' => '/2026/01/qa-1',
      'plain' => '/post/1',
    ]
    as $style => $expected
  ) {
    $pdo
      ->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'permalink_structure'")
      ->execute([$style]);
    verify(
      voncms_top_articles($pdo, 30, '/zangetsu/')['articles'][0]['url'] === '/zangetsu' . $expected,
      'current canonical permalink ' . $style,
    );
  }
  // Independent processes exercise MySQL's atomic upsert, not a PHP imitation.
  for ($i = 0; $i < 4; $i++) {
    $process = proc_open(
      [PHP_BINARY, __FILE__, '--worker', $database],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    if (!is_resource($process)) {
      throw new RuntimeException('Could not start worker');
    }
    fclose($pipes[0]);
    $workers[] = [$process, $pipes];
  }
  foreach ($workers as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    verify(proc_close($process) === 0, 'concurrent writer completes: ' . trim($err));
  }
  $workers = [];
  $count = $pdo->prepare('SELECT views FROM post_daily_views WHERE post_id = 1 AND view_date = ?');
  $count->execute([$today->format('Y-m-d')]);
  verify((int) $count->fetchColumn() === 110, '100 concurrent increments are not lost');
  $pdo->exec('DROP TABLE post_daily_views');
  try {
    voncms_top_articles($pdo, 7, '/');
    throw new LogicException('Dropped storage unexpectedly succeeded');
  } catch (PDOException $error) {
    verify(true, 'storage failure remains distinguishable from zero views');
  }
} finally {
  foreach ($workers as [$process, $pipes]) {
    if (is_resource($process)) {
      proc_terminate($process);
    }
  }
  if (
    $created &&
    $admin instanceof PDO &&
    preg_match('/^voncms_qa_views_[a-f0-9]{12}$/', $database)
  ) {
    $pdo = null;
    $admin->exec("DROP DATABASE `{$database}`");
    echo "PASS disposable QA database removed\n";
  }
}
