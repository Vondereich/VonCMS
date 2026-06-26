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
const cors = require('cors');
app.use(cors());
app.use(express.json());

const PROJECT_ROOT = path.resolve(__dirname, '..');
const THEMES_DIR = path.join(PROJECT_ROOT, 'themes');
const DATA_FILE = path.join(PROJECT_ROOT, 'data', 'themes.json');
const PUBLIC_THEMES = path.join(PROJECT_ROOT, 'public', 'themes');

fse.ensureDirSync(THEMES_DIR);
fse.ensureDirSync(path.dirname(DATA_FILE));
fse.ensureFileSync(DATA_FILE);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, THEMES_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-z0-9_.-]/gi, '_'));
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
app.post('/api/themes/upload', upload.single('theme'), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded (field name "theme")' });

    const { originalname, path: uploadedPath, size } = req.file;
    const name = req.body.name || path.parse(originalname).name;
    const version = req.body.version || '0.0.0';
    const uploadedBy = req.body.uploadedBy || 'admin';

    const ext = path.extname(originalname).replace('.', '').toLowerCase();
    const allowed = ['zip', 'css', 'js'];
    if (!allowed.includes(ext)) {
      // remove uploaded file
      await fse.remove(uploadedPath);
      return res
        .status(400)
        .json({ success: false, message: 'Unsupported file type. Allowed: zip, css, js' });
    }

    const idBase = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const id = `${idBase}_${Date.now()}`;
    const destDir = path.join(THEMES_DIR, id);
    await fse.ensureDir(destDir);

    const destPath = path.join(destDir, originalname);
    await fse.move(uploadedPath, destPath, { overwrite: true });

    // If zip, extract
    if (ext === 'zip') {
      try {
        const zip = new AdmZip(destPath);
        zip.extractAllTo(destDir, true);
        await fse.remove(destPath); // remove zip after extract
      } catch (err) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to extract zip archive', error: err.message });
      }
    }

    const checksum = computeChecksum(path.join(destDir, fs.readdirSync(destDir)[0] || destPath));

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

    return res.json({ success: true, message: 'Theme uploaded', theme: meta });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// List themes
app.get('/api/themes', (req, res) => {
  const list = readData();
  res.json(list);
});

// Enable/disable theme
app.post('/api/themes/enable', async (req, res) => {
  try {
    const { id, enable } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing theme id' });

    const list = readData();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Theme not found' });

    list[idx].enabled = !!enable;

    // copy or remove public copy
    const src = path.join(PROJECT_ROOT, list[idx].folder);
    const dst = path.join(PUBLIC_THEMES, id);

    if (list[idx].enabled) {
      await fse.ensureDir(dst);
      await fse.copy(src, dst, { overwrite: true });
    } else {
      if (await fse.pathExists(dst)) {
        await fse.remove(dst);
      }
    }

    writeData(list);
    res.json({ success: true, message: 'Theme updated', id, enabled: list[idx].enabled });
  } catch (err) {
    console.error('enable error', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Sync CSS/custom assets to public theme folder
app.post('/api/themes/sync', async (req, res) => {
  try {
    const { id, css } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing theme id' });

    const list = readData();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Theme not found' });

    const dst = path.join(PUBLIC_THEMES, id);
    await fse.ensureDir(dst);

    const cssPath = path.join(dst, 'styles.css');
    await fs.promises.writeFile(cssPath, css || '', 'utf8');

    list[idx].lastSyncedAt = new Date().toISOString();
    writeData(list);

    res.json({ success: true, message: 'Theme synced to public folder', id });
  } catch (err) {
    console.error('sync error', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Persist site settings (used for local dev)
app.post('/api/save_settings', async (req, res) => {
  try {
    const settings = req.body || {};
    const SETTINGS_FILE = path.join(PROJECT_ROOT, 'data', 'site_settings.json');
    await fse.ensureDir(path.dirname(SETTINGS_FILE));
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    res.json({ success: true, message: 'Settings saved (node api)' });
  } catch (err) {
    console.error('save_settings error', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`Themes API listening on http://localhost:${PORT}`));
