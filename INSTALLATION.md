# Installation Guide

> **VonCMS v1.21.2 "Breeze"**

---

## What is VonCMS?

VonCMS is a modern, ultra-fast Content Management System built with React and PHP. It combines the speed of a Single-Page Application (SPA) with the simplicity of traditional CMS platforms.

### Why VonCMS?

| Feature               | Benefit                                  |
| --------------------- | ---------------------------------------- |
| ⚡ **Blazing Fast**   | React + Vite for instant page loads      |
| 🔌 **Easy Install**   | No coding required, wizard-based setup   |
| 🎨 **Premium Themes** | TechPress, Prism, Default included       |
| 💰 **Ads Ready**      | Built-in ad zones (AdSense compatible)   |
| 📱 **Mobile-First**   | Responsive on all devices                |
| 🔒 **Secure**         | Session protection, CSRF, XSS prevention |

---

## Requirements

| Requirement | Minimum |
| ----------- | ------- |
| PHP         | 8.2+    |
| MySQL       | 5.7+    |
| Storage     | 50MB    |

✅ Works on: cPanel, VPS, XAMPP, WAMP

---

## Quick Install (5 Minutes)

### Step 1: Upload

1. Download `Deploy.zip`
2. Upload to hosting (`public_html`) or localhost (`htdocs`)
3. Extract all files

> **Shared Hosting Note:** If your target folder already contains a host-generated `.htaccess` (for example from cPanel, LiteSpeed, or an older subfolder site), back it up first before running the installer. A fresh VonCMS install writes its own `.htaccess` template during setup.

### Step 2: Create Database

1. Open **phpMyAdmin**
2. Click **New** → Enter name → **Create**

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

Good news! Starting from **v1.11.x**, updating is automatic.

### One-Click OTA Update (Recommended)

1.  Login to your Admin Dashboard.
2.  Go to **Settings > System**.
3.  Click **"Check for Updates"**.
4.  If available, click **"Update Now"**.

### Manual Update (Fallback)

If the auto-updater fails or your server creates permission errors, follow these steps:

1.  **Backup**: Download your `uploads/` folder and `von_config.php`.
2.  **Clean**: Delete the `assets/` folder in your hosting (Crucial to prevent cache conflicts!).
3.  **Pick the right ZIP**:
    - Use `Deploy.zip` if the site still uses the default VonCMS `.htaccess` and standard routing rules.
    - Use `Upgrade.zip` if the site has cPanel-generated PHP handlers, custom `.htaccess` rules, hardcoded redirects, or any host-level rewrite rules you want to preserve.
4.  **Upload**: Upload the chosen package and overwrite existing files.
5.  **Verify**: Hard refresh your browser (`Ctrl+Shift+R`).

---

## Troubleshooting

| Problem              | Solution                                         |
| -------------------- | ------------------------------------------------ |
| White page           | Enable `mod_rewrite` in Apache                   |
| Permission error     | Folders: `755`, Files: `644`                     |
| DB connection failed | Check credentials in phpMyAdmin                  |
| Old version showing  | Delete `assets/` folder, re-upload, hard refresh |

---

_VonCMS v1.21.2 "Breeze"_
