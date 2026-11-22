// Actual SMTP sender against an owned TLS sink; no real recipients, credentials or provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const php = process.env.PHP_BIN;
assert.ok(php, 'Set PHP_BIN');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-smtp-'));
const phpQuote = (value) => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
let server;
const sockets = new Set();
async function main() {
  try {
    fs.writeFileSync(
      path.join(temp, 'openssl.cnf'),
      '[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=localhost\n[v3_req]\nsubjectAltName=@san\nbasicConstraints=CA:TRUE\nkeyUsage=digitalSignature,keyEncipherment,keyCertSign\n[san]\nDNS.1=localhost\nIP.1=127.0.0.1\n'
    );
    const certScript = path.join(temp, 'cert.php');
    fs.writeFileSync(
      certScript,
      `<?php
$options=['config'=>${phpQuote(path.join(temp, 'openssl.cnf'))},'digest_alg'=>'sha256','x509_extensions'=>'v3_req','private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA];
$key=openssl_pkey_new($options);
$csr=openssl_csr_new(['commonName'=>'localhost'],$key,$options);
$cert=openssl_csr_sign($csr,null,$key,1,$options);
if(!$cert)throw new RuntimeException('QA certificate generation failed');
openssl_x509_export_to_file($cert,${phpQuote(path.join(temp, 'cert.pem'))});
openssl_pkey_export_to_file($key,${phpQuote(path.join(temp, 'key.pem'))},null,$options);
`
    );
    const cert = spawnSync(php, [certScript], { encoding: 'utf8' });
    assert.equal(cert.status, 0, cert.stderr + cert.stdout);
    const captured = { commands: [], users: [], passwords: [], messages: [] };
    server = tls.createServer(
      {
        key: fs.readFileSync(path.join(temp, 'key.pem')),
        cert: fs.readFileSync(path.join(temp, 'cert.pem')),
      },
      (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => {});
        socket.setEncoding('utf8');
        socket.write('220 localhost QA SMTP\r\n');
        let buffer = '',
          auth = 0,
          data = false,
          message = '';
        socket.on('data', (chunk) => {
          buffer += chunk;
          while (buffer.includes('\r\n')) {
            const end = buffer.indexOf('\r\n');
            const line = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (data) {
              if (line === '.') {
                captured.messages.push(message);
                data = false;
                message = '';
                socket.write('250 accepted\r\n');
              } else message += line + '\r\n';
            } else if (auth === 1) {
              captured.users.push(Buffer.from(line, 'base64').toString());
              auth = 2;
              socket.write('334 UGFzc3dvcmQ6\r\n');
            } else if (auth === 2) {
              captured.passwords.push(Buffer.from(line, 'base64').toString());
              auth = 0;
              socket.write('235 authenticated\r\n');
            } else {
              captured.commands.push(line);
              if (line.startsWith('EHLO ')) socket.write('250-localhost\r\n250 AUTH LOGIN\r\n');
              else if (line === 'AUTH LOGIN') {
                auth = 1;
                socket.write('334 VXNlcm5hbWU6\r\n');
              } else if (line === 'DATA') {
                data = true;
                socket.write('354 send message\r\n');
              } else if (line === 'QUIT') {
                socket.end('221 goodbye\r\n');
              } else socket.write('250 ok\r\n');
            }
          }
        });
      }
    );
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    for (const dir of ['api', 'core', 'data']) fs.mkdirSync(path.join(temp, dir));
    fs.copyFileSync(
      path.join(root, 'public/api/mail_helper.php'),
      path.join(temp, 'api/mail_helper.php')
    );
    fs.copyFileSync(
      path.join(root, 'public/core/DataBoundary.php'),
      path.join(temp, 'core/DataBoundary.php')
    );
    const worker = path.join(temp, 'send.php');
    fs.writeFileSync(
      path.join(temp, 'von_config.php'),
      `<?php
class QaSmtpStatement extends PDOStatement {public function rowCount():int{return str_contains($this->queryString,'sqlite_master')?1:parent::rowCount();}}
class QaSmtpPDO extends PDO {
 public function query(string $sql,?int $mode=null,mixed ...$args):PDOStatement|false {
  if($sql==="SHOW TABLES LIKE 'settings'")$sql="SELECT name FROM sqlite_master WHERE name='settings'";
  return parent::query($sql,$mode,...$args);
 }
}
if(getenv('QA_SMTP_DB_FAIL'))throw new PDOException('Controlled QA database outage');
$pdo=new QaSmtpPDO('sqlite::memory:',null,null,[PDO::ATTR_STATEMENT_CLASS=>[QaSmtpStatement::class]]);
$pdo->exec('CREATE TABLE settings(setting_group TEXT,setting_key TEXT,setting_value TEXT)');
foreach(json_decode(getenv('QA_SMTP_SETTINGS'),true) as $key=>$value)$pdo->prepare('INSERT INTO settings VALUES(?,?,?)')->execute([$key==='domainUrl'?'general':'smtp',$key==='domainUrl'?'domain_url':$key,$value]);
`
    );
    fs.writeFileSync(
      worker,
      `<?php
$_SERVER['HTTP_HOST']='forged.example:9999';
require __DIR__.'/api/mail_helper.php';
echo json_encode(vonSendMail('receiver@example.test','QA subject','<p>QA message</p>'));
`
    );
    for (const user of ['apikey', 'AKIA_QA_ACCESS_KEY', 'mailer@example.test']) {
      const settings = {
        smtpHost: 'localhost',
        smtpPort: server.address().port,
        smtpUser: user,
        smtpPass: 'dummy-only',
        smtpEncryption: 'ssl',
        smtpFromEmail: user.includes('@') ? '' : 'sender@example.test',
        domainUrl: 'https://news.example.test:8443/sub',
      };
      fs.writeFileSync(
        path.join(temp, 'data/site_settings.json'),
        JSON.stringify({ ...settings, smtpPass: 'poisoned-mirror-password' })
      );
      const result = await new Promise((resolve, reject) => {
        const child = spawn(php, ['-d', 'openssl.cafile=' + path.join(temp, 'cert.pem'), worker], {
          windowsHide: true,
          env: { ...process.env, QA_SMTP_SETTINGS: JSON.stringify(settings) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '',
          stderr = '';
        child.stdout.on('data', (data) => (stdout += data));
        child.stderr.on('data', (data) => (stderr += data));
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('QA SMTP timeout'));
        }, 15000);
        child.on('error', reject);
        child.on('exit', (code) => {
          clearTimeout(timer);
          resolve({ code, stdout, stderr });
        });
      });
      assert.equal(result.code, 0, result.stderr + result.stdout);
      assert.equal(JSON.parse(result.stdout).success, true, result.stderr + result.stdout);
    }
    assert.deepEqual(captured.users, ['apikey', 'AKIA_QA_ACCESS_KEY', 'mailer@example.test']);
    assert.deepEqual(
      captured.passwords,
      ['dummy-only', 'dummy-only', 'dummy-only'],
      'A stale JSON mirror supplied the SMTP password'
    );
    const outage = spawnSync(php, [worker], {
      encoding: 'utf8',
      env: { ...process.env, QA_SMTP_DB_FAIL: '1' },
    });
    assert.equal(outage.status, 0, outage.stderr + outage.stdout);
    const outageReply = JSON.parse(outage.stdout);
    assert.equal(
      outageReply.success,
      false,
      'DB outage silently reused a legacy credential or PHP mail'
    );
    assert.equal(outageReply.method, 'smtp');
    assert.ok(!outage.stdout.includes('poisoned-mirror-password'));
    assert.equal(captured.messages.length, 3);
    assert.equal(captured.commands.filter((line) => line === 'EHLO news.example.test').length, 3);
    assert.equal(
      captured.commands.filter((line) => line === 'MAIL FROM:<sender@example.test>').length,
      2
    );
    assert.ok(captured.commands.includes('MAIL FROM:<mailer@example.test>'));
    for (const message of captured.messages) {
      assert.match(message, /^Date: .+ [+-]\d{4}\r$/m);
      assert.match(message, /^Message-ID: <[a-f0-9]{32}@example\.test>\r$/m);
    }
    for (const socket of sockets) socket.destroy();
    console.log(
      'PASS SMTP S4: 3 real TLS/SMTP deliveries to owned sink; provider usernames/email-user compatibility, explicit From/envelope, Date/Message-ID and configured-host EHLO. No real provider delivery claimed.'
    );
  } finally {
    for (const socket of sockets) socket.destroy();
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
