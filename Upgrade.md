# VonCMS Upgrade Guide

> [!CAUTION]
> **CRITICAL: Read this BEFORE upgrading from v1.8.x**

---

## 📋 Table of Contents

1. [Major Version Upgrade (v1.8.x → v1.9.0)](#major-version-upgrade)
2. [Minor Version Upgrade (v1.9.0 → v1.9.x)](#minor-version-upgrade)
3. [Troubleshooting](#troubleshooting)
4. [What's New in v1.8.5](#whats-new)

---

## Major Version Upgrade

**Required for:** v1.8.x → v1.9.0

> [!IMPORTANT]
> VonCMS v1.9.0 maintains the v1.8.5+ folder structure but requires a **clean assets update** to enable the new Skeleton Loader UX.

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

> [!TIP]
> **Why Upgrade is Safe:** The VonCMS deployment package **does not** contain `von_config.php` or the `uploads/` folder.
> This means you can drag-and-drop the new version into your server without worrying about overwriting your database connection or images.
>
> **But... Backup Anyway:**
> We still recommend a quick backup just to "satisfy the OCD" and sleep better at night. 🛌💤

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
> **v1.8.7+ users:** You can skip this. The new `.htaccess` auto-detects subdirectories.

**For older versions only:**
1. Open `.htaccess` file
2. Update `RewriteBase` to match your path:
   ```apache
   RewriteBase /my-folder/
   ```

#### Step 7: ✅ Verify Installation

1. Visit your site URL
2. Login to admin panel
3. Check Dashboard → **"Platform Version 1.9.0"**
4. Test creating/editing a post
5. Test WordPress Bridge (if migrating from WP)

---

## Minor Version Upgrade

**For:** v1.9.0 → v1.9.1, etc.

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

## Upgrade to v1.9.0 (Rafflesia)

This version introduces the **Smart Skeleton Loader** for instant perceived performance.

### Steps:
1. **Delete `assets/` folder** (Critical for new CSS/JS loader logic)
2. Upload new files (overwrite all)
3. **Overwrite `index.html`** (Contains the new skeleton HTML structure)
4. Refresh browser (`Ctrl + Shift + R`)

---

## Upgrade to v1.9.2 (Newsletter Release)

This version adds the **Newsletter System** with subscriber management.

> [!IMPORTANT]
> **Existing users upgrading from v1.8.x or v1.9.0/v1.9.1** must run the newsletter migration SQL.

### Steps:

#### Step 1: Upload New Files
1. Delete `assets/` folder
2. Upload new files (overwrite all)
3. Overwrite `index.html`

#### Step 2: Run Newsletter Migration SQL

> [!CAUTION]
> **REQUIRED** for newsletter functionality to work!

**Option A: Via VonCMS Database Manager (Easiest)**
1. Login to VonCMS Admin Panel
2. Go to **Database** → **Query Editor**
3. Paste this SQL and click **Execute**:

```sql
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    status ENUM('active', 'unsubscribed') DEFAULT 'active',
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME NULL,
    ip_address VARCHAR(45),
    source VARCHAR(50) DEFAULT 'widget',
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_subscribed_at (subscribed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Option B: Via phpMyAdmin**
1. Login to phpMyAdmin
2. Select your VonCMS database
3. Go to **SQL** tab
4. Paste and run the SQL above

**Option C: Via Migration File**
(See Option A - SQL is provided above)

#### Step 3: Verify
1. Visit Admin → Newsletter
2. If page loads without errors, you're done!

---

## Upgrade to v1.9.3 (Config & Security)

This version introduces **Auto-Log Creation**, **Secure Session Wrappers**, and **API Error Shielding**.

> [!IMPORTANT]
> Your existing `von_config.php` will work fine, but upgrading it is **HIGHLY RECOMMENDED** for better security and stability.

### How to Upgrade Config Manually:

Since the update process preserves your old config, you must do this manually:

1.  **Backup** your current `von_config.php` (Rename to `von_config_old.php`).
2.  **Find** `von_config.sample.php` in your **Downloaded ZIP** (Deploy Version).
3.  **Rename** it to `von_config.php`.
4.  **Edit** the new `von_config.php`:
    -   Find `$db_name = '';` and change it to your database name (e.g., `'pulutdb'`).
    -   If you have a database password, fill it in `$db_pass`.
4.  **Save & Upload**.

**Benefits:**
-   **Auto-Logs:** Automatically creates `logs/` folder if missing (No more silent errors).
-   **API Shield:** Prevents "Unexpected Token" JSON errors if PHP throws warnings.
-   **Conflict Safety:** Functions are wrapped to prevent crashes with plugins.

---

## Upgrade to v1.9.5 (Standardization & Security)

This is a **Quality of Life & Security** update. It standardizes how themes work (Profile Tabs, Popups) and patches a high-severity vulnerability in the core system.

### Steps:

1.  **Delete `assets/` folder** from your server.
    *   *Why?* New hook logic requires fresh JavaScript bundles.
2.  **Upload new files** (Overwrite all).
3.  **Refresh browser** (`Ctrl + Shift + R`).

**No database migration required.** Your existing data is safe.

---

## Upgrade to v1.9.7 (Final Polish)

This version includes **Dark Mode Fixes** for TechPress/Portfolio themes, **Security Hardening** (Honeypot, XXE), and **Roadmap Updates**.

### Steps:

1.  **Delete `assets/` folder** from your server.
2.  **Upload new files** (Overwrite all).
3.  **Refresh browser** (`Ctrl + Shift + R`).

**No database migration required.**

---

## Getting Help

- **Documentation:** Check `docs/` folder in Source package
- **Support:** Email kurama87@gmail.com

---

**Version:** 1.9.7 "Rafflesia"
**Release Date:** January 2026  
**Package:** Deploy Edition

© VonCMS - Modern Content Management System
