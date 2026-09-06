const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

function zipEntryIsSymbolicLink(entry) {
  const attributes = Number(entry && entry.attr);
  if (!Number.isFinite(attributes)) return false;
  const unixMode = (attributes >>> 16) & 0xffff;
  return (unixMode & 0xf000) === 0xa000;
}

function assertSafeZipEntries(zip, destination) {
  assertNormalDirectory(destination);
  const entries = zip.getEntries();
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_THEME_ZIP_ENTRIES) {
    throw new Error('Theme archive entry count is invalid');
  }

  let totalBytes = 0;
  const destinations = new Set();
  for (const entry of entries) {
    const entryName = String(entry && entry.entryName ? entry.entryName : '');
    if (
      !entryName ||
      path.isAbsolute(entryName) ||
      entryName.includes('\0') ||
      zipEntryIsSymbolicLink(entry)
    ) {
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
    const declaredSize = Number(entry.header && entry.header.size);
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
    if (entry.header.encrypted || ![0, 8].includes(entry.header.method)) {
      throw new Error('Unsupported theme archive compression');
    }
    const compressed = entry.getCompressedData();
    if (entry.header.method === 0 && compressed.length !== declaredSize) {
      throw new Error('Theme archive stored size is inconsistent');
    }
    if (entry.header.method === 8 && declaredSize === 0) {
      // adm-zip disables its inflater cap for zero; verify empty streams with our own cap.
      const empty = zlib.inflateRawSync(compressed, { maxOutputLength: 1 });
      if (empty.length !== 0) throw new Error('Theme archive empty size is inconsistent');
    }
  }

  if (fs.readdirSync(destination).length !== 0) {
    throw new Error('Theme extraction directory must be empty');
  }
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
  assertSafeZipEntries,
  createSecureExtractionDirectory,
  createUnpredictableIdSuffix,
};
