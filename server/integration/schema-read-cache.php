<?php
declare(strict_types=1);

// CLI-only, disposable metadata probes. No configured CMS database is loaded.
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
$root = dirname(__DIR__, 2);
$mysql = ($argv[1] ?? '') === '--mysql';
$fixture = sys_get_temp_dir() . '/voncms-schema-read-' . bin2hex(random_bytes(8));
$database = 'voncms_qa_schema_read_' . bin2hex(random_bytes(8));
$admin = null;
$createdDatabase = false;
$checks = 0;

function cacheCheck(bool $condition, string $label): void
{
  if (!$condition) {
    throw new RuntimeException($label);
  }
  $GLOBALS['checks']++;
  echo "PASS Schema read cache: {$label}\n";
}

class SchemaReadProbePdo extends PDO
{
  public int $probes = 0;
  public bool $failProbe = false;
  public bool $falseProbe = false;

  public function query(
    string $query,
    ?int $fetchMode = null,
    mixed ...$fetchModeArgs,
  ): PDOStatement|false {
    if ($query === "SHOW COLUMNS FROM users LIKE 'display_name'") {
      $this->probes++;
      if ($this->failProbe) {
        throw new PDOException('Controlled metadata probe failure');
      }
      if ($this->falseProbe) {
        return false;
      }
      if ($this->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $query = "SELECT name AS Field FROM pragma_table_info('users') WHERE name = 'display_name'";
      }
    }
    return $fetchMode === null
      ? parent::query($query)
      : parent::query($query, $fetchMode, ...$fetchModeArgs);
  }
}

function removeCacheFixture(string $path): void
{
  if (is_link($path) || is_file($path)) {
    unlink($path);
    return;
  }
  foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $entry) {
    removeCacheFixture($path . '/' . $entry);
  }
  rmdir($path);
}

try {
  foreach (['api', 'core', 'data'] as $directory) {
    mkdir($fixture . '/' . $directory, 0700, true);
  }
  $helperSource = (string) file_get_contents($root . '/public/api/publication_time_helper.php');
  if (getenv('VONCMS_SCHEMA_CACHE_CONTROL') === 'without-hits') {
    // Counterfactual in this disposable copy only: the warm-query assertion must fail.
    $helperSource = str_replace(
      'if ($cached !== null) {',
      'if (false) {',
      $helperSource,
      $disabledHits,
    );
    if ($disabledHits !== 2) {
      throw new RuntimeException('The cache-hit control no longer matches both read paths');
    }
  }
  file_put_contents($fixture . '/api/publication_time_helper.php', $helperSource);
  copy($root . '/public/core/DataBoundary.php', $fixture . '/core/DataBoundary.php');
  // Identity only. This dummy file is never included and contains no real credentials.
  file_put_contents($fixture . '/von_config.php', '<?php // disposable schema fixture A');
  require $fixture . '/api/publication_time_helper.php';
  $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false];
  if ($mysql) {
    $admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', '', $options);
    $exists = $admin->prepare('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
    $exists->execute([$database]);
    if ($exists->fetchColumn() !== false) {
      throw new RuntimeException('Refuse an existing QA database');
    }
    $exists->closeCursor();
    $admin->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $createdDatabase = true;
    $pdo = new SchemaReadProbePdo(
      "mysql:host=127.0.0.1;dbname={$database};charset=utf8mb4",
      'root',
      '',
      $options,
    );
  } else {
    $pdo = new SchemaReadProbePdo('sqlite::memory:', null, null, $options);
  }
  $pdo->exec(
    'CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(100), display_name VARCHAR(100))',
  );
  $pdo->exec("INSERT INTO users VALUES (1, 'writer', 'R&D author')");
  $cache = voncms_display_name_cache_path();
  cacheCheck(voncms_has_display_name_column($pdo), 'the real metadata probe finds the column');
  for ($i = 0; $i < 100; $i++) {
    if (!voncms_has_display_name_column($pdo)) {
      throw new RuntimeException('A cached positive decision changed');
    }
  }
  cacheCheck($pdo->probes === 1, '100 warm reads add zero metadata SQL queries');
  cacheCheck(
    $pdo->query('SELECT display_name FROM users WHERE id = 1')->fetchColumn() === 'R&D author',
    'presentation text stays unchanged',
  );
  $saved = json_decode((string) file_get_contents($cache), true, 512, JSON_THROW_ON_ERROR);
  cacheCheck(
    array_keys($saved) === ['version', 'context', 'checked_at', 'display_name'],
    'only bounded metadata, not user or article data, is stored',
  );

  $pdo->exec('ALTER TABLE users DROP COLUMN display_name');
  voncms_clear_display_name_cache();
  cacheCheck(
    !voncms_has_display_name_column($pdo),
    'invalidation detects a restored legacy schema',
  );
  $before = $pdo->probes;
  cacheCheck(
    !voncms_has_display_name_column($pdo) && $pdo->probes === $before,
    'a successful absent-column probe is cacheable too',
  );
  $pdo->exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100)');
  $saved = json_decode((string) file_get_contents($cache), true, 512, JSON_THROW_ON_ERROR);
  $saved['checked_at'] = time() - 300;
  file_put_contents($cache, json_encode($saved, JSON_THROW_ON_ERROR));
  cacheCheck(
    voncms_has_display_name_column($pdo) && $pdo->probes === $before + 1,
    'five-minute expiry refreshes a changed schema',
  );

  foreach (['broken', 'wrong-type', 'future', 'foreign-context'] as $fault) {
    $saved = json_decode((string) file_get_contents($cache), true, 512, JSON_THROW_ON_ERROR);
    if ($fault === 'wrong-type') {
      $saved['display_name'] = 'true';
    }
    if ($fault === 'future') {
      $saved['checked_at'] = time() + 600;
    }
    if ($fault === 'foreign-context') {
      $saved['context'] = str_repeat('0', 64);
    }
    file_put_contents(
      $cache,
      $fault === 'broken' ? '{broken' : json_encode($saved, JSON_THROW_ON_ERROR),
    );
    $before = $pdo->probes;
    cacheCheck(
      voncms_has_display_name_column($pdo) && $pdo->probes === $before + 1,
      "{$fault} cache falls back to the live probe",
    );
  }

  foreach (['config', 'code', 'capability-marker'] as $change) {
    $before = $pdo->probes;
    if ($change === 'config') {
      file_put_contents($fixture . '/von_config.php', '<?php // disposable fixture B');
    }
    if ($change === 'code') {
      file_put_contents(
        $fixture . '/api/publication_time_helper.php',
        "\n// simulated deployed update\n",
        FILE_APPEND,
      );
    }
    if ($change === 'capability-marker') {
      file_put_contents($fixture . '/data/schema-capabilities.json', '{"version":1}');
    }
    cacheCheck(
      voncms_has_display_name_column($pdo) && $pdo->probes === $before + 1,
      "changed {$change} rejects the old decision",
    );
  }

  voncms_clear_display_name_cache();
  $pdo->failProbe = true;
  cacheCheck(
    !voncms_has_display_name_column($pdo) && !is_file($cache),
    'query exceptions are never cached as absent columns',
  );
  $pdo->failProbe = false;
  $pdo->falseProbe = true;
  cacheCheck(
    !voncms_has_display_name_column($pdo) && !is_file($cache),
    'a false query result is not cached',
  );
  $pdo->falseProbe = false;
  cacheCheck(voncms_has_display_name_column($pdo), 'a later healthy probe recovers immediately');

  voncms_clear_display_name_cache();
  unlink($cache . '.lock');
  mkdir($cache . '.lock');
  cacheCheck(
    voncms_has_display_name_column($pdo) && !is_file($cache),
    'unavailable lock storage preserves the live positive result',
  );
  rmdir($cache . '.lock');
  mkdir($cache);
  cacheCheck(
    voncms_has_display_name_column($pdo) && glob($cache . '.*.tmp') === [],
    'failed cache activation preserves the live result and removes temporary files',
  );
  rmdir($cache);
  $gate = fopen($cache . '.lock', 'c');
  flock($gate, LOCK_EX);
  cacheCheck(
    voncms_has_display_name_column($pdo) && !is_file($cache),
    'a busy cache gate does not block public reads or persist an unguarded probe',
  );
  flock($gate, LOCK_UN);
  fclose($gate);

  cacheCheck(
    voncms_has_display_name_column($pdo),
    'cache recovers after storage becomes available',
  );
  $cacheBytes = file_get_contents($cache);
  $other = new SchemaReadProbePdo('sqlite::memory:');
  $other->exec('CREATE TABLE users(id INTEGER PRIMARY KEY)');
  cacheCheck(
    !voncms_has_display_name_column($other) && file_get_contents($cache) === $cacheBytes,
    'an unrelated connection cannot reuse or replace installation metadata',
  );

  voncms_mark_publication_columns_ready();
  cacheCheck(
    !is_file($cache) && voncms_has_display_name_column($pdo),
    'install and Repair marker regeneration invalidate presentation metadata',
  );
  voncms_clear_publication_capability_marker();
  cacheCheck(
    !is_file($cache) && !is_file($fixture . '/data/schema-capabilities.json'),
    'destructive restore clears both capability and presentation decisions',
  );
  unlink($fixture . '/von_config.php');
  $before = $pdo->probes;
  cacheCheck(
    voncms_has_display_name_column($pdo) && !is_file($cache) && $pdo->probes === $before + 1,
    'missing configuration retains the original live-only behavior',
  );
  echo "PASS {$checks} focused schema-read cache checks (" .
    ($mysql ? 'MySQL' : 'SQLite metadata adapter') .
    ")\n";
} finally {
  if (
    $createdDatabase &&
    $admin instanceof PDO &&
    preg_match('/^voncms_qa_schema_read_[a-f0-9]{16}$/', $database)
  ) {
    $admin->exec("DROP DATABASE `{$database}`");
  }
  $resolved = realpath($fixture);
  $temporaryRoot = realpath(sys_get_temp_dir());
  if (
    $resolved !== false &&
    $temporaryRoot !== false &&
    dirname($resolved) === $temporaryRoot &&
    preg_match('/^voncms-schema-read-[a-f0-9]{16}$/', basename($resolved))
  ) {
    removeCacheFixture($resolved);
  }
}
