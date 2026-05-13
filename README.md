# VonCMS v1.24.2 "HourGlass"

<div align="center">

![VonCMS Banner](https://i.ibb.co/rG3XY737/fa17357f-0820-4069-b688-6baa3b0dd50e.png)

[![Version](https://img.shields.io/badge/Version-1.24.2-96FF00?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=blue)](https://github.com/Vondereich/VonCMS/releases)
[![Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&logo=github&color=magenta)](https://github.com/Vondereich/VonCMS/stargazers)
[![Sponsor](https://img.shields.io/badge/Sponsor-Vondereich-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Vondereich)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-gold?style=for-the-badge)](docs/LICENSE.md)

**Pragmatic publishing infrastructure for real websites. No plugin chaos. No hosting headaches.**

Ultra-fast. Self-hosted. Zero plugin headaches. VonCMS pairs React 19 with PHP to deliver a CMS that's **56x lighter than WordPress** - and actually enjoyable to use.

[Website](https://vondereich.github.io/getvoncms/) | [Live Demo](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

</div>

---

## 🌟 Community & Open Source Transition

A huge **thank you** to everyone who has tried VonCMS and supported us with a GitHub ⭐! Your interest and feedback are what drive this project forward.

VonCMS is on a mission to modernize the PHP publishing landscape. We are planned to move toward **full open source** in the **v1.25.x release line** under an **MIT or GPL license**. This transition is an invitation for the community to help shape the next era of lightweight publishing.

**Help us grow:** Spread the word, share the repository with fellow publishers, and help us build a lighter, faster future for the web. Together, we can make VonCMS the go-to alternative for high-performance publishing.

For shipped release truth, see [Changelog.md](Changelog.md).

---

[![VonCMS Admin Walkthrough](https://img.youtube.com/vi/glbqEG37aiM/maxresdefault.jpg)](https://www.youtube.com/watch?v=glbqEG37aiM)

---

## At A Glance

| If you need...                           | VonCMS gives you...                                                   |
| ---------------------------------------- | --------------------------------------------------------------------- |
| A modern admin experience                | React 19 SPA dashboard, editor, media, comments, themes, analytics    |
| Shared-hosting deployment                | PHP/MySQL backend, Apache/LiteSpeed support, no Node.js runtime       |
| Search-friendly public pages             | Server-rendered SEO output, meta tags, JSON-LD, canonical URLs        |
| Publisher workflows without plugin chaos | Roles, drafts, scheduled posts, audit logs, newsletter, comments      |
| A cleaner path to open source            | Closed v1.23.x "Rentaka" baseline before the v1.24.x "HourGlass" line |

---

## ⚡ Performance Baseline

VonCMS is built for speed, not just in the editor, but for the final reader and the system owner.

| Metric              | Benchmark / Score                                        |
| ------------------- | -------------------------------------------------------- |
| **Lighthouse SEO**  | 🟢 **100/100**                                           |
| **Lighthouse PERF** | 🟢 **100/100**                                           |
| **Setup Time**      | 🚀 **< 2 Minutes** (Extractor + Installer wizard)        |
| **Complexity**      | 📦 **~200 Core Files** (No `node_modules` in production) |
| **Plugins Needed**  | 🛡️ **0** (Everything is built-in)                        |

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

## 💎 The VonCMS Philosophy

**"Everything you need. Nothing you don't."**

Most CMS projects hand you an empty shell and say "figure it out with plugins." VonCMS arrives with the lights on, the furniture in place, and the kitchen already stocked.

- **Built for Publishers, Not Just Developers**: The dashboard is designed for the person who publishes content daily, not the engineer who configured the server.
- **Zero Plugin Chaos**: Features that would be 10+ separate plugins in WordPress (SEO, Analytics, Forms, Newsletter, Security, Media Optimization) are built directly into the core.
- **Short Request Path**: React talks to PHP. PHP talks to MySQL. No heavy middleware stack, no plugin overhead—just pure performance.

---

## **VonCMS Philosophy**

> **"Everything you need. Nothing you don't."**

Most CMS projects hand you an empty shell and say "figure it out with plugins." VonCMS arrives with the lights on, the furniture in place, and the kitchen already stocked.

- **Built for Publishers, Not Just Developers**: The dashboard is designed for the person who publishes content daily, not the engineer who configured the server.
- **Zero Plugin Chaos**: Features that would be 10+ separate plugins in WordPress (SEO, Analytics, Forms, Newsletter, Security, Media Optimization) are built directly into the core.
- **Short Request Path**: React talks to PHP. PHP talks to MySQL. No heavy middleware stack, no plugin overhead—just pure performance.

---

## Release Snapshot

| Area                    | v1.24.2 status                            | Why it matters                                      |
| ----------------------- | ----------------------------------------- | --------------------------------------------------- |
| API surface             | 73 HTTP API request handlers              | Dedicated endpoints with role and CSRF boundaries   |
| HourGlass editor        | TipTap stabilization and live-save guards | Authoring stays reliable across reload/save flows   |
| Search + content admin  | Smooth manual post search + page parity   | Admin lists stay deliberate, fast, and predictable  |
| Public rendering        | Table/header parity and noscript safety   | Previewed content matches live posts more closely   |
| Theme/profile stability | TechPress guards and authentic 404s       | Empty searches and fake profiles do not leak public |
| AI settings             | Private saved API config + expiry flow    | Saved Gemini keys stay admin-only and rotatable     |
| Hosting baseline        | Shared-hosting first                      | Deploy ZIP runs without Node.js in production       |

---

## What Shipped in v1.24.2

- **HourGlass TipTap Stabilization**: editor reload recovery, sticky toolbar behavior, save freshness, SEO restore guards, list/quote visibility, and media spacing are locked by smoke coverage.
- **Post Manager Search Smoothness**: manual search keeps the current table stable while fetching and uses direct FULLTEXT search with a narrow title fallback.
- **Theme & Profile Reliability**: TechPress empty-search crashes are guarded, invalid public profiles fall through to real 404s, and hard reload FOUC is reduced.
- **Live Content Parity**: public tables, table headers, mobile heading hierarchy, and single-post noscript output now match the editor/public safety contract more closely.
- **Page Manager Search**: Page Manager keeps server-side search parity with FULLTEXT support and safe fallback behavior.
- **Release Guard Coverage**: integration smoke checks now cover editor contracts, search behavior, profile routing, public table styling, noscript safety, docs alignment, and release packaging.

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

---

<div align="center">

**v1.24.2 "HourGlass" - Current Working Release Line**

Built by Vondereich

[Live Demo](https://skripglobal.com/) | [kurama87@gmail.com](mailto:kurama87@gmail.com)

</div>
