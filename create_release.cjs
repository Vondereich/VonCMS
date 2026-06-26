/**
 * VonCMS Release Script
 * Creates Deploy and Source zip packages
 * Usage: node create_release.cjs
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

const version = require('./package.json').version;
const basePath = __dirname;
const sourcePackageExcludedRootItems = new Set([
  '.agent',
  '.agents',
  '.codex',
  '.cursorrules',
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
      normalizedRelativePath.startsWith('data/backups/') ||
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

    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...walkSync(fullPath, baseDir));
    } else {
      files.push({ fullPath, relativePath });
    }
  }
  return files;
}

log(`Creating VonCMS v${version} release packages...\n`);

log('Building project (npm run build)...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  log('Build successful.\n');

  ['migrations', 'install.sql', 'von_config.php', 'docs/superpowers'].forEach((item) => {
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

const escapedVersion = version.replace(/\./g, '\\.');
const releaseArtifactPattern = new RegExp(
  `^VonCMS_v${escapedVersion}_(Deploy|Source)\\.zip(\\.sha256)?$`
);
const oldArtifacts = fs.readdirSync(basePath).filter((f) => releaseArtifactPattern.test(f));
oldArtifacts.forEach((artifact) => {
  fs.unlinkSync(path.join(basePath, artifact));
  log(`Deleted: ${artifact}`);
});

log('\nCreating Deploy zip...');
const deployZip = new AdmZip();
deployZip.addLocalFolder(path.join(basePath, 'dist'), '');
deployZip.addLocalFile(path.join(basePath, 'public', '.htaccess'), '', '.htaccess');
if (fs.existsSync(path.join(basePath, 'public', 'uploads', '.htaccess'))) {
  deployZip.addLocalFile(
    path.join(basePath, 'public', 'uploads', '.htaccess'),
    'uploads',
    '.htaccess'
  );
}
const changelogPath = path.join(basePath, 'CHANGELOG.md');

const docsPath = path.join(basePath, 'docs');
if (fs.existsSync(docsPath)) {
  fs.readdirSync(docsPath).forEach((file) => {
    const docsFilePath = path.join(docsPath, file);
    if (file !== 'superpowers' && fs.statSync(docsFilePath).isFile()) {
      deployZip.addLocalFile(docsFilePath, 'docs');
    }
  });
}

deployZip.addLocalFile(path.join(basePath, 'README.md'));
deployZip.addLocalFile(path.join(basePath, 'LICENSE.md'));
deployZip.addLocalFile(path.join(basePath, 'metadata.json'));
deployZip.addLocalFile(changelogPath, '', 'CHANGELOG.md');
const deployPath = path.join(basePath, `VonCMS_v${version}_Deploy.zip`);
deployZip.writeZip(deployPath);
log(
  `Created: VonCMS_v${version}_Deploy.zip (${(fs.statSync(deployPath).size / 1024 / 1024).toFixed(2)} MB)`
);

log('\nCreating Source zip...');
const sourceZip = new AdmZip();
const sourceFiles = walkSync(basePath);
sourceFiles.forEach(({ fullPath, relativePath }) => {
  sourceZip.addLocalFile(fullPath, path.dirname(relativePath), path.basename(relativePath));
});
const hasUppercaseChangelog = sourceFiles.some(
  ({ relativePath }) => relativePath.split(path.sep).join('/') === 'CHANGELOG.md'
);
if (fs.existsSync(changelogPath) && !hasUppercaseChangelog) {
  sourceZip.addLocalFile(changelogPath, '', 'CHANGELOG.md');
}
sourceZip.addLocalFile(path.join(basePath, '.htaccess'), '', '.htaccess');
sourceZip.addLocalFile(path.join(basePath, 'public', '.htaccess'), 'public', '.htaccess');
if (fs.existsSync(path.join(basePath, 'public', 'uploads', '.htaccess'))) {
  sourceZip.addLocalFile(
    path.join(basePath, 'public', 'uploads', '.htaccess'),
    'public/uploads',
    '.htaccess'
  );
}

const sourcePath = path.join(basePath, `VonCMS_v${version}_Source.zip`);
sourceZip.writeZip(sourcePath);
log(
  `Created: VonCMS_v${version}_Source.zip (${(fs.statSync(sourcePath).size / 1024 / 1024).toFixed(2)} MB)`
);

log('\nRelease packages ready!');
