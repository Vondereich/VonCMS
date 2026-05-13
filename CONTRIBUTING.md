# VonCMS Contribution Guide

VonCMS is moving toward an open-source milestone, but contributions still need to follow the system already in this repository. Do not treat this as a generic React/PHP app where contracts can be replaced casually.

## Source Of Truth

When docs conflict, use this order:

1. Current owner instruction and `.agent/workflows/golden-rules.md`.
2. Current code and `server/test-integration.cjs`.
3. `CHANGELOG.md` for shipped release truth.
4. `README.md` and developer workflow docs for product and workflow context.
5. `Roadmap.md` and planning docs for future direction.

## Core Contracts

VonCMS is a hybrid decoupled CMS: React admin/public UI, PHP API/runtime, ordinary hosting deployment, and no Node.js production requirement. Keep these contracts intact.

- Editor content is still saved and rendered as HTML. TipTap owns the editing surface, not the storage format.
- Public themes must preserve shared behavior across all bundled themes unless a change is explicitly theme-specific.
- API response shapes must remain backwards compatible unless a migration path is documented and tested.
- Installer, repair, and runtime database paths must stay aligned for any schema-related change.
- Root-domain, subdomain, and subfolder deployment paths must keep working.
- Release artifacts are produced by `create_release.cjs`; do not invent a parallel packager.

## Do Not Break

- Do not modify `public/security.php` unless a specific security issue is proven and approved.
- Do not weaken authentication, CSRF, sanitization, upload, install, or repair guards.
- Do not add raw HTML sinks unless the content is sanitized and the smoke gate is updated.
- Do not move VonCMS to a Node.js production dependency.
- Do not change saved content from HTML to TipTap JSON in the v1.x line without a dedicated migration plan.
- Do not "standardize" unrelated files while fixing one issue.
- Do not mark roadmap items shipped until code, tests, changelog, and release artifacts agree.

## Development Workflow

Before editing:

1. Read the relevant files first.
2. Check `Roadmap.md`, `CHANGELOG.md`, and any focused planning doc for the active release line.
3. Add or update a focused regression guard in `server/test-integration.cjs` when behavior changes.
4. Keep the change scoped to the proven issue.

Before release:

1. Run TypeScript checks.
2. Run scoped formatting for changed files.
3. Run the smoke gate.
4. Run the production build.
5. Update `CHANGELOG.md`.
6. Run `create_release.cjs`.
7. Verify the generated Deploy and Source ZIPs contain the intended files.

## Verification Gate

The minimum expectation for contributor work is:

- changed behavior has a test or smoke guard
- `npm run typecheck` passes
- `npm run test:smoke` passes, including PHP lint when a PHP binary is available
- `npm run build` passes
- docs and changelog match the shipped behavior

If verification cannot be run, say exactly what was not run and why. Do not claim a change is complete from code inspection alone.

## Pull Request Checklist

- [ ] I read the relevant source files before editing.
- [ ] I kept the change inside the approved scope.
- [ ] I did not touch `public/security.php` without approval.
- [ ] I preserved HTML editor storage compatibility.
- [ ] I checked all affected bundled themes, not just one theme.
- [ ] I updated `server/test-integration.cjs` when behavior changed.
- [ ] I updated `CHANGELOG.md` for shipped behavior.
- [ ] I ran the required verification commands or documented the exact gap.
