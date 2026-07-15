![VonCMS Banner](https://i.ibb.co/VY0Hk2GQ/bannernew.png)

# VonCMS

VonCMS is a lightweight PHP and React CMS for shared hosting. It is built for publishers who want a modern admin dashboard, clean public themes, SEO-friendly output, and extensibility without running a heavy plugin stack.

VonCMS v1.25.8 "OpenGate" is the current open-source release line. You can install the Deploy ZIP on hosting, or fork the source repository to build your own themes, plugins, extensions, fixes, and release packages.

[Website](https://getvoncms.com/) | [Live Demo](https://skripglobal.com/) | [Releases](https://github.com/Vondereich/VonCMS/releases) | [Sponsor](https://github.com/sponsors/Vondereich)

## Project Status

VonCMS is open-source software under active development. Review, test, and back up your site before using any CMS release in production.

The v1.25.x line is focused on open-source onboarding, shared-hosting deployment, stable public routing, source packaging, and developer documentation. Runtime sites should install from the Deploy ZIP. Developers who want to study or modify the code should use the source repository or Source ZIP.

> [!IMPORTANT]
> **Updating an existing site to v1.25.0 through OTA?**
> After the OTA update finishes, sign in as the primary admin and run **System Tools > Repair `.htaccess`** once.
> The OTA updater intentionally protects your live `.htaccess`, so this step is needed to apply the v1.25.0 managed routing and sensitive-file protection changes while preserving hosting rules outside the VonCMS block.

## Why VonCMS?

Traditional CMS platforms are easy to host but often become slow, plugin-heavy, and hard to maintain. Modern headless stacks are powerful but usually add paid hosting assumptions, build pipelines, and too many moving parts for ordinary publishing sites.

VonCMS keeps the runtime simple:

- PHP and MySQL for shared-hosting deployment.
- React 19 for the admin dashboard, editor, media tools, settings, comments, and extensions.
- Server-rendered public metadata for SEO, social cards, sitemaps, feeds, and crawlers.
- Built-in publishing tools so common site features do not require a pile of third-party plugins.
- Source-level customization for developers, designers, agencies, and AI-assisted coding workflows.

## What Is Included

**Content**: posts, pages, drafts, scheduled publishing, rich TipTap editor, media manager, categories, excerpts, metadata, keywords, responsive images, and quick edit.

**Admin**: dashboard, settings, users, role boundaries, comments moderation, contact forms, newsletter tools, database utilities, audit logs, and repair tools.

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
| Source development | Node.js LTS and npm                  |

Production hosting does not need Node.js, Vite, npm, or a separate frontend server. Source development does.

For source work, install Node.js LTS from <https://nodejs.org/>. The installer includes `npm`. After installing, open a terminal and confirm:

```bash
node --version
npm --version
```

On Windows, Laragon is the easiest PHP/MySQL stack for local checks. XAMPP, WAMP, native PHP, Docker, or a remote dev server also work as long as PHP and MySQL meet the requirements.

## Choose Your Path

| Goal                                         | Start here                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Install VonCMS on shared hosting             | Download `VonCMS_v1.25.8_Deploy.zip` from [Releases](https://github.com/Vondereich/VonCMS/releases) |
| Study the code or build custom features      | Fork or clone the repository                                                                        |
| Build a custom theme, plugin, or extension   | Read [Extension Development](docs/EXTENSION_DEVELOPMENT.md)                                         |
| Work on APIs, installer, routing, or updater | Read [API](docs/API.md), [Security](docs/SECURITY.md), and [Routing](docs/ROUTING.md)               |
| Upgrade an existing website                  | Read [Upgrade](docs/UPGRADE.md)                                                                     |

## Install A Website From Deploy ZIP

Use this path for normal site owners and shared-hosting installs.

1. Download `VonCMS_v1.25.8_Deploy.zip` from [Releases](https://github.com/Vondereich/VonCMS/releases).
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

Start with [Extension Development](docs/EXTENSION_DEVELOPMENT.md). Themes are for presentation and public UX. They should use the shared theme props, preserve SEO ownership, render post and page content through the shared renderer, and avoid duplicating runtime APIs when the core already provides them.

Common files:

- `src/themes/<theme>/Layout.tsx`
- `src/themes/types.ts`
- `src/plugins/von-core/features/themes/themeRegistry.ts`
- `src/plugins/von-core/features/extensions/components/DefaultThemeSettings.tsx`

## Plugin And Extension Development

Start with [Extension Development](docs/EXTENSION_DEVELOPMENT.md). Plugins and extensions are for optional behavior: SEO helpers, analytics, widgets, article blocks, campaign bars, integrations, and admin tools. Built-in plugin code lives under `src/plugins/von-core/features/plugins/built-in/`. Keep plugin settings explicit, sanitize public HTML, and verify activation state in both admin UI and public theme runtime.

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

- `VonCMS_v1.25.8_Deploy.zip`
- `VonCMS_v1.25.8_Source.zip`

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
2. Delete the old `assets/` folder.
3. Upload the new Deploy ZIP files.
4. Visit the site and admin dashboard.
5. Verify one homepage, one post, one page, and `/admin`.

After a site is already on the fixed updater baseline, the dashboard updater can be used for later patches when the host allows outbound release downloads.

## Release History

Current shipped release truth lives in [CHANGELOG.md](CHANGELOG.md). Public developer guidance lives in [CONTRIBUTING.md](CONTRIBUTING.md) and the focused files under [docs/](docs/).

v1.25.8 includes:

- Related Posts recovery for guest direct-link, new-tab, refresh, and SPA single-post navigation after the lean public boot cleanup.
- Bounded public/published candidate fetching that preserves the fast public boot path without restoring the old anonymous posts preload.
- Related Posts `Most Viewed` sorting now receives the existing public `posts.views` counter from bounded candidate payloads.
- Keyed fallback candidates so old related results cannot carry into the next article.
- Regression smoke coverage for the guest hard-load Related Posts candidate path.

Recent v1.25.x OpenGate work also includes post ownership hardening, staff protected-content read boundaries, public discovery copy cleanup, title-length guards, footer brand minimalism, public cache contract tightening, and current Deploy/Source ZIP packaging.

## License

VonCMS is released under the GPL-3.0-only license. See [LICENSE.md](LICENSE.md).
