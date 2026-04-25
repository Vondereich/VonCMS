# VonCMS v1.23.7 "Rentaka"

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

---

## ⚠️ Important Notice

This repository contains **documentation and source code references only**.

👉 **Download the full, deployable system from:**  
[https://github.com/Vondereich/VonCMS/releases](https://github.com/Vondereich/VonCMS/releases)

VonCMS is distributed as a **pre-built ZIP package** designed for shared hosting environments.  
**No Node.js is required in production.**

> [!CAUTION]
> **Updates & .htaccess**: The Over-The-Air (OTA) update system automatically handles core files and assets. However, it does **not** overwrite your `.htaccess` to prevent breaking host-specific configurations. If a new version requires `.htaccess` changes, a specific note will be provided in the release documentation. You can always use **General Setting → Tools → Fix .htaccess** to sync the latest rules manually.

---

## What is VonCMS?

VonCMS is a hybrid CMS that delivers a **modern React 19 SPA experience** powered by a **practical PHP/MySQL backend**. It is built for publishers who want a premium editing and reading experience without the complexity of managing separate frontend and backend deployments.

### The Core Idea: Modern Frontend, Practical Backend
Most CMS solutions fall into two extremes:
- **Traditional CMS**: Easy to deploy, but often heavy and outdated.
- **Modern Headless CMS**: Powerful, but requires complex DevOps and expensive hosting.

**VonCMS sits in the middle.** It gives you the speed of a Single Page Application (SPA) with the simplicity of a "copy-paste" PHP deployment.

---

## 🚀 Key Advantages

### 1. SEO & Performance Excellence
- **Zero-Hydration-Race Engine**: Unlike standard SPAs, our Server-Side SEO Engine ensures bots (Google, Bing, Facebook) see 100% of your content, meta tags, and JSON-LD Schema on the first render.
- **Proven Indexing Speed**: Users have reported new content being indexed by Google in **under 12 hours**.
- **Canonical Permalink Logic**: Automatically manages legacy IDs and redirects them to SEO-friendly `{category}/{slug}` structures.

### 2. Shared Hosting Optimized (cPanel King)
- **Zero Node.js Runtime**: No need for VPS or specialized JS hosting (Vercel/Netlify). Deploy to any cPanel, Apache, or LiteSpeed host.
- **Lightweight Footprint**: The entire build is optimized for low memory usage, making it faster than many WordPress setups.
- **Ready for Scale**: Tested with **100k+ posts** using server-side pagination and MySQL FULLTEXT search.

### 3. Defense-in-Depth Security
- **SSRF Protection**: Hardened media re-hosting engine for safe remote content ingestion (e.g., from WordPress imports).
- **XSS Mitigation**: Integrated DOMPurify sanitization and secure `dangerouslySetInnerHTML` handling.
- **Strict API Layer**: 73 dedicated HTTP API request handlers with built-in CSRF protection and role-based access control.

---

## Why "Rentaka"?

> _"Rentaka" — Historically, a swivel gun and a vital piece of artillery in traditional Malay naval warfare._

The `v1.23` release line marks the transition of VonCMS from a simple blog engine to a high-performance "artillery" for serious publishers. It focuses on scalability, admin performance, and hardened security—ready for production-grade publishing workloads.

---

## v1.23 Release Line Snapshot

| Metric | Result | Context |
|-------|--------|--------|
| **API Surface** | 73 HTTP API request handlers | 71 under `public/api/` + 2 bridge handlers. |
| **Large Dataset** | 100k+ post-ready | Server-side pagination + FULLTEXT search standard. |
| **Performance** | Optimized for Core Web Vitals | Built-in SSR-style hydration for search bots. |
| **Build Size** | Sub-1MB-class package | No Node manifests or runtime dependencies in Deploy. |

### Search Benchmark (Dataset: 30,035 posts)
- **FULLTEXT Search**: `133.98ms` average
- **Legacy LIKE Search**: `220.69ms` average
- **Speedup**: ~1.6x faster on large datasets.

---

## What's New in v1.23.x

- **WordPress Importer Hardening**: DNS-resolved public IP validation for remote media fetch.
- **Database Manager Clarity**: Real-time SQL error reporting and sanitized backup naming.
- **Security Audit Polish**: Media role gating and stricter installer preflight checks.
- **Admin UX**: Real-time autosave countdowns and better manual save feedback.
- **SEO Hydration**: Improved meta-description alignment and manual excerpt preservation.

---

## Core Features

- **React 19 SPA**: Smooth navigation without full page reloads.
- **Pure PHP Backend**: Easy deployment to shared hosting (cPanel).
- **Full Suite Built-in**: SEO, Analytics, Newsletter, Comments, and Media Manager included.
- **6 Modern Themes**: TechPress, Digest, Portfolio, Prism, Corporate Pro, and Default (all with dark mode).
- **Publisher First**: Roles, audit logs, draft workflows, and scheduled posts are part of the core.

---

## Quick Start & Requirements

### Requirements
- **PHP**: 8.2+
- **Database**: MySQL 5.7+
- **Server**: Apache/LiteSpeed (.htaccess support required)
- **Local Testing**: Compatible with XAMPP, WAMP, and Laragon.

### Installation
1. Download the latest **VonCMS Deploy** ZIP from [Releases](https://github.com/Vondereich/VonCMS/releases).
2. Extract into your web root.
3. Open `yoursite.com/install` and follow the wizard.
4. Access the dashboard at `/admin`.

---

## Open Source Roadmap

VonCMS is planned to transition to open source in the **v1.25.x release line** under an **MIT/GPL license**.

The current phase (v1.23 - v1.24) focuses on stabilizing the core, finalizing internal architecture, and completing the security/performance audit cycle to ensure a rock-solid foundation for the community.

---

<div align="center">

**v1.23.7 "Rentaka" — Official Release**  
Built by Vondereich

[Official Website](https://skripglobal.com/) | [kurama87@gmail.com](mailto:kurama87@gmail.com)

</div>
