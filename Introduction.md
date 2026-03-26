# Introduction to VonCMS v1.21.2

VonCMS is a hybrid CMS built for teams that want a modern frontend without leaving the PHP hosting world. The public site runs as a React app, while the backend stays in PHP and MySQL so it can live comfortably on shared hosting, cPanel, subdomains, and subfolders.

## What makes VonCMS different

- The frontend is loaded once, so navigation feels closer to an app than a page-by-page PHP site.
- The backend stays simple: PHP handles API requests, sessions, uploads, and database work.
- You do not need a separate Node deployment just to publish content.
- Core publishing features ship inside the system instead of depending on a long plugin chain.

## Good fit for

VonCMS works best for:

- news and magazine sites
- content portals and blogs
- company sites that need posts, pages, forms, SEO, and themes in one system
- teams that want React UX but still deploy on normal PHP hosting

It is less ideal if you specifically want a pure headless stack, a giant third-party plugin marketplace, or full ecommerce as the main product.

## Core features at a glance

- React 19 + Vite frontend
- PHP + PDO + MySQL backend
- admin dashboard for posts, pages, media, users, and settings
- built-in SEO, sitemap, robots.txt, and IndexNow support
- media upload tools with WebP workflow support
- comments, newsletter, widgets, and ads support
- OTA updater and Integrity Fix recovery tools
- support for root domains, subdomains, and subfolders

## How the stack works

1. The browser loads the frontend bundle.
2. The frontend fetches content and settings from PHP endpoints.
3. PHP talks to MySQL and returns JSON.
4. Themes render the public site on the client side.

This keeps hosting requirements low while still giving the public site a modern feel.

## Source package vs deploy package

VonCMS usually appears in two forms:

- Source package: the full project used for development.
- Deploy package: the production-ready package uploaded to hosting.

If you are building locally, use the source tree. If you are publishing to hosting, use the deploy ZIP from the release package.

## Pathing and hosting notes

VonCMS is designed to work in these common setups:

- `https://example.com`
- `https://news.example.com`
- `https://example.com/blog`

Fresh installs write their own `.htaccess` template. If your hosting folder already contains a host-generated `.htaccess`, back it up first. After the site is live, the Integrity Fix tool creates a `.bak` backup and repairs only the VonCMS-managed routing block.

## Start here

| I want to...                          | Read this                      |
| ------------------------------------- | ------------------------------ |
| Install on shared hosting             | [INSTALL.md](INSTALL.md)       |
| Install on a VPS                      | [VPS.md](VPS.md)               |
| Learn the admin flow                  | [MANUAL.md](MANUAL.md)         |
| Understand the API                    | [API.md](API.md)               |
| Upgrade safely                        | [UPGRADE.md](UPGRADE.md)       |
| Review security notes                 | [SECURITY.md](SECURITY.md)     |
| Compare VonCMS with other CMS options | [COMPARISON.md](COMPARISON.md) |

## Final note

VonCMS is at its best when you want a practical publishing stack: modern enough to feel fast, simple enough to host almost anywhere, and opinionated enough to stay maintainable.
