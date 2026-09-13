const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { inflateZipArchive, parseZipArchive } = require('./zip-archive-helper.cjs');

const MAX_THEME_ZIP_ENTRIES = 2000;
const MAX_THEME_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_THEME_ZIP_TOTAL_BYTES = 128 * 1024 * 1024;

function isPathInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(base + path.sep);
}

function assertNormalDirectory(directory) {
  const stats = fs.lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('Theme extraction directory is not a normal directory');
  }
}

function createSecureExtractionDirectory(parentDir) {
  assertNormalDirectory(parentDir);
  const parentRealPath = fs.realpathSync(parentDir);
  const directory = fs.mkdtempSync(path.join(parentRealPath, '.extract-'));
  fs.chmodSync(directory, 0o700);
  assertNormalDirectory(directory);
  return directory;
}

function validatePortableEntryName(entryName) {
  if (
    !entryName ||
    entryName.includes('\0') ||
    entryName.includes('\\') ||
    entryName.startsWith('/') ||
    /^[a-z]:/i.test(entryName)
  ) {
    throw new Error('Unsafe theme archive entry rejected');
  }

  const segments = entryName.split('/').filter(Boolean);
  if (segments.length === 0) throw new Error('Unsafe theme archive entry rejected');
  for (const segment of segments) {
    const windowsStem = segment.split('.')[0].toUpperCase();
    if (
      segment === '.' ||
      segment === '..' ||
      /[<>:"|?*\u0000-\u001f]/.test(segment) ||
      /[. ]$/.test(segment) ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem)
    ) {
      throw new Error('Unsafe theme archive entry rejected');
    }
  }
}

function ensureSafeParentDirectories(rootDir, targetPath) {
  const relativeParent = path.relative(rootDir, path.dirname(targetPath));
  let current = rootDir;
  if (!relativeParent) return;

  for (const segment of relativeParent.split(path.sep)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) fs.mkdirSync(current, { mode: 0o700 });
    assertNormalDirectory(current);
  }
}

function extractThemeArchiveSafely(archivePath, destination) {
  assertNormalDirectory(destination);
  if (fs.readdirSync(destination).length !== 0) {
    throw new Error('Theme extraction directory must be empty');
  }

  const parsedArchive = parseZipArchive(archivePath);
  const { entries } = parsedArchive;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_THEME_ZIP_ENTRIES) {
    throw new Error('Theme archive entry count is invalid');
  }

  let totalBytes = 0;
  const destinations = new Set();
  for (const entry of entries) {
    const entryName = String(entry && entry.name ? entry.name : '');
    validatePortableEntryName(entryName);
    if (entry.isSymbolicLink) {
      throw new Error('Unsafe theme archive entry rejected');
    }

    const target = path.resolve(destination, entryName);
    if (!isPathInside(destination, target)) {
      throw new Error('Theme archive path escapes its destination');
    }

    const destinationKey = process.platform === 'win32' ? target.toLowerCase() : target;
    if (destinations.has(destinationKey)) {
      throw new Error('Duplicate theme archive destination rejected');
    }
    destinations.add(destinationKey);

    if (entry.isDirectory) continue;
    const declaredSize = Number(entry.uncompressedSize);
    if (
      !Number.isSafeInteger(declaredSize) ||
      declaredSize < 0 ||
      declaredSize > MAX_THEME_ZIP_ENTRY_BYTES
    ) {
      throw new Error('Theme archive entry exceeds its size limit');
    }
    totalBytes += declaredSize;
    if (totalBytes > MAX_THEME_ZIP_TOTAL_BYTES) {
      throw new Error('Theme archive exceeds its expanded size limit');
    }
    if ((entry.flags & 0x0041) !== 0 || ![0, 8].includes(entry.compressionMethod)) {
      throw new Error('Unsupported theme archive compression');
    }
    if (entry.compressionMethod === 0 && entry.compressedSize !== declaredSize) {
      throw new Error('Theme archive stored size is inconsistent');
    }
  }

  const inflatedEntries = inflateZipArchive(parsedArchive, entries);
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const target = path.resolve(destination, entry.name);
    ensureSafeParentDirectories(destination, target);
    const openFlags =
      fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_EXCL |
      (fs.constants.O_NOFOLLOW || 0);
    const fileDescriptor = fs.openSync(target, openFlags, 0o600);
    try {
      fs.writeFileSync(fileDescriptor, inflatedEntries.get(entry.name));
    } finally {
      fs.closeSync(fileDescriptor);
    }
  }

  assertSafeExtractedTree(destination);
}

function assertSafeExtractedTree(rootDir) {
  assertNormalDirectory(rootDir);
  const rootRealPath = fs.realpathSync(rootDir);
  const pending = [rootDir];

  while (pending.length > 0) {
    const current = pending.pop();
    const currentStats = fs.lstatSync(current);
    if (currentStats.isSymbolicLink()) {
      throw new Error('Symbolic links are not allowed in theme archives');
    }

    const currentRealPath = fs.realpathSync(current);
    if (!isPathInside(rootRealPath, currentRealPath)) {
      throw new Error('Extracted theme path escapes its destination');
    }

    if (currentStats.isDirectory()) {
      for (const entryName of fs.readdirSync(current)) {
        pending.push(path.join(current, entryName));
      }
    } else if (!currentStats.isFile()) {
      throw new Error('Special files are not allowed in theme archives');
    }
  }
}

function createUnpredictableIdSuffix() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  assertSafeExtractedTree,
  createSecureExtractionDirectory,
  createUnpredictableIdSuffix,
  extractThemeArchiveSafely,
};
