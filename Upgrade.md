# 🔄 VonCMS Upgrade Guide

> [!TIP]
> **Good News:** Starting from v1.10.0, manual upgrades are a thing of the past!
> Use the **One-Click Update** feature in your Admin Dashboard under **Settings > System**.

---

## 🚀 Scenario A: Updating to v1.21.0 (Breeze Series)

**Focus: Performance & UI Refinement — TechPress & PHP 8.5**

1.  **Update Files**: Use **One-Click Update** (Dashboard > Settings > System).
2.  **Verify UI**: Check the **TechPress** hero section on desktop. Vertical gaps should now be perfectly eliminated.
3.  **PHP Readiness**: The system is now fully compatible with **PHP 8.5+** expectations regarding cURL handles.

---

## 🚀 Scenario B: Updating to v1.20.12 (Mandala Hardening)

**Focus: Phase 2 Security Hardening — Installer & Comments**

1.  **Update Files**: Use **One-Click Update** (Dashboard > Settings > System).
2.  **Verify Installer**: Try accessing `/install`. You should see a **"System Locked"** message.
3.  **Verify Feedback**: Try posting a very short comment (< 10 chars). You should now see a specific **Toast notification** explaining the validation error.

---

## 🚀 Scenario C: Updating to v1.20.10 (Mandala Foundation)

**Focus: Mandala Release — The New Foundation**

1.  **Update Files**: Use **One-Click Update** (Dashboard > Settings > System).
2.  **Verify UI**: Check your dark mode appearance. It should now be a neutral grey (Facebook/X style) instead of blue-tinted.

---

## 🚀 Scenario D: Updating to v1.11.9 (Previous Stable)

**Focus: Security Hardening & Functional Integrity**

1.  **Update Files**: Use **One-Click Update** (Dashboard > Settings > System).
2.  **Verify**: Check "System Check" to ensure all security headers are active.

---

## 🚀 Scenario E: Updating to v1.11.5 (Stability & Pathing Refinement)

**Focus: cPanel & Shared Hosting Stability**

This version focuses on restoring session stability and fixing 500/403 errors experienced by some cPanel users.

1.  **Update Files**: Use **One-Click Update** (Dashboard > Settings > System).
2.  **Verify Pathing**: The system will automatically standardize _API pathing_ using `__DIR__` to avoid session errors.
3.  **Check Status**: After the update, open the Dashboard to ensure the DB status is "Green" (no more 403 errors).

---

## 🚀 Scenario F: Updating from v1.11.x or Newer

_(E.g., v1.10.0 -> v1.10.1)_

1.  Login to **Admin Dashboard**.
2.  Go to **Settings > System**.
3.  Look for the **"System Update"** card.
4.  If an update is available, click **"Update Now"**.
5.  Wait for the progress bar to complete (approx 10-30 seconds).
6.  The page will refresh. **Done!**

---

## 🛠️ Scenario G: Updating from Older Versions (v1.9.x)

_(Manual Upgrade Required - One Last Time)_

If you are on version v1.9.9 or below, you must perform a manual file overwrite to get the new OTA updater engine.

### Step 1: Backup

Download a copy of your `von_config.php` file and `uploads/` folder to your computer. (Just in case!)

### Step 2: Download

Get the latest `VonCMS_Deploy.zip` from our [**GitHub Releases**](https://github.com/Vondereich/VonCMS/releases) page.

### Step 3: Upload & Overwrite

1.  Open your hosting **File Manager** (cPanel/DirectAdmin).
2.  Upload the ZIP file to your website root folder.
3.  **Extract** the ZIP.
4.  When asked to overwrite files, select **"Yes / Overwrite All"**.

> **Note:** Our ZIP file does NOT contain `von_config.php` or `uploads/`, so your database settings and images are **SAFE**.

### Step 4: Run Database Migration

1.  Login to your Admin Dashboard.
2.  Navigate to the **Security** tab (sidebar).
3.  The system will automatically detect the new version and run any missing SQL migrations (e.g., creating `security_logs` table).
4.  You will see a success message if any tables were fixed.

### Step 5: Verify

Check the **Settings > System** page. It should now say **Version: 1.21.x**.

Congratulations! Future updates will now be automatic. 🎉

---

# 🏛️ Archived Upgrade Guides (Legacy)

**Required for:** v1.8.x → v1.9.0

> [!IMPORTANT]
> VonCMS v1.9.0 maintains the v1.8.5+ folder structure but requires a **clean assets update** to enable the new Skeleton Loader UX.

### What Changed in v1.9?

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

### Upgrade Steps for v1.8 -> v1.9

#### Step 1: 🛡️ Backup Your Data

Before doing **ANYTHING**:

- ✅ **Backup MySQL database** (phpMyAdmin → Export)
- ✅ **Copy `von_config.php`** to safe location
- ✅ **Backup `uploads/` folder** (optional, if you have custom media)

#### Step 2: 🗑️ Delete Old Installation

> [!WARNING]
> You **MUST** delete the old installation folder completely if coming from pre-1.8.5.

**Why?** Old `public/` folder conflicts with new structure.

**How:**

1. Login to cPanel File Manager or FTP
2. Navigate to your site folder
3. Delete all files (after Step 1 backup!)

> [!TIP]
> **Why Upgrade is Safe:** The VonCMS deployment package **does not** contain `von_config.php` or the `uploads/` folder.
> This means you can drag-and-drop the new version into your server without worrying about overwriting your database connection or images.

#### Step 3: 📤 Upload New Version

1. Download **Deploy.zip**
2. Extract to a **CLEAN** folder location
3. Upload to your server

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
3. Check Dashboard version
4. Test creating/editing a post

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
    - Find `$db_name = '';` and change it to your database name (e.g., `'pulutdb'`).
    - If you have a database password, fill it in `$db_pass`.
5.  **Save & Upload**.

**Benefits:**

- **Auto-Logs:** Automatically creates `logs/` folder if missing (No more silent errors).
- **API Shield:** Prevents "Unexpected Token" JSON errors if PHP throws warnings.
- **Conflict Safety:** Functions are wrapped to prevent crashes with plugins.

---

## Upgrade to v1.9.5 (Standardization & Security)

This is a **Quality of Life & Security** update. It standardizes how themes work (Profile Tabs, Popups) and patches a high-severity vulnerability in the core system.

### Steps:

1.  **Delete `assets/` folder** from your server.
    - _Why?_ New hook logic requires fresh JavaScript bundles.
2.  **Upload new files** (Overwrite all).
3.  **Refresh browser** (`Ctrl + Shift + R`).

**No database migration required.** Your existing data is safe.
