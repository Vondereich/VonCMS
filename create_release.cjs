/**
 * VonCMS Release Script
 * Creates Deploy and Source zip packages
 * Usage: node create_release.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  assertNoForbiddenReleasePaths,
  isForbiddenReleasePath,
} = require('./server/release-path-policy.cjs');
const { createZipFile } = require('./server/zip-archive-helper.cjs');

const version = require('./package.json').version;
const basePath = __dirname;
const sourcePackageExcludedRootItems = new Set([
  '.agent',
  '.agents',
  '.codex',
  '.cursorrules',
  '.vscode',
  'MASTERPLAN_2.0.md',
  'ROADMAP.md',
]);

function log(message) {
  console.log(message);
}

function walkSync(dir, baseDir = basePath) {
  const files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    const normalizedRelativePath = relativePath.split(path.sep).join('/');
    const lowerItem = item.toLowerCase();

    if (
      (baseDir === basePath && sourcePackageExcludedRootItems.has(normalizedRelativePath)) ||
      item === 'node_modules' ||
      item === '.git' ||
      item === 'dist' ||
      item === 'logs' ||
      item === 'backups' ||
      item.startsWith('temp_') ||
      item.startsWith('api_backup') ||
      item.startsWith('themes_backup')
    ) {
      continue;
    }

    if (
      normalizedRelativePath === 'public/von_config.php' ||
      normalizedRelativePath === 'docs/superpowers' ||
      normalizedRelativePath.startsWith('docs/superpowers/') ||
      normalizedRelativePath.startsWith('public/data/backups/') ||
      normalizedRelativePath.startsWith('public/data/public-cache/') ||
      normalizedRelativePath === 'public/data/generated_media_variants.php' ||
      normalizedRelativePath === 'public/data/generated_media_variants.lock' ||
      normalizedRelativePath.startsWith('public/data/generated_media_variants.php.tmp.') ||
      normalizedRelativePath === 'public/data/schema-capabilities.json' ||
      normalizedRelativePath.startsWith('public/data/schema-capabilities.json.') ||
      normalizedRelativePath.startsWith('public/data/media_cleanup_previews/') ||
      normalizedRelativePath.startsWith('data/backups/') ||
      normalizedRelativePath.startsWith('data/public-cache/') ||
      lowerItem.endsWith('.zip') ||
      lowerItem.endsWith('.sha256') ||
      lowerItem.endsWith('.log') ||
      lowerItem.endsWith('.ps1') ||
      lowerItem.endsWith('.bak') ||
      lowerItem.endsWith('.map') ||
      lowerItem.startsWith('.env')
    ) {
      continue;
    }

    if (isForbiddenReleasePath(normalizedRelativePath)) {
      continue;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...walkSync(fullPath, baseDir));
    } else {
      files.push({ fullPath, relativePath });
    }
  }
  return files;
}

function addReleaseFile(entries, sourcePath, archivePath) {
  const normalizedArchivePath = archivePath.split(path.sep).join('/');
  entries.set(normalizedArchivePath, {
    sourcePath,
    archivePath: normalizedArchivePath,
  });
}

log(`Creating VonCMS v${version} release packages...\n`);

log('Building project (npm run build)...');
try {
  const buildEnv = { ...process.env };
  delete buildEnv.DEBUG;

  execSync('npm run build', { stdio: 'inherit', env: buildEnv });
  log('Build successful.\n');

  [
    'migrations',
    'install.sql',
    'von_config.php',
    'docs/superpowers',
    'data/public-cache',
    'data/generated_media_variants.php',
    'data/generated_media_variants.lock',
    'data/schema-capabilities.json',
    'data/media_cleanup_previews',
  ].forEach((item) => {
    const itemPath = path.join(basePath, 'dist', item);
    if (fs.existsSync(itemPath)) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      log(`Removed dist/${item} (configured to exclude from Deploy).`);
    }
  });

  const skeletonPath = path.join(basePath, 'dist', 'skeleton.css');
  if (fs.existsSync(skeletonPath)) {
    log('Verified: skeleton.css is present in build.');
  } else {
    console.warn('Warning: skeleton.css missing from build artifacts!');
  }
} catch (e) {
  console.error('Build failed. Aborting release.');
  process.exit(1);
}

const distFiles = walkSync(path.join(basePath, 'dist'), path.join(basePath, 'dist'));
assertNoForbiddenReleasePaths(
  distFiles.map(({ relativePath }) => relativePath),
  'Deploy staging tree'
);

const releaseArtifactPattern = new RegExp(
  `^VonCMS_v\\d+\\.\\d+\\.\\d+_(Deploy|Source)\\.zip(\\.sha256)?$`
);
const oldArtifacts = fs.readdirSync(basePath).filter((f) => releaseArtifactPattern.test(f));
oldArtifacts.forEach((artifact) => {
  fs.unlinkSync(path.join(basePath, artifact));
  log(`Deleted: ${artifact}`);
});

log('\nCreating Deploy zip...');
const deployEntries = new Map();
distFiles.forEach(({ fullPath, relativePath }) => {
  addReleaseFile(deployEntries, fullPath, relativePath);
});
addReleaseFile(deployEntries, path.join(basePath, 'public', '.htaccess'), '.htaccess');
if (fs.existsSync(path.join(basePath, 'public', 'uploads', '.htaccess'))) {
  addReleaseFile(
    deployEntries,
    path.join(basePath, 'public', 'uploads', '.htaccess'),
    'uploads/.htaccess'
  );
}
const changelogPath = path.join(basePath, 'CHANGELOG.md');

const docsPath = path.join(basePath, 'docs');
if (fs.existsSync(docsPath)) {
  fs.readdirSync(docsPath).forEach((file) => {
    const docsFilePath = path.join(docsPath, file);
    if (file !== 'superpowers' && fs.statSync(docsFilePath).isFile()) {
      addReleaseFile(deployEntries, docsFilePath, `docs/${file}`);
    }
  });
}

addReleaseFile(deployEntries, path.join(basePath, 'README.md'), 'README.md');
addReleaseFile(deployEntries, path.join(basePath, 'LICENSE.md'), 'LICENSE.md');
addReleaseFile(deployEntries, path.join(basePath, 'metadata.json'), 'metadata.json');
addReleaseFile(deployEntries, changelogPath, 'CHANGELOG.md');
assertNoForbiddenReleasePaths([...deployEntries.keys()], 'Deploy ZIP');
const deployPath = path.join(basePath, `VonCMS_v${version}_Deploy.zip`);
createZipFile(deployPath, [...deployEntries.values()]);
log(
  `Created: VonCMS_v${version}_Deploy.zip (${(fs.statSync(deployPath).size / 1024 / 1024).toFixed(2)} MB)`
);

log('\nCreating Source zip...');
const sourceEntries = new Map();
const sourceFiles = walkSync(basePath);
assertNoForbiddenReleasePaths(
  sourceFiles.map(({ relativePath }) => relativePath),
  'Source staging tree'
);
sourceFiles.forEach(({ fullPath, relativePath }) => {
  addReleaseFile(sourceEntries, fullPath, relativePath);
});
const hasUppercaseChangelog = sourceFiles.some(
  ({ relativePath }) => relativePath.split(path.sep).join('/') === 'CHANGELOG.md'
);
if (fs.existsSync(changelogPath) && !hasUppercaseChangelog) {
  addReleaseFile(sourceEntries, changelogPath, 'CHANGELOG.md');
}
addReleaseFile(sourceEntries, path.join(basePath, '.htaccess'), '.htaccess');
addReleaseFile(sourceEntries, path.join(basePath, 'public', '.htaccess'), 'public/.htaccess');
if (fs.existsSync(path.join(basePath, 'public', 'uploads', '.htaccess'))) {
  addReleaseFile(
    sourceEntries,
    path.join(basePath, 'public', 'uploads', '.htaccess'),
    'public/uploads/.htaccess'
  );
}

assertNoForbiddenReleasePaths([...sourceEntries.keys()], 'Source ZIP');

const sourcePath = path.join(basePath, `VonCMS_v${version}_Source.zip`);
createZipFile(sourcePath, [...sourceEntries.values()]);
log(
  `Created: VonCMS_v${version}_Source.zip (${(fs.statSync(sourcePath).size / 1024 / 1024).toFixed(2)} MB)`
);

log('\nRelease packages ready!');
