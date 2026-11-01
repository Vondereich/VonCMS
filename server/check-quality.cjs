const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findPhpBinary } = require('./lint-php.cjs');
const { isForbiddenReleasePath } = require('./release-path-policy.cjs');
const root = path.resolve(__dirname, '..');

function checkBom() {
  const ignored = new Set([
    '.git',
    '.agents',
    '.codex',
    '.vscode',
    'node_modules',
    'vendor',
    'dist',
    'backups',
  ]);
  const extensions = new Set([
    '.php',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.cjs',
    '.mjs',
    '.json',
    '.md',
    '.css',
    '.yml',
    '.yaml',
    '.neon',
  ]);
  let checked = 0;
  const failures = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      const relative = path.relative(root, file).replace(/\\/g, '/');
      if (
        ignored.has(entry.name) ||
        isForbiddenReleasePath(relative) ||
        relative === 'public/assets'
      )
        continue;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && extensions.has(path.extname(file))) {
        const header = Buffer.alloc(3);
        const fd = fs.openSync(file, 'r');
        try {
          const length = fs.readSync(fd, header, 0, 3, 0);
          checked++;
          if (length === 3 && header.equals(Buffer.from([0xef, 0xbb, 0xbf])))
            failures.push(relative);
        } finally {
          fs.closeSync(fd);
        }
      }
    }
  }
  visit(root);
  if (failures.length)
    throw new Error(`UTF-8 BOM found (no files changed):\n${failures.join('\n')}`);
  console.log(`PASS BOM: ${checked} maintained files checked; no files changed.`);
}

function checkPhpstan() {
  const php = findPhpBinary();
  if (!php) throw new Error('PHPStan requires PHP. Set PHP_BIN; missing runtime is not a pass.');
  const binary = path.join(root, 'vendor', 'bin', 'phpstan');
  if (!fs.existsSync(binary))
    throw new Error('PHPStan is not installed. Run composer install first.');
  const result = spawnSync(php, [binary, 'analyse', '--no-progress', '--memory-limit=512M'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

try {
  if (process.argv[2] === 'bom') checkBom();
  else if (process.argv[2] === 'phpstan') checkPhpstan();
  else throw new Error('Usage: node server/check-quality.cjs bom|phpstan');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
