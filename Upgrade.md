# 🔄 VonCMS Upgrade Guide

> [!TIP]
> **Good News:** Starting from v1.10.0, manual upgrades are a thing of the past!
> Use the **One-Click Update** feature in your Admin Dashboard under **Settings > System**.

---

## 🚀 Scenario A: Updating from v1.10.x or Newer
*(E.g., v1.10.0 -> v1.10.1)*

1.  Login to **Admin Dashboard**.
2.  Go to **Settings > System**.
3.  Look for the **"System Update"** card.
4.  If an update is available, click **"Update Now"**.
5.  Wait for the progress bar to complete (approx 10-30 seconds).
6.  The page will refresh. **Done!**

---

## 🛠️ Scenario B: Updating from Older Versions (v1.9.x)
*(Manual Upgrade Required - One Last Time)*

If you are on version v1.9.9 or below, you must perform a manual file overwrite to get the new OTA updater engine.

### Step 1: Backup
Download a copy of your `von_config.php` file and `uploads/` folder to your computer. (Just in case!)

### Step 2: Download
Get the latest `VonCMS_Deploy.zip` from our [**GitHub Releases**](https://github.com/Vondereich/VonCMS/releases) page.

### Step 3: Upload & Overwrite
1.  Open your hosting **File Manager** (cPanel/DirectAdmin).
2.  Upload the ZIP file to your website root folder.
3.  **Extact** the ZIP.
4.  When asked to overwrite files, select **"Yes / Overwrite All"**.

> **Note:** Our ZIP file does NOT contain `von_config.php` or `uploads/`, so your database settings and images are **SAFE**.

### Step 4: Run Database Migration
1.  Login to your Admin Dashboard.
2.  Navigate to the **Security** tab (sidebar).
3.  The system will automatically detect the new version and run any missing SQL migrations (e.g., creating `security_logs` table).
4.  You will see a success message if any tables were fixed.

### Step 5: Verify
Check the **Settings > System** page. It should now say **Version: 1.10.1**.

Congratulations! Future updates will now be automatic. 🎉
