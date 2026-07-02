const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function findPhpBinary() {
  const candidates = [];

  if (process.env.PHP_BIN) {
    candidates.push(process.env.PHP_BIN);
  }

  if (process.platform === 'win32') {
    const wherePhp = spawnSync('where', ['php'], { encoding: 'utf8' });
    if (wherePhp.status === 0) {
      candidates.push(...wherePhp.stdout.split(/\r?\n/).filter(Boolean));
    }

    candidates.push('C:\\xampp\\php\\php.exe');
    candidates.push('C:\\laragon\\bin\\php\\php-8.2.0-Win32-vs16-x64\\php.exe');
    candidates.push('C:\\laragon\\bin\\php\\php-8.3.0-Win32-vs16-x64\\php.exe');

    const laragonPhpRoot = 'C:\\laragon\\bin\\php';
    if (fs.existsSync(laragonPhpRoot)) {
      const installedLaragonVersions = fs
        .readdirSync(laragonPhpRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(laragonPhpRoot, entry.name, 'php.exe'))
        .sort()
        .reverse();
      candidates.push(...installedLaragonVersions);
    }
  } else {
    const whichPhp = spawnSync('which', ['php'], { encoding: 'utf8' });
    if (whichPhp.status === 0) {
      candidates.push(...whichPhp.stdout.split(/\r?\n/).filter(Boolean));
    }

    candidates.push('/usr/bin/php');
    candidates.push('/usr/local/bin/php');
  }

  for (const candidate of unique(candidates)) {
    const isAbsolutePath = path.isAbsolute(candidate);
    if (isAbsolutePath && !fs.existsSync(candidate)) {
      continue;
    }

    const probe = spawnSync(candidate, ['-v'], { encoding: 'utf8' });
    if (probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

function collectPhpFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPhpFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.php')) {
      files.push(fullPath);
    }
  }

  return files;
}

const phpBinary = findPhpBinary();
if (!phpBinary) {
  console.warn(
    'PHP Lint: no PHP binary found; skipping syntax lint checks. Set PHP_BIN to enable PHP lint.'
  );
  process.exit(0);
}

const phpFiles = collectPhpFiles(path.join(root, 'public')).sort();
if (phpFiles.length === 0) {
  console.log('PHP Lint: no PHP files found under public/.');
  process.exit(0);
}

let failed = false;
for (const file of phpFiles) {
  const result = spawnSync(phpBinary, ['-l', file], { encoding: 'utf8' });
  const relativePath = path.relative(root, file).replace(/\\/g, '/');

  if (result.status === 0) {
    console.log(`PASS PHP Lint: ${relativePath}`);
  } else {
    failed = true;
    console.error(`FAIL PHP Lint: ${relativePath}`);
    console.error((result.stderr || result.stdout || '').trim());
  }
}

if (failed) {
  process.exit(1);
}

console.log(`PHP Lint: ${phpFiles.length} PHP files checked.`);
