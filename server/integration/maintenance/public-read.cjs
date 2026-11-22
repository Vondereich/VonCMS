// Real PHP-CGI security bootstrap, native sessions and headers; no CMS config/DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const php = process.env.PHP_BIN;
assert.ok(php, 'Set PHP_BIN to supported 64-bit PHP');
const cgi = path.join(path.dirname(php), process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-public-read-'));
const quote = (s) => "'" + s.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
let checks = 0;
function run(base, script, options = {}) {
  const file = path.join(temp, 'worker.php');
  fs.writeFileSync(
    file,
    `<?php
session_save_path(${quote(temp)});
$_SERVER['SCRIPT_NAME']=${quote(base + script)};
$_SERVER['REQUEST_URI']=${quote(base + (options.route || '/'))};
$_COOKIE=${options.cookie ? "[session_name()=>'qa-session', 'voncms_remember'=>'fixture-only']" : '[]'};
${options.seed ? "session_id('qa-session');session_start();$_SESSION=['user'=>['id'=>'1','role'=>'Root'],'ua_bind'=>hash('sha256','Old UA')];session_write_close();" : ''}
require ${quote(path.join(root, 'public/security.php'))};
${options.token ? '$token=CSRFProtection::getToken();' : "$token='';"}
${options.deny ? 'SessionManager::requireStaff();' : ''}
${options.status ? `http_response_code(${options.status});` : ''}
echo json_encode(['active'=>session_status()===PHP_SESSION_ACTIVE,'token'=>$token]);`
  );
  const result = spawnSync(cgi, ['-d', 'display_errors=1', '-d', 'log_errors=0', file], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REDIRECT_STATUS: '1',
      SCRIPT_FILENAME: file,
      REQUEST_METHOD: options.method || 'GET',
      HTTP_USER_AGENT: options.ua || 'Ordinary Browser',
      HTTP_ACCEPT: 'text/html',
      HTTP_HOST: 'qa.invalid',
      SERVER_PROTOCOL: 'HTTP/1.1',
    },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stderr, '');
  const [headers, ...body] = result.stdout.split(/\r?\n\r?\n/);
  return {
    headers,
    body: JSON.parse(body.join('\n\n')),
    status: Number(headers.match(/^Status: (\d+)/m)?.[1] || 200),
  };
}
try {
  for (const base of ['', '/zangetsu']) {
    for (const script of [
      '/index.php',
      '/api/get_posts.php',
      '/api/get_settings.php',
      '/api/get_pages.php',
      '/api/get_comments.php',
      '/api/check_auth.php',
      '/rss.php',
      '/sitemap.php',
      '/llms.php',
    ]) {
      for (const ua of ['Ordinary Browser', 'Googlebot', 'GPTBot']) {
        const result = run(base, script, { ua });
        assert.equal(
          result.body.active,
          false,
          base + script + ': cookieless read created a session'
        );
        assert.doesNotMatch(result.headers, /Set-Cookie:/i);
        assert.match(
          result.headers,
          script.endsWith('/check_auth.php')
            ? /Cache-Control: private, no-store/i
            : /Cache-Control: public, max-age=60/i
        );
        assert.match(result.headers, /Vary:.*Cookie/i);
        checks++;
      }
    }
    for (const options of [{ cookie: true }, { method: 'POST' }, { token: true }]) {
      const result = run(base, '/api.php', options);
      assert.equal(result.body.active, true);
      assert.match(result.headers, /Cache-Control: private, no-store/);
      if (options.token) assert.match(result.body.token, /^[a-f0-9]{64}$/);
      checks++;
    }
    for (const route of [
      '/admin',
      '/ADMIN/posts',
      '/login',
      '/register',
      '/reset-password',
      '/install',
    ]) {
      const result = run(base, '/index.php', { route });
      assert.equal(result.body.active, true, 'Private/auth route must retain its session');
      assert.match(result.headers, /Cache-Control: private, no-store/);
      checks++;
    }
    const mismatch = run(base, '/api/check_auth.php', { cookie: true, seed: true });
    assert.equal(mismatch.status, 401);
    assert.equal(mismatch.body.code, 'SESSION_HIJACK');
    assert.doesNotMatch(mismatch.headers, /Cache-Control: public/);
    const denial = run(base, '/api/get_posts.php', { deny: true });
    assert.equal(denial.status, 401);
    assert.doesNotMatch(denial.headers, /Cache-Control: public/);
    checks += 2;
  }
  assert.equal(fs.readdirSync(temp).filter((file) => file.startsWith('sess_')).length >= 1, true);
  console.log(
    `PASS Public read bootstrap: ${checks} native CGI session/header controls; root/subfolder, crawler lookalikes, auth pages, token creation and UA mismatch. No installed data.`
  );
} finally {
  assert.equal(path.dirname(temp), fs.realpathSync(os.tmpdir()));
  assert.match(path.basename(temp), /^voncms-public-read-/);
  fs.rmSync(temp, { recursive: true, force: true });
}
