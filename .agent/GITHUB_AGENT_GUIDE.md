# VonCMS GitHub Agent Guide

This guide is for AI coding agents assisting with the VonCMS repository on GitHub. It defines the operational boundaries and standards to ensure project integrity and alignment with the owner's roadmap.

## 🚨 CRITICAL DIRECTIVES

1.  **STRICTLY PROPRIETARY**: Do **NOT** transition the project to Open Source (MIT/GPL) or publish the source code publicly until the owner (Vondereich) explicitly gives the command. The codebase must remain private.
2.  **PREVIEW STATUS**: Version `v1.23.0 "Rentaka"` is currently in **PREVIEW**. The `[PREVIEW]` tag in `README.md` must remain until the full release is authorized.
3.  **DOCUMENTATION ARCHITECTURE**:
    *   The GitHub repository root is the primary location for documentation `.md` files.
    *   Naming convention MUST follow the short-form sync: `API.md`, `MANUAL.md`, `INSTALL.md`, `INTRODUCTION.md`, `FEATURES.md`, `UPGRADE.md`, `VPS.md`, `SECURITY.md`.
    *   Local documentation is stored in the `docs/` folder. Sync changes from `docs/` to the root when pushing to GitHub.
4.  **GIT WORKFLOW**: The local workspace may not be a Git repository. Use the temporary clone-copy-push pattern to update documentation on GitHub without compromising local source files.

## REPOSITORY MAP

- `/public/api/`: Primary PHP API request handlers (Total: 71).
- `/src/`: React 19 / Vite frontend source.
- `/docs/`: Source files for all documentation.
- `CHANGELOG.md`: The ground truth for version history and release notes.
- `metadata.json`: The system's internal version manifest.

## OPERATIONAL STANDARDS

### 1. High-Fidelity Audits
*   Do not guess. Always perform physical file inspections using `view_file` or `grep_search`.
*   Verify API contracts against `server/test-integration.cjs`.

### 2. Security Integrity
*   Never remove or bypass the "Managed Blocks" in `.htaccess`.
*   Ensure all new API handlers implement the mandatory `POST + OPTIONS` preflight/auth/CSRF guard pattern.

### 3. Documentation Excellence
*   Avoid placeholders. Use `generate_image` for UI previews if needed.
*   Keep cross-links updated between markdown files.
*   Maintain the professional, publisher-first tone established in the `Rentaka` line.

### 4. Release Protocol
*   Always run `npm run build` and `npm run typecheck` before claiming a release is ready.
*   Verify that `create_release.cjs` correctly packages the `Deploy` and `Source` ZIPs.

---
*Created on 2026-04-19. Follow these rules to maintain the trust of the project owner.*
