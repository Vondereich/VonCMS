# PREVIEW VonCMS v1.23.0 "Rentaka"

<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

[![Version](https://img.shields.io/badge/Version-1.23.0-brightgreen?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=orange)](https://github.com/Vondereich/VonCMS/releases)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE.md)

[Official Website](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Installation](INSTALL.md) | [Manual](MANUAL.md) | [API](API.md) | [Upgrade](UPGRADE.md)

</div>

<img width="1920" height="991" alt="screencapture-localhost-raya-admin-database-2026-04-02-05_02_12" src="https://github.com/user-attachments/assets/c3b01898-01c3-41d3-a129-f756e5a7fcd5" />

VonCMS is a hybrid CMS with a React frontend and a PHP/MySQL backend. It is built for publishers who want a modern editing and reading experience without turning deployment into a separate frontend/backend project.

**Rentaka** pushes that positioning further: a publisher-grade CMS with performance-aware admin flows, a sharper SPA experience, and a release line already aligned for large content libraries, including `100k+` post readiness on the inherited server-side pagination and search architecture.

### Why "Rentaka"?

> _"Rentaka" - the next public line after Kirana, carrying the release forward with a harder, clearer baseline._
>
> We chose **Rentaka** for the release that promotes the cumulative `v1.22.x` Kirana work into a cleaner public `v1.23.0` baseline. This line is less about a single new feature and more about carrying forward the hardened admin scalability, installer/repair safety, and editor/save-path fixes under one release boundary.

> **Open Source:** Targeting the **v1.25.x line** for the official open source transition. License will be **MIT or GPL** — final choice depends on community feedback and project goals. The goal is to carry the project through the next stability and hardening cycle before opening it to the community. Stay tuned. &#128640;

## ⚠️ IMPORTANT: OTA Update & `.htaccess` Warning

> **[!CAUTION]** OTA updates do **NOT** include `.htaccess` changes. The `v1.23` release line inherits critical `.htaccess` security rules hardened across the `v1.22.x` cycle (DirectoryIndex priority, localhost HTTPS bypass, RSS routing, WebP MIME type, CORS, and XSS protections). If these rules are missing after an OTA update, your site may show a **white page** or fail to route correctly. **After every OTA update, you MUST do one of the following:**
>
> 1. **Dashboard (easiest):** Go to **General Setting → Tools → Fix .htaccess** to apply the latest rules from the server.
> 2. **Manual upload (safest):** Download the latest VonCMS Deploy package, extract the package-root `.htaccess` file, and upload it to your live web root via FTP or file manager. The Deploy ZIP already mirrors the live `public/` web root layout. If you also need to refresh the upload shield, copy `uploads/.htaccess` into your live `uploads/` directory.

## v1.23.0 Snapshot

> These figures come from the current release cycle's packaging and validation checks. Treat them as release notes, not as a blanket guarantee for every host.

| Metric                 | Result                         | Context                                                                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **API Surface**        | 73 HTTP API request handlers   | 71 dedicated handlers under `public/api/` plus 2 legacy bridge handlers in `public/`; helper/support files under `api/` are not counted as endpoints. |
| **Release Hardening**  | Current audit pass             | Covered response contracts, host-header handling, XSS edges, race conditions, and packaging checks. |
| **Dependency Surface** | Trimmed for release            | Verify your own `npm audit` in the target environment.                                              |
| **Large Dataset Path** | `100k+` post-ready baseline    | Server-bound admin browsing and FULLTEXT-backed post search are carried into `v1.23.0`.             |
| **Load Performance**   | 11,600 req/s @ 50 concurrent\* | Internal benchmark note from the current release cycle.                                             |
| **Estimated Capacity** | ~2,300 PV/s theoretical\*      | Directional estimate from the same benchmark note, not a universal hosting guarantee.               |
| **Build Size**         | Deploy 0.88MB, Source 0.81MB   | Current packaged release artifacts for the `v1.23.0` release line.                                  |
| **Release Baseline**   | Current audit pass             | TypeScript, production build, and integration smoke passed in the `v1.23.0` release audit.          |

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
| **Server-bound admin flows**                                           | Content, users, and discussion moderation follow the newer pagination/search architecture instead of relying on fragile partial preloads.                                                 |
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

## What's New in v1.23.0

<img width="1920" height="990" alt="capture-20260408-215903" src="https://github.com/user-attachments/assets/2d797455-94c7-46e0-880c-154b86a636e4" />

> **v1.23.0 "Rentaka"** is a frog-leap public release that rolls the shipped `v1.22.x` Kirana line forward into a new stable baseline. It keeps the inherited admin scalability, installer/repair safety, settings hardening, and editor save-path cleanup together under one public release line.

- **Frog-Leap Release Promotion**:
  - The public release line is now `v1.23.0 "Rentaka"` across the main docs and release manifests.
  - Installer, bundled theme, and bundled plugin version labels now use the `1.23` baseline instead of the older `1.22.0` Kirana tag.

- **Kirana `v1.22.x` Line Consolidation**:
  - Inherits the cumulative `v1.22.0` Kirana baseline, including the hybrid CMS architecture naming, RSS rollout, importer/editor hardening, and release-polish fixes.
  - Carries forward the `v1.22.8` admin scalability work: server-bound discussion moderation, user management, content pagination, and posts FULLTEXT search readiness.
  - Carries forward the `v1.22.9` save-path hardening: manual excerpt preservation, `metaDescription` alignment, and the legacy settings bridge delegation to `api/get_settings.php`.

- **Performance-First Publishing Baseline**:
  - `Rentaka` presents VonCMS as a more serious publishing CMS, not just a simple blog engine: the active release line now carries the server-side browsing/search architecture needed for larger editorial datasets.
  - Post search remains FULLTEXT-backed, while the inherited admin scalability work keeps the platform aligned for long-lived sites and larger libraries, including `100k+` post readiness as an architecture baseline rather than a blanket hosting guarantee.

- **Release Contract Alignment**:
  - `ContentManager` page mode no longer advertises unsupported server-side page search/filter behavior against `get_pages.php`.
  - The integration smoke gate now checks that this page-mode contract stays aligned with the current pages API.

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
- `Laragon` is lightweight and works well. Note: phpMyAdmin is not bundled — download from [phpmyadmin.net](https://www.phpmyadmin.net/) and extract to `C:\laragon\etc\apps\phpMyAdmin`. Default DB credentials: `root` / _(empty)_.
- For serious PHP `8.4+` compatibility validation, a staging subdomain on the target hosting is more representative than a localhost-only test.

> Shared hosting note: if the destination folder already has a host-generated or custom `.htaccess`, back it up first. The installer and `Repair .htaccess` now preserve existing content and refresh only the VonCMS-managed block, but manual ZIP extraction can still overwrite `.htaccess` depending on your hosting file manager or unzip tool.

## Release Packages

- Use the latest VonCMS Deploy package for fresh installs.
- Use the latest VonCMS Deploy package cautiously for manual live updates. **Mandatory:** Delete the `assets/` folder in your hosting before extracting the new ZIP to prevent stale asset conflicts or cached CSS/JS from breaking the layout. If your site has host-generated `.htaccess` rules, cPanel PHP handlers, custom redirects, or hardcoded rewrites, back up `.htaccess` first and verify it after extraction.
- The current public release package is the latest versioned VonCMS Deploy package from the official release.

## Documentation

- [Features Guide](FEATURES.md)
- [Installation Guide](INSTALL.md)
- [User Manual](MANUAL.md)
- [API Reference](API.md)
- [Upgrade Guide](UPGRADE.md)
- [Introduction](INTRODUCTION.md)
- [VPS Guide](VPS.md)

## Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: PHP, PDO, MySQL
- Infrastructure: Apache/LiteSpeed, OTA ZIP updates, shared-hosting friendly deployment

## Contact

For business inquiries, enterprise support, or collaboration:

`kurama87@gmail.com`

<div align="center">

**v1.23.0 "Rentaka" — Current stable release line.**

Built by Vondereich.

</div>
