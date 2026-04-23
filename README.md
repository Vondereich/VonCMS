# VonCMS v1.23.7 "Rentaka" (Preview)

<div align="center">

![VonCMS Banner](https://i.ibb.co/rG3XY737/fa17357f-0820-4069-b688-6baa3b0dd50e.png)

[![Version](https://img.shields.io/badge/Version-1.23.7-brightgreen?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/badge/Downloads-Latest-orange?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS/releases)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](docs/LICENSE.md)

[Official Website](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Installation](docs/INSTALL.md) | [Manual](docs/MANUAL.md) | [API](docs/API.md) | [Upgrade](docs/UPGRADE.md)

</div>

<img width="1920" height="991" alt="VonCMS Admin" src="https://github.com/user-attachments/assets/c3b01898-01c3-41d3-a129-f756e5a7fcd5" />

VonCMS is a hybrid CMS with a React frontend and a PHP/MySQL backend. It is built for publishers who want a modern editing and reading experience without turning deployment into a separate frontend/backend project.

**Rentaka** pushes that positioning further: a publisher-grade CMS with performance-aware admin flows, a sharper SPA experience, and a release line already aligned for large content libraries.

### Why "Rentaka"?

> _"Rentaka" — Historically, a swivel gun and a vital piece of artillery in traditional Malay naval warfare._
>
> We chose **Rentaka** for the `v1.23` baseline because it represents a transition from a simple blog engine to a high-performance "artillery" for elite publishers. Just as the Rentaka was a game-changer on the seas, this release line is our game-changer for the CMS market—delivering hardened admin scalability, installer safety, and an architecture capable of handling `100k+` posts without breaking a sweat.
>
> Rentaka is the force that carries VonCMS into the elite tier of content management.

---

> **Open Source Roadmap:** Targeting the **v1.25.x line** for the official open source transition (MIT/GPL). The goal is to complete the next stability cycle before opening to the community. Stay tuned. 🚀

---

## ⚠️ Important: .htaccess Warning

> **[!CAUTION]** OTA updates do **NOT** include `.htaccess` changes. The `v1.23` release line inherits critical security rules (DirectoryIndex, localhost HTTPS bypass, RSS routing, WebP MIME, CORS, and XSS protections). **After every update, you MUST:**
>
> 1. **Dashboard:** Go to **General Setting → Tools → Fix .htaccess**.
> 2. **Manual:** Upload the `.htaccess` file from the latest Deploy package to your web root. If `uploads/.htaccess` is missing or outdated on your host, refresh it from the Deploy package too.

---

## v1.23 Release Line Snapshot

| Metric                 | Result                         | Context                                                                                               |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **API Surface**        | 73 HTTP API request handlers   | 71 handlers under `public/api/` + 2 bridge handlers.                                                  |
| **Large Dataset Path** | `100k+` post-ready baseline    | Server-bound pagination and FULLTEXT search are now standard.                                         |
| **Load Performance**   | Performance-audited baseline   | Internal benchmark notes exist, but throughput varies by host, content mix, and cache/CDN setup.      |
| **Build Size**         | Sub-1MB-class release packages | Current local `v1.23.7` release artifacts stay lightweight without shipping Node manifests in Deploy. |

---

## Search Benchmark Snapshot

Local benchmark snapshot on a dataset of `30,035 posts` (`20,150` published):

- `MATCH(title, content) AGAINST('teknologi')`: `5,665` hits, `133.98ms` average
- Legacy `LIKE '%teknologi%'`: `5,665` hits, `220.69ms` average
- FULLTEXT was 1.6x faster than legacy `LIKE` search on this dataset
- Indexed status and category filters stayed in the low-millisecond range on this run

---

## What's New in the v1.23 Release Line

- **Rentaka Release Promotion**: Unified the public release baseline across core, installer, and all 6 bundled themes to the `1.23` line.
- **v1.23.7 WordPress Importer Hardening Patch**: Remote media fetch now validates DNS-resolved public IPs and every HTTP(S) redirect hop before temp media writes.
- **v1.23.6 Database Manager Clarity Patch**: SQL imports now show real backend errors, VonCMS backup comments restore correctly, backup filenames use the configured site label, and Database Manager docs explain active-database restore behavior.
- **v1.23.5 Security Audit Patch**: Media deletion now uses the same media-role gate as the Gallery endpoints, and the installer rejects non-POST requests after preflight.
- **v1.23.4 Admin Polish Rollup**: Content Manager author visibility, clearer PostEditor autosave/save feedback, and promo bar solid color customization are now in the active release.
- **Previous v1.23.1 Core Patch**: The legacy settings bridge delegates `get_settings` and `save_settings` to the active database-backed endpoints instead of keeping a drift-prone compatibility path.
- **Admin System Alerts Tray**: The admin header bell now opens a lightweight current-state alerts tray instead of staying as a dead icon.
- **Admin Scalability Consolidation**: Inherits server-side pagination for Comments, Users, and Content managers to eliminate UI lag.
- **Security & Repair Hardening**: "Fix .htaccess" now preserves host-generated PHP handlers and redirects with `.bak` auto-backup.
- **Editor Polish**: Manual excerpt preservation and `metaDescription` alignment for better SEO hydration.

---

## Why VonCMS?

VonCMS is built for a different workflow: **Modern Frontend, Practical Backend.**

| Feature                 | Benefit                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **React 19 SPA**        | Navigation stays fast - no full page reloads.                                        |
| **Pure PHP Backend**    | Deploy to shared hosting or cPanel without needing Node.js in production.            |
| **Full Suite Built-in** | SEO, Analytics, Newsletter, Comments, and Media Manager included. No plugin bloat.   |
| **6 Modern Themes**     | TechPress, Digest, Portfolio, Prism, Corporate Pro, and Default. All with dark mode. |
| **Publisher First**     | Roles, audit logs, draft workflows, and scheduled posts are part of the core.        |

---

## Quick Start & Requirements

### Technical Stack

- **PHP:** 8.2+
- **Database:** MySQL 5.7+
- **Server:** Apache/LiteSpeed (required for `.htaccess` routing).
- **Local Testing:** Compatible with XAMPP, WAMP, and Laragon.

### Installation

1. Extract the latest **VonCMS Deploy** package to your web root.
2. Open `yoursite.com/install` and follow the wizard.
3. Sign in to `/admin`.

> **Manual Update Tip:** Always delete the `assets/` folder in your hosting before extracting a new ZIP to prevent stale asset conflicts.

---

## Documentation & Support

- [Features Guide](docs/FEATURES.md) | [Installation Guide](docs/INSTALL.md) | [User Manual](docs/MANUAL.md) | [Database Manager](docs/DATABASE_MANAGER.md)
- [API Reference](docs/API.md) | [Upgrade Guide](docs/UPGRADE.md) | [Introduction](docs/INTRODUCTION.md)

**Contact:** `kurama87@gmail.com`

<div align="center">

**v1.23.7 "Rentaka" — Official Release.**
Built by Vondereich.

</div>
