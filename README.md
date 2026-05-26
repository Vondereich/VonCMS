# VonCMS v1.24.7 "HourGlass"

<div align="center">

![VonCMS Banner](https://i.ibb.co/rG3XY737/fa17357f-0820-4069-b688-6baa3b0dd50e.png)

[![Version](https://img.shields.io/badge/Version-1.24.7-96FF00?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=blue)](https://github.com/Vondereich/VonCMS/releases)
[![Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&logo=github&color=magenta)](https://github.com/Vondereich/VonCMS/stargazers)
[![Sponsor](https://img.shields.io/badge/Sponsor-Vondereich-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Vondereich)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-GPL--3.0--only-gold?style=for-the-badge)](docs/LICENSE.md)

**Pragmatic publishing infrastructure for real websites. No plugin chaos. No hosting headaches.**

Ultra-fast. Self-hosted. Zero plugin headaches. VonCMS pairs React 19 with PHP to deliver a CMS that's **56x lighter than WordPress** - and actually enjoyable to use.

[Website](https://vondereich.github.io/getvoncms/) | [Live Demo](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

</div>

---

## 🌟 Community & Open Source Transition

A huge **thank you** to everyone who has tried VonCMS and supported us with a GitHub ⭐! Your interest and feedback are what drive this project forward.

VonCMS is on a mission to modernize the PHP publishing landscape. The project is preparing for the **v1.25.x open-source milestone** under the **GPL-3.0-only license**. This transition is an invitation for the community to help shape the next era of lightweight publishing.

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

## Developer Extension Guides

Theme and plugin development now use separate packaged guides:

- [Theme Development](docs/THEME_DEVELOPMENT.md) covers public theme architecture, WYSIWYG rendering, theme registration, shared SDK usage, SEO ownership, performance, and verification.
- [Plugin Development](docs/PLUGIN_DEVELOPMENT.md) covers system plugin registration, activation state, settings ownership, custom HTML sanitization, PHP security principles, article hooks, and release checks.

---

## What Shipped in v1.24.7

- **Shared Extension Runtime Gate**: built-in plugin runtime checks now use one active/pluginStatus helper so inactive or not-installed system plugins stay disabled consistently across registry slots, article hooks, providers, and bundled themes.
- **VonSEO Toggle and Social Image Repair**: all bundled themes now gate `VonSEO` rendering through the saved plugin state, and social image selection now honors the large OG image fallback without overwriting `og:image` with the square fallback.
- **VonSEO General Description and Robots Cleanup**: site-level meta descriptions now read from General Settings, stale SEO override defaults are removed on save, and default/served robots output no longer emits unsupported `Crawl-delay` directives.
- **VonAnalytics Runtime Toggle**: GA injection, native page tracking, and the cookie consent banner now respect the VonAnalytics plugin active state instead of running from analytics settings alone.
- **Promo/Gift Campaign Polish**: Promo Bar now supports campaign windows, configurable dismiss duration, and target behavior; Gift Widget now supports position, label, color, and target behavior.
- **Plugin and Theme Guide Refresh**: root `THEME_GUIDE.md` was retired in favor of separate packaged Theme Development and Plugin Development guides under `docs/`.
- **Extension Upgrade Smoke Coverage**: integration smoke checks now lock the shared plugin runtime helper, VonSEO theme gating, VonAnalytics runtime gating, social image fallback, robots/default-description guards, and Promo/Gift campaign options.

## Current HourGlass Baseline Carried Forward from v1.24.6

- **Shared Public Discovery Loading Guard**: server-backed search/category fetches now enter loading immediately when the local preload fallback is empty, preventing the first paint from jumping into a blank or empty-results state.
- **Remaining Theme Loading Parity**: TechPress, Prism, Corporate Pro, and Portfolio now render explicit initial loading panels before empty grids while older category/search results are being fetched from the server.
- **Discovery Loading Smoke Coverage**: integration smoke checks now require the shared hook and all bundled discovery themes to preserve loading-state behavior before release packaging.

## Current HourGlass Baseline Carried Forward from v1.24.5

- **Editor Extension Boundary Split**: TipTap extensions, legacy image/video nodes, media alignment helpers, and editor surface constants now live in `src/components/editor/editorExtensions.ts`, keeping the main editor component focused on UI, state, and save behavior without changing the existing saved HTML/media parse-render subset.
- **Post Editor Save Helper Split**: autosave countdowns, save-status copy, schedule normalization, saved snapshot merging, and conflict-message ownership now live in `src/components/editor/postEditorSaveHelpers.ts`, while the existing save buttons and publish/schedule flow stay in `PostEditor.tsx`.
- **Public Profile Route Stability**: profile pages now hold the route skeleton while public profile lookup is pending, reject stale profile fetches during fast profile-to-profile navigation, and hand resolved profiles to active themes without briefly falling back to home or not-found states.
- **Immediate Old-Post Navigation**: public search/category results that sit outside the preload now open through the internal id-backed post route immediately instead of waiting on a pre-navigation fetch.
- **Repeated-Search Stability**: the shared public discovery hook now keeps the current visible list on screen while a new server-backed search/category request is in flight, reducing empty flashes on slower devices.
- **Comments-Off First-Paint Fix**: comments-disabled posts now hydrate `discussionEnabled` from PHP before the async settings fetch, preventing brief public discussion CTA text leaks.
- **Corporate Pro Preload Cleanup**: non-Corporate public pages no longer preload the Corporate Pro theme chunk from the main Vite entry.
- **Video Bubble Anchor Repair**: the editor video bubble now anchors to the iframe itself and recenters after aspect/layout changes.
- **Bounded Import Runtime**: database imports now use a 300-second timeout guard instead of disabling request timeouts entirely.

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

**v1.24.7 "HourGlass" - Current Working Release Line**

Built by Vondereich

[Live Demo](https://skripglobal.com/) | [kurama87@gmail.com](mailto:kurama87@gmail.com)

</div>
