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
