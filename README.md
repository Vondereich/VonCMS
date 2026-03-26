# VonCMS v1.21.3 "Breeze"

<div align="center">

![VonCMS Banner](https://i.postimg.cc/TPM1PbXV/Generated-image-1.png)

[![Version](https://img.shields.io/badge/Version-1.21.3-brightgreen?style=for-the-badge&logo=github)](https://github.com/Vondereich/VonCMS)
[![PHP](https://img.shields.io/badge/PHP-8.2--8.5-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](docs/LICENSE.md)

[Official Website](https://skripglobal.com/) | [Download](https://github.com/Vondereich/VonCMS/releases) | [Installation](docs/INSTALL.md) | [Manual](docs/MANUAL.md) | [API](docs/API.md) | [Upgrade Guide](docs/UPGRADE.md)

</div>

VonCMS is a hybrid CMS built with React on the frontend and PHP/MySQL on the backend. It is designed for teams that want a modern publishing experience without moving to a Node-only hosting stack.

> **Surprise:** Open Source is coming much sooner than we planned! Stay tuned for the official transition. 🚀

## Why VonCMS

- Runs on standard PHP hosting, including cPanel and shared hosting.
- Uses a SPA frontend for fast navigation after the first load.
- Includes SEO, analytics, newsletter, discussion, media, and theme tools in the core system.
- Supports root domains, subdomains, and subfolders without manual path rewrites.
- Ships with OTA update tooling plus a split Integrity Check / `Repair .htaccess` recovery workflow.

## What's New in v1.21.3

- Integrity Check is now read-only, while `Repair .htaccess` refreshes the managed block and keeps a rolling `.htaccess.bak` snapshot.
- The installer preserves existing `.htaccess` content and refreshes only the VonCMS-managed block when possible.
- AI Write and AI Check now handle missing `curl`, malformed upstream JSON, and non-JSON server responses more gracefully.
- TechPress member profile pages now use a full-height layout so the footer stays pinned correctly.
- The release script now ships `Deploy.zip` and `Source.zip` only.

## Core Features

- React 19 + Vite frontend
- PHP + PDO backend
- Built-in admin dashboard
- Built-in SEO, `llms.txt`, and sitemap support
- Media upload pipeline with WebP support
- Comments, newsletter, widgets, and ads support
- OTA update flow and integrity repair tools
- Security layers including CSRF, session checks, rate limiting, and data masking

## Included Themes

- Default
- TechPress
- Prism
- Digest
- Portfolio
- Corporate Pro

## Requirements

- PHP 8.2+
- MySQL 5.7+
- Apache/LiteSpeed rewrite support or equivalent server routing
- Around 50MB storage for a basic install

## Quick Start

1. Extract the `Deploy.zip` package to your web root.
2. Open `yoursite.com/install` in your browser.
3. Complete the installer and sign in to `/admin`.

## Local Testing

- Recommended local stacks: `XAMPP` or `WAMP`.
- `XAMPP` is the easiest baseline for quick VonCMS install and feature checks, especially on PHP `8.2`.
- `WAMP` is a reasonable choice if you want easier local PHP version switching for future `8.4+` tests.
- `Laragon` is currently best-effort only for VonCMS. It can work, but local setup tends to be more fragile around vhosts, SSL, `index.php` vs `index.html`, and installer/database bootstrap behavior.
- For serious PHP `8.4+` compatibility validation, a staging subdomain on the target hosting is more representative than a Laragon-only localhost test.

> Shared hosting note: if the destination folder already has a host-generated or custom `.htaccess`, back it up first. The installer and `Repair .htaccess` now preserve existing content and refresh only the VonCMS-managed block, but manual ZIP extraction can still overwrite `.htaccess` depending on your hosting file manager or unzip tool.

## Release Packages

- Use `Deploy.zip` for fresh installs.
- Use `Deploy.zip` cautiously for manual live updates. If your site has host-generated `.htaccess` rules, cPanel PHP handlers, custom redirects, or hardcoded rewrites, back up `.htaccess` first and verify it after extraction.
- `Source.zip` is provided for development, audits, and source-level inspection.

## Documentation

- [Installation Guide](docs/INSTALL.md)
- [User Manual](docs/MANUAL.md)
- [API Reference](docs/API.md)
- [Upgrade Guide](docs/UPGRADE.md)
- [Security Notes](docs/SECURITY.md)
- [Comparison Guide](docs/COMPARISON.md)
- [Introduction](docs/INTRODUCTION.md)
- [VPS Guide](docs/VPS.md)

## Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: PHP, PDO, MySQL
- Infrastructure: Apache/LiteSpeed, OTA ZIP updates, shared-hosting friendly deployment

## Contact

For business inquiries, enterprise support, or collaboration:

`kurama87@gmail.com`

<div align="center">
Built by Vondereich.
</div>
