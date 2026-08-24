#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { isForbiddenReleasePath, normalizeReleasePath } = require('./release-path-policy.cjs');

function shouldCopyPublicPath(sourcePath, publicDirectory) {
  const relativePath = normalizeReleasePath(path.relative(publicDirectory, sourcePath));
  if (!relativePath) return true;

  const lower = relativePath.toLowerCase();
  if (lower === 'index.html' || lower === 'install.sql') return false;
  if (lower === 'assets' || lower.startsWith('assets/')) return false;
  if (lower === 'migrations' || lower.startsWith('migrations/')) return false;

  return !isForbiddenReleasePath(`public/${relativePath}`);
}

function copyPublicToDist(publicDirectory, distDirectory, docsDirectory = null) {
  fse.copySync(publicDirectory, distDirectory, {
    overwrite: true,
    filter: (sourcePath) => shouldCopyPublicPath(sourcePath, publicDirectory),
  });

  if (docsDirectory && fs.existsSync(docsDirectory)) {
    const distDocs = path.join(distDirectory, 'docs');
    fse.copySync(docsDirectory, distDocs, {
      overwrite: true,
      filter: (sourcePath) => {
        const relativePath = normalizeReleasePath(path.relative(docsDirectory, sourcePath));
        return !relativePath || !isForbiddenReleasePath(`docs/${relativePath}`);
      },
    });
  }
}

if (require.main === module) {
  const projectRoot = path.resolve(__dirname, '..');
  const publicDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'public'));
  const distDirectory = path.resolve(process.argv[3] || path.join(projectRoot, 'dist'));
  const docsDirectory = process.argv[4]
    ? path.resolve(process.argv[4])
    : process.argv[2]
      ? null
      : path.join(projectRoot, 'docs');

  copyPublicToDist(publicDirectory, distDirectory, docsDirectory);
}

module.exports = { copyPublicToDist, shouldCopyPublicPath };
