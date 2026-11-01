<?php
/** Actual crypto and AI-configuration regressions; fake keys and owned temporary storage only. */
$root = dirname(__DIR__, 2);
$temporary = sys_get_temp_dir() . '/voncms-credential-qa-' . bin2hex(random_bytes(8));
if (!mkdir($temporary, 0700)) {
  throw new RuntimeException('Cannot prepare private credential fixture.');
}
define('VONCMS_CREDENTIAL_KEY_FILE', $temporary . '/credential_master.key.php');
require_once $root . '/public/api/ai_provider_helper.php';
$checks = 0;
function credentialCheck(bool $condition, string $description): void
{
  global $checks;
  $checks++;
  if (!$condition) {
    throw new RuntimeException($description);
  }
}
function credentialReject(callable $operation, string $description): void
{
  try {
    $operation();
  } catch (Throwable $e) {
    credentialCheck(true, $description);
    return;
  }
  credentialCheck(false, $description);
}
function credentialRemoveFixture(string $directory): void
{
  foreach (scandir($directory) as $name) {
    if ($name === '.' || $name === '..') {
      continue;
    }
    $path = $directory . '/' . $name;
    if (is_dir($path) && !is_link($path)) {
      credentialRemoveFixture($path);
    } else {
      unlink($path);
    }
  }
  rmdir($directory);
}

/** Run the actual save controller with isolated SQLite/auth/session/cache/audit transport. */
function credentialSaveRequest(
  string $directory,
  string $role,
  array $payload,
  bool $csrf = true,
  bool $uncertainCommit = false,
): array {
  $script =
    '$GLOBALS["QA_ROLE"]=' .
    var_export($role, true) .
    ';' .
    '$GLOBALS["QA_BODY"]=' .
    var_export(json_encode($payload), true) .
    ';' .
    '$GLOBALS["QA_CSRF"]=' .
    ($csrf ? 'true' : 'false') .
    ';' .
    '$GLOBALS["QA_UNCERTAIN_COMMIT"]=' .
    ($uncertainCommit ? 'true' : 'false') .
    ';' .
    '$_SERVER["REQUEST_METHOD"]="POST";' .
    'register_shutdown_function(function(){echo "\nSTATUS=".(http_response_code()?:200);});' .
    'require ' .
    var_export($directory . '/api/save_settings.php', true) .
    ';';
  $process = proc_open(
    [PHP_BINARY, '-r', $script],
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
  );
  fclose($pipes[0]);
  $output = stream_get_contents($pipes[1]);
  fclose($pipes[1]);
  $error = stream_get_contents($pipes[2]);
  fclose($pipes[2]);
  $exit = proc_close($process);
  credentialCheck($exit === 0, 'Save controller fixture crashed: ' . $error);
  $parts = explode("\nSTATUS=", $output);
  $body = json_decode($parts[0], true);
  credentialCheck(
    is_array($body) && isset($parts[1]),
    'Save controller did not return structured JSON.',
  );
  return ['status' => (int) $parts[1], 'body' => $body, 'raw' => $output];
}

/** Child execution uses the actual implementation; only fake test material is supplied. */
function credentialPhpProbe(string $script): array
{
  $process = proc_open(
    [PHP_BINARY, '-r', $script],
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $pipes,
  );
  fclose($pipes[0]);
  $output = stream_get_contents($pipes[1]);
  fclose($pipes[1]);
  $errors = stream_get_contents($pipes[2]);
  fclose($pipes[2]);
  $exit = proc_close($process);
  credentialCheck($exit === 0 && $errors === '', 'Actual PHP rotation probe failed: ' . $errors);
  return ['output' => $output, 'exit' => $exit];
}
try {
  $fields = voncms_ai_response_fields([
    'candidates' => [
      ['content' => ['parts' => [['text' => '  R&D café 😀  ']]], 'finishReason' => 'STOP'],
    ],
  ]);
  credentialCheck(
    $fields === ['text' => 'R&D café 😀', 'blocked' => false, 'finishReason' => 'STOP'],
    'Provider field normalization changed ordinary text.',
  );
  foreach (
    [
      [],
      ['candidates' => 'bad'],
      ['candidates' => [null]],
      ['candidates' => [['content' => []]]],
      ['candidates' => [['content' => ['parts' => [['text' => []]]]]]],
    ]
    as $badResponse
  ) {
    credentialCheck(
      voncms_ai_response_fields($badResponse)['text'] === '',
      'Malformed provider data became generated text.',
    );
  }
  credentialCheck(
    voncms_ai_response_fields(['promptFeedback' => ['blockReason' => 'SAFETY']])['blocked'],
    'Provider safety feedback was lost.',
  );
  credentialCheck(
    voncms_ai_generate_with_fallback('qa-dummy-key', 'gemini-3.8-flash', ['invalid' => NAN], 1)[
      'error_code'
    ] === 'AI_INVALID_REQUEST',
    'Unencodable provider request was sent.',
  );
  $context = 'voncms:global-gemini:v1';
  $fake = 'qa-fake-provider-key-NOT-A-REAL-KEY';
  $legacy = [
    'aiProvider' => 'gemini',
    'aiModel' => 'gemini-3.8-flash',
    'aiApiKey' => $fake,
    'expireAiKeyAfter30Days' => true,
    'aiKeySavedAt' => gmdate('c', time() - 86400),
    'aiKeyExpiresAt' => gmdate('c', time() + 29 * 86400),
  ];
  credentialCheck(
    voncms_ai_owner_projection($legacy)['aiApiKey'] === '******** (PROTECTED)',
    'Legacy owner read exposed plaintext.',
  );
  credentialCheck(
    voncms_ai_owner_projection($legacy)['aiKeyStorage'] === 'legacy',
    'Legacy status missing.',
  );
  credentialCheck(!file_exists(VONCMS_CREDENTIAL_KEY_FILE), 'Read created a master key.');
  credentialCheck(
    voncms_ai_configured_key($legacy) === $fake,
    'Legacy provider access broke before explicit migration.',
  );
  credentialReject(
    fn() => VonCmsCredentialStore::encrypt($fake, $context),
    'Missing master was silently initialized by a read/default encryption call.',
  );

  $migrated = voncms_ai_prepare_stored_config(
    ['aiApiKey' => '******** (PROTECTED)', 'encryptStoredAiKey' => true],
    $legacy,
  );
  credentialCheck(
    VonCmsCredentialStore::isEncrypted($migrated['aiApiKey']),
    'Legacy Save did not encrypt.',
  );
  credentialCheck(
    !str_contains(json_encode($migrated), $fake),
    'Stored configuration contains plaintext.',
  );
  credentialCheck(
    !isset($migrated['encryptStoredAiKey'], $migrated['aiKeyStorage']),
    'Projection/save intent persisted.',
  );
  credentialCheck(
    $migrated['aiKeySavedAt'] === $legacy['aiKeySavedAt'] &&
      $migrated['aiKeyExpiresAt'] === $legacy['aiKeyExpiresAt'],
    'Migration extended the existing expiry.',
  );
  $legacyEcho = voncms_ai_prepare_stored_config($legacy, $legacy);
  credentialCheck(
    $legacyEcho['aiKeyExpiresAt'] === $legacy['aiKeyExpiresAt'],
    'Legacy client plaintext echo silently renewed expiry.',
  );
  $legacyReentry = voncms_ai_prepare_stored_config(
    ['aiApiKey' => $fake, 'replaceAiKey' => true],
    $legacy,
  );
  credentialCheck(
    strtotime($legacyReentry['aiKeyExpiresAt']) > strtotime($legacy['aiKeyExpiresAt']) &&
      !isset($legacyReentry['replaceAiKey']),
    'Explicit legacy re-entry intent was not handled privately.',
  );
  credentialCheck(
    voncms_ai_configured_key($migrated) === $fake,
    'Encrypted provider key did not round-trip.',
  );
  credentialCheck(
    voncms_ai_owner_projection($migrated)['aiKeyStorage'] === 'encrypted',
    'Encrypted status missing.',
  );
  $projection = json_encode(voncms_ai_owner_projection($migrated));
  credentialCheck(
    !str_contains($projection, $fake) && !str_contains($projection, $migrated['aiApiKey']),
    'Owner response contains plaintext or ciphertext.',
  );
  $master = file_get_contents(VONCMS_CREDENTIAL_KEY_FILE);
  credentialCheck(!str_contains($master, $fake), 'Master file stores the provider API key.');
  if (DIRECTORY_SEPARATOR !== '\\') {
    credentialCheck(
      (fileperms(VONCMS_CREDENTIAL_KEY_FILE) & 0777) === 0600,
      'Master permissions are not private.',
    );
  }

  $again = VonCmsCredentialStore::encrypt($fake, $context);
  credentialCheck($again !== $migrated['aiApiKey'], 'Encryption reused a nonce.');
  credentialCheck(
    VonCmsCredentialStore::decrypt($again, $context) === $fake,
    'Second encryption broke.',
  );
  credentialReject(
    fn() => VonCmsCredentialStore::decrypt($again, 'voncms:personal-ai:99'),
    'Ciphertext can cross credential contexts.',
  );
  $payload = base64_decode(substr($again, strlen('voncms:secret:v1:')), true);
  foreach ([0, 11, 12, 27, 28, strlen($payload) - 1] as $offset) {
    $tampered = $payload;
    $tampered[$offset] = chr(ord($tampered[$offset]) ^ 1);
    credentialReject(
      fn() => VonCmsCredentialStore::decrypt(
        'voncms:secret:v1:' . base64_encode($tampered),
        $context,
      ),
      'Nonce/tag/ciphertext tampering accepted.',
    );
  }
  foreach (
    [
      'voncms:secret:v9:invalid',
      'voncms:secret:v1:!',
      'voncms:secret:v1:' . base64_encode(substr($payload, 0, 27)),
      $again . "\n",
    ]
    as $invalid
  ) {
    credentialReject(
      fn() => VonCmsCredentialStore::decrypt($invalid, $context),
      'Malformed or truncated envelope accepted.',
    );
    credentialCheck(
      voncms_ai_configured_key(['aiApiKey' => $invalid]) === '',
      'Malformed ciphertext became a legacy provider key.',
    );
  }
  $unchanged = voncms_ai_prepare_stored_config(voncms_ai_owner_projection($migrated), $migrated);
  credentialCheck($unchanged === $migrated, 'Masked unchanged Save changed ciphertext or expiry.');
  $partial = voncms_ai_prepare_stored_config(['aiModel' => 'gemini-3.6-flash'], $migrated);
  credentialCheck(
    $partial['aiApiKey'] === $migrated['aiApiKey'],
    'Omitted key erased the saved credential.',
  );
  $expired = array_replace($migrated, [
    'aiKeySavedAt' => gmdate('c', time() - 31 * 86400),
    'aiKeyExpiresAt' => gmdate('c', time() - 86400),
  ]);
  credentialCheck(voncms_ai_configured_key($expired) === '', 'Expired encrypted key still usable.');
  credentialCheck(
    voncms_ai_prepare_stored_config(voncms_ai_owner_projection($expired), $expired) === $expired,
    'Unchanged Save erased or renewed expired key.',
  );
  $renewed = voncms_ai_prepare_stored_config(['aiApiKey' => $fake], $expired);
  credentialCheck(
    voncms_ai_configured_key($renewed) === $fake &&
      strtotime($renewed['aiKeyExpiresAt']) > time() + 29 * 86400,
    'Explicit re-entry did not renew local expiry.',
  );
  credentialCheck(
    $renewed['aiApiKey'] !== $expired['aiApiKey'],
    'Re-entry did not create a new envelope.',
  );
  $withoutExpiry = voncms_ai_prepare_stored_config(['expireAiKeyAfter30Days' => false], $expired);
  credentialCheck(
    !isset($withoutExpiry['aiKeyExpiresAt']) && voncms_ai_configured_key($withoutExpiry) === $fake,
    'Optional expiry toggle broke.',
  );
  foreach ([null, [], new stdClass(), 123, $migrated['aiApiKey'], "key\r\nheader"] as $bad) {
    credentialReject(
      fn() => voncms_ai_prepare_stored_config(['aiApiKey' => $bad], $migrated),
      'Invalid key input accepted.',
    );
  }
  $removed = voncms_ai_prepare_stored_config(['aiApiKey' => ''], $migrated);
  credentialCheck(
    !isset($removed['aiApiKey'], $removed['aiKeySavedAt'], $removed['aiKeyExpiresAt']),
    'Explicit removal retained credentials or expiry.',
  );
  credentialCheck(
    voncms_ai_owner_projection($removed)['aiKeyStorage'] === 'empty',
    'Removed key status incorrect.',
  );
  credentialCheck(
    file_get_contents(VONCMS_CREDENTIAL_KEY_FILE) === $master,
    'Ordinary operations rotated the master key.',
  );

  $pdo = new PDO('sqlite::memory:');
  $pdo->exec('CREATE TABLE settings(setting_group TEXT, setting_key TEXT, setting_value TEXT)');
  $pdo
    ->prepare('INSERT INTO settings VALUES(?,?,?)')
    ->execute(['api', 'config', json_encode($migrated)]);
  $shared = voncms_ai_resolve_request($pdo, 'gemini-3.5-flash-lite', '');
  credentialCheck(
    $shared['shared'] && $shared['api_key'] === $fake && $shared['model'] === 'gemini-3.8-flash',
    'Shared server-owned credential/model authority changed.',
  );
  credentialCheck(
    voncms_ai_resolve_request($pdo, 'gemini-3.8-flash', $migrated['aiApiKey']) === null,
    'Stored ciphertext accepted as an explicit provider key.',
  );
  $own = voncms_ai_resolve_request($pdo, 'gemini-3.5-flash-lite', 'qa-own-key');
  credentialCheck(
    !$own['shared'] &&
      $own['api_key'] === 'qa-own-key' &&
      $own['model'] === 'gemini-3.5-flash-lite',
    'Existing temporary own-key flow changed.',
  );
  $dumped = $pdo->query('SELECT setting_value FROM settings')->fetchColumn();
  credentialCheck(
    !str_contains($dumped, $fake) && !str_contains($dumped, trim(substr($master, -65))),
    'Database contains plaintext or master material.',
  );

  unlink(VONCMS_CREDENTIAL_KEY_FILE);
  credentialCheck(
    voncms_ai_configured_key($migrated) === '',
    'Missing master did not fail closed.',
  );
  credentialCheck(
    voncms_ai_owner_projection($migrated)['aiKeyStorage'] === 'unavailable',
    'Missing master appeared empty or usable.',
  );
  credentialCheck(!file_exists(VONCMS_CREDENTIAL_KEY_FILE), 'Read regenerated the missing master.');
  credentialCheck(
    voncms_ai_prepare_stored_config(voncms_ai_owner_projection($migrated), $migrated) === $migrated,
    'Missing-master Save erased or changed ciphertext.',
  );
  credentialCheck(
    !file_exists(VONCMS_CREDENTIAL_KEY_FILE),
    'Unchanged Save regenerated the missing master.',
  );
  file_put_contents(VONCMS_CREDENTIAL_KEY_FILE, 'corrupt fixture master');
  credentialReject(
    fn() => VonCmsCredentialStore::encrypt('qa-new-key', $context, true),
    'Corrupt master was overwritten.',
  );
  credentialCheck(
    file_get_contents(VONCMS_CREDENTIAL_KEY_FILE) === 'corrupt fixture master',
    'Corrupt key changed after rejection.',
  );
  file_put_contents(VONCMS_CREDENTIAL_KEY_FILE, $master);
  credentialCheck(
    voncms_ai_configured_key($migrated) === $fake,
    'Restored master cannot recover stored key.',
  );
  $wrongMaster = substr($master, 0, -65) . bin2hex(random_bytes(32)) . "\n";
  file_put_contents(VONCMS_CREDENTIAL_KEY_FILE, $wrongMaster);
  credentialCheck(
    voncms_ai_configured_key($migrated) === '',
    'Wrong master decrypted a credential.',
  );
  file_put_contents(VONCMS_CREDENTIAL_KEY_FILE, $master);

  $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
  foreach ([$root . '/public/core/CredentialStore.php', VONCMS_CREDENTIAL_KEY_FILE] as $guarded) {
    $script =
      '$_SERVER["SCRIPT_FILENAME"]=' .
      var_export($guarded, true) .
      ';register_shutdown_function(function(){echo "STATUS=".http_response_code();});require ' .
      var_export($guarded, true) .
      ';';
    $process = proc_open([PHP_BINARY, '-r', $script], $descriptors, $pipes);
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    $status = proc_close($process);
    credentialCheck(
      $status === 0 &&
        str_contains($output, 'STATUS=403') &&
        !str_contains($output, trim(substr($master, -65))) &&
        $error === '',
      'Direct PHP request leaked key or lacked guard.',
    );
  }
  $harness = $temporary . '/save-controller';
  foreach (['api', 'core', 'data'] as $directory) {
    mkdir($harness . '/' . $directory, 0700, true);
  }
  foreach (['save_settings.php', 'ai_provider_helper.php', 'role_capability_helper.php'] as $file) {
    copy($root . '/public/api/' . $file, $harness . '/api/' . $file);
  }
  copy($root . '/public/core/CredentialStore.php', $harness . '/core/CredentialStore.php');
  copy($root . '/public/core/DataBoundary.php', $harness . '/core/DataBoundary.php');
  file_put_contents(
    $harness . '/security.php',
    <<<'PHP'
    <?php
    require_once __DIR__ . '/core/DataBoundary.php';
    define('VONCMS_CREDENTIAL_KEY_FILE', __DIR__ . '/data/credential_master.key.php');
    $_SESSION['user'] = ['id' => ($GLOBALS['QA_ROLE'] === 'owner' ? 1 : 2), 'role' => ($GLOBALS['QA_ROLE'] === 'owner' ? 'admin' : $GLOBALS['QA_ROLE'])];
    function sendApiHeaders($methods) {}
    class ResponseHelper {
      public static function sendError($message, $status = 500) { http_response_code($status); echo json_encode(['success' => false, 'error' => is_string($message) ? $message : 'Server error']); exit; }
    }
    class SessionManager {
      public static function requireValidSession() { if ($GLOBALS['QA_ROLE'] === 'guest') ResponseHelper::sendError('Authentication required', 401); }
      public static function isPrimaryAdmin() { return $GLOBALS['QA_ROLE'] === 'owner' || $GLOBALS['QA_ROLE'] === 'root'; }
    }
    class CSRFProtection {
      public static function requireToken() { if (!$GLOBALS['QA_CSRF']) ResponseHelper::sendError('Invalid CSRF token', 403); }
      public static function getRequestBody() { return $GLOBALS['QA_BODY']; }
    }
    class SecurityHelper { public static function isSensitiveKey($key) { return preg_match('/key|secret|pass|token/i', $key) === 1; } }
    PHP
    ,
  );
  file_put_contents(
    $harness . '/api/settings_audit_helper.php',
    <<<'PHP'
    <?php
    function voncms_purge_sensitive_setting_audit_history($pdo) {}
    function voncms_get_setting_audit_snapshot($pdo, $group, $key) { return null; }
    function voncms_record_setting_audit(...$args) {}
    PHP
    ,
  );
  file_put_contents(
    $harness . '/api/public_cache_helper.php',
    '<?php function voncms_public_cache_clear() {}',
  );
  file_put_contents(
    $harness . '/von_config.php',
    '<?php require_once ' .
      var_export($root . '/server/integration/sqlite-compat.php', true) .
      ';' .
      <<<'PHP'
      class CredentialFixturePDO extends VonCmsFixtureSqlitePDO {
        public function commit(): bool {
          $result = parent::commit();
          if ($GLOBALS['QA_UNCERTAIN_COMMIT'] ?? false) throw new RuntimeException('Simulated lost commit acknowledgement');
          return $result;
        }
        public function prepare(string $query, array $options = []): PDOStatement|false {
          $query = str_replace(' FOR UPDATE', '', $query);
          if (str_contains($query, 'ON DUPLICATE KEY UPDATE')) {
            $query = str_replace('ON DUPLICATE KEY UPDATE', 'ON CONFLICT(setting_group,setting_key) DO UPDATE SET', $query);
            $query = preg_replace('/VALUES\((\w+)\)/', 'excluded.$1', $query);
          }
          return parent::prepare($query, $options);
        }
      }
      $pdo = new CredentialFixturePDO('sqlite:' . __DIR__ . '/settings.sqlite');
      $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      $pdo->createFunction('NOW', static fn() => gmdate('Y-m-d H:i:s'));
      PHP,
  );
  $database = new PDO('sqlite:' . $harness . '/settings.sqlite');
  $database->exec(
    'CREATE TABLE settings(setting_group TEXT,setting_key TEXT,setting_value TEXT,setting_type TEXT,is_public INT,updated_by INT,version INT DEFAULT 1,updated_at TEXT,PRIMARY KEY(setting_group,setting_key))',
  );
  $database
    ->prepare('INSERT INTO settings(setting_group,setting_key,setting_value) VALUES(?,?,?)')
    ->execute(['general', 'domain_url', 'https://qa.invalid']);
  $readConfig = static fn() => $database
    ->query("SELECT setting_value FROM settings WHERE setting_group='api' AND setting_key='config'")
    ->fetchColumn();
  foreach (['guest', 'member', 'writer', 'moderator', 'admin'] as $role) {
    $response = credentialSaveRequest($harness, $role, ['api' => ['aiApiKey' => $fake]]);
    credentialCheck(
      $response['status'] === ($role === 'guest' ? 401 : 403),
      'Unexpected non-owner save status for ' .
        $role .
        ': ' .
        $response['status'] .
        ' ' .
        json_encode($response['body']),
    );
    credentialCheck(
      $readConfig() === false && !file_exists($harness . '/data/credential_master.key.php'),
      'Non-owner reached encrypted key persistence.',
    );
  }
  $response = credentialSaveRequest($harness, 'owner', ['api' => ['aiApiKey' => $fake]], false);
  credentialCheck(
    $response['status'] === 403 && $readConfig() === false,
    'Tokenless owner changed key storage.',
  );
  $database
    ->prepare(
      'INSERT INTO settings(setting_group,setting_key,setting_value,setting_type,is_public) VALUES(?,?,?,?,?)',
    )
    ->execute(['api', 'config', json_encode($legacy), 'json', 0]);
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => ['aiApiKey' => '******** (PROTECTED)', 'encryptStoredAiKey' => true],
  ]);
  credentialCheck(
    $response['status'] === 200 && $response['body']['success'],
    'Owner Save failed.',
  );
  $storedConfig = json_decode($readConfig(), true);
  credentialCheck(
    VonCmsCredentialStore::isEncrypted($storedConfig['aiApiKey']) &&
      !str_contains($readConfig(), $fake),
    'Actual SQL writer persisted plaintext.',
  );
  credentialCheck(
    $storedConfig['aiKeyExpiresAt'] === $legacy['aiKeyExpiresAt'],
    'SQL migration changed expiry.',
  );
  credentialCheck(
    ($response['body']['apiCredential']['aiKeyStorage'] ?? '') === 'encrypted',
    'Save response missed canonical encrypted status.',
  );
  credentialCheck(
    ($response['body']['aiAssistant'] ?? null) === [
      'sharedAvailable' => true,
      'model' => voncms_ai_normalize_model($storedConfig['aiModel'] ?? null),
    ],
    'Save response missed the safe AI readiness/model projection.',
  );
  credentialCheck(
    array_keys($response['body']['aiAssistant']) === ['sharedAvailable', 'model'] &&
      $response['body']['aiAssistant']['sharedAvailable'] === true,
    'Saved usable key is unavailable or the AI projection contains private fields.',
  );
  credentialCheck(
    !str_contains($response['raw'], $fake) &&
      !str_contains($response['raw'], $storedConfig['aiApiKey']),
    'Save response exposed key material.',
  );
  $mirror = file_get_contents($harness . '/data/site_settings.json');
  credentialCheck(
    !str_contains($mirror, $fake) && !str_contains($mirror, $storedConfig['aiApiKey']),
    'Compatibility mirror contains key material.',
  );
  $savedSql = $readConfig();
  $rootControl = credentialSaveRequest($harness, 'root', [
    'api' => ['aiApiKey' => '******** (PROTECTED)'],
  ]);
  credentialCheck(
    $rootControl['status'] === 200 && $readConfig() === $savedSql,
    'Existing Root owner privilege changed.',
  );
  // A negative control in the disposable controller proves the SQL assertion detects no encryption.
  $controllerPath = $harness . '/api/save_settings.php';
  $controllerSource = file_get_contents($controllerPath);
  $disabled = str_replace(
    '$value = voncms_ai_prepare_stored_config($value, $existingApiConfig);',
    '$value = array_replace($existingApiConfig, $value);',
    $controllerSource,
    $replacementCount,
  );
  credentialCheck($replacementCount === 1, 'Could not prepare the isolated no-encryption control.');
  try {
    file_put_contents($controllerPath, $disabled);
    $negative = credentialSaveRequest($harness, 'owner', [
      'api' => ['aiApiKey' => 'qa-before-encryption-control'],
    ]);
    credentialCheck(
      $negative['status'] === 200 && str_contains($readConfig(), 'qa-before-encryption-control'),
      'The regression trigger does not detect plaintext persistence without encryption.',
    );
  } finally {
    file_put_contents($controllerPath, $controllerSource);
    $database
      ->prepare(
        "UPDATE settings SET setting_value=? WHERE setting_group='api' AND setting_key='config'",
      )
      ->execute([$savedSql]);
  }
  $harnessMaster = file_get_contents($harness . '/data/credential_master.key.php');
  $database->exec(
    "CREATE TRIGGER reject_credential_save BEFORE UPDATE ON settings WHEN NEW.setting_group='api' BEGIN SELECT RAISE(ABORT, 'fixture database failure'); END",
  );
  $failedSave = credentialSaveRequest($harness, 'owner', [
    'siteName' => 'DB_FAILURE_ROLLBACK',
    'api' => ['aiApiKey' => 'qa-database-failure-key'],
  ]);
  credentialCheck(
    $failedSave['status'] === 500 && $readConfig() === $savedSql,
    'Database rejection replaced the encrypted credential.',
  );
  credentialCheck(
    file_get_contents($harness . '/data/credential_master.key.php') === $harnessMaster,
    'Database rejection rotated the master key.',
  );
  credentialCheck(
    $database
      ->query(
        "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='site_name'",
      )
      ->fetchColumn() === false,
    'Database failure committed unrelated settings.',
  );
  $database->exec('DROP TRIGGER reject_credential_save');
  $response = credentialSaveRequest($harness, 'admin', [
    'siteTagline' => 'QA delegated setting',
    'api' => ['aiApiKey' => 'qa-unauthorized-replacement'],
  ]);
  credentialCheck(
    $readConfig() === $savedSql && $response['body']['apiCredential'] === null,
    'Appointed Admin replaced or obtained global credential state.',
  );
  foreach ([[], null, $storedConfig['aiApiKey'], "qa\r\nkey"] as $bad) {
    $response = credentialSaveRequest($harness, 'owner', ['api' => ['aiApiKey' => $bad]]);
    credentialCheck(
      $response['status'] === 400 && $readConfig() === $savedSql,
      'Invalid key changed persisted SQL data.',
    );
  }
  unlink($harness . '/data/credential_master.key.php');
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => ['aiApiKey' => '******** (PROTECTED)'],
  ]);
  credentialCheck(
    $readConfig() === $savedSql && !file_exists($harness . '/data/credential_master.key.php'),
    'Missing-master unchanged Save erased ciphertext or regenerated key.',
  );
  credentialCheck(
    ($response['body']['apiCredential']['aiKeyStorage'] ?? '') === 'unavailable',
    'Missing-master Save did not report unavailable status.',
  );
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => ['aiApiKey' => 'qa-explicit-recovery-key'],
  ]);
  credentialCheck(
    $response['status'] === 200 &&
      file_exists($harness . '/data/credential_master.key.php') &&
      $readConfig() !== $savedSql,
    'Explicit owner recovery failed.',
  );
  $savedSql = $readConfig();
  file_put_contents($harness . '/data/credential_master.key.php', 'invalid master');
  $response = credentialSaveRequest($harness, 'owner', [
    'siteName' => 'MUST_ROLL_BACK',
    'api' => ['aiApiKey' => 'qa-rejected-key'],
  ]);
  credentialCheck(
    $response['status'] === 503 &&
      $readConfig() === $savedSql &&
      $database
        ->query(
          "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='site_name'",
        )
        ->fetchColumn() === false,
    'Crypto failure did not roll back the Settings transaction.',
  );
  $response = credentialSaveRequest($harness, 'owner', ['api' => ['aiApiKey' => '']]);
  credentialCheck(
    $response['status'] === 200 && !isset(json_decode($readConfig(), true)['aiApiKey']),
    'Owner could not explicitly remove an unreadable credential.',
  );
  credentialCheck(
    ($response['body']['aiAssistant']['sharedAvailable'] ?? null) === false,
    'Clearing a key left the editor shared-key status enabled.',
  );
  $emptySql = $readConfig();
  unlink($harness . '/data/credential_master.key.php');
  mkdir($harness . '/data/credential_master.key.php');
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => ['aiApiKey' => 'qa-storage-rejection'],
  ]);
  credentialCheck(
    $response['status'] === 503 && $readConfig() === $emptySql,
    'Unavailable key storage allowed plaintext persistence.',
  );
  rmdir($harness . '/data/credential_master.key.php');

  // Rotation uses the real endpoint and file implementation, not a rewritten state machine.
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => [
      'aiApiKey' => $fake,
      'expireAiKeyAfter30Days' => true,
      'mapsApiKey' => 'qa-unrelated-map-secret',
    ],
  ]);
  credentialCheck($response['status'] === 200, 'Rotation setup Save failed.');
  $beforeRotation = json_decode($readConfig(), true);
  $masterPath = $harness . '/data/credential_master.key.php';
  $probePrefix =
    'define("VONCMS_CREDENTIAL_KEY_FILE",' .
    var_export($masterPath, true) .
    ');require ' .
    var_export($root . '/public/api/ai_provider_helper.php', true) .
    ';';
  $readDigest = static function (array $config) use ($probePrefix): string {
    return credentialPhpProbe(
      $probePrefix .
        'echo hash("sha256",voncms_ai_read_stored_key(' .
        var_export($config, true) .
        '));',
    )['output'];
  };
  $rotationRequest = [
    '_credentialAction' => 'rotate',
    '_credentialRevision' => hash('sha256', $beforeRotation['aiApiKey']),
  ];
  $beforeRotationSql = $readConfig();
  $beforeRotationMaster = file_get_contents($masterPath);
  foreach (['guest', 'member', 'writer', 'moderator', 'admin'] as $role) {
    $response = credentialSaveRequest($harness, $role, $rotationRequest);
    credentialCheck(
      $response['status'] === ($role === 'guest' ? 401 : 403),
      'Non-owner could rotate: ' . $role,
    );
    credentialCheck(
      $readConfig() === $beforeRotationSql &&
        file_get_contents($masterPath) === $beforeRotationMaster,
      'Rejected rotation changed storage.',
    );
  }
  foreach (
    [
      ['_credentialAction' => 'rotate', '_credentialRevision' => []],
      ['_credentialAction' => 'rotate', '_credentialRevision' => 'invalid'],
      [
        '_credentialAction' => 'other',
        '_credentialRevision' => $rotationRequest['_credentialRevision'],
      ],
      $rotationRequest + ['siteName' => 'DO_NOT_SAVE'],
    ]
    as $request
  ) {
    $response = credentialSaveRequest($harness, 'owner', $request);
    credentialCheck(
      $response['status'] === 400 && $readConfig() === $beforeRotationSql,
      'Malformed/mixed rotation accepted.',
    );
  }
  $response = credentialSaveRequest($harness, 'owner', $rotationRequest, false);
  credentialCheck(
    $response['status'] === 403 && file_get_contents($masterPath) === $beforeRotationMaster,
    'Tokenless rotation changed key.',
  );
  $response = credentialSaveRequest($harness, 'owner', $rotationRequest);
  $afterRotation = json_decode($readConfig(), true);
  credentialCheck(
    $response['status'] === 200 && str_starts_with($afterRotation['aiApiKey'], 'voncms:secret:v2:'),
    'Owner rotation failed.',
  );
  credentialCheck(
    $readDigest($afterRotation) === hash('sha256', $fake),
    'Rotated credential changed provider key.',
  );
  credentialCheck(
    $readDigest($beforeRotation) === hash('sha256', $fake),
    'Published transition lost previous credential.',
  );
  credentialCheck(
    $afterRotation['aiKeySavedAt'] === $beforeRotation['aiKeySavedAt'] &&
      $afterRotation['aiKeyExpiresAt'] === $beforeRotation['aiKeyExpiresAt'],
    'Rotation renewed expiry.',
  );
  credentialCheck(
    $afterRotation['aiModel'] === $beforeRotation['aiModel'] &&
      $afterRotation['mapsApiKey'] === $beforeRotation['mapsApiKey'],
    'Rotation changed unrelated API fields.',
  );
  credentialCheck(
    ($response['body']['apiCredential']['aiKeyCanRotate'] ?? false) === true &&
      !empty($afterRotation['aiKeyRotatedAt']),
    'Rotation status missing.',
  );
  credentialCheck(
    !str_contains($response['raw'], $fake) &&
      !str_contains($response['raw'], $afterRotation['aiApiKey']) &&
      !str_contains($response['raw'], 'qa-unrelated-map-secret'),
    'Rotation response leaked secret or unrelated API settings.',
  );
  $ringBody = explode("VONCMS_CREDENTIAL_KEY_V2\n", file_get_contents($masterPath), 2)[1];
  $ring = json_decode($ringBody, true);
  foreach ($ring['keys'] as $hex) {
    credentialCheck(
      !str_contains($response['raw'], $hex),
      'Rotation response leaked master material.',
    );
  }
  $rotatedMaster = file_get_contents($masterPath);
  $response = credentialSaveRequest($harness, 'owner', $rotationRequest);
  credentialCheck(
    $response['status'] === 409 && file_get_contents($masterPath) === $rotatedMaster,
    'Stale/replayed rotation changed master.',
  );
  $response = credentialSaveRequest($harness, 'owner', [
    'api' => [
      'aiApiKey' => '******** (PROTECTED)',
      'aiKeyRotatedAt' => '2099-01-01',
      'aiKeyRevision' => 'spoofed',
      'aiKeyCanRotate' => true,
    ],
  ]);
  $current = json_decode($readConfig(), true);
  credentialCheck(
    $response['status'] === 200 &&
      $current['aiKeyRotatedAt'] === $afterRotation['aiKeyRotatedAt'] &&
      !isset($current['aiKeyRevision'], $current['aiKeyCanRotate']),
    'Rotation metadata was spoofable or persisted a projection.',
  );
  $requestForCurrent = static fn(array $config): array => [
    '_credentialAction' => 'rotate',
    '_credentialRevision' => hash('sha256', $config['aiApiKey']),
  ];
  $savedBeforeFailure = $readConfig();
  $database->exec(
    "CREATE TRIGGER fail_rotation BEFORE UPDATE ON settings WHEN NEW.setting_group='api' BEGIN SELECT RAISE(ABORT,'QA_ROTATION_FAILURE'); END;",
  );
  $response = credentialSaveRequest($harness, 'owner', $requestForCurrent($current));
  credentialCheck(
    $response['status'] === 503 &&
      $readConfig() === $savedBeforeFailure &&
      $readDigest($current) === hash('sha256', $fake),
    'Rotation SQL failure lost previous credential.',
  );
  credentialCheck(
    glob($masterPath . '.tmp.*.php') === [],
    'Rotation staging file leaked on failure.',
  );
  $database->exec('DROP TRIGGER fail_rotation');
  // The database may commit even if the caller loses its acknowledgement. Both keys must remain.
  $response = credentialSaveRequest($harness, 'owner', $requestForCurrent($current), true, true);
  $current = json_decode($readConfig(), true);
  credentialCheck(
    $response['status'] === 503 && $readDigest($current) === hash('sha256', $fake),
    'Uncertain commit restored an old-only master.',
  );
  // Termination between file publication and DB write leaves the persisted value readable.
  credentialPhpProbe(
    $probePrefix .
      'VonCmsCredentialStore::rotateSecret(' .
      var_export($current['aiApiKey'], true) .
      ',"voncms:global-gemini:v1",static function($cipher){exit(0);});',
  );
  credentialCheck(
    $readDigest($current) === hash('sha256', $fake),
    'Termination before DB write lost the saved credential.',
  );
  $response = credentialSaveRequest($harness, 'root', $requestForCurrent($current));
  $current = json_decode($readConfig(), true);
  credentialCheck(
    $response['status'] === 200 && $readDigest($current) === hash('sha256', $fake),
    'Root rotation could not recover interrupted transition.',
  );
  $savedMaster = file_get_contents($masterPath);
  $savedSql = $readConfig();
  foreach (['missing', 'corrupt', 'lock-directory'] as $failure) {
    if ($failure === 'missing') {
      unlink($masterPath);
    } elseif ($failure === 'corrupt') {
      file_put_contents($masterPath, 'corrupt QA master');
    } else {
      unlink($masterPath . '.rotate.lock');
      mkdir($masterPath . '.rotate.lock');
    }
    $response = credentialSaveRequest($harness, 'owner', $requestForCurrent($current));
    credentialCheck(
      $response['status'] === 503 && $readConfig() === $savedSql,
      'Unavailable rotation changed stored config.',
    );
    if ($failure === 'missing') {
      credentialCheck(!file_exists($masterPath), 'Rotation recreated missing master.');
    } elseif ($failure === 'corrupt') {
      credentialCheck(
        file_get_contents($masterPath) === 'corrupt QA master',
        'Rotation replaced corrupt master.',
      );
    } else {
      rmdir($masterPath . '.rotate.lock');
      credentialCheck(
        file_get_contents($masterPath) === $savedMaster,
        'Lock failure changed master.',
      );
    }
    file_put_contents($masterPath, $savedMaster);
  }
  for ($rotationIndex = 0; $rotationIndex < 5; $rotationIndex++) {
    $response = credentialSaveRequest($harness, 'owner', $requestForCurrent($current));
    $current = json_decode($readConfig(), true);
    $ring = json_decode(
      explode("VONCMS_CREDENTIAL_KEY_V2\n", file_get_contents($masterPath), 2)[1],
      true,
    );
    credentialCheck(
      $response['status'] === 200 &&
        count($ring['keys']) <= 3 &&
        $readDigest($current) === hash('sha256', $fake),
      'Repeated rotation lost data or grew unbounded.',
    );
  }
  // A second process cannot replace the key while the first owns the rotation lock.
  $readyPath = $temporary . '/rotation-ready';
  $goPath = $temporary . '/rotation-go';
  $capturePath = $temporary . '/rotation-cipher';
  $firstScript =
    $probePrefix .
    'VonCmsCredentialStore::rotateSecret(' .
    var_export($current['aiApiKey'], true) .
    ',"voncms:global-gemini:v1",static function($cipher){' .
    'file_put_contents(' .
    var_export($readyPath, true) .
    ',"ready");$deadline=microtime(true)+10;' .
    'while(!is_file(' .
    var_export($goPath, true) .
    ')){clearstatcache();if(microtime(true)>$deadline)throw new RuntimeException("Fixture barrier timeout");usleep(10000);}' .
    'file_put_contents(' .
    var_export($capturePath, true) .
    ',$cipher);});';
  $rotationWorker = proc_open(
    [PHP_BINARY, '-r', $firstScript],
    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $rotationPipes,
  );
  fclose($rotationPipes[0]);
  try {
    $deadline = microtime(true) + 5;
    while (!is_file($readyPath) && microtime(true) < $deadline) {
      clearstatcache();
      usleep(10000);
    }
    credentialCheck(is_file($readyPath), 'Rotation worker did not reach the file boundary.');
    $busyMaster = file_get_contents($masterPath);
    $busy = credentialPhpProbe(
      $probePrefix .
        'try{VonCmsCredentialStore::rotateSecret(' .
        var_export($current['aiApiKey'], true) .
        ',"voncms:global-gemini:v1",static function($value){});echo "unexpected";}catch(RuntimeException $e){echo $e->getCode();}',
    );
    credentialCheck(
      $busy['output'] === '409' && file_get_contents($masterPath) === $busyMaster,
      'Concurrent rotation bypassed the file lock.',
    );
  } finally {
    file_put_contents($goPath, 'go');
    $rotationOutput = stream_get_contents($rotationPipes[1]);
    fclose($rotationPipes[1]);
    $rotationError = stream_get_contents($rotationPipes[2]);
    fclose($rotationPipes[2]);
    credentialCheck(
      proc_close($rotationWorker) === 0 && $rotationError === '',
      'Rotation worker failed: ' . $rotationError,
    );
  }
  $captured = $current;
  $captured['aiApiKey'] = file_get_contents($capturePath);
  credentialCheck(
    $readDigest($captured) === hash('sha256', $fake) &&
      $readDigest($current) === hash('sha256', $fake),
    'Concurrent transition lost old or pending data.',
  );
  $v2Tests = credentialPhpProbe(
    $probePrefix .
      '$stored=' .
      var_export($captured['aiApiKey'], true) .
      ';$encoded=substr($stored,strlen("voncms:secret:v2:"));$payload=base64_decode($encoded,true);$rejected=0;foreach([0,16,28,44] as $offset){$bad=$payload;$bad[$offset]=chr(ord($bad[$offset])^1);try{VonCmsCredentialStore::decrypt("voncms:secret:v2:".base64_encode($bad),"voncms:global-gemini:v1");}catch(Throwable $e){$rejected++;}}$max=str_repeat("x",8192);$cipher=VonCmsCredentialStore::encrypt($max,"qa:max");echo json_encode(["rejected"=>$rejected,"maximumRoundTrip"=>VonCmsCredentialStore::decrypt($cipher,"qa:max")===$max]);',
  );
  $v2Results = json_decode($v2Tests['output'], true);
  credentialCheck(
    $v2Results['rejected'] === 4 && $v2Results['maximumRoundTrip'],
    'Versioned ciphertext failed tampering or maximum-size checks.',
  );
  $guard = credentialPhpProbe(
    'register_shutdown_function(static function(){echo http_response_code();});require ' .
      var_export($masterPath, true) .
      ';',
  );
  credentialCheck($guard['output'] === '403', 'Rotated key file lost its direct execution guard.');
  $database = null;
  // Simultaneous first Saves must share one installation key, not competing files.
  unlink(VONCMS_CREDENTIAL_KEY_FILE);
  $workers = [];
  for ($index = 0; $index < 16; $index++) {
    $script =
      'define("VONCMS_CREDENTIAL_KEY_FILE",' .
      var_export(VONCMS_CREDENTIAL_KEY_FILE, true) .
      ');require ' .
      var_export($root . '/public/api/ai_provider_helper.php', true) .
      ';echo VonCmsCredentialStore::encrypt("qa-concurrent-key","qa:concurrency",true);';
    $process = proc_open([PHP_BINARY, '-r', $script], $descriptors, $pipes);
    fclose($pipes[0]);
    $workers[] = [$process, $pipes];
  }
  $ciphertexts = [];
  foreach ($workers as [$process, $pipes]) {
    $output = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    credentialCheck($exit === 0 && $error === '', 'Concurrent master-key initialization failed.');
    credentialCheck(
      VonCmsCredentialStore::decrypt($output, 'qa:concurrency') === 'qa-concurrent-key',
      'Concurrent Save used a different installation key.',
    );
    $ciphertexts[] = $output;
  }
  credentialCheck(
    count(array_unique($ciphertexts)) === 16,
    'Concurrent encryption reused ciphertext nonces.',
  );
  echo "PASS Credential Storage: $checks checks; actual AES-GCM/AI functions and Save controller, SQLite dialect adaptation, stubbed session/CSRF/audit/cache transport. Covers ownership, masking, migration, expiry, tampering and missing/corrupt-key recovery. No live data or provider requests.\n";
} finally {
  unset($readConfig, $database, $pdo);
  if (
    dirname($temporary) !== rtrim(sys_get_temp_dir(), '/\\') ||
    !str_starts_with(basename($temporary), 'voncms-credential-qa-')
  ) {
    throw new RuntimeException('Refusing unexpected fixture cleanup path.');
  }
  credentialRemoveFixture($temporary);
}
