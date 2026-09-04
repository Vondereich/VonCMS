![VonCMS Banner](https://github.com/user-attachments/assets/9b7ab0cb-c588-40a6-a504-e2d6fff037dc)

# VonCMS

VonCMS is a lightweight PHP and React CMS for shared hosting. It is built for publishers who want a modern admin dashboard, clean public themes, SEO-friendly output, and extensibility without running a heavy plugin stack.

Current build: **v1.27.0 "OverDrive"**, available for pre-release testing. v1.26.11 remains the latest published GitHub release. You can install a published Deploy ZIP on hosting, or fork the source repository to build your own themes, plugins, extensions, fixes, and release packages.

[Website](https://getvoncms.com/) | [Live Demo](https://skripglobal.com/) | [Releases](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

## Project Status

VonCMS is open-source software under active development. Review, test, and back up your site before using any CMS release in production.

> [!NOTE]
> v1.27.0 has not yet been published on GitHub. Test pre-release ZIPs on a local or staging installation first. Before updating a production site, back up its files and database, review the changelog, and verify the homepage, one post, one page, and the admin dashboard after updating.
>
> **v1.27 "OverDrive"** is now the active development line. Its update cadence is intentionally slower as larger changes move through clearer scope, isolated development, deeper verification, and longer canary testing.

> [!IMPORTANT]
> **Existing-site database repair required for v1.26.11**
> After upgrading an existing VonCMS site through either Dashboard OTA or a manual Deploy ZIP, back up the database, sign in as the primary administrator, and run **Settings > Tools > Repair Database** once. This explicit repair reconciles the v1.26.10 schema baseline, adds and backfills the v1.26.11 `published_at` columns, and activates the protected schema capability marker. Fresh installations already create the current schema and do not need this upgrade repair. Database Repair is separate from **System Tools > Repair `.htaccess`**; the OTA updater protects the live `.htaccess`, so later routing updates can also require the separate managed-block repair described below.

### What Changes In v1.27.0

- Writer draft submission and a staff review queue, with server-enforced role and account boundaries.
- Shared AI writing with a visible model identity, bounded provider requests, and HTML-preserving copy review.
- Clearer editor controls, enforced excerpt and keyword limits, and TechPress card readability improvements.
- Crawlable Load More links, paginated no-JavaScript reading, and guarded public rendering helpers.
- Consent-aware native and Google Analytics, while aggregate post/page view counters remain separate from visitor tracking.
- Refreshed dependencies, including TipTap `3.31.3` and `lucide-react` `1.41.0`.

See [CHANGELOG.md](CHANGELOG.md) for the complete changes and their scope.

> [!IMPORTANT]
> **Existing-site routing repair for v1.27.0**
> After installing this build over an older site, sign in as the primary administrator and run **System Tools > Repair `.htaccess`** when integrity checks report outdated rules. The update preserves your live `.htaccess`; this repair installs the current managed PHP-path and internal-helper protections while retaining hosting directives outside the VonCMS block. This is separate from Database Repair, and v1.27.0 adds no database migration. Nginx deployments must apply the equivalent server rules in [VPS Deployment](docs/VPS.md).

> [!WARNING]
>
> ## Manual Update Required For Affected Builds
>
> Sites currently running `v1.25.11`, `v1.25.12`, `v1.25.13`, `v1.26.0`, or the pre-fix `v1.26.1` package must install the latest published Deploy ZIP manually once. Those affected builds can skip GitHub release discovery when the primary administrator ID is returned as a number, so the dashboard may show no update even though a newer package exists.
>
> Follow [Updating Existing Sites](#updating-existing-sites) and keep `von_config.php`, `data/`, `uploads/`, `backups/`, and the live `.htaccess` file protected. After the refreshed build is installed, primary-owner OTA discovery works normally for later releases.

> [!IMPORTANT]
> **Optional `von_config.php` feature migration for v1.26.9**
> A normal Deploy or OTA update does not require replacing the working `von_config.php`; existing sites can keep it and continue using VonCMS normally. Migrate from the matching `von_config.sample.php` only if the site should adopt the complete current configuration features, including fail-closed environment handling and the private PHP log location. Use the sample only as a template for a new private config: copy the four complete database assignment lines from the working config, preserve required definitions such as `CRON_KEY`, run `php -l`, and activate the validated file during a short maintenance window. Never add real credentials to the tracked sample or leave a credentialed backup inside the public website directory.
>
> Follow the complete backup, migration, verification, and rollback-safe procedure in [Optional `von_config.php` feature migration for v1.26.9](docs/UPGRADE.md#optional-von_configphp-feature-migration-for-v1269).

> [!IMPORTANT]
> **Updating an existing site to v1.25.0 through OTA?**
> After the OTA update finishes, sign in as the primary admin and run **System Tools > Repair `.htaccess`** once.
> The OTA updater intentionally protects your live `.htaccess`, so this step is needed to apply the v1.25.0 managed routing and sensitive-file protection changes while preserving hosting rules outside the VonCMS block.

<img width="1920" height="957" alt="126" src="https://github.com/user-attachments/assets/c0fdec1a-827f-457b-9feb-d84ce0d62c0c" />

## Why VonCMS?

Traditional CMS platforms are easy to host but often become slow, plugin-heavy, and hard to maintain. Modern headless stacks are powerful but usually add paid hosting assumptions, build pipelines, and too many moving parts for ordinary publishing sites.

VonCMS keeps the runtime simple:

- PHP and MySQL for shared-hosting deployment.
- React 19 for the admin dashboard, editor, media tools, settings, comments, and extensions.
- Server-rendered public metadata for SEO, social cards, sitemaps, feeds, and crawlers.
- Built-in publishing tools so common site features do not require a pile of third-party plugins.
- Source-level customization for developers, designers, agencies, and AI-assisted coding workflows.

## What Is Included

**Content**: posts, pages, drafts, Writer review submissions, scheduled publishing, rich TipTap editor, media manager, categories, excerpts, metadata, keywords, responsive images, and quick edit.

**Admin**: dashboard, reviewer queue, settings, users, fixed-role boundaries, comments moderation, contact forms, newsletter tools, database utilities, audit logs, and repair tools.

**Public site**: bundled themes, navigation menus, profiles, category views, search, comments, feeds, sitemap, robots output, `llms.txt`, JSON-LD, canonical URLs, Open Graph, and Twitter cards.

**Extensions**: built-in SEO, analytics, gift widget, related posts, promo bar, and AI summary plugins with activation controls.

**Developer surface**: theme registry, plugin registration, PHP APIs, smoke tests, release packaging, source documentation, and GPL-3.0-only licensing.

## Requirements

| Layer              | Requirement                          |
| ------------------ | ------------------------------------ |
| PHP                | 8.2 or newer                         |
| Database           | MySQL 5.7 or newer                   |
| Web server         | Apache or LiteSpeed with `.htaccess` |
| Local PHP checks   | Laragon, XAMPP, WAMP, or PHP on PATH |
| Source development | Node.js 22.22 or newer and npm       |

Production hosting does not need Node.js, Vite, npm, or a separate frontend server. Source development does.

For source work, install Node.js 22.22 or newer from <https://nodejs.org/>. The installer includes `npm`. After installing, open a terminal and confirm:

```bash
node --version
npm --version
```

On Windows, Laragon is the easiest PHP/MySQL stack for local checks. XAMPP, WAMP, native PHP, Docker, or a remote dev server also work as long as PHP and MySQL meet the requirements.

## Choose Your Path

| Goal                                         | Start here                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Install VonCMS on shared hosting             | Download the current published Deploy ZIP from [Releases](https://github.com/Vondereich/VonCMS/releases) |
| Study the code or build custom features      | Fork or clone the repository                                                                             |
| Build a custom theme, plugin, or extension   | Read [Extension Development](docs/EXTENSION_DEVELOPMENT.md)                                              |
| Work on APIs, installer, routing, or updater | Read [API](docs/API.md), [Security](docs/SECURITY.md), and [Routing](docs/ROUTING.md)                    |
| Upgrade an existing website                  | Read [Upgrade](docs/UPGRADE.md)                                                                          |

## Install A Website From Deploy ZIP

Use this path for normal site owners and shared-hosting installs.

1. Download the current published Deploy ZIP from [Releases](https://github.com/Vondereich/VonCMS/releases).
2. Extract it into your hosting web root.
3. Create a MySQL database and database user.
4. Open `https://yourdomain.com/install`.
5. Complete the installer wizard.
6. Sign in at `/admin`.
7. Publish or import content, choose a theme, and configure settings.

See [Installation](docs/INSTALL.md), [Upgrade](docs/UPGRADE.md), and [VPS Deployment](docs/VPS.md) for hosting notes.

## Use The Open-Source Repository

Use this path for developers, designers, agencies, advanced users, and AI-assisted workflows.

Fork the repository on GitHub, clone it, and install dependencies:

```bash
git clone https://github.com/YOUR-USERNAME/VonCMS.git
cd VonCMS
npm install
```

You can also download the Source ZIP from Releases and extract it locally. A Git fork is better when you plan to contribute changes back. Open the project folder directly in any editor you prefer:

- Cursor
- Visual Studio Code
- Antigravity-style AI IDEs
- PhpStorm or another PHP IDE
- Claude CLI, Codex CLI, or another terminal-based coding agent
- Plain terminal plus your editor of choice

The workflow is flexible. VonCMS does not require one official IDE. Keep the terminal at the repository root so commands resolve `package.json`, `vite.config.ts`, `public/`, `src/`, and `docs/` correctly.

Common source checks:

```bash
npm run typecheck
npm run build
```

For PHP linting with Laragon on Windows, set `PHP_BIN` to your local `php.exe` first:

```powershell
$env:PHP_BIN='C:\laragon\bin\php\php-8.4.22-Win32-vs17-x64\php.exe'
npm run lint:php
```

The Vite dev server is useful while editing React themes, admin screens, plugins, and components:

```bash
npm run dev
```

If you need PHP APIs, point the dev proxy at your local PHP host with `VITE_PROXY_TARGET`, or test the production build through Apache/LiteSpeed after:

```bash
npm run build
```

For contributor expectations, formatting, audits, release gates, and pull request rules, read [CONTRIBUTING.md](CONTRIBUTING.md).

## How It Works

VonCMS is built as a compiled React application plus a PHP API/runtime.

```text
Browser
  -> public/index.php
  -> built React assets
  -> public/api/*.php
  -> MySQL
```

The public entry point handles routing, crawler metadata, installation checks, maintenance mode, canonical URLs, redirects, and hydration data. The React app owns the interactive dashboard and public theme rendering after boot. PHP APIs handle authentication, settings, posts, pages, media, comments, newsletters, analytics, imports, backups, and repair tools.

## Repository Structure

```text
src/
  App.tsx                              Public/admin routing shell
  hooks/                               Shared React data hooks
  components/                          Editor, layout, renderer, UI components
  plugins/von-core/features/           Core admin features and built-in plugins
  themes/                              Bundled public themes

public/
  index.php                            PHP public entry and hydration bridge
  api/                                 PHP API endpoints
  install.sql                          Fresh install schema/settings seed
  .htaccess                            Public routing and hardening rules
  fonts/                               Local web fonts used by bundled themes

docs/                                  Developer and operator documentation
server/test-integration.cjs            Integration smoke gate
create_release.cjs                     Deploy and Source ZIP packaging
remove-bom.cjs                         UTF-8 BOM cleanup utility
```

## Bundled Themes

VonCMS ships with Default, TechPress, Digest, Portfolio, Prism, and Corporate Pro themes. Theme registration lives in `src/plugins/von-core/features/themes/themeRegistry.ts`, while theme implementations live in `src/themes/`.

Fresh installs use `Inter, sans-serif` by default. VonCMS does not load Google Fonts at runtime; Inter is shipped locally as variable WOFF2 files under `public/fonts/inter/` and wired through the bundled CSS. The bundled Inter files include a font license notice at `public/fonts/inter/LICENSE.txt`. If a custom theme needs another branded font, add the licensed font files to that theme and reference them from the theme CSS. For a practical font workflow, read [Custom Fonts](docs/CUSTOM_FONTS.md).

## Theme Development

Start with [Extension Development](docs/EXTENSION_DEVELOPMENT.md). Themes are for presentation and public UX. A compiling layout is not automatically VonCMS-compatible: it must satisfy the documented route/state, shared data, settings, base-path link, SEO/SSR, media, accessibility, performance, and verification contracts. Themes should use shared props and hooks, render post and page content through the shared renderer, and avoid duplicating runtime ownership that the core already provides.

Common files:

- `src/themes/<theme>/Layout.tsx`
- `src/themes/types.ts`
- `src/plugins/von-core/features/themes/themeRegistry.ts`
- `src/plugins/von-core/features/extensions/components/DefaultThemeSettings.tsx`

## Plugin And Extension Development

Start with [Extension Development](docs/EXTENSION_DEVELOPMENT.md). Plugins and extensions are for optional behavior: SEO helpers, analytics, widgets, article blocks, campaign bars, integrations, and admin tools. Built-in plugin code lives under `src/plugins/von-core/features/plugins/built-in/`. Follow the documented system, Custom HTML/CSS, or backend-integrated plugin boundary; keep settings ownership explicit, sanitize public HTML, use the shared activation decision, clean up runtime work, and verify inactive, active, route-change, and subfolder behavior.

Useful docs:

- [API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Routing](docs/ROUTING.md)
- [Upgrade](docs/UPGRADE.md)

## Installer, Routing, And Updates

The installer uses `public/install.sql` and the PHP installer endpoints under `public/api/`. The public runtime uses `public/index.php` and `.htaccess` for install checks, maintenance mode, crawler metadata, canonical URL handling, and SPA hydration.

If you work on install, routing, updater, or `.htaccess` behavior, read:

- [Installation](docs/INSTALL.md)
- [Routing](docs/ROUTING.md)
- [Upgrade](docs/UPGRADE.md)
- [Security](docs/SECURITY.md)

## Dependency Upgrades

Use `npm outdated` as a review list, not as an automatic upgrade command. Upgrade packages in small batches and rerun the relevant verification after each batch. For the full command set and pull request standard, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Release Checks

Before creating release ZIPs:

```bash
npm run typecheck
npx prettier --check .
node remove-bom.cjs
npm run build
npm run test:integration
npm run lint:php
node create_release.cjs
```

`create_release.cjs` creates:

- `VonCMS_v1.27.0_Deploy.zip`
- `VonCMS_v1.27.0_Source.zip`

No checksum sidecar files are generated by the release script.

Run this full sequence for release preparation, not for ordinary first-time source reading.

## Documentation Map

- [Installation](docs/INSTALL.md)
- [Features](docs/FEATURES.md)
- [Upgrade](docs/UPGRADE.md)
- [VPS Deployment](docs/VPS.md)
- [API](docs/API.md)
- [Routing](docs/ROUTING.md)
- [Security](docs/SECURITY.md)
- [Extension Development](docs/EXTENSION_DEVELOPMENT.md)
- [Custom Fonts](docs/CUSTOM_FONTS.md)
- [Release Notes](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Before changing code, inspect the existing implementation and read the focused docs for the area you are touching. Keep changes scoped, preserve backwards compatibility unless the issue requires otherwise, and run the relevant checks before opening a pull request.

For public contribution rules, issue guidance, pull request expectations, and security reporting notes, read [CONTRIBUTING.md](CONTRIBUTING.md).

If you find a serious security issue, do not open a public issue with exploit details. Contact the maintainer privately first so the issue can be verified and patched responsibly.

## Updating Existing Sites

> [!IMPORTANT]
> **v1.25.0 changes the VonCMS-managed `.htaccess` block.**
> If you update from `v1.24.x` to `v1.25.0` through OTA, the old update modal cannot show this new warning yet.
> After the update, open **System Tools** and run **Repair `.htaccess`** once.

For sites older than the fixed updater baseline, use the manual Deploy ZIP replacement first:

1. Back up files and database.
2. Delete the old `assets/` and `docs/` folders. Both contain release-managed files; neither stores uploads, posts, settings, or database content.
3. Upload and extract the complete new Deploy ZIP, allowing its application files to replace the old release.
4. Keep `von_config.php`, `data/`, `uploads/`, `backups/`, and the live `.htaccess` file protected from manual replacement or deletion.
5. Visit the site and admin dashboard, then confirm the Dashboard shows the expected release version.
6. If the site has not completed the v1.26.11 schema upgrade, sign in as the primary administrator and run **Settings > Tools > Repair Database** once. Review the completed fixes and any compatibility warning, then confirm Database Status is healthy. Fresh installations and already-healthy upgrades skip this step.
7. For v1.27.0, run **System Tools > Repair `.htaccess`** if integrity checks flag outdated managed rules. On Nginx, apply the equivalent configuration from [VPS Deployment](docs/VPS.md).
8. Verify one homepage, one post, one page, and `/admin` before ending maintenance.

After a site is already on the fixed updater baseline, the dashboard updater can be used for later patches when the host allows outbound release downloads. OTA activation replaces the release-managed `assets/` and `docs/` directories as complete rollback-protected units, so retired fingerprinted bundles and guides cannot remain beside the current release.

## Release History

Current shipped release truth lives in [CHANGELOG.md](CHANGELOG.md). Public developer guidance lives in [CONTRIBUTING.md](CONTRIBUTING.md) and the focused files under [docs/](docs/).

### v1.26.11 - Canonical First Publication Time

- Posts and pages gain a stable first-publication timestamp shared by public APIs, SSR, visible dates, schema, RSS, Related Posts, and sidebar freshness.
- Existing published content receives an idempotent backfill through the explicit primary-admin Database Repair flow, while unrepaired sites retain a compatible fallback.
- Compatible final dependencies are refreshed for the current development baseline.

### v1.26.10 - Schema Repair Development Baseline

- Runtime schema creation moves out of ordinary traffic and into fresh installation or explicit primary-admin Database Repair.
- Repair becomes resumable and data-preserving across owned columns, indexes, foreign keys, optional feature tables, and compatibility stops.
- Gallery metadata, RSS interoperability, public link semantics, admin mutation acknowledgement, plugin delegation, maintenance handling, Nginx guidance, and embedded-video fullscreen persistence are aligned.

### v1.26.9 - Runtime Boundary And Extension Specification

- Structured request inputs fail safely before PHP string handling, authentication throttles reserve attempts atomically, and public query offsets stay bounded.
- Upload shields, media variant paths, generated runtime configuration, private logging, credentialed CORS, and WordPress import transport boundaries are aligned and hardened.
- Existing installations receive a one-time safe `von_config.php` migration procedure without allowing Deploy or OTA updates to overwrite live credentials.
- Theme and plugin development now has an explicit VonCMS compatibility specification covering route/state ownership, settings, SSR/SEO, links, media, accessibility, performance, backend APIs, lifecycle, and release proof.

### v1.26.8 - Public Discovery And Production Maintenance

- Public search URLs persist across direct loads and reloads, all bundled themes expose crawlable navigation, and the bounded no-JavaScript reading view is usable without taking over theme rendering.
- Media library search, responsive social metadata, related-post ranking, AI summaries, AI writing guidance, effective publish time, page pagination, and production warning paths are aligned.
- Compatible direct dependencies and the matching lockfile graph are current for the release.

### v1.26.7 - Categories And Theme UX

- Default, Digest, and TechPress gain a public-safe Categories sidebar widget with crawlable links, bounded display, and empty-sidebar protection.
- Category navigation resets the document scroll position, while TechPress and Digest preserve configured public colors across route families and failed settings fallback.
- TechPress search receives a contrast-aware accent control, and the dashboard gains a compact clock using the configured CMS timezone.
- OpenRouter SDK and the complete direct TipTap dependency set move to their latest compatible versions.
- See the top [CHANGELOG.md](CHANGELOG.md) entry for the complete release detail.

### v1.26.6 - Editor Legibility And Public Publish Time

- The desktop Body/H1-H6 selector keeps the complete active label visible.
- General Settings provides Logo + Text, Logo Only, and Text Only across all bundled themes without deleting a hidden uploaded logo.
- Homepage cards and single-post views use one consistent read-time estimate without adding full article bodies to list payloads.
- Single-post views show a fixed AM/PM publish time using the scheduled timestamp first, with stable CMS-local MySQL `DATETIME` handling and narrow-screen wrapping.
- `lucide-react` and its lockfile graph are current at `1.31.0`.

### v1.26.5 - Admin Editor Context And Publish Readiness

- New and existing post/page editor routes use accurate browser titles and retain their owning admin navigation state.
- Publish readiness now covers slug, excerpt or meta description, featured image, category, and scheduling alongside title and content.
- Readiness remains advisory except for the established title and content publish requirements and the required date and time for Schedule; the editor now keeps its saved state aligned with the canonical status returned by the server.

### v1.26.4 - Security Dashboard And Quick Editor Safety

- Security trends render every recorded event type and show an honest no-events state instead of a blank chart.
- Distribution values are normalized for Recharts and unknown security events receive stable fallback colors.
- Quick Editor uses the shared accessible modal and confirms before unsaved work is discarded.
- Compatible direct dependencies and the matching lockfile graph are current.

### v1.26.3 - SEO Canonical And Routing Maintenance

- Case-variant category discovery URLs redirect permanently to the stored category spelling.
- Crawler endpoints resolve only at the exact root or configured subfolder root, not arbitrary nested suffixes.
- Login, admin, install, and search routes emit explicit non-indexing directives before and after hydration.
- Empty manual descriptions fall through to excerpt/content, and hydrated pages honor manual metadata.
- Internal duplicate slashes collapse through the canonical redirect and shared SEO route logic lives outside the complete HTML shell.

### v1.26.2 - Mobile Publishing And Admin Responsiveness

- Responsive admin navigation that uses a phone/tablet drawer without changing the desktop sidebar.
- A write, publish, and AI editor workflow with swipeable formatting controls plus safe-area Draft and Publish/Schedule/Update actions.
- Mobile action-complete views for core content, user, newsletter, security, contact, media, settings, extension, and maintenance screens.
- One accessible blurred admin popup layer for editor, lightbox, extension, user, redirect, and update dialogs.
- Existing role, ownership, save, scheduling, OTA, media, and read-only database boundaries preserved.

### v1.26.1 - Discovery And Schema Maintenance

- Word-safe homepage and noscript excerpts that preserve complete words, Unicode, and encoded entities.
- SSR and hydrated article schema parity for `mainEntityOfPage`, `articleSection`, and validated dynamic language values.
- Category-specific raw HTML and `CollectionPage` output before React hydration.
- Fingerprinted asset caching, portable security-header defaults, and rollback-protected OTA documentation replacement.
- Compatible OpenRouter, TipTap, Node type, rate-limit, and PostCSS patch updates.

### v1.26.0 - After Hours

- Official opening of the v1.26 "After Hours" series.
- Tailwind CSS 4 with its dedicated PostCSS adapter and CSS-first configuration.
- TypeScript 7 native compilation with a TypeScript 6 API compatibility alias for current tooling.
- React Router 8, OpenRouter SDK 1, TipTap 3, and the Node.js 22.22+ source-development baseline.
- Focused Post Editor modules for audit history, SEO presentation, featured media, and shared text handling.
- Selectable `Article`, `NewsArticle`, and `BlogPosting` schema types with a safe `Article` fallback.
- Canonical Tailwind 4 utility migration across the admin, editor, plugins, and all six bundled themes.
- Public page navigation, Default theme card/feed stability, Dashboard clarity, and Content Manager narrow-width polish.
- Bundled themes and built-in plugins aligned to the `1.26` Extensions Manager series label.

The completed v1.25.x OpenGate line remains the runtime foundation, including post ownership hardening, staff protected-content read boundaries, public discovery cleanup, public cache controls, media safety, and release packaging.

## License

VonCMS is released under the GPL-3.0-only license. See [LICENSE.md](LICENSE.md).
