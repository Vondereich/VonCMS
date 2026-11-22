<?php
// Explicit loopback, newly owned random schema only. Never reads von_config.php.
if (PHP_SAPI !== 'cli') {
  exit(1);
}
define('VONCMS_CORE_LOADED', true);
$root = dirname(__DIR__, 3);
require_once $root . '/public/api/activity/ActivityLog.php';
require_once $root . '/public/api/schema_repair_helper.php';
$dsn =
  (string) (getenv('VONCMS_TEST_MYSQL_DSN') ?: 'mysql:host=127.0.0.1;port=3306;charset=utf8mb4');
$worker = ($argv[1] ?? '') === '--worker';
$pattern = $worker
  ? '/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4;dbname=voncms_activity_qa_[a-f0-9]{12}$/D'
  : '/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/D';
if (!preg_match($pattern, $dsn)) {
  throw new RuntimeException('Activity MySQL requires an explicit loopback disposable schema');
}
$connect = static fn(string $value): PDO => new PDO(
  $value,
  (string) (getenv('VONCMS_TEST_MYSQL_USER') ?: 'root'),
  (string) getenv('VONCMS_TEST_MYSQL_PASSWORD'),
  [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_TIMEOUT => 3,
  ],
);
date_default_timezone_set('Asia/Kuala_Lumpur');
if ($worker) {
  $pdo = $connect($dsn);
  $pdo->exec('SET innodb_lock_wait_timeout=3');
  $service = new VonCmsActivityLog($pdo);
  $ready = $argv[5] ?? '';
  if (
    dirname(dirname($ready)) !== sys_get_temp_dir() ||
    !preg_match('/^voncms-activity-race-[a-f0-9]{12}$/D', basename(dirname($ready))) ||
    !preg_match('/^[01]\.ready$/D', basename($ready))
  ) {
    throw new RuntimeException('Invalid owned barrier path');
  }
  file_put_contents($ready, 'ready');
  echo "READY\n";
  flush();
  $result = $service->purge(
    ['id' => '1', 'username' => 'QA', 'role' => 'admin'],
    $argv[2],
    (int) $argv[3],
    $argv[4],
  );
  echo json_encode($result);
  exit();
}
$checks = 0;
$created = false;
$processes = [];
$raceDirectory = sys_get_temp_dir() . '/voncms-activity-race-' . bin2hex(random_bytes(6));
mkdir($raceDirectory, 0700);
$name = 'voncms_activity_qa_' . bin2hex(random_bytes(6));
$admin = $connect($dsn);
function mysqlActivityCheck(bool $ok, string $reason): void
{
  global $checks;
  if (!$ok) {
    throw new RuntimeException($reason);
  }
  $checks++;
}
try {
  $admin->exec('CREATE DATABASE `' . $name . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  $created = true;
  $fixtureDsn = $dsn . ';dbname=' . $name;
  $pdo = $connect($fixtureDsn);
  $sql = file_get_contents($root . '/public/install.sql');
  $sql = preg_replace('/^\s*(?:CREATE DATABASE[^;]*;|USE\s+[^;]*;)/mi', '', $sql, -1, $removed);
  mysqlActivityCheck($removed === 2, 'Fresh SQL must not escape the owned schema');
  $pdo->exec($sql);
  mysqlActivityCheck(
    voncms_schema_missing_capability($pdo, 'staff_activity_log') === [],
    'Fresh install lacks Activity capability',
  );
  $pdo->exec('DROP TABLE staff_activity_log');
  mysqlActivityCheck(
    voncms_schema_missing_capability($pdo, 'staff_activity_log') !== [],
    'Missing Activity capability was not detected',
  );
  voncms_schema_repair_runtime_capabilities($pdo);
  mysqlActivityCheck(
    voncms_schema_missing_capability($pdo, 'staff_activity_log') === [],
    'Repair did not create Activity storage',
  );
  $pdo->exec('ALTER TABLE staff_activity_log DROP COLUMN details_json');
  mysqlActivityCheck(
    voncms_schema_missing_capability($pdo, 'staff_activity_log') !== [],
    'Partial Activity structure not detected',
  );
  voncms_schema_repair_runtime_capabilities($pdo);
  mysqlActivityCheck(
    voncms_schema_missing_capability($pdo, 'staff_activity_log') === [],
    'Repair did not restore optional metadata column',
  );
  // Deliberately differ DB and CMS clocks; local midnight must filter/order the same instant.
  $pdo->exec("SET time_zone='+00:00'");
  $instant = strtotime('2026-11-01 00:20:00');
  $local = date('Y-m-d H:i:s', $instant);
  $utc = gmdate('Y-m-d H:i:s', $instant);
  $stmt = $pdo->prepare(
    "INSERT INTO content_audit_logs(content_type,content_id,action,actor_username,actor_role,summary,created_at) VALUES ('post',?,'delete','Deleted writer','writer','Article snapshot',?)",
  );
  for ($i = 1; $i <= 35; $i++) {
    $stmt->execute([$i, $utc]);
  }
  $settingId = (int) $pdo
    ->query("SELECT id FROM settings WHERE setting_group='general' AND setting_key='site_name'")
    ->fetchColumn();
  $stmt = $pdo->prepare(
    "INSERT INTO settings_audit_log(setting_id,setting_group,setting_key,changed_at,change_type,old_value,new_value)VALUES (?,'general','site_name',?,'UPDATE','private-canary','private-canary')",
  );
  $stmt->execute([$settingId, $utc]);
  $stmt = $pdo->prepare(
    "INSERT INTO calendar_event_audit(event_id,action,actor_id,actor_name,event_version,created_at) VALUES (1,'delete',8,'Calendar actor',1,?)",
  );
  $stmt->execute([$local]);
  $service = new VonCmsActivityLog($pdo);
  $query = ['from' => '2026-11-01', 'to' => '2026-11-01'];
  $page = $service->listing($query);
  $seen = [];
  do {
    foreach ($page['logs'] as $row) {
      mysqlActivityCheck(
        $row['at'] === $local,
        'DB/CMS timestamps did not normalize to configured timezone',
      );
      mysqlActivityCheck(!in_array($row['key'], $seen, true), 'MySQL cursor duplicated a record');
      $seen[] = $row['key'];
    }
    mysqlActivityCheck(
      !str_contains(json_encode($page), 'private-canary'),
      'Settings values leaked',
    );
    $cursor = $page['nextCursor'];
    if ($cursor !== null) {
      $page = $service->listing($query + ['cursor' => $cursor]);
    }
  } while ($cursor !== null);
  mysqlActivityCheck(count($seen) === 37, 'MySQL date boundary/pagination lost a record');
  $old = date('Y-m-d H:i:s', time() - 92 * 86400);
  $seed = $pdo->prepare(
    "INSERT INTO staff_activity_log(action,actor_username,actor_role,target_type,target_id,target_label,outcome,created_at) VALUES('delete','Owner','admin','media','old','old.webp','success',?)",
  );
  for ($i = 0; $i < 505; $i++) {
    $seed->execute([$old]);
  }
  $preview = $service->preview();
  $key = hash('sha256', 'concurrent-owned-request');
  // Hold eligible rows so both real PHP workers reach the same purge lock before release.
  $pdo->beginTransaction();
  $pdo->query('SELECT id FROM staff_activity_log ORDER BY id LIMIT 1 FOR UPDATE')->fetchColumn();
  for ($i = 0; $i < 2; $i++) {
    $process = proc_open(
      [
        PHP_BINARY,
        __FILE__,
        '--worker',
        $preview['before'],
        (string) $preview['maxId'],
        $key,
        $raceDirectory . '/' . $i . '.ready',
      ],
      [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
      null,
      ['VONCMS_TEST_MYSQL_DSN' => $fixtureDsn] + getenv(),
    );
    if (!is_resource($process)) {
      throw new RuntimeException('Could not start owned MySQL worker');
    }
    $processes[] = [$process, $pipes, ''];
  }
  $deadline = microtime(true) + 8;
  do {
    $ready =
      (int) is_file($raceDirectory . '/0.ready') + (int) is_file($raceDirectory . '/1.ready');
    if ($ready === 2) {
      break;
    }
    usleep(10000);
  } while (microtime(true) < $deadline);
  mysqlActivityCheck($ready === 2, 'Concurrent workers did not reach purge');
  $pdo->commit();
  foreach ($processes as $process) {
    stream_set_blocking($process[1][1], true);
    $out = $process[2] . stream_get_contents($process[1][1]);
    $err = stream_get_contents($process[1][2]);
    fclose($process[1][1]);
    fclose($process[1][2]);
    $exit = proc_close($process[0]);
    $result = json_decode(substr($out, strpos($out, "\n") + 1), true);
    mysqlActivityCheck(
      $exit === 0 && ($result['removed'] ?? null) === 500,
      'Concurrent purge/retry failed: ' .
        json_encode(['exit' => $exit, 'out' => $out, 'err' => $err]),
    );
  }
  $processes = [];
  mysqlActivityCheck(
    $service->preview()['eligible'] === 5,
    'Concurrent retry removed a second batch',
  );
  mysqlActivityCheck(
    (int) $pdo
      ->query("SELECT COUNT(*) FROM staff_activity_log WHERE action='purge'")
      ->fetchColumn() === 1,
    'Duplicate purge receipt',
  );
  mysqlActivityCheck(
    (int) $pdo->query('SELECT COUNT(*) FROM content_audit_logs')->fetchColumn() === 35,
    'Purge touched original history',
  );
  $pdo->exec(
    "CREATE TRIGGER fail_activity_receipt BEFORE INSERT ON staff_activity_log FOR EACH ROW BEGIN IF NEW.action='purge' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA receipt failure'; END IF; END",
  );
  try {
    $service->purge(
      ['id' => 1],
      $preview['before'],
      $preview['maxId'],
      hash('sha256', 'receipt-failure'),
    );
    mysqlActivityCheck(false, 'Failed receipt did not abort purge');
  } catch (PDOException $expected) {
    mysqlActivityCheck(
      $service->preview()['eligible'] === 5 && !$pdo->inTransaction(),
      'MySQL receipt failure did not roll back',
    );
  }
  $pdo->exec(
    "INSERT INTO users(id,username,email,password,role) VALUES(1,'owner-at-save','qa@example.invalid','not-a-password','Admin')",
  );
  $_SESSION['user'] = ['id' => '1', 'username' => 'owner-at-save', 'role' => 'Admin'];
  $beforeSnapshot = voncms_get_setting_audit_snapshot($pdo, 'general', 'site_name');
  voncms_record_setting_audit(
    $pdo,
    'general',
    'site_name',
    $beforeSnapshot,
    'secret-value-canary',
    1,
  );
  $actorRows = $service->listing(['type' => 'settings', 'role' => 'admin'])['logs'];
  mysqlActivityCheck(
    count($actorRows) === 1 && $actorRows[0]['actorUsername'] === 'owner-at-save',
    'MySQL Settings actor snapshot not recorded/projected',
  );
  mysqlActivityCheck(
    !str_contains(json_encode($actorRows), 'secret-value-canary'),
    'MySQL Settings values leaked',
  );
  $pdo->exec("UPDATE users SET username='renamed',role='Member' WHERE id=1");
  $pdo->exec('DELETE FROM users WHERE id=1');
  $actorRows = $service->listing(['type' => 'settings', 'role' => 'admin'])['logs'];
  mysqlActivityCheck(
    count($actorRows) === 1 &&
      $actorRows[0]['actorUsername'] === 'owner-at-save' &&
      $actorRows[0]['actorRole'] === 'admin',
    'MySQL account change/deletion rewrote the Settings actor snapshot',
  );
  mysqlActivityCheck(
    $actorRows[0]['actorId'] === '',
    'Settings legacy foreign-key deletion semantics changed',
  );
  $_SESSION = [];
} finally {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  foreach ($processes as $process) {
    if (is_resource($process[0])) {
      proc_terminate($process[0]);
      foreach ($process[1] as $pipe) {
        if (is_resource($pipe)) {
          fclose($pipe);
        }
      }
      proc_close($process[0]);
    }
  }
  unset($service, $stmt, $seed);
  $pdo = null;
  if ($created && preg_match('/^voncms_activity_qa_[a-f0-9]{12}$/D', $name)) {
    $admin->exec('DROP DATABASE `' . $name . '`');
  }
  foreach (['0.ready', '1.ready'] as $file) {
    if (is_file($raceDirectory . '/' . $file)) {
      unlink($raceDirectory . '/' . $file);
    }
  }
  rmdir($raceDirectory);
}
echo "PASS Activity MySQL: $checks checks; fresh SQL, missing/partial Repair, different DB/CMS clocks, midnight filters, native cursor statements, two-process purge/retry and receipt rollback. Owned schema removed.\n";
