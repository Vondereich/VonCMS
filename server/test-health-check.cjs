const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const {
  parseArgs,
  summarize,
  commandCheck,
  seoEvidence,
  integrationEvidence,
  typecheckEntry,
  versionCheck,
  distCheck,
  snapshot,
} = require('./health-check.cjs');

test('strict flags do not accept a build, repair, website or MySQL operation', () => {
  assert.deepEqual(parseArgs(['--full', '--json']), { full: true, json: true, help: false });
  for (const flag of ['--build', '--repair', '--url', '--mysql', ';echo']) {
    assert.throws(() => parseArgs([flag]), /Unknown option/);
  }
});

test('fail outranks incomplete; a skipped check can never produce PASS_SCOPED', () => {
  assert.equal(summarize([]), 'INCOMPLETE');
  assert.equal(summarize([{ status: 'UNKNOWN' }]), 'INCOMPLETE');
  assert.equal(summarize([{ status: 'PASS' }]), 'PASS_SCOPED');
  assert.equal(summarize([{ status: 'PASS' }, { status: 'NOT_RUN' }]), 'INCOMPLETE');
  assert.equal(summarize([{ status: 'NOT_RUN' }, { status: 'FAIL' }]), 'FAIL');
});

const completed = { status: 0, stdout: 'completed', stderr: '' };
function fakeCommand(
  overrides = {},
  verify = (stdout) => stdout === 'completed' && 'expected marker'
) {
  return commandCheck('fixture', 'unused', [], verify, {
    spawn: () => ({ ...completed, ...overrides }),
  });
}
test('only actual successful completion with expected evidence passes', () => {
  assert.equal(fakeCommand().status, 'PASS');
  assert.equal(fakeCommand({ status: 1 }).status, 'FAIL');
  assert.equal(fakeCommand({ stdout: '' }).status, 'FAIL');
  assert.equal(fakeCommand({ stdout: 'FAIL hidden failure' }).status, 'FAIL');
  assert.equal(fakeCommand({ stdout: 'WARN skipped\nFAIL hidden failure' }).status, 'FAIL');
  assert.equal(fakeCommand({ stdout: 'PHP Warning: fixture\ncompleted' }).status, 'FAIL');
  assert.equal(fakeCommand({ stderr: 'PHP Warning: fixture' }).status, 'FAIL');
  assert.equal(fakeCommand({ stdout: 'WARN coverage skipped' }).status, 'NOT_RUN');
  assert.equal(
    fakeCommand({ stdout: 'PHP Lint: no PHP files found under public/.' }).status,
    'NOT_RUN'
  );
  assert.equal(fakeCommand({ error: { code: 'ENOENT' }, status: null }).status, 'NOT_RUN');
  assert.equal(fakeCommand({ error: { code: 'ETIMEDOUT' }, status: null }).status, 'NOT_RUN');
  assert.equal(fakeCommand({ signal: 'SIGTERM', status: null }).status, 'NOT_RUN');
});

test('child errors do not dump environment credentials or raw fixture output', () => {
  assert.doesNotMatch(
    JSON.stringify(fakeCommand({ stderr: 'password=secret', status: 1 })),
    /secret/
  );
  let invoked;
  commandCheck('fixture', 'binary with spaces', ['argument with spaces'], () => 'ok', {
    spawn: (command, args, options) => {
      invoked = { command, args, options };
      return completed;
    },
  });
  assert.equal(invoked.options.shell, false);
  assert.equal(invoked.command, 'binary with spaces');
  assert.deepEqual(invoked.args, ['argument with spaces']);
  assert.ok(invoked.options.timeout > 0);
});

test('SEO count alone cannot conceal failed, empty or inconsistent rows', () => {
  const good = { passed: 1, failed: 0, results: [{ ok: true }] };
  assert.match(seoEvidence(JSON.stringify(good)), /^1 controlled/);
  for (const bad of [
    { ...good, failed: 1 },
    { ...good, passed: 0 },
    { ...good, passed: 2 },
    { ...good, results: [{ ok: false }] },
    { ...good, results: [] },
    { ...good, results: null },
  ])
    assert.equal(seoEvidence(JSON.stringify(bad)), null);
  assert.throws(() => seoEvidence('not JSON'));
});

test('integration requires its final success marker, not just a PASS line', () => {
  assert.equal(integrationEvidence('PASS one case'), null);
  assert.equal(integrationEvidence('Integration Smoke Gate: PASS'), null);
  assert.equal(
    integrationEvidence('PASS one\nIntegration Smoke Gate: PASS WITH WARNINGS (1)'),
    null
  );
  assert.match(integrationEvidence('PASS one\nIntegration Smoke Gate: PASS\n'), /^1 mixed/);
});

test('typecheck resolves the project tsc alias instead of assuming the tsc6 package', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-health-compiler-'));
  try {
    const write = (file, value) => {
      fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
      fs.writeFileSync(path.join(fixture, file), value);
    };
    write('package.json', JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }));
    write('node_modules/typescript/package.json', JSON.stringify({ bin: { tsc6: './bin/tsc6' } }));
    write('node_modules/typescript/bin/tsc6', '// not the selected compiler');
    assert.equal(typecheckEntry(fixture), null);
    write(
      'node_modules/@typescript/native/package.json',
      JSON.stringify({ bin: { tsc: './bin/tsc' } })
    );
    write('node_modules/@typescript/native/bin/tsc', '// selected compiler');
    assert.equal(
      typecheckEntry(fixture),
      path.join('node_modules', '@typescript/native', 'bin/tsc')
    );
    write('package.json', JSON.stringify({ scripts: { typecheck: 'custom-compiler' } }));
    assert.equal(typecheckEntry(fixture), null);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('version drift and stale build input are detected without modifying inputs', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-health-'));
  try {
    for (const directory of ['public', 'dist']) fs.mkdirSync(path.join(fixture, directory));
    const write = (file, value) => fs.writeFileSync(path.join(fixture, file), value);
    write('package.json', JSON.stringify({ version: '1.27.11' }));
    write(
      'package-lock.json',
      JSON.stringify({ version: '1.27.11', packages: { '': { version: '1.27.11' } } })
    );
    write('metadata.json', JSON.stringify({ version: '1.27.11' }));
    write('CHANGELOG.md', '### [v1.27.11] - 2026-10-19');
    assert.equal(versionCheck(fixture).status, 'PASS');
    write('metadata.json', JSON.stringify({ version: '1.27.10' }));
    assert.equal(versionCheck(fixture).status, 'FAIL');
    write('metadata.json', '{bad JSON');
    assert.equal(versionCheck(fixture).status, 'FAIL');
    assert.equal(distCheck(fixture).status, 'NOT_RUN');
    for (const file of [
      'index.php',
      'seo_route_helper.php',
      'seo_response_helper.php',
      'seo_schema_helper.php',
    ]) {
      write('public/' + file, '<?php // current');
      write('dist/' + file, '<?php // current');
    }
    assert.equal(distCheck(fixture).status, 'PASS');
    write('public/seo_route_helper.php', '<?php // updated');
    assert.equal(distCheck(fixture).status, 'NOT_RUN');
    assert.equal(
      fs.readFileSync(path.join(fixture, 'dist/seo_route_helper.php'), 'utf8'),
      '<?php // current'
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('snapshot includes dirty, untracked and deleted files, not only HEAD', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'voncms-health-snapshot-'));
  const git = (args) => {
    const run = spawnSync('git', args, { cwd: fixture, encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, run.stderr);
  };
  try {
    git(['init', '-q']);
    const file = path.join(fixture, 'tracked.txt');
    fs.writeFileSync(file, 'original');
    git(['add', 'tracked.txt']);
    const first = snapshot(fixture);
    fs.writeFileSync(file, 'dirty');
    const dirty = snapshot(fixture);
    assert.notEqual(first.sha256, dirty.sha256);
    fs.writeFileSync(path.join(fixture, 'new.txt'), 'new');
    const untracked = snapshot(fixture);
    assert.equal(untracked.files, 2);
    assert.notEqual(dirty.sha256, untracked.sha256);
    fs.unlinkSync(file);
    assert.notEqual(snapshot(fixture).sha256, untracked.sha256);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('CLI help and invalid flags never launch the CMS suites', () => {
  const file = path.join(__dirname, 'health-check.cjs');
  const help = spawnSync(process.execPath, [file, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /No CMS database/);
  const invalid = spawnSync(process.execPath, [file, '--build'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.doesNotMatch(invalid.stdout, /LULUS|PASS_SCOPED/);
});

test('JSON mode reports missing PHP as incomplete and returns exit 2', () => {
  const run = spawnSync(process.execPath, [path.join(__dirname, 'health-check.cjs'), '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PHP_BIN: path.join(__dirname, '__missing_php_executable__') },
    timeout: 60000,
  });
  assert.equal(run.status, 2);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.equal(report.checks.find((check) => check.id === 'php-fixture-runtime').status, 'NOT_RUN');
  assert.equal(report.checks.find((check) => check.id === 'seo-regressions').status, 'NOT_RUN');
  assert.equal(
    report.checks.find((check) => check.id === 'security-boundary-fixtures').status,
    'NOT_RUN'
  );
  assert.ok(report.notTested.length > 0);
});
