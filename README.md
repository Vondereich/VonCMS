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

This repository contains **documentation only**.

👉 Download the full system from:
https://github.com/Vondereich/VonCMS/releases

VonCMS is distributed as a **deployable ZIP package** designed for shared hosting environments (cPanel, Apache, LiteSpeed). No Node.js is required in production.

---

## What is VonCMS?

VonCMS is a hybrid CMS with:
- React frontend (SPA experience)
- PHP backend (API + server logic)
- MySQL database

It is built for publishers who want a modern editing and reading experience without turning deployment into a separate frontend/backend project.

---

## Key Idea

Most CMS solutions today fall into two extremes:

- Traditional CMS (easy to deploy, but plugin-heavy)
- Modern headless CMS (powerful, but complex setup)

VonCMS sits in the middle:

**Modern frontend, practical backend.**

---

## Why "Rentaka"?

> _"Rentaka" — Historically, a swivel gun used in traditional Malay naval warfare._

This release marks the transition from a simple blog engine into a CMS designed for high-performance publishing.

It focuses on:
- scalability
- admin performance
- large content handling (`100k+ posts`)

**Open Source Roadmap:**  
Targeting **v1.25.x** for MIT/GPL release.

---

## v1.23 Release Line Snapshot

- 73 HTTP API handlers
- 100k+ post-ready baseline
- Server-side pagination
- FULLTEXT search
- Lightweight release packages (<1MB class)

---

## Search Benchmark

Dataset: 30,035 posts (20,150 published)

- FULLTEXT: 133.98ms avg
- LIKE: 220.69ms avg
- ~1.6x faster

---

## What's New (v1.23.x)

- Unified release baseline across core, installer, and themes
- WordPress importer security hardening
- Database manager improvements (clearer error reporting)
- Media & installer security fixes
- Admin UI polish (editor feedback, visibility improvements)
- Server-side pagination for large datasets
- Improved `.htaccess` repair with backup handling

---

## Core Features

- React SPA navigation (no full reload)
- PHP backend (shared hosting friendly)
- Built-in SEO, analytics, newsletter, comments, media manager
- Roles, audit logs, draft workflow, scheduled posts
- 6 bundled themes with dark mode

---

## Quick Start

1. Download latest release ZIP  
2. Extract into web root  
3. Open `/install`  
4. Complete setup  
5. Access `/admin`  

---

## Requirements

- PHP 8.2+
- MySQL 5.7+
- Apache / LiteSpeed (.htaccess required)

Compatible with XAMPP, WAMP, Laragon.

---

## ⚠️ .htaccess

Updates do NOT overwrite `.htaccess`.

After each update:

1. Use **Fix .htaccess** in admin panel  
2. Or manually upload latest `.htaccess`  

---

## Documentation

- Features Guide  
- Installation Guide  
- User Manual  
- API Reference  
- Upgrade Guide  

---

## Summary

VonCMS is designed for developers and publishers who want:

- modern frontend experience  
- simple deployment  
- scalable content handling  

---

<div align="center">

**v1.23.7 "Rentaka" — Official Release**  
Built by Vondereich

</div>
