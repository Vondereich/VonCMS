// Developer-tool boundaries only: owned loopback HTTP and synthetic QA credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { findPhpBinary } = require('../lint-php.cjs');
const root = path.resolve(__dirname, '../..');
let checks = 0;
function check(ok, message) {
  assert.ok(ok, message);
  checks++;
}
function installRoute() {
  const source = fs.readFileSync(path.join(root, 'server/themes-api.cjs'), 'utf8');
  const tree = ts.createSourceFile('themes-api.cjs', source, ts.ScriptTarget.Latest, true);
  const route = tree.statements.find(
    (node) =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(tree) === 'app.post' &&
      node.expression.arguments[0]?.text === '/api/install.php'
  );
  assert.ok(route, 'Actual mock installer route missing');
  return route.getText(tree);
}
const silentConsole = { log() {}, error() {} };
async function httpChecks() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  vm.runInNewContext(installRoute(), { app, console: silentConsole, setTimeout });
  app.get('/qa-health', (_req, res) => res.json({ alive: true }));
  app.use((error, _req, res, next) => {
    // Express identifies error handlers by their four-argument arity.
    void next;
    return res.status(error.status || 500).json({ error: 'QA error' });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const request = (body, type, method = 'POST', url = '/api/install.php') =>
    new Promise((resolve, reject) => {
      const headers = type ? { 'Content-Type': type } : {};
      if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
      const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      });
      req.on('error', reject);
      req.setTimeout(4000, () => req.destroy(new Error('Mock installer timed out')));
      req.end(body);
    });
  try {
    for (const [body, type, expectedStatus] of [
      [undefined, undefined, 400],
      // Express normalizes zero-byte JSON to {}; retain that harmless mock control.
      ['', 'application/json', 200],
      ['anything', 'text/plain', 400],
      ['[]', 'application/json', 400],
      ['null', 'application/json', 400],
      ['42', 'application/json', 400],
      ['"text"', 'application/json', 400],
      ['{', 'application/json', 400],
    ]) {
      const result = await request(body, type);
      check(result.status === expectedStatus, 'Unexpected parsed-body response');
      check(
        (await request(undefined, undefined, 'GET', '/qa-health')).body.alive,
        'Service died after invalid input'
      );
    }
    for (const body of [
      {},
      { dbHost: 'localhost', dbName: 'qa', dbUser: 'qa', adminEmail: 'qa@example.invalid' },
    ]) {
      const result = await request(JSON.stringify(body), 'application/json');
      check(
        result.status === 200 &&
          result.body.success === true &&
          result.body.message === 'Installation successful (Mock).',
        'Valid mock response changed'
      );
    }
    const callbackFailure = await request(
      JSON.stringify({ dbHost: { toString: null } }),
      'application/json'
    );
    check(
      callbackFailure.status === 500 && callbackFailure.body.success === false,
      'Async conversion failure escaped controlled response'
    );
    check(
      (await request(undefined, undefined, 'GET', '/qa-health')).body.alive,
      'Service died after callback failure'
    );
    console.log(
      'PASS Mock installer HTTP: ' +
        checks +
        ' checks; actual route/Express, loopback ephemeral listener only.'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
function callbackChecks() {
  let callback;
  let handler;
  vm.runInNewContext(installRoute(), {
    app: { post: (_route, fn) => (handler = fn) },
    console: silentConsole,
    setTimeout: (fn) => (callback = fn),
  });
  const req = {
    body: { dbHost: 'qa', dbName: 'qa', dbUser: 'qa', adminEmail: 'qa@example.invalid' },
  };
  const res = {
    statusCode: 200,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json() {
      if (this.statusCode === 200) throw new Error('Synthetic response failure');
    },
  };
  handler(req, res);
  req.body = undefined;
  assert.doesNotThrow(() => callback());
  check(res.statusCode === 500, 'Callback error was not contained');
  for (const condition of ['destroyed', 'writableEnded']) {
    let writes = 0;
    handler(
      { body: {} },
      {
        [condition]: true,
        json() {
          writes++;
        },
      }
    );
    assert.doesNotThrow(() => callback());
    check(writes === 0, 'Closed response was written');
  }
  let rewrites = 0;
  handler(
    { body: {} },
    {
      headersSent: true,
      json() {
        throw new Error('Synthetic response failure');
      },
      status() {
        rewrites++;
      },
    }
  );
  assert.doesNotThrow(() => callback());
  check(rewrites === 0, 'Already-sent response was rewritten');
}
function workerChecks() {
  const php = findPhpBinary();
  if (!php) throw new Error('Set PHP_BIN for worker command checks');
  const source = fs.readFileSync(
    path.join(root, 'server/integration/personal-ai-keys.php'),
    'utf8'
  );
  const start = source.indexOf('    $workerCode =');
  const end = source.indexOf('    $worker = proc_open(', start);
  assert.ok(start >= 0 && end > start, 'Actual worker construction missing');
  const assignment = source.slice(start, end);
  const command = source.slice(end).match(/^\s*\$worker = proc_open\(\s*(\[[^\]]+\])/);
  assert.ok(command, 'Actual worker argument expression missing');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-dev-tools-'));
  try {
    fs.mkdirSync(path.join(directory, 'public/api'), { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'public/api/ai_provider_helper.php'),
      '<?php // No production helper or provider.'
    );
    const literal = (value) => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
    const dir = directory.split(path.sep).join('/');
    const prefix =
      'define("VONCMS_CREDENTIAL_KEY_FILE",' +
      literal(dir + '/dummy.key.php') +
      ');$root=' +
      literal(dir) +
      ';$dsn="mysql:host=127.0.0.1";$database="owned_qa";$temporary=' +
      literal(dir) +
      ';$revision="synthetic-revision";';
    for (const suffix of ['simple', "quote'back\\slash"]) {
      const password = 'qa-password-canary-' + suffix;
      const username = 'qa-username-canary-' + suffix;
      const env = {
        ...process.env,
        VONCMS_TEST_MYSQL_PASSWORD: password,
        VONCMS_TEST_MYSQL_USER: username,
      };
      const generated = spawnSync(
        php,
        ['-r', prefix + assignment + 'echo json_encode(' + command[1] + ');'],
        { env, encoding: 'utf8' }
      );
      check(generated.status === 0, 'Could not evaluate actual worker construction');
      const args = JSON.parse(generated.stdout);
      const code = args[args.indexOf('-r') + 1];
      check(
        typeof code === 'string' && typeof args[0] === 'string' && path.isAbsolute(args[0]),
        'Actual worker invocation changed'
      );
      check(
        args.every(
          (arg) => !arg.includes('qa-password-canary-') && !arg.includes('qa-username-canary-')
        ),
        'QA credential was embedded in worker argv'
      );
      // Exercise the unchanged generated code with an inert namespaced PDO and provider.
      const inert =
        'namespace DevToolsQa;class PDO{const ATTR_ERRMODE=3;const ERRMODE_EXCEPTION=2;function __construct($d,$u,$p,$o){if($u!==getenv("VONCMS_TEST_MYSQL_USER")||$p!==getenv("VONCMS_TEST_MYSQL_PASSWORD"))throw new \\RuntimeException("Environment mismatch");}}function voncms_ai_rotate_global_key($db,$revision,$actor){if($revision!=="synthetic-revision"||$actor!=="1")throw new \\RuntimeException("Worker contract changed");}';
      const child = spawnSync(php, ['-d', 'opcache.enable_cli=0', '-r', inert + code], {
        env,
        encoding: 'utf8',
      });
      check(
        child.status === 0 && child.stdout === 'ok' && child.stderr === '',
        'Child did not receive inherited credentials'
      );
      check(
        fs.existsSync(path.join(directory, 'started')) &&
          fs.existsSync(path.join(directory, 'finished')),
        'Worker lifecycle markers missing'
      );
    }
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('voncms-dev-tools-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
async function run() {
  if (process.argv[2] === '--http-child') return httpChecks();
  if (process.argv[2] === '--worker-env-only') {
    workerChecks();
  } else {
    const child = spawnSync(process.execPath, [__filename, '--http-child'], {
      encoding: 'utf8',
      timeout: 30000,
    });
    check(
      child.status === 0 && child.stdout.startsWith('PASS ') && child.stderr === '',
      'Mock HTTP fixture failed: ' + child.stderr + child.stdout
    );
    const httpCount = child.stdout.match(/HTTP: (\d+) checks/);
    assert.ok(httpCount, 'HTTP evidence count missing');
    checks += Number(httpCount[1]);
    callbackChecks();
    workerChecks();
  }
  console.log(
    'PASS Developer tools: ' +
      checks +
      ' checks; mock installer availability and synthetic QA credential argv/environment boundaries. No production APIs/data.'
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
