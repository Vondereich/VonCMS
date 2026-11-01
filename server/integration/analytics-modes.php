<?php
/** Disposable analytics service/storage checks. Never reads an installed CMS configuration. */
declare(strict_types=1);
ob_start();
$mysql = in_array('--mysql', $argv, true);
if (!extension_loaded($mysql ? 'pdo_mysql' : 'pdo_sqlite')) {
  ob_end_clean();
  fwrite(STDERR, 'NOT_RUN Analytics modes: required PDO driver is unavailable.' . PHP_EOL);
  exit(2);
}
require_once __DIR__ . '/../../public/api/analytics_consent_helper.php';
require_once __DIR__ . '/../../public/api/schema_repair_helper.php';
require_once __DIR__ . '/sqlite-compat.php';
define('VONCMS_CORE_LOADED', true);
require_once __DIR__ . '/../../public/core/RateLimiter.php';
// Exercise the real proxy helpers without bootstrapping an installed session/configuration.
$securitySource = file_get_contents(__DIR__ . '/../../public/security.php');
$proxyStart = strpos($securitySource, "if (!function_exists('voncms_ip_matches_proxy_rule'))");
$proxyEnd = strpos($securitySource, "if (!isset(\$GLOBALS['VON_CANONICAL_CHECKED']))");
if ($proxyStart === false || $proxyEnd === false || $proxyEnd <= $proxyStart) {
  throw new RuntimeException('Proxy helper boundary missing.');
}
eval(substr($securitySource, $proxyStart, $proxyEnd - $proxyStart));
$fixtureStorage = sys_get_temp_dir() . '/voncms-analytics-' . bin2hex(random_bytes(8));
mkdir($fixtureStorage, 0700);
define('VONCMS_ANALYTICS_TEST_KEY_FILE', $fixtureStorage . '/analytics_signing.key');
$rateStorage = new ReflectionProperty(RateLimiter::class, 'storageDir');
$rateStorage->setValue(null, $fixtureStorage . '/rates/');

trait AnalyticsFixtureDialect
{
  public function prepare(string $query, array $options = []): PDOStatement|false
  {
    if ($this->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
      $query = str_replace(' FOR UPDATE', '', $query);
      $query = str_replace(
        'DATE_SUB(NOW(), INTERVAL 30 MINUTE)',
        "datetime(NOW(), '-30 minutes')",
        $query,
      );
      $query = str_replace(
        'ON DUPLICATE KEY UPDATE visitor_hash=visitor_hash',
        'ON CONFLICT(visitor_hash) DO NOTHING',
        $query,
      );
    }
    return parent::prepare($query, $options);
  }
}

final class AnalyticsFixturePDO extends PDO
{
  use AnalyticsFixtureDialect;
}

final class AnalyticsFixtureSqlitePDO extends VonCmsFixtureSqlitePDO
{
  use AnalyticsFixtureDialect;
}

$schema = 'voncms_analytics_qa_' . bin2hex(random_bytes(6));
$admin = null;
$checks = 0;
$originalTimezone = date_default_timezone_get();
$originalProxyRules = getenv('VONCMS_TRUSTED_PROXIES');
$originalClientHeader = getenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
putenv('VONCMS_TRUSTED_PROXIES');
putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
date_default_timezone_set('UTC');
$testClock = time();
$dbOffset = 8 * 3600;
function check(bool $condition, string $message): void
{
  global $checks;
  if (!$condition) {
    throw new RuntimeException($message);
  }
  $checks++;
}

try {
  if ($mysql) {
    $dsn = getenv('VONCMS_TEST_MYSQL_DSN') ?: 'mysql:host=127.0.0.1;port=3306;charset=utf8mb4';
    if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/D', $dsn)) {
      throw new RuntimeException('Only the loopback disposable MySQL fixture is allowed.');
    }
    $admin = new PDO(
      $dsn,
      getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
      getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
    $admin->exec('CREATE DATABASE ' . $schema . ' CHARACTER SET utf8mb4');
    $pdo = new AnalyticsFixturePDO(
      $dsn . ';dbname=' . $schema,
      getenv('VONCMS_TEST_MYSQL_USER') ?: 'root',
      getenv('VONCMS_TEST_MYSQL_PASSWORD') ?: '',
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
    $tables = voncms_schema_runtime_table_sql();
    $pdo->exec($tables['analytics']);
    $pdo->exec($tables['analytics_sessions']);
    check(voncms_schema_has_capability($pdo, 'analytics_measurement'), 'MySQL mode capability');
    check(
      voncms_schema_has_capability($pdo, 'analytics_sessions'),
      'MySQL session capability/indexes',
    );
  } else {
    $pdo = new AnalyticsFixtureSqlitePDO('sqlite::memory:', null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec(
      'CREATE TABLE analytics (id INTEGER PRIMARY KEY,page_url TEXT,referrer TEXT,user_agent TEXT,ip_hash TEXT,measurement_mode TEXT NOT NULL DEFAULT "strict",visit_date TEXT,visit_time TEXT,created_at TEXT)',
    );
    $pdo->exec(
      'CREATE TABLE analytics_sessions (visitor_hash TEXT PRIMARY KEY,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL)',
    );
  }
  if ($pdo instanceof AnalyticsFixtureSqlitePDO) {
    $pdo->createFunction('NOW', function () use (&$testClock, &$dbOffset): string {
      return gmdate('Y-m-d H:i:s', $testClock + $dbOffset);
    });
    $pdo->createFunction('CURDATE', function () use (&$testClock, &$dbOffset): string {
      return gmdate('Y-m-d', $testClock + $dbOffset);
    });
    $pdo->createFunction('CURTIME', function () use (&$testClock, &$dbOffset): string {
      return gmdate('H:i:s', $testClock + $dbOffset);
    });
  }
  $setDbOffset = function (int $offset) use ($mysql, $pdo, &$dbOffset): void {
    $dbOffset = $offset * 3600;
    if ($mysql) {
      $pdo->exec("SET time_zone='" . sprintf('%+03d:00', $offset) . "'");
    }
  };
  $setDbOffset(8);
  $pdo->exec(
    'CREATE TABLE settings (setting_group VARCHAR(50),setting_key VARCHAR(100),setting_value TEXT)',
  );
  $setting = function (string $group, string $key, mixed $value) use ($pdo): void {
    $pdo
      ->prepare('DELETE FROM settings WHERE setting_group=? AND setting_key=?')
      ->execute([$group, $key]);
    $pdo
      ->prepare('INSERT INTO settings VALUES (?,?,?)')
      ->execute([$group, $key, json_encode($value, JSON_THROW_ON_ERROR)]);
  };
  $setting('plugins', 'active_plugins', ['vp_analytics']);
  $setting('plugins', 'plugin_config', new stdClass());
  $setting('analytics', 'config', new stdClass());
  $mode = null;
  check(
    voncms_native_analytics_allowed($pdo, [], $mode) && $mode === 'strict',
    'Missing mode defaults to Strict',
  );
  foreach ([null, [], 'other', 0] as $badMode) {
    $setting('analytics', 'config', ['measurementMode' => $badMode]);
    check(
      !voncms_native_analytics_allowed($pdo, [], $mode) && $mode === null,
      'Malformed mode cannot enable tracking',
    );
  }
  $setting('analytics', 'config', ['measurementMode' => 'balanced', 'cookieConsent' => true]);
  check(
    !voncms_native_analytics_allowed($pdo, [], $mode) && $mode === null,
    'Consent required before identification',
  );
  check(
    voncms_native_analytics_allowed($pdo, ['von_consent' => 'true'], $mode) && $mode === 'balanced',
    'Accepted consent selects Balanced',
  );
  $setting('plugins', 'active_plugins', []);
  check(
    !voncms_native_analytics_allowed($pdo, ['von_consent' => 'true'], $mode) && $mode === null,
    'Inactive plugin cannot track',
  );
  $setting('plugins', 'active_plugins', ['vp_analytics']);
  $setting('plugins', 'plugin_config', ['pluginStatus' => ['vp_analytics' => 'inactive']]);
  check(
    !voncms_native_analytics_allowed($pdo, ['von_consent' => 'true'], $mode),
    'Inactive status cannot track',
  );
  $setting('plugins', 'plugin_config', new stdClass());

  $_SERVER['SCRIPT_NAME'] = '/api/track_visit.php';
  $rootName = voncms_analytics_identity_name();
  $_SERVER['SCRIPT_NAME'] = '/zangetsu/api/track_visit.php';
  check(
    $rootName !== voncms_analytics_identity_name() &&
      voncms_analytics_cookie_path() === '/zangetsu/',
    'Installation-scoped name and path',
  );
  $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
  $_SERVER['HTTPS'] = 'on';
  $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'http';
  check(is_https(), 'Direct HTTPS remains authoritative over a spoofed forwarded transport');
  $_SERVER['HTTPS'] = 'off';
  $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
  check(!is_https(), 'Untrusted peer cannot forge HTTPS transport');
  $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
  check(is_https(), 'Existing loopback transport trust is preserved');
  $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
  $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.123';
  $_SERVER['HTTP_CF_CONNECTING_IP'] = '203.0.113.124';
  check(
    voncms_analytics_client_address() === '192.0.2.10',
    'Default direct address ignores spoofable headers',
  );
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=CF-Connecting-IP');
  check(
    voncms_analytics_client_address() === '192.0.2.10',
    'Selected header is ignored from an untrusted peer',
  );
  putenv('VONCMS_TRUSTED_PROXIES=10.42.0.0/16,2001:db8:ffff::/48');
  $_SERVER['REMOTE_ADDR'] = '10.42.3.7';
  check(is_https(), 'Configured proxy CIDR retains HTTPS transport behavior');
  check(
    voncms_analytics_client_address() === '203.0.113.124',
    'Opt-in CF address is used only behind a trusted peer',
  );
  foreach (
    ['', '203.0.113.1, 203.0.113.2', '203.0.113.1:80', "203.0.113.1\r\n", [], str_repeat('a', 2049)]
    as $badHeader
  ) {
    $_SERVER['HTTP_CF_CONNECTING_IP'] = $badHeader;
    check(
      voncms_analytics_client_address() === '10.42.3.7',
      'Invalid single-address header falls back to the peer',
    );
  }
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=X-Forwarded-For');
  foreach (
    [
      ['attacker-prefix, 198.51.100.20, 10.42.9.8', '198.51.100.20'],
      ['203.0.113.99, 198.51.100.20', '198.51.100.20'],
      ['198.51.100.20, malformed-rightmost', '10.42.3.7'],
      [str_repeat('198.51.100.20,', 32) . '10.42.9.8', '10.42.3.7'],
      ['2001:db8:abcd::7, 2001:db8:ffff::1', '2001:db8:abcd::7'],
      ['::ffff:198.51.100.20', '::ffff:198.51.100.20'],
    ]
    as [$forwarded, $expected]
  ) {
    $_SERVER['HTTP_X_FORWARDED_FOR'] = $forwarded;
    check(
      voncms_analytics_client_address() === $expected,
      'XFF peels trusted hops from the right without accepting a forged prefix',
    );
  }
  $_SERVER['REMOTE_ADDR'] = '::ffff:10.42.3.7';
  check(
    voncms_analytics_client_address() === '::ffff:10.42.3.7',
    'A mapped proxy is not trusted by an unrelated IPv4 rule',
  );
  putenv('VONCMS_TRUSTED_PROXIES=::ffff:10.42.0.0/112');
  $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.20';
  check(
    voncms_analytics_client_address() === '198.51.100.20',
    'Explicit mapped IPv6 proxy CIDR is supported',
  );
  putenv('VONCMS_TRUSTED_PROXIES=10.42.0.0/16');
  $_SERVER['REMOTE_ADDR'] = '10.42.3.7';
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=Forwarded');
  check(
    voncms_analytics_client_address() === '10.42.3.7',
    'Unknown configured header does not enable forwarding trust',
  );
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
  check(
    voncms_analytics_client_address() === '10.42.3.7',
    'Transport proxy trust alone cannot enable identity headers',
  );
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=CF-Connecting-IP');
  foreach (['198.51.100.41', '198.51.100.42'] as $visitor) {
    $_SERVER['HTTP_CF_CONNECTING_IP'] = $visitor;
    $admissions = 0;
    for ($i = 0; $i < 125; $i++) {
      $_SERVER['SCRIPT_NAME'] =
        '/zangetsu/api/' . ($i % 2 ? 'track_visit.php' : 'track_monolithic.php');
      $admissions += (int) voncms_analytics_request_allowed();
    }
    check(
      $admissions === 120,
      'Visitors behind one trusted proxy have independent budgets shared by both routes',
    );
  }
  check(
    $_SERVER['REMOTE_ADDR'] === '10.42.3.7',
    'Analytics resolver never overwrites the authentication peer address',
  );
  putenv('VONCMS_TRUSTED_PROXIES');
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
  unset($_SERVER['HTTP_CF_CONNECTING_IP'], $_SERVER['HTTP_X_FORWARDED_FOR']);
  unset($_SERVER['HTTPS'], $_SERVER['HTTP_X_FORWARDED_PROTO']);
  $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
  $now = time();
  $record = function (string $mode, array $cookies, int $time) use (
    $pdo,
    $mysql,
    &$testClock,
  ): array {
    $testClock = $time;
    if ($mysql) {
      $pdo->exec('SET timestamp=' . $time);
    }
    return voncms_record_native_visit(
      $pdo,
      $mode,
      $cookies,
      '/article',
      '',
      'Fixture browser',
      $time,
    );
  };
  foreach ([0, 8, -8] as $clockOffset) {
    $setDbOffset($clockOffset);
    $testClock = strtotime('2026-10-24 23:50:00 UTC');
    $legacyStart = $testClock;
    if ($mysql) {
      $pdo->exec('SET timestamp=' . $testClock);
    }
    $_SERVER['REMOTE_ADDR'] = '192.0.2.' . (60 + $clockOffset);
    $legacyHash = hash('sha256', $_SERVER['REMOTE_ADDR'] . date('Y-m', $testClock));
    $pdo
      ->prepare(
        'INSERT INTO analytics (page_url,referrer,user_agent,ip_hash,visit_date,visit_time,created_at,measurement_mode) VALUES (?,?,?,?,CURDATE(),CURTIME(),NOW(),?)',
      )
      ->execute(['/legacy', '', 'Fixture', $legacyHash, 'strict']);
    check(
      $record('strict', [], $legacyStart + 1200)['throttled'],
      'Legacy DB-clock row retains its Strict window at offset ' . $clockOffset,
    );
    check(
      $record('strict', [], $legacyStart + 1801)['visit'],
      'Legacy Strict window ends at 1801 seconds at offset ' . $clockOffset,
    );
    $storedIdentity = $pdo
      ->query('SELECT ip_hash FROM analytics ORDER BY id DESC LIMIT 1')
      ->fetchColumn();
    check(
      $storedIdentity !== $legacyHash &&
        $storedIdentity ===
          hash_hmac(
            'sha256',
            'strict:' . $_SERVER['REMOTE_ADDR'] . ':' . date('Y-m', $legacyStart + 1801),
            voncms_analytics_signing_key(),
          ),
      'New Strict rows use the private installation key, not an enumerable IP hash',
    );
    $storedClock = $pdo
      ->query(
        'SELECT visit_date=CURDATE() AS same_day,created_at=NOW() AS same_time FROM analytics ORDER BY id DESC LIMIT 1',
      )
      ->fetch(PDO::FETCH_ASSOC);
    check(
      (int) $storedClock['same_day'] === 1 && (int) $storedClock['same_time'] === 1,
      'Analytics storage and reporting share DB clock at offset ' . $clockOffset,
    );
  }
  $setDbOffset(8);
  $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
  check($record('strict', [], $now)['visit'], 'Strict initial visit');
  check($record('strict', [], $now + 1200)['throttled'], 'Strict groups browsers sharing one IP');
  check(
    $record('strict', [], $now + 1801)['visit'],
    'Strict window remains since recorded visit, not idle activity',
  );
  putenv('VONCMS_TRUSTED_PROXIES=10.42.0.0/16');
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER=CF-Connecting-IP');
  $_SERVER['REMOTE_ADDR'] = '10.42.3.7';
  foreach (['198.51.100.41', '198.51.100.42'] as $visitor) {
    $_SERVER['HTTP_CF_CONNECTING_IP'] = $visitor;
    check(
      $record('strict', [], $now)['visit'],
      'Opt-in Strict identity separates actual clients behind one proxy',
    );
    check(
      $record('strict', [], $now + 60)['throttled'],
      'Each resolved Strict client still has its own 30-minute window',
    );
  }
  putenv('VONCMS_TRUSTED_PROXIES');
  putenv('VONCMS_ANALYTICS_CLIENT_IP_HEADER');
  unset($_SERVER['HTTP_CF_CONNECTING_IP']);
  $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
  $before = (int) $pdo->query('SELECT COUNT(*) FROM analytics')->fetchColumn();
  foreach (
    [[], [voncms_analytics_identity_name() => 'bad'], [voncms_analytics_identity_name() => []]]
    as $cookies
  ) {
    check(
      $record('balanced', $cookies, $now)['retry'],
      'Cookie handshake or malformed identity requires bounded retry',
    );
  }
  check(
    (int) $pdo->query('SELECT COUNT(*) FROM analytics')->fetchColumn() === $before,
    'No cookie echo means no counted visitor',
  );
  check(
    (int) $pdo->query('SELECT COUNT(*) FROM analytics_sessions')->fetchColumn() === 0,
    'No cookie echo allocates no session row',
  );
  $ids = [];
  $signedIds = [];
  $signingKey = voncms_analytics_signing_key();
  for ($i = 0; $i < 10; $i++) {
    $raw = bin2hex(random_bytes(32));
    $ids[] = $raw;
    $signedIds[] = voncms_analytics_signed_identity($raw, $now + 30 * 86400, $signingKey);
    check(
      $record('balanced', [voncms_analytics_identity_name() => $signedIds[$i]], $now)['visit'],
      'Distinct browser behind shared IP: ' . $i,
    );
    check(
      $record('balanced', [voncms_analytics_identity_name() => $signedIds[$i]], $now + 1)[
        'throttled'
      ],
      'Same browser refresh: ' . $i,
    );
  }
  check(
    (int) $pdo
      ->query("SELECT COUNT(DISTINCT ip_hash) FROM analytics WHERE measurement_mode='balanced'")
      ->fetchColumn() === 10,
    'Ten browsers are ten browser identities',
  );
  $cookie = [voncms_analytics_identity_name() => $signedIds[0]];
  $_SERVER['REMOTE_ADDR'] = '198.51.100.8';
  check(
    $record('balanced', $cookie, $now + 1200)['throttled'],
    'Changing IP keeps browser identity',
  );
  check(
    $record('balanced', $cookie, $now + 2400)['throttled'],
    'Activity extends the same session',
  );
  check(
    $record('balanced', $cookie, $now + 4201)['visit'],
    'Thirty minutes idle starts a new visit',
  );
  check(
    (int) $pdo
      ->query("SELECT COUNT(DISTINCT ip_hash) FROM analytics WHERE measurement_mode='balanced'")
      ->fetchColumn() === 10,
    'New session is not a new unique browser',
  );
  $stored = $pdo->query('SELECT visitor_hash FROM analytics_sessions')->fetchAll(PDO::FETCH_COLUMN);
  check(
    !array_intersect($ids, $stored) && in_array(hash('sha256', $ids[0]), $stored, true),
    'Raw browser identities are never stored',
  );
  check(
    $record('balanced', $cookie, $now + 30 * 86400 + 1)['retry'],
    'Identity expires after thirty days without renewal',
  );
  check(
    $record('balanced', [$rootName => $signedIds[1]], $now)['retry'],
    'Root identifier is not accepted by a subfolder installation',
  );

  // A failed visit insert must also roll back its session activity marker.
  $rollbackIdentity = hash('sha256', $ids[1]);
  $readActivity = $pdo->prepare('SELECT last_seen FROM analytics_sessions WHERE visitor_hash=?');
  $readActivity->execute([$rollbackIdentity]);
  $activityBefore = (int) $readActivity->fetchColumn();
  $readActivity->closeCursor();
  $pdo->exec(
    $mysql
      ? "CREATE TRIGGER analytics_fixture_reject BEFORE INSERT ON analytics FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture rejection'"
      : "CREATE TRIGGER analytics_fixture_reject BEFORE INSERT ON analytics BEGIN SELECT RAISE(ABORT,'Fixture rejection'); END",
  );
  $rejected = false;
  try {
    $record('balanced', [voncms_analytics_identity_name() => $signedIds[1]], $now + 8000);
  } catch (Throwable $error) {
    $rejected = true;
  } finally {
    $pdo->exec('DROP TRIGGER analytics_fixture_reject');
  }
  $readActivity->execute([$rollbackIdentity]);
  check(
    $rejected && !$pdo->inTransaction() && (int) $readActivity->fetchColumn() === $activityBefore,
    'Insert failure rolls back activity and releases the transaction',
  );
  $readActivity->closeCursor();
  check(
    $record('balanced', [voncms_analytics_identity_name() => $signedIds[1]], $now + 8000)['visit'],
    'A failed insert does not consume the next legitimate session',
  );

  if ($mysql) {
    $raceRaw = bin2hex(random_bytes(32));
    $raceCookie = voncms_analytics_signed_identity($raceRaw, $now + 86400, $signingKey);
    $raceHash = hash('sha256', $raceRaw);
    $children = [];
    $pdo->beginTransaction();
    try {
      $pdo
        ->prepare('INSERT INTO analytics_sessions VALUES (?,0,?)')
        ->execute([$raceHash, $now + 86400]);
      $program =
        'define("VONCMS_CORE_LOADED",true);define("VONCMS_ANALYTICS_TEST_KEY_FILE",' .
        var_export(VONCMS_ANALYTICS_TEST_KEY_FILE, true) .
        ');require ' .
        var_export(__DIR__ . '/../../public/core/RateLimiter.php', true) .
        ';(new ReflectionProperty(RateLimiter::class,"storageDir"))->setValue(null,' .
        var_export($fixtureStorage . '/rates/', true) .
        ');' .
        'require ' .
        var_export(__DIR__ . '/../../public/api/analytics_consent_helper.php', true) .
        ';' .
        '$p=new PDO(' .
        var_export($dsn . ';dbname=' . $schema, true) .
        ',getenv("VONCMS_TEST_MYSQL_USER")?:"root",getenv("VONCMS_TEST_MYSQL_PASSWORD")?:"",[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);' .
        '$_SERVER["SCRIPT_NAME"]="/zangetsu/api/track_visit.php";echo "ready\\n";flush();' .
        'echo json_encode(voncms_record_native_visit($p,"balanced",[voncms_analytics_identity_name()=>' .
        var_export($raceCookie, true) .
        '],"/race","","Fixture",' .
        $now .
        '));';
      for ($i = 0; $i < 2; $i++) {
        $pipes = [];
        $process = proc_open(
          [PHP_BINARY, '-r', $program],
          [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
          $pipes,
        );
        if (!is_resource($process)) {
          throw new RuntimeException('Cannot start MySQL race worker.');
        }
        fclose($pipes[0]);
        $children[] = [$process, $pipes];
        stream_set_timeout($pipes[1], 10);
        check(fgets($pipes[1]) === "ready\n", 'Independent race worker connected');
      }
      $pdo->commit();
      $visits = 0;
      $throttled = 0;
      foreach ($children as [$process, $pipes]) {
        $result = json_decode(stream_get_contents($pipes[1]), true, 512, JSON_THROW_ON_ERROR);
        $visits += (int) $result['visit'];
        $throttled += (int) $result['throttled'];
        fclose($pipes[1]);
        $errors = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        check(
          proc_close($process) === 0 && $errors === '',
          'Race worker completes without runtime errors',
        );
      }
      $children = [];
      $raceCount = $pdo->prepare(
        'SELECT COUNT(*) FROM analytics WHERE ip_hash=? AND measurement_mode=?',
      );
      $raceCount->execute([$raceHash, 'balanced']);
      check(
        $visits === 1 && $throttled === 1 && (int) $raceCount->fetchColumn() === 1,
        'Concurrent requests for one browser commit exactly one visit',
      );
    } finally {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      foreach ($children as [$process, $pipes]) {
        if (is_resource($process)) {
          proc_terminate($process);
        }
        foreach ($pipes as $pipe) {
          if (is_resource($pipe)) {
            fclose($pipe);
          }
        }
        if (is_resource($process)) {
          proc_close($process);
        }
      }
    }
  }

  $countVisits = static fn(): int => (int) $pdo
    ->query('SELECT COUNT(*) FROM analytics')
    ->fetchColumn();
  $before = $countVisits();
  foreach (
    [
      str_repeat('a', 64),
      str_replace('v1.', 'v2.', $signedIds[1]),
      substr($signedIds[1], 0, -1) . (str_ends_with($signedIds[1], '0') ? '1' : '0'),
      voncms_analytics_signed_identity($ids[1], $now + 86400, str_repeat('b', 64)),
    ]
    as $forged
  ) {
    check(
      !$record('balanced', [voncms_analytics_identity_name() => $forged], $now)['visit'],
      'Unsigned, altered or foreign-key cookie cannot record a visit',
    );
  }
  check($countVisits() === $before, 'Rejected signatures do not write analytics');
  $pdo
    ->prepare('DELETE FROM analytics_sessions WHERE visitor_hash=?')
    ->execute([hash('sha256', $ids[0])]);
  check(
    !$record('balanced', $cookie, $now + 30 * 86400 + 1)['visit'],
    'Expired signed identity cannot resurrect after its DB row is removed',
  );
  $_SERVER['REMOTE_ADDR'] = '203.0.113.81';
  $retries = 0;
  for ($i = 0; $i < 500; $i++) {
    $attempt = $record(
      'balanced',
      [voncms_analytics_identity_name() => bin2hex(random_bytes(32))],
      $now,
    );
    check(!$attempt['visit'], 'Client-chosen identifier is never an admitted visitor');
    $retries += (int) $attempt['retry'];
  }
  check(
    $retries === 120 && $countVisits() === $before,
    '500 forged IDs create zero visits and at most 120 issued replacements',
  );
  $_SERVER['REMOTE_ADDR'] = '203.0.113.82';
  $admitted = 0;
  for ($i = 0; $i < 500; $i++) {
    $value = voncms_analytics_signed_identity(bin2hex(random_bytes(32)), $now + 86400, $signingKey);
    $admitted += (int) $record('balanced', [voncms_analytics_identity_name() => $value], $now)[
      'visit'
    ];
  }
  check(
    $admitted === 120 && $countVisits() === $before + 120,
    'Accumulated valid cookies cannot exceed 120 new rows/hour/IP',
  );
  check(
    $record('balanced', [voncms_analytics_identity_name() => $signedIds[1]], $now + 10000)['visit'],
    'Exhausted new-row budget does not reject an existing browser session',
  );
  RateLimiter::consumeFixedWindow('qa-recovery', 5, 900);
  $recoveryFile = $fixtureStorage . '/rates/' . md5('fixed-window-ledger:v1') . '.json';
  $recoveryBefore = file_get_contents($recoveryFile);
  $_SERVER['REMOTE_ADDR'] = '2001:db8:abcd:1::10';
  $accepted = 0;
  for ($i = 0; $i < 500; $i++) {
    $_SERVER['SCRIPT_NAME'] =
      '/zangetsu/api/' . ($i % 2 ? 'track_visit.php' : 'track_monolithic.php');
    $_SERVER['REMOTE_ADDR'] = '2001:db8:abcd:1::' . dechex($i + 1);
    $accepted += (int) voncms_analytics_request_allowed();
  }
  check($accepted === 120, 'Mixed tracking routes share one IPv6 /64 request budget');
  check(
    file_get_contents($recoveryFile) === $recoveryBefore,
    'Tracking never changes the recovery ledger',
  );
  $requestIdentifier =
    'tracking:request:' . RateLimiter::normalizeLoginAddress($_SERVER['REMOTE_ADDR']);
  $requestShard = hash('sha256', $requestIdentifier)[0];
  $ledgerFile =
    $fixtureStorage . '/rates/' . md5('analytics-request-ledger:v2:' . $requestShard) . '.json';
  $ledger = file_get_contents($ledgerFile);
  file_put_contents($ledgerFile, 'invalid');
  check(!voncms_analytics_request_allowed(), 'Corrupt tracking ledger fails closed');
  file_put_contents($ledgerFile, $ledger);
  $issueShard = hash(
    'sha256',
    'tracking:issue:' . RateLimiter::normalizeLoginAddress($_SERVER['REMOTE_ADDR']),
  )[0];
  $issueFile =
    $fixtureStorage . '/rates/' . md5('analytics-issue-ledger:v2:' . $issueShard) . '.json';
  voncms_analytics_identity_budget('issue');
  $issueLedger = file_get_contents($issueFile);
  file_put_contents($issueFile, 'invalid');
  check(
    !voncms_analytics_issue_identity($now, $signingKey),
    'Unavailable quota storage cannot mint cookies',
  );
  file_put_contents($issueFile, $issueLedger);

  $manyAccepted = 0;
  for ($i = 0; $i < 5000; $i++) {
    $_SERVER['REMOTE_ADDR'] = '198.18.' . intdiv($i, 256) . '.' . $i % 256;
    $manyAccepted += (int) voncms_analytics_request_allowed();
  }
  check(
    $manyAccepted === 5000,
    'More than 4096 fresh visitor addresses do not fill one site-wide ledger',
  );
  check(
    count(glob($fixtureStorage . '/rates/*.json')) <= 49,
    'Three purposes have at most 48 fixed shard files plus the separate recovery ledger',
  );
  check(
    !RateLimiter::consumeFixedWindows(['a' => [1, 60], 'b' => [1, 60]], 'analytics-request'),
    'Partitioned namespaces reject multi-key reservations rather than weakening atomicity',
  );
  check(
    !voncms_analytics_identity_budget('unknown'),
    'Unknown analytics purpose cannot allocate a ledger',
  );
  $fullId = 'tracking:request:capacity-new';
  $fullShard = hash('sha256', $fullId)[0];
  $fullFile =
    $fixtureStorage . '/rates/' . md5('analytics-request-ledger:v2:' . $fullShard) . '.json';
  $fullBefore = file_get_contents($fullFile);
  $full = [];
  for ($i = 0; $i < 4096; $i++) {
    $full[$fullShard . substr(hash('sha256', 'capacity-' . $i), 1)] = [
      'attempts' => 0,
      'window_started_at' => time(),
      'window_seconds' => 60,
    ];
  }
  $knownKey = array_key_first($full);
  file_put_contents($fullFile, json_encode($full));
  check(
    !RateLimiter::consumeFixedWindow($fullId, 120, 60, 'analytics-request'),
    'A full shard refuses new buckets without evicting live quotas',
  );
  $otherId = 'tracking:request:other-shard';
  while (hash('sha256', $otherId)[0] === $fullShard) {
    $otherId .= 'x';
  }
  check(
    RateLimiter::consumeFixedWindow($otherId, 120, 60, 'analytics-request'),
    'A full shard does not block another request shard',
  );
  check(
    RateLimiter::consumeFixedWindow($fullId, 120, 60, 'analytics-issue') &&
      RateLimiter::consumeFixedWindow($fullId, 120, 60, 'analytics-session'),
    'A full request shard cannot exhaust another purpose',
  );
  $knownId = 'tracking:request:capacity-known';
  while (hash('sha256', $knownId)[0] !== $fullShard) {
    $knownId .= 'x';
  }
  unset($full[$knownKey]);
  $full[hash('sha256', $knownId)] = [
    'attempts' => 1,
    'window_started_at' => time(),
    'window_seconds' => 60,
  ];
  file_put_contents($fullFile, json_encode($full));
  check(
    RateLimiter::consumeFixedWindow($knownId, 2, 60, 'analytics-request') &&
      !RateLimiter::consumeFixedWindow($knownId, 2, 60, 'analytics-request'),
    'Known quota remains usable and bounded while its shard is full',
  );
  file_put_contents($fullFile, str_repeat('x', 1048577));
  check(
    !RateLimiter::consumeFixedWindow($knownId, 2, 60, 'analytics-request'),
    'Oversized shard fails closed at the byte bound',
  );
  file_put_contents($fullFile, $fullBefore);

  $migrationDirectory = $fixtureStorage . '/rates-migration/';
  mkdir($migrationDirectory, 0700);
  $rateStorage->setValue(null, $migrationDirectory);
  $legacyId = 'tracking:request:192.0.2.223';
  $legacyKey = hash('sha256', $legacyId);
  $legacyStarted = time() - 10;
  $legacyData = [
    $legacyKey => [
      'attempts' => 120,
      'window_started_at' => $legacyStarted,
      'window_seconds' => 60,
    ],
  ];
  $expiredKey = $legacyKey[0] . substr(hash('sha256', 'expired'), 1);
  $legacyData[$expiredKey] = [
    'attempts' => 120,
    'window_started_at' => time() - 120,
    'window_seconds' => 60,
  ];
  $legacyFile = $migrationDirectory . md5('analytics-admission-ledger:v1') . '.json';
  $legacyRaw = json_encode($legacyData);
  file_put_contents($legacyFile, $legacyRaw);
  check(
    !RateLimiter::consumeFixedWindow($legacyId, 120, 60, 'analytics-request'),
    'Active v1 exhaustion survives first-touch shard migration',
  );
  $migratedFile =
    $migrationDirectory . md5('analytics-request-ledger:v2:' . $legacyKey[0]) . '.json';
  $migratedRaw = file_get_contents($migratedFile);
  $migrated = json_decode($migratedRaw, true);
  check(
    ($migrated[$legacyKey] ?? null) === $legacyData[$legacyKey] && !isset($migrated[$expiredKey]),
    'Denied first touch still persists initialization and preserves the original counter/window while pruning expiry',
  );
  check(
    file_get_contents($legacyFile) === $legacyRaw,
    'Migration never deletes or rewrites the v1 rollback ledger',
  );
  file_put_contents($legacyFile, 'invalid');
  check(
    !RateLimiter::consumeFixedWindow($legacyId, 120, 60, 'analytics-request') &&
      file_get_contents($migratedFile) === $migratedRaw,
    'Initialized shards do not reread/import the legacy ledger on denial',
  );
  $sameShardId = 'tracking:request:192.0.2.224';
  while (hash('sha256', $sameShardId)[0] !== $legacyKey[0]) {
    $sameShardId .= 'x';
  }
  check(
    RateLimiter::consumeFixedWindow($sameShardId, 120, 60, 'analytics-request'),
    'Initialized shards remain usable without the old global lock or valid old ledger',
  );
  check(
    !RateLimiter::consumeFixedWindow($legacyId, 120, 60, 'analytics-session'),
    'Uninitialized shards fail closed if legacy counters cannot be read',
  );
  file_put_contents($legacyFile, '{}');
  check(
    RateLimiter::consumeFixedWindow($legacyId, 120, 60, 'analytics-session'),
    'Empty legacy ledger initializes a working independent shard',
  );
  $legacyCapacity = [];
  for ($i = 0; $i < 4096; $i++) {
    $legacyCapacity[hash('sha256', 'full-legacy-' . $i)] = [
      'attempts' => 1,
      'window_started_at' => time(),
      'window_seconds' => 3600,
    ];
  }
  file_put_contents($legacyFile, json_encode($legacyCapacity));
  $newVisitor = 'tracking:request:new-after-full-legacy';
  while (hash('sha256', $newVisitor)[0] === $legacyKey[0]) {
    $newVisitor .= 'x';
  }
  check(
    !RateLimiter::consumeFixedWindow($newVisitor, 120, 60, 'analytics'),
    'Counterexample: the old full global ledger rejects a fresh visitor',
  );
  check(
    RateLimiter::consumeFixedWindow($newVisitor, 120, 60, 'analytics-request'),
    'The same fresh visitor is admitted after migration from a full v1 ledger',
  );
  $rateStorage->setValue(null, $fixtureStorage . '/rates/');

  $raceDirectory = $fixtureStorage . '/rates-race/';
  mkdir($raceDirectory, 0700);
  $workers = [];
  try {
    $program =
      'define("VONCMS_CORE_LOADED",true);require ' .
      var_export(__DIR__ . '/../../public/core/RateLimiter.php', true) .
      ';(new ReflectionProperty(RateLimiter::class,"storageDir"))->setValue(null,' .
      var_export($raceDirectory, true) .
      ');$n=0;for($i=0;$i<80;$i++){$n+=(int)RateLimiter::consumeFixedWindow("tracking:request:race",120,60,"analytics-request");}echo $n;';
    for ($i = 0; $i < 4; $i++) {
      $process = proc_open(
        [PHP_BINARY, '-r', $program],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
      );
      if (!is_resource($process)) {
        throw new RuntimeException('Cannot start limiter race worker.');
      }
      fclose($pipes[0]);
      $workers[] = [$process, $pipes[1], $pipes[2]];
    }
    $raceAccepted = 0;
    foreach ($workers as [$process, $output, $errors]) {
      $raw = stream_get_contents($output);
      $stderr = stream_get_contents($errors);
      fclose($output);
      fclose($errors);
      check(
        proc_close($process) === 0 && ctype_digit($raw) && $stderr === '',
        'Concurrent limiter worker finishes without an error',
      );
      $raceAccepted += (int) $raw;
    }
    check(
      $raceAccepted === 120,
      'Concurrent processes reserve exactly 120 attempts without lost updates',
    );
  } finally {
    foreach ($workers as [$process, $output, $errors]) {
      if (is_resource($process)) {
        proc_terminate($process);
        proc_close($process);
      }
      if (is_resource($output)) {
        fclose($output);
      }
      if (is_resource($errors)) {
        fclose($errors);
      }
    }
  }
  file_put_contents(VONCMS_ANALYTICS_TEST_KEY_FILE, 'invalid');
  $failedKey = false;
  try {
    $record('balanced', $cookie, $now);
  } catch (RuntimeException $error) {
    $failedKey = true;
  }
  check($failedKey, 'Corrupt signing key refuses Balanced tracking');
  file_put_contents(VONCMS_ANALYTICS_TEST_KEY_FILE, $signingKey);

  $pdo->exec('DROP TABLE analytics_sessions');
  $failed = false;
  try {
    $record('balanced', $cookie, $now);
  } catch (Throwable $error) {
    $failed = true;
  }
  check($failed, 'Missing Balanced storage does not silently switch to Strict');
  $pdo->exec('ALTER TABLE analytics DROP COLUMN measurement_mode');
  check(
    $record('balanced', $cookie, $now)['needsRepair'] ?? false,
    'Unrepaired mode storage is explicit',
  );
  $_SERVER['REMOTE_ADDR'] = '203.0.113.9';
  check($record('strict', [], $now)['visit'], 'Legacy Strict storage still records before repair');
  ob_end_clean();
  echo 'PASS Analytics modes: ' .
    $checks .
    ' checks; ' .
    ($mysql
      ? 'real MySQL schema and service'
      : 'SQLite service with explicit SQL dialect adaptation') .
    '; no installed data touched.' .
    PHP_EOL;
} finally {
  date_default_timezone_set($originalTimezone);
  putenv(
    $originalProxyRules === false
      ? 'VONCMS_TRUSTED_PROXIES'
      : 'VONCMS_TRUSTED_PROXIES=' . $originalProxyRules,
  );
  putenv(
    $originalClientHeader === false
      ? 'VONCMS_ANALYTICS_CLIENT_IP_HEADER'
      : 'VONCMS_ANALYTICS_CLIENT_IP_HEADER=' . $originalClientHeader,
  );
  $pdo = null;
  if ($admin instanceof PDO && preg_match('/^voncms_analytics_qa_[a-f0-9]{12}$/D', $schema)) {
    $admin->exec('DROP DATABASE IF EXISTS ' . $schema);
  }
  if (
    dirname($fixtureStorage) === sys_get_temp_dir() &&
    preg_match('/^voncms-analytics-[a-f0-9]{16}$/D', basename($fixtureStorage))
  ) {
    foreach (['rates', 'rates-migration', 'rates-race'] as $directory) {
      foreach (glob($fixtureStorage . '/' . $directory . '/*') ?: [] as $file) {
        unlink($file);
      }
      if (is_dir($fixtureStorage . '/' . $directory)) {
        rmdir($fixtureStorage . '/' . $directory);
      }
    }
    if (is_file(VONCMS_ANALYTICS_TEST_KEY_FILE)) {
      unlink(VONCMS_ANALYTICS_TEST_KEY_FILE);
    }
    rmdir($fixtureStorage);
  }
}
