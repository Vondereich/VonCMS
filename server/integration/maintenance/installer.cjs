// Disposable HTTP fixtures only. No configured CMS, database or hosting configuration is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { findPhpBinary } = require('../../lint-php.cjs');
const root = path.resolve(__dirname, '../../..');
const php = findPhpBinary();
if (!php) throw new Error('Set PHP_BIN to a supported 64-bit PHP runtime.');
const cgi =
  process.env.PHP_CGI_BIN ||
  path.join(path.dirname(php), process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi');
const nginx =
  process.env.NGINX_BIN ||
  (process.platform === 'win32' ? 'C:/laragon/bin/nginx/nginx-1.28.2/nginx.exe' : '');
const useNginx = Boolean(nginx && fs.existsSync(nginx) && fs.existsSync(cgi));
const temporaryBase = path.resolve(process.env.VONCMS_QA_TMP || os.tmpdir());
const directory = fs.mkdtempSync(path.join(temporaryBase, 'voncms-installer-'));
const www = path.join(directory, 'www');
const sessions = path.join(directory, 'sessions');
const hostLog = path.join(sessions, 'host.log');
const children = [];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const slash = (value) => value.replace(/\\/g, '/');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const port = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
const launch = (binary, args) => {
  const process = spawn(binary, args, {
    cwd: directory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...global.process.env, PHP_FCGI_CHILDREN: '0', VONCMS_ENV: 'production' },
  });
  process.diagnostics = '';
  for (const stream of [process.stdout, process.stderr])
    stream.on('data', (bytes) => {
      process.diagnostics = (process.diagnostics + bytes).slice(-32768);
    });
  process.on('error', (error) => {
    process.diagnostics += error.message;
  });
  children.push(process);
  return process;
};
async function stopChildren() {
  for (const child of children.splice(0).reverse()) {
    if (child.exitCode !== null) continue;
    child.kill();
    for (let attempt = 0; attempt < 40 && child.exitCode === null; attempt++) await sleep(50);
    check(child.exitCode !== null || child.signalCode !== null, 'Owned QA process did not stop.');
  }
}

async function run() {
  fs.mkdirSync(www);
  fs.mkdirSync(sessions);
  fs.mkdirSync(path.join(directory, 'logs'));
  fs.mkdirSync(path.join(directory, 'temp'));
  const generated = spawnSync(
    php,
    [
      '-r',
      String.raw`
    $source = file_get_contents($argv[1]);
    $start = strpos($source, '$configContent =');
    if ($start === false) exit(2);
    $assignment = '';
    foreach (array_slice(token_get_all('<?php ' . substr($source, $start)), 1) as $token) {
      $assignment .= is_array($token) ? $token[1] : $token;
      if ($token === ';') break;
    }
    $dbHost='localhost'; $dbName='qa_only'; $dbUser='qa_only'; $dbPass='dummy-not-used';
    eval($assignment);
    $end = strpos($configContent, "\n\$db_host =");
    if ($end === false) exit(3);
    echo json_encode(['prefix' => substr($configContent, 0, $end)], JSON_THROW_ON_ERROR);
  `,
      path.join(root, 'public/api/install.php'),
    ],
    { encoding: 'utf8' }
  );
  check(generated.status === 0, 'Installer template extraction failed: ' + generated.stderr);
  const generatedPrefix = JSON.parse(generated.stdout).prefix;
  const sample = fs
    .readFileSync(path.join(root, 'public/von_config.sample.php'), 'utf8')
    .split(/\r?\n\$db_host =/)[0];
  for (const base of ['', 'cms']) {
    const site = path.join(www, base);
    fs.mkdirSync(path.join(site, 'data'), { recursive: true });
    fs.cpSync(path.join(root, 'public/core'), path.join(site, 'core'), { recursive: true });
    fs.copyFileSync(path.join(root, 'public/security.php'), path.join(site, 'security.php'));
    fs.copyFileSync(path.join(root, 'public/api.php'), path.join(site, 'api.php'));
    fs.writeFileSync(
      path.join(site, 'bootstrap.php'),
      `<?php define('VONCMS_CORE_LOADED',true); require __DIR__.'/core/InstallBootstrap.php'; header('Content-Type: application/json'); $input=json_decode(file_get_contents('php://input'),true); echo json_encode(['ok'=>InstallBootstrap::ensureKey(),'valid'=>isset($input['candidate'])?InstallBootstrap::validate($input['candidate']):null]);`
    );
    fs.writeFileSync(path.join(site, 'data/install_setup.key'), 'a'.repeat(64));
    fs.chmodSync(path.join(site, 'data/install_setup.key'), 0o600);
    fs.writeFileSync(path.join(site, 'plaintext-negative.key'), 'QA plaintext negative control');
    for (const [name, prefix] of [
      ['sample', sample],
      ['generated', generatedPrefix],
    ]) {
      fs.writeFileSync(path.join(site, name + '-config.php'), prefix);
      fs.writeFileSync(
        path.join(site, name + '-probe.php'),
        `<?php require __DIR__.'/${name}-config.php'; header('Content-Type: application/json'); echo json_encode(['ok'=>true,'display'=>ini_get('display_errors'),'log'=>ini_get('error_log'),'tmp'=>sys_get_temp_dir(),'restriction'=>ini_get('open_basedir')]);`
      );
    }
    fs.writeFileSync(
      path.join(site, 'warning-control.php'),
      `<?php header('Content-Type: application/json'); is_dir(dirname(${JSON.stringify(slash(www))}).'/forbidden-probe'); echo json_encode(['ok'=>true]);`
    );
  }
  for (const mode of ['restricted', 'private', 'public-temp', 'safe-temp']) {
    const restricted = mode !== 'private';
    const tempRoot =
      mode === 'public-temp' ? path.join(www, 'tmp') : path.join(directory, 'private-tmp');
    fs.mkdirSync(tempRoot, { recursive: true });
    const httpPort = await port();
    const settings = [
      '-d',
      'display_errors=1',
      '-d',
      'log_errors=1',
      '-d',
      'error_log=' + hostLog,
      '-d',
      'session.save_path=' + sessions,
      '-d',
      'sys_temp_dir=' + tempRoot,
      '-d',
      'opcache.enable=0',
    ];
    if (restricted)
      settings.push(
        '-d',
        'open_basedir="' +
          [www, sessions, ...(mode === 'safe-temp' ? [tempRoot] : [])]
            .map(slash)
            .join(path.delimiter) +
          '"'
      );
    let httpServer;
    if (useNginx) {
      const cgiPort = await port();
      launch(cgi, [...settings, '-b', '127.0.0.1:' + cgiPort]);
      const config = `daemon off; master_process off; pid ${slash(path.join(directory, 'nginx.pid'))}; error_log ${slash(path.join(sessions, 'nginx.log'))}; events { worker_connections 32; } http { access_log off; server { listen 127.0.0.1:${httpPort}; server_name localhost; root ${slash(www)}; location / { try_files $uri =404; } location ~ \\.php$ { fastcgi_pass 127.0.0.1:${cgiPort}; fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; fastcgi_param QUERY_STRING $query_string; fastcgi_param REQUEST_METHOD $request_method; fastcgi_param CONTENT_TYPE $content_type; fastcgi_param CONTENT_LENGTH $content_length; fastcgi_param SCRIPT_NAME $fastcgi_script_name; fastcgi_param REQUEST_URI $request_uri; fastcgi_param DOCUMENT_ROOT $document_root; fastcgi_param SERVER_PROTOCOL $server_protocol; fastcgi_param SERVER_NAME localhost; fastcgi_param SERVER_PORT $server_port; fastcgi_param REMOTE_ADDR $remote_addr; fastcgi_param REDIRECT_STATUS 200; fastcgi_param HTTP_HOST $http_host; } } }`;
      const configPath = path.join(directory, 'nginx.conf');
      fs.writeFileSync(configPath, config);
      httpServer = launch(nginx, ['-p', directory + path.sep, '-c', configPath]);
    } else httpServer = launch(php, [...settings, '-S', '127.0.0.1:' + httpPort, '-t', www]);
    const origin = 'http://127.0.0.1:' + httpPort;
    const request = async (url, options) => {
      const response = await fetch(origin + url, { ...options, signal: AbortSignal.timeout(4000) });
      return { status: response.status, body: await response.text(), headers: response.headers };
    };
    let ready = false;
    for (let attempt = 0; attempt < 80 && !ready; attempt++) {
      try {
        ready = (await request('/plaintext-negative.key')).status === 200;
      } catch {
        await sleep(50);
      }
    }
    check(ready, 'QA HTTP server unavailable: ' + httpServer.diagnostics);
    if (restricted) {
      const negative = await request('/warning-control.php');
      check(
        /open_basedir restriction/.test(negative.body),
        'The restricted fixture must expose its deliberate warning control.'
      );
    }
    for (const prefix of ['', '/cms']) {
      const site = path.join(www, prefix.replace(/^\//, ''));
      if (mode === 'restricted') {
        const exposedLegacy = await request(prefix + '/data/install_setup.key');
        check(
          exposedLegacy.status === 200 && exposedLegacy.body === 'a'.repeat(64),
          'The no-deny fixture must reproduce the old plaintext-key exposure.'
        );
      }
      const bootstrap = await request(prefix + '/bootstrap.php');
      check(
        bootstrap.status === 200 && JSON.parse(bootstrap.body).ok === true,
        'Key creation failed.'
      );
      const keyPath = path.join(site, 'data/install_setup.key.php');
      const keyFile = fs.readFileSync(keyPath, 'utf8');
      const key = keyFile.trim().split('\n').at(-1);
      check(
        /^[a-f0-9]{64}$/.test(key) && key !== 'a'.repeat(64),
        'Legacy key was reused or setup key is malformed.'
      );
      check(
        !fs.existsSync(path.join(site, 'data/install_setup.key')),
        'Obsolete plaintext key was not retired.'
      );
      const blocked = await request(prefix + '/data/install_setup.key.php');
      check(
        blocked.status === 403 && !blocked.body.includes(key),
        'Setup key is HTTP-readable without data deny rules.'
      );
      for (const [candidate, expected] of [
        [key, true],
        ['a'.repeat(64), false],
      ]) {
        const validation = await request(prefix + '/bootstrap.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate }),
        });
        check(
          JSON.parse(validation.body).valid === expected,
          'Setup key ownership/legacy rejection changed.'
        );
      }
      const token = await request(prefix + '/api.php?action=get_csrf_token');
      check(
        token.status === 200 && /^[a-f0-9]{64}$/.test(JSON.parse(token.body).csrf_token),
        'Pre-install CSRF endpoint failed.'
      );
      const unavailable = await request(prefix + '/api.php?action=get_settings');
      check(
        unavailable.status === 503 && JSON.parse(unavailable.body).code === 'INSTALL_REQUIRED',
        'Pre-install database action did not fail safely.'
      );
      for (const name of ['sample', 'generated']) {
        const before = fs.existsSync(hostLog) ? fs.readFileSync(hostLog, 'utf8') : '';
        const response = await request(prefix + '/' + name + '-probe.php');
        const result = JSON.parse(response.body);
        check(
          response.status === 200 && result.ok === true && result.display === '0',
          'Logging template corrupted a JSON response.'
        );
        const after = fs.existsSync(hostLog) ? fs.readFileSync(hostLog, 'utf8') : '';
        check(after === before, 'Logging template produced warnings under open_basedir.');
        check(
          mode === 'restricted' || mode === 'public-temp'
            ? result.log === hostLog
            : result.log !== hostLog && !slash(result.log).startsWith(slash(www) + '/'),
          'Log fallback escaped its private/inherited contract: ' +
            JSON.stringify({ mode, name, result, hostLog })
        );
      }
      check(
        (await request(prefix + '/core/RuntimeLogging.php')).status === 403,
        'Runtime logging helper can execute directly.'
      );
      fs.writeFileSync(path.join(site, 'von_config.php'), "<?php header('X-QA-Config: loaded');");
      const configured = await request(prefix + '/api.php?action=get_csrf_token');
      check(
        configured.status === 200 && configured.headers.get('x-qa-config') === 'loaded',
        'Configured API bridge stopped loading its config.'
      );
      fs.unlinkSync(path.join(site, 'von_config.php'));
    }
    await stopChildren();
  }
  console.log(
    `PASS Installer HTTP: ${checks} checks; ${useNginx ? 'real nginx/FastCGI' : 'PHP built-in server'}, root/subfolder, guarded setup key, legacy retirement, pre-install CSRF, actual generated/sample config and open_basedir warning controls. No DB or installed site.`
  );
  if (!useNginx)
    console.log('NOT_RUN nginx-specific transport: set NGINX_BIN and PHP_CGI_BIN to exercise it.');
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopChildren();
    const resolved = fs.realpathSync(directory);
    if (
      !resolved.startsWith(temporaryBase + path.sep) ||
      !path.basename(resolved).startsWith('voncms-installer-')
    )
      throw new Error('Unsafe QA cleanup target.');
    fs.rmSync(resolved, { recursive: true, force: true });
  });
