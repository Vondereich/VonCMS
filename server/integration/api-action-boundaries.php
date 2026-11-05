<?php
/** Isolated endpoint regressions: no CMS config, live database or real mail transport. */
$root = dirname(__DIR__, 2);
require_once __DIR__ . '/sqlite-compat.php';

function actionDeclaration(string $file, string $needle): string
{
  $source = file_get_contents($file);
  $start = strpos($source, $needle);
  if ($start === false) {
    throw new RuntimeException('Missing declaration: ' . $needle);
  }
  $result = '';
  $depth = 0;
  $opened = false;
  foreach (array_slice(token_get_all('<?php ' . substr($source, $start)), 1) as $token) {
    $result .= is_array($token) ? $token[1] : $token;
    if (
      $token === '{' ||
      (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))
    ) {
      $depth++;
      $opened = true;
    } elseif ($token === '}' && --$depth === 0 && $opened) {
      return $result;
    }
  }
  throw new RuntimeException('Incomplete declaration');
}

// MySQL buffers these one-row reads; release SQLite cursors before later writes.
class ActionFixtureStatement extends PDOStatement
{
  public function rowCount(): int
  {
    if (
      !empty($GLOBALS['actionNoopUpdate']) &&
      str_starts_with($this->queryString, 'UPDATE users SET')
    ) {
      return 0;
    }
    return parent::rowCount();
  }
  public function fetch(
    int $mode = PDO::FETCH_DEFAULT,
    int $cursorOrientation = PDO::FETCH_ORI_NEXT,
    int $cursorOffset = 0,
  ): mixed {
    $value = parent::fetch($mode, $cursorOrientation, $cursorOffset);
    $this->closeCursor();
    return $value;
  }

  public function fetchColumn(int $column = 0): mixed
  {
    $value = parent::fetchColumn($column);
    $this->closeCursor();
    return $value;
  }
}

// Only adapt dialect-specific locking/retention syntax. Business SQL is unchanged.
class ActionFixturePDO extends VonCmsFixtureSqlitePDO
{
  public function commit(): bool
  {
    if (!empty($GLOBALS['actionFailCommit'])) {
      throw new RuntimeException('Controlled profile commit failure');
    }
    return parent::commit();
  }
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    if (
      str_contains($query, 'INSERT INTO contact_forms') &&
      str_contains($query, 'ON DUPLICATE KEY UPDATE')
    ) {
      $query = str_replace('ON DUPLICATE KEY UPDATE', 'ON CONFLICT(id) DO UPDATE SET', $query);
      $query = preg_replace('/VALUES\((\w+)\)/', 'excluded.$1', $query);
    }
    return parent::prepare(
      str_replace(
        [
          ' FOR UPDATE',
          'DATE_ADD(NOW(), INTERVAL 1 HOUR)',
          'DATE_ADD(NOW(), INTERVAL 24 HOUR)',
          '? >= UNIX_TIMESTAMP()',
          'ON DUPLICATE KEY UPDATE visitor_hash=visitor_hash',
        ],
        [
          '',
          "datetime('now', '+1 hour')",
          "datetime('now', '+24 hours')",
          'CAST(? AS INTEGER) >= UNIX_TIMESTAMP()',
          'ON CONFLICT(visitor_hash) DO NOTHING',
        ],
        $query,
      ),
      $options,
    );
  }

  public function exec(string $statement): int|false
  {
    if (
      str_starts_with(
        $statement,
        'DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)',
      )
    ) {
      $statement = "DELETE FROM analytics WHERE visit_date < date('now', '-30 days')";
    }
    if (
      $statement ===
      'DELETE FROM contact_submissions WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
    ) {
      if (!empty($GLOBALS['contactFailRetention'])) {
        throw new RuntimeException('Controlled retention failure');
      }
      $statement = "DELETE FROM contact_submissions WHERE created_at < datetime('now', '-90 days')";
    }
    return parent::exec($statement);
  }
}

function actionDatabase(string $directory): ActionFixturePDO
{
  $pdo = new ActionFixturePDO('sqlite:' . $directory . '/fixture.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_TIMEOUT => 10,
    PDO::ATTR_STATEMENT_CLASS => [ActionFixtureStatement::class],
  ]);
  $pdo->createFunction('NOW', fn() => gmdate('Y-m-d H:i:s'));
  $pdo->createFunction('CURDATE', fn() => gmdate('Y-m-d'));
  $pdo->createFunction('CURTIME', fn() => gmdate('H:i:s'));
  $pdo->createFunction('UNIX_TIMESTAMP', fn() => time());
  return $pdo;
}

// Optional real InnoDB probe. Uses a newly created random fixture database only.
function actionMysqlAuthConnection(string $database = '', bool $holdCommit = false): PDO
{
  $dsn = getenv('VONCMS_TEST_MYSQL_DSN') ?: '';
  if (!str_starts_with($dsn, 'mysql:') || preg_match('/(?:^|;)dbname=/i', $dsn)) {
    throw new RuntimeException('Set VONCMS_TEST_MYSQL_DSN without a database name.');
  }
  if ($database !== '' && !preg_match('/^voncms_auth_[a-f0-9]{16}$/D', $database)) {
    throw new RuntimeException('Invalid owned fixture database.');
  }
  $type = $holdCommit ? ActionMysqlAuthHoldPDO::class : PDO::class;
  return new $type(
    $dsn . ($database !== '' ? ';dbname=' . $database : ''),
    getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
    getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC],
  );
}

class ActionMysqlAuthHoldPDO extends PDO
{
  public string $barrierDirectory = '';
  public bool $failCommit = false;
  public function commit(): bool
  {
    if ($this->failCommit) {
      throw new RuntimeException('Controlled credential commit failure.');
    }
    if ($this->barrierDirectory !== '') {
      touch($this->barrierDirectory . '/ready');
      actionMysqlAuthWait($this->barrierDirectory . '/go');
    }
    return parent::commit();
  }
}

function actionMysqlAuthWait(string $path): void
{
  $deadline = microtime(true) + 20;
  while (!is_file($path)) {
    if (microtime(true) > $deadline) {
      throw new RuntimeException('Owned MySQL fixture barrier timeout.');
    }
    usleep(10000);
    clearstatcache();
  }
}

if (($argv[1] ?? '') === '--mysql-auth-worker') {
  $options = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
  eval(
    actionDeclaration($root . '/public/api/login.php', 'function voncms_verify_login_candidate(')
  );
  $issuer = actionDeclaration(
    $root . '/public/api/login.php',
    'function voncms_issue_login_credentials(',
  );
  if ($options['mode'] === 'unguarded-before') {
    // Disposable mutation control: remove only the new serialized password guard.
    $issuer = preg_replace(
      '/    \$lock = \$db->prepare\(\x27SELECT password FROM users WHERE id = \? FOR UPDATE\x27\);.*?    \$remember = \[\];/s',
      '    $remember = [];',
      $issuer,
      1,
      $removed,
    );
    if ($removed !== 1) {
      throw new RuntimeException('Missing credential guard mutation point.');
    }
  }
  eval($issuer);
  $db = actionMysqlAuthConnection($options['database'], $options['mode'] === 'hold');
  $stored = $db->query('SELECT password FROM users WHERE id=1')->fetchColumn();
  if (!voncms_verify_login_candidate(['password' => $stored], 'Fixture_Old9!')) {
    throw new RuntimeException('Ordinary old-password control failed.');
  }
  if (str_ends_with($options['mode'], 'before')) {
    touch($options['directory'] . '/ready');
    actionMysqlAuthWait($options['directory'] . '/go');
  } else {
    if (!($db instanceof ActionMysqlAuthHoldPDO)) {
      throw new RuntimeException('Expected the owned commit-barrier fixture connection.');
    }
    $db->barrierDirectory = $options['directory'];
  }
  $result = voncms_issue_login_credentials($db, ['id' => 1], $stored, true);
  echo json_encode(['issued' => is_array($result) && $result !== []]);
  exit();
}

if (($argv[1] ?? '') === '--mysql-auth-race') {
  if (!getenv('VONCMS_TEST_MYSQL_DSN')) {
    fwrite(STDERR, "NOT_RUN MySQL auth: set VONCMS_TEST_MYSQL_DSN without dbname.\n");
    exit(2);
  }
  eval(
    actionDeclaration($root . '/public/api/login.php', 'function voncms_issue_login_credentials(')
  );
  $database = 'voncms_auth_' . bin2hex(random_bytes(8));
  $directory = sys_get_temp_dir() . '/voncms-auth-mysql-' . bin2hex(random_bytes(8));
  $admin = actionMysqlAuthConnection();
  mkdir($directory, 0700);
  $created = false;
  $active = null;
  $db = null;
  $count = 0;
  $check = static function (bool $ok, string $message) use (&$count): void {
    if (!$ok) {
      throw new RuntimeException($message);
    }
    $count++;
  };
  try {
    $admin->exec('CREATE DATABASE `' . $database . '`');
    $created = true;
    $db = actionMysqlAuthConnection($database);
    $db->exec(
      'CREATE TABLE users(id INT PRIMARY KEY,password VARCHAR(255) NOT NULL) ENGINE=InnoDB',
    );
    $db->exec(
      'CREATE TABLE remember_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,selector VARCHAR(24),token_hash VARCHAR(64),expires_at DATETIME) ENGINE=InnoDB',
    );
    $old = password_hash('Fixture_Old9!', PASSWORD_BCRYPT);
    $new = password_hash('Fixture_New9!', PASSWORD_BCRYPT);
    $db->prepare('INSERT INTO users VALUES(1,?)')->execute([$old]);
    $reset = static function () use ($db, $new): void {
      $db->beginTransaction();
      try {
        $db->query('SELECT id FROM users WHERE id=1 FOR UPDATE')->fetchColumn();
        $db->prepare('UPDATE users SET password=? WHERE id=1')->execute([$new]);
        $db->exec('DELETE FROM remember_tokens WHERE user_id=1');
        $db->commit();
      } catch (Throwable $error) {
        if ($db->inTransaction()) {
          $db->rollBack();
        }
        throw $error;
      }
    };
    $launch = static function (string $mode) use ($database, $directory): array {
      foreach (['ready', 'go'] as $name) {
        @unlink($directory . '/' . $name);
      }
      $process = proc_open(
        [
          PHP_BINARY,
          __FILE__,
          '--mysql-auth-worker',
          json_encode(compact('database', 'directory', 'mode'), JSON_THROW_ON_ERROR),
        ],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
      );
      if (!is_resource($process)) {
        throw new RuntimeException('MySQL fixture worker failed to start.');
      }
      fclose($pipes[0]);
      return [$process, $pipes];
    };
    $join = static function (array $worker): array {
      [$process, $pipes] = $worker;
      $out = stream_get_contents($pipes[1]);
      $errors = stream_get_contents($pipes[2]);
      fclose($pipes[1]);
      fclose($pipes[2]);
      if (proc_close($process) !== 0 || $errors !== '') {
        throw new RuntimeException('MySQL worker: ' . $errors . $out);
      }
      return json_decode($out, true, 512, JSON_THROW_ON_ERROR);
    };
    $ordinary = voncms_issue_login_credentials($db, ['id' => 1], $old, true);
    $check(
      is_array($ordinary) && isset($ordinary['validator']),
      'Ordinary remember issuance failed.',
    );
    $check(
      hash_equals(
        $db->query('SELECT token_hash FROM remember_tokens')->fetchColumn(),
        hash('sha256', $ordinary['validator']),
      ),
      'Issued remember credential does not match stored digest.',
    );
    $check(
      voncms_issue_login_credentials($db, ['id' => 1], $old, false) === [],
      'Ordinary session-only login failed.',
    );
    $db->exec('DELETE FROM remember_tokens');

    // Failure must roll back INSERT and never yield credentials to the caller.
    $failureDb = actionMysqlAuthConnection($database, true);
    if (!($failureDb instanceof ActionMysqlAuthHoldPDO)) {
      throw new RuntimeException('Expected the owned commit-failure fixture connection.');
    }
    $failureDb->failCommit = true;
    $failed = false;
    try {
      voncms_issue_login_credentials($failureDb, ['id' => 1], $old, true);
    } catch (RuntimeException $error) {
      $failed = $error->getMessage() === 'Controlled credential commit failure.';
    }
    $check(
      $failed && !$failureDb->inTransaction(),
      'Failed commit did not refuse credentials and release its transaction.',
    );
    $check(
      (int) $db->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 0,
      'Failed commit left an orphan remember token.',
    );
    $failureDb = null;
    $db->exec(
      "CREATE TRIGGER refuse_token BEFORE INSERT ON remember_tokens FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Controlled token failure'",
    );
    $failed = false;
    try {
      voncms_issue_login_credentials($db, ['id' => 1], $old, true);
    } catch (PDOException $error) {
      $failed = ($error->errorInfo[0] ?? '') === '45000';
    }
    $check(
      $failed && !$db->inTransaction(),
      'Unexpected INSERT failure was swallowed or left a transaction open.',
    );
    $db->exec('DROP TRIGGER refuse_token');
    $check(
      voncms_issue_login_credentials($db, ['id' => 999], $old, true) === false,
      'Deleted user can issue credentials.',
    );

    // Reset commits after real bcrypt verification, before the issuance guard.
    $active = $launch('before');
    actionMysqlAuthWait($directory . '/ready');
    $reset();
    touch($directory . '/go');
    $result = $join($active);
    $active = null;
    $check(!$result['issued'], 'A reset-before-issuance login retained persistent authority.');
    $check(
      (int) $db->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 0,
      'Stale token survived reset.',
    );

    // The same schedule must expose a surviving token with the guard disabled.
    $db->prepare('UPDATE users SET password=? WHERE id=1')->execute([$old]);
    $active = $launch('unguarded-before');
    actionMysqlAuthWait($directory . '/ready');
    $reset();
    touch($directory . '/go');
    $result = $join($active);
    $active = null;
    $check(
      $result['issued'] &&
        (int) $db->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 1,
      'Race regression fails to detect its unguarded counterexample.',
    );
    $db->exec('DELETE FROM remember_tokens');

    // Login holds the user lock through INSERT/commit; reset must wait.
    $db->prepare('UPDATE users SET password=? WHERE id=1')->execute([$old]);
    $active = $launch('hold');
    actionMysqlAuthWait($directory . '/ready');
    $db->exec('SET SESSION innodb_lock_wait_timeout=1');
    $blocked = false;
    try {
      $reset();
    } catch (PDOException $error) {
      $blocked = (int) ($error->errorInfo[1] ?? 0) === 1205;
    }
    $check($blocked, 'Reset did not contend on the same users-row lock.');
    touch($directory . '/go');
    $result = $join($active);
    $active = null;
    $check($result['issued'], 'Issuance-before-reset control failed.');
    $reset();
    $check(
      (int) $db->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 0,
      'Reset failed to revoke newly issued token.',
    );

    // Missing optional remember storage must not weaken the password guard.
    $db->exec('DROP TABLE remember_tokens');
    $check(
      voncms_issue_login_credentials($db, ['id' => 1], $new, false) === [],
      'Session-only compatibility failed.',
    );
    $sessionOnly = voncms_issue_login_credentials($db, ['id' => 1], $new, true);
    $check($sessionOnly === [], 'Missing optional storage must produce no remember credential.');
    $check(
      voncms_issue_login_credentials($db, ['id' => 1], $old, true) === false,
      'Compatibility fallback accepted an old password.',
    );
    $check(!$db->inTransaction(), 'Credential guard leaked its transaction.');
    $db->exec('DROP TABLE users');
    $failed = false;
    try {
      voncms_issue_login_credentials($db, ['id' => 1], $new, true);
    } catch (PDOException $error) {
      $failed = ($error->errorInfo[0] ?? '') === '42S02';
    }
    $check(
      $failed && !$db->inTransaction(),
      'Mandatory users-row guard failure was treated as optional storage.',
    );
  } finally {
    touch($directory . '/go');
    if ($active && is_resource($active[0])) {
      if (proc_get_status($active[0])['running']) {
        proc_terminate($active[0]);
      }
      foreach ([1, 2] as $i) {
        if (is_resource($active[1][$i])) {
          fclose($active[1][$i]);
        }
      }
      proc_close($active[0]);
    }
    $db = null;
    if ($created && preg_match('/^voncms_auth_[a-f0-9]{16}$/D', $database)) {
      $admin->exec('DROP DATABASE `' . $database . '`');
    }
    foreach (['ready', 'go'] as $name) {
      @unlink($directory . '/' . $name);
    }
    if (
      dirname($directory) === sys_get_temp_dir() &&
      str_starts_with(basename($directory), 'voncms-auth-mysql-')
    ) {
      @rmdir($directory);
    }
  }
  echo "PASS MySQL auth issuance: $count checks; real InnoDB/two-process orderings, failure rollback, ordinary controls and optional-storage fallback. Owned fixture database removed.\n";
  exit();
}

if (($argv[1] ?? '') === '--contact-session-probe') {
  session_save_path($argv[2]);
  session_id($argv[3]);
  session_start();
  $snapshot = [
    'cooldown' => isset($_SESSION['last_contact_submit']),
    'used' => count($_SESSION['contact_honeypot_used'] ?? []),
  ];
  session_write_close();
  echo json_encode($snapshot);
  exit();
}

if (($argv[1] ?? '') === '--worker') {
  $directory = $argv[2];
  $options = json_decode($argv[3], true, 512, JSON_THROW_ON_ERROR);
  $index = $options['index'];
  if (isset($options['phpTimezone'])) {
    date_default_timezone_set((string) $options['phpTimezone']);
  }
  ob_start();
  register_shutdown_function(static function () use ($directory, $index, $options): void {
    $output = '';
    while (ob_get_level() > 0) {
      $output = ob_get_clean() . $output;
    }
    $error = error_get_last();
    file_put_contents(
      $directory . '/result-' . $index . '.json',
      json_encode(
        [
          'status' => http_response_code() ?: 200,
          'body' =>
            ($options['endpoint'] ?? '') === 'verify_email.php'
              ? ['html' => $output]
              : json_decode($output, true),
          'output' => $output,
          'fatal' => $error && in_array($error['type'], [E_ERROR, E_PARSE, E_COMPILE_ERROR], true),
          'sessionUser' => $_SESSION['user'] ?? null,
          'contactSession' => [
            'cooldown' => isset($_SESSION['last_contact_submit']),
            'used' => count($_SESSION['contact_honeypot_used'] ?? []),
            'newerClaim' => ($_SESSION['contact_submit_nonce'] ?? '') === 'newer-request',
          ],
        ],
        JSON_THROW_ON_ERROR,
      ),
    );
    touch($directory . '/done-' . $index);
  });
  $_SERVER['REQUEST_METHOD'] = 'POST';
  $_SERVER['REMOTE_ADDR'] = $options['ip'] ?? '198.51.100.144';
  $_SERVER['SCRIPT_FILENAME'] = __FILE__;
  $_SERVER['HTTP_HOST'] = 'qa.invalid';
  session_save_path($directory);
  session_id('actionqa' . ($options['session'] ?? bin2hex(random_bytes(12))));
  session_start();
  define('VONCMS_CORE_LOADED', true);
  function sendApiHeaders($methods = 'GET, OPTIONS'): void {}
  function is_https(): bool
  {
    return false;
  }
  function voncms_public_cache_clear(): array
  {
    return [];
  }
  // These probes do not exercise site timezone configuration.
  function voncms_apply_site_timezone($pdo): ?string
  {
    return null;
  }
  class SessionManager
  {
    public static function requireValidSession(): void {}
    public static function requireAdmin(): void
    {
      if (!self::isAdmin()) {
        ResponseHelper::sendError('Forbidden', 403);
      }
    }
    public static function isPrimaryAdmin(): bool
    {
      return ($_SESSION['user']['id'] ?? '') === '1';
    }
    public static function isAdmin(): bool
    {
      return self::isPrimaryAdmin() ||
        strtolower((string) ($_SESSION['user']['role'] ?? '')) === 'admin';
    }
    public static function isValid(): bool
    {
      return isset($_SESSION['user']);
    }
    public static function isStaff(): bool
    {
      return in_array(
        strtolower((string) ($_SESSION['user']['role'] ?? '')),
        ['root', 'admin', 'moderator', 'writer'],
        true,
      );
    }
    public static function establishAuthenticatedSession(array $user, string $passwordHash): void
    {
      $_SESSION['user'] = $user;
    }
  }
  class SecurityLogger
  {
    public static function log(...$arguments): void {}
  }
  require $root . '/public/core/RateLimiter.php';
  require $root . '/public/core/ResponseHelper.php';
  require $root . '/public/api/role_capability_helper.php';
  require $root . '/public/api/schema_repair_helper.php';
  require_once $root . '/public/api/publication_time_helper.php';
  $rateStorage = new ReflectionProperty(RateLimiter::class, 'storageDir');
  $rateStorage->setValue(null, $directory . '/rates/');
  if (!RateLimiter::getStorageHealth()['healthy']) {
    throw new RuntimeException('QA requires writable, lockable rate-limit storage');
  }
  eval(actionDeclaration($root . '/public/security.php', 'class CSRFProtection'));
  eval(actionDeclaration($root . '/public/security.php', 'class SecurityHelper'));
  eval(actionDeclaration($root . '/public/von_config.sample.php', 'function sanitize_input('));
  $pdo = actionDatabase($directory);
  $case = $options['case'] ?? 'normal';
  $endpoint = $options['endpoint'];
  if ($endpoint === 'submit_contact.php') {
    require $root . '/public/api/contact_honeypot_helper.php';
    $challenge = $_SESSION['qa_contact_challenge'] ?? voncms_contact_honeypot_issue('qa_form');
    $_SESSION['qa_contact_challenge'] = $challenge;
    sleep(1);
    $input = [
      'formId' => 'qa_form',
      'data' => $options['data'] ?? [
        'your-email' => 'qa@example.invalid',
        'message' => 'Ordinary QA message',
      ],
      'antiBot' => ['field' => $challenge['field'], 'token' => $challenge['token'], 'value' => ''],
    ];
    if ($case === 'bot') {
      $input['antiBot']['value'] = '0';
    }
    if ($case === 'invalid') {
      $input['data']['your-email'] = 'invalid-address';
    }
    $GLOBALS['contactFailRetention'] = $case === 'retention-failure';
    if ($case === 'mail-format') {
      eval(actionDeclaration($root . '/public/api/mail_helper.php', 'function vonSendMail('));
      function loadSmtpSettings(): array
      {
        return ['site_name' => 'QA'];
      }
      /**
       * @param string $to
       * @param string $subject
       * @param string $body
       * @param string $from
       * @param string $name
       */
      function sendWithPhpMail($to, $subject, $body, $from, $name): array
      {
        global $pdo;
        $pdo
          ->prepare('INSERT INTO mail_calls(recipient,payload) VALUES (?,?)')
          ->execute([$to, json_encode(compact('subject', 'body', 'from', 'name'))]);
        return ['success' => true];
      }
    } else {
      /** @param string $to */
      function vonSendMail($to, ...$arguments): array
      {
        global $pdo, $case, $directory;
        $payload = ['sessionActive' => session_status() === PHP_SESSION_ACTIVE];
        if ($case === 'session-probe') {
          $process = proc_open(
            [PHP_BINARY, __FILE__, '--contact-session-probe', $directory, session_id()],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
          );
          if (!is_resource($process)) {
            throw new RuntimeException('Could not start session probe');
          }
          fclose($pipes[0]);
          $deadline = microtime(true) + 1;
          do {
            $status = proc_get_status($process);
            if (!$status['running']) {
              break;
            }
            usleep(10000);
          } while (microtime(true) < $deadline);
          if ($status['running']) {
            proc_terminate($process);
          }
          $output = stream_get_contents($pipes[1]);
          fclose($pipes[1]);
          fclose($pipes[2]);
          proc_close($process);
          $payload['probe'] = json_decode($output, true);
        }
        if ($case === 'newer-claim') {
          if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
          }
          $_SESSION['contact_submit_nonce'] = 'newer-request';
          $_SESSION['last_contact_submit'] = time();
          $_SESSION['contact_honeypot_used'][str_repeat('f', 32)] = time();
          session_write_close();
        }
        $pdo
          ->prepare('INSERT INTO mail_calls(recipient,payload) VALUES (?,?)')
          ->execute([$to, json_encode($payload)]);
        return [
          'success' => !in_array($case, ['mail-failure', 'newer-claim'], true),
          'message' => 'QA transport',
        ];
      }
    }
  } elseif (in_array($endpoint, ['save_post.php', 'save_page.php'], true)) {
    require_once $root . '/public/api/content_embed_helper.php';
    $_SESSION['user'] =
      ($options['role'] ?? '') === 'moderator'
        ? ['id' => '3', 'role' => 'Moderator']
        : ['id' => '1', 'role' => 'Root'];
    $input = [
      'title' => 'Inline-image validation QA',
      'slug' => 'inline-image-validation-qa',
      'content' =>
        $case === 'uploaded-image'
          ? '<p>Keep</p><img src="/uploads/qa.webp" alt="Uploaded">'
          : '<p>Keep</p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Pasted">',
      'excerpt' => 'QA',
      'status' => 'draft',
    ];
    // A 400 must be produced before the endpoint's database guard. No database is available.
    unset($pdo);
  } elseif (in_array($endpoint, ['contact/save_form.php', 'contact/get_forms.php'], true)) {
    $_SESSION['user'] = ['id' => '1', 'role' => 'Root'];
    $input = $options['input'] ?? [];
    if ($endpoint === 'contact/get_forms.php') {
      $_SERVER['REQUEST_METHOD'] = 'GET';
    }
  } elseif ($endpoint === 'newsletter_subscribe.php') {
    $input = ['email' => 'qa' . $index . '@example.invalid', 'hp_field' => ''];
    if ($case === 'bot') {
      $input['hp_field'] = '0';
    }
    if ($case === 'invalid') {
      $input['email'] = ['invalid'];
    }
  } elseif ($endpoint === 'update_profile.php') {
    $_SESSION['user'] = ['id' => '2', 'role' => 'Member'];
    $input = ['id' => '2', 'display_name' => 'Updated profile', 'bio' => 'QA'];
    if ($case !== 'profile-only') {
      $input['current_password'] = $case === 'wrong-password' ? 'Wrong1!Password' : 'Old1!Password';
      $input['new_password'] = 'New1!Password';
    }
  } elseif (in_array($endpoint, ['save_redirect.php', 'delete_redirect.php'], true)) {
    require $root . '/public/api/redirect_loop_helper.php';
    $_SESSION['user'] = ['id' => '1', 'role' => 'Root'];
    $input =
      $endpoint === 'delete_redirect.php'
        ? ['id' => 2]
        : ['id' => null, 'source_url' => '/new', 'target_url' => '/new-target'];
    $_SERVER['REQUEST_METHOD'] = $options['method'] ?? 'POST';
    $_GET = $options['query'] ?? [];
  } elseif (in_array($endpoint, ['login.php', 'register.php'], true)) {
    foreach (
      [
        'voncms_normalize_trusted_public_base_url',
        'voncms_loopback_request_base_url',
        'voncms_resolve_trusted_public_base_url',
        'voncms_build_account_action_url',
        'voncms_account_token_digest',
        'generateVerificationToken',
        'sendVerificationEmail',
      ]
      as $name
    ) {
      eval(actionDeclaration($root . '/public/api/mail_helper.php', 'function ' . $name . '('));
    }
    function vonSendMail(string $to, mixed ...$arguments): array
    {
      global $pdo, $case;
      $pdo
        ->prepare('INSERT INTO mail_calls(recipient,payload) VALUES (?,?)')
        ->execute([$to, json_encode($arguments)]);
      return ['success' => $case !== 'mail-failure'];
    }
    $input = ['username' => 'qa_member', 'password' => $options['password'] ?? 'Wrong1!Password'];
  } elseif ($endpoint === 'reset_password.php' || $endpoint === 'verify_email.php') {
    foreach (
      [
        'voncms_normalize_trusted_public_base_url',
        'voncms_loopback_request_base_url',
        'voncms_resolve_trusted_public_base_url',
        'voncms_build_account_action_url',
        'voncms_account_token_digest',
        'voncms_account_token_matches',
      ]
      as $name
    ) {
      eval(actionDeclaration($root . '/public/api/mail_helper.php', 'function ' . $name . '('));
    }
    /** @param string $to */
    function vonSendMail($to, ...$arguments): array
    {
      global $pdo;
      $pdo->prepare('INSERT INTO mail_calls(recipient) VALUES (?)')->execute([$to]);
      return ['success' => true];
    }
    $input = ['action' => 'request', 'email' => $options['email'] ?? 'qa@example.invalid'];
    $input['hp_field'] = $case === 'bot' ? '0' : '';
    if ($endpoint === 'verify_email.php') {
      $_SERVER['REQUEST_METHOD'] = 'GET';
      $_GET['token'] = $options['token'] ?? '';
    }
  } elseif ($endpoint === 'save_comments.php') {
    $_SESSION['user'] = ['id' => '2', 'role' => 'Member', 'avatar' => '/uploads/member.webp'];
    if (!empty($options['guest'])) {
      unset($_SESSION['user']);
    }
    $input =
      $case === 'add'
        ? ['action' => 'add', 'postId' => '42', 'content' => 'hello world friend']
        : ['action' => 'delete', 'commentId' => $case === 'not-owner' ? '12' : '10'];
  } elseif ($endpoint === 'get_settings.php') {
    require $root . '/public/public_render_helper.php';
    require $root . '/public/api/ai_provider_helper.php';
    function voncms_public_cache_key(string $scope, array $parts): string
    {
      return $scope;
    }
    function voncms_public_cache_get(string $key, int $ttl): ?string
    {
      return null;
    }
    function voncms_public_cache_acquire_gate()
    {
      return null;
    }
    function voncms_public_cache_release_gate($gate): void {}
    function voncms_public_cache_set(...$arguments): bool
    {
      return true;
    }
    $_SERVER['REQUEST_METHOD'] = 'GET';
    if (($options['actor'] ?? null) === null) {
      unset($_SESSION['user']);
    }
    $input = [];
  } elseif ($endpoint === 'get_comments.php') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_GET = $options['query'] ?? ['flat' => 'true', 'limit' => '20'];
    $_SESSION['user'] = $options['actor'] ?? ['id' => '1', 'role' => 'Root'];
    if ($case === 'guest') {
      unset($_SESSION['user']);
    }
    $input = [];
  } elseif (in_array($endpoint, ['track_visit.php', 'track_monolithic.php'], true)) {
    foreach (['voncms_ip_matches_proxy_rule', 'voncms_is_trusted_proxy_address'] as $name) {
      eval(actionDeclaration($root . '/public/security.php', 'function ' . $name . '('));
    }
    putenv('VONCMS_TRUSTED_PROXIES');
    putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
    if (!empty($options['trackingProxy'])) {
      putenv('VONCMS_TRUSTED_PROXIES=10.42.0.0/16');
      putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=CF-Connecting-IP');
      $_SERVER['REMOTE_ADDR'] = '10.42.3.7';
    }
    define('VONCMS_ANALYTICS_TEST_KEY_FILE', $directory . '/analytics_signing.key');
    require_once $root . '/public/api/analytics_consent_helper.php';
    require_once $root . '/public/api/post_query_helper.php';
    require_once $root . '/public/api/post_views_helper.php';
    require_once $root . '/public/core/ContentViewDeduplicator.php';
    $_SERVER['SCRIPT_NAME'] = '/zangetsu/api/' . $endpoint;
    $input = ['url' => '/tracking-qa', 'postId' => '42'];
  } else {
    $_SESSION['user'] = ['id' => '1', 'role' => 'Root'];
    $input = [
      'id' => '2',
      'username' => 'qa_member',
      'email' => 'qa@example.invalid',
      'role' => 'Member',
      'display_name' => 'Updated member',
      'password' => $case === 'profile-only' ? '' : 'New1!Password',
    ];
    if ($case === 'email-change') {
      $input['email'] = 'changed@example.invalid';
    }
    if (str_starts_with($case, 'password-')) {
      $input['password'] = match ($case) {
        'password-zero' => '0',
        'password-array' => [],
        'password-object' => ['value' => 'New1!Password'],
        'password-null' => null,
        default => '',
      };
      if ($case === 'password-omitted') {
        unset($input['password']);
      }
    }
  }
  $input = array_replace($input, $options['input'] ?? []);
  if (isset($options['actor'])) {
    $_SESSION['user'] = $options['actor'];
  }
  $GLOBALS['actionNoopUpdate'] = !empty($options['noopUpdate']);
  $GLOBALS['actionFailCommit'] = !empty($options['failCommit']);
  $_SERVER['HTTP_X_CSRF_TOKEN'] = $case === 'csrf' ? 'forged' : CSRFProtection::getToken();
  $cachedInput = new ReflectionProperty(CSRFProtection::class, 'cachedInput');
  $cachedInput->setValue(null, $options['rawBody'] ?? json_encode($input, JSON_THROW_ON_ERROR));
  $source = file_get_contents($root . '/public/api/' . $endpoint);
  $source = preg_replace('/^<\?php\s*/', '', $source, 1);
  $source = preg_replace('/^\s*require_once [^\r\n]+;\s*$/m', '', $source);
  if ($endpoint === 'get_settings.php') {
    $source = str_replace(
      "__DIR__ . '/../von_config.php'",
      var_export($directory . '/config.php', true),
      $source,
    );
  }
  if ($endpoint === 'register.php') {
    // Resolve only the optional settings mirror into this disposable request fixture.
    $source = str_replace(
      "__DIR__ . '/../data/site_settings.json'",
      var_export($directory . '/site_settings.json', true),
      $source,
    );
  }
  if (!empty($options['trackingBatch'])) {
    $counts = ['success' => true, 'admitted' => 0, 'denied' => 0];
    $key = voncms_analytics_signing_key();
    for ($i = 0; $i < $options['trackingBatch']; $i++) {
      if (!empty($options['trackingProxy'])) {
        $_SERVER['HTTP_CF_CONNECTING_IP'] = $i < 250 ? '198.51.100.41' : '198.51.100.42';
      }
      $name = $i % 2 ? 'track_visit.php' : 'track_monolithic.php';
      $_SERVER['SCRIPT_NAME'] = '/zangetsu/api/' . $name;
      $_SESSION = [];
      $_SERVER['HTTP_X_CSRF_TOKEN'] = CSRFProtection::getToken();
      $_COOKIE = [
        voncms_analytics_identity_name() => voncms_analytics_signed_identity(
          bin2hex(random_bytes(32)),
          time() + 86400,
          $key,
        ),
      ];
      $cachedInput->setValue(null, json_encode($input, JSON_THROW_ON_ERROR));
      $iteration = file_get_contents($root . '/public/api/' . $name);
      $iteration = preg_replace('/^<\?php\s*/', '', $iteration, 1);
      $iteration = preg_replace('/^\s*require_once [^\r\n]+;\s*$/m', '', $iteration);
      $iteration = str_replace('exit();', 'return;', $iteration);
      ob_start();
      eval($iteration);
      $response = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
      if (empty($response['success'])) {
        throw new RuntimeException('Tracking denial changed success semantics');
      }
      $counts[!empty($response['throttled']) ? 'denied' : 'admitted']++;
    }
    echo json_encode($counts);
    exit();
  }
  if (!empty($options['unknownBatch'])) {
    // Execute the real endpoint repeatedly; replace exit only to retain this disposable worker.
    $source = str_replace('exit();', 'return;', $source);
    for ($unknownIndex = 0; $unknownIndex < $options['unknownBatch']; $unknownIndex++) {
      $input['email'] = 'unknown-' . $unknownIndex . '@example.invalid';
      $cachedInput->setValue(null, json_encode($input, JSON_THROW_ON_ERROR));
      ob_start();
      eval($source);
      $response = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
      if (empty($response['success']) || (http_response_code() ?: 200) !== 200) {
        throw new RuntimeException('Unknown recovery response changed');
      }
    }
    echo json_encode(['success' => true, 'tested' => $unknownIndex]);
    exit();
  }
  if (!empty($options['barrier'])) {
    $barrier =
      '$barrierDirectory = ' .
      var_export($directory, true) .
      ';' .
      'touch($barrierDirectory . "/ready-' .
      $index .
      '");' .
      '$deadline = microtime(true) + 15;' .
      'while (!is_file($barrierDirectory . "/release")) {' .
      'if (microtime(true) > $deadline) throw new RuntimeException("Admission barrier timeout");' .
      'usleep(10000); clearstatcache(); }';
    // Scheduler hook AFTER real admission but BEFORE input-dependent work and side effects.
    $needle =
      $endpoint === 'reset_password.php'
        ? '    // Unknown addresses allocate no state.'
        : '$input = json_decode($requestBody, true);';
    if (!str_contains($source, $needle)) {
      throw new RuntimeException('Missing admission probe point');
    }
    $source = str_replace($needle, $barrier . $needle, $source);
  }
  eval($source);
  exit();
}

$checks = 0;
function actionCheck(bool $condition, string $label): void
{
  global $checks;
  if (!$condition) {
    throw new RuntimeException($label);
  }
  $checks++;
}

$temporaryBase = getenv('VONCMS_QA_TMP') ?: sys_get_temp_dir();
$fixtureRoot = $temporaryBase . '/voncms-api-actions-' . bin2hex(random_bytes(8));
mkdir($fixtureRoot, 0700, true);
function actionFixture(string $label): string
{
  global $fixtureRoot;
  $directory = $fixtureRoot . '/' . $label;
  mkdir($directory, 0700);
  mkdir($directory . '/rates', 0700);
  $pdo = actionDatabase($directory);
  $pdo->exec('CREATE TABLE settings(setting_group TEXT,setting_key TEXT,setting_value TEXT)');
  $pdo->exec("INSERT INTO settings VALUES('newsletter','newsletter_config','{\"enabled\":true}')");
  $pdo->exec("INSERT INTO settings VALUES('general','domain_url','https://qa.invalid/blog')");
  $pdo->exec(
    "CREATE TABLE newsletter_subscribers(id INTEGER PRIMARY KEY,email TEXT UNIQUE,ip_address TEXT,source TEXT,status TEXT DEFAULT 'subscribed')",
  );
  $pdo->exec(
    'CREATE TABLE contact_forms(id TEXT PRIMARY KEY,title TEXT,template TEXT,mail_to TEXT,mail_from TEXT,mail_subject TEXT,mail_body TEXT,msg_success TEXT,msg_error TEXT,msg_validation TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  $pdo->exec(
    "INSERT INTO contact_forms(id,title,template,mail_to,mail_from,mail_subject,mail_body,msg_success,msg_error,msg_validation) VALUES('qa_form','QA','[email* your-email] [textarea* message]','owner@example.invalid','sender@example.invalid','QA','[message]','QA accepted','QA failed','QA validation')",
  );
  $pdo->exec(
    'CREATE TABLE contact_submissions(id INTEGER PRIMARY KEY,form_id TEXT,data TEXT,ip_address TEXT,user_agent TEXT,referrer TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  $pdo->exec('CREATE TABLE mail_calls(id INTEGER PRIMARY KEY,recipient TEXT,payload TEXT)');
  $pdo->exec(
    'CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,email TEXT UNIQUE,password TEXT,display_name TEXT,bio TEXT,avatar TEXT,role TEXT,email_verified INT,reset_token TEXT,reset_token_expires TEXT,verification_token TEXT,verification_token_expires TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  $pdo->exec('CREATE TABLE remember_tokens(user_id INT)');
  $pdo
    ->prepare('INSERT INTO users VALUES(2,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
    ->execute([
      'qa_member',
      'qa@example.invalid',
      password_hash('Old1!Password', PASSWORD_BCRYPT),
      'QA',
      '',
      '',
      'Member',
      1,
      str_repeat('a', 64),
      gmdate('Y-m-d H:i:s', time() + 3600),
      null,
      null,
    ]);
  $pdo->exec('INSERT INTO remember_tokens VALUES(2)');
  $pdo->exec('CREATE TABLE comments(id INTEGER PRIMARY KEY,user_id INT,parent_id INT)');
  $pdo->exec('INSERT INTO comments VALUES(10,2,NULL),(11,3,10),(12,3,NULL)');
  $pdo->exec(
    'CREATE TABLE redirects(id INTEGER PRIMARY KEY,source_url TEXT UNIQUE,target_url TEXT,redirect_type INT DEFAULT 301)',
  );
  $pdo->exec(
    "INSERT INTO redirects VALUES(1,'/first','/first-target',301),(2,'/second','/second-target',301)",
  );
  return $directory;
}

function actionRun(string $directory, array $requests): array
{
  $workers = [];
  try {
    foreach ($requests as $index => $request) {
      $options = $request + ['index' => $index];
      $process = proc_open(
        [PHP_BINARY, __FILE__, '--worker', $directory, json_encode($options, JSON_THROW_ON_ERROR)],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
      );
      if (!is_resource($process)) {
        throw new RuntimeException('Could not start isolated PHP worker');
      }
      fclose($pipes[0]);
      $workers[] = [$process, $pipes, $options];
    }
    $deadline = microtime(true) + 15;
    do {
      $settled = true;
      foreach ($workers as [, , $options]) {
        $index = $options['index'];
        if (!is_file($directory . '/done-' . $index) && !is_file($directory . '/ready-' . $index)) {
          $settled = false;
        }
      }
      if (!$settled) {
        usleep(10000);
        clearstatcache();
      }
    } while (!$settled && microtime(true) < $deadline);
    if (!$settled) {
      throw new RuntimeException('PHP worker startup/admission timeout');
    }
    touch($directory . '/release');
    $results = [];
    foreach ($workers as [$process, $pipes, $options]) {
      $stdout = stream_get_contents($pipes[1]);
      $stderr = stream_get_contents($pipes[2]);
      fclose($pipes[1]);
      fclose($pipes[2]);
      $status = proc_close($process);
      actionCheck($status === 0, 'Worker failed: ' . $stderr . $stdout);
      $result = json_decode(
        file_get_contents($directory . '/result-' . $options['index'] . '.json'),
        true,
        512,
        JSON_THROW_ON_ERROR,
      );
      actionCheck(
        !$result['fatal'] && is_array($result['body']),
        'Invalid endpoint output: ' . $result['output'],
      );
      $result['diagnostics'] = $stderr;
      $results[] = $result;
    }
    $workers = [];
    return $results;
  } finally {
    foreach ($workers as [$process, $pipes]) {
      if (is_resource($process)) {
        proc_terminate($process);
        proc_close($process);
      }
      foreach ($pipes as $pipe) {
        if (is_resource($pipe)) {
          fclose($pipe);
        }
      }
    }
  }
}

/** Read the real Settings controller/projection with isolated SQL and fixture authority. */
function actionSettingsChecks(): void
{
  $directory = actionFixture('settings-read');
  file_put_contents($directory . '/config.php', '<?php');
  $pdo = actionDatabase($directory);
  $pdo->exec("ALTER TABLE settings ADD COLUMN setting_type TEXT DEFAULT 'string'");
  $pdo->exec('CREATE TABLE posts(id INT,category TEXT,status TEXT,scheduled_at TEXT)');
  $pdo->exec(
    "INSERT INTO posts VALUES(1,'Visible','published',NULL),(2,'Private draft','draft',NULL)",
  );
  $insert = $pdo->prepare('INSERT INTO settings VALUES(?,?,?,?)');
  foreach (
    [
      ['general', 'site_name', 'Tom & Jerry', 'string'],
      [
        'general',
        'admin_profile',
        json_encode([
          'name' => 'Owner',
          'email' => 'public@example.invalid',
          'password' => 'PRIVATE_PROFILE',
        ]),
        'json',
      ],
      ['general', 'admin_palette', 'harbour-amber', 'string'],
      ['content', 'categories', '["Saved category"]', 'json'],
      ['media', 'default_view', 'grid', 'string'],
      [
        'api',
        'config',
        json_encode(['aiApiKey' => 'PRIVATE_API', 'aiModel' => 'gemini-3.8-flash']),
        'json',
      ],
      ['smtp', 'smtp_password', 'PRIVATE_SMTP', 'string'],
      ['contact', 'forms', '[{"id":"private-form"}]', 'json'],
    ]
    as $row
  ) {
    $insert->execute($row);
  }
  foreach (
    [
      null,
      ['id' => '2', 'role' => 'Member'],
      ['id' => '3', 'role' => 'Writer'],
      ['id' => '4', 'role' => 'Moderator'],
      ['id' => '5', 'role' => 'Admin'],
      ['id' => '1', 'role' => 'Root'],
    ]
    as $actor
  ) {
    $response = actionRun($directory, [['endpoint' => 'get_settings.php', 'actor' => $actor]])[0];
    $settings = $response['body'];
    $role = $actor['role'] ?? 'Guest';
    $admin = in_array($role, ['Admin', 'Root'], true);
    $staff = in_array($role, ['Writer', 'Moderator', 'Admin', 'Root'], true);
    actionCheck(
      $response['status'] === 200 && $response['diagnostics'] === '',
      'Settings failed for ' . $role . ': ' . $response['diagnostics'],
    );
    actionCheck($settings['siteName'] === 'Tom & Jerry', 'Settings changed plain text.');
    actionCheck(
      ($settings['_canManageSecrets'] ?? false) === ($role === 'Root'),
      'Settings owner hint changed.',
    );
    actionCheck(
      isset($settings['aiAssistant']) === $staff,
      'Settings staff capability projection changed.',
    );
    actionCheck(
      isset($settings['api']) === $admin && isset($settings['contactForms']) === $admin,
      'Settings exposed private configuration.',
    );
    actionCheck(
      in_array('Private draft', $settings['categories'], true) === $admin,
      'Settings category role visibility changed.',
    );
    actionCheck(
      $settings['publicCategories'] === ['Visible'],
      'Settings public category projection changed.',
    );
    actionCheck(
      $settings['adminProfile']['email'] === 'public@example.invalid',
      'Settings lost intentional public contact email.',
    );
    actionCheck(
      !str_contains($response['output'], 'PRIVATE_API'),
      'Settings leaked provider credential.',
    );
    if ($role !== 'Root') {
      actionCheck(
        !str_contains($response['output'], 'PRIVATE_SMTP') &&
          !str_contains($response['output'], 'PRIVATE_PROFILE'),
        'Settings masking failed.',
      );
    }
    if ($admin) {
      actionCheck(
        $settings['_settingsScope'] === 'admin' &&
          $settings['adminPalette'] === 'harbour-amber' &&
          $settings['media']['defaultView'] === 'grid',
        'Settings admin reconstruction changed.',
      );
    }
  }
}

/** Execute malformed-type regressions through the real endpoint bodies and SQLite. */
function actionInputValidationChecks(): void
{
  foreach (
    [
      [],
      [2],
      (object) ['id' => 2],
      true,
      false,
      -1,
      1.5,
      '1e0',
      '2suffix',
      '2147483648',
      '9999999999999999999',
    ]
    as $id
  ) {
    foreach (['delete_redirect.php', 'save_redirect.php'] as $endpoint) {
      $directory = actionFixture('redirect-id-' . bin2hex(random_bytes(4)));
      $pdo = actionDatabase($directory);
      $before = $pdo->query('SELECT * FROM redirects ORDER BY id')->fetchAll();
      $result = actionRun($directory, [['endpoint' => $endpoint, 'input' => ['id' => $id]]])[0];
      actionCheck($result['status'] === 400, $endpoint . ' accepted a malformed record ID');
      actionCheck(
        $pdo->query('SELECT * FROM redirects ORDER BY id')->fetchAll() === $before,
        $endpoint . ' changed a rule after an invalid ID',
      );
    }
  }
  foreach (
    [
      ['input' => ['id' => 2]],
      ['input' => ['id' => '2']],
      ['input' => ['id' => '0000000002']],
      ['method' => 'DELETE', 'rawBody' => '', 'query' => ['id' => '2']],
    ]
    as $request
  ) {
    $directory = actionFixture('redirect-delete-valid-' . bin2hex(random_bytes(4)));
    $result = actionRun($directory, [['endpoint' => 'delete_redirect.php'] + $request])[0];
    actionCheck($result['status'] === 200, 'Supported redirect deletion was rejected');
    actionCheck(
      actionDatabase($directory)
        ->query('SELECT id FROM redirects ORDER BY id')
        ->fetchAll(PDO::FETCH_COLUMN) === [1],
      'Redirect deletion did not preserve the unrelated first rule',
    );
  }
  foreach (
    [
      ['input' => ['id' => 0]],
      ['rawBody' => '', 'query' => ['id' => [2]]],
      ['rawBody' => '{broken', 'query' => ['id' => 2]],
      ['rawBody' => 'true', 'query' => ['id' => 2]],
      ['rawBody' => '[2]', 'query' => ['id' => 2]],
      ['case' => 'csrf'],
      ['actor' => ['id' => '2', 'role' => 'Member']],
    ]
    as $request
  ) {
    $directory = actionFixture('redirect-delete-denied-' . bin2hex(random_bytes(4)));
    $result = actionRun($directory, [['endpoint' => 'delete_redirect.php'] + $request])[0];
    actionCheck(
      $result['status'] === (isset($request['case']) || isset($request['actor']) ? 403 : 400),
      'Redirect delete validation or denial order changed',
    );
    actionCheck(
      (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM redirects')->fetchColumn() ===
        2,
      'Rejected redirect deletion changed rows',
    );
  }
  foreach (['source_url', 'target_url', 'redirect_type'] as $field) {
    foreach ([[], (object) ['invalid' => true], true, 1.5] as $value) {
      $directory = actionFixture('redirect-field-' . bin2hex(random_bytes(4)));
      $result = actionRun($directory, [
        ['endpoint' => 'save_redirect.php', 'input' => [$field => $value]],
      ])[0];
      actionCheck(
        $result['status'] === 400,
        'Compound/wrong redirect field was not rejected: ' . $field,
      );
      actionCheck(
        (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM redirects')->fetchColumn() ===
          2,
        'Invalid redirect fields wrote a rule',
      );
    }
  }
  foreach ([null, '', 0, '0'] as $createId) {
    $directory = actionFixture('redirect-create-' . bin2hex(random_bytes(4)));
    $result = actionRun($directory, [
      ['endpoint' => 'save_redirect.php', 'input' => ['id' => $createId, 'redirect_type' => '308']],
    ])[0];
    actionCheck($result['status'] === 200, 'Legacy redirect create sentinel changed');
    actionCheck(
      (int) actionDatabase($directory)
        ->query("SELECT redirect_type FROM redirects WHERE source_url='/new'")
        ->fetchColumn() === 308,
      'Valid redirect type changed',
    );
  }
  foreach (['update', 'loop', 'csrf', 'member'] as $case) {
    $directory = actionFixture('redirect-save-' . $case);
    $request = [
      'endpoint' => 'save_redirect.php',
      'input' => ['id' => 2, 'source_url' => '/second', 'target_url' => '/changed'],
    ];
    if ($case === 'loop') {
      $request['input'] = ['id' => null, 'source_url' => '/first-target', 'target_url' => '/first'];
    }
    if ($case === 'csrf') {
      $request['case'] = 'csrf';
    }
    if ($case === 'member') {
      $request['actor'] = ['id' => '2', 'role' => 'Member'];
    }
    $result = actionRun($directory, [$request])[0];
    actionCheck(
      $result['status'] === ($case === 'update' ? 200 : ($case === 'loop' ? 400 : 403)),
      'Redirect save control failed: ' . $case,
    );
    actionCheck(
      actionDatabase($directory)
        ->query('SELECT target_url FROM redirects WHERE id=2')
        ->fetchColumn() === ($case === 'update' ? '/changed' : '/second-target'),
      'Redirect control changed the wrong state: ' . $case,
    );
  }
  foreach ([[], ['bad'], (object) ['text' => 'bad'], true, 42] as $bio) {
    $directory = actionFixture('profile-bio-invalid-' . bin2hex(random_bytes(4)));
    $pdo = actionDatabase($directory);
    $before = $pdo->query('SELECT * FROM users WHERE id=2')->fetch();
    $result = actionRun($directory, [
      ['endpoint' => 'update_profile.php', 'input' => ['bio' => $bio]],
    ])[0];
    actionCheck($result['status'] === 400, 'Non-text bio was accepted');
    actionCheck(
      $pdo->query('SELECT * FROM users WHERE id=2')->fetch() === $before,
      'Rejected bio changed profile/password/token',
    );
    actionCheck(
      (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 1,
      'Rejected bio revoked remember token',
    );
  }
  foreach (['R&D 名 <example> &amp;', '', null] as $bio) {
    $directory = actionFixture('profile-bio-valid-' . bin2hex(random_bytes(4)));
    $result = actionRun($directory, [
      ['endpoint' => 'update_profile.php', 'case' => 'profile-only', 'input' => ['bio' => $bio]],
    ])[0];
    actionCheck($result['status'] === 200, 'Supported profile bio was rejected');
    actionCheck(
      actionDatabase($directory)->query('SELECT bio FROM users WHERE id=2')->fetchColumn() ===
        ($bio ?? ''),
      'Profile plain text/empty bio changed',
    );
  }
}

/** Baseline contracts for the type-only managed-user cleanup. No live accounts. */
function actionManagedContractChecks(): void
{
  foreach ([false, true] as $create) {
    foreach (
      ['Member', 'Writer', 'Moderator', 'Admin', '', null, 'Root', 'unknown', '0']
      as $role
    ) {
      $directory = actionFixture('managed-contract-' . bin2hex(random_bytes(4)));
      $pdo = actionDatabase($directory);
      $before = $pdo->query('SELECT * FROM users WHERE id=2')->fetch();
      $allowed = !in_array($role, ['Root', 'unknown', '0'], true);
      $input = ['role' => $role];
      if ($create) {
        $input += [
          'id' => '',
          'username' => 'qa_create',
          'email' => 'created@example.invalid',
          'password' => 'Create1!Password',
        ];
      }
      $result = actionRun($directory, [
        ['endpoint' => 'save_user.php', 'case' => 'profile-only', 'input' => $input],
      ])[0];
      actionCheck(
        $result['status'] === ($allowed ? 200 : 400),
        'Managed role contract changed: ' . json_encode([$create, $role]),
      );
      actionCheck(
        (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() ===
          ($create && $allowed ? 2 : 1),
        'Managed role create count changed.',
      );
      if ($create || !$allowed) {
        actionCheck(
          $pdo->query('SELECT * FROM users WHERE id=2')->fetch() === $before,
          'Managed role request changed an unrelated/rejected account.',
        );
      } else {
        actionCheck(
          $pdo->query('SELECT role FROM users WHERE id=2')->fetchColumn() ===
            ($role === '' || $role === null ? 'Member' : $role),
          'Managed role value changed.',
        );
        actionCheck(
          $pdo->query('SELECT password FROM users WHERE id=2')->fetchColumn() ===
            $before['password'],
          'Profile-only role edit changed password.',
        );
      }
    }
  }
  foreach (['Root', 'Admin', 'Moderator', 'Writer', 'Member', 'guest'] as $actorRole) {
    foreach ([false, true] as $create) {
      foreach (['', 'Member', 'Admin'] as $requestedRole) {
        $directory = actionFixture('managed-actor-' . bin2hex(random_bytes(4)));
        $pdo = actionDatabase($directory);
        $before = $pdo->query('SELECT * FROM users WHERE id=2')->fetch();
        $actor = ['id' => $actorRole === 'Root' ? '1' : '3', 'role' => $actorRole];
        $allowed = $actorRole === 'Root' || ($actorRole === 'Admin' && $requestedRole !== 'Admin');
        $input = ['role' => $requestedRole];
        if ($create) {
          $input += [
            'id' => '',
            'username' => 'qa_create',
            'email' => 'created@example.invalid',
            'password' => 'Create1!Password',
          ];
        }
        $result = actionRun($directory, [
          [
            'endpoint' => 'save_user.php',
            'case' => 'profile-only',
            'actor' => $actor,
            'input' => $input,
          ],
        ])[0];
        actionCheck(
          $result['status'] === ($allowed ? 200 : 403),
          'Actor create/update role boundary changed: ' .
            json_encode([$actorRole, $create, $requestedRole]),
        );
        actionCheck(
          (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() ===
            ($create && $allowed ? 2 : 1),
          'Actor role denial allocated an account.',
        );
        if (!$allowed || $create) {
          actionCheck(
            $pdo->query('SELECT * FROM users WHERE id=2')->fetch() === $before,
            'Actor role denial/create changed an existing account.',
          );
        }
      }
    }
  }
  foreach (
    [
      ['Admin', '2', 'Admin', '', 200],
      ['Admin', '2', 'Admin', 'Member', 403],
      ['Root', '1', 'Root', '', 200],
      ['Admin', '3', 'Root', '', 403],
    ]
    as [$actorRole, $actorId, $storedRole, $requestedRole, $status]
  ) {
    $directory = actionFixture('managed-preserve-' . bin2hex(random_bytes(4)));
    $pdo = actionDatabase($directory);
    $pdo->prepare('UPDATE users SET role=? WHERE id=2')->execute([$storedRole]);
    $result = actionRun($directory, [
      [
        'endpoint' => 'save_user.php',
        'case' => 'profile-only',
        'actor' => ['id' => $actorId, 'role' => $actorRole],
        'input' => ['role' => $requestedRole],
      ],
    ])[0];
    actionCheck($result['status'] === $status, 'Existing protected role preservation changed.');
    actionCheck(
      $pdo->query('SELECT role FROM users WHERE id=2')->fetchColumn() === $storedRole,
      'Protected/self role changed.',
    );
  }
  foreach (['zero', 'array', 'object', 'null', 'omitted'] as $kind) {
    $directory = actionFixture('managed-contract-password-' . $kind);
    $pdo = actionDatabase($directory);
    $before = $pdo->query('SELECT password,reset_token FROM users WHERE id=2')->fetch();
    $result = actionRun($directory, [
      ['endpoint' => 'save_user.php', 'case' => 'password-' . $kind],
    ])[0];
    actionCheck(
      $result['status'] === (in_array($kind, ['null', 'omitted'], true) ? 200 : 400),
      'Managed password validation contract changed: ' . $kind,
    );
    actionCheck(
      $pdo->query('SELECT password,reset_token FROM users WHERE id=2')->fetch() === $before &&
        (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 1,
      'Rejected/omitted managed password changed credentials.',
    );
  }
}

/** Exercise comment authority and owner-only field filtering without live configuration. */
function actionRoleBoundaryChecks(): void
{
  $actors = [
    'Guest' => null,
    'Member' => ['id' => '2', 'role' => 'Member'],
    'Writer' => ['id' => '6', 'role' => 'Writer'],
    'Moderator' => ['id' => '4', 'role' => 'Moderator'],
    'Admin' => ['id' => '5', 'role' => 'Admin'],
    'Root' => ['id' => '1', 'role' => 'Root'],
  ];

  foreach ($actors as $role => $actor) {
    foreach (['delete', 'updateStatus'] as $action) {
      foreach ([false, true] as $ownComment) {
        if ($actor === null && $ownComment) {
          continue;
        }
        $directory = actionFixture(
          'comment-role-' . strtolower($role) . '-' . $action . '-' . (int) $ownComment,
        );
        $pdo = actionDatabase($directory);
        $pdo->exec("ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'pending'");
        $pdo->exec("INSERT INTO comments VALUES(13,4,12,'pending')");
        if ($ownComment) {
          $pdo->prepare('UPDATE comments SET user_id=? WHERE id=12')->execute([$actor['id']]);
        }
        $before = $pdo->query('SELECT * FROM comments ORDER BY id')->fetchAll();
        $request = [
          'endpoint' => 'save_comments.php',
          'input' => ['action' => $action, 'commentId' => 12, 'status' => 'approved'],
        ];
        if ($actor === null) {
          $request['guest'] = true;
        } else {
          $request['actor'] = $actor;
        }
        $result = actionRun($directory, [$request])[0];
        $reviewer = in_array($role, ['Root', 'Admin', 'Moderator'], true);
        $allowed = $reviewer || ($action === 'delete' && $ownComment);
        actionCheck(
          $allowed ? $result['status'] === 200 : in_array($result['status'], [401, 403], true),
          'Comment role decision: ' . $role . '/' . $action . '/' . (int) $ownComment,
        );
        if (!$allowed) {
          actionCheck(
            $pdo->query('SELECT * FROM comments ORDER BY id')->fetchAll() === $before,
            'Denied comment mutation changed rows: ' . $role . '/' . $action,
          );
        } elseif ($action === 'delete') {
          actionCheck(
            $pdo->query('SELECT id FROM comments ORDER BY id')->fetchAll(PDO::FETCH_COLUMN) === [
              10,
              11,
            ],
            'Allowed deletion must remove only the selected parent and replies',
          );
        } else {
          actionCheck(
            $pdo->query('SELECT status FROM comments WHERE id=12')->fetchColumn() === 'approved' &&
              $pdo->query('SELECT status FROM comments WHERE id=13')->fetchColumn() === 'pending',
            'Allowed moderation must update only the selected comment',
          );
        }
        $pdo = null;
      }
    }
  }

  $directory = actionFixture('comment-role-forged-csrf');
  $pdo = actionDatabase($directory);
  $pdo->exec("ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'pending'");
  $before = $pdo->query('SELECT * FROM comments ORDER BY id')->fetchAll();
  $result = actionRun($directory, [
    [
      'endpoint' => 'save_comments.php',
      'case' => 'csrf',
      'actor' => $actors['Moderator'],
      'input' => ['action' => 'updateStatus', 'commentId' => 12, 'status' => 'approved'],
    ],
  ])[0];
  actionCheck($result['status'] === 403, 'Reviewer still requires valid CSRF');
  actionCheck(
    $pdo->query('SELECT * FROM comments ORDER BY id')->fetchAll() === $before,
    'Forged CSRF must not change a comment',
  );
  $pdo = null;

  global $root;
  eval(
    actionDeclaration(
      $root . '/public/api/save_settings.php',
      'function voncms_guard_restricted_settings_for_non_primary_admin(',
    )
  );
  foreach ([true, false] as $enabled) {
    $settings = ['indexnowEnabled' => $enabled];
    $ignored = voncms_guard_restricted_settings_for_non_primary_admin($settings);
    actionCheck(
      $settings === [] && $ignored === ['indexnowEnabled'],
      'Both IndexNow toggle values are owner-only',
    );
    $settings = ['siteName' => 'Delegated site title', 'indexnowEnabled' => $enabled];
    $ignored = voncms_guard_restricted_settings_for_non_primary_admin($settings);
    actionCheck(
      $settings === ['siteName' => 'Delegated site title'] && $ignored === ['indexnowEnabled'],
      'Mixed delegated saves retain allowed fields without changing the owner toggle',
    );
  }
}

try {
  actionRoleBoundaryChecks();
  if (($argv[1] ?? '') === '--role-boundaries') {
    echo 'PASS Role Boundaries: ' .
      $checks .
      " checks (real comment controller/SQLite, fixture sessions/real CSRF; actual owner-field guard).\n";
    return;
  }
  actionSettingsChecks();
  if (($argv[1] ?? '') === '--settings-read') {
    echo 'PASS Settings read contracts: ' .
      $checks .
      " checks (actual controller/projection, SQLite, fixture authority).\n";
    return;
  }
  actionManagedContractChecks();
  if (($argv[1] ?? '') === '--managed-validation') {
    echo 'PASS Managed User Contracts: ' .
      $checks .
      " checks (real endpoint bodies/SQLite; fixture authority).\n";
    return;
  }
  actionInputValidationChecks();
  if (($argv[1] ?? '') === '--input-validation') {
    echo 'PASS Input Validation: ' .
      $checks .
      " checks (real endpoint bodies/SQLite; fixture sessions, real CSRF).\n";
    return;
  }
  $normalizer = actionDeclaration(
    $root . '/public/api/save_settings.php',
    "if (\$jsonKey === 'spamKeywords')",
  );
  $jsonKey = 'spamKeywords';
  $value = 'Casino, casino,, ÉCOLE, école,0,';
  eval($normalizer);
  actionCheck(
    $value === 'casino, école, 0',
    'Settings normalizes empty, repeated and Unicode keywords without dropping zero',
  );
  actionCheck(
    ($settings['spamKeywords'] ?? null) === $value,
    'Settings mirror receives the same normalized keyword list',
  );
  foreach (
    [
      ['casino,,', 'hello world friend', 'approved', ''],
      [' , , ', 'hello world friend', 'approved', ''],
      ['casino,', 'hello casino friend', 'pending', ''],
      ['ÉCOLE,', 'une école ouverte', 'pending', ''],
      ['0', 'hello 0 friend', 'pending', ''],
      ['0', 'hello casino friend', 'approved', ''],
      ['casino,,', 'hello world friend', 'spam', 'bot'],
    ]
    as $index => [$keywords, $content, $expected, $honeypot]
  ) {
    $directory = actionFixture('comment-keywords-' . $index);
    $pdo = actionDatabase($directory);
    $pdo->exec('DROP TABLE comments');
    $pdo->exec(
      'CREATE TABLE comments(id INTEGER PRIMARY KEY,post_id INT,user_id INT,parent_id INT,user_name TEXT,user_avatar TEXT,content TEXT,likes INT,status TEXT,created_at TEXT)',
    );
    $pdo->exec('CREATE TABLE posts(id INT,status TEXT,scheduled_at TEXT)');
    $pdo->exec("INSERT INTO posts VALUES(42,'published',NULL)");
    $pdo->prepare("INSERT INTO settings VALUES('general','spam_keywords',?)")->execute([$keywords]);
    $result = actionRun($directory, [
      [
        'endpoint' => 'save_comments.php',
        'case' => 'add',
        'input' => ['content' => $content, 'hp_field' => $honeypot],
      ],
    ])[0];
    actionCheck(
      $result['status'] === 200 && ($result['body']['status'] ?? '') === $expected,
      'Real comment add retains expected keyword verdict: ' . $index,
    );
    actionCheck(
      $pdo->query('SELECT status FROM comments')->fetchColumn() === $expected,
      'Persisted comment keyword verdict: ' . $index,
    );
    $pdo = null;
  }
  $directory = actionFixture('tracking-shared-budget');
  foreach ([true, false] as $guest) {
    $avatarDirectory = actionFixture('comment-avatar-' . (int) $guest);
    $avatarDb = actionDatabase($avatarDirectory);
    $avatarDb->exec('DROP TABLE comments');
    $avatarDb->exec(
      'CREATE TABLE comments(id INTEGER PRIMARY KEY,post_id INT,user_id INT,parent_id INT,user_name TEXT,user_avatar TEXT,content TEXT,likes INT,status TEXT,created_at TEXT)',
    );
    $avatarDb->exec('CREATE TABLE posts(id INT,status TEXT,scheduled_at TEXT)');
    $avatarDb->exec("INSERT INTO posts VALUES(42,'published',NULL)");
    $result = actionRun($avatarDirectory, [
      [
        'endpoint' => 'save_comments.php',
        'case' => 'add',
        'guest' => $guest,
        'input' => ['userAvatar' => 'https://tracking.example.invalid/pixel'],
      ],
    ])[0];
    actionCheck($result['status'] === 200, 'Ordinary guest/member comment remains accepted');
    actionCheck(
      $avatarDb->query('SELECT user_avatar FROM comments')->fetchColumn() ===
        ($guest ? '' : '/uploads/member.webp'),
      'Guest avatar ignored; member avatar comes from the session',
    );
    $avatarDb = null;
  }
  $pdo = actionDatabase($directory);
  $pdo->exec(
    'CREATE TABLE analytics(id INTEGER PRIMARY KEY,page_url TEXT,referrer TEXT,user_agent TEXT,ip_hash TEXT,visit_date TEXT,visit_time TEXT,created_at TEXT,measurement_mode TEXT)',
  );
  $pdo->exec(
    'CREATE TABLE analytics_sessions(visitor_hash TEXT PRIMARY KEY,last_seen INT,expires_at INT)',
  );
  $pdo->exec('CREATE TABLE posts(id INT PRIMARY KEY,status TEXT,views INT,updated_at TEXT)');
  $pdo->exec("INSERT INTO posts VALUES(42,'published',0,'2026-10-24 00:00:00')");
  $pdo->exec(
    "INSERT INTO settings VALUES('plugins','active_plugins','[\"vp_analytics\"]'),('analytics','config','{\"measurementMode\":\"balanced\"}')",
  );
  $result = actionRun($directory, [
    ['endpoint' => 'track_monolithic.php', 'trackingBatch' => 500],
  ])[0];
  actionCheck(
    ($result['body']['admitted'] ?? 0) === 120 && ($result['body']['denied'] ?? 0) === 380,
    '500 mixed tracking endpoint calls share 120 POST admissions',
  );
  actionCheck(
    (int) $pdo->query('SELECT COUNT(*) FROM analytics')->fetchColumn() === 120,
    'Denied tracking calls cannot add analytics rows',
  );
  actionCheck(
    (int) $pdo->query('SELECT views FROM posts')->fetchColumn() === 60,
    'New guest sessions cannot inflate content views after the shared quota',
  );
  actionCheck(
    $pdo->query('SELECT updated_at FROM posts')->fetchColumn() === '2026-10-24 00:00:00',
    'Tracking admission preserves editorial timestamps',
  );
  $result = actionRun($directory, [
    ['endpoint' => 'track_monolithic.php', 'trackingBatch' => 500, 'trackingProxy' => true],
  ])[0];
  actionCheck(
    ($result['body']['admitted'] ?? 0) === 240 && ($result['body']['denied'] ?? 0) === 260,
    'Both actual POST routes give independent budgets to two clients behind one opted-in proxy',
  );
  actionCheck(
    (int) $pdo->query('SELECT COUNT(*) FROM analytics')->fetchColumn() === 360 &&
      (int) $pdo->query('SELECT views FROM posts')->fetchColumn() === 180,
    'Proxy-resolved admission bounds both analytics rows and content views',
  );
  file_put_contents($directory . '/analytics_signing.key', 'invalid');
  $result = actionRun($directory, [
    ['endpoint' => 'track_monolithic.php', 'case' => 'normal', 'ip' => '198.51.100.250'],
  ])[0];
  actionCheck(
    $result['status'] === 200 &&
      ($result['body']['view'] ?? false) &&
      !($result['body']['visit'] ?? true),
    'Optional signing failure preserves admitted content views without recording analytics',
  );
  actionCheck(
    (int) $pdo->query('SELECT views FROM posts')->fetchColumn() === 181,
    'Optional analytics failure does not suppress the ordinary content counter',
  );
  $pdo = null;
  foreach (['voncms_account_token_digest', 'voncms_account_token_matches'] as $name) {
    eval(actionDeclaration($root . '/public/api/mail_helper.php', 'function ' . $name . '('));
  }
  foreach (['legacy', 'digest'] as $format) {
    $directory = actionFixture('account-token-' . $format);
    $pdo = actionDatabase($directory);
    $raw = bin2hex(random_bytes(32));
    $stored = $format === 'digest' ? voncms_account_token_digest($raw) : $raw;
    actionCheck(
      strlen($stored) <= 64 && ($format !== 'digest' || $stored !== $raw),
      'Token storage format',
    );
    $pdo->prepare('UPDATE users SET reset_token=? WHERE id=2')->execute([$stored]);
    if ($format === 'digest') {
      foreach ([$stored, hash('sha256', $raw)] as $stolenRepresentation) {
        $result = actionRun($directory, [
          [
            'endpoint' => 'reset_password.php',
            'input' => [
              'action' => 'reset',
              'token' => $stolenRepresentation,
              'password' => 'New1!Password',
            ],
          ],
        ])[0];
        actionCheck(
          $result['status'] === 400 &&
            $pdo->query('SELECT reset_token FROM users WHERE id=2')->fetchColumn() === $stored,
          'Stored token digest or decoded digest cannot authorize reset',
        );
      }
    }
    $result = actionRun($directory, [
      [
        'endpoint' => 'reset_password.php',
        'input' => [
          'action' => 'reset',
          'token' => $raw,
          'password' => 'New1!Password',
        ],
      ],
    ])[0];
    actionCheck(
      $result['status'] === 200 &&
        password_verify(
          'New1!Password',
          $pdo->query('SELECT password FROM users WHERE id=2')->fetchColumn(),
        ),
      'Reset succeeds using the emailed raw secret: ' . $format,
    );
    actionCheck(
      $pdo->query('SELECT reset_token FROM users WHERE id=2')->fetchColumn() === null &&
        (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 0,
      'Reset consumes token and revokes remember credentials',
    );
    actionCheck(
      actionRun($directory, [
        [
          'endpoint' => 'reset_password.php',
          'input' => [
            'action' => 'reset',
            'token' => $raw,
            'password' => 'Other1!Password',
          ],
        ],
      ])[0]['status'] === 400,
      'Consumed reset cannot replay',
    );
    $pdo
      ->prepare(
        'UPDATE users SET email_verified=0,verification_token=?,verification_token_expires=? WHERE id=2',
      )
      ->execute([
        $stored,
        $format === 'digest'
          ? gmdate('Y-m-d H:i:s', time() + 3600)
          : date('Y-m-d H:i:s', time() + 3600),
      ]);
    if ($format === 'digest') {
      actionRun($directory, [['endpoint' => 'verify_email.php', 'token' => $stored]]);
      actionCheck(
        (int) $pdo->query('SELECT email_verified FROM users WHERE id=2')->fetchColumn() === 0,
        'Stored verification digest cannot authorize verification',
      );
    }
    $verified = actionRun($directory, [
      ['endpoint' => 'verify_email.php', 'token' => $raw],
      ['endpoint' => 'verify_email.php', 'token' => $raw],
    ]);
    actionCheck(
      count(
        array_filter(
          $verified,
          fn($row) => str_contains($row['body']['html'], 'Email verified successfully!'),
        ),
      ) === 1,
      'One verification succeeds under duplicate requests: ' . $format,
    );
    actionCheck(
      (int) $pdo->query('SELECT email_verified FROM users WHERE id=2')->fetchColumn() === 1 &&
        $pdo->query('SELECT verification_token FROM users WHERE id=2')->fetchColumn() === null,
      'Verification consumes the stored credential',
    );
    $pdo
      ->prepare(
        'UPDATE users SET email_verified=0,verification_token=?,verification_token_expires=? WHERE id=2',
      )
      ->execute([
        $stored,
        $format === 'digest'
          ? gmdate('Y-m-d H:i:s', time() - 3600)
          : date('Y-m-d H:i:s', time() - 3600),
      ]);
    actionRun($directory, [['endpoint' => 'verify_email.php', 'token' => $raw]]);
    actionCheck(
      (int) $pdo->query('SELECT email_verified FROM users WHERE id=2')->fetchColumn() === 0,
      'Expired verification credential is rejected',
    );
  }
  foreach (['legacy', 'digest'] as $format) {
    foreach (['UTC', 'Pacific/Honolulu', 'Asia/Kuala_Lumpur'] as $zone) {
      foreach ([3600, -3600] as $remaining) {
        $directory = actionFixture(
          'verification-clock-' .
            $format .
            '-' .
            str_replace('/', '-', $zone) .
            '-' .
            ($remaining > 0 ? 'valid' : 'expired'),
        );
        $pdo = actionDatabase($directory);
        $raw = bin2hex(random_bytes(32));
        $stored = $format === 'digest' ? voncms_account_token_digest($raw) : $raw;
        $expiryZone = new DateTimeZone($format === 'digest' ? 'UTC' : $zone);
        $expiry = (new DateTimeImmutable('@' . (time() + $remaining)))
          ->setTimezone($expiryZone)
          ->format('Y-m-d H:i:s');
        $pdo
          ->prepare(
            'UPDATE users SET email_verified=0,verification_token=?,verification_token_expires=? WHERE id=2',
          )
          ->execute([$stored, $expiry]);
        actionRun($directory, [
          ['endpoint' => 'verify_email.php', 'token' => $raw, 'phpTimezone' => $zone],
        ]);
        actionCheck(
          (int) $pdo->query('SELECT email_verified FROM users WHERE id=2')->fetchColumn() ===
            (int) ($remaining > 0),
          'Verification preserves ' . $format . ' expiry with PHP zone ' . $zone,
        );
      }
    }
  }
  // Preserve baseline strtotime semantics in a repeated DST hour, not wall-string ordering.
  $verificationSource = file_get_contents($root . '/public/api/verify_email.php');
  preg_match(
    '/\x27(UPDATE users SET email_verified = 1[^\x27]+)\x27/',
    $verificationSource,
    $consumeMatch,
  );
  $legacyStart = strpos($verificationSource, '  $legacyExpiry = 0;');
  $legacyEnd = strpos($verificationSource, '  // Mark email as verified', $legacyStart ?: 0);
  actionCheck(
    isset($consumeMatch[1]) && $legacyStart !== false && $legacyEnd !== false,
    'Actual verification expiry controls can be inspected',
  );
  $legacyValidation = substr($verificationSource, $legacyStart, $legacyEnd - $legacyStart);
  foreach (
    ['2026-11-01 05:15:00 UTC' => true, '2026-11-01 06:15:00 UTC' => false]
    as $reference => $valid
  ) {
    $epoch = (new DateTimeImmutable($reference))->getTimestamp();
    $directory = actionFixture('verification-dst-' . ($valid ? 'valid' : 'expired'));
    $pdo = actionDatabase($directory);
    $pdo->createFunction('UNIX_TIMESTAMP', fn(): int => $epoch);
    $raw = bin2hex(random_bytes(32));
    $expiry = '2026-11-01 01:30:00';
    $zoneBefore = date_default_timezone_get();
    date_default_timezone_set('America/New_York');
    $expiryEpoch = strtotime($expiry);
    date_default_timezone_set($zoneBefore);
    $program =
      'namespace VerifyLegacyClockFixture; date_default_timezone_set("America/New_York");' .
      'function time(): int { return ' .
      $epoch .
      '; } function showResult(bool $success,string $message): void {echo !$success && $message!=="" ? "rejected" : "allowed";}' .
      '$token=' .
      var_export($raw, true) .
      ';$user=' .
      var_export(['verification_token' => $raw, 'verification_token_expires' => $expiry], true) .
      ';' .
      $legacyValidation .
      'echo "allowed";';
    $pipes = [];
    $process = proc_open(
      [PHP_BINARY, '-r', $program],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    if (!is_resource($process)) {
      throw new RuntimeException('Cannot start controlled verification clock fixture');
    }
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    actionCheck(
      proc_close($process) === 0 && $errors === '' && $output === ($valid ? 'allowed' : 'rejected'),
      'Real legacy PHP validation preserves DST absolute expiry',
    );
    $pdo
      ->prepare(
        'UPDATE users SET email_verified=0,verification_token=?,verification_token_expires=? WHERE id=2',
      )
      ->execute([$raw, $expiry]);
    $consume = $pdo->prepare($consumeMatch[1]);
    $consume->execute([
      2,
      voncms_account_token_digest($raw),
      $raw,
      voncms_account_token_digest($raw),
      $raw,
      $expiry,
      $expiryEpoch,
    ]);
    actionCheck(
      $consume->rowCount() === (int) $valid,
      'Atomic legacy consumption preserves DST absolute expiry',
    );
  }
  foreach (['save_post.php', 'save_page.php'] as $endpoint) {
    foreach (['root', 'moderator'] as $role) {
      $directory = actionFixture(pathinfo($endpoint, PATHINFO_FILENAME) . '-inline-' . $role);
      $rejected = actionRun($directory, [['endpoint' => $endpoint, 'role' => $role]])[0];
      actionCheck(
        $rejected['status'] === 400 &&
          str_contains($rejected['body']['error'] ?? '', 'Media Library'),
        $endpoint .
          ': inline images must produce a clear validation error before the unavailable-database guard.',
      );
      $control = actionRun($directory, [
        [
          'endpoint' => $endpoint,
          'role' => $role,
          'case' => 'uploaded-image',
        ],
      ])[0];
      actionCheck(
        $control['status'] === 503,
        $endpoint .
          ': ordinary uploads must pass content validation to the unavailable-database guard.',
      );
    }
  }
  foreach (['submit_contact.php', 'newsletter_subscribe.php'] as $endpoint) {
    $directory = actionFixture(pathinfo($endpoint, PATHINFO_FILENAME));
    $requests = array_fill(0, 8, ['endpoint' => $endpoint, 'barrier' => true]);
    $results = actionRun($directory, $requests);
    actionCheck(
      count(
        array_filter($results, fn($r) => $r['status'] === 200 && !empty($r['body']['success'])),
      ) === 5,
      $endpoint .
        ': quota exceeded or ordinary requests blocked: ' .
        json_encode($results) .
        ' storage=' .
        json_encode(array_map('file_get_contents', glob($directory . '/rates/*.json'))),
    );
    actionCheck(
      count(array_filter($results, fn($r) => $r['status'] === 429)) === 3,
      $endpoint . ': overflow did not return 429',
    );
    $pdo = actionDatabase($directory);
    $table = $endpoint === 'submit_contact.php' ? 'mail_calls' : 'newsletter_subscribers';
    actionCheck(
      (int) $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() === 5,
      $endpoint . ': wrong side-effect count',
    );
    if ($endpoint === 'submit_contact.php') {
      actionCheck(
        (int) $pdo->query('SELECT COUNT(*) FROM contact_submissions')->fetchColumn() === 5,
        'Contact lead count exceeded quota',
      );
      actionCheck(
        $pdo->query('SELECT DISTINCT recipient FROM mail_calls')->fetchAll(PDO::FETCH_COLUMN) === [
          'owner@example.invalid',
        ],
        'Contact recipient changed',
      );
    }
    actionCheck(count(glob($directory . '/rates/*.json')) === 1, 'Action quota crossed namespaces');
  }

  foreach (['submit_contact.php', 'newsletter_subscribe.php'] as $endpoint) {
    foreach (['csrf', 'bot', 'invalid'] as $case) {
      $directory = actionFixture(pathinfo($endpoint, PATHINFO_FILENAME) . '-' . $case);
      $result = actionRun($directory, [['endpoint' => $endpoint, 'case' => $case]])[0];
      $expectedStatus =
        $case === 'csrf'
          ? 403
          : ($case === 'bot' && $endpoint === 'submit_contact.php'
            ? 200
            : 400);
      actionCheck(
        $result['status'] === $expectedStatus,
        'Existing rejection changed: ' . $endpoint . '/' . $case,
      );
      $pdo = actionDatabase($directory);
      foreach (['mail_calls', 'contact_submissions', 'newsletter_subscribers'] as $table) {
        actionCheck(
          (int) $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() === 0,
          'Rejected input reached side effect',
        );
      }
      $files = glob($directory . '/rates/*.json');
      actionCheck(
        count($files) === ($case === 'csrf' ? 0 : 1),
        'Quota missing or charged before CSRF',
      );
      if ($files) {
        actionCheck(
          json_decode(file_get_contents($files[0]), true)['attempts'] === 1,
          'Attempt charged more than once',
        );
      }
    }
  }
  $directory = actionFixture('newsletter-disabled');
  actionDatabase($directory)->exec("UPDATE settings SET setting_value='{\"enabled\":false}'");
  actionCheck(
    actionRun($directory, [['endpoint' => 'newsletter_subscribe.php']])[0]['status'] === 403,
    'Disabled newsletter admitted',
  );
  actionCheck(glob($directory . '/rates/*.json') === [], 'Disabled feature charged quota');

  $directory = actionFixture('contact-cooldown');
  $first = actionRun($directory, [
    ['endpoint' => 'submit_contact.php', 'session' => 'cooldown'],
  ])[0];
  $second = actionRun($directory, [
    ['endpoint' => 'submit_contact.php', 'session' => 'cooldown'],
  ])[0];
  actionCheck(
    $first['status'] === 200 && $second['status'] === 429,
    'Contact session cooldown changed',
  );
  actionCheck(
    (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === 1,
    'Cooldown allowed another mail',
  );

  $directory = actionFixture('contact-mail-failure');
  $failedMail = actionRun($directory, [
    ['endpoint' => 'submit_contact.php', 'case' => 'mail-failure', 'session' => 'saved'],
  ])[0];
  actionCheck(
    $failedMail['status'] === 200 &&
      $failedMail['body']['success'] === true &&
      str_contains($failedMail['body']['message'], 'received'),
    'Stored lead must remain accepted without claiming email delivery',
  );
  $retry = actionRun($directory, [['endpoint' => 'submit_contact.php', 'session' => 'saved']])[0];
  actionCheck(
    $retry['status'] === 429 &&
      (int) actionDatabase($directory)
        ->query('SELECT COUNT(*) FROM contact_submissions')
        ->fetchColumn() === 1,
    'Mail failure permitted duplicate receipt',
  );
  $quota = json_decode(file_get_contents(glob($directory . '/rates/*.json')[0]), true);
  actionCheck($quota['attempts'] === 1, 'Failed delivery was not charged exactly once');

  $directory = actionFixture('contact-session-release');
  actionRun($directory, [['endpoint' => 'submit_contact.php', 'case' => 'session-probe']]);
  $payload = json_decode(
    actionDatabase($directory)->query('SELECT payload FROM mail_calls')->fetchColumn(),
    true,
  );
  actionCheck(
    !$payload['sessionActive'] &&
      ($payload['probe']['cooldown'] ?? false) &&
      ($payload['probe']['used'] ?? 0) === 1,
    'Session must be available during mail with nonce and cooldown already persisted',
  );

  foreach (['normal', 'mail-failure', 'newer-claim'] as $case) {
    $directory = actionFixture('contact-storage-failure-' . $case);
    $pdo = actionDatabase($directory);
    $schema = $pdo
      ->query("SELECT sql FROM sqlite_master WHERE name='contact_submissions'")
      ->fetchColumn();
    $pdo->exec('DROP TABLE contact_submissions');
    $result = actionRun($directory, [
      ['endpoint' => 'submit_contact.php', 'case' => $case, 'session' => 'recovery'],
    ])[0];
    actionCheck(
      $result['status'] === ($case === 'normal' ? 200 : 502),
      'Storage/mail outcome contract changed',
    );
    if ($case === 'mail-failure') {
      actionCheck(
        !$result['contactSession']['cooldown'] && $result['contactSession']['used'] === 0,
        'Both failures did not refund owned session claim',
      );
      $pdo->exec($schema);
      $retry = actionRun($directory, [
        ['endpoint' => 'submit_contact.php', 'session' => 'recovery'],
      ])[0];
      actionCheck(
        $retry['status'] === 200 &&
          (int) $pdo->query('SELECT COUNT(*) FROM contact_submissions')->fetchColumn() === 1,
        'Recovered storage could not accept original challenge',
      );
    } elseif ($case === 'newer-claim') {
      actionCheck(
        $result['contactSession']['newerClaim'] &&
          $result['contactSession']['cooldown'] &&
          $result['contactSession']['used'] === 1,
        'Refund overwrote a newer request',
      );
    } else {
      actionCheck(
        $result['contactSession']['cooldown'] && $result['contactSession']['used'] === 1,
        'Successful mail lost its replay protection',
      );
    }
  }
  $directory = actionFixture('contact-retention-failure');
  actionRun($directory, [['endpoint' => 'submit_contact.php', 'case' => 'retention-failure']]);
  actionCheck(
    (int) actionDatabase($directory)
      ->query('SELECT COUNT(*) FROM contact_submissions')
      ->fetchColumn() === 1,
    'Retention failure prevented lead receipt',
  );

  foreach (['plain', 'html', 'single-pass'] as $format) {
    $directory = actionFixture('contact-format-' . $format);
    $pdo = actionDatabase($directory);
    $template =
      $format === 'html'
        ? '<p>[message]</p><b>[_site_name]</b>'
        : ($format === 'plain'
          ? "From: <[your-email]>\n[message] - [_site_name]"
          : '[message]');
    $pdo
      ->prepare('UPDATE contact_forms SET mail_subject=?,mail_from=?,mail_body=?')
      ->execute([
        'Tom &amp; Jerry: [message]',
        'Tom &amp; Jerry &lt;sender@example.invalid&gt;',
        $template,
      ]);
    $pdo
      ->prepare('INSERT INTO settings VALUES(?,?,?)')
      ->execute(['general', 'site_name', 'Sains & <QA>']);
    $visitor =
      $format === 'single-pass'
        ? 'Literal [_site_name] &amp;'
        : 'Melayu “cantik” & <img src=x onerror=bad()> x<y &amp;';
    actionRun($directory, [
      [
        'endpoint' => 'submit_contact.php',
        'case' => 'mail-format',
        'data' => ['your-email' => 'qa@example.invalid', 'message' => $visitor],
      ],
    ]);
    $mail = json_decode($pdo->query('SELECT payload FROM mail_calls')->fetchColumn(), true);
    actionCheck(
      $mail['subject'] === 'Tom & Jerry: ' . $visitor && $mail['name'] === 'Tom & Jerry',
      'Headers must decode the template once, not visitor text',
    );
    $visible = html_entity_decode(strip_tags($mail['body']), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    actionCheck(
      str_contains($visible, $visitor) && !str_contains($mail['body'], '<img'),
      'Body entities were compounded or visitor markup became active',
    );
    if ($format === 'plain') {
      actionCheck(
        str_contains($visible, '<qa@example.invalid>') && str_contains($visible, 'Sains & <QA>'),
        'Default address or global text was lost',
      );
    }
    if ($format === 'html') {
      actionCheck(
        str_contains($mail['body'], '<p>') && str_contains($mail['body'], '<b>'),
        'Configured HTML template was lost',
      );
    }
  }

  $recipientCases = [
    'qa@example.invalid' => true,
    'a&b@example.invalid' => true,
    '[_site_email]' => true,
    '[your-email]' => true,
    '[optional-email]' => true,
    '' => false,
    'not-an-email' => false,
    '[message]' => false,
    '[unknown]' => false,
    'Name <qa@example.invalid>' => false,
    'qa@example.invalid,other@example.invalid' => false,
    "qa@example.invalid\r\nBcc:x@example.invalid" => false,
    "qa@example.invalid\0" => false,
  ];
  foreach ($recipientCases as $recipient => $allowed) {
    $directory = actionFixture('contact-recipient-' . bin2hex(random_bytes(4)));
    $input = [
      'id' => 'qa_form',
      'template' => '[email* your-email][email optional-email][text message]',
      'mail' => [
        'to' => $recipient,
        'from' => 'Tom & Jerry <qa@example.invalid>',
        'subject' => 'Quotes “ & amp;',
      ],
    ];
    $save = actionRun($directory, [['endpoint' => 'contact/save_form.php', 'input' => $input]])[0];
    actionCheck(
      $save['status'] === ($allowed ? 200 : 400),
      'Recipient acceptance mismatch: ' . json_encode($recipient),
    );
    if (!$allowed) {
      actionCheck(isset($save['body']['error']), 'Recipient validation has no visible error');
      continue;
    }
    $get = actionRun($directory, [['endpoint' => 'contact/get_forms.php']])[0];
    $form = $get['body']['forms'][0];
    actionCheck(
      $form['mail']['to'] === $recipient &&
        $form['mail']['from'] === $input['mail']['from'] &&
        $form['mail']['subject'] === $input['mail']['subject'],
      'Admin header read compounded encoding',
    );
    actionRun($directory, [['endpoint' => 'contact/save_form.php', 'input' => $form]]);
    $again = actionRun($directory, [['endpoint' => 'contact/get_forms.php']])[0];
    actionCheck(
      $again['body']['forms'][0]['mail'] === $form['mail'],
      'Save/get/save header round-trip changed text',
    );
  }

  foreach (['update_profile.php', 'save_user.php'] as $endpoint) {
    foreach (
      [
        "O'Reilly & Sons",
        'Literal &amp; &#039;',
        '<img src=x onerror=bad()>',
        str_repeat('&', 100),
        str_repeat('名', 100),
        str_repeat('a', 101),
        ['invalid'],
      ]
      as $name
    ) {
      $directory = actionFixture('display-name-' . bin2hex(random_bytes(4)));
      $allowed = is_string($name) && mb_strlen($name) <= 100;
      $request = [
        'endpoint' => $endpoint,
        'case' => 'profile-only',
        'input' => ['display_name' => $name, 'bio' => 'R&D <example> &amp;'],
      ];
      $saved = actionRun($directory, [$request])[0];
      actionCheck(
        $saved['status'] === ($allowed ? 200 : 400),
        'Display-name length/type contract changed',
      );
      if (!$allowed) {
        continue;
      }
      $pdo = actionDatabase($directory);
      $stored = $pdo->query('SELECT display_name FROM users WHERE id=2')->fetchColumn();
      actionCheck(
        $stored === $name && $saved['body']['user']['display_name'] === $name,
        'Display-name punctuation/entities were rewritten',
      );
      actionCheck(
        $pdo->query('SELECT bio FROM users WHERE id=2')->fetchColumn() === 'R&D <example> &amp;' &&
          $saved['body']['user']['bio'] === 'R&D <example> &amp;',
        'Profile and User Manager bio text diverged',
      );
      $request['input']['display_name'] = $stored;
      $again = actionRun($directory, [$request])[0];
      actionCheck(
        $again['status'] === 200 &&
          $pdo->query('SELECT display_name FROM users WHERE id=2')->fetchColumn() === $name,
        'Display-name save/read/save was not stable',
      );
    }
    // Existing entity-looking text is preserved, never guessed or bulk-decoded.
    $directory = actionFixture('display-name-legacy-' . pathinfo($endpoint, PATHINFO_FILENAME));
    $pdo = actionDatabase($directory);
    $pdo->exec("UPDATE users SET display_name='Old &amp; name'");
    actionRun($directory, [
      [
        'endpoint' => $endpoint,
        'case' => 'profile-only',
        'input' => ['display_name' => 'Old &amp; name'],
      ],
    ]);
    actionCheck(
      $pdo->query('SELECT display_name FROM users WHERE id=2')->fetchColumn() === 'Old &amp; name',
      'Legacy display name was decoded or compounded',
    );
  }
  foreach (['own', 'other', 'noop', 'rejected', 'commit-failure'] as $scenario) {
    $directory = actionFixture('managed-avatar-' . $scenario);
    $pdo = actionDatabase($directory);
    $pdo->exec("UPDATE users SET role='Root'");
    $actor = [
      'id' => $scenario === 'other' ? '1' : '2',
      'role' => 'Root',
      'username' => 'old-session',
      'avatar' => 'https://qa.invalid/old.webp',
      'auth_fingerprint' => 'unchanged-auth',
    ];
    $input = [
      'role' => 'Root',
      'avatar' => 'https://qa.invalid/new.webp',
      'display_name' => 'QA',
      'bio' => '',
    ];
    if ($scenario === 'noop') {
      $pdo->exec("UPDATE users SET avatar='https://qa.invalid/new.webp'");
    }
    if ($scenario === 'rejected') {
      $input['display_name'] = str_repeat('a', 101);
    }
    $result = actionRun($directory, [
      [
        'endpoint' => 'save_user.php',
        'case' => 'profile-only',
        'actor' => $actor,
        'input' => $input,
        'noopUpdate' => $scenario === 'noop',
        'failCommit' => $scenario === 'commit-failure',
      ],
    ])[0];
    $accepted = in_array($scenario, ['own', 'other', 'noop'], true);
    actionCheck(
      $result['status'] === ($accepted ? 200 : ($scenario === 'rejected' ? 400 : 500)),
      'Managed avatar response: ' . $scenario,
    );
    $expected = $actor;
    if ($accepted && $scenario !== 'other') {
      $expected = array_merge($actor, [
        'username' => 'qa_member',
        'email' => 'qa@example.invalid',
        'display_name' => 'QA',
        'bio' => '',
        'avatar' => $input['avatar'],
      ]);
    }
    $actualSession = $result['sessionUser'];
    ksort($actualSession);
    ksort($expected);
    actionCheck(
      $actualSession === $expected,
      'Managed profile changed stale/foreign/auth session fields: ' . $scenario,
    );
    if (!$accepted) {
      actionCheck(
        $pdo->query('SELECT avatar FROM users WHERE id=2')->fetchColumn() === '',
        'Failed save changed persisted avatar',
      );
    }
  }
  foreach (['Root', 'Admin', 'Moderator', 'Writer', 'Member', 'guest'] as $role) {
    $directory = actionFixture('comment-post-context-' . strtolower($role));
    $pdo = actionDatabase($directory);
    $pdo->exec(
      'CREATE TABLE posts(id INTEGER PRIMARY KEY,title TEXT,slug TEXT,category TEXT,created_at TEXT,status TEXT,scheduled_at TEXT)',
    );
    $pdo->exec('DROP TABLE comments');
    $pdo->exec(
      'CREATE TABLE comments(id INTEGER PRIMARY KEY,post_id INT,user_id INT,parent_id INT,user_name TEXT,user_avatar TEXT,content TEXT,likes INT,status TEXT,created_at TEXT)',
    );
    $insertPost = $pdo->prepare('INSERT INTO posts VALUES(?,?,?,?,?,?,?)');
    $insertComment = $pdo->prepare('INSERT INTO comments VALUES(?,?,2,NULL,?,?,?,0,?,?)');
    foreach (['published', 'draft', 'future', 'past', 'missing', 'legacy'] as $index => $kind) {
      $id = 1000 + $index;
      if ($kind !== 'missing') {
        $insertPost->execute([
          $id,
          'QA &amp; ' . $kind,
          (string) $id,
          'Technology',
          '2026-10-01 12:00:00',
          $kind === 'legacy' ? null : ($kind === 'draft' ? 'draft' : 'published'),
          $kind === 'future'
            ? '2099-01-01 00:00:00'
            : ($kind === 'past'
              ? '2000-01-01 00:00:00'
              : null),
        ]);
      }
      $insertComment->execute([
        $id,
        $id,
        'QA',
        '',
        'Comment ' . $kind,
        'approved',
        '2026-10-01 12:00:00',
      ]);
    }
    $result = actionRun($directory, [
      [
        'endpoint' => 'get_comments.php',
        'case' => $role === 'guest' ? 'guest' : 'normal',
        'actor' =>
          $role === 'guest' ? null : ['id' => $role === 'Root' ? '1' : '3', 'role' => $role],
      ],
    ])[0];
    actionCheck(
      $result['status'] === 200 && !empty($result['body']['success']),
      'Comment context read failed: ' . $role,
    );
    $canReadContext = in_array($role, ['Root', 'Admin', 'Moderator'], true);
    $staff = $role !== 'guest' && $role !== 'Member';
    actionCheck(
      count($result['body']['comments']) === ($staff ? 6 : 3),
      'Comment visibility changed: ' . $role,
    );
    foreach ($result['body']['comments'] as $comment) {
      if (!$canReadContext) {
        actionCheck(!array_key_exists('post', $comment), 'Post metadata leaked to ' . $role);
        continue;
      }
      $kind = substr($comment['content'], strlen('Comment '));
      if ($kind === 'missing') {
        actionCheck(
          $comment['post'] === null,
          'Deleted parent must not link through a stale cached post',
        );
        continue;
      }
      actionCheck(
        $comment['post']['id'] === $comment['postId'] &&
          $comment['post']['title'] === 'QA & ' . $kind,
        'Incorrect parent post context',
      );
      actionCheck(
        $comment['post']['isPublic'] === in_array($kind, ['published', 'past', 'legacy'], true),
        'Parent publication visibility drifted',
      );
      actionCheck(
        array_keys($comment['post']) === [
          'id',
          'title',
          'slug',
          'category',
          'createdAt',
          'isPublic',
        ],
        'Comment post context grew beyond compact presentation fields',
      );
    }
    if ($canReadContext) {
      $detail = actionRun($directory, [
        [
          'endpoint' => 'get_comments.php',
          'actor' => ['id' => '1', 'role' => 'Root'],
          'query' => ['post_id' => '1000', 'flat' => 'true'],
        ],
      ])[0];
      actionCheck(
        !array_key_exists('post', $detail['body']['comments'][0]),
        'Public-post comment reads gained unnecessary metadata',
      );
    }
  }
  $directory = actionFixture('managed-bio-type');
  $invalidBio = actionRun($directory, [
    ['endpoint' => 'save_user.php', 'case' => 'profile-only', 'input' => ['bio' => ['invalid']]],
  ])[0];
  actionCheck(
    $invalidBio['status'] === 400 &&
      actionDatabase($directory)->query('SELECT bio FROM users WHERE id=2')->fetchColumn() === '',
    'Compound bio reached storage',
  );

  $directory = actionFixture('newsletter-duplicate');
  $first = actionRun($directory, [['endpoint' => 'newsletter_subscribe.php']])[0];
  $second = actionRun($directory, [['endpoint' => 'newsletter_subscribe.php']])[0];
  actionCheck(
    $first['status'] === 200 && $first['body'] === $second['body'],
    'Duplicate response changed',
  );
  actionCheck(
    (int) actionDatabase($directory)
      ->query('SELECT COUNT(*) FROM newsletter_subscribers')
      ->fetchColumn() === 1,
    'Duplicate subscription created another row',
  );

  foreach (['update_profile.php', 'save_user.php'] as $endpoint) {
    foreach (['normal', 'profile-only', 'csrf'] as $case) {
      $directory = actionFixture(pathinfo($endpoint, PATHINFO_FILENAME) . '-' . $case);
      $result = actionRun($directory, [['endpoint' => $endpoint, 'case' => $case]])[0];
      actionCheck(
        $result['status'] === ($case === 'csrf' ? 403 : 200),
        'Credential writer response changed',
      );
      $pdo = actionDatabase($directory);
      $user = $pdo->query('SELECT * FROM users WHERE id=2')->fetch();
      $changed = $case === 'normal';
      actionCheck(
        password_verify($changed ? 'New1!Password' : 'Old1!Password', $user['password']),
        'Password state mismatch',
      );
      actionCheck(
        ($user['reset_token'] === null && $user['reset_token_expires'] === null) === $changed,
        'Reset token lifecycle mismatch: ' . $endpoint . '/' . $case,
      );
      actionCheck(
        (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() ===
          ($changed ? 0 : 1),
        'Remember-token lifecycle changed',
      );
      $resetSource = file_get_contents($root . '/public/api/reset_password.php');
      preg_match(
        "~'(SELECT id, reset_token FROM users WHERE reset_token IN \\(\\?, \\?\\) AND reset_token_expires > NOW\\(\\) FOR UPDATE)'~",
        $resetSource,
        $match,
      );
      actionCheck(isset($match[1]), 'Actual reset consumer was not found');
      $lookup = $pdo->prepare($match[1]);
      $lookup->execute(['s1:legacy-lookup-control', str_repeat('a', 64)]);
      actionCheck(
        ($lookup->fetchColumn() === false) === $changed,
        'Old bearer authority survived password replacement',
      );
    }
  }
  foreach (
    [
      ['missing', null, null, true],
      ['db-on', 'true', null, true],
      ['db-one', '1', null, true],
      ['db-off', 'false', null, false],
      ['db-zero', '0', null, false],
      ['mirror-empty', null, [], true],
      ['mirror-on', null, ['registrationEnabled' => true], true],
      ['mirror-off', null, ['registrationEnabled' => false], false],
      ['mirror-string-off', null, ['registrationEnabled' => 'false'], false],
      ['db-off-mirror-on', 'false', ['registrationEnabled' => true], false],
      ['db-on-mirror-off', 'true', ['registrationEnabled' => false], true],
    ]
    as [$label, $stored, $mirror, $enabled]
  ) {
    $registrationDirectory = actionFixture('registration-default-' . $label);
    $registrationDb = actionDatabase($registrationDirectory);
    if ($stored !== null) {
      $registrationDb
        ->prepare('INSERT INTO settings VALUES(?,?,?)')
        ->execute(['general', 'registration_enabled', $stored]);
    }
    if ($mirror !== null) {
      file_put_contents(
        $registrationDirectory . '/site_settings.json',
        json_encode($mirror, JSON_THROW_ON_ERROR),
      );
    }
    $result = actionRun($registrationDirectory, [
      ['endpoint' => 'register.php', 'input' => ['username' => []]],
    ])[0];
    actionCheck(
      $result['status'] === ($enabled ? 400 : 403),
      'Registration default or explicit owner setting changed: ' . $label,
    );
    actionCheck(
      (int) $registrationDb->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1 &&
        (int) $registrationDb->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === 0,
      'Registration policy probe created an account or sent mail: ' . $label,
    );
    if ($label === 'missing') {
      $result = actionRun($registrationDirectory, [
        [
          'endpoint' => 'register.php',
          'input' => [
            'username' => 'qa_default_member',
            'email' => 'qa-default@example.invalid',
            'password' => 'Fixture_New9!',
            'confirmPassword' => 'Fixture_New9!',
          ],
        ],
      ])[0];
      actionCheck(
        $result['status'] === 200 &&
          !empty($result['body']['requiresVerification']) &&
          empty($result['body']['user']) &&
          (int) $registrationDb->query('SELECT COUNT(*) FROM users')->fetchColumn() === 2 &&
          (int) $registrationDb->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === 1,
        'Missing registration setting did not preserve ordinary unverified signup.',
      );
    }
    $registrationDb = null;
  }
  $installerDefaults = (static function () use ($root): array {
    $source = file_get_contents($root . '/public/api/install.php');
    $start = strpos($source, '$defaultSettings = [') + strlen('$defaultSettings = ');
    $end = strpos($source, '];', $start);
    $detectedDomainUrl = 'https://qa.invalid';
    $siteTitle = 'QA';
    return eval('return ' . substr($source, $start, $end - $start + 2));
  })();
  $registrationDefaults = array_values(
    array_filter(
      $installerDefaults,
      static fn(array $row): bool => $row[1] === 'registration_enabled',
    ),
  );
  actionCheck(
    $registrationDefaults === [['general', 'registration_enabled', 'true', 'boolean']],
    'Fresh installer does not explicitly seed the registration default.',
  );
  $directory = actionFixture('distributed-login');
  $registrationDirectory = actionFixture('registration-ipv6');
  $registrationDb = actionDatabase($registrationDirectory);
  $registrationDb->exec("INSERT INTO settings VALUES('general','registration_enabled','true')");
  for ($i = 1; $i <= 8; $i++) {
    $result = actionRun($registrationDirectory, [
      [
        'endpoint' => 'register.php',
        'ip' => '2001:db8:1234:5::' . dechex($i),
        'input' => ['username' => [], 'password' => ''],
      ],
    ])[0];
    actionCheck(
      $result['status'] === ($i <= 5 ? 400 : 429),
      'Registration endpoint failed IPv6 /64 reservation: ' . json_encode($result),
    );
  }
  $result = actionRun($registrationDirectory, [
    [
      'endpoint' => 'register.php',
      'ip' => '2001:db8:1234:6::1',
      'input' => ['username' => [], 'password' => ''],
    ],
  ])[0];
  actionCheck(
    $result['status'] === 400,
    'Independent IPv6 network lost its registration allowance.',
  );
  actionCheck(
    count(glob($registrationDirectory . '/rates/*.json')) === 1,
    'Registration endpoint allocates per-address files.',
  );
  actionCheck(
    (int) $registrationDb->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1,
    'Rejected registration creates accounts.',
  );
  $result = actionRun($registrationDirectory, [
    [
      'endpoint' => 'register.php',
      'ip' => '2001:db8:1234:7::1',
      'input' => [
        'username' => 'qa_new_member',
        'email' => 'qa-new@example.invalid',
        'password' => 'Fixture_New9!',
        'confirmPassword' => 'Fixture_New9!',
      ],
    ],
  ])[0];
  actionCheck(
    $result['status'] === 200 &&
      !empty($result['body']['requiresVerification']) &&
      empty($result['body']['user']),
    'Ordinary registration or unverified-account boundary changed: ' . json_encode($result),
  );
  actionCheck(
    (int) $registrationDb->query('SELECT COUNT(*) FROM users')->fetchColumn() === 2,
    'Ordinary registration failed to persist its fixture account.',
  );
  actionCheck(
    (int) $registrationDb->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === 1,
    'Ordinary registration did not deliver exactly one stubbed verification email.',
  );
  $registrationDb = null;
  foreach (['normal', 'wrong-password', 'csrf', 'mail-failure', 'verified'] as $resendCase) {
    $resendDirectory = actionFixture('verification-resend-' . $resendCase);
    $resendDb = actionDatabase($resendDirectory);
    $oldVerification = str_repeat('b', 64);
    $resendDb
      ->prepare(
        'UPDATE users SET email_verified=?,verification_token=?,verification_token_expires=? WHERE id=2',
      )
      ->execute([$resendCase === 'verified' ? 1 : 0, $oldVerification, '2000-01-01 00:00:00']);
    $request = [
      'endpoint' => 'login.php',
      'case' => $resendCase,
      'password' => $resendCase === 'wrong-password' ? 'Wrong1!Password' : 'Old1!Password',
      'input' => ['action' => 'resend_verification'],
    ];
    $result = actionRun($resendDirectory, [$request])[0];
    $expected = match ($resendCase) {
      'wrong-password' => 401,
      'csrf' => 403,
      'mail-failure' => 503,
      default => 200,
    };
    actionCheck(
      $result['status'] === $expected,
      'Verification resend status: ' . $resendCase . ' ' . json_encode($result),
    );
    actionCheck(!isset($result['body']['user']), 'Resend never authenticates a user');
    $changed = in_array($resendCase, ['normal', 'mail-failure'], true);
    $stored = $resendDb->query('SELECT verification_token FROM users WHERE id=2')->fetchColumn();
    actionCheck(
      $changed ? str_starts_with($stored, 's1:') : $stored === $oldVerification,
      'Resend token mutation is credential/CSRF bound',
    );
    actionCheck(
      (int) $resendDb->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === (int) $changed,
      'Resend sends exactly one authorized email',
    );
    actionCheck(
      (int) $resendDb->query('SELECT email_verified FROM users WHERE id=2')->fetchColumn() ===
        ($resendCase === 'verified' ? 1 : 0),
      'Resend never auto-verifies an account',
    );
    if ($resendCase === 'normal') {
      $retry = actionRun($resendDirectory, [$request + ['ip' => '203.0.113.88']])[0];
      actionCheck(
        $retry['status'] === 429 &&
          $resendDb->query('SELECT verification_token FROM users WHERE id=2')->fetchColumn() ===
            $stored,
        'Credential-bound resend cooldown spans IPs without replacing the token',
      );
      $payload = json_decode(
        $resendDb->query('SELECT payload FROM mail_calls')->fetchColumn(),
        true,
      );
      preg_match('/token=([a-f0-9]{64})/', implode('', $payload), $sentToken);
      actionCheck(
        isset($sentToken[1]) &&
          str_contains(
            $stored,
            rtrim(strtr(base64_encode(hash('sha256', $sentToken[1], true)), '+/', '-_'), '='),
          ),
        'Resend stores only a digest of the delivered credential',
      );
    }
    $resendDb = null;
  }
  $raceDirectory = actionFixture('verification-resend-race');
  $raceDb = actionDatabase($raceDirectory);
  $raceDb
    ->prepare('UPDATE users SET email_verified=0,verification_token=? WHERE id=2')
    ->execute([str_repeat('b', 64)]);
  $raceRequest = [
    'endpoint' => 'login.php',
    'password' => 'Old1!Password',
    'input' => ['action' => 'resend_verification'],
  ];
  $raceResults = actionRun($raceDirectory, [
    $raceRequest + ['ip' => '198.51.100.80'],
    $raceRequest + ['ip' => '198.51.100.81'],
  ]);
  $statuses = array_column($raceResults, 'status');
  sort($statuses);
  actionCheck($statuses === [200, 429], 'Concurrent credential-bound resend has one winner');
  actionCheck(
    (int) $raceDb->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() === 1,
    'Concurrent resend sends one email',
  );
  $raceDb = null;
  for ($attempt = 1; $attempt <= 21; $attempt++) {
    $result = actionRun($directory, [
      ['endpoint' => 'login.php', 'ip' => '198.51.100.' . $attempt],
    ])[0];
    actionCheck($result['status'] === 401, 'Wrong distributed login accepted');
  }
  $result = actionRun($directory, [
    ['endpoint' => 'login.php', 'ip' => '198.51.100.99', 'password' => 'Old1!Password'],
  ])[0];
  actionCheck(
    $result['status'] === 200 && ($result['body']['user']['id'] ?? null) === 2,
    'Distributed failures locked out the correct owner on a new IP',
  );
  foreach (['zero', 'array', 'object', 'null', 'omitted'] as $kind) {
    $directory = actionFixture('managed-password-' . $kind);
    $result = actionRun($directory, [
      ['endpoint' => 'save_user.php', 'case' => 'password-' . $kind],
    ])[0];
    actionCheck(
      $result['status'] === (in_array($kind, ['null', 'omitted'], true) ? 200 : 400),
      'Managed password input was skipped or crashed: ' . $kind,
    );
    $pdo = actionDatabase($directory);
    actionCheck(
      password_verify('Old1!Password', $pdo->query('SELECT password FROM users')->fetchColumn()) &&
        $pdo->query('SELECT reset_token FROM users')->fetchColumn() === str_repeat('a', 64) &&
        (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 1,
      'Rejected/omitted managed password changed credentials: ' . $kind,
    );
  }
  $directory = actionFixture('recovery-unknown-saturation');
  $result = actionRun($directory, [
    ['endpoint' => 'reset_password.php', 'unknownBatch' => 2100],
  ])[0];
  actionCheck(($result['body']['tested'] ?? 0) === 2100, 'Unknown recovery flood incomplete');
  actionCheck(glob($directory . '/rates/*.json') === [], 'Unknown emails allocated quota keys');
  actionCheck(
    actionDatabase($directory)->query('SELECT reset_token FROM users')->fetchColumn() ===
      str_repeat('a', 64),
    'Unknown recovery changed credentials',
  );
  $full = [];
  for ($slot = 0; $slot < 4096; $slot++) {
    $full[hash('sha256', 'old-slot-' . $slot)] = [
      'attempts' => 1,
      'window_started_at' => time(),
      'window_seconds' => 900,
    ];
  }
  file_put_contents(
    $directory . '/rates/' . md5('recovery-trap-ledger:v1') . '.json',
    json_encode($full),
  );
  $generic = ['success' => true, 'message' => 'If this email exists, a reset link has been sent.'];
  $ledgerFile = $directory . '/rates/' . md5('fixed-window-ledger:v1') . '.json';
  foreach (['ip1', 'ip1', 'ip1', 'ip1', 'ip2', 'ip2', 'ip3'] as $index => $ip) {
    $result = actionRun($directory, [['endpoint' => 'reset_password.php', 'ip' => $ip]])[0];
    actionCheck(
      $result['status'] === 200 && $result['body'] === $generic,
      'Recovery status oracle',
    );
    actionCheck(
      (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() ===
        [1, 2, 3, 3, 4, 5, 5][$index],
      'Pair/email quotas changed or full trap ledger blocked recovery',
    );
  }
  $before = file_get_contents($ledgerFile);
  $tokenBefore = actionDatabase($directory)->query('SELECT reset_token FROM users')->fetchColumn();
  for ($index = 0; $index < 12; $index++) {
    $result = actionRun($directory, [
      ['endpoint' => 'reset_password.php', 'ip' => 'rotating-' . $index],
    ])[0];
    actionCheck($result['body'] === $generic, 'Denied rotating request exposed account state');
  }
  actionCheck(file_get_contents($ledgerFile) === $before, 'Denied requests allocated pair keys');
  actionCheck(
    actionDatabase($directory)->query('SELECT reset_token FROM users')->fetchColumn() ===
      $tokenBefore,
    'Denied recovery replaced the active bearer token',
  );
  foreach (['full', 'corrupt', 'unwritable'] as $fault) {
    $directory = actionFixture('recovery-' . $fault);
    $ledgerFile = $directory . '/rates/' . md5('fixed-window-ledger:v1') . '.json';
    if ($fault === 'unwritable') {
      mkdir($ledgerFile);
    } else {
      file_put_contents($ledgerFile, $fault === 'full' ? json_encode($full) : '{broken');
    }
    $result = actionRun($directory, [['endpoint' => 'reset_password.php']])[0];
    actionCheck($result['status'] === 200 && $result['body'] === $generic, 'Storage fault oracle');
    actionCheck(
      (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() ===
        0 &&
        actionDatabase($directory)->query('SELECT reset_token FROM users')->fetchColumn() ===
          str_repeat('a', 64),
      'Unavailable recovery storage caused mail/token side effects',
    );
  }
  foreach (['pair' => 3, 'email' => 5] as $quota => $maximum) {
    $directory = actionFixture('recovery-race-' . $quota);
    $requests = [];
    for ($index = 0; $index < 8; $index++) {
      $requests[] = [
        'endpoint' => 'reset_password.php',
        'barrier' => true,
        'ip' => $quota === 'pair' ? '198.51.100.22' : '198.51.100.' . $index,
      ];
    }
    foreach (actionRun($directory, $requests) as $result) {
      actionCheck($result['body'] === $generic, 'Concurrent recovery response differs');
    }
    actionCheck(
      (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM mail_calls')->fetchColumn() ===
        $maximum,
      'Concurrent recovery exceeded/underfilled ' . $quota . ' quota',
    );
  }
  foreach (['normal', 'failure', 'not-owner', 'csrf'] as $case) {
    $directory = actionFixture('comment-delete-' . $case);
    if ($case === 'failure') {
      actionDatabase($directory)->exec(
        "CREATE TRIGGER fail_parent BEFORE DELETE ON comments WHEN OLD.id=10 BEGIN SELECT RAISE(ABORT, 'QA parent delete failure'); END",
      );
    }
    $result = actionRun($directory, [['endpoint' => 'save_comments.php', 'case' => $case]])[0];
    $expectedStatus = match ($case) {
      'failure' => 500,
      'not-owner', 'csrf' => 403,
      default => 200,
    };
    actionCheck($result['status'] === $expectedStatus, 'Comment delete status: ' . $case);
    actionCheck(
      (int) actionDatabase($directory)->query('SELECT COUNT(*) FROM comments')->fetchColumn() ===
        ($case === 'normal' ? 1 : 3),
      'Comment delete partially committed or changed another thread: ' . $case,
    );
  }
  $directory = actionFixture('profile-wrong-password');
  actionCheck(
    actionRun($directory, [['endpoint' => 'update_profile.php', 'case' => 'wrong-password']])[0][
      'status'
    ] === 400,
    'Current-password check weakened',
  );
  actionCheck(
    actionDatabase($directory)->query('SELECT reset_token FROM users')->fetchColumn() ===
      str_repeat('a', 64),
    'Rejected password change revoked token',
  );

  foreach (['update_profile.php', 'save_user.php'] as $endpoint) {
    $directory = actionFixture(pathinfo($endpoint, PATHINFO_FILENAME) . '-rollback');
    actionDatabase($directory)->exec(
      "CREATE TRIGGER fail_revoke BEFORE DELETE ON remember_tokens BEGIN SELECT RAISE(ABORT, 'QA revoke failure'); END",
    );
    actionCheck(
      actionRun($directory, [['endpoint' => $endpoint]])[0]['status'] === 500,
      'Credential failure response changed',
    );
    $pdo = actionDatabase($directory);
    $user = $pdo->query('SELECT * FROM users WHERE id=2')->fetch();
    actionCheck(
      password_verify('Old1!Password', $user['password']),
      'Failed transaction changed password',
    );
    actionCheck(
      $user['reset_token'] === str_repeat('a', 64),
      'Failed transaction revoked reset token',
    );
    actionCheck(
      (int) $pdo->query('SELECT COUNT(*) FROM remember_tokens')->fetchColumn() === 1,
      'Failed transaction removed remember token',
    );
  }

  define('VONCMS_CORE_LOADED', true);
  function is_https(): bool
  {
    return false;
  }
  require $root . '/public/core/ResponseHelper.php';
  require $root . '/public/seo_schema_helper.php';
  require $root . '/public/media_variants.php';
  require $root . '/public/content_metrics_helper.php';
  $source = file_get_contents($root . '/public/api/get_posts.php');
  actionCheck(
    str_contains($source, "(NULLIF(p.excerpt, '') IS NULL) AS excerpt_from_content"),
    'Actual list projection lost the legacy fallback indicator',
  );
  $start = strpos($source, '$result = array_map(function ($row) use ($isAdmin)');
  $end = strpos($source, '}, $rows);', $start);
  actionCheck($start !== false && $end !== false, 'Actual list map missing');
  $map = substr($source, $start, $end + strlen('}, $rows);') - $start);
  foreach ([false, true] as $isAdmin) {
    foreach (
      [
        [
          'Formula x<y dan berita selepasnya mesti kekal.',
          'Formula x<y dan berita selepasnya mesti kekal.',
        ],
        ['x<y dan y>z', 'x<y dan y>z'],
        ['<p>Legacy <b>HTML</b> &amp; berita.</p>', 'Legacy HTML &amp; berita.'],
        ['<div contenteditable>Legacy valid markup body.</div>', 'Legacy valid markup body.'],
        ['Contoh x&amp;lt;y', 'Contoh x&amp;lt;y'],
        ['Contoh x&#38;lt;y', 'Contoh x&#38;lt;y'],
        ['Berita 中文 😀 biasa.', 'Berita 中文 😀 biasa.'],
        ['0', '0'],
      ]
      as [$excerpt, $expected]
    ) {
      $rows = [['id' => 1, 'excerpt' => $excerpt, 'image_url' => '', 'author_id' => 2]];
      eval($map);
      actionCheck($result[0]['excerpt'] === $expected, 'Listing excerpt mismatch');
      actionCheck(
        array_key_exists('author_id', $result[0]) === $isAdmin,
        'Public identity projection changed',
      );
    }
    foreach (
      [
        '<p>Article introduction.</p><img src="https://cdn.example.invalid/' .
        str_repeat('pathsegment/', 35) .
        'image.jpg">',
        '<p>Legacy <b>HTML</b> &amp; berita.</p>',
      ]
      as $content
    ) {
      $prefix = mb_substr($content, 0, 200, 'UTF-8');
      $rows = [['id' => 1, 'excerpt' => $prefix, 'excerpt_from_content' => 1, 'image_url' => '']];
      eval($map);
      actionCheck(
        $result[0]['excerpt'] === strip_tags($prefix),
        'Legacy HTML-prefix cleanup changed',
      );
      actionCheck(
        !array_key_exists('excerpt_from_content', $result[0]),
        'Internal excerpt flag escaped projection',
      );
    }
  }
  require_once $root . '/public/api/content_embed_helper.php';
  $commentsSource = file_get_contents($root . '/public/api/get_comments.php');
  preg_match('/\$commentAvatar = [^;]+;/', $commentsSource, $avatarProjection);
  actionCheck(isset($avatarProjection[0]), 'Comment avatar projection owner found');
  foreach (
    [
      [
        [
          'userId' => null,
          'user_live_avatar' => null,
          'userAvatar' => 'https://tracking.invalid/pixel',
        ],
        '',
      ],
      [
        [
          'userId' => 2,
          'user_live_avatar' => '/uploads/current.webp',
          'userAvatar' => 'https://stale.invalid/avatar',
        ],
        '/uploads/current.webp',
      ],
      [
        ['userId' => 2, 'user_live_avatar' => '', 'userAvatar' => 'https://stale.invalid/avatar'],
        '',
      ],
    ]
    as [$c, $expectedAvatar]
  ) {
    $commentAvatar = eval($avatarProjection[0] . ' return $commentAvatar;');
    actionCheck(
      ResponseHelper::scrubAvatarUrl($commentAvatar) === $expectedAvatar,
      'Legacy guest and cleared account avatars stay suppressed',
    );
  }
  eval(actionDeclaration($root . '/public/security.php', 'class SecurityHelper'));
  foreach (['_', '-', '+', '=', '[', ']', '~', ';', "'", '\\', '/', '!', '。', '😀'] as $symbol) {
    actionCheck(
      SecurityHelper::hasPasswordSpecialCharacter('Abc12345' . $symbol),
      'Password accepts punctuation/symbol: ' . $symbol,
    );
  }
  foreach (
    [
      'Abc12345',
      'Abc12345 ',
      "Abc12345\t",
      'Abc12345名',
      "Abc12345\u{0085}",
      "Abc12345\u{FEFF}",
      "Abc12345\u{200B}",
      "Abc12345\u{0301}",
    ]
    as $plain
  ) {
    actionCheck(
      !SecurityHelper::hasPasswordSpecialCharacter($plain),
      'Letters/numbers/whitespace alone are not password symbols',
    );
  }
  $unsafeHtml =
    '<base href="https://evil.invalid/"><meta http-equiv="refresh" content="0;url=https://evil.invalid"><object data="https://evil.invalid"></object><embed src="https://evil.invalid"><form action="https://evil.invalid"><input value="private"></form><svg><foreignObject><img src=x onerror=bad()></foreignObject></svg><math><mtext>x</mtext></math><p>Keep</p>';
  $clean = voncms_sanitize_content_attributes($unsafeHtml);
  actionCheck(
    !preg_match('/<(?:base|meta|object|embed|form|input|svg|math)\b/i', $clean) &&
      str_contains($clean, '<p>Keep</p>'),
    'Active containers are removed before storage',
  );
  foreach (
    [
      'background-color:url(https://tracking.invalid/pixel)',
      'width:expression(bad())',
      'width:e/**/xpression(bad())',
      'width:u\\72l(https://tracking.invalid/pixel)',
      'color:var(--remote)',
    ]
    as $style
  ) {
    actionCheck(voncms_sanitize_content_style($style) === '', 'Unsafe CSS value removed');
  }
  actionCheck(
    voncms_sanitize_content_srcset(
      '/uploads/a.webp 480w, https://cdn.example.invalid/b.webp 960w',
    ) !== '',
    'Ordinary responsive image retained',
  );
  foreach (
    [
      'javascript:bad() 2x',
      '/safe.webp 1x, data:image/svg+xml;base64,AAAA 2x',
      'java' . "\t" . 'script:bad() 2x',
    ]
    as $srcset
  ) {
    actionCheck(voncms_sanitize_content_srcset($srcset) === '', 'Unsafe srcset removed');
  }
  $ordinary =
    '<h2>Heading</h2><p style="text-align:center;color:rgb(1, 2, 3)">R&amp;D</p><table><tbody><tr><td>Keep</td></tr></tbody></table><pre><code>&lt;script&gt;example&lt;/script&gt;</code></pre><a href="mailto:qa@example.invalid">Mail</a><img src="/uploads/qa.webp" srcset="/uploads/qa.webp 1x, /uploads/qa2.webp 2x">';
  $clean = voncms_sanitize_content_attributes($ordinary);
  foreach (
    [
      '<h2>',
      '<table>',
      '<pre>',
      '&lt;script&gt;',
      'mailto:qa@example.invalid',
      'text-align:center',
      'srcset=',
    ]
    as $expected
  ) {
    actionCheck(str_contains($clean, $expected), 'Ordinary rich content retained: ' . $expected);
  }
  $video = voncms_sanitize_content_attributes(
    voncms_sanitize_content_iframes(
      '<iframe src="https://www.youtube.com/embed/example" allowfullscreen></iframe>',
    ),
  );
  actionCheck(str_contains($video, 'youtube.com/embed/example'), 'Supported video retained');
  eval(
    actionDeclaration(
      $root . '/public/api/tools/wp_import.php',
      'function sanitize_imported_content_html(',
    )
  );
  actionCheck(
    sanitize_imported_content_html($unsafeHtml) === voncms_sanitize_content_attributes($unsafeHtml),
    'Import shares the stored-content boundary',
  );
  $importSource = file_get_contents($root . '/public/api/tools/wp_import.php');
  $sizeGuard = actionDeclaration(
    $root . '/public/api/tools/wp_import.php',
    'if (strlen($rawContent) > 1048576)',
  );
  foreach ([str_repeat('a', 1048575), str_repeat('a', 1048575) . '😀'] as $rawContent) {
    $rejected = false;
    try {
      eval($sizeGuard);
    } catch (RuntimeException $error) {
      $rejected = true;
    }
    actionCheck(
      $rejected === strlen($rawContent) > 1048576 && mb_check_encoding($rawContent, 'UTF-8'),
      'Import rejects oversized UTF-8 without truncation',
    );
  }

  $storageDirectory = actionFixture('storage-cache');
  mkdir($storageDirectory . '/api');
  mkdir($storageDirectory . '/data');
  mkdir($storageDirectory . '/uploads');
  foreach (['getFolderStats', 'getCachedFolderStats'] as $name) {
    $declaration = actionDeclaration(
      $root . '/public/api/get_storage.php',
      'function ' . $name . '(',
    );
    eval(str_replace('__DIR__', var_export($storageDirectory . '/api', true), $declaration));
  }
  file_put_contents($storageDirectory . '/uploads/one.webp', '123');
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads') === ['bytes' => 3, 'files' => 1],
    'Storage first scan',
  );
  file_put_contents($storageDirectory . '/uploads/two.webp', '4567');
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads') === ['bytes' => 3, 'files' => 1],
    'Storage cache avoids another traversal within TTL',
  );
  $cachePath = $storageDirectory . '/data/storage_usage.json';
  $cached = json_decode(file_get_contents($cachePath), true);
  $cached['at'] = time() - 301;
  file_put_contents($cachePath, json_encode($cached));
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads') === ['bytes' => 7, 'files' => 2],
    'Expired storage cache refreshes',
  );
  file_put_contents($cachePath, 'corrupted');
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads') === ['bytes' => 7, 'files' => 2],
    'Malformed storage cache falls back safely',
  );
  unlink($cachePath);
  rmdir($storageDirectory . '/data');
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads') === ['bytes' => 7, 'files' => 2],
    'Unavailable cache retains live counts',
  );

  // The real import file localizer/rollback must invalidate usage, including attachment-only
  // writes and files retained after best-effort media registration. Network/DB transport is fake.
  mkdir($storageDirectory . '/data');
  mkdir($storageDirectory . '/api/tools');
  $GLOBALS['qa_import_storage_root'] = $storageDirectory;
  function absolutize_import_media_url($url, $bases)
  {
    return $url;
  }
  function should_rehost_import_image($url, $bases, $target)
  {
    return true;
  }
  function get_import_upload_context($target)
  {
    return [
      'absolute_dir' => $GLOBALS['qa_import_storage_root'] . '/uploads/',
      'relative_dir' => '',
      'url_prefix' => 'https://qa.invalid/uploads/',
    ];
  }
  function fetch_remote_import_image_to_temp(string $url): string
  {
    $path = $GLOBALS['qa_import_storage_root'] . '/image-temp.png';
    file_put_contents(
      $path,
      base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
      ),
    );
    return $path;
  }
  function register_imported_media(...$args)
  {
    /* Transport intentionally unavailable. */
  }
  function import_media_table_exists($connection)
  {
    return false;
  }
  function debug_log($message) {}
  if (!defined('VONCMS_WP_IMPORT_MAX_IMAGE_BYTES')) {
    define('VONCMS_WP_IMPORT_MAX_IMAGE_BYTES', 10 * 1024 * 1024);
  }
  foreach (
    [
      'sanitize_import_media_name',
      'get_import_image_extension',
      'rehost_import_image_url',
      'rollback_imported_media_since',
    ]
    as $name
  ) {
    $declaration = actionDeclaration(
      $root . '/public/api/tools/wp_import.php',
      'function ' . $name . '(',
    );
    eval(str_replace('__DIR__', var_export($storageDirectory . '/api/tools', true), $declaration));
  }
  $GLOBALS['voncms_wp_import_created_media'] = [];
  $oldStats = getCachedFolderStats($storageDirectory . '/uploads');
  $localized = rehost_import_image_url(
    'https://source.invalid/attachment.png',
    [],
    'https://qa.invalid',
    new stdClass(),
    1,
  );
  actionCheck(
    is_string($localized) && !is_file($cachePath),
    'Attachment-only import invalidates usage before media registration',
  );
  $newStats = getCachedFolderStats($storageDirectory . '/uploads');
  actionCheck(
    $newStats['files'] === $oldStats['files'] + 1 && $newStats['bytes'] > $oldStats['bytes'],
    'Imported image has immediate live storage totals',
  );
  $cachedBeforeReuse = file_get_contents($cachePath);
  rehost_import_image_url(
    'https://source.invalid/attachment.png',
    [],
    'https://qa.invalid',
    new stdClass(),
    1,
  );
  actionCheck(
    file_get_contents($cachePath) === $cachedBeforeReuse,
    'Reusing an import image does not unnecessarily invalidate counts',
  );
  rollback_imported_media_since(new PDO('sqlite::memory:'), 0);
  actionCheck(
    !is_file($cachePath) && getCachedFolderStats($storageDirectory . '/uploads') === $oldStats,
    'Insert rollback invalidates usage after removing the imported file',
  );
  $retriedImport = rehost_import_image_url(
    'https://source.invalid/attachment.png',
    [],
    'https://qa.invalid',
    new stdClass(),
    1,
  );
  $retryFile =
    $storageDirectory .
    '/uploads/' .
    basename((string) parse_url((string) $retriedImport, PHP_URL_PATH));
  actionCheck(
    is_string($retriedImport) && is_file($retryFile) && !is_file($cachePath),
    'Same-URL import after rollback recreates its file and invalidates totals',
  );
  actionCheck(
    getCachedFolderStats($storageDirectory . '/uploads')['files'] === $oldStats['files'] + 1,
    'Retried image immediately appears in storage counts',
  );

  foreach (
    [
      'ai_provider_helper',
      'content_audit_helper',
      'ImageProcessor',
      'mail_helper',
      'media_library_filter_helper',
      'public_cache_helper',
      'redirect_loop_helper',
      'role_capability_helper',
      'schema_repair_helper',
      'settings_audit_helper',
    ]
    as $helper
  ) {
    $file = $root . '/public/api/' . $helper . '.php';
    $code =
      '$_SERVER["SCRIPT_FILENAME"]=' .
      var_export($file, true) .
      ';register_shutdown_function(static function(){echo ":".(http_response_code()?:200);});require ' .
      var_export($file, true) .
      ';';
    $process = proc_open(
      [PHP_BINARY, '-r', $code],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );
    actionCheck(is_resource($process), 'Direct helper probe starts');
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $status = proc_close($process);
    actionCheck(
      $status === 0 && $out === 'Forbidden:403' && $err === '',
      'Direct helper request denied: ' . $helper,
    );
  }

  echo 'PASS API Action Boundaries: ' .
    $checks .
    " checks (isolated PHP processes/SQLite; SMTP stub).\n";
} finally {
  unset($consume, $lookup, $pdo, $resendDb, $avatarDb, $raceDb, $insertPost, $insertComment);
  // The only deletion target is the random, test-created fixture directory above.
  $iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($fixtureRoot, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::CHILD_FIRST,
  );
  foreach ($iterator as $entry) {
    if ($entry->isDir() && !$entry->isLink()) {
      rmdir($entry->getPathname());
    } else {
      unlink($entry->getPathname());
    }
  }
  rmdir($fixtureRoot);
}
