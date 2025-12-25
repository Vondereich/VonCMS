# Upgrade Guide

> [!CAUTION]
> # **CRITICAL: READ BEFORE UPGRADING**
>
> **YOU MUST DELETE THE `assets/` FOLDER FROM YOUR SERVER BEFORE UPLOADING THE NEW VERSION.**
>
> If you overwrite the `assets` folder instead of deleting it, **your site will break** (white screen, display errors) because old JavaScript files will conflict with the new ones.

---

## How to Upgrade VonCMS

### 1. 🛑 Backup First
1.  **Download your `uploads/` folder** (This contains your images/media).
2.  **Export your database** using database manager or phpMyAdmin.

### 2. 🗑️ Delete `assets/` Folder
1.  Go to your File Manager (cPanel or Localhost).
2.  Find the `assets` folder in your `public_html` or root directory.
3.  **DELETE IT COMPLETELY.**

### 3. 📤 Upload New Version
1.  Download the **VonCMS_Deploy.zip** for the new version.
2.  Extract the files.
3.  Upload/Copy all new files to your server.
    *   *It is safe to overwrite `index.php`, `index.html`, etc.*
    *   **Don't Worry:** This will NOT delete your `von_config.php` or `uploads/` folder because the update zip does not contain these files.
    *   *However, do NOT manually delete your `uploads/` folder unless you have a backup.*

### 4. ✅ Verify
1.  Visit your website.
2.  **Hard Refresh** by pressing `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac) to clear the browser cache.
3.  Login to Admin Dashboard and check the version number at the bottom.

---

### FAQ

**Q: Why do I need to delete `assets`?**
A: **To prevent "Zombie Files".**
VonCMS is a Single Page Application (SPA). Filenames change with every update (e.g., `index-a1b2.js` becomes `index-c3d4.js`). If you don't delete the old folder, these "dead" files remain on your server ("Zombie Files") and can conflict with the new version, causing crashes or weird visual bugs.

**Q: Will I lose my data?**
A: **No.** Your data is in the database. Deleting the `assets` folder only removes the application code, not your content. Just make sure you **don't** delete your `uploads` folder unless you have a backup.
