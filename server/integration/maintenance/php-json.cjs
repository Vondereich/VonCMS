const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { findPhpBinary } = require('../../lint-php.cjs');

function readPhpJson(result, label) {
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const hint =
    'Check PHP_BIN (64-bit PHP), php.ini and PHP startup warnings; diagnostics are not suppressed.';
  if (result.status !== 0 || result.error || stderr.trim()) {
    throw new Error(
      `${label}: PHP probe failed. ${hint}\n${String(result.error?.message || stderr || stdout).slice(0, 2000)}`
    );
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label}: PHP stdout is not clean JSON. ${hint}\n${stdout.slice(0, 2000)}`);
  }
}

if (require.main === module) {
  const php = findPhpBinary();
  assert.ok(php, 'PHP_BIN is required');
  const run = (args) => spawnSync(php, args, { encoding: 'utf8' });
  assert.deepEqual(readPhpJson(run(['-r', 'echo json_encode(["ok"=>true]);']), 'Control'), {
    ok: true,
  });
  const warning = run([
    '-d',
    'display_startup_errors=1',
    '-d',
    'extension=voncms_qa_missing_extension',
    '-r',
    'echo json_encode(["ok"=>true]);',
  ]);
  assert.ok(
    /Unable to load dynamic library/.test(warning.stdout + warning.stderr),
    'Startup warning negative control did not run'
  );
  assert.throws(() => readPhpJson(warning, 'Startup fixture'), /PHP probe failed|not clean JSON/);
  for (const stdout of ['Warning: QA\n[]', '[broken', '', '[] trailing']) {
    assert.throws(
      () => readPhpJson({ status: 0, stdout, stderr: '' }, 'Output fixture'),
      /not clean JSON.*PHP_BIN/s
    );
  }
  assert.throws(
    () => readPhpJson({ status: 2, stdout: '[]', stderr: '' }, 'Exit fixture'),
    /PHP probe failed/
  );
  assert.throws(
    () => readPhpJson({ status: 0, stdout: '[]', stderr: 'QA warning' }, 'Stderr fixture'),
    /PHP probe failed/
  );
  console.log(
    'PASS PHP JSON probe diagnostics: actual clean/startup-warning controls, malformed output, failed exit and stderr remain failures with actionable guidance.'
  );
}
module.exports = { readPhpJson };
