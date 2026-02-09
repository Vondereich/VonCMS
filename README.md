# VonCMS v1.11.6 "Nara Stable"

> **The Hybrid CMS for the Modern Web.**
> Performance of a Static Site, Flexibility of a Headless CMS, Ease of WordPress.

VonCMS "Nara" is a hybrid content management system designed to break the limitations of legacy platforms. Built for high-traffic portals, it combines a blazing-fast **React 19** frontend with a hardened **PHP 8.2** backend. Unlike traditional monoliths, VonCMS is decoupled yet perfectly synchronized, delivery enterprise-grade speed (LCP 0.40s) on standard shared hosting.

<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

**React 19 + Vite 7 Frontend | PHP 8.2+ API Engine | Native IndexNow | Self-Healing Integrity**

[![Official Website](https://img.shields.io/badge/Website-skripglobal.com-blue?style=for-the-badge)](https://skripglobal.com/)
[![GitHub stars](https://img.shields.io/github/stars/Vondereich/VonCMS?style=for-the-badge&color=yellow)](https://github.com/Vondereich/VonCMS/stargazers)
[![Stable Release](https://img.shields.io/badge/Status-Stable_v1.11.6-brightgreen.svg?style=for-the-badge)](https://github.com/Vondereich/VonCMS/releases)
[![Build Standard](https://img.shields.io/badge/Release-Nara_Stable-orange?style=for-the-badge)](#)
[![Downloads](https://img.shields.io/github/downloads/Vondereich/VonCMS/total?style=for-the-badge&color=blueviolet)](https://github.com/Vondereich/VonCMS/releases)

[🌐 Official Website](https://skripglobal.com/) • [📥 Download v1.11.6](https://github.com/Vondereich/VonCMS/releases) • [📖 Full Docs](https://github.com/Vondereich/VonCMS/blob/main/Introduction.md)

</div>

## 🛠️ The Technology Stack: Why & How?

VonCMS is a "best of both worlds" solution. Here is exactly what we use and why:

### ⚛️ Frontend: The "Beauty" (React 19 + Vite 7)

The entire user interface—from the public themes to the admin dashboard—is built with **React**.

- **Why?** It provides a "Single Page Application" (SPA) experience. No more page reloads when navigating.
- **Vite 7**: Used as the build tool to ensure the final assets are ultra-compressed and optimized for speed.

### 🐘 Backend: The "Brain" (PHP 8.2+)

We use PHP for our API engine because of its universal compatibility with **cPanel** and **Shared Hosting**.

- **Why?** It’s the king of accessibility. By keeping the backend in PHP, VonCMS remains easy to deploy on any standard server without needing complex Node.js or Docker setups.
- **Procedural + OOP**: A unique hybrid approach ensures the lowest possible memory footprint (~15MB).

### 🎨 Styling: The "Style" (TailwindCSS)

All styling is handled via **TailwindCSS**, a utility-first CSS framework.

- **Why?** It allows us to build beautiful, responsive, and dark-mode-ready layouts without the bloat of traditional CSS files.

### 💾 Database: The "Memory" (MySQL/MariaDB)

Standard SQL database optimized with advanced indexing.

- **Why?** Reliable, fast, and easy to backup. Optimized specifically for the **Nara** schema to handle millions of rows without slowing down.

---

## 🏛️ The VonCMS Philosophy

After 5 months of dedicated development, VonCMS is built on three unbreakable pillars:

1. **Security First**: Protection isn't a plugin; it's the foundation. From the "Fortress-Grade" API hardening to the self-healing integrity radar, your data is guarded at every layer.
2. **Easiness Second**: Technology should work for you, not against you. A 2-minute setup, intuitive interfaces, and zero-config essentials mean you spend time publishing, not configuring.
3. **Flexibility Third**: A hybrid architecture (React + PHP) that runs anywhere. Whether it's a simple blog or a high-traffic news portal, the system adapts to your scale without breaking.

---

## 🚀 The "Nara" Engine (v1.11.x)

> **[na.ra] | نارا**  
> _Derived from the ancient term for **Warrior**; signifying strength, guard, and absolute reliability._

**VonCMS Nara** represents a fundamental shift in how lightweight CMS platforms handle reliability and speed. Unlike legacy systems that rely on complex directory mapping, Nara uses **Absolute Path Hardening** to eliminate "Ghost Issues" common on cPanel and Shared Hosting.

### ⚡ Performance Benchmark

VonCMS is optimized for **Core Web Vitals**. By decoupling the React frontend from the silent PHP backend, we achieve near-instantaneous load times.

<div align="center">

| Metric                       | WordPress (6.x) | **VonCMS (Nara)** | Improvement       |
| :--------------------------- | :-------------: | :---------------: | :---------------- |
| **Requests Per Sec (RPS)**   |      10.81      |    **606.70**     | ⚡ **56x Faster** |
| **Peak Throughput**          |      11.40      |    **853.90**     | 🚀 **74x Faster** |
| **Avg. Server Latency**      |     5,667ms     |     **125ms**     | 🛡️ **Ultra-Low**  |
| **Largest Contentful Paint** |      ~2.5s      |     **0.40s**     | ✨ **Grade-A**    |

> [!IMPORTANT]
> **Hosting Compatible**: These metrics were achieved on **Shared Hosting environments** (Litespeed/Apache), proving you don't need a $100/mo VPS to get enterprise performance.

</div>

---

## 💎 Power Features

### 📡 Native IndexNow Integration

VonCMS includes a pro-grade **IndexNow** implementation. Every time you publish or update a post, the engine instantly pings Bing, Yandex, and other search engines.

- **Benefit**: Your content is indexed in seconds, not days. Essential for news portals and trending content.

### 🛡️ Integrity Radar & Hammer Fix

The "Nara" build monitors its own health. It detects missing `.htaccess` security layers or damaged core files.

- **Self-Healing**: A one-click "Integrity Repair" tool restores the system to its absolute safe state, hardening the `/uploads/` directory and re-locking core configs.

### 🖼️ Media Optimization (Native WebP)

Save up to 80% on storage and bandwidth with built-in image processing.

- **WebP Conversion**: Automatically converts heavy JPGs/PNGs to WebP format.
- **Smart Sizing**: Enforces Max-Width (e.g., 1920px) to prevent multi-megabyte uploads from slowing down your site.

### 🔗 Smart Slug & Redirect Engine

Manage your SEO lifecycle effortlessly. If you change a post slug, VonCMS automatically creates a 301 redirect to ensure you never lose SEO link juice.

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

## ⚙️ Technical Requirements

- **PHP**: 8.1 or 8.2+ (Optimized for 8.2)
- **Database**: MySQL 5.7+ / MariaDB 10.3+
- **Server**: Apache / Litespeed (Supports .htaccess)
- **Memory**: Extremely low footprint (~15MB peak)

---

## 🏗️ Project Blueprint

The **Nara** architecture is designed for extreme portability.

```text
├── dist/               # Production-ready build
├── public/             # API Core & Public Assets
│   ├── api/            # Hardened PHP Endpoints
│   ├── uploads/        # Optimized Media Storage
│   └── security.php    # Firewall & Security Middleware
├── src/                # React (Vite) Source Code
├── database/           # Schema & Initial Data
└── create_release.cjs  # Official Release Engine
```

---

## 🛠️ Quick Start Guide

1. **Download**: Grab the `VonCMS_v1.11.6_Deploy.zip` from the releases page.
2. **Upload**: Extract contents to your root directory or a subfolder.
3. **Install**: Navigate to `yoursite.com/install.php` and follow the 2-minute wizard.
4. **Login**: Access the dashboard at `yoursite.com/admin` to start creating.

---

<div align="center">

### 🌟 Project Status

**Current Release**: v1.11.6 (Absolute Hardening)  
**Main Showcase**: [skripglobal.com](https://skripglobal.com/)

_Built for speed. Hardened for security. Designed for you._

</div>
