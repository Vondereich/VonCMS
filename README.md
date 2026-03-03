# VonCMS v1.20.x "Mandala" [Exclusive Preview]
*(Official Public Release: Post-Aidilfitri / April 2026)*
<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

**React 19 + Vite 6 Frontend | PHP 8.2+ API Engine | Native IndexNow | Self-Healing Integrity**

[![Official Website](https://img.shields.io/badge/Website-skripglobal.com-blue?style=for-the-badge)](https://skripglobal.com/)
[![GitHub Stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&logo=github&color=yellow)](https://github.com/Vondereich/VonCMS/stargazers)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&logo=github&color=blueviolet)](https://github.com/Vondereich/VonCMS/releases)
[![Latest Release](https://img.shields.io/github/v/release/Vondereich/VonCMS?style=for-the-badge&logo=github&color=brightgreen)](https://github.com/Vondereich/VonCMS/releases)
[![Build Standard](https://img.shields.io/badge/Foundation-Mandala-orange?style=for-the-badge)](https://github.com/Vondereich/VonCMS)

[🌐 Website](https://skripglobal.com/) • [📥 Download](https://github.com/Vondereich/VonCMS/releases) • [📖 Documentation](https://github.com/Vondereich/VonCMS/blob/main/Introduction.md)

</div>

---

> **The Hybrid CMS for the Modern Web.**
> Performance of a Static Site, Flexibility of a Headless CMS, Ease of WordPress.

VonCMS "Mandala" is a hybrid content management system built for high-traffic portals. It is the **Anti-Monolithic** answer to bloated traditional CMS platforms (like WordPress).

> 🌀 **The "Mandala" Philosophy (v1.20.x)**
> In ancient Sanskrit, a Mandala represents a geometric center, unity, and a completed foundation. The `v1.20` series earns this codename because it finalizes the Absolute Architecture of VonCMS—locking down security, API endpoints, and database structures so perfectly that future updates (v1.30.x and beyond) can be built upon it without breaking changes.

### 🔥 Why VonCMS Kills The Monolith:
- **Zero Plugin Bloat**: Everything you need—**Auto WebP Conversion**, **Smart AI Writer**, **Language-Agnostic SEO Tags**, **Native `llms.txt`**, and **Sitemap Generators**—are built directly into the core engine. No clashing third-party plugins.
- **Micro-Query Performance**: While traditional CMS executes 40+ database queries per page load, VonCMS executes **only 1 single query**. It sips just ~20MB of RAM, achieving 100% Google PageSpeed scores natively without expensive CDN or Caching plugins.
- **AI-Ready (RAG Standard)**: The first CMS to natively support `llmstxt.org` standards out-of-the-box, serving clean Markdown vectors directly to ChatGPT, Claude, and Gemini crawlers.
- **Enterprise Speed on Shared Hosting**: Built with a blazing-fast **React 19** frontend and a hardened **PHP 8.2** backend to deliver LCP in < 0.40s.

> [!WARNING]
> **🚨 CRITICAL UPDATE NOTICE (v1.20.7)**
> Users on **v1.11.11 or older** MUST perform a **MANUAL UPDATE**. Delete the `public/assets` folder before uploading new files. 
> Users on **v1.11.12 or newer** can safely use the built-in **OTA Updater**.

---

## 🌍 The Road to Open Source

VonCMS is currently a closed-ecosystem under active, aggressive development. However, our ultimate goal is to **open-source the core engine** to the community. 

This will happen when these two milestones are achieved:
1. **Critical Mass**: Reaching a stable benchmark of **1,000 to 5,000 active users/installations**.
2. **Ecosystem Readiness**: The official launch of the **VonCMS Marketplace & Landing Page**, ensuring third-party developers have a structured, secure platform to distribute themes and plugins.

Until then, the codebase remains proprietary as we finalize the Core Foundation and upcoming codename series.

---

## 🚀 The Great Leap: What's New in v1.20 (vs v1.11)

If you are upgrading from the legacy `v1.11` series, you are moving into a completely different league. Here is the **Wow Factor** you'll experience immediately:

### ⚡ Performance & Core

- **React 19 + Vite 6 Infrastructure**: The entire frontend has been rewritten for modern standards—blazing fast HMR and zero-latency UI.
- **Lighthouse LCP Optimizer**: Native `fetchPriority="high"` injection for hero images, pushing page load speeds to < 0.4s.
- **Absolute Mandala Engine**: Full path hardening across all 69 API endpoints to eliminate hosting "ghost bugs."
- **Hardened SMTP Engine**: Direct socket-based SMTP with TLS enforcement, automatic fallback to PHP mail().

### 🎨 Design & Experience

- **Neutral Dark Mode (`#0a0a0a`)**: A professional, high-contrast dark palette that matches premium SaaS standards.
- **Semantic Color Engine**: Change your entire brand's aesthetic via simple, unified color tokens.
- **Admin Smart Pagination**: Media Library and Posts now lazy-load in chunks (24 items/page) for a fluid management experience.

### 🤖 AI & LLM Ecosystem

- **Native `llms.txt` Standard**: The first CMS to serve structured, organized Markdown summaries directly to AI crawlers (Perplexity, ChatGPT Search, Gemini).
- **Smart Tags Engine**: 100% automated, language-agnostic keyword extraction using bigrams, casing analysis, and statistical paragraph spread. Zero manual tagging required.
- **Von Writer API**: Prompt-engineered AI content generation built-in, producing SEO-ready, properly structured HTML (Listicles, headings, bullet points) with just a single title input.

### ✍️ Next-Gen Authoring

- **Editor Sanity**: No more "Ghost Paragraphs." Enter-key normalization, sticky formatting fixes, and intelligent backspace handling make writing a joy.
- **Silent Auto-Save**: Your drafts are protected every 60 seconds without interrupting your flow.
- **Layout Scrubber**: Copy-paste from Word or external sites safely—excessive layout CSS is automatically stripped while preserving typography.

### 🖼️ The Beast Media Engine

- **WebP Auto-Conversion**: Upload a JPEG/PNG, and VonCMS automatically generates an optimized `.webp` variant for the frontend. Enabled by default.
- **Beast Cleaner**: A two-step orphaned media scanner to keep your disk storage lean and efficient.
- **Smart Thumbnail Detection**: Automatic `_thumb` variant lookup for gallery previews.

---

## 🏛️ The VonCMS Philosophy

1.  **Security First**: 6-layer defense (CSRF, session binding, rate limiting, etc.) baked into a single `security.php` middleware.
2.  **Easiness Second**: 2-minute setup with zero-config essentials.
3.  **Flexibility Third**: Runs anywhere (cPanel, Shared Hosting, VPS) with a < 15MB memory footprint.

---

## 🛠️ The Technology Stack

- **Frontend**: React 19 + Vite 6 + TailwindCSS (Single Page Application experience)
- **Backend**: PHP 8.2+ (Universal compatibility, high performance)
- **Database**: MySQL/MariaDB (Optimized for millions of rows)
- **Editor**: Lightweight contentEditable (Professional coding/authoring environment)

---

## ⚡ Performance Showcase

| **Requests Per Sec** | 10.81 | **606.70** | ⚡ **56x Faster** |
| **Avg. Server Latency** | 5,667ms | **125ms** | 🛡️ **Ultra-Low** |
| **Largest Contentful Paint** | ~2.5s | **0.40s** | ✨ **Grade-A** |

---

## 💎 Key Features

- **🚀 Mandala Engine**: Absolute Path Hardening for zero "Ghost Issues" on hosting.
- **📡 IndexNow**: Instant search engine notification on publish.
- **🛡️ Integrity Radar**: Self-healing core files and security layers.
- **🌙 Neutral Dark Mode**: Eye-comfort palette matching industry standards.
- **🖼️ WebP Auto-Conversion**: Native image optimization with automatic generation on upload.
- **🧹 Beast Cleaner**: Integrated orphaned media scanner and disk optimizer.
- **✍️ Editor Sanity**: Enter-Key Normalization, Sticky Formatting Fix, and Backspace Safety.
- **🔗 Smart Redirects**: Managed 301 redirects for SEO lifecycle.
- **📬 Contact Form Builder**: CF7-style template engine with CSRF, rate limiting, and honeypot protection.
- **🎯 Favicon Cache-Busting**: Automatic versioning to force browser and crawler refresh on favicon change.

---

## 📸 Visualizing the Experience

<div align="center">

|                **Clean, Modern Dashboard**                |              **Native Plugin System**               |
| :-------------------------------------------------------: | :-------------------------------------------------: |
| ![Dashboard](https://i.postimg.cc/htLJS6fw/Dashboard.png) | ![Plugin](https://i.postimg.cc/vmG4DhVt/Plugin.png) |

|                                **Flagship Experience: TechPress Theme**                                |
| :----------------------------------------------------------------------------------------------------: |
| ![Frontpage](https://i.postimg.cc/hPqzHKt6/screencapture-localhost-portalkini-2026-01-29-02-30-04.png) |

|            **Expanding Premium Ecosystem**             |
| :----------------------------------------------------: |
| ![Themes](https://i.postimg.cc/XvnrXLCg/Themessss.png) |

</div>

---

## ✨ Coming Soon: v1.21.x & Beyond

The Mandala foundation is locked. Here's what's on the horizon:

- **Glassmorphism UI Refresh**: Premium frosted-glass aesthetics across admin panels.
- **Advanced Search 2.0**: Zero-reload results with multi-taxonomy filtering.
- **Smart Keyword Engine**: AI-powered tag suggestions and SEO keyword analysis.
- **CDN Connector (Full SDK)**: Native R2/S3 integration for edge-delivered media.
- **VonLive Blog Engine**: Real-time news updates with live polling.
- **Static Forge**: Export your entire site to 100% static HTML for extreme edge delivery.
- **VonStore (Early Access)**: Centralized ecosystem for third-party themes and plugins.

---

## ⚙️ Requirements & Quick Start

- **PHP**: 8.1+ (Optimized for 8.2) | **DB**: MySQL 5.7+
- **Server**: Apache / Litespeed (Supports .htaccess)

1. **Download**: Grab the latest stable release from [GitHub Releases](https://github.com/Vondereich/VonCMS/releases).
   *(Note: The `v1.20.x` Mandala series is currently in private deployment and will be officially released on GitHub post-Aidilfitri 2026).*
2. **Upload**: Extract to your root or subfolder.
3. **Install**: Navigate to `yoursite.com/install`.
4. **Configure**: Set your SMTP, favicon (48x48px+), and site details.
5. **Publish**: Access `/admin` and start creating!

---

### 🤝 Business Proposals & Contact

If you have any business proposals or collaboration ideas, feel free to contact me at: **kurama87@gmail.com**

---

<div align="center">

_The Mandala foundation is locked._ 🌙✨

</div>
