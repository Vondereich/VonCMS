# Installation Guide

> **VonCMS v1.23.7 "Rentaka"**

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

VonCMS runs on a standard **LAMP** stack:

| Requirement | Minimum |
| ----------- | ------- |
| PHP         | 8.2+    |
| MySQL       | 5.7+    |
| Storage     | 50MB    |

**Server:** Apache (required for `.htaccess` routing)
**Hosting:** cPanel (Apache), DirectAdmin (Apache), WAMP, XAMPP, Laragon

> **Important:** VonCMS uses `.htaccess` for routing. This requires **Apache** or **Apache behind Nginx proxy** (common on cPanel/DirectAdmin). If your hosting runs **Nginx-only** (no Apache), `.htaccess` rules are ignored and assets will return 403 — the site will appear broken. Ask your host if they use Apache, or refer to the [VPS Guide](VPS.md) for manual Nginx config.

---

## Local Testing

### XAMPP / WAMP (Recommended)

- **XAMPP** is the easiest baseline — phpMyAdmin included out of the box.
- **WAMP** offers easier PHP version switching for `8.4+` testing.

### Laragon

Laragon is lightweight but requires a small manual step:

1. **Download phpMyAdmin** from [phpmyadmin.net](https://www.phpmyadmin.net/)
2. **Extract** to `C:\laragon\etc\apps\phpMyAdmin`
3. **Start Laragon** → **Start All** (Apache + MySQL/MariaDB)
4. **Access phpMyAdmin** → `http://localhost/phpmyadmin`
5. **Connect via database manager** (HeidiSQL/other):
   - **Connection type:** TCP/IP
   - **Host:** `localhost`
   - **Port:** `3306`
   - **Username:** `root`
   - **Password:** _(leave empty)_

> **Default DB credentials:** Host: `localhost`, User: `root`, Password: _(empty)_. MariaDB is fully compatible with VonCMS (uses standard `mysql:` PDO DSN).

---

## Quick Install

### Step 1: Upload

1. Download the latest VonCMS Deploy package
2. Upload to hosting (`public_html`) or localhost (`htdocs`)
3. For Laragon: extract to `C:\laragon\www\your-project`

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
3. **Use the latest VonCMS Deploy package** and overwrite the existing deployment files.
4. **Verify `.htaccess` carefully** if your hosting folder already contains cPanel-generated handlers, custom redirects, or any host-managed rewrite rules. Restore your backup or the generated `.bak` copy if extraction changed something you needed to keep.
5. **Keep your real config**: do not replace your live `von_config.php` with a sample file.
6. **Verify**: Hard refresh your browser (`Ctrl+Shift+R`).

---

## Troubleshooting

| Problem                                     | Solution                                         |
| ------------------------------------------- | ------------------------------------------------ |
| White page                                  | Enable `mod_rewrite` in Apache                   |
| Permission error                            | Folders: `755`, Files: `644`                     |
| DB connection failed                        | Check credentials in phpMyAdmin                  |
| Old version showing                         | Delete `assets/` folder, re-upload, hard refresh |
| Images broken on frontend but work in admin | File permission is `600` — change to `644`       |

### File Permissions

VonCMS sets `644` on uploaded files automatically. If images appear broken on the public site after manual upload:

```bash
# Fix all files in uploads/
find uploads/ -type f -exec chmod 644 {} +
# Fix all directories
find uploads/ -type d -exec chmod 755 {} +
```

Or via FTP/File Manager: right-click the file → Permissions → set to `644`.

---

_VonCMS v1.23.7 "Rentaka"_
