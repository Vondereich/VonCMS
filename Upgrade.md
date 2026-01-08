# VonCMS Upgrade Guide

> **Current Version:** v1.10.x "Solana"

---

## 📋 Table of Contents

1. [🚀 Auto-Update (Recommended)](#auto-update-recommended)
2. [📦 Manual Upgrade (Fallback)](#manual-upgrade-minor-versions)
3. [❓ Troubleshooting](#troubleshooting)
4. [📚 Legacy Upgrade Guide](#legacy-versions)

---

## Auto-Update (Recommended)

> **Available in v1.10.0+** | One-Click OTA Updates

### How It Works:

1. Login to **Admin Dashboard**.
2. If an update is available, you will see an **"Update Available!"** banner.
3. Click **"Update Now"**.
4. Follow the on-screen progress bar.
5. **Done!** Site reloads automatically with the new version.

### 🛡️ Safety Mechanisms
- **Protected Files**: `von_config.php`, `uploads/`, and `.htaccess` are **never** touched.
- **Auto-Backup**: The system creates a temporary backup before patching.
- **Validation**: Checks for valid GitHub signatures before downloading.

### ⚠️ If Auto-Update Fails
If the update fails (e.g., due to **Disk Space Full**, **Permissions**, or **Timeout**), don't panic! Your site content is safe.
Simply use the **Manual Upgrade** method below.

---

## Manual Upgrade (Minor Versions)

**Use this method if Auto-Update fails.**
(e.g., updating from v1.10.0 → v1.10.1)

### 3 Simple Steps:

1. **Delete** the `assets/` folder from your server.
   > _Critical! Old assets can cause display issues._
2. **Upload** the new version contents to your server (Overwrite existing files).
   > _Safe to overwrite! Config and Uploads are not included in the zip._
3. **Refresh** your browser (`Ctrl + Shift + R`).

That's it!

---

## Troubleshooting

### "Page Not Found / 404"
- Ensure `.htaccess` exists.
- Contact hosting support to enable `mod_rewrite`.

### "Database Connection Failed"
- Verify `von_config.php` credentials.
- Ensure database user has permissions.

### White Screen After Update
- **Cause:** You likely forgot to delete the `assets/` folder.
- **Fix:** Delete `assets/` manually, re-upload the new `assets/` folder, and clear browser cache.

### Update Stuck / Timeout
- **Cause:** Slow server or strict firewall.
- **Fix:** Use the **Manual Upgrade** method above.

---

## Legacy Versions

Upgrading from an older version (v1.8.x, v1.9.x)?
Please refer to the **[Legacy Upgrade Archive](UPGRADE_ARCHIVE.md)** for specific instructions.

---

**Version:** 1.10.x "Solana"
**Release Date:** January 2026
**Package:** Deploy Edition

© VonCMS - Modern Content Management System
