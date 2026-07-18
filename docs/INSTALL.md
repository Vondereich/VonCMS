# Installation Guide

> **VonCMS v1.25.11 "OpenGate"**

---

Need the shortest first-run checklist? Start with the root [README](../README.md). This guide explains the hosting path in more detail.

For product positioning and feature coverage, read [Features](FEATURES.md).

## Requirements

VonCMS runs on a standard **LAMP** stack:

| Requirement | Minimum |
| ----------- | ------- |
| PHP         | 8.2+    |
| MySQL       | 5.7+    |
| Storage     | 50MB    |

**Server:** Apache (required for `.htaccess` routing)
**Hosting:** cPanel (Apache), DirectAdmin (Apache), WAMP, XAMPP, Laragon

> **Important:** VonCMS uses `.htaccess` for normal shared-hosting routing. This requires **Apache**, **LiteSpeed**, or **Apache behind an Nginx proxy** (common on cPanel/DirectAdmin). If your hosting runs **Nginx-only** with no Apache/LiteSpeed layer, `.htaccess` rules are ignored and routing/protection rules must be added manually. Ask your host which stack they use, or refer to the [VPS Guide](VPS.md) for Nginx config parity.

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

### Subfolder crawler files

Search crawlers only treat the host-root `/robots.txt` as authoritative. If VonCMS is installed
under a path such as `example.com/blog`, configure the parent virtual host or root application so
`https://example.com/robots.txt` serves the VonCMS policy or references
`https://example.com/blog/sitemap.xml`. The bundled `/blog/robots.txt` route remains useful for
inspection, but it cannot replace host-root robots configuration.

### Step 1: Upload

1. Download the latest VonCMS Deploy package. For v1.25.11, the file is `VonCMS_v1.25.11_Deploy.zip`.
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

This guide is for fresh installs. For OTA updates, manual Deploy ZIP replacement, `.htaccess` repair, and rollback steps, read [Upgrade](UPGRADE.md).

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

_VonCMS v1.25.11 "OpenGate"_
