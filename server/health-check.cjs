// Development-only coordinator. Never builds, packages, connects to the CMS or repairs files.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const NOT_TESTED = [
  'Installed-site HTTP, browser navigation and responsive UI',
  'Authenticated roles, real saves/uploads/mail and concurrent MySQL writes',
  'Hosting load/performance, production, installation/OTA and ZIP parity',
  'Unknown vulnerabilities or behavior without an existing regression case',
];
const USAGE = `VonCMS development health check
  npm run check:health             Quick isolated regression checks
  npm run check:health -- --full   Integration, typecheck and PHP lint; no build
  npm run check:health -- --json   Machine-readable report
Set PHP_BIN to a PHP 8.2+ executable with dom, mbstring and pdo_sqlite.
Exit: 0 = scoped checks pass; 1 = failure; 2 = incomplete/unavailable.
No CMS database, website, network, build, ZIP, staging or repair operation is requested.
Existing regression suites may create and clean their own disposable local fixtures.
`;

function parseArgs(args) {
  const allowed = new Set(['--full', '--json', '--help']);
  if (args.some((arg) => !allowed.has(arg))) throw new Error('Unknown option. Use --help.');
  return {
    full: args.includes('--full'),
    json: args.includes('--json'),
    help: args.includes('--help'),
  };
}

function result(id, status, detail) {
  return { id, status, detail };
}

function summarize(checks) {
  return checks.some((entry) => entry.status === 'FAIL')
    ? 'FAIL'
    : checks.length === 0 || checks.some((entry) => entry.status !== 'PASS')
      ? 'INCOMPLETE'
      : 'PASS_SCOPED';
}

function commandCheck(id, command, args, verify, options = {}) {
  const run = (options.spawn || spawnSync)(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    timeout: options.timeout || 60000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  if (run.error || run.signal || run.status === null) {
    return result(
      id,
      'NOT_RUN',
      `Did not complete (${run.error?.code || run.signal || 'no exit'}).`
    );
  }
  if (run.status !== 0) return result(id, 'FAIL', `Exit ${run.status}; run this check directly.`);
  const stdout = String(run.stdout || '');
  const stderr = String(run.stderr || '');
  if (
    stderr.trim() ||
    /^(?:FAIL\b|(?:PHP )?(?:Warning|Fatal error|Parse error|Deprecated):)/m.test(stdout)
  ) {
    return result(id, 'FAIL', 'Unexpected diagnostics; run this check directly.');
  }
  if (/^WARN\b/m.test(stdout) || /no PHP binary found|no PHP files found/i.test(stdout)) {
    return result(id, 'NOT_RUN', 'The underlying check reported warnings or missing coverage.');
  }
  try {
    const detail = verify(stdout);
    return detail
      ? result(id, 'PASS', detail)
      : result(id, 'FAIL', 'Expected completion evidence is missing.');
  } catch {
    return result(id, 'FAIL', 'Invalid completion evidence.');
  }
}

function seoEvidence(stdout) {
  const report = JSON.parse(stdout);
  if (
    !Number.isInteger(report.passed) ||
    report.passed < 1 ||
    report.failed !== 0 ||
    !Array.isArray(report.results) ||
    report.results.length !== report.passed ||
    !report.results.every((entry) => entry.ok === true)
  ) {
    return null;
  }
  return `${report.passed} controlled PHP/client groups; not installed-browser proof.`;
}

function integrationEvidence(stdout) {
  const count = (stdout.match(/^PASS /gm) || []).length;
  return count > 0 && /^Integration Smoke Gate: PASS\r?$/m.test(stdout)
    ? `${count} mixed contracts/fixtures; not that many end-to-end features.`
    : null;
}

function typecheckEntry(directory = root) {
  // The project aliases multiple TS packages. Resolve the actual tsc provider, not tsc6.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (pkg.scripts?.typecheck !== 'tsc --noEmit') return null;
    for (const name of ['@typescript/native', 'typescript']) {
      const relative = path.join('node_modules', name);
      const metadata = path.join(directory, relative, 'package.json');
      if (!fs.existsSync(metadata)) continue;
      const installed = JSON.parse(fs.readFileSync(metadata, 'utf8'));
      const entry = installed.bin?.tsc;
      if (typeof entry === 'string' && fs.existsSync(path.join(directory, relative, entry))) {
        return path.join(relative, entry);
      }
    }
  } catch {
    // Unknown compiler setup must be explicit incomplete coverage, never a pass.
  }
  return null;
}

function versionCheck(directory = root) {
  const readJson = (file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  try {
    const pkg = readJson('package.json');
    const lock = readJson('package-lock.json');
    const metadata = readJson('metadata.json');
    const changelog = fs.readFileSync(path.join(directory, 'CHANGELOG.md'), 'utf8');
    const current = changelog.match(/^### \[v([^\]]+)\]/m)?.[1];
    const versions = [
      pkg.version,
      lock.version,
      lock.packages?.['']?.version,
      metadata.version,
      current,
    ];
    if (!pkg.version || !versions.every((value) => value === pkg.version)) {
      return result(
        'version-alignment',
        'FAIL',
        'Package, lockfile, metadata or current changelog disagree.'
      );
    }
    return result('version-alignment', 'PASS', pkg.version);
  } catch {
    return result('version-alignment', 'FAIL', 'Required version inputs are missing or invalid.');
  }
}

function distCheck(directory = root) {
  // The maintained SEO suite executes these existing build files as well as source.
  const files = [
    'index.php',
    'seo_route_helper.php',
    'seo_response_helper.php',
    'seo_schema_helper.php',
  ];
  let stale = true;
  try {
    stale = files.some((file) => {
      const source = path.join(directory, 'public', file);
      const built = path.join(directory, 'dist', file);
      return (
        !fs.existsSync(source) ||
        !fs.existsSync(built) ||
        !fs.readFileSync(source).equals(fs.readFileSync(built))
      );
    });
  } catch {
    // Unreadable inputs do not establish tested build parity either.
  }
  return stale
    ? result(
        'seo-build-inputs',
        'NOT_RUN',
        'Missing/stale dist PHP inputs. No automatic rebuild performed.'
      )
    : result(
        'seo-build-inputs',
        'PASS',
        'Four PHP inputs match public; not whole-build or ZIP parity.'
      );
}

function snapshot(directory = root) {
  const inventory = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    }
  );
  if (inventory.status !== 0 || inventory.error) return null;
  const hash = createHash('sha256');
  const files = [...new Set(inventory.stdout.split('\0').filter(Boolean))].sort();
  try {
    for (const file of files) {
      const fullPath = path.join(directory, file);
      hash.update(file + '\0');
      if (!fs.existsSync(fullPath)) hash.update('deleted\0');
      else if (fs.lstatSync(fullPath).isFile()) hash.update(fs.readFileSync(fullPath));
      else return null; // Do not follow symlinks or submodules outside this checkout.
      hash.update('\0');
    }
    return { files: files.length, sha256: hash.digest('hex') };
  } catch {
    return null;
  }
}

function runHealth(options = {}) {
  const started = Date.now();
  const before = snapshot();
  const checks = [versionCheck()];
  const php = process.env.PHP_BIN || 'php';
  const environment = { node: process.version, php: null };
  checks.push(
    commandCheck(
      'php-fixture-runtime',
      php,
      [
        '-r',
        'echo json_encode(["version" => PHP_VERSION, "ready" => PHP_VERSION_ID >= 80200 && extension_loaded("dom") && extension_loaded("mbstring") && extension_loaded("pdo_sqlite")]);',
      ],
      (stdout) => {
        const probe = JSON.parse(stdout);
        environment.php = probe.version;
        return probe.ready === true
          ? `PHP ${probe.version}, dom/mbstring/pdo_sqlite available.`
          : null;
      }
    )
  );
  // A missing extension/runtime is unavailable coverage, not proof of a CMS defect.
  const phpCheck = checks.at(-1);
  if (phpCheck.status === 'FAIL') {
    phpCheck.status = 'NOT_RUN';
    phpCheck.detail = 'PHP fixture prerequisites unavailable. Set PHP_BIN; see --help.';
  }
  const env = { ...process.env, PHP_BIN: php };
  let dependencies = true;
  try {
    for (const name of ['typescript', 'fflate']) require.resolve(name, { paths: [root] });
  } catch {
    dependencies = false;
  }
  checks.push(
    result(
      'node-fixture-dependencies',
      dependencies ? 'PASS' : 'NOT_RUN',
      dependencies
        ? 'Existing TypeScript and archive fixture dependencies found.'
        : 'Install project dependencies explicitly before running fixtures.'
    )
  );
  const dist = distCheck();
  checks.push(dist);
  const nodeJob = (id, file, verify, args = [], needsPhp = false, needsDist = false) => {
    if (
      !dependencies ||
      (needsPhp && phpCheck.status !== 'PASS') ||
      (needsDist && dist.status !== 'PASS')
    ) {
      checks.push(
        result(id, 'NOT_RUN', 'Required fixture dependencies/runtime/build inputs unavailable.')
      );
      return;
    }
    checks.push(
      commandCheck(id, process.execPath, [path.join(root, file), ...args], verify, {
        env,
        timeout: options.full ? 180000 : 60000,
      })
    );
  };
  if (options.full) {
    // Integration already runs editor, SEO and security probes: do not run them twice.
    nodeJob('integration', 'server/test-integration.cjs', integrationEvidence, [], true, true);
    const compiler = typecheckEntry();
    if (compiler) {
      nodeJob('typecheck', compiler, () => 'Project tsc provider completed.', ['--noEmit']);
    } else {
      checks.push(
        result('typecheck', 'NOT_RUN', 'Project tsc provider unavailable or command changed.')
      );
    }
    nodeJob(
      'php-lint',
      'server/lint-php.cjs',
      (stdout) => {
        const count = Number(stdout.match(/PHP Lint: (\d+) PHP files checked\./)?.[1]);
        return count > 0 ? `${count} public PHP files linted.` : null;
      },
      [],
      true
    );
  } else {
    nodeJob('editor-regressions', 'server/test-editor-regressions.cjs', (stdout) =>
      /^PASS Editor Regressions Runtime:/m.test(stdout)
        ? 'Isolated editor/save-handler regressions completed.'
        : null
    );
    nodeJob('seo-regressions', 'server/test-seo-regressions.cjs', seoEvidence, [], true, true);
    nodeJob(
      'security-boundary-fixtures',
      'server/security-boundary-smoke.cjs',
      (stdout) =>
        stdout.includes('Security boundary smoke passed.')
          ? 'Isolated URL, registration, embed/helper and archive fixtures completed.'
          : null,
      [php],
      true
    );
  }
  const after = snapshot();
  checks.push(
    result(
      'tested-source-snapshot',
      before && after && before.sha256 === after.sha256 ? 'PASS' : 'NOT_RUN',
      before && after && before.sha256 === after.sha256
        ? 'Working-tree inputs unchanged during checks.'
        : 'Snapshot unavailable or changed during checks; results are not one final snapshot.'
    )
  );
  return {
    verdict: summarize(checks),
    mode: options.full ? 'full-tests-no-build' : 'quick',
    durationMs: Date.now() - started,
    environment,
    sourceSnapshot: before,
    checks,
    notTested: NOT_TESTED,
  };
}

function main(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const report = runHealth(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    const labels = { PASS: 'LULUS', FAIL: 'GAGAL', NOT_RUN: 'BELUM DIUJI' };
    console.log(`VonCMS health check: ${report.verdict} (${report.mode})`);
    for (const check of report.checks)
      console.log(`${labels[check.status]} | ${check.id}: ${check.detail}`);
    console.log(`Snapshot: ${report.sourceSnapshot?.sha256 || 'unavailable'}`);
    console.log('Not tested: ' + report.notTested.join('; ') + '.');
    console.log('This is bounded regression evidence, not a guarantee of a defect-free CMS.');
  }
  process.exitCode = report.verdict === 'FAIL' ? 1 : report.verdict === 'INCOMPLETE' ? 2 : 0;
}

module.exports = {
  parseArgs,
  summarize,
  commandCheck,
  seoEvidence,
  integrationEvidence,
  typecheckEntry,
  versionCheck,
  distCheck,
  snapshot,
  runHealth,
};
if (require.main === module) main();
