// Real browser -> PHP-CGI -> disposable MySQL. No installed config/data/provider is read.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const php =
  process.env.PHP_BIN ||
  (process.platform === 'win32' ? 'C:/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php.exe' : 'php');
function createFixture() {
  const dsn = process.env.VONCMS_TEST_MYSQL_DSN || 'mysql:host=127.0.0.1;port=3306;charset=utf8mb4';
  assert(/^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/.test(dsn), 'Loopback QA server only');
  const database = 'voncms_activity_live_' + randomBytes(6).toString('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-activity-live-'));
  const connect = `$p=new PDO(${JSON.stringify(dsn)},(string)(getenv('VONCMS_TEST_MYSQL_USER')?:'root'),(string)getenv('VONCMS_TEST_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);`;
  let owns = false,
    dropReply = false;
  const execute = (code, args = []) => {
    const r = spawnSync(php, ['-r', connect + code, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    return r.stdout;
  };
  const sql = (statement) =>
    execute(`$p->exec('USE \`${database}\`');$p->exec($argv[1]);`, [statement]);
  const count = () =>
    JSON.parse(
      execute(
        `$p->exec('USE \`${database}\`');echo json_encode(['expired'=>(int)$p->query("SELECT COUNT(*) FROM staff_activity_log WHERE action='delete' AND target_id='old'")->fetchColumn(),'receipts'=>(int)$p->query("SELECT COUNT(*) FROM staff_activity_log WHERE action='purge'")->fetchColumn(),'legacy'=>(int)$p->query('SELECT COUNT(*) FROM content_audit_logs')->fetchColumn()]);`
      )
    );
  const close = () => {
    if (owns) {
      assert(/^voncms_activity_live_[a-f0-9]{12}$/.test(database));
      execute(`$p->exec('DROP DATABASE \`${database}\`');`);
      owns = false;
    }
    assert(
      path.dirname(dir) === os.tmpdir() && path.basename(dir).startsWith('voncms-activity-live-')
    );
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  };
  try {
    execute(`$p->exec('CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4');`);
    owns = true;
    for (const file of [
      'security.php',
      'core/DataBoundary.php',
      'core/InstallBootstrap.php',
      'core/ContentViewDeduplicator.php',
      'core/RateLimiter.php',
      'core/ResponseHelper.php',
      'scheduler_helper.php',
      'api/public_cache_helper.php',
      'api/publication_time_helper.php',
      'api/activity/index.php',
      'api/activity/ActivityLog.php',
      'api/settings_audit_helper.php',
    ]) {
      const to = path.join(dir, file);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(root, 'public', file), to);
    }
    fs.mkdirSync(path.join(dir, 'sessions'));
    fs.writeFileSync(
      path.join(dir, 'von_config.php'),
      `<?php $pdo=new PDO(${JSON.stringify(dsn + ';dbname=' + database)},(string)(getenv('VONCMS_TEST_MYSQL_USER')?:'root'),(string)getenv('VONCMS_TEST_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);`,
      { mode: 0o600 }
    );
    fs.writeFileSync(
      path.join(dir, 'bootstrap.php'),
      `<?php require __DIR__.'/von_config.php';require __DIR__.'/security.php';SessionManager::establishAuthenticatedSession(['id'=>'9','username'=>'QA owner','role'=>'root'],'qa-hash');echo json_encode(['success'=>true,'csrf'=>CSRFProtection::getToken()]);`
    );
    execute(
      `$p->exec('USE \`${database}\`');$sql=file_get_contents($argv[1]);$sql=preg_replace('/^\\s*(?:CREATE DATABASE[^;]*;|USE\\s+[^;]*;)/mi','',$sql,-1,$removed);if($removed!==2)throw new RuntimeException('SQL confinement');$p->exec($sql);`,
      [path.join(root, 'public/install.sql')]
    );
    sql(
      "INSERT INTO users(id,username,email,password,role) VALUES(9,'qa_owner','qa@example.invalid','qa-hash','root');INSERT INTO content_audit_logs(content_type,content_id,action,actor_user_id,actor_username,actor_role,summary,context_json)VALUES('post',72,'delete',9,'QA owner','root','Shared history','{\"title\":\"Shared original history QA\"}')"
    );
    const reset = () => {
      sql("UPDATE users SET role='root' WHERE id=9;DELETE FROM staff_activity_log");
      execute(
        `$p->exec('USE \`${database}\`');$s=$p->prepare("INSERT INTO staff_activity_log(action,actor_user_id,actor_username,actor_role,target_type,target_id,target_label,outcome,created_at)VALUES('delete',9,'QA owner','root','media','old','Old QA image','success',?)");for($i=0;$i<505;$i++)$s->execute([date('Y-m-d H:i:s',time()-92*86400)]);`
      );
      dropReply = false;
    };
    const handle = async (req, res) => {
      const url = new URL(req.url, 'http://fixture');
      const login = url.pathname === '/__activity-live-login';
      if (!login && !/^\/(?:zangetsu\/)?api\/activity\/index\.php$/.test(url.pathname))
        return false;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const base = login
        ? url.searchParams.get('base') || ''
        : url.pathname.startsWith('/zangetsu/')
          ? '/zangetsu'
          : '';
      assert(['', '/zangetsu'].includes(base));
      const result = spawnSync(
        path.join(path.dirname(php), process.platform === 'win32' ? 'php-cgi.exe' : 'php-cgi'),
        [
          '-d',
          'display_errors=0',
          '-d',
          'opcache.enable=0',
          '-d',
          `session.save_path=${path.join(dir, 'sessions')}`,
        ],
        {
          cwd: dir,
          input: body,
          encoding: 'utf8',
          env: {
            ...process.env,
            REDIRECT_STATUS: '1',
            REQUEST_METHOD: req.method,
            CONTENT_TYPE: req.headers['content-type'] || 'application/json',
            CONTENT_LENGTH: String(body.length),
            SCRIPT_FILENAME: path.join(dir, login ? 'bootstrap.php' : 'api/activity/index.php'),
            SCRIPT_NAME: base + '/api/activity/index.php',
            REQUEST_URI: url.pathname,
            SERVER_PROTOCOL: 'HTTP/1.1',
            HTTP_HOST: req.headers.host,
            HTTP_COOKIE: req.headers.cookie || '',
            HTTP_USER_AGENT: req.headers['user-agent'] || '',
            HTTP_X_CSRF_TOKEN: req.headers['x-csrf-token'] || '',
          },
        }
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const split = result.stdout.search(/\r?\n\r?\n/);
      assert(split >= 0, 'CGI must return headers');
      const header = result.stdout.slice(0, split),
        payload = result.stdout.slice(split).trim();
      if (dropReply && req.method === 'POST' && JSON.parse(body.toString()).action === 'purge') {
        assert.equal(
          JSON.parse(payload).removed,
          500,
          'Lost-response injection requires a real committed purge'
        );
        dropReply = false;
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: false,
            error: 'QA response lost after commit; retry same preview',
          })
        );
        return true;
      }
      res.statusCode = Number(header.match(/^Status:\s*(\d+)/im)?.[1] || 200);
      for (const line of header.split(/\r?\n/)) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const key = line.slice(0, colon),
          value = line.slice(colon + 1).trim();
        if (!/^status|content-length$/i.test(key)) res.setHeader(key, value);
      }
      res.end(payload);
      return true;
    };
    return {
      handle,
      reset,
      count,
      close,
      loseNextPurgeReply() {
        dropReply = true;
      },
      demote() {
        sql("UPDATE users SET role='Member' WHERE id=9");
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
const fixture = `
import React from 'react';import{createRoot}from'react-dom/client';
import ActivityLog from '/src/plugins/von-core/features/activity/ActivityLog.tsx';import '/src/index.css';
const native=window.fetch.bind(window);window.__qaNative=native;const base=location.pathname.startsWith('/zangetsu/')?'/zangetsu':'';
native('/__activity-live-login?base='+encodeURIComponent(base)).then(r=>r.json()).then(auth=>{
 if(!auth.success)throw Error('QA session bootstrap failed');
 window.fetch=(input,options={})=>new URL(input,location.href).pathname.endsWith('/api/activity/index.php')?native(input,options):Promise.resolve(new Response(JSON.stringify({success:true,token:auth.csrf,csrf_token:auth.csrf})));
 createRoot(document.getElementById('root')).render(React.createElement('main',{style:{padding:24}},React.createElement(ActivityLog,{timeZone:'Asia/Kuala_Lumpur'})));
});`;
async function verify({ send, evaluate, wait, port, backend, errors }) {
  let checks = 0;
  const click = async (text) =>
    evaluate(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`
    );
  for (const base of ['', '/zangetsu']) {
    backend.reset();
    await send('Network.clearBrowserCookies');
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${base}/admin/qa-activity-live` });
    await wait(
      `document.querySelectorAll('section[aria-label="Recorded activity"] li').length===20`
    );
    const denied = await evaluate(
      `Promise.all([{credentials:'omit'},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview'})}].map(options=>window.__qaNative('${base}/api/activity/index.php',options).then(r=>r.status)))`
    );
    assert.deepEqual(denied, [401, 403]);
    checks += 2;
    await click('Preview purge');
    await wait(
      `document.querySelector('[role="dialog"]')&&document.body.textContent.includes('505 records')`
    );
    await click('Cancel');
    assert.deepEqual(backend.count(), { expired: 505, receipts: 0, legacy: 1 });
    checks++;
    await click('Preview purge');
    await wait(
      `document.querySelector('[role="dialog"]')&&document.body.textContent.includes('505 records')`
    );
    backend.loseNextPurgeReply();
    await click('Confirm purge');
    await wait(`document.body.textContent.includes('QA response lost after commit')`);
    assert.deepEqual(backend.count(), { expired: 5, receipts: 1, legacy: 1 });
    checks++;
    await click('Confirm purge');
    await wait(`document.body.textContent.includes('500 activity records purged.')`);
    assert.deepEqual(backend.count(), { expired: 5, receipts: 1, legacy: 1 });
    checks++;
    await wait(`document.querySelector('section').getAttribute('aria-busy')==='false'`);
    await click('Preview purge');
    await wait(
      `document.querySelector('[role="dialog"]')&&document.body.textContent.includes('5 records')`
    );
    await click('Confirm purge');
    await wait(`document.body.textContent.includes('5 activity records purged.')`);
    assert.deepEqual(backend.count(), { expired: 0, receipts: 2, legacy: 1 });
    checks++;
    await wait(`document.querySelector('section').getAttribute('aria-busy')==='false'`);
    await click('Preview purge');
    await wait(
      `document.querySelector('[role="dialog"]')&&document.body.textContent.includes('0 records')`
    );
    assert.equal(
      await evaluate(
        `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Confirm purge').disabled`
      ),
      true
    );
    await click('Cancel');
    checks++;
    backend.demote();
    await click('Refresh');
    await wait(`document.body.textContent.includes('authorization changed')`);
    assert.deepEqual(backend.count(), { expired: 0, receipts: 2, legacy: 1 });
    checks++;
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS Activity live HTTP: ${checks} browser -> real PHP-CGI -> real MySQL root/subfolder flow checks; actual sessions/CSRF, preview/cancel, committed-but-lost response, safe retry, next batch, zero-eligible state and revoked role. Disposable QA only.`
  );
}
module.exports = { createFixture, fixture, verify };
