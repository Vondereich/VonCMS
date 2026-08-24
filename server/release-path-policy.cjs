const path = require('path');

const FORBIDDEN_DIRECTORY_NAMES = new Set(['logs', 'backups']);
const FORBIDDEN_FILE_EXTENSIONS = new Set([
  '.7z',
  '.bak',
  '.db',
  '.dump',
  '.gz',
  '.key',
  '.log',
  '.map',
  '.p12',
  '.pem',
  '.pfx',
  '.ps1',
  '.rar',
  '.sha256',
  '.sqlite',
  '.sqlite3',
  '.tar',
  '.tgz',
  '.zip',
]);

function normalizeReleasePath(input) {
  return String(input || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+|\/+$/g, '');
}

function isForbiddenReleasePath(input) {
  const normalized = normalizeReleasePath(input);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  const parts = lower.split('/');
  const fileName = parts[parts.length - 1];
  const extension = path.posix.extname(fileName);

  if (parts.some((part) => FORBIDDEN_DIRECTORY_NAMES.has(part))) return true;
  if (parts.some((part) => part.startsWith('.env'))) return true;
  if (fileName === 'von_config.php') return true;
  if (
    lower === 'public/data/site_settings.json' ||
    lower.startsWith('public/data/site_settings.json.') ||
    lower === 'data/site_settings.json' ||
    lower.startsWith('data/site_settings.json.')
  ) {
    return true;
  }
  if (lower.startsWith('data/public-cache/') || lower.includes('/data/public-cache/')) return true;
  if (lower === 'data/public-cache' || lower.endsWith('/data/public-cache')) return true;
  if (
    lower.startsWith('data/media_cleanup_previews/') ||
    lower.includes('/data/media_cleanup_previews/')
  ) {
    return true;
  }
  if (lower === 'data/media_cleanup_previews' || lower.endsWith('/data/media_cleanup_previews')) {
    return true;
  }
  if (fileName === 'generated_media_variants.php') return true;
  if (fileName === 'generated_media_variants.lock') return true;
  if (fileName.startsWith('generated_media_variants.php.tmp.')) return true;
  if (FORBIDDEN_FILE_EXTENSIONS.has(extension)) return true;
  if (extension === '.sql' && lower !== 'public/install.sql' && lower !== 'install.sql')
    return true;

  return false;
}

function assertNoForbiddenReleasePaths(paths, label) {
  const forbidden = paths.map(normalizeReleasePath).filter(isForbiddenReleasePath);
  if (forbidden.length > 0) {
    throw new Error(
      `${label} contains forbidden runtime or credential paths: ${forbidden.slice(0, 8).join(', ')}`
    );
  }
}

module.exports = {
  assertNoForbiddenReleasePaths,
  isForbiddenReleasePath,
  normalizeReleasePath,
};
