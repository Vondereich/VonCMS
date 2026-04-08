# Installation Guide

> **VonCMS v1.22.0 "Kirana"**

---

## What is VonCMS?

VonCMS is a modern content management system built with React and PHP. It combines the feel of a Single-Page Application (SPA) with the deployment model of a traditional PHP CMS.

### Why VonCMS?

| Feature               | Benefit                                                      |
| --------------------- | ------------------------------------------------------------ |
| **Fast Frontend**     | React + Vite keep the public UI and dashboard responsive     |
| **Easy Install**      | Wizard-based setup with no manual code edits required        |
| **Bundled Themes**    | Six built-in themes included                                 |
| **Ad Ready**          | Built-in ad zones, including AdSense-friendly placements     |
| **Mobile Friendly**   | Responsive on phones, tablets, and desktop                   |
| **Security Baseline** | Session protection, CSRF checks, and XSS guardrails included |

---

## Requirements

| Requirement | Minimum |
| ----------- | ------- |
| PHP         | 8.2+    |
| MySQL       | 5.7+    |
| Storage     | 50MB    |

Works on: cPanel, VPS, XAMPP, WAMP

---

## Quick Install

### Step 1: Upload

1. Download `Deploy.zip`
2. Upload to hosting (`public_html`) or localhost (`htdocs`)
3. Extract all files

> **Shared Hosting Note:** If your target folder already contains a host-generated `.htaccess` (for example from cPanel, LiteSpeed, or an older subfolder site), back it up first before running the installer. A fresh VonCMS install writes its own `.htaccess` template during setup.

### Step 2: Create Database

1. Open **phpMyAdmin**
2. Click **New** &rarr; Enter name &rarr; **Create**

### Step 3: Run Installer

1. Open your site URL in browser
2. Installer Wizard starts automatically
3. Fill in:

| Field          | Example           |
| -------------- | ----------------- |
| DB Host        | `localhost`       |
| DB Name        | `my_site`         |
| DB User        | `root`            |
| DB Password    | _(your password)_ |
| Admin Username | `admin`           |
| Admin Email    | `admin@site.com`  |
| Admin Password | `MyP@ss123!`      |

> **Password:** 8+ chars, 1 uppercase, 1 number, 1 symbol

4. Click **Install Now**
5. Done! Login at `yoursite.com/admin`

> **PHP Version Changes Later:** After the site is installed, changing PHP version in cPanel may add or update handler rules inside `.htaccess`. If you later run **Integrity Fix**, VonCMS creates a `.bak` backup first and repairs only the VonCMS-managed routing block.

---

## Updating VonCMS

Current VonCMS releases support OTA updates from the admin dashboard.

### One-Click OTA Update (Recommended)

1. Login to your Admin Dashboard.
2. Go to **Settings > System**.
3. Click **"Check for Updates"**.
4. If available, click **"Update Now"**.

### Manual Update (Fallback)

If the auto-updater fails or your server creates permission errors, follow these steps:

1. **Backup**: Download your `uploads/` folder and your live `von_config.php`.
2. **Clean**: Delete the `assets/` folder in your hosting to prevent stale asset conflicts.
3. **Use the current Deploy.zip package** and overwrite the existing deployment files.
4. **Verify `.htaccess` carefully** if your hosting folder already contains cPanel-generated handlers, custom redirects, or any host-managed rewrite rules. Restore your backup or the generated `.bak` copy if extraction changed something you needed to keep.
5. **Keep your real config**: do not replace your live `von_config.php` with a sample file.
6. **Verify**: Hard refresh your browser (`Ctrl+Shift+R`).

---

## Troubleshooting

| Problem              | Solution                                         |
| -------------------- | ------------------------------------------------ |
| White page           | Enable `mod_rewrite` in Apache                   |
| Permission error     | Folders: `755`, Files: `644`                     |
| DB connection failed | Check credentials in phpMyAdmin                  |
| Old version showing  | Delete `assets/` folder, re-upload, hard refresh |

---

_VonCMS v1.22.0 "Kirana"_
