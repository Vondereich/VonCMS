# VonCMS v1.23.10 "Rentaka"

<div align="center">

![VonCMS Banner](https://i.ibb.co/rG3XY737/fa17357f-0820-4069-b688-6baa3b0dd50e.png)

[![Version](https://img.shields.io/badge/Version-1.23.10-ff2800?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=blue)](https://github.com/Vondereich/VonCMS/releases)
[![Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&logo=github&color=magenta)](https://github.com/Vondereich/VonCMS/stargazers)
[![Sponsor](https://img.shields.io/badge/Sponsor-Vondereich-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Vondereich)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-gold?style=for-the-badge)](docs/LICENSE.md)

**A modern publishing CMS that runs on practical PHP hosting.**

[Live Demo](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

</div>

<img width="1920" height="991" alt="VonCMS Admin" src="https://github.com/user-attachments/assets/c3b01898-01c3-41d3-a129-f756e5a7fcd5" />

---

## At A Glance

| If you need...                           | VonCMS gives you...                                                |
| ---------------------------------------- | ------------------------------------------------------------------ |
| A modern admin experience                | React 19 SPA dashboard, editor, media, comments, themes, analytics |
| Shared-hosting deployment                | PHP/MySQL backend, Apache/LiteSpeed support, no Node.js runtime    |
| Search-friendly public pages             | Server-rendered SEO output, meta tags, JSON-LD, canonical URLs     |
| Publisher workflows without plugin chaos | Roles, drafts, scheduled posts, audit logs, newsletter, comments   |
| A cleaner path to open source            | Hardened v1.23.x base before the planned v1.25.x public milestone  |

---

## Package Notice

This repository contains **documentation and source code references only**.

Download the full deployable system from:

[https://github.com/Vondereich/VonCMS/releases](https://github.com/Vondereich/VonCMS/releases)

VonCMS ships as a **pre-built Deploy ZIP** for shared hosting. Production sites do **not** need Node.js, Vite, npm, or a separate frontend host.

> [!CAUTION]
> **Updates & .htaccess**: The Over-The-Air update system handles core files and assets, but it does **not** overwrite your `.htaccess` because hosting rules are often site-specific. When a release needs updated rewrite rules, use **General Setting -> Tools -> Fix .htaccess** to sync the managed VonCMS block manually.

---

## The Product Story

### 1. The Problem

Traditional CMS platforms are easy to deploy, but often feel heavy, dated, and difficult to tune. Modern headless stacks are powerful, but they usually add deployment complexity, paid hosting assumptions, and more moving parts than many publishers want.

### 2. The Answer

VonCMS keeps the deployment model simple while upgrading the publishing experience:

- **React 19 admin** for fast editing and dashboard workflows.
- **PHP/MySQL runtime** for familiar shared-hosting installation.
- **SEO-aware public rendering** so crawlers see the real article content, metadata, schema, and canonical links.
- **Built-in publishing tools** instead of depending on a pile of external plugins.

### 3. The Result

You get a CMS that feels modern to manage, stays realistic to host, and is shaped around actual publishing work: writing, importing, scheduling, searching, moderating, and shipping content.

---

## Why "Rentaka"?

> _"Rentaka" - historically, a swivel gun and a vital piece of artillery in traditional Malay naval warfare._

The `v1.23.x` line is the hardened publishing baseline: faster admin flows, stronger import safety, clearer release packaging, better search contracts, and tighter scanner/security cleanup before the public open-source milestone.

---

## Release Snapshot

| Area             | v1.23.10 status                         | Why it matters                                      |
| ---------------- | --------------------------------------- | --------------------------------------------------- |
| API surface      | 73 HTTP API request handlers            | Dedicated endpoints with role and CSRF boundaries   |
| Editor + media   | Vertical video alignment and previewing | Reels, Shorts, and embeds stay usable in publishing |
| Page management  | Server-side search parity               | Pages can be searched like posts                    |
| AI settings      | Private saved API config + expiry flow  | Saved Gemini keys stay admin-only and rotatable     |
| Media pipeline   | Responsive fallback reporting           | Failed variants are visible instead of silent       |
| Open-source prep | Scanner-noise cleanup and smoke checks  | Fewer false positives before public review          |
| Hosting baseline | Shared-hosting first                    | Deploy ZIP runs without Node.js in production       |

---

## What Shipped in v1.23.10

- **AI API Key Privacy & Rotation**: saved API settings stay admin-only/private, with optional 30-day Gemini key expiry metadata and fallback prompt flow.
- **Media Fallback Reporting**: upload fallback status is surfaced when responsive/WebP variant generation cannot produce mobile candidates.
- **Page Manager Search**: Page Manager now has the same server-side search direction as Post Manager, with FULLTEXT support and safe fallback behavior.
- **Vertical Video Embeds**: YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels can render in portrait format and use editor alignment controls.
- **Preview Stability**: editor preview paths were stabilized so iframe previews do not repeatedly remount during normal autosave updates.
- **Scanner Polish**: avoidable low-risk `innerHTML` noise was reduced while keeping intentional sanitized HTML surfaces intact.

---

## Search Benchmark Snapshot

Dataset: `30,035 posts`.

| Search path        | Average result |
| ------------------ | -------------- |
| FULLTEXT search    | `133.98ms`     |
| Legacy LIKE search | `220.69ms`     |

**Result**: 1.6x faster than legacy `LIKE` search on this dataset.

This is a scoped local benchmark snapshot, not a universal hosting guarantee. Real production speed still depends on database size, hosting tier, cache/CDN setup, traffic pattern, and active theme behavior.

---

## Core Features

| Publishing          | Operations                 | Growth                    |
| ------------------- | -------------------------- | ------------------------- |
| Posts and pages     | Installer and repair tools | SEO metadata and schema   |
| Rich editor         | OTA update flow            | RSS, sitemap, IndexNow    |
| Media manager       | Backup and import tooling  | Newsletter tools          |
| Comments moderation | Role-based access          | Analytics integration     |
| Scheduled posts     | Audit logs                 | Theme system with presets |

Bundled themes include TechPress, Digest, Portfolio, Prism, Corporate Pro, and Default, with dark-mode support across the active theme line.

---

## Quick Start

### Requirements

| Requirement | Baseline                             |
| ----------- | ------------------------------------ |
| PHP         | 8.2+                                 |
| Database    | MySQL 5.7+                           |
| Server      | Apache or LiteSpeed with `.htaccess` |
| Local dev   | XAMPP, WAMP, or Laragon              |

### Installation

1. Download the latest **VonCMS Deploy** ZIP from [Releases](https://github.com/Vondereich/VonCMS/releases).
2. Extract it into your web root.
3. Open `yoursite.com/install`.
4. Complete the installer wizard.
5. Sign in at `/admin`.

---

## Project Direction

VonCMS is planned to move toward open source in the **v1.25.x release line** under an **MIT/GPL license**.

The current `v1.23.x` -> `v1.24.x` phase is about making the core boring in the right places: stable install paths, cleaner audits, predictable release packaging, stronger security/performance checks, and documentation that matches what the package actually ships.

For planning details, see [ROADMAP.md](ROADMAP.md). For shipped release truth, see [CHANGELOG.md](CHANGELOG.md).

---

<div align="center">

**v1.23.10 "Rentaka" - Official Release**

Built by Vondereich

[Live Demo](https://skripglobal.com/) | [kurama87@gmail.com](mailto:kurama87@gmail.com)

</div>
