#!/usr/bin/env node
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const app = express();
const PORT = process.env.THEMES_API_PORT || 5000;
const HOST = process.env.THEMES_API_HOST || '127.0.0.1';
const IS_LOOPBACK_HOST = ['127.0.0.1', '::1', 'localhost'].includes(HOST.toLowerCase());
const ADMIN_SAVE_TOKEN = process.env.ADMIN_SAVE_TOKEN || '';
const cors = require('cors');
app.use(cors());
app.use(express.json());

const https = require('https');
const querystring = require('querystring');

// --- SECURITY UTILS ---
const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

function sanitizeRecursive(obj) {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeRecursive);
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = sanitizeRecursive(obj[key]);
    }
    return newObj;
  }
  return obj;
}
// ----------------------

// Global error handlers to surface unexpected crashes in logs
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION', err && err.stack ? err.stack : err);
  // allow process to exit after logging
  try {
    fs.appendFileSync(
      path.join(PROJECT_ROOT, 'data', 'logs', 'server_crash.log'),
      new Date().toISOString() + ' ' + String(err && err.stack ? err.stack : err) + os.EOL
    );
  } catch (e) {}
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED_REJECTION', reason);
  try {
    fs.appendFileSync(
      path.join(PROJECT_ROOT, 'data', 'logs', 'server_crash.log'),
      new Date().toISOString() + ' UNHANDLED_REJECTION ' + String(reason) + os.EOL
    );
  } catch (e) {}
});

// rate limiter (optional dependency)
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  console.warn(
    'express-rate-limit not installed; falling back to an in-memory limiter for the local theme API.'
  );
}

const os = require('os');

// Mount AI routes (server-side only) if module exists
try {
  const initAi = require('./ai.cjs');
  if (typeof initAi === 'function') initAi(app);
} catch (e) {
  // If AI module not present or @google/genai not installed, skip silently
  console.warn('AI routes not initialized:', e?.message || e);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(PROJECT_ROOT, 'themes');
const DATA_FILE = path.join(PROJECT_ROOT, 'data', 'themes.json');
const PUBLIC_THEMES = path.join(PROJECT_ROOT, 'public', 'themes');

function isPathInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(base + path.sep);
}

function safeResolveInside(baseDir, ...segments) {
  const target = path.resolve(baseDir, ...segments);
  if (!isPathInside(baseDir, target)) {
    throw new Error('Unsafe path rejected');
  }
  return target;
}

function sanitizeThemeFileName(fileName) {
  const baseName = path.basename(String(fileName || 'theme'));
  return baseName.replace(/[^a-z0-9_.-]/gi, '_') || 'theme';
}

function normalizeThemeId(value) {
  return (
    String(value || 'theme')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'theme'
  );
}

function assertSafeZipEntries(zip, destDir) {
  const unsafeEntry = zip.getEntries().find((entry) => {
    const entryName = String(entry.entryName || '');
    if (!entryName || path.isAbsolute(entryName) || entryName.includes('\0')) return true;
    const target = path.resolve(destDir, entryName);
    return !isPathInside(destDir, target);
  });

  if (unsafeEntry) {
    throw new Error(`Unsafe zip entry rejected: ${unsafeEntry.entryName}`);
  }
}

function findFirstRegularFile(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = safeResolveInside(dir, entry.name);
    if (entry.isFile()) return resolved;
    if (entry.isDirectory()) {
      const nested = findFirstRegularFile(resolved);
      if (nested) return nested;
    }
  }
  return null;
}

fse.ensureDirSync(THEMES_DIR);
fse.ensureDirSync(path.dirname(DATA_FILE));
fse.ensureFileSync(DATA_FILE);

// Simple async mutex to serialize critical file writes
class AsyncMutex {
  constructor() {
    this._p = Promise.resolve();
  }
  async runExclusive(fn) {
    const cur = this._p;
    let release;
    this._p = new Promise((res) => {
      release = res;
    });
    await cur;
    try {
      const r = await fn();
      release();
      return r;
    } catch (e) {
      release();
      throw e;
    }
  }
}
const saveWriteMutex = new AsyncMutex();

// Simple request logger for important admin actions
function logAdminAction(entry) {
  try {
    const logsDir = path.join(PROJECT_ROOT, 'data', 'logs');
    fse.ensureDirSync(logsDir);
    const file = path.join(logsDir, 'admin_actions.log');
    const line = JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + os.EOL;
    fs.appendFileSync(file, line, 'utf8');
  } catch (e) {
    console.warn('Failed to write admin log', e?.message || e);
  }
}

// Global error handlers to capture uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  try {
    console.error('Uncaught exception:', err && err.stack ? err.stack : err);
  } catch (e) {
    // swallow
  }
  // give a small delay for logs to flush, then exit (process manager should restart)
  setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason, p) => {
  try {
    console.error(
      'Unhandled Rejection at:',
      p,
      'reason:',
      reason && reason.stack ? reason.stack : reason
    );
  } catch (e) {
    // swallow
  }
  setTimeout(() => process.exit(1), 100);
});

function createMemoryRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) || 10 * 60 * 1000;
  const max = Number(options.max) || 30;
  const message = options.message || {
    success: false,
    message: 'Too many requests, try again later.',
  };
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.connection?.remoteAddress || 'anon';
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json(message);
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}

function buildRateLimiter(options) {
  return rateLimit
    ? rateLimit({
        ...options,
        standardHeaders: true,
        legacyHeaders: false,
      })
    : createMemoryRateLimiter(options);
}

// Rate limiter instance for admin routes (configurable via env)
const RATE_LIMIT_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '') || 10;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '') || 30;
const adminLimiter = buildRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: RATE_LIMIT_MAX_REQUESTS,
});

// Stronger limiter for sensitive save endpoint to prevent brute-force/abuse
const SAVE_LIMIT_WINDOW_MINUTES = parseInt(process.env.SAVE_LIMIT_WINDOW_MINUTES || '') || 60;
const SAVE_LIMIT_MAX_REQUESTS = parseInt(process.env.SAVE_LIMIT_MAX_REQUESTS || '') || 10;
const saveSettingsLimiter = buildRateLimiter({
  windowMs: SAVE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: SAVE_LIMIT_MAX_REQUESTS,
  message: { success: false, message: 'Too many requests, try again later.' },
});

// SECURITY MIDDLEWARE
// Mock tokens are intentionally limited to the local development host.
const verifyDevToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing Token' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  if (ADMIN_SAVE_TOKEN && token === ADMIN_SAVE_TOKEN) {
    return next();
  }

  if (IS_LOOPBACK_HOST && token?.startsWith('mock_dev_token_')) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Forbidden: Invalid Token' });
};

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, THEMES_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + sanitizeThemeFileName(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function writeData(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function computeChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

// Upload endpoint
app.post(
  '/api/themes/upload',
  adminLimiter,
  verifyDevToken,
  upload.single('theme'),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded (field name "theme")' });

      const { originalname, size } = req.file;
      const uploadedPath = safeResolveInside(THEMES_DIR, req.file.path);
      const safeOriginalName = sanitizeThemeFileName(originalname);
      const name = req.body.name || path.parse(safeOriginalName).name;
      const version = req.body.version || '0.0.0';
      const uploadedBy = req.body.uploadedBy || 'admin';

      const ext = path.extname(safeOriginalName).replace('.', '').toLowerCase();
      const allowed = ['zip', 'css', 'js'];
      if (!allowed.includes(ext)) {
        // remove uploaded file
        await fse.remove(uploadedPath);
        return res
          .status(400)
          .json({ success: false, message: 'Unsupported file type. Allowed: zip, css, js' });
      }

      const idBase = normalizeThemeId(name);
      const id = `${idBase}_${Date.now()}`;
      const destDir = safeResolveInside(THEMES_DIR, id);
      await fse.ensureDir(destDir);

      const destPath = safeResolveInside(destDir, safeOriginalName);
      await fse.move(uploadedPath, destPath, { overwrite: true });

      // If zip, extract
      if (ext === 'zip') {
        try {
          const zip = new AdmZip(destPath);
          assertSafeZipEntries(zip, destDir);
          zip.extractAllTo(destDir, true);
          await fse.remove(destPath); // remove zip after extract
        } catch (err) {
          return res
            .status(500)
            .json({ success: false, message: 'Failed to extract zip archive', error: err.message });
        }
      }

      const checksumTarget = findFirstRegularFile(destDir) || destPath;
      const checksum = computeChecksum(checksumTarget);

      const meta = {
        id,
        name,
        version,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        enabled: false,
        checksum,
        size,
        folder: `themes/${id}`,
      };

      const list = readData();
      list.push(meta);
      writeData(list);

      logAdminAction({
        action: 'theme_upload',
        id: id,
        uploadedBy,
        ip: req.ip || req.connection.remoteAddress,
      });

      return res.json({ success: true, message: 'Theme uploaded', theme: meta });
    } catch (err) {
      console.error('upload error', err);
      return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  }
);

// List themes
app.get('/api/themes', adminLimiter, verifyDevToken, (req, res) => {
  const list = readData();
  res.json(list);
});

// Get all content
app.get('/api/content', adminLimiter, verifyDevToken, (req, res) => {
  try {
    const contentFile = path.join(PROJECT_ROOT, 'data', 'content.json');
    if (!fs.existsSync(contentFile)) return res.json({ posts: [], pages: [] });
    const data = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read content' });
  }
});

// Simple content lookup endpoint for dev: lookup post/page by slug or id
app.get('/api/post', adminLimiter, verifyDevToken, (req, res) => {
  try {
    const contentFile = path.join(PROJECT_ROOT, 'data', 'content.json');
    if (!fs.existsSync(contentFile)) return res.status(404).json({ error: 'content not found' });
    const raw = fs.readFileSync(contentFile, 'utf8');
    const data = JSON.parse(raw || '{}');
    const { slug, id } = req.query || {};
    let found = null;
    if (slug) {
      found =
        (data.posts || []).find((p) => p.slug === String(slug)) ||
        (data.pages || []).find((p) => p.slug === String(slug));
    }
    if (!found && id) {
      const idStr = String(id);
      // If id looks numeric, prefer numeric nid field (new scheme)
      if (/^\d+$/.test(idStr)) {
        const nid = Number(idStr);
        found =
          (data.posts || []).find((p) => Number(p.nid) === nid) ||
          (data.pages || []).find((p) => Number(p.nid) === nid);
      }
      // fallback to legacy id field
      if (!found) {
        found =
          (data.posts || []).find((p) => String(p.id) === idStr) ||
          (data.pages || []).find((p) => String(p.id) === idStr);
      }
    }
    if (!found) return res.status(404).json({ error: 'not found' });
    return res.json({ post: found });
  } catch (err) {
    console.error('post lookup error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Save single post
app.post('/api/save_post', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const post = req.body;
    if (!post) return res.status(400).json({ success: false, message: 'No post data' });

    const safePost = sanitizeRecursive(post);
    const contentFile = path.join(PROJECT_ROOT, 'data', 'content.json');

    let currentData = { posts: [], pages: [] };
    if (fs.existsSync(contentFile)) {
      try {
        currentData = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
      } catch (e) {}
    }

    // Update or Add
    const idx = (currentData.posts || []).findIndex((p) => p.id === safePost.id);
    if (idx >= 0) {
      currentData.posts[idx] = { ...currentData.posts[idx], ...safePost };
    } else {
      currentData.posts = [...(currentData.posts || []), safePost];
    }

    fs.writeFileSync(contentFile, JSON.stringify(currentData, null, 2), 'utf8');
    return res.json({ success: true, id: safePost.id, message: 'Post saved' });
  } catch (err) {
    console.error('save_post error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save single page
app.post('/api/save_page', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const page = req.body;
    if (!page) return res.status(400).json({ success: false, message: 'No page data' });

    const safePage = sanitizeRecursive(page);
    const contentFile = path.join(PROJECT_ROOT, 'data', 'content.json');

    let currentData = { posts: [], pages: [] };
    if (fs.existsSync(contentFile)) {
      try {
        currentData = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
      } catch (e) {}
    }

    // Update or Add
    const idx = (currentData.pages || []).findIndex((p) => p.id === safePage.id);
    if (idx >= 0) {
      currentData.pages[idx] = { ...currentData.pages[idx], ...safePage };
    } else {
      currentData.pages = [...(currentData.pages || []), safePage];
    }

    fs.writeFileSync(contentFile, JSON.stringify(currentData, null, 2), 'utf8');
    return res.json({ success: true, id: safePage.id, message: 'Page saved' });
  } catch (err) {
    console.error('save_page error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save content (posts/pages) - Legacy/Bulk
app.post('/api/save_content', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const { posts, pages } = req.body;
    if (!posts && !pages)
      return res.status(400).json({ success: false, message: 'No content provided' });

    // SECURITY: Sanitize Content
    // Note: We might want to allow some HTML in posts, but strip scripts.
    const safePosts = sanitizeRecursive(posts);
    const safePages = sanitizeRecursive(pages);

    const contentFile = path.join(PROJECT_ROOT, 'data', 'content.json');

    // Read existing to merge if needed, or just overwrite if we are sending full state
    // For simplicity in this "dummy" mode, we will overwrite with the full state sent from frontend
    // But we should preserve other keys if they exist
    let currentData = {};
    if (fs.existsSync(contentFile)) {
      try {
        currentData = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
      } catch (e) {}
    }

    const newData = {
      ...currentData,
      posts: safePosts || currentData.posts || [],
      pages: safePages || currentData.pages || [],
    };

    // Backup content before save
    const backupsDir = path.join(PROJECT_ROOT, 'data', 'backups');
    await fse.ensureDir(backupsDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await fse.copy(contentFile, path.join(backupsDir, `content.${ts}.json`));

    fs.writeFileSync(contentFile, JSON.stringify(newData, null, 2), 'utf8');

    return res.json({ success: true, message: 'Content saved' });
  } catch (err) {
    console.error('save_content error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get comments
app.get('/api/get_comments', adminLimiter, verifyDevToken, (req, res) => {
  try {
    const commentsFile = path.join(PROJECT_ROOT, 'data', 'comments.json');
    if (fs.existsSync(commentsFile)) {
      const comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
      return res.json({ comments });
    }
    return res.json({ comments: [] });
  } catch (err) {
    console.error('get_comments error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Save comments
app.post('/api/save_comments', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const { comments } = req.body;
    if (!comments) return res.status(400).json({ success: false, message: 'No comments provided' });

    // SECURITY: Sanitize Comments
    const safeComments = sanitizeRecursive(comments);

    const commentsFile = path.join(PROJECT_ROOT, 'data', 'comments.json');

    // Backup comments before save (optional, but good for safety)
    // const backupsDir = path.join(PROJECT_ROOT, 'data', 'backups');
    // await fse.ensureDir(backupsDir);
    // const ts = new Date().toISOString().replace(/[:.]/g, '-');
    // if (fs.existsSync(commentsFile)) {
    //    await fse.copy(commentsFile, path.join(backupsDir, `comments.${ts}.json`));
    // }

    fs.writeFileSync(commentsFile, JSON.stringify(safeComments, null, 2), 'utf8');

    return res.json({ success: true, message: 'Comments saved' });
  } catch (err) {
    console.error('save_comments error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get site settings
app.get(
  ['/api/get_settings', '/api/get_settings.php'],
  adminLimiter,
  verifyDevToken,
  (req, res) => {
    try {
      const SETTINGS_FILE = path.join(PROJECT_ROOT, 'data', 'site_settings.json');
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(raw || '{}');
        return res.json(settings);
      }
      return res.json({}); // Return empty object if no settings file
    } catch (err) {
      console.error('get_settings error', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Persist site settings (token-protected)
app.post(
  ['/api/save_settings', '/api/save_settings.php'],
  saveSettingsLimiter,
  verifyDevToken,
  async (req, res) => {
    try {
      // VerifyDevToken middleware handles auth now.
      // We keep this block only if specific strict env check is needed, but for now we rely on middleware.
      /*
    const ADMIN_SAVE_TOKEN = process.env.ADMIN_SAVE_TOKEN;
    if (ADMIN_SAVE_TOKEN) {
       // double check logic if needed
    }
    */

      // SECURITY: Sanitize Input
      const settings = sanitizeRecursive(req.body || {});

      const SETTINGS_FILE = path.join(PROJECT_ROOT, 'data', 'site_settings.json');
      await fse.ensureDir(path.dirname(SETTINGS_FILE));

      // Serialize critical backup+write operations to avoid Windows file locks under concurrency
      try {
        await saveWriteMutex.runExclusive(async () => {
          // Pre-save backup (timestamped)
          try {
            if (await fse.pathExists(SETTINGS_FILE)) {
              const backupsDir = path.join(PROJECT_ROOT, 'data', 'backups');
              await fse.ensureDir(backupsDir);
              const ts = new Date().toISOString().replace(/[:.]/g, '-');
              const backupPath = path.join(backupsDir, `site_settings.${ts}.json`);
              await fse.copy(SETTINGS_FILE, backupPath, { overwrite: true });
              // rotate old backups: keep only latest 3
              try {
                const files = await fs.promises.readdir(backupsDir);
                const backupFiles = [];

                for (const f of files) {
                  if (!f.startsWith('site_settings.')) continue;
                  const p = path.join(backupsDir, f);
                  try {
                    const st = await fs.promises.stat(p);
                    backupFiles.push({ path: p, time: st.mtimeMs });
                  } catch (e) {}
                }

                // Sort descending by time
                backupFiles.sort((a, b) => b.time - a.time);

                // Keep top 3, delete rest
                const toDelete = backupFiles.slice(3);
                for (const file of toDelete) {
                  await fse.remove(file.path);
                  console.log(`Rotated old backup: ${file.path}`);
                }
              } catch (e) {
                console.warn('Backup rotation failed', e?.message || e);
              }
            }
          } catch (e) {
            console.warn('Failed to create pre-save backup:', e?.message || e);
          }

          // Atomic write: write to temp file then rename
          try {
            const tmpPath =
              SETTINGS_FILE + '.tmp.' + Date.now() + '.' + Math.floor(Math.random() * 100000);
            await fs.promises.writeFile(tmpPath, JSON.stringify(settings, null, 2), 'utf8');
            await fs.promises.rename(tmpPath, SETTINGS_FILE);
          } catch (e) {
            console.error('atomic write error', e);
            throw e;
          }
        });
      } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
      }

      logAdminAction({ action: 'save_settings', ip: req.ip || req.connection.remoteAddress });
      res.json({ success: true, message: 'Settings saved (node api)' });
    } catch (err) {
      console.error('save_settings error', err);
      // SECURITY: Do not leak internal error details
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Verify reCAPTCHA token server-side
app.post('/api/verify-recaptcha', adminLimiter, async (req, res) => {
  try {
    const { token, action } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'Missing token' });

    // Prefer environment variable for secret; fall back to site settings file (dev only)
    let secret = process.env.RECAPTCHA_SECRET;
    if (!secret) {
      try {
        const settingsFile = path.join(PROJECT_ROOT, 'data', 'site_settings.json');
        if (fs.existsSync(settingsFile)) {
          const raw = fs.readFileSync(settingsFile, 'utf8') || '{}';
          const settings = JSON.parse(raw || '{}');
          secret = settings?.api?.recaptchaSecretKey || '';
        }
      } catch (e) {
        // ignore
      }
    }

    if (!secret)
      return res
        .status(500)
        .json({ success: false, message: 'reCAPTCHA secret not configured on server' });

    // Post to Google's siteverify endpoint
    const postData = querystring.stringify({ secret, response: token });

    const options = {
      hostname: 'www.google.com',
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk));
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          return res.json({
            success: !!parsed.success,
            score: parsed.score,
            action: parsed.action,
            raw: parsed,
          });
        } catch (e) {
          return res
            .status(502)
            .json({ success: false, message: 'Invalid response from reCAPTCHA provider' });
        }
      });
    });

    request.on('error', (err) => {
      console.error('recaptcha request error', err);
      return res.status(502).json({ success: false, message: 'Failed to verify reCAPTCHA' });
    });

    request.write(postData);
    request.end();
  } catch (err) {
    console.error('verify-recaptcha error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Enable/disable theme
app.post('/api/themes/enable', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const { id, enable } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing theme id' });

    const safeId = normalizeThemeId(id);
    if (safeId !== String(id)) {
      return res.status(400).json({ success: false, message: 'Invalid theme id' });
    }

    const list = readData();
    const idx = list.findIndex((t) => t.id === safeId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Theme not found' });

    list[idx].enabled = !!enable;

    // copy or remove public copy
    const src = safeResolveInside(THEMES_DIR, safeId);
    const dst = safeResolveInside(PUBLIC_THEMES, safeId);

    if (list[idx].enabled) {
      if (!(await fse.pathExists(src))) {
        return res.status(404).json({ success: false, message: 'Theme folder not found' });
      }
      await fse.ensureDir(dst);
      await fse.copy(src, dst, { overwrite: true });
    } else {
      if (await fse.pathExists(dst)) {
        await fse.remove(dst);
      }
    }

    writeData(list);
    res.json({ success: true, message: 'Theme updated', id: safeId, enabled: list[idx].enabled });
  } catch (err) {
    console.error('enable error', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// --- AUTH ROUTES ---
// SECURITY: This endpoint should be handled by the PHP backend (public/api/login.php).
// This Node.js mock is ONLY for development when PHP backend is not available.
// DO NOT use hardcoded credentials in production.

app.post('/api/login.php', (req, res) => {
  // In production, this should proxy to PHP backend or return error
  // The real authentication is handled by public/api/login.php which uses database

  console.warn('[SECURITY] Node.js mock login endpoint called. Use PHP backend for production.');

  return res.status(503).json({
    success: false,
    message:
      'Authentication must be handled by PHP backend. Please ensure public/api/login.php is configured and database is set up via the installer wizard.',
  });
});

app.post('/api/update_profile', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const { id, bio, avatar } = req.body;
    // In this mock dev env, we only support updating the main 'admin' user (id 1)
    if (id !== '1' && id !== 1) {
      return res.json({ success: true }); // Just pretend for others
    }

    const SETTINGS_FILE = path.join(PROJECT_ROOT, 'data', 'site_settings.json');
    await fse.ensureDir(path.dirname(SETTINGS_FILE));

    // Read existing
    let settings = {};
    if (await fse.pathExists(SETTINGS_FILE)) {
      settings = await fse.readJson(SETTINGS_FILE);
    }

    // Update adminProfile
    settings.adminProfile = {
      ...(settings.adminProfile || {}),
      bio: bio,
      avatar: avatar,
    };

    // Write back
    await fse.writeJson(SETTINGS_FILE, settings, { spaces: 2 });

    res.json({ success: true, user: { bio, avatar } });
  } catch (e) {
    console.error('update_profile error', e);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

app.post('/api/register.php', (req, res) => {
  return res.json({ success: true, message: 'Mock registration successful.' });
});

app.post('/api/reset_password.php', (req, res) => {
  return res.json({ success: true, message: 'Mock password reset link sent.' });
});

// --- INSTALLATION CHECK (Dev/Node) ---
app.post('/api/install.php', (req, res) => {
  // Simulate DB Connection Delay
  setTimeout(() => {
    const { dbHost, dbName, dbUser, siteTitle, adminEmail } = req.body;

    console.log(`[Mock Install] Connecting to ${dbHost}/${dbName} as ${dbUser}...`);
    console.log(`[Mock Install] Creating Admin: ${adminEmail}`);

    // Return Success
    return res.json({ success: true, message: 'Installation successful (Mock).' });
  }, 1500);
});

// --- USER MANAGEMENT ENDPOINTS (Dev/Node) ---
app.get('/api/get_users', adminLimiter, verifyDevToken, (req, res) => {
  try {
    const usersFile = path.join(PROJECT_ROOT, 'data', 'users.json');
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      return res.json(users);
    }
    // Return default admin if no file
    return res.json([
      {
        id: '1',
        username: 'admin',
        email: 'admin@local.test',
        role: 'Admin',
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error('get_users error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/save_user', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.username)
      return res.status(400).json({ success: false, message: 'Invalid user data' });

    const safeUser = sanitizeRecursive(user);
    const usersFile = path.join(PROJECT_ROOT, 'data', 'users.json');
    await fse.ensureDir(path.dirname(usersFile));

    let users = [];
    if (fs.existsSync(usersFile)) {
      try {
        users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      } catch (e) {}
    } else {
      // Init with default admin if creating fresh file
      users.push({
        id: '1',
        username: 'admin',
        email: 'admin@local.test',
        role: 'Admin',
        created_at: new Date().toISOString(),
      });
    }

    if (safeUser.id) {
      // Update existing
      const idx = users.findIndex((u) => String(u.id) === String(safeUser.id));
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...safeUser };
      } else {
        // ID provided but not found, treat as new? Or error? Let's treat as new if explicit ID passed
        users.push(safeUser);
      }
    } else {
      // Create new
      safeUser.id = Date.now().toString();
      safeUser.created_at = new Date().toISOString();
      users.push(safeUser);
    }

    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
    return res.json({ success: true, id: safeUser.id, message: 'User saved' });
  } catch (err) {
    console.error('save_user error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/delete_user', adminLimiter, verifyDevToken, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Missing user ID' });

    if (String(id) === '1')
      return res.status(403).json({ success: false, message: 'Cannot delete root admin' });

    const usersFile = path.join(PROJECT_ROOT, 'data', 'users.json');
    if (!fs.existsSync(usersFile))
      return res.status(404).json({ success: false, message: 'User database not found' });

    let users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const newUsers = users.filter((u) => String(u.id) !== String(id));

    fs.writeFileSync(usersFile, JSON.stringify(newUsers, null, 2), 'utf8');
    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('delete_user error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bind server explicitly to localhost and attempt fallback ports when busy.
function startServer(port, attempt = 0) {
  if (!IS_LOOPBACK_HOST && !ADMIN_SAVE_TOKEN) {
    console.error('Refusing external Themes API binding without ADMIN_SAVE_TOKEN.');
    process.exit(1);
  }

  try {
    const server = app.listen(port, HOST, () => {
      console.log(`Themes API listening on http://${HOST}:${port}`);
      process.env.THEMES_API_PORT = String(port);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attempt < 10) {
        const nextPort = port + 1;
        console.warn(`Port ${port} in use, trying ${nextPort} (attempt ${attempt + 1})`);
        setTimeout(() => startServer(nextPort, attempt + 1), 200);
      } else {
        console.error('Server failed to start:', err && err.stack ? err.stack : err);
        process.exit(1);
      }
    });
  } catch (e) {
    console.error('startServer error', e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

const initialPort = process.env.THEMES_API_PORT
  ? Number(process.env.THEMES_API_PORT)
  : Number(PORT);
startServer(initialPort);
