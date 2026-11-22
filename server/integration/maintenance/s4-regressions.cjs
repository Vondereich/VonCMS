// Real PHP helpers/controllers in owned storage; auth/audit transport is stubbed only for media.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const php = process.env.PHP_BIN;
assert.ok(php, 'Set PHP_BIN to supported 64-bit PHP');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-s4-'));
let checks = 0;
function run(source, args = [], expectedHttpStatus = null) {
  const script = path.join(temp, 'worker.php');
  fs.writeFileSync(script, '<?php\n' + source);
  const binary =
    expectedHttpStatus === null
      ? php
      : path.join(path.dirname(php), process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi');
  const result = spawnSync(binary, [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REDIRECT_STATUS: '1',
      REQUEST_METHOD: 'GET',
      SCRIPT_FILENAME: script,
      SCRIPT_NAME: '/index.php',
      SERVER_PROTOCOL: 'HTTP/1.1',
      HTTP_HOST: 'qa.invalid',
    },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stderr, '', result.stderr);
  if (expectedHttpStatus !== null) {
    const split = result.stdout.search(/\r?\n\r?\n/);
    assert.ok(split >= 0, result.stdout);
    const headers = result.stdout.slice(0, split);
    assert.equal(Number(headers.match(/^Status: (\d+)/m)?.[1] || 200), expectedHttpStatus, headers);
    assert.ok(
      expectedHttpStatus === 401
        ? /Content-type: application\/json/i.test(headers)
        : /Content-type: text\/html/i.test(headers),
      headers
    );
    return result.stdout.slice(split).trim();
  }
  return result.stdout;
}
const quoted = (value) => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
try {
  // Native sessions + actual bootstrap: changed UA remains denied for API, HTML becomes Guest.
  fs.mkdirSync(path.join(temp, 'sessions'));
  for (const base of ['', '/zangetsu']) {
    for (const [script, accept, method, expected] of [
      ['/index.php', 'text/html', 'GET', 'guest'],
      ['/index.php', 'text/html', 'HEAD', 'guest'],
      ['/api/check_auth.php', 'text/html', 'GET', 'SESSION_HIJACK'],
      ['/API/check_auth.php', 'text/html', 'GET', 'SESSION_HIJACK'],
      ['/api.php', '*/*', 'POST', 'SESSION_HIJACK'],
    ]) {
      const output = run(
        `
session_save_path(${quoted(path.join(temp, 'sessions'))}); session_start();
$_SESSION=['user'=>['id'=>'1','role'=>'Root'], 'ua_bind'=>hash('sha256','Old UA')];
$_SERVER['HTTP_USER_AGENT']='New UA'; $_SERVER['SCRIPT_NAME']=${quoted(base + script)};
$_SERVER['REQUEST_METHOD']=${quoted(method)}; $_SERVER['HTTP_ACCEPT']=${quoted(accept)};
require ${quoted(path.join(root, 'public/security.php'))};
echo isset($_SESSION['user']) ? 'authenticated' : 'guest';
`,
        [],
        expected === 'guest' ? 200 : 401
      );
      assert.ok(output.includes(expected), output);
      checks++;
    }
  }
  // Actual public projection must preserve custom links, but not unpublished content labels.
  const navigationOutput = run(`
require ${quoted(path.join(root, 'public/public_render_helper.php'))};
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE TABLE posts(id INTEGER,slug TEXT,status TEXT,scheduled_at TEXT)");
$pdo->exec("CREATE TABLE pages(id INTEGER,slug TEXT,status TEXT)");
$pdo->exec("INSERT INTO posts VALUES(1,'public-post','published',NULL),(2,'draft-post','draft',NULL),(3,'future-post','scheduled','2999-01-01'),(4,'review-post','pending_review',NULL)");
$pdo->exec("INSERT INTO pages VALUES(1,'public-page','published'),(2,'secret-page','draft')");
$nav=[['label'=>'Home','url'=>'home'],['label'=>'Public','url'=>'post:1'],['label'=>'Draft','url'=>'post:2'],['label'=>'Future','url'=>'post:3'],['label'=>'Review','url'=>'post:4'],['label'=>'Page','url'=>'page:1'],['label'=>'Draft Page','url'=>'page:2'],['label'=>'Custom','url'=>'https://example.test']];
$aliases=[['label'=>'Slug Post','url'=>'post:public-post'],['label'=>'Slug Page','url'=>'page:public-page'],['label'=>'Draft Post','url'=>'post:draft-post'],['label'=>'Draft Page','url'=>'page:secret-page']];
$many=[];
for($i=10;$i<=210;$i++) {
  $pdo->prepare("INSERT INTO pages VALUES(?,?,'published')")->execute([$i,'many-'.$i]);
  $many[]=['label'=>'Page '.$i,'url'=>'page:'.$i];
}
echo json_encode(['public'=>voncms_project_public_navigation_hrefs($pdo,$nav),'admin'=>voncms_project_public_navigation_hrefs($pdo,$nav,false),'aliases'=>voncms_project_public_navigation_hrefs($pdo,$aliases),'many'=>voncms_project_public_navigation_hrefs($pdo,$many)]);
`);
  const navigation = JSON.parse(navigationOutput);
  assert.deepEqual(
    navigation.public.map((item) => item.label),
    ['Home', 'Public', 'Page', 'Custom']
  );
  assert.equal(
    navigation.admin.length,
    8,
    'Admin must retain invalid menu entries for explicit repair'
  );
  assert.deepEqual(
    navigation.aliases.map((item) => item.label),
    ['Slug Post', 'Slug Page']
  );
  assert.equal(navigation.many.length, 201, 'Published links beyond the first 100 must remain');
  checks += 4;
  // Actual media delete, not a reimplemented path predicate; never a real installation.
  const site = path.join(temp, 'site');
  for (const dir of ['api/activity', 'core', 'uploads/temp'])
    fs.mkdirSync(path.join(site, dir), { recursive: true });
  for (const file of [
    'api/delete_media.php',
    'api/media_library_filter_helper.php',
    'api/role_capability_helper.php',
    'media_variants.php',
    'core/DataBoundary.php',
    'core/ResponseHelper.php',
  ]) {
    fs.copyFileSync(path.join(root, 'public', file), path.join(site, file));
  }
  fs.writeFileSync(
    path.join(site, 'security.php'),
    `<?php
define('VONCMS_CORE_LOADED',true);
require_once __DIR__.'/core/DataBoundary.php'; require_once __DIR__.'/core/ResponseHelper.php';
$_SESSION=['user'=>['id'=>'1','username'=>'QA','role'=>'Root']];
function sendApiHeaders($methods='GET'){} function voncms_apply_site_timezone($pdo){} function is_https(){return false;}
class SessionManager { static function requirePrimaryAdmin(){} static function isAdmin(){return true;} }
class CSRFProtection { static function requireToken(){} static function getRequestBody(){return json_encode(['path'=>$GLOBALS['qa_path'],'confirmReferenced'=>$GLOBALS['qa_confirm']??false]);} }
`
  );
  fs.writeFileSync(
    path.join(site, 'api/activity/ActivityLog.php'),
    '<?php class VonCmsActivityLog { function __construct($db){} function recordMedia(...$args){} }'
  );
  fs.writeFileSync(
    path.join(site, 'von_config.php'),
    `<?php
class QaMediaStatement extends PDOStatement {
  public function rowCount():int { return str_contains($this->queryString,'sqlite_master') ? count($this->fetchAll()) : parent::rowCount(); }
}
class QaMediaPDO extends PDO {
  public function query(string $sql,?int $mode=null,mixed ...$args):PDOStatement|false {
    if($sql==="SHOW TABLES LIKE 'media'")$sql="SELECT name FROM sqlite_master WHERE type='table' AND name='media'";
    return parent::query($sql,$mode,...$args);
  }
}
$pdo=new QaMediaPDO('sqlite:' . __DIR__ . '/qa.sqlite',null,null,[PDO::ATTR_STATEMENT_CLASS=>[QaMediaStatement::class]]);
$pdo->exec('CREATE TABLE IF NOT EXISTS media(filepath TEXT)');
$pdo->exec('CREATE TABLE IF NOT EXISTS posts(image_url TEXT,content TEXT)');
$pdo->exec('CREATE TABLE IF NOT EXISTS pages(content TEXT)');
`
  );
  const remove = (mediaPath, confirmReferenced = false) => {
    const result = run(`
$_SERVER['REQUEST_METHOD']='POST'; $GLOBALS['qa_path']=${quoted(mediaPath)};
$GLOBALS['qa_confirm']=${confirmReferenced ? 'true' : 'false'};
register_shutdown_function(static function(){echo "\\nSTATUS=".(http_response_code()?:200);});
require ${quoted(path.join(site, 'api/delete_media.php'))};
`);
    const [body, status] = result.split('\nSTATUS=');
    return { body: JSON.parse(body), status: Number(status) };
  };
  for (const relative of ['.htaccess', 'temp/.htaccess', 'temp/.hidden/image.jpg']) {
    const shield = path.join(site, 'uploads', relative);
    fs.mkdirSync(path.dirname(shield), { recursive: true });
    fs.writeFileSync(shield, 'QA protection');
    assert.equal(remove(relative).status, 400, relative);
    assert.ok(fs.existsSync(shield));
    checks += 2;
  }
  fs.writeFileSync(path.join(site, 'uploads/ordinary.jpg'), 'QA image');
  const ordinaryDelete = remove('ordinary.jpg');
  assert.equal(ordinaryDelete.status, 200, JSON.stringify(ordinaryDelete));
  assert.equal(fs.existsSync(path.join(site, 'uploads/ordinary.jpg')), false);
  checks += 2;
  run(
    `$db=new PDO('sqlite:' . ${quoted(path.join(site, 'qa.sqlite'))});$db->prepare('INSERT INTO pages VALUES(?)')->execute(['<img src="uploads/in-use.jpg">']);`
  );
  fs.writeFileSync(path.join(site, 'uploads/in-use.jpg'), 'QA referenced image');
  const inUse = remove('in-use.jpg');
  assert.equal(inUse.status, 409, JSON.stringify(inUse));
  assert.equal(inUse.body.requiresConfirmation, true);
  assert.ok(fs.existsSync(path.join(site, 'uploads/in-use.jpg')));
  assert.equal(remove('in-use.jpg', true).status, 200);
  assert.equal(fs.existsSync(path.join(site, 'uploads/in-use.jpg')), false);
  checks += 5;
  const mediaHelper = path.join(site, 'api/media_library_filter_helper.php');
  const protectedSource = fs.readFileSync(mediaHelper, 'utf8');
  const oldSource = protectedSource.replace(
    "str_starts_with($segment, '.')",
    "$segment === '.' || $segment === '..'"
  );
  assert.notEqual(oldSource, protectedSource, 'Missing media mutation point');
  fs.writeFileSync(mediaHelper, oldSource);
  assert.equal(remove('.htaccess').status, 200, 'Counterexample did not exercise old delete');
  assert.equal(fs.existsSync(path.join(site, 'uploads/.htaccess')), false);
  checks += 2;
  // Headers produced by the real formatter, not a mail provider's injected defaults.
  // The active HTML shell, not lexical hash order, owns the entry bundle.
  const assets = path.join(temp, 'assets');
  fs.mkdirSync(assets);
  for (const name of ['index-A.js', 'index-Z.js', 'index-A.css', 'index-Z.css'])
    fs.writeFileSync(path.join(assets, name), 'QA');
  fs.writeFileSync(
    path.join(temp, 'index.html'),
    '<script type="module" src="/sub/assets/index-A.js"></script><link href="/sub/assets/index-A.css" rel="stylesheet">'
  );
  const resolveAssets = () =>
    JSON.parse(
      run(
        `require ${quoted(path.join(root, 'public/public_render_helper.php'))};echo json_encode(voncms_resolve_public_assets(${quoted(assets)},false));`
      )
    );
  assert.equal(resolveAssets().jsFile, 'index-A.js');
  assert.equal(resolveAssets().cssFile, 'index-A.css');
  fs.unlinkSync(path.join(temp, 'index.html'));
  assert.equal(resolveAssets().jsFile, 'index-Z.js', 'No-shell fallback changed');
  checks += 3;
  // Actual filesystem media fallback with an empty DB, including the overflowing input.
  fs.copyFileSync(
    path.join(root, 'public/api/list_media.php'),
    path.join(site, 'api/list_media.php')
  );
  fs.appendFileSync(path.join(site, 'security.php'), '\n');
  const securityFile = path.join(site, 'security.php');
  fs.writeFileSync(
    securityFile,
    fs
      .readFileSync(securityFile, 'utf8')
      .replace(
        'static function requirePrimaryAdmin(){}',
        'static function requirePrimaryAdmin(){} static function requireValidSession(){}'
      )
  );
  for (const base of ['', '/zangetsu']) {
    const result = JSON.parse(
      run(
        `$_SERVER['REQUEST_METHOD']='GET';$_SERVER['SCRIPT_NAME']=${quoted(base + '/api/list_media.php')};$_GET=['page'=>'9223372036854775807','search'=>'no-such-qa-file'];require ${quoted(path.join(site, 'api/list_media.php'))};`
      )
    );
    assert.equal(result.success, true);
    assert.deepEqual(result.files, []);
    checks += 2;
  }
  const listPath = path.join(site, 'api/list_media.php');
  const listSource = fs.readFileSync(listPath, 'utf8');
  const oldListSource = listSource.replace(
    '$page = min(1000000, max(1, $page));',
    '$page = max(1, $page);'
  );
  assert.notEqual(oldListSource, listSource, 'Missing overflow counterexample point');
  try {
    fs.writeFileSync(listPath, oldListSource);
    assert.throws(
      () =>
        run(
          `$_SERVER['REQUEST_METHOD']='GET';$_SERVER['SCRIPT_NAME']='/api/list_media.php';$_GET=['page'=>'9223372036854775807'];require ${quoted(listPath)};`
        ),
      /array_slice[\s\S]*float/
    );
    checks++;
  } finally {
    fs.writeFileSync(listPath, listSource);
  }
  const headers = JSON.parse(
    run(`
require ${quoted(path.join(root, 'public/api/mail_helper.php'))};
$message=voncms_build_mail_message('QA','<p>QA</p>','sender@example.test','QA','reply@example.test');
echo json_encode($message['headers']);
`)
  );
  assert.ok(headers.some((header) => /^Date: .+ [+-]\d{4}$/.test(header)));
  assert.ok(headers.some((header) => /^Message-ID: <[a-f0-9]{32}@example\.test>$/.test(header)));
  checks += 2;
  console.log(
    `PASS S4 regression: ${checks} checks; real UA bootstrap/native sessions, SQLite navigation projection, actual media delete with stubbed auth/audit and old-code counterexample, real mail formatter. No installed data.`
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
