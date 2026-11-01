// Real endpoint/service + SQLite fixture. Session/CSRF transport is deliberately stubbed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');

function createCalendarFixture() {
  const useMysql = process.argv.includes('--mysql');
  const schema = 'voncms_calendar_qa_' + randomBytes(6).toString('hex');
  const mysqlDsn =
    process.env.VONCMS_TEST_MYSQL_DSN || 'mysql:host=127.0.0.1;port=3306;charset=utf8mb4';
  if (useMysql)
    assert(
      /^mysql:host=127\.0\.0\.1;port=\d+;charset=utf8mb4$/.test(mysqlDsn),
      'MySQL fixtures require an explicit loopback server without a selected database.'
    );
  const php =
    process.env.PHP_BIN ||
    (process.platform === 'win32'
      ? 'C:/laragon/bin/php/php-8.5.12-nts-Win32-vs17-x64/php.exe'
      : 'php');
  const probe = spawnSync(php, [
    '-r',
    'exit(PHP_VERSION_ID>=80200 && extension_loaded("pdo_sqlite") && extension_loaded("mbstring") ? 0 : 2);',
  ]);
  if (probe.status !== 0)
    throw new Error('NOT_RUN Calendar: set PHP_BIN to PHP 8.2+ with pdo_sqlite and mbstring.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-calendar-'));
  const connectMysql = `$p=new PDO(${JSON.stringify(mysqlDsn)},(string)(getenv('VONCMS_TEST_MYSQL_USER')?:'root'),(string)getenv('VONCMS_TEST_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_TIMEOUT=>3]);`;
  let ownsSchema = false;
  const cleanup = () => {
    if (ownsSchema) {
      assert(/^voncms_calendar_qa_[a-f0-9]{12}$/.test(schema));
      const dropped = spawnSync(
        php,
        ['-r', connectMysql + `$p->exec('DROP DATABASE \`${schema}\`');`],
        { encoding: 'utf8' }
      );
      assert.equal(dropped.status, 0, 'Owned MySQL fixture cleanup failed: ' + dropped.stderr);
      ownsSchema = false;
    }
    assert(
      path.basename(directory).startsWith('voncms-calendar-') &&
        path.dirname(directory) === os.tmpdir()
    );
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };
  try {
    if (useMysql) {
      const created = spawnSync(
        php,
        ['-r', connectMysql + `$p->exec('CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4');`],
        { encoding: 'utf8' }
      );
      if (created.status !== 0) {
        cleanup();
        throw new Error(
          'NOT_RUN Calendar MySQL: loopback fixture account cannot create the isolated schema.'
        );
      }
      ownsSchema = true;
    }
    const copy = (file) => {
      const destination = path.join(directory, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, 'public', file), destination);
    };
    for (const file of [
      'api/calendar.php',
      'api/role_capability_helper.php',
      'api/publication_time_helper.php',
      'api/schema_repair_helper.php',
      'core/Calendar.php',
      'core/ResponseHelper.php',
      'core/DataBoundary.php',
    ])
      copy(file);
    fs.writeFileSync(
      path.join(directory, 'security.php'),
      `<?php
define('VONCMS_CORE_LOADED',true);
$fixture=json_decode(getenv('VON_CALENDAR_FIXTURE')?:'{}',true);
$_SERVER['REQUEST_METHOD']=$fixture['method']??'GET';$_GET=$fixture['query']??[];
$_SERVER['SCRIPT_FILENAME']=__DIR__.'/api/calendar.php';$_SERVER['PHP_SELF']='/api/calendar.php';
$_SESSION=['user'=>['id'=>($fixture['role']??'')==='root'?'1':'8','username'=>'Fixture & reviewer','role'=>$fixture['role']??'Admin']];
function sendApiHeaders($methods='GET, OPTIONS'){}
class SessionManager {
 static function requireValidSession(){if(($_SESSION['user']['role']??'')==='Guest')ResponseHelper::sendError('Not authenticated',401);}
 static function isAdmin(){return in_array(strtolower($_SESSION['user']['role']??''),['admin','root'],true);}
}
class CSRFProtection {
 static function requireToken(){global $fixture;if(($fixture['csrf']??'')!=='fixture-token')ResponseHelper::sendError('Invalid CSRF token',403);}
 static function getRequestBody(){global $fixture;return json_encode($fixture['body']??null);}
}
function voncms_apply_site_timezone($pdo){global $fixture;date_default_timezone_set($fixture['zone']??'Asia/Kuala_Lumpur');}
require __DIR__.'/core/ResponseHelper.php';
register_shutdown_function(function(){echo "\\nFIXTURE_STATUS:".(http_response_code()?:200);});
`
    );
    fs.writeFileSync(
      path.join(directory, 'von_config.php'),
      `<?php
class CalendarFixturePDO extends PDO {
 public function prepare(string $query,array $options=[]):PDOStatement|false {
  global $fixture;
  if(!empty($fixture['auditFailure']) && str_starts_with($query,'INSERT INTO calendar_event_audit'))throw new PDOException('Fixture audit rejection');
  // MySQL permits single-argument COALESCE; SQLite does not. Preserve the same value.
  return parent::prepare($this->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?str_replace('COALESCE(p.created_at)','p.created_at',$query):$query,$options);
 }
}
$pdo=${useMysql ? `new CalendarFixturePDO(${JSON.stringify(mysqlDsn + ';dbname=' + schema)},(string)(getenv('VONCMS_TEST_MYSQL_USER')?:'root'),(string)getenv('VONCMS_TEST_MYSQL_PASSWORD'))` : "new CalendarFixturePDO('sqlite:'.__DIR__.'/fixture.sqlite')"};
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite')$pdo->exec('PRAGMA busy_timeout=3000');
if(!empty($fixture['legacy']))$GLOBALS['voncms_publication_capability_cache']=[];
else $GLOBALS['voncms_publication_capability_cache']=['published_at'=>['posts'=>true,'pages'=>true]];
`
    );
    const initialize = `require ${JSON.stringify(path.join(directory, 'api/schema_repair_helper.php').replaceAll('\\', '/'))};
require ${JSON.stringify(path.join(directory, 'von_config.php').replaceAll('\\', '/'))};
foreach(voncms_schema_runtime_table_sql() as $table=>$sql){if(!in_array($table,['calendar_events','calendar_event_audit'],true))continue;
 if($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'){
 $sql=str_replace(['BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY','INT AUTO_INCREMENT PRIMARY KEY'], 'INTEGER PRIMARY KEY AUTOINCREMENT',$sql);
 $sql=preg_replace('/,\\s*INDEX [^\\n]+/','',$sql);$sql=preg_replace('/UNIQUE KEY [a-z_]+/','UNIQUE',$sql);
 $sql=preg_replace('/\\) ENGINE=.*$/s',')',$sql);}$pdo->exec($sql);
}
$pdo->exec("CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT);
CREATE TABLE posts(id INTEGER PRIMARY KEY,title TEXT,author TEXT,author_id INT,status TEXT,scheduled_at TEXT,published_at TEXT,created_at TEXT);
CREATE TABLE pages(id INTEGER PRIMARY KEY,title TEXT,author TEXT,author_id INT,status TEXT,published_at TEXT,created_at TEXT);
INSERT INTO users VALUES(1,'Owner'),(8,'Moderator'),(9,'Other writer');
INSERT INTO posts VALUES(1,'Published & safe','',9,'published',NULL,'2026-10-24 10:00:00','2026-10-01 09:00:00'),
(2,'Scheduled post','',8,'scheduled','2026-10-28 12:00:00',NULL,'2026-10-02 09:00:00'),
(3,'Private draft','',9,'draft',NULL,NULL,'2026-10-24 10:00:00'),
(4,'Legacy null post','',NULL,NULL,NULL,NULL,'2026-10-24 13:00:00'),
(5,'Archived post','',9,'archived',NULL,'2026-10-24 10:00:00','2026-10-01 09:00:00');
INSERT INTO pages VALUES(1,'Published page','',8,'published','2026-10-25 10:00:00','2026-10-03 09:00:00'),
(2,'Draft page','',8,'draft',NULL,'2026-10-24 09:00:00');");`;
    const initialized = spawnSync(php, ['-r', initialize], { encoding: 'utf8' });
    if (initialized.status !== 0) {
      cleanup();
      throw new Error(initialized.stderr);
    }
    const request = (method = 'GET', query = {}, body = null, options = {}) => {
      const result = spawnSync(php, [path.join(directory, 'api/calendar.php')], {
        encoding: 'utf8',
        env: {
          ...process.env,
          VON_CALENDAR_FIXTURE: JSON.stringify({
            method,
            query,
            body,
            role: 'Admin',
            csrf: 'fixture-token',
            ...options,
          }),
        },
        timeout: 15000,
      });
      assert.equal(result.status, 0, result.stderr);
      const [raw, status] = result.stdout.split('\nFIXTURE_STATUS:');
      assert(status, 'Fixture must report actual PHP response status: ' + result.stdout);
      return { status: Number(status), body: JSON.parse(raw) };
    };
    const snapshot = () => {
      const result = spawnSync(
        php,
        [
          '-r',
          `require ${JSON.stringify(path.join(directory, 'von_config.php').replaceAll('\\', '/'))};$p=$pdo;$r=[];foreach(['posts','pages','calendar_events','calendar_event_audit'] as $t)$r[$t]=$p->query('SELECT * FROM '.$t.' ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);echo json_encode($r);`,
        ],
        { encoding: 'utf8' }
      );
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    return {
      directory,
      php,
      useMysql,
      request,
      snapshot,
      seedHistoricalEvent() {
        const code = `require ${JSON.stringify(path.join(directory, 'von_config.php').replaceAll('\\', '/'))};
$s=$pdo->prepare('INSERT INTO calendar_events (title,notes,starts_at,ends_at,all_day,created_by,request_key,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)');
$s->execute(['Historical fixture','Existing notes','1987-09-15 09:00:00','1987-09-15 10:00:00',0,8,'98745678-1234-1234-1234-123456789abc','1987-09-15 00:00:00','1987-09-15 00:00:00']);echo $pdo->lastInsertId();`;
        const result = spawnSync(php, ['-r', code], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      },
      seedPaginationEvents(count) {
        assert(Number.isInteger(count) && count > 0 && count <= 250);
        const code = `require ${JSON.stringify(path.join(directory, 'von_config.php').replaceAll('\\', '/'))};
$pdo->beginTransaction();
$start=new DateTimeImmutable('today',new DateTimeZone('Asia/Kuala_Lumpur'));$end=$start->modify('+1 day');
$s=$pdo->prepare('INSERT INTO calendar_events (title,notes,starts_at,ends_at,all_day,created_by,request_key,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)');
for($i=0;$i<${count};$i++)$s->execute(['Pagination fixture '.$i,'',$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s'),1,8,sprintf('00000000-0000-4000-8000-%012d',$i),$start->format('Y-m-d H:i:s'),$start->format('Y-m-d H:i:s')]);
$pdo->commit();`;
        const result = spawnSync(php, ['-r', code], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      },
      async parallel(method, bodies) {
        return Promise.all(
          bodies.map(
            (body) =>
              new Promise((resolve, reject) => {
                const child = spawn(php, [path.join(directory, 'api/calendar.php')], {
                  windowsHide: true,
                  env: {
                    ...process.env,
                    VON_CALENDAR_FIXTURE: JSON.stringify({
                      method,
                      body,
                      query: {},
                      role: 'Admin',
                      csrf: 'fixture-token',
                    }),
                  },
                });
                let stdout = '',
                  stderr = '';
                const timer = setTimeout(() => child.kill(), 15000);
                child.stdout.on('data', (chunk) => {
                  stdout += chunk;
                });
                child.stderr.on('data', (chunk) => {
                  stderr += chunk;
                });
                child.once('error', reject);
                child.once('exit', (code) => {
                  clearTimeout(timer);
                  if (code !== 0) {
                    reject(new Error(stderr || 'Calendar worker failed'));
                    return;
                  }
                  try {
                    const [raw, status] = stdout.split('\nFIXTURE_STATUS:');
                    resolve({ status: Number(status), body: JSON.parse(raw) });
                  } catch (error) {
                    reject(error);
                  }
                });
              })
          )
        );
      },
      schemaProof() {
        const code = `require ${JSON.stringify(path.join(directory, 'von_config.php').replaceAll('\\', '/'))};require ${JSON.stringify(path.join(directory, 'api/schema_repair_helper.php').replaceAll('\\', '/'))};
foreach(['calendar_events','calendar_event_audit'] as $cap)if(!voncms_schema_has_capability($pdo,$cap))throw new RuntimeException('Calendar capability mismatch: '.json_encode(voncms_schema_missing_capability($pdo,$cap)));
$pdo->exec('DROP INDEX idx_calendar_window ON calendar_events');
if(voncms_schema_has_capability($pdo,'calendar_events'))throw new RuntimeException('Missing index not detected');
voncms_schema_repair_indexes($pdo,['calendar_events'=>voncms_schema_runtime_index_specs()['calendar_events']]);
if(!voncms_schema_has_capability($pdo,'calendar_events'))throw new RuntimeException('Index repair failed');echo 'ok';`;
        const result = spawnSync(php, ['-r', code], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout === 'ok';
      },
      close: cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function run() {
  const fixture = createCalendarFixture();
  let checks = 0;
  const check = (condition, message) => {
    assert(condition, message);
    checks++;
  };
  try {
    const query = { from: '2026-10-01', to: '2026-11-01' };
    const before = fixture.snapshot();
    for (const role of ['Guest', 'Writer', 'Member', 'invalid'])
      check(
        [401, 403].includes(fixture.request('GET', query, null, { role }).status),
        'Deny ' + role
      );
    for (const role of ['root', 'Admin', 'Moderator'])
      check(fixture.request('GET', query, null, { role }).status === 200, 'Allow ' + role);
    for (const method of ['POST', 'DELETE'])
      check(fixture.request(method, {}, {}, { csrf: '' }).status === 403, 'CSRF ' + method);
    check(fixture.request('PUT').status === 405, 'Unsupported method');
    const original = fixture.request('GET', query).body;
    const today = original.today;
    const shift = (day, amount) => {
      const date = new Date(day + 'T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + amount);
      return date.toISOString().slice(0, 10);
    };
    const eventQuery = { from: today, to: shift(today, 2) };
    check(original.items.length === 4, 'Published/scheduled and legacy content only');
    check(
      original.items.find((x) => x.title === 'Published & safe').starts_at ===
        '2026-10-24 10:00:00',
      'First-publication timestamp, not creation'
    );
    check(
      original.items.some((x) => x.status === 'scheduled'),
      'Scheduled labels'
    );
    check(
      original.items.every((x) => !('content' in x) && !('password' in x)),
      'Lean projection'
    );
    check(
      fixture.request('GET', { ...query, type: 'post', author: '9' }).body.items.length === 1,
      'Content author filter'
    );
    check(
      fixture.request('GET', { ...query, type: 'page' }).body.items.length === 1,
      'Page filter'
    );
    check(
      fixture
        .request('GET', query, null, { legacy: true })
        .body.items.some((x) => x.starts_at === '2026-10-03 09:00:00'),
      'Legacy page date fallback'
    );
    for (const bad of [
      { from: '2026-02-30' },
      { from: '2026-10-01\0' },
      { to: '2027-10-01' },
      { from: [] },
      { author: [] },
      { type: 'x' },
      { page: 0 },
    ])
      check(
        fixture.request('GET', { ...query, ...bad }).status === 400,
        'Bad query ' + JSON.stringify(bad)
      );
    const event = {
      title: 'Review <img onerror=bad()> & café 😀',
      notes: 'Plain text <script>bad()</script>\nAgenda',
      allDay: false,
      start: today + 'T09:00',
      end: today + 'T10:00',
      requestKey: '12345678-1234-1234-1234-123456789abc',
    };
    const pastSnapshot = fixture.snapshot();
    for (const allDay of [false, true]) {
      const past = fixture.request(
        'POST',
        {},
        {
          ...event,
          allDay,
          start: allDay ? '1987-09-15' : '1987-09-15T09:00',
          end: allDay ? '1987-09-15' : '1987-09-15T10:00',
        }
      );
      check(past.status === 400, 'Reject a new past event, allDay=' + allDay);
      check(
        JSON.stringify(fixture.snapshot()) === JSON.stringify(pastSnapshot),
        'Past-event rejection leaves events and audit unchanged'
      );
    }
    const saved = fixture.request('POST', {}, event);
    check(saved.status === 200, 'Create event');
    check(fixture.request('POST', {}, event).body.id === saved.body.id, 'Idempotent retry');
    check(fixture.snapshot().calendar_event_audit.length === 1, 'One create audit only');
    const all = fixture.request('GET', eventQuery).body;
    check(all.items.find((x) => x.kind === 'event').notes === event.notes, 'Plain text preserved');
    const changed = { ...event, id: saved.body.id, version: 1, title: 'Updated review' };
    check(fixture.request('POST', {}, changed).status === 200, 'Update event');
    check(fixture.request('POST', {}, changed).status === 409, 'Reject stale update');
    check(
      fixture.request('DELETE', {}, { id: saved.body.id, version: 1 }).status === 409,
      'Reject stale delete'
    );
    const preFailure = fixture.snapshot();
    check(
      fixture.request(
        'POST',
        {},
        { ...changed, version: 2, title: 'Must roll back' },
        { auditFailure: true }
      ).status === 500,
      'Audit failure rejects save'
    );
    check(
      JSON.stringify(fixture.snapshot()) === JSON.stringify(preFailure),
      'Audit failure rolls back event and version'
    );
    check(
      fixture.request('DELETE', {}, { id: saved.body.id, version: 2 }, { auditFailure: true })
        .status === 500,
      'Audit failure rejects delete'
    );
    check(
      JSON.stringify(fixture.snapshot()) === JSON.stringify(preFailure),
      'Audit failure rolls back event deletion'
    );
    for (const bad of [
      { start: shift(today, 1) + 'T10:00' },
      { start: today + 'T09:00\0' },
      { title: [] },
      { allDay: 'yes' },
      { notes: 'x'.repeat(10001) },
      { title: '' },
    ])
      check(fixture.request('POST', {}, { ...event, ...bad }).status === 400, 'Bad event rejected');
    const allDay = {
      ...event,
      requestKey: '22345678-1234-1234-1234-123456789abc',
      allDay: true,
      start: today,
      end: today,
    };
    check(fixture.request('POST', {}, allDay).status === 200, 'All-day same-day event');
    check(
      fixture.request('GET', { from: shift(today, 1), to: shift(today, 2), type: 'event' }).body
        .items.length === 0,
      'Exclusive all-day end'
    );
    const future = {
      ...event,
      requestKey: '42345678-1234-1234-1234-123456789abc',
      start: shift(today, 1) + 'T09:00',
      end: shift(today, 1) + 'T10:00',
    };
    const futureSaved = fixture.request('POST', {}, future);
    check(futureSaved.status === 200, 'Future event allowed');
    const beforeBackdate = fixture.snapshot();
    check(
      fixture.request(
        'POST',
        {},
        {
          ...future,
          id: futureSaved.body.id,
          version: 1,
          start: '1987-09-15T09:00',
          end: '1987-09-15T10:00',
        }
      ).status === 400,
      'Cannot bypass create policy by backdating an update'
    );
    check(
      JSON.stringify(fixture.snapshot()) === JSON.stringify(beforeBackdate),
      'Rejected backdate leaves persisted event and audit unchanged'
    );
    const historicalId = fixture.seedHistoricalEvent();
    const historical = {
      title: 'Historical fixture',
      notes: 'Existing notes',
      allDay: false,
      start: '1987-09-15T09:00',
      end: '1987-09-15T10:00',
      requestKey: '98745678-1234-1234-1234-123456789abc',
    };
    check(
      fixture.request('POST', {}, historical).body.id === historicalId,
      'Existing historical creation retry remains idempotent'
    );
    check(
      fixture.request(
        'POST',
        {},
        { ...historical, id: historicalId, version: 1, notes: 'Corrected historical note' }
      ).status === 200,
      'Existing historical notes stay editable without changing the start'
    );
    check(
      fixture
        .request('GET', { from: '1987-09-01', to: '1987-10-01' })
        .body.items.some((row) => String(row.id) === historicalId && row.kind === 'event'),
      'Historical events remain readable'
    );
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Honolulu']) {
      const zonedToday = fixture.request('GET', query, null, { zone }).body.today;
      check(
        fixture.request(
          'POST',
          {},
          {
            ...event,
            requestKey: require('node:crypto').randomUUID(),
            start: shift(zonedToday, -1) + 'T09:00',
            end: shift(zonedToday, -1) + 'T10:00',
          },
          { zone }
        ).status === 400,
        'Past date follows configured timezone: ' + zone
      );
      check(
        fixture.request(
          'POST',
          {},
          {
            ...event,
            requestKey: require('node:crypto').randomUUID(),
            start: zonedToday + 'T09:00',
            end: zonedToday + 'T10:00',
          },
          { zone }
        ).status === 200,
        'Today follows configured timezone: ' + zone
      );
    }
    check(
      fixture.request(
        'POST',
        {},
        { ...event, start: '2026-03-08T02:30', end: '2026-03-08T04:00' },
        { zone: 'America/New_York' }
      ).status === 400,
      'Reject nonexistent DST wall time'
    );
    check(
      fixture.request('POST', {}, { action: 'delete', id: saved.body.id, version: 1 }).status ===
        409,
      'POST delete rejects stale versions'
    );
    check(
      fixture.request('POST', {}, { action: 'delete', id: saved.body.id, version: 2 }, { csrf: '' })
        .status === 403,
      'POST delete requires CSRF'
    );
    check(
      fixture.request('POST', {}, { action: 'delete', id: saved.body.id, version: 2 }).status ===
        200,
      'POST delete event fallback'
    );
    const after = fixture.snapshot();
    check(
      after.calendar_event_audit.some((x) => x.action === 'delete'),
      'Deletion retains audit'
    );
    check(
      fixture.request('POST', {}, event).status === 409,
      'A delayed create retry cannot resurrect a recently deleted event'
    );
    check(
      JSON.stringify(before.posts) === JSON.stringify(after.posts) &&
        JSON.stringify(before.pages) === JSON.stringify(after.pages),
      'No publication/content changes'
    );
    if (fixture.useMysql) {
      check(
        fixture.schemaProof(),
        'Real MySQL capability/index detection and explicit index repair'
      );
      const race = {
        ...event,
        requestKey: '32345678-1234-1234-1234-123456789abc',
        title: 'Concurrent create',
      };
      const created = await fixture.parallel('POST', [race, race]);
      check(
        created.every((result) => [200, 409].includes(result.status)),
        'Concurrent create responses are success/conflict, not duplicate records'
      );
      const matches = fixture
        .snapshot()
        .calendar_events.filter((row) => row.request_key === race.requestKey);
      check(matches.length === 1, 'Exactly one concurrent event');
      const id = String(matches[0].id);
      const updated = await fixture.parallel('POST', [
        { ...race, id, version: 1, title: 'Winner A' },
        { ...race, id, version: 1, title: 'Winner B' },
      ]);
      check(
        updated
          .map((result) => result.status)
          .sort()
          .join(',') === '200,409',
        'One concurrent update wins, one conflicts'
      );
      const removed = await fixture.parallel('DELETE', [
        { id, version: 2 },
        { id, version: 2 },
      ]);
      check(
        removed
          .map((result) => result.status)
          .sort()
          .join(',') === '200,409',
        'One concurrent delete wins, one conflicts'
      );
      const audits = fixture
        .snapshot()
        .calendar_event_audit.filter((row) => String(row.event_id) === id);
      check(audits.length === 3, 'Exactly one audit per winning mutation');
    }
    console.log(
      `PASS Calendar endpoint/service fixture: ${checks} checks; ${fixture.useMysql ? 'MySQL schema/index repair and concurrent writes' : 'SQLite persistence/rollback'}, real capability map, stubbed session/CSRF transport. No installed data touched.`
    );
  } finally {
    fixture.close();
  }
}
module.exports = { createCalendarFixture };
if (require.main === module) {
  run().catch((error) => {
    console.error(error.stack);
    process.exitCode = error.message.startsWith('NOT_RUN') ? 2 : 1;
  });
}
