# VonCMS Contribution Guide

VonCMS is open source, but it is not a generic React/PHP sandbox. It is a CMS with existing runtime, installer, theme, plugin, security, and release contracts. Contributions are welcome when they work with those contracts instead of replacing them casually.

You can contribute with any workflow you prefer: Cursor, Visual Studio Code, Antigravity-style IDEs, PhpStorm, Claude CLI, Codex CLI, another coding agent, or a plain terminal. The important part is that changes are inspected, scoped, tested, and documented.

## Set Up Your Fork

1. Install Node.js LTS from <https://nodejs.org/>.
2. Install a PHP/MySQL stack such as Laragon, XAMPP, WAMP, Docker, or native PHP.
3. Fork the repository on GitHub.
4. Clone your fork and enter the project folder.

```bash
git clone https://github.com/YOUR-USERNAME/VonCMS.git
cd VonCMS
npm install
```

Check your local tools:

```bash
node --version
npm --version
npm audit
npm outdated
```

`npm outdated` is a review tool. Do not upgrade the whole dependency tree in one pull request unless the task is specifically a dependency migration.

## Source Of Truth

When docs conflict, use this order:

1. Current maintainer instruction when provided.
2. Current code and `server/test-integration.cjs`.
3. `CHANGELOG.md` for shipped release truth.
4. `README.md` and developer workflow docs for product and workflow context.
5. Focused files under `docs/` for product and developer workflow context.

## Core Contracts

VonCMS is a hybrid decoupled CMS: React admin/public UI, PHP API/runtime, ordinary hosting deployment, and no Node.js production requirement. Keep these contracts intact.

- Editor content is still saved and rendered as HTML. TipTap owns the editing surface, not the storage format.
- Public themes must preserve shared behavior across all bundled themes unless a change is explicitly theme-specific.
- API response shapes must remain backwards compatible unless a migration path is documented and tested.
- Installer, repair, and runtime database paths must stay aligned for any schema-related change.
- Root-domain, subdomain, and subfolder deployment paths must keep working.
- Release artifacts are produced by `create_release.cjs`; do not invent a parallel packager.

## Where To Make Changes

- Themes: `src/themes/`, `src/themes/types.ts`, and `src/plugins/von-core/features/themes/themeRegistry.ts`.
- Theme settings UI: `src/plugins/von-core/features/extensions/components/`.
- Built-in plugins: `src/plugins/von-core/features/plugins/built-in/`.
- Plugin registry/runtime: `src/plugins/von-core/features/plugins/`.
- Admin screens: `src/plugins/von-core/features/`.
- Shared React hooks: `src/hooks/`.
- PHP APIs: `public/api/`.
- Installer/schema: `public/api/install.php`, `public/install.sql`, and repair/migration endpoints.
- Routing and public SSR: `.htaccess`, `public/.htaccess`, `public/index.php`, and `src/App.tsx`.
- Documentation: `README.md`, `docs/`, `CHANGELOG.md`, and `CONTRIBUTING.md`.

Start with the nearest existing implementation. Reuse project patterns before adding new architecture.

## Do Not Break

- Do not modify `public/security.php` unless a specific security issue is proven and approved.
- Do not weaken authentication, CSRF, sanitization, upload, install, or repair guards.
- Do not add raw HTML sinks unless the content is sanitized and the smoke gate is updated.
- Do not move VonCMS to a Node.js production dependency.
- Do not change saved content from HTML to TipTap JSON in the v1.x line without a dedicated migration plan.
- Do not "standardize" unrelated files while fixing one issue.
- Do not mark planned items shipped until code, tests, changelog, and release artifacts agree.

## Development Workflow

Before editing:

1. Read the relevant files first.
2. Check `CHANGELOG.md` and the focused docs for the active area.
3. Add or update a focused regression guard in `server/test-integration.cjs` when behavior changes.
4. Keep the change scoped to the proven issue.

While editing:

1. Keep public behavior backwards compatible unless the change is explicitly a breaking change.
2. Keep theme and plugin changes opt-in where possible.
3. Preserve existing API response shapes.
4. Sanitize any public HTML.
5. Check root, subdomain, and subfolder assumptions for routing changes.
6. Update docs when the workflow, command, UI, release behavior, or developer surface changes.

Before release:

1. Run TypeScript checks.
2. Run formatting.
3. Run BOM cleanup.
4. Run PHP lint with a known PHP binary when PHP files changed.
5. Run the smoke gate.
6. Run the production build.
7. Update `CHANGELOG.md`.
8. Run `create_release.cjs` only when preparing release artifacts.
9. Verify the generated Deploy and Source ZIPs contain the intended files.

## Verification Gate

The minimum expectation for ordinary contributor work is:

- `npm run typecheck` passes
- `npx prettier --check .` passes
- `node remove-bom.cjs` passes
- `npm run build` passes
- `npm run lint:php` passes when PHP files changed
- docs and changelog match the shipped behavior

For behavior changes, pull requests, and release preparation, also run `npm run test:integration`. This command executes VonCMS' maintainer smoke gate. It is a regression net, not a tutorial file, and most contributors should not edit `server/test-integration.cjs` unless they are changing a runtime contract.

If verification cannot be run, say exactly what was not run and why. Do not claim a change is complete from code inspection alone.

## Common Commands

```bash
npm install
npm audit
npm outdated
npm run dev
npm run typecheck
npx prettier --check .
node remove-bom.cjs
npm run build
```

Windows Laragon PHP lint example:

```powershell
$env:PHP_BIN='C:\laragon\bin\php\php-8.4.22-Win32-vs17-x64\php.exe'
npm run lint:php
```

Release packaging:

```bash
node create_release.cjs
```

Private planning files such as `MASTERPLAN_2.0.md` and `ROADMAP.md` are not part of the public reader path. Do not use them as public documentation links or GitHub release-note targets.

## Issues And Pull Requests

Use the GitHub issue templates for normal bug reports, release-audit reports, reproducible regressions, documentation problems, compatibility notes, and feature requests. A good issue includes:

- the VonCMS version
- PHP version and hosting stack when relevant
- browser/device details for UI bugs
- steps to reproduce
- expected behavior
- actual behavior
- screenshots, logs, or console output when useful

Do not open a public issue for a dangerous security vulnerability. If the issue could expose authentication bypass, secret leakage, arbitrary file access, upload bypass, SQL injection, remote code execution, destructive data loss, or another high-impact weakness, contact the maintainer privately first for audit and coordinated disclosure.

Use the pull request template for proposed changes after the issue or task is understood. Keep PRs scoped, explain the root cause, include verification notes, and avoid mixing unrelated cleanup with the fix.

## Pull Request Style

- Explain what changed and why.
- Link related issue/discussion when available.
- Include screenshots for UI changes.
- Include manual test notes for installer, routing, theme, plugin, or admin workflow changes.
- Keep unrelated formatting churn out of the PR.

## Pull Request Checklist

- [ ] I read the relevant source files before editing.
- [ ] I kept the change inside the approved scope.
- [ ] I did not touch `public/security.php` without approval.
- [ ] I preserved HTML editor storage compatibility.
- [ ] I checked all affected bundled themes, not just one theme.
- [ ] I added or updated focused smoke coverage when behavior changed.
- [ ] I updated `CHANGELOG.md` for shipped behavior.
- [ ] I ran the required verification commands or documented the exact gap.
