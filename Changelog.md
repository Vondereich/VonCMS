# Changelog

All notable changes to this project will be documented in this file.

## v1.8.3 (2025-12-25)
### ✨ New Features
- **Content Scheduling:** Ability to schedule posts to auto-publish at future date/time.
  - New `scheduledAt` field in Post type and datetime picker UI in PostEditor.
  - Auto-publish logic in `get_posts.php` - posts go live when scheduled time arrives.
  - **SEO Safety Block:** Prevents rescheduling already-published posts (protects URLs/SEO).
- **Bulk Content Management:** Added ability to bulk delete Posts and Pages from the Content Manager.
  - Multi-select capability with "Select All" toggle.
  - Batch delete action with confirmation safety.

### 🛡️ Security
- **Status Whitelist Validation:** `save_post.php` now validates status against allowed values (`published`, `draft`, `scheduled`, `archived`).
- **Invalid Date Fallback:** Scheduled posts without valid datetime auto-fallback to `draft` status.

### 🗄️ Database Schema
- **NEW Column:** `scheduled_at DATETIME NULL` added to `posts` table.
- Updated `install.sql` and `install.php` for fresh installations.
- **Migration Note:** Existing databases require: `ALTER TABLE posts ADD COLUMN scheduled_at DATETIME NULL;`

## v1.8.2 (2025-12-25)
### 🏗️ Code Architecture
- **TechPress Footer Refactor:** Extracted footer into reusable `TechPressFooter.tsx` component.
  - Reduced ~90 lines of duplicated code to single source of truth.
  - Future footer edits now require only 1 change instead of 3.

## v1.8.1 (2025-12-25)
### 🛠️ System Tools & Core Fixes
- **Database Manager 2.0:**
    - **Dynamic Status:** Connection now displays the correct database name (Real-time fetch via `SELECT DATABASE()`).
    - **Admin SQL Unlocked:** updated `db_query.php` to allow authorized Admins to execute raw SQL (including `DROP`, `CREATE`, etc.).
    - **Smart Shortcuts:** "Delete Table" button acts as a safe query template generator.
- **Stability:** Final verification of all v1.8.0 features (Security Guard, Footer Links).

## v1.8.0 "Aegis" (2025-12-25)

**BIG UPDATE: Security & Theme Architecture**

### 🛡️ System & Installer
- **New Codename:** "Aegis" - symbolizing protection and stability.
- **Installer Update:** Renamed "Phoenix Verified" to **"VonGuard Verified"** in Setup Wizard.
- **Database Enhanced:** Fresh installations now include optimized `site_settings` with pre-configured TechPress options and footer links.
- **Theme Versioning:** Synchronized all core themes (Default, Prism, TechPress) to **v1.2.0**.
- **Admin Protection (New):**
    - **Self-Deletion Block:** Admins cannot delete their own account (Frontend UI + Backend API protection).
    - **Role Guard:** Admins cannot downgrade their own role or the Super Admin's role (prevents accidental lockout).
    - **Super Admin Lock:** User ID 1 (Owner) is hard-locked from deletion by any other admin.

### 🎨 Themes & UI Improvements
- **Default Theme:** 
    - footer redesign: Added "Edit Footer Links" in Theme Settings.
    - Footer layout adjusted to a balanced 3-column grid (Brand 20%, Links 10%, etc) with Admin link removed for security.
- **TechPress Theme:** 
    - **Footer Polish:** Refined split layout (Tagline Right, Copyright Left) for professional alignment across all views.
    - **Video Fix:** Fixed embedded iframe/video sizing issue. Videos now automatically scale to full width (16:9).
    - **Ad Logic Fix:** "In-Feed Ads" now correctly appear after the 3rd post total (accounting for the 2 Trending posts offset).
    - **Sidebar Links:** Fixed "Trending Now" links stacking in URL (`#post:slug-1`). Now uses smart SPA navigation (`onClick`).
- **Prism Theme:** Verified v1.2.0 compatibility.

### 🐛 Bug Fixes
- Fixed `DefaultLayout` and `TechPressLayout` not passing `onPostClick` to sidebar widgets, causing navigation issues.
- Fixed inconsistent version metadata in `themeRegistry.ts`.
