<?php
// Actual Activity service, disposable SQLite only. No installed site or configuration.
define('VONCMS_CORE_LOADED', true);
$root = dirname(__DIR__, 3);
require_once $root . '/public/core/DataBoundary.php';
require_once $root . '/public/api/activity/ActivityLog.php';
require_once $root . '/public/api/settings_audit_helper.php';
$checks = 0;
function activityCheck(bool $ok, string $message): void
{
  global $checks;
  if (!$ok) {
    throw new RuntimeException($message);
  }
  $checks++;
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY,username TEXT,role TEXT)');
$pdo->exec("INSERT INTO users VALUES (1,'owner','admin'),(7,'writer','writer')");
$pdo->exec(
  'CREATE TABLE content_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,content_type TEXT,content_id INTEGER,action TEXT,actor_user_id INTEGER,actor_username TEXT,actor_role TEXT,summary TEXT,context_json TEXT,created_at TEXT)',
);
$pdo->exec(
  'CREATE TABLE settings_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,setting_group TEXT,setting_key TEXT,changed_by INTEGER,change_type TEXT,changed_at TEXT,old_value TEXT,new_value TEXT)',
);
$pdo->exec(
  'CREATE TABLE calendar_event_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id INTEGER,action TEXT,actor_id INTEGER,actor_name TEXT,created_at TEXT)',
);
$pdo->exec(
  'CREATE TABLE staff_activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,actor_user_id INTEGER,actor_username TEXT NOT NULL,actor_role TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,target_label TEXT NOT NULL,outcome TEXT NOT NULL,details_json TEXT,request_key TEXT UNIQUE,created_at TEXT NOT NULL)',
);
$stamp = date('Y-m-d H:i:s', time() - 3600);
$insert = $pdo->prepare(
  'INSERT INTO content_audit_logs (content_type,content_id,action,actor_user_id,actor_username,actor_role,summary,context_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
);
for ($i = 1; $i <= 45; $i++) {
  $insert->execute([
    'post',
    $i,
    $i % 2 ? 'update' : 'delete',
    7,
    'writer-before-rename',
    'writer',
    'Post changed',
    json_encode(['title' => 'Deleted article ' . $i, 'api_key' => 'must-never-project']),
    $stamp,
  ]);
}
for ($i = 0; $i < 12; $i++) {
  $pdo
    ->prepare(
      'INSERT INTO settings_audit_log (setting_group,setting_key,changed_by,change_type,changed_at,old_value,new_value) VALUES (?,?,?,?,?,?,?)',
    )
    ->execute([
      'general',
      'site_name',
      1,
      'UPDATE',
      $stamp,
      'must-never-project',
      'must-never-project',
    ]);
  $pdo
    ->prepare(
      'INSERT INTO calendar_event_audit (event_id,action,actor_id,actor_name,created_at) VALUES (?,?,?,?,?)',
    )
    ->execute([100 + $i, 'delete', 7, 'calendar-author-snapshot', $stamp]);
}
$service = new VonCmsActivityLog($pdo);
$actor = ['id' => '1', 'username' => 'owner', 'role' => 'admin'];
activityCheck(
  $service->recordMedia($actor, '2026/photo.webp', 'success', [
    'file_deleted' => true,
    'raw_payload' => 'must-never-project',
  ]),
  'Media event not recorded',
);
$first = $service->listing([]);
activityCheck(count($first['logs']) === 20 && $first['hasMore'], 'Page must contain 20 records');
activityCheck(!str_contains(json_encode($first), 'must-never-project'), 'Private payload leaked');
foreach (['2026-99-99 25:99:99', "2026-01-01 00:00:00\0"] as $invalidTime) {
  $invalidCursor = json_decode(base64_decode($first['nextCursor']), true);
  $invalidCursor['after'][0] = $invalidTime;
  try {
    $service->listing(['cursor' => base64_encode(json_encode($invalidCursor))]);
    activityCheck(false, 'Invalid cursor timestamp accepted');
  } catch (InvalidArgumentException $expected) {
    activityCheck(true, 'Invalid timestamp refused');
  }
}
$seen = array_column($first['logs'], 'key');
$service->recordMedia($actor, '2026/new-concurrent.webp', 'success', []);
$cursor = $first['nextCursor'];
while ($cursor !== null) {
  $page = $service->listing(['cursor' => $cursor]);
  activityCheck(count($page['logs']) <= 20, 'Page limit exceeded');
  foreach ($page['logs'] as $row) {
    activityCheck(!in_array($row['key'], $seen, true), 'Pagination duplicated an event');
    activityCheck($row['targetLabel'] !== 'new-concurrent.webp', 'Concurrent event broke snapshot');
    $seen[] = $row['key'];
  }
  $cursor = $page['nextCursor'];
}
activityCheck(count($seen) === 70, 'Merged history lost or fabricated records');
activityCheck(count($service->listing(['type' => 'media'])['logs']) === 2, 'Media filter broken');
$writer = $service->listing(['actor' => '7', 'role' => 'writer']);
activityCheck(count($writer['logs']) === 20, 'Actor/role filters broken');
activityCheck(
  $writer['logs'][0]['actorUsername'] === 'writer-before-rename',
  'Actor snapshot replaced',
);
activityCheck(
  str_starts_with($writer['logs'][0]['targetLabel'], 'Deleted article'),
  'Deleted target snapshot lost',
);
$pdo->exec('DELETE FROM users WHERE id=7');
activityCheck(
  count($service->listing(['actor' => '7', 'role' => 'writer'])['logs']) === 20,
  'Deleted actor erased history',
);
foreach (
  [
    ['actor' => '1 OR 1=1'],
    ['role' => ['admin']],
    ['from' => '2026-02-30'],
    ['from' => "2026-01-\0001"],
    ['type' => 'secrets'],
    ['cursor' => 'invalid'],
    ['event' => 'delete;DROP'],
  ]
  as $bad
) {
  try {
    $service->listing($bad);
    activityCheck(false, 'Invalid filter accepted');
  } catch (InvalidArgumentException $expected) {
    activityCheck(true, 'Invalid filter refused');
  }
}
$old = date('Y-m-d H:i:s', time() - 91 * 86400);
$insertOld = $pdo->prepare(
  "INSERT INTO staff_activity_log (action,actor_user_id,actor_username,actor_role,target_type,target_id,target_label,outcome,details_json,created_at) VALUES ('delete',1,'owner','admin','media','old','old.webp','success','{}',?)",
);
for ($i = 0; $i < 505; $i++) {
  $insertOld->execute([$old]);
}
$beforeLegacy = (int) $pdo->query('SELECT COUNT(*) FROM content_audit_logs')->fetchColumn();
$preview = $service->preview();
activityCheck($preview['eligible'] === 505, 'Preview count wrong');
$requestKey = hash('sha256', 'owned-purge-request');
$result = $service->purge($actor, $preview['before'], $preview['maxId'], $requestKey);
activityCheck($result['removed'] === 500, 'Purge batch must be capped at 500');
activityCheck(
  $service->purge($actor, $preview['before'], $preview['maxId'], $requestKey) === $result,
  'Retry repeated deletion',
);
activityCheck($service->preview()['eligible'] === 5, 'Purge removed fresh/unpreviewed rows');
activityCheck(
  (int) $pdo->query('SELECT COUNT(*) FROM content_audit_logs')->fetchColumn() === $beforeLegacy,
  'Purge touched shared history',
);
activityCheck(
  (int) $pdo
    ->query("SELECT COUNT(*) FROM staff_activity_log WHERE action='purge'")
    ->fetchColumn() === 1,
  'Purge receipt missing/duplicated',
);
$pdo->exec(
  "CREATE TRIGGER fail_activity_receipt BEFORE INSERT ON staff_activity_log WHEN NEW.action='purge' BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END",
);
try {
  $service->purge($actor, $preview['before'], $preview['maxId'], hash('sha256', 'failed-purge'));
  activityCheck(false, 'Receipt failure hidden');
} catch (PDOException $expected) {
  activityCheck($service->preview()['eligible'] === 5, 'Purge rollback failed');
}
activityCheck(!$pdo->inTransaction(), 'Transaction leaked');
$identityFixture = static function (bool $snapshots) use ($pdo): PDO {
  $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY,username TEXT,role TEXT)');
  $db->exec("INSERT INTO users VALUES (1,'owner','admin'),(7,'other','admin')");
  $db->exec(
    'CREATE TABLE settings (id INTEGER PRIMARY KEY,setting_group TEXT,setting_key TEXT,setting_value TEXT)',
  );
  $db->exec("INSERT INTO settings VALUES (1,'general','site_name','before')");
  $db->exec(
    'CREATE TABLE settings_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,setting_id INTEGER,setting_group TEXT,setting_key TEXT,old_value TEXT,new_value TEXT,changed_by INTEGER,change_type TEXT,ip_address TEXT,user_agent TEXT,changed_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  if ($snapshots) {
    $db->exec("ALTER TABLE settings_audit_log ADD COLUMN actor_username TEXT NOT NULL DEFAULT ''");
    $db->exec("ALTER TABLE settings_audit_log ADD COLUMN actor_role TEXT NOT NULL DEFAULT ''");
  }
  $db->exec(
    (string) $pdo
      ->query("SELECT sql FROM sqlite_master WHERE name='staff_activity_log'")
      ->fetchColumn(),
  );
  return $db;
};
$_SESSION['user'] = ['id' => '1', 'username' => 'owner-at-save', 'role' => 'Admin'];
$legacyDb = $identityFixture(false);
voncms_record_setting_audit(
  $legacyDb,
  'general',
  'site_name',
  ['id' => 1, 'setting_value' => 'before'],
  'after',
  1,
);
$legacyLog = (new VonCmsActivityLog($legacyDb))->listing(['type' => 'settings'])['logs'];
activityCheck(count($legacyLog) === 1, 'Unrepaired Settings history write/read failed');
activityCheck(
  $legacyLog[0]['actorUsername'] === '' && $legacyLog[0]['actorRole'] === '',
  'Legacy identity was fabricated from current users',
);

$partialDb = $identityFixture(false);
$partialDb->exec(
  "ALTER TABLE settings_audit_log ADD COLUMN actor_username TEXT NOT NULL DEFAULT ''",
);
voncms_record_setting_audit(
  $partialDb,
  'general',
  'site_name',
  ['id' => 1, 'setting_value' => 'before'],
  'after',
  1,
);
$partialLog = (new VonCmsActivityLog($partialDb))->listing(['type' => 'settings'])['logs'];
activityCheck(
  count($partialLog) === 1 &&
    $partialLog[0]['actorUsername'] === '' &&
    $partialLog[0]['actorRole'] === '',
  'Partial schema broke the ID-only history fallback',
);

$identityDb = $identityFixture(true);
// A legacy row stays unrecorded even when its actor account still exists.
$identityDb->exec(
  "INSERT INTO settings_audit_log(setting_id,setting_group,setting_key,changed_by,change_type) VALUES (1,'general','site_name',1,'UPDATE')",
);
voncms_record_setting_audit(
  $identityDb,
  'general',
  'site_name',
  ['id' => 1, 'setting_value' => 'before'],
  'secret-value-canary',
  1,
);
$identityService = new VonCmsActivityLog($identityDb);
$recorded = $identityService->listing(['type' => 'settings', 'role' => 'admin'])['logs'];
activityCheck(
  count($recorded) === 1 &&
    $recorded[0]['actorUsername'] === 'owner-at-save' &&
    $recorded[0]['actorRole'] === 'admin',
  'New Settings event did not capture/filter its authenticated actor snapshot',
);
activityCheck(
  !str_contains(json_encode($recorded), 'secret-value-canary'),
  'Settings values leaked with actor snapshot',
);
$identityDb->exec("UPDATE users SET username='renamed',role='member' WHERE id=1");
$_SESSION['user'] = ['id' => '1', 'username' => 'renamed', 'role' => 'member'];
$identityDb->exec('DELETE FROM users WHERE id=1');
activityCheck(
  $identityService->listing(['type' => 'settings', 'role' => 'admin'])['logs'] === $recorded,
  'Rename/demotion/deletion rewrote recorded Settings identity',
);
$unrecorded = $identityService->listing(['type' => 'settings', 'role' => 'unrecorded'])['logs'];
activityCheck(
  count($unrecorded) === 1 && $unrecorded[0]['actorUsername'] === '',
  'Legacy row was backfilled',
);
voncms_record_setting_audit(
  $identityDb,
  'general',
  'site_name',
  ['id' => 1, 'setting_value' => 'before'],
  'after',
  7,
);
$mismatched = $identityService->listing(['type' => 'settings', 'actor' => '7'])['logs'];
activityCheck(
  count($mismatched) === 1 &&
    $mismatched[0]['actorUsername'] === '' &&
    $mismatched[0]['actorRole'] === '',
  'Session identity was assigned to a different actor ID',
);
$beforeCount = (int) $identityDb->query('SELECT COUNT(*) FROM settings_audit_log')->fetchColumn();
voncms_record_setting_audit(
  $identityDb,
  'general',
  'site_name',
  ['id' => 1, 'setting_value' => 'same'],
  'same',
  1,
);
voncms_record_setting_audit(
  $identityDb,
  'api',
  'key',
  ['id' => 1, 'setting_value' => 'before'],
  'secret',
  1,
);
activityCheck(
  (int) $identityDb->query('SELECT COUNT(*) FROM settings_audit_log')->fetchColumn() ===
    $beforeCount,
  'No-op or sensitive Settings began producing history',
);
$_SESSION = [];

echo 'PASS Staff Activity Log: ' .
  $checks .
  " checks; actual service/SQLite, bounded pagination, snapshots, filters, secret exclusion and purge rollback/retry. No installed data.\n";
