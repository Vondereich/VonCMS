# VonCMS v1.22.1 "Kirana"

<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

[![Version](https://img.shields.io/badge/Version-1.22.1-brightgreen?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=orange)](https://github.com/Vondereich/VonCMS/releases)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](docs/LICENSE.md)

[Official Website](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Installation](/INSTALLATION.md) | [Manual](/USER_MANUAL.md) | [API](/API_REFERENCE.md) | [Upgrade](/Upgrade.md)

</div>

<img width="1920" height="991" alt="screencapture-localhost-raya-admin-database-2026-04-02-05_02_12" src="https://github.com/user-attachments/assets/c3b01898-01c3-41d3-a129-f756e5a7fcd5" />


VonCMS is a hybrid CMS with a React frontend and a PHP/MySQL backend. It is built for publishers who want a modern editing and reading experience without turning deployment into a separate frontend/backend project.

### Why "Kirana"?

> _"Kirana" - a ray of light; beauty and elegance that radiates._
>
> In classical Malay, **kirana** carries the sense of light, radiance, beauty, and grace. We chose it for the release that gave VonCMS a clearer identity: a **Hybrid Decoupled CMS** with a React SPA on the front and a PHP API on the back, shipped as one deploy without a Node.js production requirement.

> **Surprise:** Open Source is coming much sooner than we planned! Stay tuned for the official transition. &#128640;

## v1.22.1 Snapshot

> These figures come from the current release cycle's packaging and validation checks. Treat them as release notes, not as a blanket guarantee for every host.

| Metric                 | Result                         | Context                                                                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **API Endpoints**      | 78 endpoints                   | Current repo surface across public, admin, and system flows.                                        |
| **Release Hardening**  | Current audit pass             | Covered response contracts, host-header handling, XSS edges, race conditions, and packaging checks. |
| **Dependency Surface** | Trimmed for release            | Verify your own `npm audit` in the target environment.                                              |
| **Load Performance**   | 11,600 req/s @ 50 concurrent\* | Internal benchmark note from the current release cycle.                                             |
| **Estimated Capacity** | ~2,300 PV/s theoretical\*      | Directional estimate from the same benchmark note, not a universal hosting guarantee.               |
| **Build Size**         | Deploy 0.85MB, Source 0.77MB   | Current packaged release artifacts.                                                                 |
| **Release Baseline**   | Current audit pass             | TypeScript, production build, and targeted PHP lint passed in the v1.22.x release audit.            |

_Performance figures above come from the project's internal benchmark notes and should be treated as directional, not as a blanket SLA for every host._

Taken together, the release is aimed at one thing: giving publishers a modern workflow on ordinary hosting without forcing a split frontend/backend deployment model by default.

<img width="1920" height="988" alt="56" src="https://github.com/user-attachments/assets/ff910d81-f770-4a0b-a98d-7dd7a44d2dcd" />


## Why VonCMS

Most CMS platforms force a tradeoff between a modern interface and straightforward hosting. VonCMS is built to keep both in one package.

### Built for modern publishing on simple hosting

If you run a news site, blog, or content portal, the tradeoff is familiar:

- **WordPress** - powerful, but often dependent on a long plugin stack for the basics.
- **Headless CMS** - flexible and fast, but usually means a separate frontend deploy and a more complex hosting setup.
- **Static site generators** - excellent for some projects, but awkward for teams that publish and update content every day.

**VonCMS is built for a different workflow:**

| What you get                                                           | Why it matters                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React 19 SPA frontend**                                              | Once the page loads, navigation stays fast - no full page reload on every click.                                                                                                          |
| **PHP backend - no Node.js in production**                             | Deploy to shared hosting, cPanel, or a small VPS without running a separate Node.js stack.                                                                                                |
| **SEO, analytics, newsletter, comments, media manager - all built-in** | Install once and start publishing without assembling the basics from a pile of plugins.                                                                                                   |
| **6 modern themes included**                                           | TechPress for news portals, Digest for magazines, Portfolio for showcases, Prism for creative sites, Corporate Pro for business, and Default for clean minimal sites. All with dark mode. |
| **OTA updates from the dashboard**                                     | Update without FTP or manual file replacement when the environment supports it.                                                                                                           |
| **Works on subdomains and subfolders**                                 | Install at `yoursite.com`, `blog.yoursite.com`, or `yoursite.com/blog` without rewriting the app around one path layout.                                                                  |

### Who is VonCMS for?

- **News agencies and publishers** - manage authors, scheduled posts, editorial history, and frequent publishing in one system.
- **Bloggers and content creators** - get a cleaner editor, bundled themes, and built-in SEO without extra setup.
- **Small agencies** - deliver modern sites to clients on simple hosting without maintaining a large plugin stack.
- **Teams with clear roles** - use admin, moderator, writer, and subscriber roles with audit logs and draft workflows.
- **People who want fewer moving parts** - keep the publishing stack simpler and easier to maintain over time.

### Our philosophy

**VonCMS is built for publishers first.**

The goal is simple: make content work easier to run, easier to maintain, and less fragile on ordinary hosting. If a feature removes friction for the person publishing the site, it matters.

## What's New in v1.22.1

<img width="1920" height="990" alt="capture-20260408-215903" src="https://github.com/user-attachments/assets/2d797455-94c7-46e0-880c-154b86a636e4" />


> **v1.22.1 "Kirana"** is a maintenance release that fixes critical issues from v1.22.0 and adds several improvements for import reliability, media handling, and search indexing.

- **WordPress Importer Featured Image Fix**:
  - **Pre-scan attachment map**: Before batch processing, a quick XML pre-scan reads all `<wp:post_type>attachment</wp:post_type>` items and builds a `{ wp:post_id → wp:attachment_url }` lookup map.
  - **`_thumbnail_id` resolution (new Strategy 1)**: Post import reads `<wp:postmeta>` for `<wp:meta_key>_thumbnail_id</wp:meta_key>`, looks up the attachment ID in the pre-scanned map, downloads the image via `rehost_import_image_url()`, and saves the local URL as `image_url` in the `posts` table.
  - **Fallback chain preserved**: Strategy 2 — explicit `<image>` tag for non-WordPress generic XML imports. Strategy 3 — first `<img>` in content for posts without `_thumbnail_id`.
  - **Duplicate download protection**: `rehost_import_image_url()` static cache prevents the same URL from being downloaded twice.
  - **Result**: Expected `image_url` coverage jumps from ~4% to ~95%+.

- **WPMigrator "Start New Import" Button**: Added button on the complete screen that resets all UI state back to upload view. Previously users had to refresh the browser to import another XML file.

- **Media Rebuild WebP Crash Fix**: GD's `imagecreatefromwebp()` crashes on certain WebP encodings. The Rebuild Responsive Variants tool now skips WebP files entirely and reports them separately — they're already compressed and don't benefit from responsive variants.

- **Editor Blockquote Spacing Fix**: Removed redundant `<p><br/></p>` after blockquote insertion. The blockquote already has `margin: 16px 0` for natural spacing.

- **Root DirectoryIndex Priority Fix**: Added `DirectoryIndex index.php index.html` to all `.htaccess` templates to force PHP priority when both files exist. Fixes blank React shell issue on shared hosting. Auto-fixed on Integrity Repair.

- **Google Search Index Cleanup — Hardcoded Default Text Removed**: Removed hardcoded "Welcome to our website" text from sidebar widget default and promo bar plugin default. These strings were indexed by Google from fresh installs before settings were saved.

- **PHP 8.2 Minimum Version Enforcement**: Added version checks to entry points with clear HTML error pages and JSON error responses. Prevents silent crashes on unsupported PHP versions.

- **RSS Sitemap `<enclosure>` Length Attribute Fix**: Added required `length` attribute to `<enclosure>` tags in `public/rss.php`. Fixes Google Search Console "Missing XML attribute" errors.

## Core Features

- React 19 + Vite frontend
- PHP + PDO backend
- Built-in admin dashboard
- Built-in SEO, `llms.txt`, and sitemap support
- Media upload pipeline with WebP support
- Comments, newsletter, widgets, and ads support
- OTA update flow and integrity repair tools
- Security layers including CSRF, session checks, rate limiting, and data masking

## Included Themes

- Default
- TechPress
- Prism
- Digest
- Portfolio
- Corporate Pro

## Requirements

- PHP 8.2+
- MySQL 5.7+
- Apache/LiteSpeed rewrite support or equivalent server routing
- Around 50MB storage for a basic install

## Quick Start

1. Extract the latest VonCMS Deploy package to your web root.
2. Open `yoursite.com/install` in your browser.
3. Complete the installer and sign in to `/admin`.

## Local Testing

- Recommended local stacks: `XAMPP`, `WAMP`, or `Laragon`.
- `XAMPP` is the easiest baseline for quick VonCMS install and feature checks, especially on PHP `8.2`.
- `WAMP` is a reasonable choice if you want easier local PHP version switching for future `8.4+` tests.
- `Laragon` is lightweight and works well. Note: phpMyAdmin is not bundled — download from [phpmyadmin.net](https://www.phpmyadmin.net/) and extract to `C:\laragon\etc\apps\phpMyAdmin`. Default DB credentials: `root` / *(empty)*.
- For serious PHP `8.4+` compatibility validation, a staging subdomain on the target hosting is more representative than a localhost-only test.

> Shared hosting note: if the destination folder already has a host-generated or custom `.htaccess`, back it up first. The installer and `Repair .htaccess` now preserve existing content and refresh only the VonCMS-managed block, but manual ZIP extraction can still overwrite `.htaccess` depending on your hosting file manager or unzip tool.

## Release Packages

- Use the latest VonCMS Deploy package for fresh installs.
- Use the latest VonCMS Deploy package cautiously for manual live updates. If your site has host-generated `.htaccess` rules, cPanel PHP handlers, custom redirects, or hardcoded rewrites, back up `.htaccess` first and verify it after extraction.
- The current public release package is the latest versioned VonCMS Deploy package from the official release.

## Documentation

- [Features Guide](/WHY_VONCMS.md)
- [Installation Guide](/INSTALLATION.md)
- [User Manual](/USER_MANUAL.md)
- [API Reference](/API_REFERENCE.md)
- [Upgrade Guide](/UPGRADE.md)
- [Introduction](/Introduction.md)
- [VPS Guide](/VPS.md)

## Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: PHP, PDO, MySQL
- Infrastructure: Apache/LiteSpeed, OTA ZIP updates, shared-hosting friendly deployment

## Contact

For business inquiries, enterprise support, or collaboration:

`kurama87@gmail.com`

<div align="center">
Built by Vondereich.
</div>
