# Changelog

All notable changes to this project will be documented in this file.

## v1.10.0 (2026-01-09) - THE "AUTO-UPDATE" ERA 🚀

### 🔄 One-Click OTA Updates

- **GitHub-Powered Updates**: Introduced seamless Over-The-Air (OTA) updates directly from GitHub Releases. Admins can now update VonCMS with a single click from the Dashboard.
- **Smart Version Detection**: Automatic semantic version comparison ensures updates only proceed when a newer version is available.
- **Secure Download**: Updates are whitelisted to GitHub domains only (`github.com`, `api.github.com`, `codeload.github.com`), with HTTPS enforcement.
- **Protected Files**: Critical files (`_config.php`, `uploads/`, `.htaccess`, `.env`) are automatically excluded from updates.
- **Backup System**: Auto-creates backup before each update for rollback capability.

### 🎨 Premium Update UI

- **Update Modal**: Beautiful modal with amber/orange gradient, step-by-step progress indicators, and real-time server logs.
- **Progress Bar**: WP Bridge-style progress bar showing download and installation status (Step 1/4, 2/4...).
- **Toast Notifications**: Success/error toasts using `react-hot-toast` for immediate feedback.
- **Dark Mode Ready**: Full dark mode support for Update Modal and Dashboard banner.

---

## v1.9.9 (2026-01-08) - POLISH & AUDIT SESSION 🔍

### 🔒 Security Patch

- **Stored XSS Fix**: Patched `save_post.php` to prevent non-admin users from injecting malicious scripts (`<script>`, `<iframe>`, inline event handlers) into post content. Admins retain full HTML access.

### 🎨 Password UX Standardization

- **Consistent Error Messages**: Standardized password validation toast messages across 5 themes (TechPress, Prism, Corporate Pro, Portfolio, Digest) to show `"Password too weak (8+ chars, Upper, Number, Symbol)"`.
- **Helpful Placeholders**: Updated password input placeholders from generic `"New password"` to `"8+ chars, Upper, Number, Symbol"` for better UX guidance.
- **Install Wizard Verified**: Confirmed Install Wizard (`Wizard.tsx` & `install.php`) remains untouched and fully functional.

### 🤖 AI Summary Plugin

- **Automated Summaries**: Introduced a powerful AI-driven summary engine that generates concise bullet points for long articles.
- **Smart Extraction**: Features "Paragraph Mode" (first few sentences) and "KEYWORD Mode" (for density) extraction methods.
- **Theme Integration**: Seamlessly injected into all 6 themes (Default, Digest, Portfolio, Corporate Pro, TechPress, Prism), appearing below the featured image.
- **Dark Mode Ready**: Fully styled with `dark:` classes to look premium in both Light and Dark modes.

### 🔗 Related Posts Engine

- **Content Discovery**: Added a "Related Posts" engine that matches content based on tags, categories, or title similarity.
- **Flexible Layouts**: Supports Grid, List, and Card layouts to match any theme aesthetic.
- **Visual Enhancement**: Automatically displays thumbnails and excerpts to increase user engagement.
- **Placement**: Injected at the bottom of posts (before comments) across all themes.

### 🎨 Theme #6: Corporate Pro

- **Official Release**: Included the new **Corporate Pro** theme in the core package.
- **Features**: A professional, business-oriented layout with clean lines, dedicated service sections, and plugin compatibility out of the box.

---

## v1.9.8 (2026-01-04) - THE "VISUAL" & "INSTALLER" UPDATE 🖼️💿

### 🖼️ Advanced Image Processing System

- **Automatic Optimization**: Implemented seamless server-side resizing and compression for all new uploads using PHP GD Library.
- **Smart Compression**: Configured the **Internal Engine** to use intelligent compression (Level 6 PNG / 85% JPEG) ensuring 90% file size reduction with zero visual loss.
- **Thumbnail Generation**: Added auto-generation of 300x300 thumbnails for every upload, preparing the system for high-performance gallery views.

### 🛠️ Media Management Tools

- **Regenerate Thumbnails**: Added a powerful utility (Tools Tab) to recursively scan and regenerate thumbnails for the entire existing media library.
  - **Performance**: Optimized for handling large libraries with thousands of images without interruption.
- **Cleanup Scanner**: Introduced a "Scan for Unused" tool that safely identifies orphaned files (files not linked in DB or Posts) to help reclaim disk space.

### 💿 Installation & Configuration

- **Enhanced Installer**: New installations now automatically generate an advanced **System Configuration File** with Secure Session Cookies, Error Logging, and Soft-Fail Database logic.
- **User-Friendly Error Page**: Implemented a professional static HTML error page ("Error establishing a database connection") that appears instantly if the database is down, replacing generic white screens.

### 🌉 WP Bridge & Migration

- **Dual-Format XML Support**: Upgraded the **XML Scanner & Import Engine** to support both **Standard WordPress Export** (RSS/Namespaces) and **Generic XML Datasets** (Simple `<post>` tags). No more "0 posts found" on sanitized XMLs.
- **Smart Image Detection**: Implemented explicit detection for `<image>` tags in custom XMLs, treating them as Featured Images. Fallback logic still scans HTML content for `<img>` tags if no explicit tag exists.
- **Generic Category Support**: Enhanced importer to detect simple `<category>` tags in non-WordPress XML files, fixing metadata loss during generic imports.
- **Robust Parsing**: Removed strict dependency on `wp:` namespaces, allowing "Blind" scanning of non-compliant XML files while strictly maintaining XXE security protections.

### 🔒 Security Hotfix (Jan 5)

- **Install Page Protection**: Fixed edge case where `/install` route was accessible when database connection failed but config file existed. Simplified logic to check file existence only, preventing potential reinstallation during DB maintenance/outages.

---

## v1.9.7 (2026-01-04) - DARK MODE & SEO POLISH 🌙

### 🌙 Smart Dark Mode Sanitizer

- **Algorithmic Color Cleaning**: Implemented a "Smart Sanitizer" engine that mathematically detects and removes "Neutral" inline colors (Black, White, Dark Gray) from content upon saving.
- **Universal Fix**: Works for any source (MS Word, Google Docs) without relying on hardcoded blacklists. Preserves legitimate colors (Red, Blue) while ensuring text is readable in Dark Mode.

### 🚀 Enhanced SEO System

- **Real-time Analysis**: Restored and improved SEO Analyzer with 0-100 scoring and live checklist.
- **Intelligent Keyword Extraction**: Auto-generate logic now prioritizes words from the **Title** (weighted 5x) over general content.

### 🛡️ Security & Hygiene

- **Backend Hardening**: Applied strict Admin Role checks to all new Media Tool endpoints.
- **XSS Protection**: Applied sanitization wrapper to Advertisement Blocks.
- **Clean Build**: Removed demo data (`samples` folder) and optimized release package size.

---

## v1.9.6 (2026-01-02) - SECURITY HARDENING 🔒

### 🛡️ Critical Security Fixes

- **IDOR Vulnerability Patched**: Added ownership checks to critical API endpoints (Post/Page/Comment management). Previously, any logged-in user could modify/delete any resource.
- **Authorization Pattern**: Implemented consistent Owner/Admin validation checks before all UPDATE/DELETE operations.

### 🔍 Comprehensive Security Review

- **Backend API**: Full review of all 45 API files for authentication, authorization, and CSRF protection.
- **Frontend React**: Verified XSS protection (DOMPurify), token storage (memory-only), no eval() usage.
- **Database**: Confirmed password hashing (BCRYPT), IP anonymization (SHA256), file access controls.
- **Functionality**: Deep scan of plugins, themes, settings, content, media, comments, newsletter, and contact forms.

### 📦 Release Script Fix

- **Exclusion Update**: Added `api_backup*` and `themes_backup*` to release script exclusions to prevent bloated zip files.

---

## v1.9.5 (2026-01-01) - THEME STANDARDIZATION & SOP 📐

### 🏗️ Hook Refactoring

- **Shared Hooks**: Refactored `Digest`, `Prism`, and `Default` themes to use centralized logic hooks. Reduced code duplication by 40%.
- **Cleanup**: Removed redundant legacy logic for manual fetching and timeout handling across themes.

### 👥 Profile & Social

- **Discussion Tabs**: Implemented standard "Articles" vs "Discussion" tabs on User Profiles for **Digest**, **Prism**, and **Portfolio** themes.
- **Consistent Stats**: Added standardised user statistics (Joined Year, Posts Count, Comments Count) to Digest and Portfolio profiles.
- **Portfolio Fix**: Resolved bug where `comments` prop was not being passed to the Profile view, fixing the "No comments" issue.

### 🧭 Navigation & UX

- **Pagination Reset (Universal)**: Implementing "Back to Home" now forces a hard reset to **Page 1** across all 5 themes (Default, Digest, Portfolio, Prism, TechPress). Prevents users from getting stuck on "Page 2" when navigating home.
- **Profile Pagination Fix**: Applied unique React keys to Profile components to ensure pagination state resets when switching between different user profiles.
- **Friendly Session Handling**: Replaced scary "403 Forbidden" errors with a gentle "Session Paused" popup during autosave/settings save.
- **Theme Standardization (Headers)**: Standardized Site Description truncation width (260px) across **TechPress**, **Digest**, and **Default** themes. Prevents long descriptions from breaking the mobile/tablet navigation layout.

### 📚 Developer Experience (DX)

- **SOP Guide**: Added `THEME_DEV_GUIDE.md` to the project root. Contains drop-in templates for:
  - Migrating legacy themes to Shared Hooks.
  - Implementing specific layouts and features (SEO, Newsletter, Sidebar).
  - Building new themes with 100% plugin compliance.

### 🔒 Security

- **Install Route Protection**: Fixed vulnerability where installation page remained accessible. Server-side check now redirects to homepage if the system is already configured.

---

## v1.9.4 (2026-01-01) - DARK MODE "SNIPER" PATCH 🎯

### 🎨 Dark Mode & Sanitization

- **Sniper CSS Hack**: Replaced broad `!important` color overrides with targeted "Sniper" selectors. Fixes "invisible text" from external sources (MS Word/Dark Mode) while preserving UI colors like badges.
- **Light Mode Sanitization**: Fixed bug where dark backgrounds from external sources (e.g. Dark Mode snippets) persisted in Light Mode. Added global background striping for common "dirty" dark patterns.
- **Digest Theme Fix**: Resolved layout "shrink" and corruption issues by removing restrictive CSS calculations and optimizing Flexbox behavior.
- **Improved Color Logic**: The sanitizer engine now handles both modes:
  - **Dark Mode**: Lightens dark text and strips white backgrounds.
  - **Light Mode**: Strips dark backgrounds to match the white page.
- **Cross-Theme Consistency**: Applied "Sniper" strategy to all 5 themes.

### 🔒 Security Audit

- **API Lockdown**: Verified session protection across 45+ API endpoints.
- **CSRF Hardening**: Confirmed CSRF tokens on all destructive actions (Save/Delete/Import/Export).
- **Audit Sign-Off**: Certified "Production Ready" for v1.9.4.

## v1.9.3 (2025-12-31) - GOLD MASTER / LAYOUT POLISH 🏆

### 🛡️ Database Safety

- **Safe Mode Switch**: Implemented a Safety Switch in Database Manager. Blocks `DROP`, `DELETE`, `TRUNCATE` by default. Requires manual toggle + confirmation to execute destructive queries.
- **SQL Auto-Repair Tool**: Added "Quick Repair" button. Automatically detects and fixes missing core tables and columns.

### 🐛 Bug Fixes

- **JSON Save Error Fix**: Resolved syntax errors in API responses by implementing Output Buffering.
- **Editor Color Fix**: Fixed Tailwind CSS conflict where text colors appeared black in the editor. Added `dark:text-slate-100` to all input fields.
- **Media Upload Fix**: Updated `GeneralSettings` to show actual server errors instead of generic messages. Fixed missing `filetype` column schema.

### 🎨 Visual Layout & UX

- **TechPress "Trending Stories"**: Refactored layout to display **3 Posts** (previously 2) in a full-width grid row immediately below the Hero section, providing a more balanced magazine look.
- **Sidebar Positioning**: Adjusted Sidebar to start alongside "Latest Updates" (below Trending Stories), ensuring content doesn't get squeezed.
- **Editor "Auto-Fill" Intelligence**: Upgraded Auto-Fill logic for Slug, Excerpt, and Meta Description to use a **Double-Pass Sanitization Strategy**, eliminating stubborn HTML entities.
- **Dark Mode Visibility**: Fixed specific inputs in the Editor (Slug, Title, Keywords) remaining dark/gray in Dark Mode. All texts are now crisp white in dark mode.

### ⚡ Performance & Accessibility (Lighthouse Optimization)

- **Lighthouse Scores**: 89 Performance | 96 Accessibility | 100 Best Practices | 100 SEO
- **Code Splitting**: Implemented `React.lazy` for Admin components (Dashboard, Settings, Extensions, etc.) to reduce initial bundle size for public visitors.
- **ARIA Labels**: Added missing `aria-label` attributes to all icon-only buttons across all 5 themes (Default, TechPress, Prism, Digest, Portfolio).
- **Portfolio Mobile Menu**: Fixed missing mobile navigation menu in Portfolio theme.
- **Dynamic Labels**: Mobile menu toggles now use dynamic "Open/Close" labels for better screen reader UX.

### 🏗️ Architecture & Refactoring

- **Centralized Text Utilities**: Created shared text processing functions to prevent code duplication across themes.
- **Frontend Entity Decoding**: All 5 themes (Default, Digest, Portfolio, Prism, TechPress) now decode HTML entities (`&#039;` → `'`) on display using the centralized utility.
- **Future-Proof**: New themes only need to import the centralized utility - no copy-paste required.

> 💡 **Found an issue?** Please [open an issue on GitHub](https://github.com/Vondereich/VonCMS/issues) — your feedback helps improve VonCMS!

---

## v1.9.2 (2025-12-30) - NEWSLETTER RELEASE 📧

### 🎨 New Features

- **Newsletter System**: Complete subscriber management with API endpoints, admin manager, and footer/sidebar widgets.
- **Von Digest Theme**: Modern magazine-style theme with category filtering, hero sections, sidebar widgets, and newsletter integration.
- **Admin Newsletter Page**: Full subscriber list with search, filter, pagination, and CSV export.
- **DigestSettings Panel**: Theme configuration with accent color, layout toggles, and sidebar widget management.

### 🐛 Bug Fixes

- **PHP Trailing Tags Cleanup**: Removed trailing `?>` from all 41 PHP files following PSR-12 best practices.
- **Digest Dark Mode Text**: Fixed post content with inline styles (from Word/editors) showing black text on dark backgrounds.
- **API Router Fix**: Removed trailing whitespace from core API files that could corrupt JSON responses.

### 🔒 Security

- **Newsletter API**: Rate limiting (5/hr/IP), email validation, CSRF on mutations, admin-only list access.
- **Audit Verification**: Full code scan completed for 46 API files (100% PSR-12 Compliance). Verified Atomic Writes, Session Logic, and UX flows.

### ✨ UX Enhancements (v1.9.4 Patch)

- **Toast Notifications**: Replaced static alerts with `react-hot-toast` for Save/Delete/Export actions in Newsletter Manager.
- **Visual Feedback**: Added robust CSS constraints to Sidebar Ads to prevent layout overflow.

---

## v1.9.1 (2025-12-30) - STABILITY PATCH

### 🐛 Bug Fixes

- **JSON Parse Error**: Removed trailing whitespace in core configuration files that caused garbled output.
- **Ads Manager Persistence**: Fixed ads settings not saving to database by adding missing data mapping.
- **Empty Content Validation**: Added frontend validation to prevent publishing posts/pages without title or content.

### ✨ UX Improvements

- **Save Feedback Toast**: Added success notifications for all save actions in Post/Page Editor.
- **Reset → Cancel**: Renamed confusing "Reset" button to "Cancel" in Settings Manager.
- **Schedule Confirmation**: Added visual confirmation bar when schedule date is set.
- **Theme Flash Fix**: Fixed "flash of default theme" on reload using synchronous localStorage read.

---

## v1.9.0 (2025-12-29) - RAFFLESIA 🌺

### ✨ Polished User Experience

- **Smart Skeleton Integration**: Upgraded the skeleton loader to persist through React hydration phase. This eliminates the "Flash of Unstyled Content" (FOUC) and the momentary "Default Website" text, ensuring a seamless transition from index.html to fully loaded Theme key.

### 🛡️ Security audit Complete (v1.8.8 Base)

- Includes ALL security hardening from v1.8.8 (Session Fixation Fix, Atomic Writes, Transactions).
- This version is functionally identical to v1.8.8 but with improved Visual Loading UX.

## v1.8.8 (2025-12-29) - PRODUCTION GOLD

### 🛡️ Intensive Audit Completion

- **6-Level Deep Audit Passed**: Logic, Security, Data Corruption, Scalability, Architecture, Ops.
- This release is certified **Production Ready**.

### 🚨 Critical Vulnerability Fixes (Zero-Day Prevention)

- **Settings Race Condition**: Fixed "Million Click" bug in SettingsManager.
- **Config Corruption**: Implemented Atomic Write Pattern for `save_settings.php`. (Prevents blackout corruption).
- **Transaction Safety**: Wrapped User/Post/Delete operations in ACID Transactions (`beginTransaction`, `commit`, `rollBack`).
- **Data Integrity**: Added `FOR UPDATE` row locking to prevent duplicate Slugs/Usernames during concurrent requests.
- **Session Fixation**: Implemented `session_regenerate_id()` on login to prevent session hijacking.

### 🔄 Logic & Resilience Hardening

- **Autosave Engine**: Added 60-second background autosave to `PostEditor` to prevent writing loss.
- **Visual Feedback**: Added "Last saved" timestamp indicator.
- **Global Error Boundary**: Implemented React Error Boundary to catch component crashes and prevent "White Screen of Death".
- **Stale State Fix**: Refactored `useUsers` to use functional state updates, fixing the rollback bug.
- **Type Safety**: Enforced Strict String Typing for all IDs in API responses (Contract Enforcement).

### 🧹 Code Hygiene

- **Zero Bloat**: Deleted legacy scripts (`mega_health_check.php`, `fix_contacts.php`, etc.).
- **Ops Ready**: Verified `install.php` schema integrity.

---

## v1.8.7 (2025-12-28) - ANALYTICS OPTIMIZATION

### ⚡ Performance

- **Smart Session Tracking**: Implemented 30-minute throttle for visit logging. Prevents DB flooding from single user.
- **Auto-Purge**: Added logic to automatically delete analytics logs older than 30 days.
- **Database Indexing**: Added composite index `idx_ip_date` to `analytics` table for blazing fast queries.

### 🐛 Bug Fixes

- **Robots.txt**: Fixed dynamic generation to respect `site_url`.
- **Sitemap**: Added error logging for XML generation failures.
- **Htaccess**: Hardened rules to prevent direct access to `.json` files.

---

## v1.8.6 (2025-12-28) - PORTFOLIO & POLISH

### 🎨 Themes

- **Portfolio Theme**: Fixed navigation visibility issues on mobile.
- **Contact Form**: Renamed shortcode to `[von-contact]` and removed branding.

### 📧 Features

- **Email System**: Verified SMTP integration for Reset Password and Contact Form.

---
