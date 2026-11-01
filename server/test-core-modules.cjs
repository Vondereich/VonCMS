const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyPublicToDist } = require('./copy-public-to-dist.cjs');
const { isForbiddenReleasePath } = require('./release-path-policy.cjs');
const root = path.resolve(__dirname, '..');
const php = process.argv[2] || 'php';
const cgi =
  process.env.PHP_CGI_BIN ||
  path.join(path.dirname(php), process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi');
const modules = [
  'InstallBootstrap',
  'ContentViewDeduplicator',
  'RateLimiter',
  'ResponseHelper',
  'CredentialStore',
  'DataBoundary',
];
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-core-paths-'));
let assertions = 0;
const check = (condition) => {
  assert(condition);
  assertions++;
};
const phpCode = (source) => "base64_decode('" + Buffer.from(source).toString('base64') + "')";
function run(code, cwd = fixture) {
  const result = spawnSync(php, ['-r', code], { encoding: 'utf8', cwd });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
try {
  const publicFixture = path.join(fixture, 'Source', 'public');
  fs.mkdirSync(path.join(publicFixture, 'core'), { recursive: true });
  for (const name of [
    'security.php',
    '.htaccess',
    ...modules.map((name) => 'core/' + name + '.php'),
    'core/.htaccess',
  ]) {
    const destination = path.join(publicFixture, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, 'public', name), destination);
    check(!isForbiddenReleasePath('public/' + name));
  }
  const deployFixture = path.join(fixture, 'Deploy Root');
  copyPublicToDist(publicFixture, deployFixture);
  const subfolderFixture = path.join(fixture, 'Subfolder', 'newsroom');
  copyPublicToDist(publicFixture, subfolderFixture);
  const subdomainFixture = path.join(fixture, 'Subdomain');
  copyPublicToDist(publicFixture, subdomainFixture);
  const contexts = [
    [publicFixture, '/api/qa.php', 'localhost'],
    [deployFixture, '/api/qa.php', 'localhost'],
    [subfolderFixture, '/newsroom/api/qa.php', 'localhost'],
    [subdomainFixture, '/api/qa.php', 'news.example.test'],
  ];
  const repairSource = fs.readFileSync(
    path.join(root, 'public/api/system/repair_htaccess.php'),
    'utf8'
  );
  const repairFunctions = ['writeHtaccessAtomically', 'repairDataShield']
    .map((name) => {
      const source = repairSource.match(
        new RegExp('^function ' + name + '[\\s\\S]*?^\\}', 'm')
      )?.[0];
      assert(source);
      return source;
    })
    .join('\n');
  for (const [app, script, host] of contexts) {
    fs.mkdirSync(path.join(app, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(app, 'data', 'rate_limits'), { recursive: true });
    const code = `
ini_set('session.save_path', ${phpCode(path.join(app, 'sessions'))});
$_SERVER['PHP_SELF'] = ${phpCode(script)};
$_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'];
$_SERVER['SCRIPT_FILENAME'] = ${phpCode(path.join(app, 'api/qa.php'))};
$_SERVER['HTTP_HOST'] = ${phpCode(host)};
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'core-path-regression';
require_once ${phpCode(path.join(app, 'security.php'))};
require_once ${phpCode(path.join(app, 'security.php'))};
eval(${phpCode(repairFunctions)});
if (SecurityHelper::isIntegrityCompromised()) exit(24);
unlink(${phpCode(path.join(app, 'core/.htaccess'))});
if (!SecurityHelper::isIntegrityCompromised()) exit(25);
$repair = repairDataShield(${phpCode(app)}, 'core');
if ($repair['status'] !== 'written' || SecurityHelper::isIntegrityCompromised()) exit(26);
if (repairDataShield(${phpCode(app)}, 'core')['status'] !== 'unchanged') exit(27);
if (repairDataShield(${phpCode(app)})['status'] !== 'written') exit(28);
try { repairDataShield(${phpCode(app)}, '../outside'); exit(29); } catch (InvalidArgumentException $expected) {}
foreach (['InstallBootstrap', 'ContentViewDeduplicator', 'RateLimiter', 'ResponseHelper', 'SessionManager', 'CSRFProtection', 'SecurityHelper'] as $class) if (!class_exists($class)) exit(11);
$expectedRoot = ${phpCode(app)};
require_once $expectedRoot . '/core/CredentialStore.php';
$encrypted = VonCmsCredentialStore::encrypt('qa-core-credential', 'qa:paths', true);
if (VonCmsCredentialStore::decrypt($encrypted, 'qa:paths') !== 'qa-core-credential') exit(30);
if (!is_file($expectedRoot . '/data/credential_master.key.php')) exit(31);
$rate = (new ReflectionClass(RateLimiter::class))->getStaticProperties()['storageDir'];
if (realpath($rate) !== realpath($expectedRoot . '/data/rate_limits')) exit(12);
$key = (new ReflectionMethod(InstallBootstrap::class, 'keyPath'))->invoke(null);
if (realpath(dirname($key)) !== realpath($expectedRoot . '/data') || basename($key) !== 'install_setup.key') exit(13);
if (!RateLimiter::consumeAttempt('core-path-qa')) exit(14);
if (!is_file($expectedRoot . '/data/rate_limits/' . md5('core-path-qa') . '.json')) exit(15);
if (is_dir($expectedRoot . '/core/data')) exit(16);
if (!InstallBootstrap::ensureKey() || !is_file($expectedRoot . '/data/install_setup.key')) exit(17);
$candidate = trim(file_get_contents($key));
if (!InstallBootstrap::validate($candidate) || !InstallBootstrap::claim($candidate) || InstallBootstrap::claim($candidate)) exit(18);
InstallBootstrap::consume();
if (is_file($key)) exit(19);
if (!ContentViewDeduplicator::claim('post', 81, 1000) || ContentViewDeduplicator::claim('post', 81, 1001)) exit(20);
ContentViewDeduplicator::release('post', 81);
if (!ContentViewDeduplicator::claim('post', 81, 1002)) exit(21);
if (strlen(CSRFProtection::generateToken()) !== 64) exit(22);
if (ResponseHelper::shapeContentPayload(['id' => 1, 'author_id' => 7], false) !== ['id' => 1]) exit(23);
$_SERVER['HTTP_X_BOUNDARY_QA'] = ['not' => 'text'];
if (DataBoundary::serverString('HTTP_X_BOUNDARY_QA', 'fallback') !== 'fallback') exit(32);
$_SESSION['user'] = ['id' => 17, 'role' => 'Member', 'bio' => ['invalid']];
if (DataBoundary::userText('id') !== '17' || DataBoundary::userText('role') !== 'Member' || DataBoundary::userText('bio') !== '') exit(33);
if (DataBoundary::actor() !== ['id' => '17', 'username' => '', 'role' => 'Member']) exit(47);
unset($_SESSION['user']);
$boundaryDb = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$boundaryDb->exec('CREATE TABLE boundary_data (id INTEGER, name TEXT, missing TEXT)');
$boundaryDb->prepare('INSERT INTO boundary_data VALUES (?, ?, NULL)')->execute([17, "Nur’Aini & R&D"]);
$boundaryStatement = $boundaryDb->query('SELECT * FROM boundary_data');
if (DataBoundary::statement($boundaryStatement) !== $boundaryStatement) exit(48);
try { DataBoundary::statement(false); exit(49); } catch (UnexpectedValueException $expected) {}
$boundaryRow = DataBoundary::row($boundaryStatement->fetch(PDO::FETCH_ASSOC));
if ($boundaryRow !== ['id' => 17, 'name' => "Nur’Aini & R&D", 'missing' => null]) exit(34);
if (DataBoundary::rows([$boundaryRow]) !== [$boundaryRow] || DataBoundary::column([17, '17', false, null]) !== [17, '17', false, null]) exit(35);
if (DataBoundary::row(false) !== false || DataBoundary::optionalDatabase(null) !== null || DataBoundary::optionalDatabase($boundaryDb) !== $boundaryDb) exit(36);
foreach ([['id' => []], ['id' => new stdClass()]] as $invalidRow) {
  try { DataBoundary::row($invalidRow); exit(37); } catch (UnexpectedValueException $expected) {}
}
foreach ([false, [false], [['id' => []]]] as $invalidRows) {
  try { DataBoundary::rows($invalidRows); exit(38); } catch (UnexpectedValueException $expected) {}
}
$pdo = $boundaryDb;
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT NOT NULL, password TEXT NOT NULL)');
$pdo->exec("INSERT INTO users VALUES (17, 'member', 'fixture-password-A')");
$authorization = new ReflectionProperty(SessionManager::class, 'authorizationState');
foreach (['root' => [true, true, true], 'admin' => [true, false, true], 'moderator' => [false, false, true], 'writer' => [false, false, true], 'member' => [false, false, false]] as $role => [$admin, $owner, $staff]) {
  $pdo->prepare('UPDATE users SET role=?, password=? WHERE id=17')->execute([$role, 'fixture-password-A']);
  SessionManager::establishAuthenticatedSession(['id' => 17, 'role' => $role], 'fixture-password-A');
  $authorization->setValue(null, 'unchecked');
  if (!SessionManager::isValid() || SessionManager::isAdmin() !== $admin || SessionManager::isPrimaryAdmin() !== $owner || SessionManager::isStaff() !== $staff || SessionManager::canAccessMedia() !== $staff) exit(39);
}
$pdo->exec("UPDATE users SET role='root' WHERE id=17");
SessionManager::establishAuthenticatedSession(['id' => 17, 'role' => 'root'], 'fixture-password-A');
$pdo->exec("UPDATE users SET role='member' WHERE id=17");
$authorization->setValue(null, 'unchecked');
if (SessionManager::isValid() || isset($_SESSION['user'])) exit(40);
SessionManager::establishAuthenticatedSession(['id' => 17, 'role' => 'member'], 'fixture-password-A');
$pdo->exec("UPDATE users SET password='fixture-password-B' WHERE id=17");
$authorization->setValue(null, 'unchecked');
if (SessionManager::isValid() || isset($_SESSION['user'])) exit(41);
SessionManager::establishAuthenticatedSession(['id' => 17, 'role' => 'member'], 'fixture-password-B');
$_SESSION['auth_started_at'] = [];
if (!SessionManager::isExpired()) exit(42);
$_SESSION['auth_started_at'] = time();
$_SESSION['last_activity'] = [];
if (!SessionManager::isExpired()) exit(43);
$_SESSION['last_activity'] = (string) time();
if (SessionManager::isExpired()) exit(44);
$_SESSION['auth_fingerprint'] = [];
$authorization->setValue(null, 'unchecked');
if (SessionManager::isValid() || isset($_SESSION['user'])) exit(45);
$guestToken = CSRFProtection::generateToken();
$authorization->setValue(null, 'unchecked');
if (SessionManager::isValid() || CSRFProtection::getToken() !== $guestToken) exit(46);
echo 'ok';`;
    check(run(code) === 'ok');
  }
  check(
    fs
      .readFileSync(path.join(deployFixture, 'core/.htaccess'), 'utf8')
      .includes('Require all denied')
  );
  check(
    fs.readFileSync(path.join(root, 'docs/VPS.md'), 'utf8').includes('^/(?:public/)?core(?:/|$)')
  );
  const rule = 'RewriteRule ^(?:public/)?core(/.*)?$ - [F,L,NC]';
  for (const file of [
    '.htaccess',
    'public/.htaccess',
    'public/api/install.php',
    'public/api/system/repair_htaccess.php',
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    check(source.includes(rule));
    check(source.indexOf(rule) < source.indexOf('PRIORITY 1 - VVIP'));
  }
  const repairFunction = repairSource.match(/^function getHtaccessContent[\s\S]*?^\}/m)?.[0];
  assert(repairFunction);
  for (const prefix of ['', 'public/']) {
    const output = run(
      'eval(' + phpCode(repairFunction) + '); echo getHtaccessContent(' + phpCode(prefix) + ');'
    );
    check(output.includes(rule));
    check(output.indexOf(rule) < output.indexOf('PRIORITY 1 - VVIP'));
  }
  const preload = path.join(fixture, 'preload.php');
  const protectedClone = path.join(fixture, 'After encryption');
  copyPublicToDist(publicFixture, protectedClone);
  check(!fs.existsSync(path.join(protectedClone, 'data', 'credential_master.key.php')));
  for (const privatePath of [
    'data/credential_master.key.php',
    'public/data/credential_master.key.php',
    'custom/credential_master.key.php.backup',
  ])
    check(isForbiddenReleasePath(privatePath));
  fs.writeFileSync(preload, "<?php define('VONCMS_CORE_LOADED', true);");
  for (const name of modules) {
    const file = path.join(deployFixture, 'core', name + '.php');
    for (const preloaded of [false, true]) {
      if (!fs.existsSync(cgi)) {
        const direct = run(
          "register_shutdown_function(static function () { echo '|' . http_response_code(); }); $_SERVER['SCRIPT_FILENAME'] = " +
            phpCode(file) +
            '; ' +
            (preloaded ? "define('VONCMS_CORE_LOADED', true); " : '') +
            'require ' +
            phpCode(file) +
            ';'
        );
        check(direct === 'Forbidden|403');
        check(!direct.includes('class '));
        continue;
      }
      const result = spawnSync(cgi, preloaded ? ['-d', 'auto_prepend_file=' + preload] : [], {
        encoding: 'utf8',
        env: {
          ...process.env,
          REDIRECT_STATUS: '200',
          REQUEST_METHOD: 'GET',
          SCRIPT_FILENAME: file,
          SCRIPT_NAME: '/core/' + name + '.php',
          SERVER_PROTOCOL: 'HTTP/1.1',
          HTTP_HOST: 'localhost',
          QUERY_STRING: 'VONCMS_CORE_LOADED=1',
        },
      });
      assert.equal(result.status, 0, result.stderr);
      check(/^Status: 403 Forbidden/m.test(result.stdout) && result.stdout.endsWith('Forbidden'));
      check(!result.stdout.includes('Fatal error') && !result.stdout.includes('class '));
    }
  }
  if (process.platform === 'win32') {
    for (const readOnly of [false, true]) {
      const windowsRoot = path.join(fixture, readOnly ? 'Windows directory R' : 'Windows normal');
      const rateDir = path.join(windowsRoot, 'rate');
      const cacheDir = path.join(windowsRoot, 'cache');
      for (const dir of [rateDir, cacheDir]) fs.mkdirSync(dir, { recursive: true });
      try {
        if (readOnly) {
          for (const dir of [rateDir, cacheDir])
            assert.equal(spawnSync('attrib.exe', ['+R', dir]).status, 0);
        }
        const result = JSON.parse(
          run(`
define('VONCMS_CORE_LOADED', true);
define('VONCMS_CREDENTIAL_KEY_FILE', ${phpCode(path.join(rateDir, 'credential_master.key.php'))});
require ${phpCode(path.join(root, 'public/core/RateLimiter.php'))};
require ${phpCode(path.join(root, 'public/core/CredentialStore.php'))};
function voncms_public_cache_directory(): string { return ${phpCode(cacheDir)}; }
require ${phpCode(path.join(root, 'public/api/public_cache_helper.php'))};
$rate = ${phpCode(rateDir + path.sep)};
(new ReflectionProperty(RateLimiter::class, 'storageDir'))->setValue(null, $rate);
$written = file_put_contents($rate . 'direct.txt', 'ok');
$accepted = []; for ($i=0;$i<6;$i++) $accepted[] = RateLimiter::consumeAttempt('windows-attribute');
$key = voncms_public_cache_key('windows-qa');
$gate = voncms_public_cache_acquire_gate();
voncms_public_cache_set($key, '{"ok":true}', $gate);
voncms_public_cache_release_gate($gate);
$cacheRoundTrip = voncms_public_cache_get($key, 60) === '{"ok":true}';
$cipher = VonCmsCredentialStore::encrypt('qa-windows-secret', 'qa:windows', true);
$canRotate = VonCmsCredentialStore::canRotate();
VonCmsCredentialStore::rotateSecret($cipher, 'qa:windows', function($next) use (&$cipher) { $cipher = $next; });
$rotationWorks = VonCmsCredentialStore::decrypt($cipher, 'qa:windows') === 'qa-windows-secret';
// Directory attributes are only hints; failed real opens must still follow their old contracts.
mkdir($rate . md5('actual-open-failure') . '.json');
$loginFailure = RateLimiter::consumeAttempt('actual-open-failure');
mkdir($rate . md5('registration-ledger:v1') . '.json');
$protectedFailure = !RateLimiter::consumeFixedWindow('qa-protected-open', 1, 60, 'registration');
unlink(voncms_public_cache_gate_path()); mkdir(voncms_public_cache_gate_path());
$gateFailure = voncms_public_cache_acquire_gate() === false;
echo json_encode(['written'=>$written, 'accepted'=>$accepted,
 'ledger'=>is_file($rate . md5('windows-attribute') . '.json'),
 'health'=>RateLimiter::getStorageHealth()['healthy'], 'cache'=>$cacheRoundTrip,
 'canRotate'=>$canRotate,'rotation'=>$rotationWorks,'loginFailureRetainsPolicy'=>$loginFailure,'protectedFailureRetainsPolicy'=>$protectedFailure,'gateFailure'=>$gateFailure]);
`)
        );
        check(result.written === 2);
        assert.deepEqual(result.accepted, [true, true, true, true, true, false]);
        assertions++;
        for (const name of [
          'ledger',
          'health',
          'cache',
          'canRotate',
          'rotation',
          'loginFailureRetainsPolicy',
          'protectedFailureRetainsPolicy',
          'gateFailure',
        ])
          check(result[name] === true);
      } finally {
        for (const dir of [rateDir, cacheDir]) spawnSync('attrib.exe', ['-R', dir]);
      }
    }
  }
  console.log(
    'PASS core modules: ' +
      assertions +
      ' path, bootstrap, copy, rewrite and direct-access assertions.'
  );
} finally {
  assert(
    path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep + 'voncms-core-paths-')
  );
  fs.rmSync(fixture, { recursive: true, force: true });
}
