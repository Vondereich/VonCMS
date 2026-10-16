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
const modules = ['InstallBootstrap', 'ContentViewDeduplicator', 'RateLimiter', 'ResponseHelper'];
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
