#!/usr/bin/env node
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const {
  assertSafeExtractedTree,
  assertSafeZipEntries,
  createSecureExtractionDirectory,
} = require('./theme-archive-security.cjs');

const rootDir = path.resolve(__dirname, '..');
const phpBinary = process.argv[2] || 'php';
const phpPath = (relativePath) => path.join(rootDir, relativePath).replace(/\\/g, '/');

function runPhp(code) {
  const result = spawnSync(phpBinary, ['-r', code], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'PHP probe failed').trim());
  }
  return result.stdout.trim();
}

function testAccountActionUrls() {
  const output = runPhp(`
require ${JSON.stringify(phpPath('public/api/mail_helper.php'))};
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT)');
$insert = $pdo->prepare('INSERT INTO settings VALUES (?, ?, ?)');
$insert->execute(['general', 'domain_url', 'https://example.test/newsroom']);
$_SERVER['HTTP_HOST'] = 'attacker.invalid';
$_SERVER['SCRIPT_NAME'] = '/zangetsu/api/reset_password.php';
$configured = voncms_resolve_trusted_public_base_url($pdo);
$action = voncms_build_account_action_url($configured, '/login', ['reset_token' => 'a&b']);
$pdo->exec('DELETE FROM settings');
putenv('VONCMS_ENV=development');
$_SERVER['HTTP_HOST'] = 'localhost:8080';
$loopback = voncms_resolve_trusted_public_base_url($pdo);
$_SERVER['HTTP_HOST'] = '[::1]:8080';
$ipv6 = voncms_resolve_trusted_public_base_url($pdo);
$_SERVER['HTTP_HOST'] = 'localhost.evil';
$lookalike = voncms_resolve_trusted_public_base_url($pdo);
putenv('VONCMS_ENV=production');
$_SERVER['HTTP_HOST'] = 'localhost:8080';
$productionLoopback = voncms_resolve_trusted_public_base_url($pdo);
$invalid = array_map('voncms_normalize_trusted_public_base_url', [
  'https://user:pass@example.test',
  'https://example.test/?next=evil',
  'javascript://example.test',
]);
echo json_encode(compact('configured', 'action', 'loopback', 'ipv6', 'lookalike', 'productionLoopback', 'invalid'));
`);
  const result = JSON.parse(output);
  assert.equal(result.configured, 'https://example.test/newsroom');
  assert.equal(result.action, 'https://example.test/newsroom/login?reset_token=a%26b');
  assert.equal(result.loopback, 'http://localhost:8080/zangetsu');
  assert.equal(result.ipv6, 'http://[::1]:8080/zangetsu');
  assert.equal(result.lookalike, '');
  assert.equal(result.productionLoopback, '');
  assert.deepEqual(result.invalid, ['', '', '']);
}

function testRegistrationStopsBeforePersistence() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-register-origin-'));
  const apiDir = path.join(fixtureRoot, 'api');
  const databasePath = path.join(fixtureRoot, 'registration.sqlite').replace(/\\/g, '/');
  try {
    fs.mkdirSync(apiDir);
    fs.copyFileSync(
      path.join(rootDir, 'public/api/register.php'),
      path.join(apiDir, 'register.php')
    );
    fs.copyFileSync(
      path.join(rootDir, 'public/api/mail_helper.php'),
      path.join(apiDir, 'mail_helper.php')
    );
    fs.writeFileSync(path.join(apiDir, 'schema_repair_helper.php'), '<?php');
    fs.writeFileSync(
      path.join(fixtureRoot, 'security.php'),
      `<?php
function sendApiHeaders(string $methods): void {}
class CSRFProtection {
  public static function requireToken(): void {}
  public static function getRequestBody(): string { return (string) getenv('VON_REGISTER_BODY'); }
}
class RateLimiter { public static function requireAttempt($identifier = null): void {} }
class ResponseHelper {
  public static function sendError($message, int $status = 400): never {
    if ($message instanceof Throwable) $message = $message->getMessage();
    echo json_encode(['success' => false, 'message' => (string) $message, 'status' => $status]);
    exit(0);
  }
}
`
    );
    fs.writeFileSync(
      path.join(fixtureRoot, 'von_config.php'),
      `<?php
$pdo = new PDO('sqlite:' . getenv('VON_REGISTER_DB'));
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
`
    );
    runPhp(`
$pdo = new PDO('sqlite:${databasePath}');
$pdo->exec('CREATE TABLE settings (setting_group TEXT, setting_key TEXT, setting_value TEXT)');
$pdo->exec("INSERT INTO settings VALUES ('general', 'registration_enabled', 'true')");
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT)');
`);
    const result = spawnSync(
      phpBinary,
      [
        '-r',
        `$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
putenv('VONCMS_ENV=production');
$_SERVER['HTTP_HOST'] = 'localhost:8080';
$_SERVER['SCRIPT_NAME'] = '/api/register.php';
require ${JSON.stringify(path.join(apiDir, 'register.php').replace(/\\/g, '/'))};`,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          VON_REGISTER_DB: databasePath,
          VON_REGISTER_BODY: JSON.stringify({
            username: 'safe_user',
            email: 'safe@example.test',
            password: 'Strong1!Password',
            confirmPassword: 'Strong1!Password',
            hp_field: '',
          }),
        },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.equal(response.success, false);
    assert.equal(response.status, 503);
    assert.match(response.message, /temporarily unavailable/i);
    assert.equal(
      runPhp(
        `$pdo = new PDO('sqlite:${databasePath}'); echo $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();`
      ),
      '0'
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function testIframeBoundary() {
  const output = runPhp(`
require ${JSON.stringify(phpPath('public/api/content_embed_helper.php'))};
$allowed = [
  'https://www.youtube.com/embed/abc?start=7',
  'https://www.youtube-nocookie.com/embed/abc',
  'https://player.vimeo.com/video/123',
  'https://www.facebook.com/plugins/video.php?href=x',
  'https://www.tiktok.com/player/v1/123',
  'https://www.instagram.com/reel/abc/embed',
];
$blocked = [
  'https://attacker.invalid/embed/abc',
  'https://youtube.com.attacker.invalid/embed/abc',
  'https://user:pass@youtube.com/embed/abc',
  'https://youtube.com:444/embed/abc',
  '//youtube.com/embed/abc',
  'javascript:alert(1)',
];
$html = '<p>before</p><iframe src="https://www.youtube.com/embed/abc?start=7" onload="alert(1)" allow="autoplay; camera; fullscreen" style="width:100%;position:fixed;border:0" sandbox="allow-scripts"></iframe><iframe src="https://attacker.invalid/embed/x"></iframe><p>after</p>';
$sanitized = voncms_sanitize_content_iframes($html);
$malformed = voncms_sanitize_content_iframes('<div>before</div></div><iframe src="https://www.youtube.com/embed/abc"></iframe><p>after</p>');
echo json_encode([
  'allowed' => array_map('voncms_is_allowed_iframe_src', $allowed),
  'blocked' => array_map('voncms_is_allowed_iframe_src', $blocked),
  'sanitized' => $sanitized,
  'malformed' => $malformed,
]);
`);
  const result = JSON.parse(output);
  assert(result.allowed.every(Boolean));
  assert(result.blocked.every((value) => value === false));
  assert.match(result.sanitized, /youtube\.com\/embed\/abc\?start=7/);
  assert.match(result.sanitized, /allow="autoplay; fullscreen"/);
  assert.match(result.sanitized, /allowfullscreen/);
  assert.match(result.sanitized, /<p>before<\/p>/);
  assert.match(result.sanitized, /<p>after<\/p>/);
  assert.doesNotMatch(result.sanitized, /attacker\.invalid|onload|camera|position|sandbox/);
  assert.match(result.malformed, /<p>after<\/p>/);
  assert.match(result.malformed, /youtube\.com/);

  const direct = spawnSync(phpBinary, [phpPath('public/api/content_embed_helper.php')], {
    encoding: 'utf8',
  });
  assert.equal(direct.status, 0);
  assert.equal(direct.stdout.trim(), 'Forbidden');
}

function testThemeArchiveBoundary() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-theme-archive-'));
  try {
    const parentDir = path.join(fixtureRoot, 'themes');
    fs.mkdirSync(parentDir);
    const zipPath = path.join(fixtureRoot, 'valid.zip');
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from('{"name":"Safe"}', 'utf8'));
    zip.addFile('assets/theme.css', Buffer.from('body{}', 'utf8'));
    zip.writeZip(zipPath);

    const stagingDir = createSecureExtractionDirectory(parentDir);
    const archive = new AdmZip(zipPath);
    assertSafeZipEntries(archive, stagingDir);
    archive.extractAllTo(stagingDir, false);
    assertSafeExtractedTree(stagingDir);
    assert.equal(fs.readFileSync(path.join(stagingDir, 'theme.json'), 'utf8'), '{"name":"Safe"}');

    const freshDir = createSecureExtractionDirectory(parentDir);
    const forged = new AdmZip();
    forged.addFile('expanded.txt', Buffer.alloc(1024 * 1024, 65));
    const forgedBytes = forged.toBuffer();
    const central = forgedBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    assert(central >= 0);
    forgedBytes.writeUInt32LE(0, central + 24);
    assert.throws(() => assertSafeZipEntries(new AdmZip(forgedBytes), freshDir));
    assert.throws(
      () =>
        assertSafeZipEntries(
          {
            getEntries: () => [
              {
                entryName: 'a/../theme.css',
                isDirectory: false,
                header: { size: 1, method: 0 },
                getCompressedData: () => Buffer.from('a'),
              },
              { entryName: 'theme.css', isDirectory: false, header: { size: 1 } },
            ],
          },
          freshDir
        ),
      /Duplicate/
    );
    assert.throws(
      () =>
        assertSafeZipEntries(
          {
            getEntries: () => [
              { entryName: '../../outside.txt', isDirectory: false, header: { size: 1 } },
            ],
          },
          freshDir
        ),
      /escapes/
    );
    assert.throws(
      () =>
        assertSafeZipEntries(
          {
            getEntries: () => [
              {
                entryName: 'linked',
                isDirectory: false,
                attr: (0xa000 | 0o777) << 16,
                header: { size: 1 },
              },
            ],
          },
          freshDir
        ),
      /Unsafe/
    );
    assert.throws(
      () =>
        assertSafeZipEntries(
          {
            getEntries: () => [
              { entryName: 'large.bin', isDirectory: false, header: { size: 65 * 1024 * 1024 } },
            ],
          },
          freshDir
        ),
      /size limit/
    );
    fs.writeFileSync(path.join(freshDir, 'existing.txt'), 'sentinel');
    assert.throws(() => assertSafeZipEntries(archive, freshDir), /must be empty/);

    const outsideSentinel = path.join(fixtureRoot, 'outside.txt');
    fs.writeFileSync(outsideSentinel, 'unchanged');
    assert.equal(fs.readFileSync(outsideSentinel, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

testAccountActionUrls();
testRegistrationStopsBeforePersistence();
testIframeBoundary();
testThemeArchiveBoundary();
console.log('Security boundary smoke passed.');
