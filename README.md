# VonCMS v1.23.0 "Rentaka"

<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

[![Version](https://img.shields.io/badge/Version-1.23.0-brightgreen?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/badge/Downloads-Latest-orange?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS/releases)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE.md)

[Official Website](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Installation](INSTALL.md) | [Manual](MANUAL.md) | [API](API.md) | [Upgrade](UPGRADE.md)

</div>

<img width="1920" height="991" alt="VonCMS Admin" src="https://github.com/user-attachments/assets/c3b01898-01c3-41d3-a129-f756e5a7fcd5" />

VonCMS is a hybrid CMS with a React frontend and a PHP/MySQL backend. It is built for publishers who want a modern editing and reading experience without turning deployment into a separate frontend/backend project.

**Rentaka** pushes that positioning further: a publisher-grade CMS with performance-aware admin flows, a sharper SPA experience, and a release line already aligned for large content libraries.

### Why "Rentaka"?

> _"Rentaka" — Historically, a swivel gun and a vital piece of artillery in traditional Malay naval warfare._
>
> We chose **Rentaka** for the v1.23.0 baseline because it represents a transition from a simple blog engine to a high-performance "artillery" for elite publishers. Just as the Rentaka was a game-changer on the seas, this release line is our game-changer for the CMS market—delivering hardened admin scalability, installer safety, and an architecture capable of handling `100k+` posts without breaking a sweat.
>
> Rentaka is the force that carries VonCMS into the elite tier of content management.

---

## ⚠️ Important: .htaccess Warning

> **[!CAUTION]** OTA updates do **NOT** include `.htaccess` changes. The `v1.23` release line inherits critical security rules (DirectoryIndex, localhost HTTPS bypass, RSS routing, WebP MIME, CORS, and XSS protections). **After every update, you MUST:**
> 1. **Dashboard:** Go to **General Setting → Tools → Fix .htaccess**.
> 2. **Manual:** Upload the `.htaccess` file from the latest Deploy package to your web root.

---

## v1.23.0 Snapshot

| Metric                 | Result                         | Context                                                                                             |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **API Surface**        | 73 HTTP API request handlers   | 71 handlers under `public/api/` + 2 bridge handlers.                                                |
| **Large Dataset Path** | `100k+` post-ready baseline    | Server-bound pagination and FULLTEXT search are now standard.                                       |
| **Load Performance**   | 11,600 req/s @ 50 concurrent\* | Internal benchmark note for the `Rentaka` release line.                                             |
| **Build Size**         | Deploy 0.88MB, Source 0.81MB   | Ultra-lightweight production artifacts.                                                             |

---

## What's New in v1.23.0

- **Rentaka Release Promotion**: Unified versioning across core, installer, and all 6 bundled themes to the `1.23` line.
*   **Admin System Alerts Tray**: Integrated a new real-time tray for system alerts, security warnings, and update notices.
- **Admin Scalability Consolidation**: Inherits server-side pagination for Comments, Users, and Content managers to eliminate UI lag.
- **Security & Repair Hardening**: "Fix .htaccess" now preserves host-generated PHP handlers and redirects with `.bak` auto-backup.
- **Editor Polish**: Manual excerpt preservation and `metaDescription` alignment for better SEO hydration.

---

## Why VonCMS?

VonCMS is built for a different workflow: **Modern Frontend, Practical Backend.**

| Feature                                | Benefit                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| **React 19 SPA**                       | Navigation stays fast - no full page reloads.                                                 |
| **Pure PHP Backend**                   | Deploy to shared hosting or cPanel without needing Node.js in production.                     |
| **Full Suite Built-in**                | SEO, Analytics, Newsletter, Comments, and Media Manager included. No plugin bloat.            |
| **6 Modern Themes**                    | TechPress, Digest, Portfolio, Prism, Corporate Pro, and Default. All with dark mode.          |
| **Publisher First**                    | Roles, audit logs, draft workflows, and scheduled posts are part of the core.                 |

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

- [Features Guide](FEATURES.md) | [Installation Guide](INSTALL.md) | [User Manual](MANUAL.md)
- [API Reference](API.md) | [Upgrade Guide](UPGRADE.md) | [Introduction](INTRODUCTION.md)

**Contact:** `kurama87@gmail.com`

<div align="center">

**v1.23.0 "Rentaka" — Official Release.**
Built by Vondereich.

</div>
