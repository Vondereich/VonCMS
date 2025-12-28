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
your-site/
├── public/
│   ├── api/
│   └── uploads/
├── dist/
└── von_config.php
```

**New Structure (v1.8.5+):**
```
your-site/
├── api/          ← Moved out of public/
├── uploads/      ← Moved out of public/
├── assets/       ← Frontend files
├── index.html
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
> You **MUST** delete the old installation folder completely.

**Why?** Old `public/` folder conflicts with new structure.

**How:**
1. Login to cPanel File Manager or FTP
2. Navigate to your site folder
3. Delete all files (after Step 1 backup!)

#### Step 3: 📤 Upload New Version

1. Download `VonCMS_v1.8.5_Deploy.zip`
2. Extract to a **CLEAN** folder location
3. Upload to your server (where old installation was)

#### Step 4: ⚙️ Restore Your Config

1. Copy your backed-up `von_config.php` into your site folder
2. Overwrite the dummy config file

#### Step 5: 📁 Restore Uploads (Optional)

If you had custom uploaded media:
1. Copy your backed-up `uploads/` folder contents
2. Paste into the new `uploads/` folder

#### Step 6: 🔧 Update .htaccess (If Needed)

If site is in subdirectory (e.g., `/my-folder/`):

> [!NOTE]
> **v1.8.6+ users:** You can skip this. The new `.htaccess` auto-detects subdirectories.

**For older versions only:**
1. Open `.htaccess` file
2. Update `RewriteBase` to match your path:
   ```apache
   RewriteBase /my-folder/
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

### 3 Simple Steps

1. **Delete** the `assets/` folder from your server
2. **Upload** the new version files (overwrite existing)
3. **Refresh** your browser (`Ctrl + Shift + R`)

That's it! Your `von_config.php` and `uploads/` folder will stay intact.

> [!TIP]
> **Why delete assets/?** VonCMS generates new asset filenames each build. Old files can cause display issues if not removed.

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

## Upgrade to v1.8.6

This version adds dynamic SEO files (`robots.txt` & `sitemap.xml`).

### Steps:
1. Delete `assets/` folder
2. Upload new files (overwrite all)
3. **Important:** Also overwrite `.htaccess` - it has new routing rules
4. Refresh browser (`Ctrl + Shift + R`)

---

## Getting Help

- **Documentation:** Check `docs/` folder in Source package
- **Community:** [Your forum/Discord URL]
- **Issues:** [Your GitHub Issues URL]

---

**Version:** 1.8.6  
**Release Date:** December 2025  
**Package:** Deploy Edition

© VonCMS - Modern Content Management System
