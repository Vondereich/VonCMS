# VonCMS v1.24.10 "HourGlass"

<div align="center">

![VonCMS Banner](https://i.ibb.co/rG3XY737/fa17357f-0820-4069-b688-6baa3b0dd50e.png)

[![Version](https://img.shields.io/badge/Version-1.24.10-96FF00?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=blue)](https://github.com/Vondereich/VonCMS/releases)
[![Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&logo=github&color=magenta)](https://github.com/Vondereich/VonCMS/stargazers)
[![Sponsor](https://img.shields.io/badge/Sponsor-Vondereich-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Vondereich)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-GPL--3.0--only-gold?style=for-the-badge)](LICENSE.md)

**Pragmatic publishing infrastructure for real websites. No plugin chaos. No hosting headaches.**

Ultra-fast. Self-hosted. Zero plugin headaches. VonCMS pairs React 19 with PHP to deliver a CMS that's **56x lighter than WordPress** — and actually enjoyable to use.

[Website](https://vondereich.github.io/getvoncms/) | [Live Demo](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

</div>

---

## 🌟 Community & Open Source Transition

A huge **thank you** to everyone who has tried VonCMS and supported us with a GitHub ⭐! Your interest and feedback are what drive this project forward.

VonCMS is on a mission to modernize the PHP publishing landscape. The project is preparing for the **v1.25.x open-source milestone** under the **GPL-3.0-only license**. This transition is an invitation for the community to help shape the next era of lightweight publishing.

**Help us grow:** Spread the word, share the repository with fellow publishers, and help us build a lighter, faster future for the web. Together, we can make VonCMS the go-to alternative for high-performance publishing.

For shipped release truth, see [CHANGELOG](CHANGELOG.md).

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

| Metric              | Benchmark / Score                                                   |
| ------------------- | ------------------------------------------------------------------- |
| **Lighthouse SEO**  | 🟢 **100/100**                                                      |
| **Lighthouse PERF** | 🟢 **100/100**                                                      |
| **TTFB Snapshot**   | See [Benchmark v7](BENCHMARK.md) for the current no-CDN TTFB report |
| **Setup Time**      | 🚀 **< 2 Minutes** (Extractor + Installer wizard)                   |
| **Complexity**      | 📦 **~200 Core Files** (No `node_modules` in production)            |
| **Plugins Needed**  | 🛡️ **0** (Everything is built-in)                                   |

---

## Package Notice

This repository contains **documentation and source code references only**.

Download the full deployable system from:

[https://github.com/Vondereich/VonCMS/releases](https://github.com/Vondereich/VonCMS/releases)

VonCMS ships as a **pre-built Deploy ZIP** for shared hosting. Production sites do **not** need Node.js, Vite, npm, or a separate frontend host.

> [!CAUTION]
> **Update note**: OTA updates are available again in the `v1.24.10` series after the updater download and SHA256 verification flow was fixed. If your site is on an older version and you want to upgrade to `v1.24.10`, use the manual update flow: delete the old `assets` folder, upload the new Deploy ZIP files, then follow the [Upgrade Guide](UPGRADE.md).

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

| Area                   | Current HourGlass status                          | Why it matters                                                           |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| API surface            | 73 HTTP API request handlers                      | Dedicated endpoints with role and CSRF boundaries                        |
| HourGlass editor       | TipTap and save-helper extraction boundaries      | Media rules and save helpers stay isolated while behavior remains stable |
| Search + content admin | Smooth manual admin search + truthful dashboard   | Admin lists stay deliberate, fast, and no longer freeze at 200           |
| Public discovery       | Server-backed discovery + complete loading parity | Older posts stay discoverable without empty flashes on slow fetches      |
| Public interaction     | Immediate old-post route fallback                 | Older public search results open directly instead of waiting to resolve  |
| Public profiles        | Pending-route guard + theme handoff cache         | Profile routes avoid brief not-found/home flashes while lookup settles   |
| Built-in extensions    | Shared runtime gating + campaign plugin polish    | SEO/analytics toggles now match public runtime behavior across themes    |
| Public rendering       | Comments-off first-paint parity                   | Disabled discussions no longer leak comment CTA copy on initial paint    |
| Hosting baseline       | Shared-hosting first + bounded DB import runtime  | Deploy ZIP stays practical without leaving imports unbounded forever     |

---

## Developer Guide

Developer documentation now uses the public packaged guide:

- [Theme Guide](THEME_GUIDE.md) covers public theme architecture, WYSIWYG rendering, theme registration, shared SDK usage, SEO ownership, performance, and verification.

---

## What Shipped in v1.24.10

- **Final Hotfix**: fixed stale account-linked comment avatars and refreshed release documentation for the current public baseline.
- **Main HourGlass Closeout Work**: see the `v1.24.9` notes below for the larger editor, search, OTA, loading, profile, media, and polish updates.

## What Shipped in v1.24.9

- **Durable TipTap Image State**: image size/alignment choices now persist through save, sanitize, reload, editor preview rehydration, and public rendering, with bubble buttons reflecting the selected image/video alignment.
- **Bounded Search**: public theme search and admin Content Manager search clamp long queries to 120 characters, show visible guidance, debounce server fetches cleanly, and clamp oversized post/page API search terms before SQL binding.
- **OTA Update Recovery**: the updater accepts GitHub release-asset redirect hosts while validating redirect hops and forwarding caller-supplied SHA256 digests through both dashboard and direct updater entry points.
- **Readiness-Based Skeleton Loading**: the bundled skeleton no longer fades on a fixed timer; React readiness owns the transition so fast pages move immediately and slower boots avoid a blank shell.
- **Ads Manager Helper Copy Cleanup**: Ads Manager helper panels now use concise, behavior-neutral guidance for header, in-feed, and popup slots without changing placement, sizing, frequency, or injection behavior.
- **Late HourGlass Micro-Polish**: public profile email masking, admin profile read-only boundaries, Media CDN upload URL normalization, TechPress long-logo header alignment, thumbnail crop defaults, and shared ad/widget containment are covered by smoke guards.
- **Release Truth Sweep**: README, changelog, metadata, and smoke guards now keep `v1.24.9` closed as the HourGlass preflight and late micro-polish lane.

## Current HourGlass Baseline

HourGlass keeps the TipTap editor migration, public discovery scaling, extension runtime gating, profile stability, and shared-hosting safety work from the earlier `v1.24.x` patches. For full patch-by-patch history, see [CHANGELOG](CHANGELOG.md).

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

### Fresh Installation

1. Download the latest **VonCMS Deploy** ZIP from [Releases](https://github.com/Vondereich/VonCMS/releases).
2. Extract it into your web root.
3. Open `yoursite.com/install`.
4. Complete the installer wizard.
5. Sign in at `/admin`.

### Updating Existing Sites

If your site is on an older version, update manually to `v1.24.10` with the current Deploy ZIP first. In cPanel/File Manager or FTP, delete the old `assets/` folder before uploading the new files so old hashed JS/CSS files cannot stay behind.

After the site is already on `v1.24.10`, use the admin dashboard OTA updater for future patches. Go to `Settings -> System`, run the update, and then verify the homepage, one post, and the admin dashboard.

Manual ZIP replacement is only the fallback when the admin panel is unavailable, the install is too old for OTA, or the server blocks the updater.

---

---

<div align="center">

**v1.24.10 "HourGlass" - Current Working Release Line**

Built by Vondereich

[Live Demo](https://skripglobal.com/) | [kurama87@gmail.com](mailto:kurama87@gmail.com)

</div>
