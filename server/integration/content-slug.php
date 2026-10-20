<?php
/** No site configuration: SQLite fixtures by default, explicit disposable MySQL mode below. */
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
$root = dirname(__DIR__, 2);
require_once __DIR__ . '/sqlite-compat.php';
require_once $root . '/public/api/content_slug_helper.php';
require_once $root . '/public/api/role_capability_helper.php';

final class SlugFixturePDO extends VonCmsFixtureSqlitePDO
{
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    return parent::prepare(str_replace(' FOR UPDATE', '', $query), $options);
  }
}
final class SlugRejection extends RuntimeException {}
final class ResponseHelper
{
  public static function sendError($error, int $status = 500): never
  {
    throw new SlugRejection((string) $error, $status);
  }
}
function slugGuardSource(string $file, string $needle): string
{
  $source = str_replace("\r\n", "\n", file_get_contents($file));
  $start = strpos($source, $needle);
  if ($start === false) {
    throw new RuntimeException('Missing actual slug guard');
  }
  $depth = 0;
  $opened = false;
  $result = '';
  foreach (array_slice(token_get_all('<?php ' . substr($source, $start)), 1) as $token) {
    $result .= is_array($token) ? $token[1] : $token;
    if ($token === '{') {
      $opened = true;
      $depth++;
    } elseif ($token === '}' && --$depth === 0 && $opened) {
      return $result;
    }
  }
  throw new RuntimeException('Incomplete actual slug guard');
}
$postGuard = slugGuardSource(
  $root . '/public/api/save_post.php',
  "  if (\n    (!\$statusOnlyTransition || in_array(\$status, ['published', 'scheduled'], true))",
);
$pageGuard = slugGuardSource(
  $root . '/public/api/save_page.php',
  'if (voncms_content_slug_conflicts(',
);

// Optional real-server proof. Never reads application configuration or uses an existing schema.
// Set VONCMS_TEST_MYSQL_DSN=mysql:host=127.0.0.1;port=PORT;charset=utf8mb4 and run --mysql.
if (in_array($argv[1] ?? '', ['--mysql', '--mysql-worker'], true)) {
  $dsn = (string) getenv('VONCMS_TEST_MYSQL_DSN');
  $worker = ($argv[1] ?? '') === '--mysql-worker';
  $pattern = $worker
    ? '/^mysql:host=127\.0\.0\.1;port=\d+;dbname=voncms_slug_qa_[a-f0-9]{12};charset=utf8mb4$/'
    : '/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/';
  if (!preg_match($pattern, $dsn)) {
    throw new RuntimeException('Set VONCMS_TEST_MYSQL_DSN to an explicit loopback fixture server');
  }
  $connect = static fn(string $value): PDO => new PDO(
    $value,
    (string) (getenv('VONCMS_TEST_MYSQL_USER') ?: 'root'),
    (string) getenv('VONCMS_TEST_MYSQL_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false],
  );
  if ($worker) {
    $pdo = $db = $connect($dsn);
    [$mode, $type, $slug, $hold, $action] = array_slice($argv, 2);
    $table = $type === 'post' ? 'posts' : 'pages';
    $contentSlugLock = null;
    $started = microtime(true);
    echo "attempt\n";
    flush();
    try {
      $insert = $pdo->prepare("INSERT INTO {$table} (slug, status) VALUES (?, 'published')");
      if ($mode === 'import') {
        voncms_insert_with_slug_reservation($pdo, $type, $slug, $insert, [$slug]);
      } else {
        $contentSlugLock = VonCmsContentSlugLock::acquire($pdo);
        $pdo->beginTransaction();
        if ($hold === 'hold') {
          echo "locked\n";
          flush();
          stream_set_timeout(STDIN, 12);
          if (trim((string) fgets(STDIN)) !== 'go') {
            throw new RuntimeException('Fixture release signal missing');
          }
        }
        $input = ['slug' => $slug];
        $statusOnlyTransition = false;
        $status = 'published';
        eval($type === 'post' ? $postGuard : $pageGuard);
        $insert->execute([$slug]);
        if ($action === 'fail') {
          throw new RuntimeException('Controlled save failure');
        }
        $action === 'rollback' ? $pdo->rollBack() : $pdo->commit();
      }
      $result = ['status' => 200, 'action' => $action];
    } catch (Throwable $error) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      $result = [
        'status' =>
          $error instanceof SlugRejection || $error->getCode() === 409
            ? 409
            : (str_contains($error->getMessage(), 'busy')
              ? 503
              : 500),
      ];
    } finally {
      $contentSlugLock?->release();
    }
    $result['elapsed'] = microtime(true) - $started;
    echo json_encode($result, JSON_THROW_ON_ERROR) . "\n";
    exit();
  }

  $server = $connect($dsn);
  $schema = 'voncms_slug_qa_' . bin2hex(random_bytes(6));
  $children = [];
  $start = static function (array $arguments) use (&$children): array {
    $process = proc_open(
      [PHP_BINARY, __FILE__, '--mysql-worker', ...$arguments],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    if (!is_resource($process)) {
      throw new RuntimeException('Could not start isolated MySQL worker');
    }
    stream_set_timeout($pipes[1], 12);
    $children[] = [$process, $pipes];
    if (trim((string) fgets($pipes[1])) !== 'attempt') {
      throw new RuntimeException('MySQL worker did not start');
    }
    return [$process, $pipes];
  };
  $finish = static function (array $child): array {
    [$process, $pipes] = $child;
    fclose($pipes[0]);
    $result = json_decode((string) fgets($pipes[1]), true, 512, JSON_THROW_ON_ERROR);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0 || trim($errors) !== '') {
      throw new RuntimeException('MySQL worker failed: ' . $errors);
    }
    return $result;
  };
  $cases = [
    ['post', 'save', 'page', 'commit', 409, 'same'],
    ['page', 'save', 'post', 'commit', 409, 'same'],
    ['post', 'import', 'page', 'commit', 409, 'same'],
    ['page', 'import', 'post', 'commit', 409, 'same'],
    ['post', 'save', 'page', 'commit', 200, 'numeric'],
    ['post', 'save', 'page', 'rollback', 200, 'same'],
    ['post', 'save', 'page', 'fail', 200, 'same'],
    ['post', 'save', 'page', 'timeout', 503, 'same'],
  ];
  try {
    $server->exec("CREATE DATABASE `{$schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $fixtureDsn = str_replace(';charset=', ";dbname={$schema};charset=", $dsn);
    putenv('VONCMS_TEST_MYSQL_DSN=' . $fixtureDsn);
    $fixture = $connect($fixtureDsn);
    foreach (['posts', 'pages'] as $table) {
      $fixture->exec(
        "CREATE TABLE {$table} (id BIGINT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(255) NOT NULL UNIQUE, status VARCHAR(32) NOT NULL) ENGINE=InnoDB",
      );
    }
    foreach ($cases as $index => [$ownerType, $mode, $waiterType, $action, $expected, $kind]) {
      $ownerSlug = $kind === 'numeric' ? '0001' : 'race-' . $index;
      $waiterSlug = $kind === 'numeric' ? '1' : $ownerSlug;
      $holder = $start(['save', $ownerType, $ownerSlug, 'hold', $action]);
      if (trim((string) fgets($holder[1][1])) !== 'locked') {
        throw new RuntimeException('Holder did not acquire real database lock');
      }
      $waiter = $start([$mode, $waiterType, $waiterSlug, 'wait', 'commit']);
      $read = [$waiter[1][1]];
      $write = $except = null;
      if (stream_select($read, $write, $except, 0, 200000) !== 0) {
        throw new RuntimeException('Competing connection bypassed held database lock');
      }
      if ($action === 'timeout') {
        $waiterResult = $finish($waiter);
        if ($waiterResult['elapsed'] < 2.5 || $waiterResult['elapsed'] > 8) {
          throw new RuntimeException('Real MySQL lock timeout is not bounded');
        }
      }
      fwrite($holder[1][0], "go\n");
      fflush($holder[1][0]);
      $holderResult = $finish($holder);
      if ($action !== 'timeout') {
        $waiterResult = $finish($waiter);
      }
      $children = [];
      if (
        $holderResult['status'] !== ($action === 'fail' ? 500 : 200) ||
        $waiterResult['status'] !== $expected
      ) {
        throw new RuntimeException('Unexpected concurrent save result in case ' . $index);
      }
      $ownerTable = $ownerType === 'post' ? 'posts' : 'pages';
      $waiterTable = $waiterType === 'post' ? 'posts' : 'pages';
      foreach (
        [
          [$ownerTable, $ownerSlug, !in_array($action, ['rollback', 'fail'], true)],
          [$waiterTable, $waiterSlug, $expected === 200],
        ]
        as [$table, $slug, $exists]
      ) {
        $check = $fixture->prepare("SELECT COUNT(*) FROM {$table} WHERE slug = ?");
        $check->execute([$slug]);
        if ((int) $check->fetchColumn() !== (int) $exists) {
          throw new RuntimeException('Unexpected persisted rows in case ' . $index);
        }
      }
    }
    echo 'PASS ' .
      count($cases) .
      ' real MySQL ' .
      $server->getAttribute(PDO::ATTR_SERVER_VERSION) .
      " two-process slug cases: Post/Page, import, numeric text, rollback, failure and timeout\n";
  } finally {
    foreach ($children as [$process, $pipes]) {
      if (is_resource($process)) {
        proc_terminate($process);
        foreach ($pipes as $pipe) {
          if (is_resource($pipe)) {
            fclose($pipe);
          }
        }
        proc_close($process);
      }
    }
    $server->exec("DROP DATABASE IF EXISTS `{$schema}`");
    putenv('VONCMS_TEST_MYSQL_DSN=' . $dsn);
  }
  exit();
}

$pdo = new SlugFixturePDO('sqlite::memory:', null, null, [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$db = $pdo;
foreach (['posts', 'pages'] as $table) {
  $pdo->exec("CREATE TABLE {$table} (id INTEGER PRIMARY KEY, slug TEXT, status TEXT)");
  $statement = $pdo->prepare("INSERT INTO {$table} VALUES (?, ?, ?)");
  foreach (['published', 'draft', 'scheduled', 'archived'] as $id => $status) {
    $statement->execute([$id + 1, $table . '-' . $status, $status]);
  }
  $statement->execute([10, '0001', 'published']);
  $statement->execute([11, '1', 'published']);
}
$checks = 0;
foreach (['post' => $postGuard, 'page' => $pageGuard] as $type => $guard) {
  $otherTable = $type === 'post' ? 'pages' : 'posts';
  foreach (['published', 'draft', 'scheduled', 'archived'] as $status) {
    $input = ['slug' => $otherTable . '-' . $status];
    $statusOnlyTransition = false;
    $status = 'published';
    $contentSlugLock = VonCmsContentSlugLock::acquire($pdo);
    $pdo->beginTransaction();
    try {
      eval($guard);
      throw new RuntimeException('Cross-type slug was accepted');
    } catch (SlugRejection $error) {
      if ($error->getCode() !== 409 || $pdo->inTransaction()) {
        throw new RuntimeException('Conflict must reject with rollback');
      }
      $checks++;
    }
  }
  foreach (['fresh', $type === 'post' ? 'posts-published' : 'pages-published', '00001'] as $slug) {
    $input = ['slug' => $slug];
    $contentSlugLock = VonCmsContentSlugLock::acquire($pdo);
    $pdo->beginTransaction();
    eval($guard);
    if (!$pdo->inTransaction()) {
      throw new RuntimeException('Unrelated/same-type guard must not reject');
    }
    $pdo->rollBack();
    $contentSlugLock->release();
    $checks++;
  }
}
$statusOnlyTransition = true;
$status = 'archived';
$input = ['slug' => 'pages-published'];
$contentSlugLock = VonCmsContentSlugLock::acquire($pdo);
$pdo->beginTransaction();
eval($postGuard);
$pdo->rollBack();
$contentSlugLock->release();
$checks++;
foreach (['publish', 'schedule'] as $action) {
  $workflow = voncms_resolve_post_workflow('admin', 'pending_review', $action, true, false);
  if (!$workflow['allowed']) {
    throw new RuntimeException('Fixture must exercise an allowed real review transition');
  }
  $status = $workflow['status'];
  $statusOnlyTransition = $workflow['status_only'];
  $input = ['slug' => 'pages-published'];
  $contentSlugLock = VonCmsContentSlugLock::acquire($pdo);
  $pdo->beginTransaction();
  try {
    eval($postGuard);
    throw new RuntimeException('Review publication bypassed cross-type reservation');
  } catch (SlugRejection $error) {
    if ($error->getCode() !== 409) {
      throw $error;
    }
    $checks++;
  }
}
foreach (['post' => 'posts', 'page' => 'pages'] as $type => $table) {
  $otherTable = $type === 'post' ? 'pages' : 'posts';
  $insert = $pdo->prepare("INSERT INTO {$table} (slug, status) VALUES (?, ?)");
  try {
    voncms_insert_with_slug_reservation($pdo, $type, $otherTable . '-published', $insert, [
      $otherTable . '-published',
      'published',
    ]);
    throw new LogicException('Import bypassed cross-type reservation');
  } catch (RuntimeException $error) {
    if ($error->getCode() !== 409) {
      throw $error;
    }
    $checks++;
  }
  try {
    voncms_insert_with_slug_reservation($pdo, $type, $table . '-published', $insert, [
      $table . '-published',
      'published',
    ]);
    throw new LogicException('Import accepted a same-type slug that appeared during localization');
  } catch (PDOException $error) {
    if ((string) $error->getCode() !== '23000') {
      throw $error;
    }
    $checks++;
  }
  $pdo->beginTransaction();
  voncms_insert_with_slug_reservation($pdo, $type, 'fresh-import', $insert, [
    'fresh-import',
    'published',
  ]);
  if (!voncms_content_slug_conflicts($pdo, $type === 'post' ? 'page' : 'post', 'fresh-import')) {
    throw new RuntimeException('Conflict-free import was not inserted');
  }
  $pdo->rollBack();
  $checks++;
}
if (
  !voncms_content_slug_conflicts($pdo, 'post', '0001') ||
  voncms_content_slug_conflicts($pdo, 'post', '00001')
) {
  throw new RuntimeException('Numeric-looking slugs must be bound as exact text');
}
$checks++;

// Exercise the real named-lock SQL branch with controlled SQL functions, not a MySQL server.
final class SlugNamedLockPDO extends VonCmsFixtureSqlitePDO
{
  public function getAttribute(int $attribute): mixed
  {
    return $attribute === PDO::ATTR_DRIVER_NAME ? 'mysql' : parent::getAttribute($attribute);
  }
}
$lockPdo = new SlugNamedLockPDO('sqlite::memory:');
$lockCalls = [];
$lockPdo->createFunction('DATABASE', fn() => 'isolated-fixture');
$lockPdo->createFunction(
  'GET_LOCK',
  function ($name, $timeout) use (&$lockCalls) {
    $lockCalls[] = ['acquire', $name, $timeout];
    return 1;
  },
  2,
);
$lockPdo->createFunction(
  'RELEASE_LOCK',
  function ($name) use (&$lockCalls) {
    $lockCalls[] = ['release', $name];
    return 1;
  },
  1,
);
$lock = VonCmsContentSlugLock::acquire($lockPdo);
$lock->release();
$lock->release();
unset($lock);
if (
  count($lockCalls) !== 2 ||
  (int) $lockCalls[0][2] !== 3 ||
  $lockCalls[0][1] !== $lockCalls[1][1]
) {
  throw new RuntimeException('Named lock must be bounded, shared and released exactly once');
}
$checks++;
$lockPdo->createFunction('GET_LOCK', fn() => 0, 2);
try {
  VonCmsContentSlugLock::acquire($lockPdo);
  throw new LogicException('Unavailable reservation must not permit a save');
} catch (RuntimeException $error) {
  if (!str_contains($error->getMessage(), 'busy')) {
    throw $error;
  }
  $checks++;
}
foreach (['posts', 'pages'] as $table) {
  if ((int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn() !== 6) {
    throw new RuntimeException('Slug checks changed existing records');
  }
  $checks++;
}
echo "PASS {$checks} cross-content slug/lock checks (isolated SQLite and controlled lock SQL)\n";
