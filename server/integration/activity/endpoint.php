<?php
// Real controller, SessionManager, CSRF and service. Only HTTP body transport is injected for CLI.
if (PHP_SAPI !== 'cli') {
  exit(1);
}
$root = dirname(__DIR__, 3);
$directory = sys_get_temp_dir() . '/voncms-activity-endpoint-' . bin2hex(random_bytes(6));
mkdir($directory, 0700, true);
$checks = 0;
function endpointCheck(bool $ok, string $reason): void
{
  global $checks;
  if (!$ok) {
    throw new RuntimeException($reason);
  }
  $checks++;
}
function removeActivityFixture(string $path): void
{
  foreach (new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS) as $item) {
    if ($item->isDir() && !$item->isLink()) {
      removeActivityFixture($item->getPathname());
      rmdir($item->getPathname());
    } else {
      unlink($item->getPathname());
    }
  }
}
try {
  foreach (
    [
      'security.php',
      'core/DataBoundary.php',
      'core/InstallBootstrap.php',
      'core/ContentViewDeduplicator.php',
      'core/RateLimiter.php',
      'core/ResponseHelper.php',
      'scheduler_helper.php',
      'media_variants.php',
      'api/delete_media.php',
      'api/media_library_filter_helper.php',
      'api/role_capability_helper.php',
      'api/cron_publish.php',
      'api/public_cache_helper.php',
      'api/publication_time_helper.php',
      'api/activity/index.php',
      'api/activity/ActivityLog.php',
      'api/settings_audit_helper.php',
    ]
    as $file
  ) {
    if (!is_dir(dirname($directory . '/' . $file))) {
      mkdir(dirname($directory . '/' . $file), 0700, true);
    }
    copy($root . '/public/' . $file, $directory . '/' . $file);
  }
  mkdir($directory . '/sessions', 0700);
  mkdir($directory . '/uploads', 0700);
  $db = new PDO('sqlite:' . $directory . '/fixture.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  $db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY,role TEXT,password TEXT)');
  $db->exec(
    "INSERT INTO users VALUES (1,'Admin','qa-hash'),(2,'Admin','qa-hash'),(3,'Writer','qa-hash'),(4,'Moderator','qa-hash'),(5,'Member','qa-hash'),(9,'root','qa-hash')",
  );
  $db->exec('CREATE TABLE settings (setting_group TEXT,setting_key TEXT,setting_value TEXT)');
  $db->exec("INSERT INTO settings VALUES ('general','time_zone','Asia/Kuala_Lumpur')");
  $db->exec(
    'CREATE TABLE posts (id INTEGER PRIMARY KEY,status TEXT,scheduled_at TEXT,updated_at TEXT)',
  );
  $db->exec("INSERT INTO posts VALUES (1,'scheduled','2020-01-01 00:00:00',NULL)");
  $db->exec('CREATE TABLE media (id INTEGER PRIMARY KEY,filepath TEXT)');
  $db->exec(
    'CREATE TABLE staff_activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,actor_user_id INTEGER,actor_username TEXT NOT NULL,actor_role TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,target_label TEXT NOT NULL,outcome TEXT NOT NULL,details_json TEXT,request_key TEXT UNIQUE,created_at TEXT NOT NULL)',
  );
  $old = date('Y-m-d H:i:s', time() - 92 * 86400);
  $seed = $db->prepare(
    "INSERT INTO staff_activity_log (action,actor_username,actor_role,target_type,target_id,target_label,outcome,details_json,created_at) VALUES ('delete','Owner','admin','media','photo.webp','photo.webp','success','{}',?)",
  );
  for ($i = 0; $i < 505; $i++) {
    $seed->execute([$old]);
  }
  file_put_contents(
    $directory . '/driver.php',
    <<<'PHP'
    <?php
    $fixture=json_decode(getenv('VON_ACTIVITY_FIXTURE'),true);
    ini_set('session.save_path',__DIR__.'/sessions');
    $_SERVER['SCRIPT_NAME']=($fixture['base']??'').'/api/activity/index.php';
    $_SERVER['PHP_SELF']=$_SERVER['SCRIPT_NAME'];
    $_SERVER['SCRIPT_FILENAME']=__DIR__.'/api/activity/index.php';
    $_SERVER['REQUEST_METHOD']=$fixture['method']??'GET';
    $_SERVER['HTTP_HOST']='qa.example.invalid';
    $_SERVER['HTTP_USER_AGENT']='VonCMS Activity QA';
    if (isset($fixture['configuredKey'])) define('CRON_KEY',$fixture['configuredKey']);
    if (isset($fixture['providedKey'])) $_SERVER['HTTP_X_CRON_KEY']=$fixture['providedKey'];
    $_SERVER['CONTENT_TYPE']='application/json';
    // Only MySQL SHOW TABLES and SELECT rowCount dialect are adapted; actual DELETE/INSERT remain SQL.
    class ActivityMediaStatement extends PDOStatement {
      public function rowCount():int {return str_starts_with($this->queryString,'SELECT name FROM sqlite_master')?1:parent::rowCount();}
    }
    class ActivityMediaPDO extends PDO {
      public function query(string $query,?int $fetchMode=null,mixed ...$args):PDOStatement|false {
        if($query==="SHOW TABLES LIKE 'media'"){
          if(!empty($GLOBALS['fixture']['failMediaDb']))throw new PDOException('Controlled media DB failure');
          $query="SELECT name FROM sqlite_master WHERE type='table' AND name='media'";
        }
        return $fetchMode===null?parent::query($query):parent::query($query,$fetchMode,...$args);
      }
    }
    $pdo=new ActivityMediaPDO('sqlite:'.__DIR__.'/fixture.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS,[ActivityMediaStatement::class]);
    require __DIR__.'/security.php';
    $_SESSION=$fixture['session']??[];
    if (!empty($fixture['role'])) {
      $id=(string)($fixture['id']??1);$role=$fixture['role'];
      $_SESSION['user']=['id'=>$id,'role'=>$role,'username'=>'Owner QA'];
      $_SESSION['auth_fingerprint']=hash('sha256',$id."\0".strtolower($role)."\0qa-hash");
      $_SESSION['auth_started_at']=time();$_SESSION['last_activity']=time();
    }
    $_SESSION['csrf_token']='qa-csrf-token';
    if (($fixture['csrf']??true)===true) $_SERVER['HTTP_X_CSRF_TOKEN']='qa-csrf-token';
    $_GET=$fixture['query']??[];
    $body=new ReflectionProperty(CSRFProtection::class,'cachedInput');$body->setValue(null,json_encode($fixture['body']??[]));
    register_shutdown_function(function()use($pdo){
      $remaining=(int)$pdo->query('SELECT COUNT(*) FROM staff_activity_log')->fetchColumn();
      $published=(int)$pdo->query("SELECT COUNT(*) FROM posts WHERE status='published'")->fetchColumn();
      echo "\n".json_encode(['status'=>http_response_code()?:200,'session'=>$_SESSION,'remaining'=>$remaining,'published'=>$published]);
    });
    require __DIR__.'/api/'.($fixture['endpoint']??'activity/index.php');
    PHP
    ,
  );
  $call = static function (array $input) use ($directory): array {
    $process = proc_open(
      [PHP_BINARY, $directory . '/driver.php'],
      [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
      $directory,
      ['VON_ACTIVITY_FIXTURE' => json_encode($input)] + getenv(),
    );
    if (!is_resource($process)) {
      throw new RuntimeException('Cannot run Activity endpoint fixture');
    }
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    endpointCheck($exit === 0, 'Endpoint fixture crashed: ' . $err);
    $parts = explode("\n", trim($out));
    $state = json_decode(array_pop($parts), true);
    $response = json_decode(implode("\n", $parts), true);
    endpointCheck(is_array($state) && is_array($response), 'Endpoint did not return JSON: ' . $out);
    return ['state' => $state, 'body' => $response];
  };
  foreach ([1, 2] as $id) {
    $db->exec("UPDATE posts SET status='scheduled'");
    $r = $call(['endpoint' => 'cron_publish.php', 'role' => 'Admin', 'id' => $id]);
    endpointCheck(
      $r['state']['status'] === 200 && $r['state']['published'] === 1,
      'Manual publish fallback broken',
    );
    endpointCheck($r['state']['remaining'] === 505, 'Manual publishing must not purge Activity');
  }
  foreach ([1, 2] as $id) {
    foreach (['', 'wrong', '0'] as $providedKey) {
      $db->exec("UPDATE posts SET status='scheduled'");
      $r = $call([
        'endpoint' => 'cron_publish.php',
        'role' => 'Admin',
        'id' => $id,
        'configuredKey' => '0',
        'providedKey' => $providedKey,
      ]);
      endpointCheck(
        $r['state']['status'] === 200 &&
          $r['state']['published'] === 1 &&
          $r['state']['remaining'] === 505,
        'Falsey cron configuration must remain manual-publish-only',
      );
    }
  }
  foreach (['', 'wrong'] as $providedKey) {
    $db->exec("UPDATE posts SET status='scheduled'");
    $r = $call([
      'endpoint' => 'cron_publish.php',
      'configuredKey' => 'qa-cron-key',
      'providedKey' => $providedKey,
    ]);
    endpointCheck(
      $r['state']['status'] === 401 &&
        $r['state']['published'] === 0 &&
        $r['state']['remaining'] === 505,
      'Invalid cron key mutated publishing/activity',
    );
  }
  $r = $call([
    'endpoint' => 'cron_publish.php',
    'configuredKey' => 'qa-cron-key',
    'providedKey' => 'qa-cron-key',
  ]);
  endpointCheck(
    $r['state']['status'] === 200 &&
      $r['state']['published'] === 1 &&
      $r['state']['remaining'] === 6,
    'Authorized cron did not bound its purge',
  );
  $db->exec('DELETE FROM staff_activity_log');
  for ($i = 0; $i < 505; $i++) {
    $seed->execute([$old]);
  }
  foreach (['', '/zangetsu'] as $base) {
    foreach (
      [
        ['', 0, 401],
        ['Writer', 3, 403],
        ['Moderator', 4, 403],
        ['Member', 5, 403],
        ['Admin', 2, 403],
        ['root', 9, 200],
        ['Admin', 1, 200],
      ]
      as [$role, $id, $status]
    ) {
      foreach (['GET', 'POST'] as $method) {
        $r = $call(compact('base', 'role', 'id', 'method') + ['body' => ['action' => 'preview']]);
        endpointCheck(
          $r['state']['status'] === $status,
          "Wrong Activity role result: $role/$id/$method/$base",
        );
        endpointCheck(
          $r['state']['remaining'] === 505,
          'List/preview/denied request mutated history',
        );
      }
    }
  }
  $owner = ['role' => 'Admin', 'id' => 1, 'method' => 'POST'];
  $r = $call($owner + ['csrf' => false, 'body' => ['action' => 'preview']]);
  endpointCheck($r['state']['status'] === 403, 'Missing CSRF accepted');
  $r = $call(['role' => 'Admin', 'id' => 1, 'method' => 'DELETE']);
  endpointCheck($r['state']['status'] === 405, 'Unsupported method accepted');
  $r = $call($owner + ['body' => ['action' => ['purge']]]);
  endpointCheck($r['state']['status'] === 400, 'Compound action not rejected');
  $r = $call($owner + ['body' => ['action' => 'purge', 'token' => ['bad']]]);
  endpointCheck($r['state']['status'] === 409, 'Compound/missing preview accepted');
  $r = $call(
    $owner + ['body' => ['action' => 'preview', 'before' => '2099-01-01', 'maxId' => PHP_INT_MAX]],
  );
  endpointCheck(
    $r['body']['eligible'] === 505 && $r['body']['batchSize'] === 500,
    'Server-owned preview incorrect',
  );
  $session = $r['state']['session'];
  $token = $r['body']['token'];
  $expired = $session;
  $expired['activity_purge_preview']['expires'] = time() - 1;
  $r = $call($owner + ['session' => $expired, 'body' => ['action' => 'purge', 'token' => $token]]);
  endpointCheck(
    $r['state']['status'] === 409 && $r['state']['remaining'] === 505,
    'Expired preview mutated history',
  );
  $r = $call($owner + ['session' => $session, 'body' => ['action' => 'purge', 'token' => $token]]);
  endpointCheck(
    $r['state']['status'] === 200 &&
      $r['body']['removed'] === 500 &&
      $r['state']['remaining'] === 6,
    'Confirmed purge incorrect',
  );
  $r = $call($owner + ['session' => $session, 'body' => ['action' => 'purge', 'token' => $token]]);
  endpointCheck(
    $r['body']['removed'] === 500 && $r['state']['remaining'] === 6,
    'Purge retry deleted a second batch',
  );
  $mediaOwner = $owner + ['endpoint' => 'delete_media.php'];
  file_put_contents($directory . '/uploads/photo.webp', 'owned QA bytes');
  $db->exec("INSERT INTO media VALUES(1,'uploads/photo.webp')");
  $r = $call([
    'role' => 'Writer',
    'id' => 3,
    'method' => 'POST',
    'endpoint' => 'delete_media.php',
    'body' => ['path' => 'photo.webp'],
  ]);
  endpointCheck(
    $r['state']['status'] === 403 && is_file($directory . '/uploads/photo.webp'),
    'Denied media action changed files',
  );
  $r = $call($mediaOwner + ['body' => ['path' => 'photo.webp']]);
  endpointCheck(
    $r['state']['status'] === 200 && !file_exists($directory . '/uploads/photo.webp'),
    'Media delete did not retain normal success',
  );
  $event = $db
    ->query("SELECT * FROM staff_activity_log WHERE target_type='media' ORDER BY id DESC LIMIT 1")
    ->fetch(PDO::FETCH_ASSOC);
  endpointCheck(
    $event['outcome'] === 'success' &&
      $event['actor_username'] === 'Owner QA' &&
      json_decode($event['details_json'], true)['database_deleted'] === true,
    'Successful media deletion was not recorded accurately',
  );
  mkdir($directory . '/uploads/directory.webp');
  $r = $call($mediaOwner + ['body' => ['path' => 'directory.webp']]);
  $event = $db
    ->query('SELECT outcome FROM staff_activity_log ORDER BY id DESC LIMIT 1')
    ->fetchColumn();
  endpointCheck(
    $r['state']['status'] === 500 && $event === 'failed',
    'Filesystem failure reported success',
  );
  file_put_contents($directory . '/uploads/dbfail.webp', 'owned QA bytes');
  $r = $call($mediaOwner + ['failMediaDb' => true, 'body' => ['path' => 'dbfail.webp']]);
  $event = $db
    ->query('SELECT outcome FROM staff_activity_log ORDER BY id DESC LIMIT 1')
    ->fetchColumn();
  endpointCheck(
    $r['state']['status'] === 500 &&
      !file_exists($directory . '/uploads/dbfail.webp') &&
      $event === 'partial',
    'Partial filesystem/DB failure recorded inaccurately',
  );
  $db->exec(
    "CREATE TRIGGER fail_media_event BEFORE INSERT ON staff_activity_log WHEN NEW.target_type='media' BEGIN SELECT RAISE(ABORT,'QA media audit unavailable'); END",
  );
  file_put_contents($directory . '/uploads/auditfail.webp', 'owned QA bytes');
  $r = $call($mediaOwner + ['body' => ['path' => 'auditfail.webp']]);
  endpointCheck(
    $r['state']['status'] === 200 && !file_exists($directory . '/uploads/auditfail.webp'),
    'Best-effort audit failure broke ordinary media deletion',
  );
  $db->exec('DROP TRIGGER fail_media_event');
  $remaining = (int) $db->query('SELECT COUNT(*) FROM staff_activity_log')->fetchColumn();
  // Current database role beats an old, correctly formed session fingerprint.
  $db->exec("UPDATE users SET role='Member' WHERE id=9");
  $r = $call(['role' => 'root', 'id' => 9]);
  endpointCheck($r['state']['status'] === 401, 'Demoted Root retained Activity access');
  $db->exec('DELETE FROM users WHERE id=1');
  $r = $call($owner + ['session' => $session, 'body' => ['action' => 'purge', 'token' => $token]]);
  endpointCheck(
    $r['state']['status'] === 401 && $r['state']['remaining'] === $remaining,
    'Deleted owner retained purge access',
  );
} finally {
  unset($seed);
  $db = null;
  if (
    dirname($directory) === sys_get_temp_dir() &&
    preg_match('/^voncms-activity-endpoint-[a-f0-9]{12}$/D', basename($directory))
  ) {
    removeActivityFixture($directory);
    rmdir($directory);
  }
}
echo "PASS Activity endpoint: $checks checks; real SessionManager/CSRF, root/subfolder role denial, revoked identity, preview/expiry, idempotent purge and cron isolation; CLI body transport only.\n";
