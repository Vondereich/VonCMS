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
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    return parent::prepare(
      str_replace(
        [' FOR UPDATE', 'DATE_ADD(NOW(), INTERVAL 1 HOUR)'],
        ['', "datetime('now', '+1 hour')"],
        $query,
      ),
      $options,
    );
  }

  public function exec(string $statement): int|false
  {
    if (
      $statement ===
      'DELETE FROM contact_submissions WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
    ) {
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
  return $pdo;
}

if (($argv[1] ?? '') === '--worker') {
  $directory = $argv[2];
  $options = json_decode($argv[3], true, 512, JSON_THROW_ON_ERROR);
  $index = $options['index'];
  ob_start();
  register_shutdown_function(static function () use ($directory, $index): void {
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
          'body' => json_decode($output, true),
          'output' => $output,
          'fatal' => $error && in_array($error['type'], [E_ERROR, E_PARSE, E_COMPILE_ERROR], true),
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
    public static function isPrimaryAdmin(): bool
    {
      return ($_SESSION['user']['id'] ?? '') === '1';
    }
    public static function isAdmin(): bool
    {
      return self::isPrimaryAdmin();
    }
    public static function isValid(): bool
    {
      return isset($_SESSION['user']);
    }
    public static function isStaff(): bool
    {
      return self::isPrimaryAdmin();
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
  $rateStorage = new ReflectionProperty(RateLimiter::class, 'storageDir');
  $rateStorage->setValue(null, $directory . '/rates/');
  if (!RateLimiter::getStorageHealth()['healthy']) {
    throw new RuntimeException('QA requires writable, lockable rate-limit storage');
  }
  eval(actionDeclaration($root . '/public/security.php', 'class CSRFProtection'));
  eval(actionDeclaration($root . '/public/security.php', 'class SecurityHelper'));
  $pdo = actionDatabase($directory);
  $case = $options['case'] ?? 'normal';
  $endpoint = $options['endpoint'];
  if ($endpoint === 'submit_contact.php') {
    require $root . '/public/api/contact_honeypot_helper.php';
    $challenge = voncms_contact_honeypot_issue('qa_form');
    sleep(1);
    $input = [
      'formId' => 'qa_form',
      'data' => ['your-email' => 'qa@example.invalid', 'message' => 'Ordinary QA message'],
      'antiBot' => ['field' => $challenge['field'], 'token' => $challenge['token'], 'value' => ''],
    ];
    if ($case === 'bot') {
      $input['antiBot']['value'] = '0';
    }
    if ($case === 'invalid') {
      $input['data']['your-email'] = 'invalid-address';
    }
    function vonSendMail($to, ...$arguments): array
    {
      global $pdo, $case;
      $pdo->prepare('INSERT INTO mail_calls(recipient) VALUES (?)')->execute([$to]);
      return ['success' => $case !== 'mail-failure', 'message' => 'QA transport'];
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
  } elseif ($endpoint === 'login.php') {
    $input = ['username' => 'qa_member', 'password' => $options['password'] ?? 'Wrong1!Password'];
  } elseif ($endpoint === 'reset_password.php') {
    foreach (
      [
        'voncms_normalize_trusted_public_base_url',
        'voncms_loopback_request_base_url',
        'voncms_resolve_trusted_public_base_url',
        'voncms_build_account_action_url',
      ]
      as $name
    ) {
      eval(actionDeclaration($root . '/public/api/mail_helper.php', 'function ' . $name . '('));
    }
    function vonSendMail($to, ...$arguments): array
    {
      global $pdo;
      $pdo->prepare('INSERT INTO mail_calls(recipient) VALUES (?)')->execute([$to]);
      return ['success' => true];
    }
    $input = ['action' => 'request', 'email' => $options['email'] ?? 'qa@example.invalid'];
    $input['hp_field'] = $case === 'bot' ? '0' : '';
  } elseif ($endpoint === 'save_comments.php') {
    $_SESSION['user'] = ['id' => '2', 'role' => 'Member'];
    $input = ['action' => 'delete', 'commentId' => $case === 'not-owner' ? '12' : '10'];
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
  $_SERVER['HTTP_X_CSRF_TOKEN'] = $case === 'csrf' ? 'forged' : CSRFProtection::getToken();
  $cachedInput = new ReflectionProperty(CSRFProtection::class, 'cachedInput');
  $cachedInput->setValue(null, json_encode($input, JSON_THROW_ON_ERROR));
  $source = file_get_contents($root . '/public/api/' . $endpoint);
  $source = preg_replace('/^<\?php\s*/', '', $source, 1);
  $source = preg_replace('/^\s*require_once [^\r\n]+;\s*$/m', '', $source);
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
    'CREATE TABLE contact_forms(id TEXT,title TEXT,template TEXT,mail_to TEXT,mail_from TEXT,mail_subject TEXT,mail_body TEXT,msg_success TEXT,msg_error TEXT,msg_validation TEXT)',
  );
  $pdo->exec(
    "INSERT INTO contact_forms VALUES('qa_form','QA','[email* your-email] [textarea* message]','owner@example.invalid','sender@example.invalid','QA','[message]','QA accepted','QA failed','QA validation')",
  );
  $pdo->exec(
    'CREATE TABLE contact_submissions(id INTEGER PRIMARY KEY,form_id TEXT,data TEXT,ip_address TEXT,user_agent TEXT,referrer TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)',
  );
  $pdo->exec('CREATE TABLE mail_calls(id INTEGER PRIMARY KEY,recipient TEXT)');
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

try {
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
  actionCheck(
    actionRun($directory, [['endpoint' => 'submit_contact.php', 'case' => 'mail-failure']])[0][
      'status'
    ] === 502,
    'Contact transport failure changed',
  );
  $quota = json_decode(file_get_contents(glob($directory . '/rates/*.json')[0]), true);
  actionCheck($quota['attempts'] === 1, 'Failed delivery was not charged exactly once');

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
        "~'(SELECT id FROM users WHERE reset_token = \\? AND reset_token_expires > NOW\\(\\) FOR UPDATE)'~",
        $resetSource,
        $match,
      );
      actionCheck(isset($match[1]), 'Actual reset consumer was not found');
      $lookup = $pdo->prepare($match[1]);
      $lookup->execute([str_repeat('a', 64)]);
      actionCheck(
        ($lookup->fetchColumn() === false) === $changed,
        'Old bearer authority survived password replacement',
      );
    }
  }
  $directory = actionFixture('distributed-login');
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
  echo 'PASS API Action Boundaries: ' .
    $checks .
    " checks (isolated PHP processes/SQLite; SMTP stub).\n";
} finally {
  unset($lookup, $pdo);
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
