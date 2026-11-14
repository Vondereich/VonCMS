<?php
/** Real credential helpers/controllers, dummy keys, owned SQLite/MySQL databases only. */
$root = dirname(__DIR__, 2);
$temporary = sys_get_temp_dir() . '/voncms-personal-ai-' . bin2hex(random_bytes(8));
if (!mkdir($temporary, 0700)) {
  throw new RuntimeException('Cannot create credential fixture.');
}
define('VONCMS_CREDENTIAL_KEY_FILE', $temporary . '/credential_master.key.php');
require_once $root . '/public/api/ai_provider_helper.php';
$checks = 0;
function personalCheck(bool $condition, string $message): void
{
  global $checks;
  $checks++;
  if (!$condition) {
    throw new RuntimeException($message);
  }
}
function personalReject(callable $operation, int $status, string $message): void
{
  try {
    $operation();
  } catch (Throwable $e) {
    personalCheck($status === 0 || $e->getCode() === $status, $message . ': wrong status');
    return;
  }
  personalCheck(false, $message);
}
function personalCleanup(string $path): void
{
  foreach (scandir($path) as $name) {
    if ($name === '.' || $name === '..') {
      continue;
    }
    $child = $path . '/' . $name;
    if (is_dir($child) && !is_link($child)) {
      personalCleanup($child);
    } else {
      unlink($child);
    }
  }
  rmdir($path);
}
function personalRequest(
  string $directory,
  string $id,
  string $role,
  string $method = 'GET',
  array $body = [],
  array $query = [],
  bool $csrf = true,
  string $endpoint = 'account.php',
  bool $providerFailure = false,
): array {
  $script =
    '$GLOBALS["QA_ID"]=' .
    var_export($id, true) .
    ';$GLOBALS["QA_ROLE"]=' .
    var_export($role, true) .
    ';$GLOBALS["QA_BODY"]=' .
    var_export(json_encode($body), true) .
    ';$GLOBALS["QA_CSRF"]=' .
    ($csrf ? 'true' : 'false') .
    ';$GLOBALS["QA_PROVIDER_FAILURE"]=' .
    ($providerFailure ? 'true' : 'false') .
    ';$_GET=' .
    var_export($query, true) .
    ';$_SERVER["REQUEST_METHOD"]=' .
    var_export($method, true) .
    ';register_shutdown_function(static function(){echo "\nCALLS=".json_encode($GLOBALS["QA_PROVIDER_CALLS"]??[])."\nSTATUS=".(http_response_code()?:200);});require ' .
    var_export($directory . '/api/' . $endpoint, true) .
    ';';
  $process = proc_open(
    [PHP_BINARY, '-d', 'opcache.enable_cli=0', '-r', $script],
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
  );
  fclose($pipes[0]);
  $out = stream_get_contents($pipes[1]);
  fclose($pipes[1]);
  $err = stream_get_contents($pipes[2]);
  fclose($pipes[2]);
  personalCheck(proc_close($process) === 0, 'Account controller crashed: ' . $err);
  $parts = explode("\nSTATUS=", $out);
  $result = explode("\nCALLS=", $parts[0]);
  $body = json_decode($result[0], true);
  personalCheck(is_array($body) && isset($parts[1]), 'Account response is not structured JSON.');
  return [
    'status' => (int) $parts[1],
    'body' => $body,
    'raw' => $out,
    'calls' => json_decode($result[1] ?? '[]', true),
  ];
}
$mysql = ($argv[1] ?? '') === '--mysql';
$admin = null;
$database = '';
try {
  if ($mysql) {
    $dsn = getenv('VONCMS_TEST_MYSQL_DSN') ?: '';
    if (!str_starts_with($dsn, 'mysql:') || preg_match('/(?:^|;)dbname=/i', $dsn)) {
      throw new RuntimeException('Use a database-free explicit QA MySQL DSN.');
    }
    $admin = new PDO(
      $dsn,
      getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
      getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
    $database = 'voncms_personal_ai_' . bin2hex(random_bytes(8));
    $admin->exec('CREATE DATABASE `' . $database . '` CHARACTER SET utf8mb4');
    $pdo = new PDO(
      $dsn . ';dbname=' . $database,
      getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
      getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
  } else {
    $pdo = new PDO('sqlite:' . $temporary . '/fixture.sqlite', null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
  }
  $pdo->exec(
    'CREATE TABLE settings(setting_group VARCHAR(32),setting_key VARCHAR(32),setting_value TEXT,is_public INT DEFAULT 0,updated_by INT,version INT DEFAULT 1,updated_at DATETIME,PRIMARY KEY(setting_group,setting_key))',
  );
  $pdo->exec(
    'CREATE TABLE users(id INT PRIMARY KEY,username VARCHAR(100),display_name VARCHAR(100),email VARCHAR(150),role VARCHAR(32),avatar TEXT,bio TEXT,created_at DATETIME)',
  );
  if ($mysql) {
    require_once $root . '/public/api/schema_repair_helper.php';
    $pdo->exec(voncms_schema_runtime_table_sql()['user_ai_keys']);
  } else {
    $pdo->exec(
      'CREATE TABLE user_ai_keys(id INTEGER PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider VARCHAR(32) NOT NULL,encrypted_key TEXT NOT NULL,saved_at DATETIME NOT NULL,expires_at DATETIME,UNIQUE(user_id,provider))',
    );
  }
  if (!$mysql) {
    $pdo->exec('PRAGMA foreign_keys=ON');
    $pdo->sqliteCreateFunction('NOW', static fn() => gmdate('Y-m-d H:i:s'));
  }
  $pdo
    ->prepare('INSERT INTO settings(setting_group,setting_key,setting_value) VALUES(?,?,?)')
    ->execute(['api', 'config', '{}']);
  $roles = [
    '1' => 'Admin',
    '2' => 'Admin',
    '3' => 'Moderator',
    '4' => 'Writer',
    '5' => 'Member',
    '6' => 'Root',
  ];
  foreach ($roles as $id => $role) {
    $pdo
      ->prepare('INSERT INTO users(id,username,display_name,email,role) VALUES(?,?,?,?,?)')
      ->execute([$id, 'fixture-' . $id, 'R&D ' . $id, 'qa-' . $id . '@example.invalid', $role]);
  }
  // Eligibility comes from fresh database roles, not the browser or old session claims.
  personalReject(
    fn() => voncms_ai_save_personal($pdo, '5', 'save', 'qa-member', '', false),
    403,
    'Member wrote a personal key.',
  );
  personalCheck(!file_exists(VONCMS_CREDENTIAL_KEY_FILE), 'Denied save created master.');
  foreach (['1', '2', '3', '4', '6'] as $id) {
    $status = voncms_ai_save_personal($pdo, $id, 'save', 'qa-key-' . $id, '', true);
    personalCheck(
      $status['state'] === 'encrypted' &&
        $status['configured'] &&
        strlen($status['revision']) === 64,
      'Eligible actor could not save own encrypted key.',
    );
    $row = voncms_ai_personal_row($pdo, $id);
    personalCheck(
      !str_contains($row['encrypted_key'], 'qa-key-') &&
        voncms_ai_personal_plaintext($row, $id) === 'qa-key-' . $id,
      'Personal key not encrypted/recoverable.',
    );
    $resolved = voncms_ai_resolve_request($pdo, 'gemini-3.8-flash', 'qa-explicit-override', $id);
    personalCheck(
      !$resolved['shared'] && $resolved['api_key'] === 'qa-key-' . $id && !$pdo->inTransaction(),
      'Personal key priority or transaction release failed.',
    );
    personalReject(
      fn() => voncms_ai_save_personal($pdo, $id, 'save', 'qa-stale', '', false),
      409,
      'Stale replacement accepted.',
    );
    personalReject(
      fn() => VonCmsCredentialStore::decrypt(
        $row['encrypted_key'],
        voncms_ai_personal_context($id) . 'other',
      ),
      0,
      'Wrong user/provider context decrypted.',
    );
  }
  $global = [
    'aiApiKey' => VonCmsCredentialStore::encrypt('qa-shared-key', 'voncms:global-gemini:v1'),
    'aiModel' => 'gemini-3.6-flash',
  ];
  $writeGlobal = static fn(array $config) => $pdo
    ->prepare(
      "UPDATE settings SET setting_value=? WHERE setting_group='api' AND setting_key='config'",
    )
    ->execute([json_encode($config)]);
  $writeGlobal($global);
  $writer = voncms_ai_personal_row($pdo, '4');
  $baseline = $writer['encrypted_key'];
  foreach (
    [
      ['expires_at', '2001-01-01 00:00:00', 400],
      ['encrypted_key', 'corrupt', 503],
      ['encrypted_key', voncms_ai_personal_row($pdo, '3')['encrypted_key'], 0],
    ]
    as [$field, $value, $code]
  ) {
    $pdo->prepare('UPDATE user_ai_keys SET ' . $field . '=? WHERE user_id=4')->execute([$value]);
    personalReject(
      fn() => voncms_ai_resolve_request($pdo, null, '', '4'),
      $code,
      'Invalid personal key fell back to shared.',
    );
    personalCheck(!$pdo->inTransaction(), 'Failed selection left a transaction open.');
    $pdo
      ->prepare('UPDATE user_ai_keys SET encrypted_key=?,expires_at=NULL WHERE user_id=4')
      ->execute([$baseline]);
  }
  personalReject(
    fn() => voncms_ai_personal_plaintext(
      ['encrypted_key' => $baseline, 'expires_at' => 'not-a-date'],
      '4',
    ),
    503,
    'Malformed expiry was usable.',
  );
  foreach (['', str_repeat('a', 513), '********', 'voncms:secret:v2:fake', "qa\nkey"] as $bad) {
    personalReject(
      fn() => voncms_ai_save_personal($pdo, '4', 'save', $bad, hash('sha256', $baseline), false),
      0,
      'Invalid key saved.',
    );
  }
  $master = file_get_contents(VONCMS_CREDENTIAL_KEY_FILE);
  unlink(VONCMS_CREDENTIAL_KEY_FILE);
  personalReject(
    fn() => voncms_ai_save_personal(
      $pdo,
      '4',
      'save',
      'qa-replace',
      hash('sha256', $baseline),
      false,
    ),
    0,
    'Missing master regenerated despite persisted keys.',
  );
  personalReject(
    fn() => voncms_ai_resolve_request($pdo, null, '', '4'),
    0,
    'Missing personal master fell back to shared.',
  );
  personalCheck(
    !file_exists(VONCMS_CREDENTIAL_KEY_FILE),
    'Read or failed replacement created a master.',
  );
  file_put_contents(VONCMS_CREDENTIAL_KEY_FILE, $master);
  $replaced = voncms_ai_save_personal(
    $pdo,
    '4',
    'save',
    'qa-replacement',
    hash('sha256', $baseline),
    false,
  );
  personalCheck(
    $replaced['expiresAt'] === '' && $replaced['revision'] !== hash('sha256', $baseline),
    'Replace/expiry reset failed.',
  );
  $removed = voncms_ai_save_personal($pdo, '4', 'remove', '', $replaced['revision'], false);
  personalCheck(
    !$removed['configured'] &&
      voncms_ai_resolve_request($pdo, null, '', '4')['api_key'] === 'qa-shared-key',
    'Explicit removal did not restore shared fallback.',
  );
  $writer = voncms_ai_save_personal($pdo, '4', 'save', 'qa-writer-after-remove', '', false);
  // Rotation must include expired/demoted rows and preserve unrelated configuration/expiry.
  $pdo->exec("UPDATE users SET role='Member' WHERE id=3");
  $pdo->exec("UPDATE user_ai_keys SET expires_at='2000-01-01 00:00:00' WHERE user_id=3");
  $beforeRows = $pdo->query('SELECT * FROM user_ai_keys ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
  for ($round = 0; $round < 6; $round++) {
    $config = voncms_ai_load_config($pdo);
    $projection = voncms_ai_rotate_global_key($pdo, hash('sha256', $config['aiApiKey']), '1');
    personalCheck($projection['aiKeyStorage'] === 'encrypted', 'Batch rotation failed.');
    foreach (
      $pdo->query('SELECT * FROM user_ai_keys ORDER BY id')->fetchAll(PDO::FETCH_ASSOC)
      as $row
    ) {
      $expected =
        (string) $row['user_id'] === '4' ? 'qa-writer-after-remove' : 'qa-key-' . $row['user_id'];
      personalCheck(
        VonCmsCredentialStore::decrypt(
          $row['encrypted_key'],
          voncms_ai_personal_context((string) $row['user_id']),
        ) === $expected,
        'Rotation lost a personal key.',
      );
      $before = array_values(
        array_filter($beforeRows, static fn($candidate) => $candidate['id'] === $row['id']),
      )[0];
      personalCheck(
        $before['saved_at'] === $row['saved_at'] && $before['expires_at'] === $row['expires_at'],
        'Rotation renewed expiry.',
      );
    }
    $ring = json_decode(
      explode("VONCMS_CREDENTIAL_KEY_V2\n", file_get_contents(VONCMS_CREDENTIAL_KEY_FILE), 2)[1],
      true,
    );
    personalCheck(count($ring['keys']) <= 3, 'Unbounded rotation history.');
  }
  $beforeFailureConfig = voncms_ai_load_config($pdo);
  $beforeFailureRows = $pdo
    ->query('SELECT * FROM user_ai_keys ORDER BY id')
    ->fetchAll(PDO::FETCH_ASSOC);
  $pdo->exec(
    $mysql
      ? "CREATE TRIGGER reject_personal_rotation BEFORE UPDATE ON user_ai_keys FOR EACH ROW BEGIN IF OLD.user_id=3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Controlled personal rotation failure'; END IF; END"
      : "CREATE TRIGGER reject_personal_rotation BEFORE UPDATE OF encrypted_key ON user_ai_keys WHEN OLD.user_id=3 BEGIN SELECT RAISE(ABORT,'Controlled personal rotation failure'); END",
  );
  try {
    personalReject(
      fn() => voncms_ai_rotate_global_key(
        $pdo,
        hash('sha256', $beforeFailureConfig['aiApiKey']),
        '1',
      ),
      503,
      'Partial batch failure was reported successful.',
    );
    personalCheck(
      voncms_ai_load_config($pdo) === $beforeFailureConfig &&
        $pdo->query('SELECT * FROM user_ai_keys ORDER BY id')->fetchAll(PDO::FETCH_ASSOC) ===
          $beforeFailureRows,
      'Failed batch committed only some credential updates.',
    );
    foreach ($beforeFailureRows as $row) {
      personalCheck(
        VonCmsCredentialStore::decrypt(
          $row['encrypted_key'],
          voncms_ai_personal_context((string) $row['user_id']),
        ) !== '',
        'Failed transaction stranded old ciphertext.',
      );
    }
  } finally {
    $pdo->exec('DROP TRIGGER reject_personal_rotation');
  }
  // Failed transitions plus new saves must not gradually orphan an old generation.
  for ($round = 0; $round < 6; $round++) {
    $records = [];
    foreach ($pdo->query('SELECT * FROM user_ai_keys')->fetchAll(PDO::FETCH_ASSOC) as $row) {
      $records[(string) $row['user_id']] = [
        'stored' => $row['encrypted_key'],
        'context' => voncms_ai_personal_context((string) $row['user_id']),
      ];
    }
    $config = voncms_ai_load_config($pdo);
    $records['global'] = ['stored' => $config['aiApiKey'], 'context' => 'voncms:global-gemini:v1'];
    personalReject(
      fn() => VonCmsCredentialStore::rotateSecrets($records, static function () {
        throw new RuntimeException('Controlled failure before persistence.');
      }),
      0,
      'Failed rotate did not reject.',
    );
    $existing = voncms_ai_personal_row($pdo, '4');
    voncms_ai_save_personal(
      $pdo,
      '4',
      'save',
      'qa-writer-after-remove',
      hash('sha256', $existing['encrypted_key']),
      false,
    );
    foreach ($records as $record) {
      personalCheck(
        VonCmsCredentialStore::decrypt($record['stored'], $record['context']) !== '',
        'Failed/retried rotation lost prior live key.',
      );
    }
  }
  // Corrupt one row: no global/personal database update and no master replacement.
  $savedConfig = voncms_ai_load_config($pdo);
  $savedMaster = file_get_contents(VONCMS_CREDENTIAL_KEY_FILE);
  $old = voncms_ai_personal_row($pdo, '4');
  $pdo->exec("UPDATE user_ai_keys SET encrypted_key='corrupt' WHERE user_id=4");
  personalReject(
    fn() => voncms_ai_rotate_global_key($pdo, hash('sha256', $savedConfig['aiApiKey']), '1'),
    503,
    'Corrupt batch rotation accepted.',
  );
  personalCheck(
    voncms_ai_load_config($pdo) === $savedConfig &&
      file_get_contents(VONCMS_CREDENTIAL_KEY_FILE) === $savedMaster,
    'Failed batch modified global/master.',
  );
  $pdo
    ->prepare('UPDATE user_ai_keys SET encrypted_key=? WHERE user_id=4')
    ->execute([$old['encrypted_key']]);
  $pdo->exec("UPDATE users SET role='Moderator' WHERE id=3");
  if ($mysql) {
    // Real InnoDB reader versus writer: rotation must wait until read/decrypt is complete.
    $pdo->beginTransaction();
    $lockedConfig = voncms_ai_lock_config($pdo, false);
    $revision = hash('sha256', $lockedConfig['aiApiKey']);
    $workerCode =
      'define("VONCMS_CREDENTIAL_KEY_FILE",' .
      var_export(VONCMS_CREDENTIAL_KEY_FILE, true) .
      ');require ' .
      var_export($root . '/public/api/ai_provider_helper.php', true) .
      ';$pdo=new PDO(' .
      var_export($dsn . ';dbname=' . $database, true) .
      ',' .
      var_export(getenv('VONCMS_TEST_MYSQL_USER') ?: 'root', true) .
      ',' .
      var_export(getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '', true) .
      ',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);touch(' .
      var_export($temporary . '/started', true) .
      ');voncms_ai_rotate_global_key($pdo,' .
      var_export($revision, true) .
      ',"1");touch(' .
      var_export($temporary . '/finished', true) .
      ');echo "ok";';
    $worker = proc_open(
      [PHP_BINARY, '-d', 'opcache.enable_cli=0', '-r', $workerCode],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    fclose($pipes[0]);
    try {
      $deadline = microtime(true) + 10;
      while (!is_file($temporary . '/started') && microtime(true) < $deadline) {
        usleep(10000);
        clearstatcache();
      }
      personalCheck(is_file($temporary . '/started'), 'MySQL rotation worker did not start.');
      usleep(150000);
      clearstatcache();
      personalCheck(
        proc_get_status($worker)['running'] && !is_file($temporary . '/finished'),
        'Rotation crossed a held shared anchor.',
      );
      personalCheck(
        VonCmsCredentialStore::decrypt($lockedConfig['aiApiKey'], 'voncms:global-gemini:v1') ===
          'qa-shared-key',
        'Reader lost key before releasing anchor.',
      );
    } finally {
      if ($pdo->inTransaction()) {
        $pdo->commit();
      }
    }
    $out = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    personalCheck(
      proc_close($worker) === 0 && $out === 'ok' && $err === '',
      'MySQL blocked rotation failed after reader completed: ' . $err,
    );
    personalCheck(
      voncms_ai_resolve_request($pdo, null, '', '1')['api_key'] === 'qa-key-1',
      'Post-rotation selection lost own key.',
    );
  }
  // Actual private controller. Authentication/CSRF transport is stubbed; DB role, parsing,
  // encrypted writes, target rejection and response projections are the real implementation.
  if (!$mysql) {
    $harness = $temporary . '/controller';
    foreach (['api', 'core'] as $dir) {
      mkdir($harness . '/' . $dir, 0700, true);
    }
    foreach (
      [
        'account.php',
        'ai_generate.php',
        'ai_check.php',
        'ai_provider_helper.php',
        'role_capability_helper.php',
      ]
      as $file
    ) {
      copy($root . '/public/api/' . $file, $harness . '/api/' . $file);
    }
    foreach (['DataBoundary.php', 'CredentialStore.php'] as $file) {
      copy($root . '/public/core/' . $file, $harness . '/core/' . $file);
    }
    file_put_contents(
      $harness . '/von_config.php',
      '<?php $pdo=new PDO(' .
        var_export('sqlite:' . $temporary . '/fixture.sqlite', true) .
        ',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);',
    );
    file_put_contents(
      $harness . '/security.php',
      '<?php define("VONCMS_CREDENTIAL_KEY_FILE",' .
        var_export(VONCMS_CREDENTIAL_KEY_FILE, true) .
        ');' .
        <<<'PHP'
        $_SESSION['user']=['id'=>$GLOBALS['QA_ID'],'role'=>$GLOBALS['QA_ROLE']];
        function sendApiHeaders($methods='') {}
        class ResponseHelper {
          public static function sendError($message,$status=500){http_response_code($status);echo json_encode(['success'=>false,'error'=>$message]);exit;}
          public static function scrubAvatarUrl($value){return $value;}
        }
        class SessionManager {public static function requireValidSession(){if($GLOBALS['QA_ROLE']==='Guest') ResponseHelper::sendError('Authentication required',401);}}
        class CSRFProtection {
          public static function requireToken(){if(!$GLOBALS['QA_CSRF'])ResponseHelper::sendError('Invalid CSRF token',403);}
          public static function getRequestBody(){return $GLOBALS['QA_BODY'];}
        }
        require_once __DIR__.'/von_config.php';
        PHP,
    );
    foreach ($roles as $id => $role) {
      $response = personalRequest($harness, (string) $id, $role);
      personalCheck(
        $response['status'] === ($role === 'Member' ? 403 : 200),
        'Unexpected own-account role result: ' .
          $id .
          ' ' .
          $response['status'] .
          ' ' .
          $response['raw'],
      );
      if ($role === 'Member') {
        continue;
      }
      personalCheck(
        (string) $response['body']['user']['id'] === (string) $id &&
          !isset($response['body']['users']),
        'Own response exposed a collection.',
      );
      $response = personalRequest($harness, (string) $id, $role, 'GET', [], ['section' => 'ai']);
      personalCheck(
        $response['status'] === 200 &&
          $response['body']['accountId'] === (string) $id &&
          !str_contains($response['raw'], 'qa-key-') &&
          !str_contains($response['raw'], 'voncms:secret:'),
        'Status leaked secret or failed.',
      );
      foreach (['id', 'user_id', 'userId', 'accountId'] as $field) {
        personalCheck(
          personalRequest($harness, (string) $id, $role, 'GET', [], [$field => '1'])['status'] ===
            400,
          'GET accepted target override.',
        );
        personalCheck(
          personalRequest($harness, (string) $id, $role, 'POST', [
            'action' => 'remove',
            'revision' => $response['body']['credential']['revision'],
            'expectedUserId' => (string) $id,
            $field => '1',
          ])['status'] === 400,
          'POST accepted target override.',
        );
      }
      personalCheck(
        personalRequest(
          $harness,
          (string) $id,
          $role,
          'POST',
          [
            'action' => 'remove',
            'revision' => $response['body']['credential']['revision'],
            'expectedUserId' => (string) $id,
          ],
          [],
          false,
        )['status'] === 403,
        'Tokenless write accepted.',
      );
      personalCheck(
        personalRequest($harness, (string) $id, $role, 'POST', [
          'action' => 'remove',
          'revision' => $response['body']['credential']['revision'],
          'expectedUserId' => '999',
        ])['status'] === 409,
        'Switched account assertion accepted.',
      );
    }
    personalCheck(
      personalRequest($harness, '', 'Guest')['status'] === 401,
      'Guest reached own account.',
    );
    $pdo->exec("UPDATE users SET role='Member' WHERE id=4");
    personalCheck(
      personalRequest($harness, '4', 'Writer', 'GET', [], ['section' => 'ai'])['status'] === 403,
      'Stale elevated session bypassed fresh role.',
    );
    $pdo->exec("UPDATE users SET role='Writer' WHERE id=4");
    foreach (
      [
        ['key' => []],
        ['expireAfter30Days' => 'false'],
        ['revision' => []],
        ['expectedUserId' => []],
        ['action' => 'rotate'],
      ]
      as $bad
    ) {
      personalCheck(
        personalRequest(
          $harness,
          '4',
          'Writer',
          'POST',
          array_replace(
            ['action' => 'save', 'key' => 'qa-valid', 'revision' => '', 'expectedUserId' => '4'],
            $bad,
          ),
        )['status'] === 400,
        'Malformed request accepted.',
      );
    }
    $revision = voncms_ai_personal_projection(voncms_ai_personal_row($pdo, '4'), '4')['revision'];
    $response = personalRequest($harness, '4', 'Writer', 'POST', [
      'action' => 'save',
      'key' => 'qa-controller-write',
      'revision' => $revision,
      'expectedUserId' => '4',
    ]);
    personalCheck(
      $response['status'] === 200 && !str_contains($response['raw'], 'qa-controller-write'),
      'Controller Save failed or leaked.',
    );
    personalCheck(
      personalRequest($harness, '4', 'Writer', 'POST', [
        'action' => 'save',
        'key' => 'qa-replay',
        'revision' => $revision,
        'expectedUserId' => '4',
      ])['status'] === 409,
      'Stale replay saved.',
    );
    personalCheck(
      personalRequest($harness, '4', 'Writer', 'POST', [
        'action' => 'remove',
        'revision' => $response['body']['credential']['revision'],
        'expectedUserId' => '4',
      ])['status'] === 200,
      'Controller remove failed.',
    );
    $source = file_get_contents($harness . '/api/ai_provider_helper.php');
    $transport = str_replace(
      'function voncms_ai_generate_with_fallback(',
      'function fixture_unused_provider_transport(',
      $source,
      $count,
    );
    personalCheck($count === 1, 'Could not isolate provider transport.');
    $transport .= <<<'PHP'

    function voncms_ai_generate_with_fallback(string $key,string $model,array $payload,int $timeout): array {
      $GLOBALS['QA_PROVIDER_CALLS'][]=hash('sha256',$key);
      $fail=$GLOBALS['QA_PROVIDER_FAILURE'];
      return ['ok'=>!$fail,'http_code'=>$fail?401:200,'error_code'=>$fail?'AI_AUTH_FAILED':'','model'=>$model,'fallback_used'=>false,'data'=>['candidates'=>[['content'=>['parts'=>[['text'=>'<p>Fixture text</p>']]],'finishReason'=>'STOP']]]];
    }
    PHP;
    file_put_contents($harness . '/api/ai_provider_helper.php', $transport);
    $own = voncms_ai_save_personal($pdo, '4', 'save', 'qa-endpoint-key', '', false);
    foreach (['ai_generate.php', 'ai_check.php'] as $endpoint) {
      $payload =
        $endpoint === 'ai_generate.php'
          ? ['topic' => 'Fixture topic']
          : ['text' => '<p>Fixture text</p>'];
      $response = personalRequest($harness, '4', 'Writer', 'POST', $payload, [], true, $endpoint);
      personalCheck(
        $response['status'] === 200 &&
          $response['body']['credentialSource'] === 'personal' &&
          $response['calls'] === [hash('sha256', 'qa-endpoint-key')],
        'AI endpoint did not use the own key exactly once.',
      );
      $response = personalRequest(
        $harness,
        '4',
        'Writer',
        'POST',
        $payload,
        [],
        true,
        $endpoint,
        true,
      );
      personalCheck(
        $response['status'] === 401 &&
          $response['calls'] === [hash('sha256', 'qa-endpoint-key')] &&
          !str_contains($response['raw'], 'qa-endpoint-key'),
        'Provider rejection retried shared or leaked a key.',
      );
      $pdo->exec("UPDATE user_ai_keys SET expires_at='2000-01-01 00:00:00' WHERE user_id=4");
      $response = personalRequest($harness, '4', 'Writer', 'POST', $payload, [], true, $endpoint);
      personalCheck(
        $response['status'] === 400 && $response['calls'] === [],
        'Expired personal key reached provider/shared.',
      );
      $pdo->exec('UPDATE user_ai_keys SET expires_at=NULL WHERE user_id=4');
      foreach (
        [['5', 'Member', true, 403], ['', 'Guest', true, 401], ['4', 'Writer', false, 403]]
        as [$actor, $role, $csrf, $expected]
      ) {
        $response = personalRequest(
          $harness,
          $actor,
          $role,
          'POST',
          $payload,
          [],
          $csrf,
          $endpoint,
        );
        personalCheck(
          $response['status'] === $expected && $response['calls'] === [],
          'Denied AI actor reached provider.',
        );
      }
    }
    $disabled = str_replace(
      '$personal = voncms_ai_personal_row($pdo, $userId);',
      '$personal = false;',
      $source,
      $count,
    );
    personalCheck($count === 1, 'Personal-first negative control was not applied.');
    file_put_contents($harness . '/api/ai_provider_helper.php', $disabled);
    $controlCode =
      'define("VONCMS_CREDENTIAL_KEY_FILE",' .
      var_export(VONCMS_CREDENTIAL_KEY_FILE, true) .
      ');require ' .
      var_export($harness . '/api/ai_provider_helper.php', true) .
      ';$pdo=new PDO(' .
      var_export('sqlite:' . $temporary . '/fixture.sqlite', true) .
      ');$selected=voncms_ai_resolve_request($pdo,null,"","1");echo $selected["shared"]?"wrong-shared":"personal";';
    $worker = proc_open(
      [PHP_BINARY, '-d', 'opcache.enable_cli=0', '-r', $controlCode],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    personalCheck(
      proc_close($worker) === 0 && $err === '' && $out === 'wrong-shared',
      'Negative control did not reproduce incorrect shared selection.',
    );
  }
  $pdo->exec('DELETE FROM users WHERE id=2');
  personalCheck(
    voncms_ai_personal_row($pdo, '2') === false,
    'Deleted account retained credential.',
  );
  if ($mysql) {
    // Full shipped SQL in this owned database only; never execute its example database commands.
    $pdo->exec('DROP TABLE user_ai_keys');
    $pdo->exec('DROP TABLE settings');
    $pdo->exec('DROP TABLE users');
    $sql = preg_replace(
      '/^(?:CREATE DATABASE IF NOT EXISTS example_db[^\r\n]*|USE example_db;)\R/m',
      '',
      file_get_contents($root . '/public/install.sql'),
      -1,
      $removed,
    );
    personalCheck(
      $removed === 2 && !preg_match('/^\s*(?:CREATE DATABASE|USE\s)/mi', $sql),
      'Install fixture did not confine SQL to its owned database.',
    );
    $pdo->exec($sql);
    personalCheck(
      voncms_schema_missing_capability($pdo, 'personal_ai_keys') === [],
      'Fresh SQL lacks personal-key storage.',
    );
    personalCheck(
      voncms_ai_load_config($pdo) === [],
      'Fresh SQL does not seed empty private configuration.',
    );
    // Real status controller and schema inspection on owned MySQL; only auth transport is stubbed.
    $statusHarness = $temporary . '/database-status';
    mkdir($statusHarness . '/api/system', 0700, true);
    mkdir($statusHarness . '/core', 0700);
    copy($root . '/public/core/DataBoundary.php', $statusHarness . '/core/DataBoundary.php');
    copy(
      $root . '/public/api/schema_repair_helper.php',
      $statusHarness . '/api/schema_repair_helper.php',
    );
    $statusSource = file_get_contents($root . '/public/api/system/check_db_status.php');
    file_put_contents($statusHarness . '/api/system/check_db_status.php', $statusSource);
    file_put_contents(
      $statusHarness . '/von_config.php',
      '<?php $pdo=new PDO(' .
        var_export($dsn . ';dbname=' . $database, true) .
        ',' .
        var_export(getenv('VONCMS_TEST_MYSQL_USER') ?: 'root', true) .
        ',' .
        var_export(getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '', true) .
        ',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);',
    );
    file_put_contents(
      $statusHarness . '/security.php',
      <<<'PHP'
      <?php
      function sendApiHeaders($methods='') {}
      class SessionManager {public static function requirePrimaryAdmin() {}}
      class ResponseHelper {
        public static function sendError($message,$status=500) {http_response_code($status);echo json_encode(['success'=>false,'error'=>$message]);exit;}
      }
      PHP
      ,
    );
    $readStatus = static fn() => personalRequest(
      $statusHarness,
      '1',
      'Admin',
      'GET',
      [],
      [],
      true,
      'system/check_db_status.php',
    );
    $status = $readStatus();
    personalCheck(
      $status['status'] === 200 &&
        $status['body']['needs_repair'] === false &&
        $status['body']['details'] === [],
      'Healthy shipped schema incorrectly triggers the owner repair warning.',
    );
    $pdo->exec('ALTER TABLE user_ai_keys DROP COLUMN saved_at');
    personalCheck(
      in_array(
        'Personal AI key storage requires Database Repair',
        $readStatus()['body']['details'],
        true,
      ),
      'Incomplete personal-key storage is missing from the repair warning.',
    );
    $pdo->exec('DROP TABLE user_ai_keys');
    $status = $readStatus();
    personalCheck(
      $status['body']['needs_repair'] === true &&
        $status['body']['details'] === ['Personal AI key storage requires Database Repair'],
      'Missing personal-key storage alone does not trigger the owner repair warning.',
    );
    personalCheck(
      !voncms_schema_table_exists($pdo, 'user_ai_keys') &&
        $readStatus()['body']['needs_repair'] === true,
      'Status read created schema or lost the warning on retry.',
    );
    $withoutStatusFix = str_replace(
      "  'personal_ai_keys' => 'Personal AI key storage',\n",
      '',
      str_replace("\r\n", "\n", $statusSource),
      $removedStatusFix,
    );
    personalCheck($removedStatusFix === 1, 'Status negative control did not remove the fix.');
    file_put_contents($statusHarness . '/api/system/check_db_status.php', $withoutStatusFix);
    personalCheck(
      $readStatus()['body']['needs_repair'] === false,
      'Status negative control did not reproduce the missing bell warning.',
    );
    file_put_contents($statusHarness . '/api/system/check_db_status.php', $statusSource);
    // Supported old drift: privacy column and new table absent before Repair.
    $pdo->exec('ALTER TABLE settings DROP COLUMN is_public');
    $runtime = voncms_schema_repair_runtime_capabilities($pdo);
    $core = voncms_schema_repair_core_structures($pdo);
    voncms_schema_seed_ai_config($pdo);
    personalCheck(
      $runtime['warnings'] === [] &&
        $core['warnings'] === [] &&
        voncms_schema_missing_capability($pdo, 'personal_ai_keys') === [],
      'Repair failed on existing settings-column drift.',
    );
    personalCheck(
      $readStatus()['body']['needs_repair'] === false,
      'Repair did not clear the personal-key storage notification.',
    );
    personalCheck(
      (int) $pdo
        ->query("SELECT is_public FROM settings WHERE setting_group='api' AND setting_key='config'")
        ->fetchColumn() === 0,
      'Repair failed to keep singleton private.',
    );
    $config = ['aiApiKey' => 'qa-legacy-value', 'aiModel' => 'gemini-3.8-flash'];
    $writeGlobal($config);
    voncms_schema_seed_ai_config($pdo);
    voncms_schema_seed_ai_config($pdo);
    personalCheck(
      voncms_ai_load_config($pdo) === $config &&
        (int) $pdo
          ->query(
            "SELECT COUNT(*) FROM settings WHERE setting_group='api' AND setting_key='config'",
          )
          ->fetchColumn() === 1,
      'Repeated Repair replaced or duplicated existing API configuration.',
    );
  }
  echo 'PASS Personal AI Keys: ' .
    $checks .
    ' checks; real crypto/helper' .
    ($mysql ? ' and MySQL schema' : ' and private controller/SQLite') .
    ' execution; all staff roles, fresh demotion, own-only projection, target/CSRF/stale rejection, expiry, missing/corrupt master, batch/failure rotation and delete cascade. No live credentials or provider calls.' .
    "\n";
} finally {
  unset($writeGlobal, $pdo);
  if ($admin instanceof PDO && preg_match('/^voncms_personal_ai_[a-f0-9]{16}$/D', $database)) {
    $admin->exec('DROP DATABASE `' . $database . '`');
  }
  if (
    dirname($temporary) !== rtrim(sys_get_temp_dir(), '/\\') ||
    !str_starts_with(basename($temporary), 'voncms-personal-ai-')
  ) {
    throw new RuntimeException('Unexpected cleanup path.');
  }
  personalCleanup($temporary);
}
