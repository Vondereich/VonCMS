# VonCMS Upgrade Guide

> [!CAUTION]
> **CRITICAL: Read this BEFORE upgrading from v1.8.1 - v1.8.4**

---

## 📋 Table of Contents

1. [Major Version Upgrade (v1.8.1-1.8.4 → v1.8.5)](#major-version-upgrade)
2. [Minor Version Upgrade (v1.8.5 → v1.8.6+)](#minor-version-upgrade)
3. [Troubleshooting](#troubleshooting)
4. [What's New in v1.8.5](#whats-new)

---

## Major Version Upgrade

**Required for:** v1.8.1, v1.8.2, v1.8.3, v1.8.4 → v1.8.5

> [!IMPORTANT]
> VonCMS v1.8.5 has a **NEW FOLDER STRUCTURE**. You MUST follow the clean install process below.

### What Changed?

**Old Structure (v1.8.1-v1.8.4):**
```
VonCMS/
├── public/
│   ├── api/
│   └── uploads/
├── dist/
└── von_config.php
```

**New Structure (v1.8.5):**
```
VonCMS/
├── api/          ← Moved from public/api/
├── uploads/      ← Moved from public/uploads/
├── assets/       ← Built frontend assets
├── index.html    ← Entry point
└── von_config.php
```

---

### Upgrade Steps

#### Step 1: 🛡️ Backup Your Data

Before doing **ANYTHING**:

- ✅ **Backup MySQL database** (phpMyAdmin → Export)
- ✅ **Copy `von_config.php`** to safe location
- ✅ **Backup `uploads/` folder** (optional, if you have custom media)

#### Step 2: 🗑️ Delete Old Installation

> [!WARNING]
> You **MUST** delete the old VonCMS folder completely.

**Why?**
- Old `public/` folder conflicts with new structure
- Security risk (old unpatched API files still accessible)
- Routing issues (Apache may serve old files)

**How:**
1. Login to cPanel File Manager or FTP
2. Navigate to your VonCMS folder
3. **DELETE THE ENTIRE FOLDER** (after Step 1 backup!)

#### Step 3: 📤 Upload New Version

1. Download `VonCMS_v1.8.5_Deploy.zip`
2. Extract to a **CLEAN** folder location
3. Upload to your server (where old installation was)

#### Step 4: ⚙️ Restore Your Config

1. Copy your backed-up `von_config.php`
2. Paste into new VonCMS root folder
3. Overwrite the dummy config file

#### Step 5: 📁 Restore Uploads (Optional)

If you had custom uploaded media:
1. Copy old `uploads/` folder contents
2. Paste into new `VonCMS/uploads/` folder

#### Step 6: 🔧 Update .htaccess (If Needed)

If site is in subdirectory (e.g., `/voncms/`):
1. Open `.htaccess` file
2. Update `RewriteBase` to match your path:
   ```apache
   RewriteBase /voncms/
   ```

#### Step 7: ✅ Verify Installation

1. Visit your site URL
2. Login to admin panel
3. Check Dashboard → **"Platform Version 1.8.5"**
4. Test creating/editing a post
5. Test WordPress Bridge (if migrating from WP)

---

## Minor Version Upgrade

**For:** v1.8.5 → v1.8.6, v1.8.7, etc.

> [!CAUTION]
> **ALWAYS delete the `assets/` folder before uploading new version!**

### Quick Upgrade Steps

1. **Backup database** (recommended, optional for minor updates)
2. **Keep** your `von_config.php` and `uploads/` folder
3. **DELETE** the `assets/` folder from server
4. Upload new version files (overwrite existing)
5. **Clear browser cache** (`Ctrl + Shift + R`)

### Why Delete assets/?

**Zombie Files Problem:**
- VonCMS is a Single Page App (SPA)
- Asset filenames change every build (e.g., `index-a1b2.js` → `index-c3d4.js`)
- Old files remain and conflict with new ones
- Causes: white screen, display bugs, broken features

> [!TIP]
> The Dashboard shows an "Upgrade Tip" banner reminding you to delete assets folder after each update.

### Alternative: Full Clean Install

If you prefer maximum safety:
- Follow Steps 1-7 from [Major Version Upgrade](#major-version-upgrade)
- Takes more time but guarantees clean installation

---

## Troubleshooting

### "Page Not Found" Errors

**Solution:**
- Check `.htaccess` `RewriteBase` matches installation path
- Ensure `mod_rewrite` is enabled on server
- Contact hosting support if needed

### "Database Connection Failed"

**Solution:**
- Verify `von_config.php` has correct credentials
- Check if database host is `localhost` or specific IP
- Ensure database user has proper permissions

### Old Version Still Showing (e.g., v1.8.4)

**Solution:**
- Clear browser cache (`Ctrl + Shift + R`)
- Verify old folder was deleted completely
- Check extracted correct zip (v1.8.5, not old version)

### Missing Uploads/Images

**Solution:**
- Ensure `uploads/` folder was copied to new location
- Check file permissions (755 for folders, 644 for files)

### Admin Panel Not Loading

**Solution:**
- Clear browser cache and cookies
- Check browser console for JavaScript errors
- Try different browser to isolate issue

### White Screen After Update

**Solution:**
- **You forgot to delete `assets/` folder!**
- Delete it now, re-upload new version
- Clear browser cache

---

## What's New

### 🚀 VonCMS v1.8.5 Features

#### WordPress Bridge
- One-click migration from WordPress WXR export
- Batch processing for large sites
- Automatic duplicate detection
- Featured image extraction

#### Enhanced Security
- Multi-layer authentication (Session + CSRF + Admin)
- Defense-in-depth architecture
- Production-hardened API endpoints

#### Performance Improvements
- Optimized build system
- Better memory management
- Faster page loads

---

## Getting Help

- **Documentation:** Check `docs/` folder in Source package
- **Community:** [Your forum/Discord URL]
- **Issues:** [Your GitHub Issues URL]

---

**Version:** 1.8.5  
**Release Date:** December 2025  
**Package:** Deploy Edition

© VonCMS - Modern Content Management System
