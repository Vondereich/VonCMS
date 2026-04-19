### [v1.23.0] - 2026-04-18

> Public `Rentaka` release that rolls the cumulative `v1.22.x` Kirana work into the new `v1.23.0` baseline.

- **Release Promotion**:
  - Promoted the public release line to `v1.23.0 "Rentaka"` across the main docs, manifests, and release metadata.
  - Updated installer, bundled theme, and bundled plugin version labels to the `1.23` series baseline.

- **Kirana Line Consolidation**:
  - Carries forward the cumulative `v1.22.0` baseline together with the `v1.22.8` admin scalability work and the `v1.22.9` save-path and settings hardening.
  - Keeps the detailed `v1.22.x` milestone history below for release traceability.

- **Content Manager Alignment**:
  - Page mode no longer shows unsupported page search or page-only filter behavior.
  - Post search and post filters continue to use the existing server-side admin contract.

- **Media Cleanup Review Flow**:
  - Orphaned-file cleanup now starts with a scan-first review flow instead of deleting against a fresh rescan.
  - The admin UI now shows the reviewed file list before deletion, and the delete step follows the saved review snapshot for safer cleanup.

- **Documentation Refresh**:
  - README now presents `Rentaka` as the active public release line with the inherited `v1.22.x` improvements folded into it.
  - ROADMAP now treats `v1.23.0` as the shipped baseline while the remaining follow-up work continues inside the `v1.23.x` series.

- **API Contract & Audit Cleanup**:
  - `update_media.php` now follows the standard `POST + OPTIONS` preflight/auth/CSRF guard pattern instead of remaining as the lone metadata endpoint outlier.
  - The integration smoke gate now locks that media metadata contract so stale audit claims do not drift back into the release sign-off.

- **Packaging, Surface Count & Version Alignment**:
  - README package guidance now matches the real Deploy ZIP layout for manual `.htaccess` recovery, including the package-root `.htaccess` file and optional `uploads/.htaccess` refresh.
  - Public docs and internal workflow references now use the code-derived API count: `71` dedicated handlers under `public/api/`, `8` support files in that tree, and `2` legacy bridge handlers in `public/` for `73` total HTTP API request handlers.
  - Residual `v1.22.x` release labels in public docs plus the outbound `IndexNow` and WordPress importer user-agent version strings are now aligned to `v1.23.0`.

- **Release Flow Cleanup**:
  - Removed the stale `release:quick` package script because it pointed to the missing `release_quick.cjs` entry and failed immediately with `MODULE_NOT_FOUND`.
  - Removed the unused `deploy.cjs` local copy helper so the repo now points cleanly to `create_release.cjs` as the active release packager.
  - Removed the deprecated `package-release.cjs` compatibility shim; `create_release.cjs` is now the only release entry point left in the repo.

- **Admin System Alerts Tray**:
  - The admin header bell now opens a lightweight system alerts tray instead of staying as a dead icon.
  - The tray surfaces integrity-repair and database-repair alerts from the current system state, and the smoke gate now locks that contract into the admin shell.

### [v1.22.9] - 2026-04-18

> Follow-up hardening release for editor SEO text save paths and legacy settings compatibility.

- **Manual Excerpt Preservation**:
  - Post and page editors now preserve manual `excerpt` input as raw text, so plain characters like `&` no longer get re-saved as HTML entities.

- **Meta Description Alias Alignment**:
  - Post and page saves now keep both `metaDescription` and `meta_description` aligned to the same raw value.
  - This prevents save-path drift between the editor payload and the backend save flow.

- **Legacy Settings Bridge**:
  - The older settings bridge now follows the main public/admin settings contract instead of maintaining its own partial local filter.
  - This reduces the risk of configuration drift on older compatibility paths.

- **Regression Coverage**:
  - Release smoke coverage was expanded so these editor and settings behaviors stay locked in.

### [v1.22.8] - 2026-04-18

> This release keeps the public release line on `v1.22.x` while folding in the admin scalability work that had previously been staged under an early `v1.23.0` pre-release heading.

- **Release Alignment**:
  - Normalized the active release line to `v1.22.8` across `CHANGELOG.md`, `package.json`, `package-lock.json`, `metadata.json`, and `README.md`.
  - Removed the premature `v1.23.0` pre-release label from the active release path so release packaging and public notes stay in sync.

- **Admin Discussion Moderation**:
  - `DiscussionManager` now uses server-bound pagination for comments instead of filtering a partial in-memory batch.
  - This live search now runs global across all statuses, with matched counts still shown in the moderation tabs for quick triage.
  - Older comments remain reachable through normal pagination; they are no longer hidden behind a limited initial client load.
  - Comment deletion now requires a delete confirmation step in the live moderation screen.
  - CommentManager is explicitly marked as legacy because the active admin route is wired to `DiscussionManager`.
  - Admin moderation/avatar fallback now matches the public comments flow, and logged-in comment saves use the correct session avatar key.

- **Admin User Management**:
  - `UserManager` now uses server-bound pagination and search instead of slicing a fixed local fetch.
  - Add, edit, and delete flows re-fetch the current page so the visible list stays in sync after admin actions.
  - The user search bar follows the tighter ContentManager admin pattern instead of the older stretched input style.

- **API Contract Updates**:
  - Admin comments now support server-side `status`, `search`, `page`, and `totalPages` in the active moderation flow.
  - Admin users now support server-side `search`, `page`, and `totalPages`.
  - Comment moderation search intentionally stays on the existing indexed moderation path rather than adding a separate FULLTEXT layer.

- **Scalability Baseline**:
  - Posts and pages both use server-side pagination metadata for admin browsing instead of relying on a fixed preload.
  - Posts search is FULLTEXT-backed for larger libraries, while pages remain pagination / id / slug based in this release line.
  - The release line is positioned for large editorial datasets, including `100k+` post architecture readiness, without turning that into a blanket hosting guarantee.

- **Included Milestones In This Release Line**:
  - **`v1.22.4`**: Admin bulk load limit alignment, RSS normalization, crawler compatibility fixes.
  - **`v1.22.5`**: Server-side ContentManager pagination, exact `COUNT` metadata, and AI writing default refresh.
  - **`v1.22.6`**: Posts FULLTEXT search, missing index repair coverage, and supporting install/repair schema alignment.

### Earlier Included Milestones

> The entries below capture earlier `v1.22.x` development steps that are already included in the active `v1.23.0` release line.

#### v1.22.6 — Search Performance & Index Alignment

- **Posts Search Upgrade**:
  - Post search moved from wildcard `LIKE` matching to MySQL FULLTEXT search for better performance on larger datasets.
  - Frontend search behavior stays the same; the change is in the backend query path.

- **Index Coverage Alignment**:
  - Added the supporting FULLTEXT and secondary indexes across `posts`, `comments`, `pages`, and `media`.
  - Fresh installs, schema repair, and bundled SQL were aligned so new and existing sites share the same index baseline.

- **Scope Notes**:
  - Pages remain pagination / id / slug based in this release and do not add page search yet.
  - Comment search logic remains on the existing moderation path, while the added indexes support current query patterns.

#### v1.22.5 — Admin Unlimited Pagination (ContentManager Server-Side)

- **Content Manager Pagination**:
  - Admin ContentManager moved from a fixed local preload to server-side pagination for posts and pages.
  - Browsing is no longer capped by the initial admin fetch, and current-page data is refreshed after delete or save flows.

- **Pagination Metadata & Filters**:
  - Posts and pages now return exact pagination metadata for admin browsing.
  - Post lists gained a server-side status filter to match the newer admin browsing flow.

- **Admin Search & Refresh**:
  - Search and filter interactions now follow the active page fetch instead of client-side slicing.
  - The editor hydration flow remains separate, so admin browsing changes do not disturb editing behavior.

- **AI Writing Default Refresh**:
  - The default AI writing fallback was refreshed for new installs and untouched settings screens.
  - Existing saved user choices remain unchanged.

#### v1.22.4 - Maintenance & Limits Alignment

- **Admin Bulk Load Limit Alignment (500 → 200)**:
  - `src/hooks/useContent.ts` `loadContent()`: `get_posts.php?limit=500` → `limit=200`, `get_pages.php?limit=500` → `limit=200`.
  - Backend already caps both endpoints at 200 (`min(200, $requestedLimit)`), so `limit=500` was an illusion — effectively returned 200 anyway. This removes the "500" number that attracted crawler spam in server logs, with zero functional change.

- **RSS Feed Image URL Normalization**:
  - `public/rss.php`: `<img src>` relative URLs inside `<content:encoded>` (e.g. `/bankai/uploads/...`) now auto-convert to full absolute URLs (`http://localhost/bankai/uploads/...`) so RSS readers can load images correctly. Supports both double and single quote attributes. Protocol-relative URLs (`//cdn.example.com/...`) are skipped. External images (CDN, picsum, etc.) are untouched. Subfolder-safe — preserves base path.

- **robots.txt Crawler Compatibility Fix**:
  - `public/robots.php`: Moved `Allow: /api/public/` above `Disallow: /api/` for top-to-bottom crawler compatibility (Bing, Yandex). Added `Crawl-delay: 1`. Removed redundant `Allow: /`.
  - `VonSEOSettings.tsx` FALLBACK_ROBOTS: Same order sync — `Allow` before `Disallow`, added `Crawl-delay: 1`. Reset button auto-picks up from API.

### [v1.22.3] - 2026-04-12

- **ISS-1015 — PHP Reserved Word Over-blocking Fix**:
  - `public/index.php` slug handler reserved words reduced from 12 to 8: removed `search`, `tags`, `category`, `page`.
  - These are SPA routes handled by React, not PHP endpoints. Keeping them in the reserved list caused the PHP handler to skip post lookups for valid URLs like `/search/my-post`.
  - Reserved words now only include actual PHP endpoints: `admin`, `api`, `login`, `install`, `assets`, `profile`, `register`, `reset-password`.
- **Homepage `<noscript>` URL Parity Fix**:
  - Added missing `plain` case to homepage post URL generation in `public/index.php`.
  - When `permalinkStructure = 'plain'`, homepage `<noscript>` links now correctly generate `/post/{id}` URLs instead of incorrectly falling through to `/{slug}`.
  - This was the last remaining inconsistency between `buildCanonicalContentPath()` (which correctly handled `plain`) and the homepage URL switch (which did not).
- **ISS-1017 — SPA Canonical Permalink Consistency Fix (Google Index Inconsistency)**:
  - **Root cause:** `window.__INITIAL_SETTINGS__` in `public/index.php` did not include `permalinkStructure`, causing React first render to fall back to `slug`-based URLs until the async settings API responded. Sidebar `<a href>` links, VonSEO canonical tags, and `getPermalink()` calls generated inconsistent URLs on initial paint.
  - **Fix 1 (`public/index.php`):** PHP now queries `permalink_structure` from the `settings` table and injects it into `window.__INITIAL_SETTINGS__` as `permalinkStructure`. Guarded by `isset($pdo) && $pdo` check and wrapped in `try/catch` to prevent crashes on DB outage.
  - **Fix 2 (`src/hooks/useSettings.ts`):** `INITIAL_SETTINGS` now reads `permalinkStructure` from `__INITIAL_SETTINGS__` on first render via conditional spread, eliminating the async gap between React mount and settings API response.
  - **Scope:** Affects all `getPermalink()` call sites — TechPress Sidebar, Digest Sidebar, public Sidebar, VonSEO canonical tag, and App.tsx `onPostClick` navigation. Applies globally to all posts (old and new) because `permalinkStructure` is a site-level setting, not per-post.
  - **Not touched:** `App.tsx` (stable, zero changes), `public/security.php` (golden rule 7), `src/utils/siteUtils.ts` (`getPermalink()` logic already correct), theme Layout files (all use `onPostClick` SPA navigation, not manual URL construction).
- **PrismProfile GlitchText Class Fix**:
  - `src/themes/prism/components/PrismProfile.tsx` line 24: fixed `className="relative inline - block group"` → `className="relative inline-block group"` (removed erroneous space in Tailwind class name).

### [v1.22.2] - 2026-04-11

- **Laragon HTTPS Redirect Fix**:
  - Added localhost bypass to the `FORCE HTTPS` rewrite rule across all `.htaccess` templates.
  - The previous rule forced HTTPS on `localhost` and `127.0.0.1`, breaking local development on stacks without SSL certs (Laragon, fresh XAMPP/WAMP).
  - Added `RewriteCond %{HTTP_HOST} !^(localhost|127\.0\.0\.1) [NC]` so localhost stays on HTTP while production domains still enforce HTTPS.
  - Updated in: root `.htaccess`, `public/.htaccess`, `public/api/install.php`, `public/api/system/repair_htaccess.php`, and `dist/` copies.
- **Navigation Toggle Save Hardening**:
  - `onToggleNav` in `useSettings.ts` now builds the next settings object before calling `setSettings`, then reuses that exact payload for API persistence.
  - This removes reliance on React updater timing during rapid toggles and keeps UI state plus saved navigation in lockstep.
- **Release Audit Alignment**:
  - Updated the integration smoke gate to validate the active release entry instead of stale `v1.22.0` changelog markers.
  - Synced version headers in key docs to `v1.22.2` so release notes and manifests stop drifting, while the installer header stays on the `1.22.0` Kirana baseline.
- **INSTALL.md â€” Laragon Setup Notes**:
  - Added Laragon local testing section with phpMyAdmin manual setup steps (`C:\laragon\etc\apps\phpMyAdmin`).
  - Documented default database credentials (Host: `localhost`, User: `root`, Password: empty) and MariaDB compatibility note.
  - Listed TCP/IP connection type, port `3306`, and Laragon project path (`C:\laragon\www\your-project`).
- **Media Variant Warning Copy**:
  - Hardened the dashboard warning text around generated variant preview/delete so admins are told more explicitly that deleting variants can remove live `srcset` candidates until a rebuild restores them.
  - Added a stronger caution for WebP-heavy imports where deleted variants may not regenerate automatically under the current rebuild safety rules.
- **Final Release Audit Cleanup**:
  - Corrected the README snapshot label and synced remaining public docs that were still carrying stale `v1.22.1` / `v1.22.0` release labels.
  - Removed a stray `public/data/test_write.txt` artifact so current source/deploy packages no longer ship an unnecessary test file.
- **Search Result Count Clarity**:
  - Default theme search results now report the full matched result count instead of the currently visible card count.
  - Digest now renders a dedicated search-results header and uses `useServerSearch` `totalResults` for server-triggered searches, with `displayedPosts.length` fallback for client-side filtering.
- **Public Comment Pagination Upgrade**:
  - Replaced the old "show 3 / view more" expand-collapse behavior in `Comments.tsx` with numbered client-side pagination.
  - Added `Prev` / `Next`, numbered page buttons, and a `Page X of Y` status while keeping the change isolated to the public comments component.
- **Server Load More Error Feedback**:
  - `useLoadMore()` now surfaces fetch failures through an explicit error state instead of silently collapsing into a generic no-more-items state.
  - `LoadMoreButton` now supports an optional error message plus retry label, and `UserProfile.tsx` passes that error for the server-backed article list.
- **Upload & Import File Permission Hardening**:
  - `wp_import.php`, `upload_file.php`, and `ImageProcessor.php` now enforce `0644` permissions on all newly created media files.
  - Fixes broken images on restrictive hosting setups where server `umask` creates files at `0600` (owner-only), preventing Apache from serving them to visitors.
  - Added `AddType image/webp .webp` to all `.htaccess` templates (root, public, installer, repair, and dist copies) as defense-in-depth for WebP MIME recognition.
  - Documentation updated: `SECURITY.md` (File Permission Reference table), `INSTALL.md` (File Permissions troubleshooting), `VPS.md` (Uploads troubleshooting).

### [v1.22.1] - 2026-04-10

- **Navigation Toggle Stale Closure Fix**:
  - Fixed `onToggleNav` in `useSettings.ts` â€” navigation state is now computed once and shared between UI update (`setSettings`) and server save (`vonFetch`). Previously, two independent computations could diverge on rapid toggles, causing UI/database mismatch after page refresh.
- **WordPress Importer Featured Image Fix**:
  - **Pre-scan attachment map**: Before batch processing, a quick XML pre-scan reads all `<wp:post_type>attachment</wp:post_type>` items and builds a `{ wp:post_id â†’ wp:attachment_url }` lookup map.
  - **`_thumbnail_id` resolution (new Strategy 1)**: Post import reads `<wp:postmeta>` for `<wp:meta_key>_thumbnail_id</wp:meta_key>`, looks up the attachment ID in the pre-scanned map, downloads the image via `rehost_import_image_url()`, and saves the local URL as `image_url` in the `posts` table. WordPress stores featured images as separate attachment items referenced by `_thumbnail_id` â€” not as `<image>` tags or `<img>` in content â€” so this resolves the root cause for sites where posts have no inline images.
  - **Fallback chain preserved**: Strategy 2 â€” explicit `<image>` tag for non-WordPress generic XML imports. Strategy 3 â€” first `<img>` in content for posts without `_thumbnail_id`.
  - **Duplicate download protection**: `rehost_import_image_url()` static cache prevents the same URL from being downloaded twice (once by attachment handler, once by Strategy 1).
  - **Result**: Tested against real WordPress WXR export from LeCatho.fr (24 posts, 25 attachments, all 24 posts have `_thumbnail_id`). Expected `image_url` coverage: ~100% (previously ~4%).
- **WPMigrator "Start New Import" Button**:
  - Added "Start New Import" button on the complete screen that resets all UI state (file, progress, logs, checkpoint, safety checkbox) back to upload view. Previously users had to refresh the browser to import another XML file.
- **Media Rebuild WebP Crash Fix**:
  - GD's `imagecreatefromwebp()` can crash with `cannot allocate temporary buffer` fatal errors on certain WebP encodings (especially WordPress-imported images). The error is now suppressed to prevent fatal crashes during the responsive variants rebuild. WebP files are already well-compressed and don't benefit significantly from responsive variant regeneration.
- **Editor Blockquote Spacing Fix**:
  - Removed redundant `<p><br/></p>` after blockquote insertion in the editor. The blockquote already has `margin: 16px 0` for natural spacing, so the trailing empty paragraph was creating unnecessary blank lines after quoted text.
- **Root DirectoryIndex Priority Fix**:
  - When both `index.html` and `index.php` exist in the root directory (common after deploy zip extraction on shared hosting), Apache's default `DirectoryIndex` serves `index.html` first â€” a blank React shell with no PHP routing, no API, no SEO engine.
  - Added `DirectoryIndex index.php index.html` to all `.htaccess` templates (root `.htaccess`, `public/.htaccess`, installer, and repair tool) to force PHP priority. Existing deployments with this conflict are now fixed automatically on Integrity Repair.
- **Google Search Index Cleanup â€” Hardcoded Default Text Removed**:
  - Removed hardcoded "Welcome to our website" text from `useSettings.ts` sidebar widget default and promo bar plugin default. These strings were indexed by Google from fresh installs before settings were saved.
  - Synced `install.sql` and `install.php` default plugin_config to empty strings to match frontend fallback.
  - `sidebarLayout` default now contains only the Trending widget (matching `install.sql` database default).
- **PHP 8.2 Minimum Version Enforcement**:
  - Added `version_compare(PHP_VERSION, '8.2.0', '<')` checks to `public/index.php`, `public/security.php`, and `public/api/install.php`.
  - Clear HTML error page for homepage access (shows current PHP version and upgrade instruction).
  - JSON error response for API endpoints and installer.
  - Prevents silent crashes and undefined behavior on unsupported PHP versions.
- **RSS Sitemap `<enclosure>` Length Attribute Fix**:
  - Added required `length` attribute to `<enclosure>` tags in `public/rss.php`. Fixes Google Search Console "Missing XML attribute" errors (20 instances).
  - File size derived from local image path when available, defaults to `0` for external URLs.
  - External/CDN image URLs no longer output `<enclosure>` tags with `length="0"` â€” the tag is skipped entirely for remote images to avoid RSS validator warnings.

### [v1.22.0] - 2026-04-09 (Kirana - cumulative release since v1.21.5)

> This release bundles the work from internal milestones v1.21.6 through v1.21.12 into one production drop. If you are upgrading from v1.21.5 or earlier, everything below is new. If you are already on any 1.21.6-1.21.12 internal build, most of it will look familiar - v1.22.0 adds the architecture naming, RSS rollout, final polish, and the last post-audit fixes.

- **Final Hotfixes**:
  - **UTF-8 Encoding Cleanup**: Replaced Windows-1252 encoded em-dashes and arrows with ASCII-safe hyphens across 13 PHP files (`rss.php`, `wp_import.php`, `backup_db.php`, `import_db.php`, `install.php`, `list_media.php`, `mail_helper.php`, `newsletter_export.php`, `register.php`, `reset_password.php`, `index.php`, `llms.php`, `sitemap.php`). Eliminated mojibake rendering issues in non-UTF-8 environments.
  - **Avatar URL Sync**: Comments API removed login-gate on `userAvatar` output (returned for all users). Login and Check Auth APIs scrubbed avatar URL with httpâ†’https upgrade on HTTPS sites.
  - **Email Verification Consistency**: Fresh install admin created with `email_verified = 1`. Staff roles auto-verified on dashboard create. Schema repair auto-verifies stuck staff users.
  - **RSS Language Fix**: Comma-separated `site_language` (e.g. `ms, en`) extracts first language as primary feed `<language>` tag.
  - **Permalink Settings UI**: Fixed misleading plain permalink example: /post/abc123 -> /post/123.
  - **FastCGI Base-Path Normalization**: `public/index.php` now normalizes `SCRIPT_NAME` before deriving `window.VON_BASE`, preventing `/./` router basenames on CGI/FastCGI shared hosting and restoring correct root/subfolder routing.
  - **WordPress Importer Attachment Fix**: `wp_import.php` now processes `<wp:post_type>attachment</wp:post_type>` items instead of skipping them. Downloads, validates, and registers standalone media entries. Auto-infers `sourceBaseUrls` from attachment URLs when not provided. Double-import guard checks `media` table before re-downloading. Batch pagination respects `$count` for all item types to prevent reprocessing across batches.

- **Release Snapshot**:
  - First public `Kirana` release that consolidates internal milestones `v1.21.6` through `v1.21.12` into one production changelog.
  - Final public-facing additions in the `v1.22.0` drop: official architecture naming, RSS feed support, final PostEditor polish, post-audit reliability fixes, and pre-release hotfixes (UTF-8 cleanup, avatar sync, email verification consistency, and FastCGI base-path normalization).
  - Detailed milestone history remains below so readers can trace how the release evolved instead of reading one giant flat feature dump.

- **Progress History**:
  - **`v1.21.6`**: permalink resolution hardening, canonical path cleanup, exact public page lookup support.
  - **`v1.21.7`**: base-path-safe navigation for themes, menu links, CTA links, and `page:{id}` fallbacks.
  - **`v1.21.8`**: WordPress importer upgrade with media re-hosting, Gutenberg cleanup, embed conversion, internal link remap, and permalink-aware redirects.
  - **`v1.21.9`**: frontend quick edit, direct featured-image picker, dedicated category manager, and schema-repair UX cleanup.
  - **`v1.21.10`**: dashboard media sync, variant cleanup, editorial audit trail, redirect loop hardening, and stronger user-manager feedback.
  - **`v1.21.11`**: admin security hardening, import/export safety tightening, avatar/data-integrity sync, and backend payload/backup performance improvements.
  - **`v1.21.12`**: frontend security hardening, PostEditor UI refresh, canonical fallback consistency, RSS feed rollout with clean URLs, BASE_PATH-aware theme footers, and cross-source discoverability.
  - **`v1.22.0`**: post-audit bug fixes covering response contracts, rollback stability, host-header risk reduction, autosave/comments/load-more races, import/export reliability, email verification bypass, page-menu persistence, comment reply save path, WP importer self-redirects, RSS URL consistency including subfolder-safe VonSEO feed links, and backup round-trip compatibility.

- **Final Highlights in `v1.22.0`**:
  - **Architecture & Syndication**: VonCMS is now formally documented as a **Hybrid Decoupled CMS**. RSS feed (`public/rss.php`) is fully integrated with clean URLs (`/rss`, `/rss.xml`, `/feed`, `/feed.xml`), BASE_PATH-aware theme footer links, sitemap/llms cross-references, and VonSEO settings panel access.
  - **Security & Integrity**: The release bundles SQL import allowlisting (including `DROP` for round-trip backup restore), backup password-hash preservation, stricter Admin 1/account protections, avatar URL validation, auth-token fallback removal, custom plugin HTML sanitization, same-origin `postMessage` guards, and automatic `rel="noopener noreferrer"` injection for `target="_blank"` links.
  - **Editor & Publishing UX**: Includes image credit support, toolbar polish, heading pills through H6, mobile Save Draft support, focus-ring cleanup, frontend quick-edit flow, direct featured-image selection, category-management improvements, and post/page audit history visibility.
  - **Media, Migration & Content Cleanup**: Brings multi-upload media flow, FTP/File Manager sync, responsive-variant cleanup, WordPress re-hosting and embed conversion, Gutenberg cleanup, profile double-encoding removal, and live avatar priority across comments/posts.
  - **Routing & SEO Consistency**: Carries the permalink fallback move to `/{slug}`, base-path-aware canonicals, safer theme navigation, exact public page lookups, redirect loop protections, and sitemap/`llms.php` parity.
  - **Audit & Reliability Fixes**: Includes `get_pages.php` / `get_users.php` response envelope fixes, `rollback_setting.php` fallback stability, `domain_url` preference for reset/verification URLs, newsletter/media OOM fixes, importer SSRF blocking, autosave timer repair, load-more pagination and page-menu persistence repairs, comment reply save-path stabilization, SMTP verification-boundary hardening, registration no longer auto-verifying when verification delivery falls back and fails, importer self-redirect skipping, RSS edge-case compliance plus subfolder-safe VonSEO feed links, language-aware RSS output, absolute enclosure URL normalization, `public/install.sql` parity for the `redirects` table, `media.created_at` install/repair sync, removal of unsupported pages-schema SQL drift, settings-schema parity between SQL/install/repair flows, app-side `settings_audit_log` writes for standard settings/category/IndexNow saves, trigger-free SQL alignment for settings audit history, default-settings parity across install SQL, legacy migration SQL, and the live installer, and content API warning logs.

### Earlier Kirana Milestones

> The following milestones track the Kirana development cycle. All work below is included in the v1.22.0 release above.

#### v1.21.12 - Frontend Security Hardening & PostEditor UI Refresh

- **Frontend Security Hardening**:
  - **Auth Token Fallback Removal**: Removed hardcoded `'internal_api_token'` fallback from `auth.config.ts`. Now returns empty string when `VITE_AUTH_TOKEN` is unset, preventing credential leakage in client bundles.
  - **AdBlock Iframe postMessage Height Sync**: AdBlock.tsx now uses `postMessage` for iframe-to-parent height synchronization instead of accessing `window.frameElement`, improving compatibility and reducing direct DOM access patterns.
  - **Custom Plugin HTML Sanitization**: Hardened `registry.tsx` to strip `on*` event handlers and block `javascript:` protocol URLs in user-provided custom plugin HTML before rendering via `dangerouslySetInnerHTML`.
  - **JavaScript URL Protocol Blocking**: Added inline `javascript:` URL validation across 5 themes and plugins (TechPress Footer, Default Footer, Portfolio Social Links, Promo Bar, Gift Widget) to prevent XSS via user-configured navigation and widget URLs.
  - **Dead Dependency Removal**: Removed `@google/genai` from `package.json` as it is server-side only and unnecessary in the frontend bundle, reducing dependency surface.

- **PostEditor UI Polish**:
  - **AI Buttons**: AI Write (`bg-purple-600`) and AI Check (`bg-rose-600`) buttons use solid colors with hover states for a cleaner, distraction-free toolbar.
  - **Save Draft Mobile Support**: No longer hidden on mobile - now displays as an icon button on small screens with full text on desktop.
  - **Focus Rings**: Added visible `focus:ring-2 focus:ring-blue-500/20` with smooth transitions to title input and sidebar form inputs for accessibility.
  - **Editor Heading Pills**: Replaced native `<select>` dropdowns in the Editor toolbar with H1-H6 plus Paragraph button pills for a cleaner feel.
  - **Modal Close Buttons**: Replaced `&times;` text with consistent Lucide `<X size={18} />` icon buttons with rounded-full hover styling across PostEditor modals.
  - **Toolbar Button Polish**: All toolbar icons use consistent sizing with `hover:scale-105` transitions, softer dividers, and color-coded icons (amber for code, cyan for HTML, violet for preview).
  - **HTML & Preview Buttons**: Converted from text labels to icon-only buttons (`<Code />` for HTML source, `<Eye />` for live preview) matching the rest of the toolbar icon style.
  - **Image Credit / Attribution**: Added "Credit / Attribution" field in the image bubble menu (appears when clicking an image). Users can type credit text (e.g. Bernama, Reuters, AP, AFP) and save - the image auto-wraps in `<figure>` with inline-styled `<figcaption>` (0.75rem, italic, #94a3b8) for consistent rendering in editor and preview. Empty credit unwraps back to plain `<img>`. Credit auto-populates from existing `<figcaption>` when clicking an already-credited image.

- **Canonical URL Consistency**:
  - **`public/index.php` `buildCanonicalContentPath`**: Changed default/fallback case from `/post/{id}` to `/{slug}`. This is the PHP function that generates `<link rel="canonical">`, OG URLs, JSON-LD, and 301 redirects for all public page loads. When `permalinkStructure` is undefined or empty, the server now generates slug-based URLs instead of ID-based URLs.
  - **Frontend `getPermalink`**: Changed default/fallback case in `siteUtils.ts` from `/post/{id}` to `/{slug}`. When `permalinkStructure` is undefined or empty, the frontend now generates slug-based URLs instead of ID-based URLs.
  - **Backend Sitemap**: Updated `sitemap.php` and `llms.php` to match - the default permalink case now falls back to `/{slug}` instead of `/post/{id}`, with an explicit `'plain'` case for the ID format. This keeps canonical URLs aligned across sitemap, canonical tags, OG tags, JSON-LD, and redirects.

- **RSS Feed**:
  - **New `public/rss.php`**: RSS feed endpoint with Atom self-link, full content, image support, and author metadata. Supports `?limit`, `?category`, and `?offset` query params. Accessible via VonSEO Settings -> Advanced -> `View RSS Feed`.
  - **Clean URL Routing**: Added `.htaccess` rewrite rules so RSS is accessible via `/rss`, `/rss.xml`, `/feed`, and `/feed.xml` (all route to `rss.php`). This matches the same clean-URL pattern used for `/robots.txt`, `/sitemap.xml`, and `/llms.txt`. Both root `.htaccess` (with `public/` prefix) and `public/.htaccess` (without prefix) are covered.
  - **Ultra-Early Interceptor**: `public/index.php` now intercepts RSS clean URLs before the React SPA boots, preventing HTML fallback and serving XML directly.
  - **RSS Discoverability References**: `sitemap.php` and `llms.php` both cross-reference `/rss.xml`, and `llms.php` outputs an "RSS Feed" section for AI/LLM crawlers.
  - **Theme Footer Links**: All 6 bundled themes (TechPress, Digest, Prism, Default, Portfolio, Corporate Pro) now include an RSS icon/link (`<Rss />` from lucide-react) in their footer.
  - **BASE_PATH-Aware Footer Links**: Theme footer RSS links use `getBasePathPrefix()` so subfolder installs generate correct paths like `/blog/rss` instead of broken `/rss`.
  - **Exported `getBasePathPrefix` Helper**: `getBasePathPrefix` in `siteUtils.ts` is now exported so themes and plugins can reuse it for subfolder-safe URL generation.
  - **VonSEO Settings Integration**: The `View RSS Feed` link uses `/rss.xml` with BASE_PATH prefix, consistent with sitemap and `llms.txt` links.
  - **Subfolder Link De-duplication**: The VonSEO Settings RSS link now avoids duplicating the configured base path when `siteUrl` or `domainUrl` already includes a subfolder such as `/portalkini`.
  - **RSS Feed Self-Link Consistency**: `rss.php` atom:link self-reference now uses `/rss.xml` instead of `/rss.php`. VonSEO Settings also points to `/rss.xml`, while footer links keep the cleaner human-facing `/rss` path.
  - **Integrity Template Sync**: RSS rewrite rules added to `repair_htaccess.php` and `install.php` templates so admin repair actions and fresh installs never lose RSS routing.
  - **RSS Spec Compliance Fixes**: Plain permalink structure now correctly generates `/post/{id}` URLs instead of slug-based paths. `content:encoded` now escapes `]]>` CDATA terminators to prevent XML corruption. Image enclosure MIME types are now derived from uploaded image file extensions instead of hardcoded `image/jpeg`.

#### v1.21.11 - Security, Infrastructure & UI Sync

- **Admin Security Hardening**:
  - **Database Import Allowlist**: The SQL import endpoint now allowlists `INSERT`, `CREATE`, `SET`, and `DROP` statements, blocking schema-altering payloads such as `ALTER` and `UPDATE` from tampered SQL files. `DROP` is required to restore VonCMS-generated backups which include `DROP TABLE IF EXISTS` for round-trip compatibility.
  - **Password Redaction Removal**: Database backup export no longer redacts `users.password` to `[REDACTED]` - the full bcrypt hash is preserved in the SQL output. Redaction previously prevented successful round-trip restore (login would fail after import) and was redundant since the backup endpoint already requires admin session + CSRF.
  - **Strict Privilege Boundaries**: Self-account deletion and Root (Admin 1) modification protections have been tightened to use absolute strict-type evaluations, completely neutralizing loose-type PHP coercion vectors (e.g. `1e0`).
  - **Avatar URL Validation**: Guest comment endpoints now apply `FILTER_VALIDATE_URL` checks to custom avatar links before those URLs reach the presentation loop.
  - **Status Integrity Pipeline**: The page-creation architecture now mirrors the post-creation core by invoking a hardcoded `['published', 'draft', 'archived']` whitelist filter. Untrusted status payloads are defaulted down to `draft`.

- **Server Optimization & Infrastructure**:
  - **Get-Posts Payload Optimization**: The universal posts feed now calculates reading time via native SQL integer aggregation (`CHAR_LENGTH(...)`) instead of piping multi-megabyte `p.content` strings into the server backend. Data payloads for heavy lists plunge from Megabytes down to Kilobytes.
  - **Memory-Safe SQL Streaming**: Backups now use unbuffered MySQL queries (`PDO::MYSQL_ATTR_USE_BUFFERED_QUERY = false`) to stream rows one-by-one rather than loading entire table blobs into PHP memory, reducing OOM risk on large databases.
  - **Audit Observability Enhancements**: Content audit tracking errors are no longer swallowed silently. Native error logs will now broadcast behind-the-scenes audit failures without polluting or crashing the frontend React response stream.
  - **FK Lock Recovery Fallback**: Broken SQL imports now restore `FOREIGN_KEY_CHECKS=1` on rejection and exception paths, reducing the risk of leaving table relationship checks disabled after a failed import.

- **Frontend Sync & Data Integrity**:
  - **System-Wide Avatar Custom URL**: Added robust support for live custom profile avatar URLs overriding Gravatar instances across all themes (TechPress, Prism, Digest, Portfolio, Corporate-Pro, Default).
  - **Avatar Priority in Comments**: Comments now utilize a `JOIN` fetch for `u.avatar` and prioritize displaying live profile avatars immediately over the comment-time snapshot.
  - **Double-Encoding Resolution**: Removed legacy `htmlspecialchars` wrapping from API `update_profile` string inputs to prevent apostrophe artifacting in bios, natively relying on React's default text interpolation out-of-the-box protections instead.
  - **WP-Bridge Presentation Sterilization**: Cleaned Gutenberg-specific block comment tags that were leaking into API excerpt results using a strategic API-side `strip_tags()`.
  - **Component Responsive Adjustments**: Enforced strict tablet breakpoints for the `Digest` layout grid structure to prevent uneven screen flow breakages.

#### v1.21.10 - Media Workflow, Audit Trail & Release Hardening

- **Media Workflow Upgrade**:
  - **Dashboard Media Sync**: Media Settings now includes a one-click sync tool that scans `uploads/` and indexes manually added FTP/File Manager media into the library database.
  - **Editor Multi-Upload**: The core editor now accepts multiple device images in one picker action and inserts successful uploads back into the article in batch order.
  - **Media Sync Variant Filtering**: FTP/File Manager sync now ignores registry-backed VonCMS-generated responsive variants so one uploaded image no longer explodes into multiple Media Library entries.
  - **Legacy Variant Row Cleanup**: Media Settings now includes a cleanup action that removes registry-backed generated responsive-variant rows from the media table without deleting original files or touching canonical media records.
  - **Variant Classification Hardening**: Generated-media filtering now relies on explicit VonCMS-written variant registry entries instead of filename suffix inference alone, so legitimate originals such as `hero_400w.jpg` are no longer hidden or cleaned by mistake just because they resemble responsive assets.

- **Editorial Audit Trail**:
  - **PostEditor Edit Log Panel**: The dashboard post/page editor now shows an async `Edit Log` panel in the right sidebar, with latest activity summary plus a recent-history modal for existing items.
  - **Self-Healing Audit Schema**: A new `content_audit_logs` table is now created on install, repaired by `Schema Repair`, checked by the DB status probe, and auto-bootstrapped on first edit-history use for older sites.
  - **Repository SQL Parity**: The content audit log schema is now represented in `public/install.sql` alongside the runtime install/repair flows, so the repository SQL bundle stays aligned with active schema expectations.
  - **Unified Save/Delete Logging**: Post and page create/update/delete actions now write audit entries at the backend chokepoints, so dashboard edits, quick-edit flows, and moderation changes all feed the same history trail.
  - **Legacy SQL Bundle Refresh**: `public/install.sql` now includes the content audit log table and the current `pages` / `media` columns used by the runtime installer.

- **Release Hardening**:
  - **Frontend Content-Type Hydration Fix**: Direct public page loads now hydrate as pages instead of falling through the single-post path on first render, so floating frontend edit controls target the correct page editor and save endpoint after a hard refresh.
  - **Frontend Owner Detection Repair**: Single-post hydration and initial post seeds now preserve `author_id`, so owner-based frontend edit affordances appear correctly for moderator and writer accounts on posts they actually own instead of silently behaving like admin-only controls.
  - **Admin 1 Protection Guardrail**: Appointed admins and moderators can no longer modify the `admin 1` super-admin account from the dashboard user manager, while `admin 1/root` retains full control over all user records.
  - **Admin Self-Service Alignment**: Appointed admins can still maintain their own dashboard account details and password, while `admin 1` remains the only protected account in the user-manager flow.
  - **Admin Role Assignment Guardrail**: Direct user-save API calls now mirror the dashboard role restrictions, so only `admin 1/root` can assign admin-level roles while appointed admins keep self-service access without gaining promotion power.
  - **Staff-Wide Post Editing Alignment**: Post save/delete APIs and frontend quick-edit visibility now follow the same staff-level `Posts` policy (`admin/root/moderator/writer`) instead of falling back to owner-only behavior in part of the stack.
  - **Redirect Loop Guardrails**: Plain-permalink canonical redirects now avoid self-redirects on `/post/{id}`, legacy `/post|/blog` routes collapse safely to the active canonical path, and manual redirect saves now reject same-path plus simple multi-hop local loops before they reach runtime.
  - **Redirect Loop Scanner**: The Redirect Manager now includes a loop scanner for existing rules, with backend graph checks that flag stored self-loops and local redirect cycles before they surprise a live site.
  - **User Manager Response Feedback**: The dashboard user manager now surfaces toast feedback for successful create/update/delete operations and for blocked protected-account actions instead of failing silently.

#### v1.21.9 - Admin Convenience & Category Workflow

- **Admin Convenience Upgrade**:
  - **Direct Featured Image Picker**: The post editor now supports direct featured-image uploads from device plus browsing the existing Media Gallery instead of relying on a plain URL field alone.
  - **Frontend Edit Shortcut**: Staff users can now open the current post or page directly in the dashboard editor from the public frontend without digging through admin content lists.
  - **Frontend Quick Edit Modal**: Staff users can now launch a modal-based post/page editor directly on the public view for quick fixes while staying on the current page.
  - **Frontend Edit RBAC Alignment**: Public quick-edit and dashboard-edit shortcuts now respect owner/admin-root permissions more closely, so moderator and writer accounts only see edit affordances for content they can actually update.
  - **Dedicated Category Manager**: Settings now includes a dedicated `Categories` tab for adding, renaming, and deleting categories without hiding that workflow under the Menu screen.
  - **Category Management Improvements**: The post editor category selection now displays existing categories in a dedicated selector while still allowing manual entry, and newly saved categories are folded back into site settings for reuse.
  - **Historical Category Recovery**: Settings delivery now merges authoritative category labels from stored posts, so the editor can suggest older categories even when they were never manually curated in Settings.

- **Maintenance UX Alignment**:
  - **Schema Repair Labeling**: Database repair surfaces now describe themselves accurately as VonCMS schema repair tools instead of implying low-level MySQL corruption recovery.
  - **Schema Repair Refresh Signal**: The repair endpoint now returns an explicit `repaired` flag so the Database Manager reloads only after a real schema change, instead of relying on fragile success-message text matching.

#### v1.21.8 - WordPress Importer Upgrade

- **WordPress Importer Upgrade**:
  - **Import Batch Accuracy**: The WordPress importer now batches only real `post` and `page` entries, so attachments and other non-content XML items no longer consume import slots or distort progress.
  - **Auto Media Re-hosting**: Imported WordPress content now downloads supported source images into local `uploads/` storage and rewrites in-content image references to VonCMS-local paths instead of leaving them on the old domain.
  - **Gutenberg Cleanup on Import**: Imported WordPress content now strips Gutenberg block comments during migration instead of persisting `<!-- wp:... -->` noise into stored post/page HTML.
  - **Supported Embed Conversion**: The importer now converts supported standalone media URLs and Gutenberg embed wrappers for YouTube, TikTok, Vimeo, and Facebook into iframe embeds before save.
  - **Internal Link Remap**: Imported anchor links pointing to the detected source WordPress domain are now remapped to the current VonCMS site URL while skipping obvious asset/admin targets.
  - **Permalink-Aware Redirects**: Auto-generated redirects created during import now target the active VonCMS permalink structure instead of assuming root-slug URLs.

#### v1.21.7 - Base-Path Navigation Safety

- **Base-Path Navigation Safety**:
  - **Theme Menu Normalization**: Same-site custom navigation links across the bundled themes now normalize against `BASE_PATH`, preventing root-relative `/about` style links from escaping subfolder installs.
  - **Corporate Pro CTA Safety**: Corporate Pro menu items, footer links, and CTA/service targets now pass through the standard same-site URL normalization rules instead of using raw theme-configured paths.
  - **Page Menu Fallback Forwarding**: Theme menu handlers now forward unresolved `page:{id}` targets to the centralized page resolver instead of aborting when a page record is not already loaded client-side.

#### v1.21.6 - Permalink Resolution & SEO Path Consistency

- **Permalink Resolution Hardening**:
  - **Post Click Canonicalization**: Client-side post navigation now resolves the target post before routing, so ID-driven click surfaces follow the configured permalink structure instead of fabricating `/post/{id}` when the item is missing from memory.
  - **Page Click Slug Resolution**: Page navigation now resolves through the authoritative page slug, with an exact page lookup fallback when a `page:{id}` menu item is not present in the hydrated client list.
  - **Legacy Route Containment**: The legacy `/post/:id` route remains available for backward compatibility, but public UI navigation no longer relies on it as the primary path.

- **SEO Path Consistency**:
  - **Base-Path-Aware Canonicals**: Client-side canonical URLs for pages, profiles, and category views now include the configured `BASE_PATH`, improving parity for root, subdomain, and subfolder deployments.
  - **Public Page Lookup Precision**: `get_pages.php` now supports exact `id` and `slug` lookups while preserving the published-page boundary for public requests.

### [v1.21.5] - 2026-03-29 (Security, Scheduler & Editor Hardening)

- **Security Hardening Follow-up**:
  - **OTA SHA256 Enforcement**: The updater now requires a verified SHA256 digest before swap, resolving it from a caller-supplied hash, a sidecar checksum asset, or GitHub release metadata.
  - **OTA Dashboard Digest Wiring**: The admin dashboard now forwards GitHub release asset digests into the updater request so OTA stays fail-closed without depending on sidecar checksum files alone.
  - **Recovery Query Token Retirement**: Integrity check and .htaccess repair now accept authenticated POST + CSRF only, instead of allowing recovery tokens in query strings.
  - **Dev Theme API Fallback Limiter**: The local theme API now falls back to an in-memory rate limiter when express-rate-limit is unavailable, instead of disabling throttling outright.
  - **Database Manager Query Guardrails**: `db_query.php` is now POST-only, requires admin session + CSRF, rejects multi-statement and non-read SQL, blocks risky file/function operations, and caps raw/helper result sizes for safer inspection use.

- **Auth UI Refresh**:
  - **Solid Auth Surfaces**: Login, register, forgot-password, and reset-password states now use solid slate surfaces instead of gradient-heavy/glass styling.
  - **State-Aware Header Icons**: The auth header now swaps icons by mode so sign-in, registration, recovery, and password reset each read more clearly at a glance.
  - **Modal Shell Simplification**: The public auth popup now uses a simpler solid overlay and a single card shell instead of layered modal chrome.

- **Editor Hardening**:
  - **TikTok Iframe Migration**: The WYSIWYG editor now converts TikTok URLs to sanitizer-safe player iframes instead of relying on script-based embeds that would be stripped during save/render.
  - **Instagram Guardrail**: Instagram URLs now return an explicit "not supported yet" editor message instead of pretending to accept an embed path that the current renderer cannot honor.
  - **Paste & Save Sanitizer Tightening**: External pasted HTML now routes through the same DOMPurify-backed insert sanitizer as other editor HTML inserts, and the PostEditor save path now performs a final DOMPurify pass after the color/style scrubber before persistence.
  - **External Paste Article Extraction**: Full-page HTML pasted from external sites now drops obvious chrome/noise blocks such as related lists, share/follow prompts, sponsored markers, and link-heavy navigation wrappers while preserving article-style content markup.
  - **Page Save Parity**: `save_page.php` now mirrors the post-save content guardrails with a content-size limit, non-admin tag allowlist, and stripping of inline event handlers plus `javascript:` URLs.
  - **Scheduled Editor Repair**: PostEditor now preserves `scheduledAt` when reopening scheduled posts, limits background autosave to drafts so scheduled items cannot silently fall back to draft, and removes the corrupted scheduling labels in the publish-time panel.

- **Scheduler Runtime Hardening**:
  - **Shared Runtime Alignment**: Admin read paths still delegate to the shared scheduler helper, while public visibility filters compare against PHP/CMS time instead of raw MySQL `NOW()`.
  - **Homepage Timezone Bootstrap**: `public/index.php` now reapplies the configured CMS timezone after loading `von_config.php`, so request-driven homepage scheduling uses the same timezone basis as post save, admin reads, and the cron endpoint.
  - **Cron Timezone Parity**: `cron_publish.php` now reapplies the configured site timezone after loading config as well, so direct cron-triggered publishing uses the same schedule basis as the homepage and admin read paths.
  - **Shared Site Timezone Helper**: The old dashboard-named timezone bootstrap is now exposed through a site-wide helper name, while a backward-compatible alias remains in place for legacy internal call sites.

- **Digest Frontpage Polish**:
  - **Search Bar Width Tuning**: The Digest homepage search shell is now slightly wider for a less cramped frontpage layout.

- **Theme Icon Standardization & Mojibake Cleanup**:
  - **Thematic Visual Consistency**: Standardized all theme dark mode toggles across the 5 togglable built-in themes (`Default`, `TechPress`, `Digest`, `Portfolio`, `Corporate Pro`; Prism excluded as an always-dark theme) using `Moon` and `Sun` components from `lucide-react` with a consistent color palette (`text-amber-500` for Sun, `text-blue-400` for Moon).
  - **Mojibake Eradication**: Fixed character encoding issues in the `Digest` and `Corporate Pro` themes, replacing corrupted symbols with stable alternatives.
  - **Digest Metadata Polish**: Replaced corrupted likes/comments symbols in `Digest` with standardized `ThumbsUp` and `MessageSquare` icons.
  - **TechPress Navigation Polish**: Standardized `Back to Home` navigation links with `ChevronLeft` icons, replacing problematic non-ASCII arrow characters that were prone to corruption.
  - **Corporate Pro Separator Fix**: Cleaned up the metadata bullet separator (`&bull;`) in the `Corporate Pro` layout to ensure visual stability.
  - **Default Mobile Toggle Fix**: Resolved a visual inconsistency in the `Default` theme where the dark mode switch in the mobile menu was uncolored; it now follows the standardized amber/blue palette.

- **Admin Polish & Build Hardening**:
  - **Cleanup UI Fix**: Removed mojibake characters from the media cleanup result panel, ensuring that success/failure messages are now readable again.
  - **Release Entry Compatibility**: `package-release.cjs` now acts as a compatibility shim that forwards to `create_release.cjs` instead of maintaining a second release packager.
  - **Release Automation Sync**: `create_release.cjs` and the release packaging flow were refreshed to stay aligned with the current source tree.
  - **Smoke Gate Expansion**: `server/test-integration.cjs` now validates the integrity of the OTA digest wiring, scheduler runtime alignment, the shared site-timezone helper wiring, and stricter Database Manager method/auth/CSRF guard markers.
  - **Backend Audit Coverage Tightening**: The smoke audit now asserts that `db_query.php` remains POST-only, admin-gated, and CSRF-protected so the core Database Manager hardening cannot silently regress.

### [v1.21.4] - 2026-03-28 (Responsive Images, Srcset Rollout & Media Settings Reset)

- **Media Settings Simplification**:
  - **Sizes Tab Reset**: Media Settings now manages `Max Width` and `Max Height` only, instead of exposing legacy `thumbnail`, `medium`, `large`, or custom size fields in the admin UI.
  - **Settings Model Cleanup**: Frontend defaults, TypeScript types, install seed data, and media save handling no longer persist the removed `media.sizes` structure.

- **Responsive Image Delivery**:
  - **Upload Pipeline Variants**: Content-image uploads now generate responsive width variants from the canonical processed image, while system assets such as logos and favicons explicitly skip responsive variant generation.
  - **Hydration & API Contract**: Post payloads and PHP hydration now expose `imageSrcSet` alongside the canonical image URL so React can render responsive images without deriving paths in the theme layer.
  - **Theme Rollout**: Public card/listing/hero slots across the main bundled themes, related posts, and public profile views now consume shared responsive image attributes instead of always shipping the original content image.
  - **Digest Hero Discipline**: Digest now keeps its featured hero closer to the TechPress baseline instead of over-expanding the featured slot, and long category pills/badges now truncate cleanly with tooltip access to the full label.
  - **Digest Accent Sync**: Digest category pills and badges now follow the active accent color setting directly instead of relying on a separate hardcoded category palette.
  - **Original-Only Exceptions**: Lightboxes, logos, avatars, and other non-content/system asset paths continue to use their original source directly.

- **Media Tools & Maintenance**:
  - **Responsive Rebuild Tool**: Media Settings now includes a `Rebuild Responsive Variants` action for regenerating width-based variants on existing featured images referenced by posts.
  - **Rollback Safety Switch**: Media Settings now includes preview and purge actions for generated responsive variants, guarded by a job lock and designed to leave original uploads untouched.
  - **Legacy Thumbnail Retirement**: The old `regenerate_thumbnails` media-tools action now returns an explicit `410` deprecation response instead of pretending the legacy thumbnail workflow still exists.
  - **Compatibility Cleanup Kept**: Orphan scanning and media deletion still recognize legacy `_thumb` files and new `_*w` responsive variants so upgrades and cleanup flows stay safe.

### [v1.21.3] - 2026-03-26 (Stabilization & Packaging Realignment)

- **Integrity & Installer Hardening**:
  - **Integrity / Repair Split**: `fix_integrity.php` is now a read-only integrity check, while `repair_htaccess.php` performs the actual managed `.htaccess` repair when needed.
  - **Single Backup Preservation Flow**: `repair_htaccess.php` and `install.php` now preserve existing `.htaccess` content, refresh only the VonCMS-managed block, and keep a rolling `.bak` snapshot instead of timestamped `.vonbak` files.
  - **Anchored Managed-Block Matching**: Tightened the `.htaccess` block matcher in `repair_htaccess.php` and `install.php` so server-managed rules outside the VonCMS block are preserved correctly instead of being misread as part of the managed section.

- **AI & Admin Resilience**:
  - **AI API Hardening**: `ai_generate.php` and `ai_check.php` now detect missing `curl`, malformed upstream JSON, provider block reasons, and incomplete AI responses with clearer JSON errors.
  - **Frontend JSON Safety**: `PostEditor.tsx` now reads AI responses as text first and surfaces readable errors when the server returns HTML, warnings, or any non-JSON body.
  - **Canonical Permalink Tightening**: `index.php` now recalculates the official post permalink even in the fallback slug route, so alternate legacy paths collapse to the correct canonical URL instead of mirroring the request path.

- **Security & Privilege Hardening**:
  - **Legacy Comment Path Lockdown**: `save_comments.php` now restricts legacy bulk comment migration and JSON fallback writes to authenticated admin + CSRF flows only, instead of accepting unactioned public payloads.
  - **Like Delta Whitelist**: Comment like updates now accept only `+1` or `-1` deltas so the API cannot be nudged with arbitrary like counts through manipulated requests.
  - **Admin Boundary & User Privacy Tightening**: `wp_import.php` now enforces admin access explicitly, and `get_users.php` no longer exposes e-mail fields to non-admin staff responses.

- **Pagination & Settings Guardrails**:
  - **Posts Per Page Clamp**: General Settings now enforces a `6..50` range in the UI and backend, so malformed or legacy values cannot collapse public pagination to `0`, `1`, or runaway counts.
  - **Pages API Server Clamp**: `get_pages.php` now follows the same server-side pagination style as `get_posts.php`, including `page` support and a `200` item cap even when the admin hook requests `limit=500`.
  - **Theme Pagination Sync**: Portfolio profile views and Corporate Pro load-more sections now inherit the global `postsPerPage` setting instead of keeping separate hardcoded `6` values.

- **Theme & QA Stability**:
  - **TechPress Profile Footer Fix**: Member profile pages now use a full-height flex layout so the footer is pushed to the bottom cleanly without whitespace gaps.
  - **Share Placement Polish**: Bottom share buttons now follow a consistent `post -> share -> tags -> related posts` order in the affected themes so the share action stays close to the article ending without pushing related content ahead of the post metadata.
  - **Default Theme Layout Recovery**: Restored the default theme's centered shell layout after the recent visual polish so the main frame no longer drifts left on the public-facing view.
  - **Integration Gate Expansion**: `server/test-integration.cjs` now checks managed `.htaccess` markers, installer preservation logic, AI hardening markers, and the TechPress profile layout fix.

- **Packaging Realignment**:
  - **Deploy + Source Only**: Restored `create_release.cjs` to the simpler release flow that generates `Deploy.zip` and `Source.zip` only.
  - **Sample Config Packaging**: `Source.zip` now excludes the live `public/von_config.php` file and keeps `public/von_config.sample.php` as the portable template for future public/open-source source drops.
  - **Documentation Sync**: README package guidance now reflects the current no-`Upgrade.zip` workflow, the sample-config packaging rule, and the shared-hosting `.htaccess` backup warning for manual extraction.

### [v1.21.2] - 2026-03-24 (The Managed Block & UI Stabilization Update)

- **Managed Block Strategy (.htaccess Safety)**:
  - **Surgical Managed Blocks**: Implemented `# BEGIN VonCMS` and `# END VonCMS` markers for all `.htaccess` templates (Root, Public, Dist), giving VonCMS a dedicated managed routing block.
  - **Zero-Touch Preservation**: The Integrity Repair tool now performs surgical replacement only within the identified VonCMS blocks, preserving hosting-specific PHP handlers and custom server rules during repair operations.
  - **Double-Prefix Routing Fix**: Resolved a critical 404/500 routing error where Source-mode installs would incorrectly double-prefix paths after a system repair.

- **Theme & UI Stabilization (Performance Sync)**:
  - **Hydration Sync Redux**: Integrated dynamic `useEffect` sync in `ThemeContext.tsx` to align the `ThemeProvider` with incoming settings props. This eliminates the "flicker" on fresh installs caused by stale `localStorage` data.
  - **TechPress Title Precision**: Expanded Trending Story titles to **3 lines (`line-clamp-3`)** and standardized minimum height to **`4.5rem`**.
  - **Clipping Fix**: Eliminated the "fine crescent moon" (anak bulan) text clipping in vertical news cards for a cleaner, professional grid.
  - **Anti-Squeeze Engine**: Standardized all article thumbnails to a premium **16:9 (aspect-video)** ratio with `object-cover` enforcement.

- **OTA, Packaging & Settings Reliability**:
  - **OTA Protection Hardening**: The in-dashboard updater now protects `.htaccess`, `von_config.php`, `.env`, `data/`, `uploads/`, and `backups/` during OTA swaps.
  - **Path-Aware Safety**: Protected-file checks are now path-aware and also preserve nested custom `.htaccess` files during recursive copy operations.
  - **Safer OTA Backup**: OTA backups now include the live root `.htaccess` before any file swap begins.
  - **Manual Upgrade Package**: Release packaging now includes `Upgrade.zip` for live/manual updates on sites that need to preserve host-generated or custom `.htaccess` rules.
  - **Share Placement Persistence Fix**: Fixed the General Settings share button placement value resetting to `Disabled` after save/reload by reconciling legacy and canonical database keys.
  - **General Settings Cleanup**: Removed a redundant Tailwind `block` + `flex` class conflict in the Site Language label.

### [v1.21.1] - 2026-03-24 (Stability & Technical Debt Cleanup)

- **Deep Version Cleanup (Agnostic Engine)**:
  - **Eradicated Legacy Markers**: Performed a workspace-wide deep scan and removed over 70+ redundant version comments (`@version`, `v1.20`, `v1.11.x`) from PHP API headers and theme layouts.
  - **Maintenance Speed-up**: Core files are now version-agnostic, reducing manual header modification for future updates.
  - **InstallWizard Sync**: Simplified the Setup Wizard display to `v1.21` (Series Standard).

- **PHP 8.0++ Modernization**:
  - **Deprecated Resource Cleanup**: Removed all instances of `imagedestroy()` and `finfo_close()`, aligning with PHP 8.0+ object-oriented resource management.

- **Theme UI Enhancements (Premium Glassmorphism)**:
  - **Premium Header Blur**: Upgraded `backdrop-blur` level and implemented semi-transparent backgrounds (`rgba(..., 0.85)`) for TechPress and Digest headers.
  - **Digest Hero Alignment**: Fixed image responsiveness in the Digest theme to prevent distorted images on mobile.

- **Enterprise Performance Validation**:
  - Verified scheduler, audit logging, and content APIs under sustained load with consistent response times.

- **Settings & System Stability**:
  - **General Settings Fix**: Resolved naming mismatches for `site_language` and `domain_url` in the API.
  - **Duplicate Save Prevention**: Removed redundant analytics mappings in `save_settings.php`.

### [v1.21.0] - 2026-03-17 (Breeze Series Performance & UI Refinement)

- **UI Refinement (TechPress Hero Fix)**:
  - **Hero Gap Elimination (Precision Fix)**: Resolved the persistent vertical image gap on desktop by adjusting the content container. Removed contradictory `mt-auto` constraints in `HeroArticle` to ensure text stays vertically balanced against full-frame images (`object-cover`).

- **Version Series (Breeze Transition)**:
  - **Official Codename Update**: Transitioned from the "Mandala" infrastructure series to the "Breeze" performance and aesthetics series.
  - **Unified Versioning**: Synchronized version strings across 25+ files, including themes, plugins, `package.json`, `metadata.json`, and `.cursorrules`.

- **Maintenance (PHP 8.5 Preparation)**:
  - **Deprecated cURL Cleanup**: Removed all 7 instances of `curl_close()` from the core engine (`IndexNow.php`, `updater.php`, `ai_generate.php`, `ai_check.php`). This preemptively resolves "Deprecated" warnings in PHP 8.5+ while improving object-based handle management.

- **Legacy Settings Cleanup & Analytics Rationalization**:
  - **Single Source of Truth**: Consolidated Google Analytics configuration into `GoogleSettings.tsx`. Removed redundant `api.analyticsId` and `SEO` settings tab from `SettingsManager.tsx` to eliminate configuration overlap.
  - **Type Synchronization Power-Up**: Synchronized the `SiteSettings` interface with all v1.21.x active fields, including `analytics`, `logoUrl`, and `timeZone`. Eliminated the redundant `src/types/` directory to prevent ghost imports.
  - **Orphan Cleanup**: Removed legacy `footerShowSubscribe` from both TypeScript definitions and the PHP backend (`save_settings.php`, `get_settings.php`), reducing technical debt.
  - **Database Migration Purge**: Completely eradicated the `seo.analytics` legacy schema row from `install.sql` and `database/migrations/001_create_settings_table.sql`.
  - **API Routing Fix**: Fixed a critical logic blind spot where `save_settings.php` was erroneously writing modern `api` group data back into the dead `seo.analytics` row.
  - **Native Analytics Refocus**: Updated `VonAnalyticsSettings.tsx` to focus exclusively on Native CMS insights and Privacy/Cookie Consent compliance.
- **Documentation Alignment**:
  - Updated `README.md`, `ROADMAP.md`, and system rules to reflect the v1.21.x "Breeze" standards, including the updated open-source roadmap (Public Repository at 1,000 users).

### [v1.20.12] - 2026-03-12 (Phase 2 Security Hardening + Image SEO Engine)

- **Permalink Leakage Hardening (Sanitation Fix)**:
  - **Variable Initialization Fix**: Corrected `$path` and `$hp['url']` initialization in `sitemap.php` and `index.php`. This absolute fix prevents internal status leakage and ensures Googlebot always receives the user-configured permalink structure instead of defaulting to `/post/{id}`.
  - **Parity Sync**: Verified logic synchronization between `siteUtils.ts` (Frontend) and PHP (Backend) for 100% URL parity.
- **Image SEO Engine (Visual Discovery Indexing)**:
  - **Image Sitemap Support**: Added `xmlns:image` namespace and `<image:image>` tags to `sitemap.php`. Google can now explicitly associate images with their respective post URLs.
  - **Sitemap Performance Optimization**: Lowered the `MAX_URLS_PER_SITEMAP` limit from 50,000 to **1,000** for better server efficiency and faster Google crawling, following industry standards.
  - **Homepage Schema Enhancement**: Added `image` property to the `ItemList` schema in `index.php`. Googlebot now identifies post-specific images directly from the homepage crawl.
  - **Safe URL Fallback**: Implemented robust absolute URL generation for images in both sitemap and schema, supporting root, subfolder, and subdomain environments.

- **Comment System Redux (Master Logic)**:
  - **Identity Pinning**: User ID and name are now derived directly from session data for logged-in users, preventing identity impersonation.
  - **CSRF Enforcement**: Mandatory CSRF validation for authenticated comment additions.
  - **Quality Gates**: Implemented a mandatory **10-character minimum** and strict link density checks (Max 5 links for guests).
  - **Sanitized Pagination**: Replaced problematic PDO parameter binding for `LIMIT` with sanitized integer interpolation, fixing the "Comments Disappeared" bug.
  - **Role-Based Visibility**: Guests now see only approved comments, while Staff/Admin see pending items for moderation.
  - **Feedback UI**: Updated `useComments` hook and `ResponseHelper` to allow validation error messages (e.g. "Comment too short") to be displayed via **Toast notifications** on the frontend.
- **OTA Updater Hardening**:
  - **SSL Enforcement**: Mandatory SSL verification for all update downloads to prevent MITM-based RCE attacks.
  - **Integrity Validation**: Optional but strict SHA256 hash verification for update packages before extraction.
- **Core Infrastructure Locking**:
  - **Installer Double-Lock**: Introduced `install.lock` mechanism. Re-installation is fully blocked even if `von_config.php` is missing.
  - **Installer UI Blocking**: Updated `public/index.php` to display a "System Locked" message if the installer is accessed post-installation, preventing UI-level exploit attempts.
  - **POST-Only Backups**: Restricted `backup_db.php` to POST requests with strict CSRF enforcement to prevent token leakage.
- **Data Leakage Mitigation**:
  - **Allowlist Masking**: Upgraded `security.php` to "Allowlist-First" masking for credentials (`db_`, `smtp_`, etc.).
  - **Safe Fallback Query**: Hardened `get_settings.php` to request only whitelisted safe keys when the `is_public` column is missing.
  - **Double Key Unification**: Unified `domain_url`, `domainurl`, and `siteurl` into a single standard **`siteUrl`** key in `get_settings.php` for cleaner API responses.
- **Forced Action Prevention**:
  - **Logout CSRF Protection**: Added mandatory CSRF token validation to `logout.php`.
- **UI Harmonization & Refinement**:
  - **TechPress & Digest Parity**: Standardized all article thumbnails to **4:3 aspect ratio** (`aspect-[4/3]`) across the TechPress theme for a "smart" and consistent visual rhythm.
  - **Hero Gap Elimination (Desktop)**: Re-engineered the featured post container using `lg:self-stretch` with a `lg:min-h-[420px]` safety baseline. The image now dynamically follows the height of adjacent text content, eliminating unsightly gaps.
  - **Reinforced Mobile Hero**: Switched from fluid aspect-video to a **fixed 280px height** on mobile, matching the robust feel of the Digest theme.
  - **Enhanced List Thumbnails**: Increased horizontal thumbnail width to `w-56` (224px) on desktop for improved visual hierarchy and premium aesthetic.
  - **Gallery Grid Update**: Increased items per page to **32** (8x4 grid) for higher administrative efficiency.
- **Packaging Integrity**:
  - **Full Release Scan**: Verified 22-item file count in the deployable ZIP, including root meta-files (`README.md`, `CHANGELOG.md`, `package.json`).

### [v1.20.11] - 2026-03-10 (Universal Path Agnosticism & Core Polish)

- **Master Security Hardening**: Addressed 3 critical/high vulnerabilities to ensure enterprise-grade security:
  - **SMTP Header Injection**: Patched `mail_helper.php` by strictly stripping CRLF (`\r\n`) characters from email headers to prevent command injection and spam relaying.
  - **Administrative RCE Prevention**: Hardened `db_query.php` (Database Manager) by restricting raw queries exclusively to read-only `SELECT` and `SHOW` commands, blocking destructive SQL execution. _(Hotfix: Restored support for standard semicolon-terminated queries in Database Manager while maintaining strict `SELECT` and `SHOW` locks)._
  - **Code Injection Mitigation**: Upgraded `install.php` to use `var_export()` instead of `addslashes()` for database credentials, preventing PHP code injection during the initial setup configuration.

- **Universal Path Agnosticism (Master Seal)**: Completed a 360-degree audit of URI generation. Resolved critical "double pathing" in Social Meta tags (OG/Twitter) and SEO Schema (JSON-LD).
  - **Hardened Host Detection**: Unified host detection regex `/[^a-zA-Z0-9.\-:]/` across **all 70+ entry points and API scripts**, adding robust support for subdomains, hyphens, and custom ports (e.g., `localhost:8080`).
  - **Critical Variable Order Fix**: Corrected `$protocol` and `$host` initialization in `index.php` to ensure robust fallbacks even during database downtime or fresh installs.
  - **Universal SEO Consistency**: Synchronized path-detection logic across `robots.php`, `sitemap.php`, and `llms.php` for 100% environment-agnostic XML/TXT generation.
  - **Installer Precision**: Updated `install.php` to use the new hardened host regex during initial "birth" of the site configuration.
  - **Pro Robots Rules**: Enhanced default `robots.txt` with stricter security directives (Disallowing `/install/`, `/data/`, `/logs/`, and `von_config.php`).
  - **Favicon Double-Request Fix**: Eliminated redundant favicon downloads by implementing a robust `new URL()` comparison logic in the React frontend.
  - **Agnostic Dashboard Preview**: Updated SEO Settings components to use dynamic `BASE_PATH` for robots.txt rules.

### [v1.20.10] - 2026-03-09 (Absolute Path Agnosticism & TechPress Polish)

- **TechPress Image Standardization (YouTube-Style)**: Fixed vertical image stretching in the `HeroArticle` by enforcing a stable `16:9` aspect ratio and `420px` height. Standardized "Trending Stories" (4:3) and "Latest Updates" (16:9) tthumbnails with `object-fit: cover` for a uniform grid look.
- **Universal Path Agnosticism (Mandala Standard)**: VonCMS is now 100% path-agnostic. Implemented dynamic base path injection via PHP (`window.VON_BASE`) and updated React routing/permalinks to auto-detect root, subdomain, or subfolder environments.
- **Hotfix: Path Redundancy**: Resolved critical path duplication (e.g., `/folder/folder/`) by introducing `noBase` flag for internal navigation and fixing `domainUrl` vs `BASE_PATH` overlap logic in `getPermalink`.
- **Deep Integrity Audit**: Performed a bulk scan of all 70 API endpoints to verify relative pathing (`__DIR__`) and eliminate `DOCUMENT_ROOT` dependencies.
- **Documentation & Versioning Alignment**: Synchronized all `docs/_.md` and `README.md` to correctly reflect the stable `v1.20.10` build, reverting experimental version strings.
- **MASTER AUDIT COMPLETE**: 100% Bit-by-bit comparison against original source zip verified. Zero regressions. Path detection is now "Universal".

### [v1.20.9] - 2026-03-08 (SPA Ad Intelligence & Security UI)

- **SPA Ad Persistence (Iframe Isolation)**: Solved the "manual refresh" requirement for script-based ads (AdSense/RoboForex). Ads now automatically re-execute during SPA navigation through dynamic Iframe Isolation and ResizeObserver height syncing.
- **Security Hardening (Iframe Sandbox)**: Enhanced ad isolation by implementing strict `sandbox` attributes on all ad and widget iframes.
- **Premium Ad Manager UI**: Redesigned the Ad Settings interface with Card-based layout and full English (i18n). Optimized for widescreen with `max-w-6xl` container.
- **Security Log Management**: Upgraded auto-purge to be 100% reliable. Added manual "Maintenance" and "Full Reset" buttons (including `clear_all_logs.php`) to the Security Dashboard.
- **Sidebar Ad Purge (Atomic Level)**: Completely removed the redundant "Sidebar Ad" slot; Custom Widgets are now the 100% standardized way to manage sidebar content.
- **SEO Permalink Fix (ID -> Slug Redirection)**: Implemented automated 301 redirects from ID-based URLs to true slug-based permalinks.
- **Strict Canonical Logic**: Re-engineered `<link rel="canonical">` generation to always point to the calculated permalink.

### [v1.20.8] - 2026-03-04 (Content Engagement Update)

- **Smarter Content Summaries**: Improved the automated summary engine to include categories and publication dates, providing better context for visitors and automated systems.
- **Global Timezone Support**: Standardized time handling across the system for improved scheduling and logging accuracy.
- **Language Management**: Added dedicated site language settings for easier content localization.
- **Theme Polish**: Refined media display and ad backgrounds across several themes for a cleaner look.

### [v1.20.7] - 2026-03-04 (Discovery & SEO)

- **Enhanced Search Engine Visibility**: Implemented a modern, lightweight summary system to help search engines index content more accurately.
- **Link Reliability**: Improved URL generation logic to ensure permalinks remain consistent under various configurations.
- **Smart Data Extraction**: Upgraded the internal analysis engine for better identification of key topics and keywords in articles.

### [v1.20.0 - v1.20.6] - 2026-03-02 (Mandala Series Kickoff)

> **The Mandala series marks a major milestone in performance and authoring stability.**

#### Editor & Content Precision

- **Intelligent Copy-Paste**: Redesigned the editor to preserve visual formatting while automatically stripping problematic external styles.
- **Background Auto-Save**: Implemented seamless background saving to prevent data loss without interrupting the workflow.
- **UI Refinement**: Consolidated the media insertion tools into a single, clean interface for a faster authoring experience.

#### Performance & Media Optimization

- **Automated WebP Conversion**: Systems now automatically optimize images upon upload for faster page delivery.
- **Media Cleanup Tools**: Added interactive tools for managing and removing unused files from the server safely.

#### System Hardening & Accessibility

- **Infrastructure Audit**: Extensive review and cleanup of core security layers, specifically targeting access control and input safety.
- **Standardized Navigation**: Implemented smart pagination systems across all administrative managers for better data navigation.
- **Responsive Typography**: Unified heading and text scaling across all themes for professional readability on any device.

---

### [v1.11.12] - 2026-02-27 (Nara Foundation Complete)

> **The Nara foundation is complete now with Smart Navigation and Media Integrity.**
>
> This release marks the culmination of the Nara series (v1.11.x) a fully hardened, production-certified CMS engine. Every security layer, hydration bridge, and theme system has been battle-tested and locked in. This version includes the new global Smart Pagination system and critical server-side media fixes.

#### Smart Pagination (UX Overhaul)

- **Smart Navigation**: Replaced basic pagination with a dynamic "Smart Pagination" component across all admin managers.
- **Ellipses Logic**: Automatically condenses large page lists with ellipses (1 ... 4 5 6 ... 100), preventing UI breakage.
- **Premium Styling**: Implemented modern glassmorphism and smooth transitions for a high-end administrative experience.
- **Unified Consistency**: Standardized navigation behavior across Content, User, Comment, Extension, Newsletter, and Security managers.

#### Media Integrity (Hotfix 2026-02-27)

- **PNG Transparency Fix**: Added explicit alpha channel preservation in `ImageProcessor.php`. PNG images now retain transparency even when processing skips resizing, preventing the "black background" issue.
- **Deep Clean Deletion**: `delete_media.php` now surgically removes all file variants including `.webp` versions and associated tthumbnails, ensuring no orphaned "ghost images" remain.
- **Path Consistency**: Updated `delete_media.php` to support both `uploads/` and `/uploads/` path formats in database lookups. Fixes deletion failures for files uploaded in the latest version.

#### Documentation

- **README Refactor**: Redesigned README for better visual appeal. Moved banner to top, streamlined sections, and preserved product screenshots. Updated business proposal contact information (__kurama87@gmail.com__).

#### Security Hardening

- **Auth Integrity**: Strict 401/403 enforcement for all mutation endpoints. Removed all insecure default fallback IDs (`?? 1`).
- **Bot Logic**: Hardened `security.php` to prevent UA-spoofing on API routes while preserving SEO indexing for crawlers.
- **Media Ownership**: Restricted file deletion to original owners or admins only. Exact path matching prevents accidental wildcard data loss.
- **Upload Sniffing**: Enabled deep server-side MIME sniffing to block disguised malicious payloads.
- **CORS Hardening**: Mirror trusted CORS restricted `Access-Control-Allow-Origin` to localhost or same-host mirroring to prevent credential leakage.
- **Admin Lock Enforcement**: Hardened `media_tools.php`, `upload_file.php`, and `list_media.php` with double-layered session verification.

#### Data Hydration & SEO

- **Stale State Safety**: Fixed persistent ghost content in `useSinglePost.ts` during SPA navigation or network failures.
- **OTA Stability**: Fully resolved the `/public/public` path regression. Updater now auto-detects root vs. subfolder environments with 100% accuracy.
- **SEO Clean-up**: Resolved Google Search Console "Crawled - currently not indexed" issues via improved server-side hydration.

#### API Cleanup & Optimization

- **API Standardization**: Removed incorrect mappings like `list_themes.php` and harmonized analytics tracking under the high-efficiency `track_visit.php` engine.

#### Hydration & Frontend Polish

- **Hydration Memory Cleanup**: React now deletes `window.__INITIAL_STATE__` after consuming, preventing stale data on SPA navigation.

#### Editor Improvements

- **Style Whitelist Fix**: `sanitizeHtml()` no longer blanket-strips all inline `style` attributes. Now uses a DOMPurify hook to whitelist safe layout properties (`text-align`, `margin`, `display`, `width`, `height`) while still blocking colors, backgrounds, and font overrides. Fixes editor alignment (center/right) not rendering on frontend/preview.
- **Image Resize Presets**: Added S (25%) / M (50%) / L (75%) / Full (100%) size buttons to the Image Bubble Menu. Allows quick resizing of content images directly in the editor.
- **TechPress Mobile Thumbnail Fix**: Replaced fixed `h-72` (288px) height with `aspect-video` (16:9) for mobile thumbnails. Prevents aggressive cropping of landscape images (e.g. flags, banners).
- **Homepage Payload Trim**: Removed `p.content` from homepage seed query homepage only needs title/excerpt/image, not full article HTML.
- **Dynamic og:type**: Single post/page views now correctly output `og:type="article"` instead of always `website`.
- **SPA Route Guard Sync**: Expanded slug-detection exclusion to skip all SPA routes (`profile`, `register`, `search`, etc.), preventing wasted DB queries and false 404 headers.
- **Mobile Heading Scale**: Content headings (H1-H4) now scale down on mobile screens (â‰¤ 640px) for better readability across all 6 themes.

#### Foundation & Schema

- **Install Schema Sync**: Added missing `featured_image` column to `pages` CREATE TABLE in `install.php`, aligning with `repair_db.php`. Fresh installs now match upgraded databases.
- **TechPress Mobile Feed**: Increased mobile thumbnail heights in TechPress theme Trending cards `h-48 -> h-56`, Latest cards `h-56 -> h-72` for a fuller, more immersive FB-style feed scroll.

---

### [v1.11.11] - 2026-02-23 (Security Patch)

> **Targeted hardening for high-risk findings.**
>
> This hotfix addresses high-priority security issues found during internal review.

#### Security Fixes

- **Bot Bypass Refinement**: Restricted `SOCIAL_BOT_BYPASS` in `security.php` to non-API `GET` requests. Prevents UA-spoofing attacks on sensitive API endpoints.
- **Media Over-deletion Fix**: Switched from `LIKE` wildcards to exact match `$pathVariants` in `delete_media.php` and `update_media.php`.
- **Mirror Trusted CORS**: Restricted `Access-Control-Allow-Origin` to localhost or same-host mirroring to prevent credential leakage.

#### System Stability & Pathing

- **Dynamic Root Detection**: Fixed redundant `/public/` pathing in `updater.php`. System now auto-detects root vs subfolder environments for zero-stutter OTA updates.
- **Sitemap Date Fallback**: Implemented triple-fallback `updated_at -> created_at -> now` in `sitemap.php` to resolve "1970-01-01" dates without new helper functions (Rule 4).
- **Absolute Path Anchors**: Standardized `wp_scan.php` and `wp_import.php` to use `__DIR__` for temp file resolution, ensuring stability across cPanel and VPS.

#### Quality Control

- **Logic Review**: Verified all 12 modified files for correctness.
- **Minimal Footprint**: All patches follow minimum viable fix approach no new abstractions.
- **Admin Lock Enforcement**: Hardened `media_tools.php`, `upload_file.php`, and `list_media.php` with double-layered session verification.

### [v1.11.11] - 2026-02-21 to 2026-02-22 (Nara Final - Deep Review + Polish)

> **Final stability pass before release lock.**
>
> Comprehensive review of logic integrity with author data cleanup and hydration fixes.

#### Hydration Bridge Fix (Ghost Buster)

- **Root Cause**: Intermittent blank pages when navigating back to a post because the React state (`fullPost`) was nullified but the hydration guard prevented a fresh fetch.
- **Fix**: Added state re-sync in `useSinglePost.ts` that triggers a fresh fetch when the post is null but hydration data exists. Tested across back-and-forth navigation.

#### Code Review

- **index.php Integrity**: Reviewed `public/index.php` for correct logic flow. Restored interceptor and security layer parameters.
- **Scheduler Logic**: Confirmed auto-publish scheduler and lock-file logic in API endpoints.
- **API Security**: Verified SQL JOIN implementation in `get_post.php` and `get_posts.php`.

#### "Clean" Author Payload Standardization

- **Standardized Contract**: Consolidated author fields into a clean `author_data` (Object) + `author` (String) contract.
- **Payload Cleanup**: Removed redundant fields (`authorName`, `authorAvatar`, `createdAt`, `updatedAt`, `scheduledAt`) from API responses to reduce payload overhead and eliminate data fragmentation.
- **Theme Robustness**: Verified that all theme components (`UserAvatar`, `TechPressAvatar`) handle the minimalist hydration contract correctly, falling back to Gravatar (via hash) or initials for 0% visual anomaly.

#### Slug Hyphen Fix

- **Root Cause**: Slugs containing intentional hyphens (e.g., `how-to-use`) were stripped during save. Regex `[^a-z0-9]+` was replacing hyphens with hyphens, collapsing double-hyphens and stripping intentional formatting.
- **Fix**: Updated regex to `[^a-z0-9\-]+` in `useContent.ts` (frontend slug generator) to preserve existing hyphens.

#### Critical Security Fix: Updater Path Logic (CORRECTED)

- **Root Cause**: The System Updater (`updater.php`) introduced in v1.11.10 was using incorrect path resolution (`realpath(__DIR__ . '/../../..')` - 3 levels) which broke compatibility with deployed installations. This caused file copy operations to target wrong directories during OTA updates.
- **Impact**: Updates from v1.11.0-v1.11.8 to v1.11.10+ would fail with stuttering and missing assets because files were written to incompatible paths.
- **Fix**: Reverted to smart detection logic (2 levels + structure check) from v1.10.11 which properly handles both cPanel deployments (`/public/assets`) and Vite project structures. Now `realpath(__DIR__ . '/../..')` with automatic detection: `if (is_dir($rootPath . '/public/api'))` resets to `/public` subfolder. Validated across Windows/Linux/cPanel environments. **This restores OTA update reliability.**

#### Sitemap Robustness & Safety

- **Date Fallback**: Implemented `updated_at ?: created_at` logic in `sitemap.php` to handle NULL timestamps, preventing "1970-01-01" dates in XML feeds.
- **Permalink Resilience**: Added an explicit `default` case to the sitemap's permalink `switch` statement, ensuring URL generation fails gracefully to `/post/{id}` if a malformed setting is detected.
- **Bot Response Code**: Forced `200 OK` for social crawlers (Facebook/Twitter/WhatsApp) to prevent preview failure even when logic is still booting.

#### Stability & Syntax Hardening

- **Unicode Support**: added `JSON_UNESCAPED_UNICODE` to all hydration blocks to support special characters (Jawi, Emojis) in SEO metadata.
- **Final SEO Audit**: Fixed syntax errors and brace mismatches in the `public/index.php` entry point.
- **Production Integrity**: Re-synced production assets to ensure the latest fixes are present in the final build.
- **Author Hydration Fix**: Added SQL `JOIN` with the `users` table in `index.php` to fetch actual author names and avatars for server-side hydration. This prevents the author from defaulting to "Admin" upon page reload.

### [v1.11.10] - 2026-02-20 (Nara Finalized Hydration & UI Overhaul)

#### Branding Footer

Added "Powered by VonCMS" branding to footer copyright across **all 6 themes**:

- **Corporate-Pro**: Added `settings.siteName` + "Powered by VonCMS" to footer.
- **Prism**: Replaced hardcoded `VON_CMS` with dynamic `settings.siteName` + "Powered by VonCMS".
- **Default / TechPress / Digest / Portfolio**: Standardized footer with "Powered by VonCMS" branding.

#### Semantic Color Engine (Full Audit)

Reviewed all 6 themes for hardcoded hex values and semantic theming compliance:

| Theme             | Status | Notes                                                     |
| ----------------- | ------ | --------------------------------------------------------- |
| Default           | Clean  | CSS Custom Properties (`--color-primary`, `--bg-nav`)     |
| TechPress         | Clean  | Centralized `getColors(isDark, primaryColor)`             |
| Digest            | Clean  | Centralized `getColors(isDark, accentColor)`              |
| Portfolio         | Clean  | Centralized `getColors(isDark, accent)`                   |
| Prism             | Clean  | CSS vars + cyberpunk `colorMap` scheme selector           |
| **Corporate-Pro** | Fixed  | 3x `#2563eb` `settings.theme.primaryColor \|\| '#2563eb'` |

- **Corporate-Pro Fix**: Theme was ignoring admin-configured primary color. `useRelatedPosts`, `VonNewsletter`, and `VpComments` now respect `settings.theme.primaryColor`.

#### Neutral Dark Mode (Industry Standard Migration)

Migrated dark mode from blue-tinted Tailwind `slate` to neutral grey matching YouTube/Facebook/X standard. Implemented via **inline style objects** using `isDarkMode` ternary operators across theme Layouts:

| Old (Blue-Tinted)     | New (Neutral Grey) | Role                     |
| --------------------- | ------------------ | ------------------------ |
| `#020617` slate-950   | `#0a0a0a`          | Darkest background       |
| `#0f172a` slate-900   | `#121212`          | Surface alt              |
| `#1e293b` slate-800   | `#1a1a1a`          | Surface / border         |
| `#334155` slate-700   | `#2a2a2a`          | Border                   |
| `#f8fafc` / `#f1f5f9` | `#E5E7EB`          | Primary text (off-white) |
| `#94a3b8` slate-400   | `#9CA3AF`          | Secondary text           |

**Files Modified:**

- `ContactFormRenderer.tsx` Removed 5 hardcoded blue refs (submit button, focus ring, spinner, accent blob). Restored Primary Color for Submit Button (removed hardcoded gray gradient).
- `default/Layout.tsx` Migrated dark mode hex values to neutral grey inline styles. Restored Dark Header/Footer default (Neutral `#0a0a0a`) for unconfigured themes.
- `corporate-pro/Layout.tsx` Migrated dark mode hex values to neutral grey inline styles.
- `techpress/Layout.tsx` Unified Category Bubbles (Applied "Featured" style to Trending/Latest lists).
- `skeleton.css` + `SkeletonLoader.tsx` Dark skeleton background `#1e293b` `#1a1a1a`. Light skeleton standardized to `#e5e7eb`. Scrollbar thumb migrated to neutral.
- `index.css` Dark mode CSS vars migrated: `--bg-card`, `--text-primary`, `--text-secondary`, `--border-color`.

#### Master Audit & Integrity System

- **Admin Dashboard**: Removed legacy "Repair Popup" notices. The dashboard is now standard and clean.
- **Security Audit**:
  - **XSS/SQLi**: Clean. No unsafe `dangerouslySetInnerHTML` or raw SQL interpolation found in themes.
  - **Output Safety**: `ob_start()` implemented in `get_posts.php` to prevent "JSON Crash" on older plugins.
  - **Footer**: Fixed Mojibake (``) in Corporate-Pro footer.
  - **Code Quality**: `Prettier` formatting applied to all files. TypeScript check passed (0 errors).

#### JSON-LD Schema Fix (Triple HTML Encoding)

- **Root Cause**: Database stores `&` as `&amp;` (HTML entity). When outputting to JSON-LD schema via `json_encode()`, the entities were passed through raw resulting in `&amp;amp;amp;` (triple-encoded) in the rendered HTML source.
- **Fix**: Applied `html_entity_decode()` to all JSON-LD text fields (`name`, `description`, `headline`) before `json_encode()`.
- **Scope**: Homepage `CollectionPage` schema (item names + descriptions) + Article schema (`headline`) for both `/post/` and plain slug URLs.
- **Safety Net**: Added a final decode loop on all top-level schema text fields before output to prevent future encoding chain issues.

#### Theme Flicker Fix (FOUC Prevention)

- **Root Cause**: Default theme briefly appeared before user's selected theme loaded, especially in incognito mode. Pre-fetched theme settings were not being passed correctly to the theme provider.
- **Fix**: Modified `ThemeContext.tsx` and `VonProviders.tsx` to correctly pass and utilize pre-fetched theme settings, ensuring the correct theme renders immediately on page load.

#### React Hydration Overhaul (Deep Atom Scan)

- **Full Data Seeding**: `public/index.php` now injects a complete `window.__INITIAL_DATA__` (homepage) and `window.__INITIAL_STATE__` (single posts) with all necessary fields (`id`, `slug`, `content`, `category`, `image_url`, `keywords`).
- **SQL Optimization**: Audited and updated all SELECT queries in `index.php` to include missing hydration columns, ensuring React has immediate access to full article content.
- **Accurate 404 Detection**: Corrected the "Not Found" logic from `!isset($post)` to `empty($post)`, ensuring the backend correctly flags missing content for both the browser and crawlers.
- **Zero-Flicker Hooks**:
  - `useContent.ts` now seeds posts instantly on mount.
  - `useSinglePost.ts` check for PHP-injected state before triggering any API calls or loading states.
  - **Routing Intelligence**: `App.tsx` now prioritizes the PHP-provided status code over frontend guesses, effectively ending "Soft 404" classifications.

#### Responsive Typography Optimization (Final Polish)

Implemented comprehensive responsive font scaling across **TechPress** and **Digest** themes for professional readability across all devices:

**Mobile-First Breakpoints:**

| Element          | Mobile | Tablet | Desktop | XL Desktop |
| ---------------- | ------ | ------ | ------- | ---------- |
| **Post Titles**  | 24px   | 30px   | 36px    | 48px       |
| Featured Titles  | 18px   | 24px   | 36px    | -          |
| Profile Names    | 24px   | 28px   | 32px    | -          |
| Category Headers | 24px   | 28px   | 32px    | -          |
| Site Names       | 16px   | 18px   | 20px    | 24px       |

**Files Modified in Typography Update:**

- `techpress/Layout.tsx` 3 heading elements (main post, featured, header)
- `digest/Layout.tsx` 5 heading elements (featured, profile, main post, page title, category header)

**Benefits:**

- **Mobile UX**: No cramping on small screens (base size 24px readable)
- **Desktop Balance**: Professional 36px main title (vs. oversized 60px previously)
- **SEO Compliance**: Proper heading hierarchy maintained across themes
- **Industry Standard**: Matches TechCrunch, The Verge, Medium typography patterns
- **Zero FOUC**: Progressive scaling smooth across all breakpoints

#### Notes

- **Files Modified**: 13 total (Hydration: 11 files + Typography: 2 themes `techpress/Layout.tsx`, `digest/Layout.tsx`)
- **Themes Untouched**: Digest, Portfolio, Prism already had clean color systems
- **Admin Panel**: Intentionally retains blue-tinted slate design (`#0F172A` sidebar) for visual harmony with blue accent buttons
- **Build**: TypeScript | Build | Master Audit
- **Backup**: `_backup_v1.11.10/` created before changes

#### Nara Foundation Complete

This is the final planned release before the **Ramadan and Aidilfitri** break. The Nara foundation (v1.11.x) is now production-locked security, hydration, and themes are battle-tested and stable. Development resumes with **v1.20 "Mandala"**.

---

### [v1.11.9] - 2026-02-18 (Google Soft 404 SEO Fix)

#### Critical SEO Fix: Google Soft 404 Resolution

- **Root Cause**: Google classified homepage as "Soft 404" because `<body>` contained only an empty `<div id="root"></div>` zero visible text content for crawlers despite valid `<head>` meta tags.
- **Noscript Content Injection**: Added dynamic `<noscript>` block with site title, description, and 5 latest posts (title + excerpt + link) gives Googlebot meaningful body content without any visual change for users.
- **Enhanced Schema.org JSON-LD**: Upgraded homepage schema from basic `WebSite` to `CollectionPage` with `ItemList` containing latest articles stronger structured data signal for Google indexing.
- **Permalink-Aware URLs**: All generated URLs (Schema + noscript) auto-detect the user's permalink structure setting (`slug`, `date`, `category`, `plain`) from database.
- **Subfolder-Aware URLs**: Fixed URL generation to include `$basePath` prefix (e.g. `/blog/slug`) works correctly for root, subdomain, and subfolder installations.
- **Zero Visual Impact**: All changes are invisible to users `<noscript>` only renders when JS is disabled, Schema is in `<head>`, and `<div id="root">` + skeleton remain untouched.

#### Notes

- **Files Modified**: 1 (`public/index.php` ~40 lines added)
- **Files NOT Modified**: All other files unchanged

---

### [v1.11.9] - 2026-02-17 (API Reliability Hotfix)

#### Critical Fix: Posts Not Appearing (Root Cause)

- **SQL Optimization (Root Cause Fix)**: Reverted `get_posts.php` from `SELECT p._` back to **explicit column selection**. The `SELECT p._` pulled full post content (including invalid UTF-8 characters from WordPress XML imports) into `json_encode()`, causing it to silently return 0 bytes making all posts invisible on the frontend.
- **SQL Optimization (Pages)**: Applied same explicit column treatment to `get_pages.php` for consistency and future-proofing.

#### Safety Net Restoration (v1.10.11 Parity)

Restored critical error-handling mechanisms that were accidentally stripped during v1.11.5v1.11.8 mass batch edits (66+ files rewritten 3 times for path standardization):

- **Output Buffering**: Restored `ob_start()` to `get_posts.php`, `get_post.php`, `save_settings.php`, `get_pages.php` prevents PHP warnings from corrupting JSON responses.
- **Modern Error Catching**: Restored `catch (Throwable $e)` (from `catch (Exception $e)`) in `get_posts.php`, `get_post.php`, `get_settings.php`, `save_settings.php`, `get_pages.php` catches fatal errors (TypeError, OutOfMemoryError) that `Exception` misses.
- **UTF-8 Safety Net**: Added `JSON_INVALID_UTF8_SUBSTITUTE` flag to `get_post.php` and `get_pages.php` the only endpoints that return full content where bad characters could exist.

#### Notes

- **Files Modified**: 5 (`get_posts.php`, `get_post.php`, `get_settings.php`, `save_settings.php`, `get_pages.php`)
- **Files NOT Modified**: 64 remaining API files verified clean via quarter-scan audit
- **`security.php`**: NOT modified already provides full security infrastructure to all endpoints

---

### [v1.11.9] - 2026-02-15 (Refined Core Architecture & Hybrid Contract)

This release introduces the **Advanced Core Processing** and critical **Type System Synchronization** to ensure 100% theme compatibility and developer productivity.

#### TechPress & UI Aesthetics

- **Surgical Layout Repair**: Successfully restored `TechPress/Layout.tsx` to v1.11.8 stability while preserving critical v1.11.9 improvements (Breaking News borders, Header Ad slot styling).
- **Username Recognition**: Fixed a regression in `Layout.tsx` where author usernames were not correctly mapped to their profile data.
- **Header Ad Optimization**: Replaced solid background colors in header ad slots with `rgba(0,0,0,0.02)` / `rgba(0,0,0,0.2)` for a cleaner, theme-aware integration.
- **Theme-Aware Comments**: Updated `VpComments` to use `themeColors.border` for consistent dark mode dividers.

#### UX & Performance (FOUC Fix)

- **Double Guard FOUC Prevention**: Implemented a synchronous Theme Guard in `index.php` and `index.html` to detect dark mode before any CSS/JS loads, eliminating the "white flash" on reload.
- **Dark Mode Persistence**: Shifted `isDarkMode` state to `localStorage` in `App.tsx`, ensuring theme preferences survive hard reloads and deep linking.
- **Skeleton Neutralization**: Removed rogue `@media (prefers-color-scheme: dark)` queries from `skeleton.css` and `SkeletonLoader.tsx` to prevent color mismatches (dark skeletons on light backgrounds) during slow network conditions.

#### Automated Content Analysis (v1.13.0 Engine)

- **Pure Intelligence (LAIR)**: Implemented Language-Agnostic Intelligent Ranking. No more "first 5 sentences" the system now mathematically identifies the most relevant points in any language.
- **Dynamic Context**: Word frequency analysis for automatic filler detection and positional weight boosting.
- **Plugin Audit**: Verified syntax integrity, closed all lexical scopes, and removed internal legacy remnants.

#### Hybrid Contract & Type Safety

- **Hybrid Author Support**: Synchronized the "Double Contract" for authors. API now returns both `author` (String) and `author_data` (Object) to prevent **React Error #31** while supporting rich avatars.
- **Dual Date Standard**: Officially added snake*case date fields (`created*at`, `updated*at`, `scheduled*at`) to the TypeScript `Post`and`Page` interfaces for 100% legacy theme compatibility.
- **Type Intelligence**: Hardened `src/types/index.ts` to reflect the current hybrid state of the CMS.

#### Stability & Security Hardening (Feb 16)

- **Post Date Accuracy**: Resolved a legacy issue where post dates would display the current timestamp on frontend hydration. Implemented strict `created_at` mapping between API v1.11.9 and the React hydration layer.
- **Upload System Hardening**: Standardized `ImageProcessor` inclusion using absolute paths (`__DIR__`) to prevent include path resolution conflicts across different hosting environments.
- **AI Service Architecture**: Confirmed path resolution integrity for `ai_generate.php` and `ai_check.php`, ensuring consistent behavior across version upgrades.
- **Theme Persistence**: Fixed a long-standing issue where Dark/Light mode would reset on hard reload. By shifting state to `localStorage` (App.tsx) and enforcing a synchronous guard, theme preference now persists permanently across sessions and restarts.

### [v1.11.8] - 2026-02-14 (Core Stability & SEO Cleanup)

This release focuses on foundational "Day 1" architecture fixes and CORRECTING Soft 404 behavior for better search engine crawling.

### Core Architecture & Skeleton Fix

- **Skeleton Animation Fix**: Resolved a long-standing "Day 1" issue where the Skeleton Loader transition was non-functional due to missing `@keyframes fadeOut`. The exit transition into the main app is now smooth and premium.
- **Optimized Asset Loading**: Removed a redundant direct CSS link in `index.html` that conflicted with Vite's bundling process. This improves build reliability and prevents unnecessary 404 requests in production.
- **Unified Scrollbar Standard**: Synchronized the custom scrollbar styles across `index.html`, `index.css`, and the Server-Side SEO Engine (`public/index.php`). The system now uses a consistent 8px standard from the first byte of server response to the final hydrated React app.

### SEO & Soft 404 Fix

- **Explicit 404 Support**: The Master SEO Engine (`index.php` and `dist/index.php`) now correctly returns `HTTP 404` status codes for missing posts, pages, and categories instead of a soft 200 OK.
- **Root Shim Strategy**: The root `index.php` now employs a "Smart Shim" strategy that prioritizes the production build (`dist/index.php`) to ensure assets load correctly while falling back to source only if necessary.

### Analytics & Dashboard Fix

- **Analytics CSRF Fix**: Resolved guest tracking failure by re-injecting the `csrf-token` meta tag into `public/index.php`. Standardized human vs bot tracking security.
- **Dashboard Overlap Fix**: Corrected the "Last 7 Days" query to return exactly 7 days of data, eliminating the "dual day" overlap (e.g., two Fridays) on the visitor chart.

### Social & UI Cleanup

- **Reverted Zero-Dependency**: Re-integrated `react-share` to ensure 100% URL stability and social metadata compliance.
- **Dark Mode UI Fix**: Fixed a "Double Line" styling bug in social sharing buttons when viewed in Dark Mode.
- **Remove AddToAny**: Completely removed all traces of `AddToAny` external scripts for better privacy and performance.

### Ad System & Theme Standardization

- **Unified Ad Slot Isolation**: Implemented `slotId` based CSS scoping in `AdBlock` to prevent ad styles from leaking into theme layouts.
- **Universal Popup Consolidation**: Introduced `VonPopupAd` (Shared Component) and `useAdsPopup` (Shared Hook) across all 6 themes.
- **Thematic Consistency**: Refactored `Portfolio` and `Corporate-Pro` to ensure zero-glitch navigation during ad display.
- **Layout Audit Completion**: Successfully audited all 6 active themes (**Default**, **Prism**, **TechPress**, **Digest**, **Portfolio**, **Corporate Pro**) for responsive ad parity and CSS normalization.
- **Legacy Cleanup**: Completely removed the **Classic Theme** from the core registry and TypeScript definitions for an atomic cleanup.

### Post Date & Stabilization (Feb 15)

- **Hybrid Author Contract (Fix Error #31)**: Resolved the critical "Objects are not valid as a React child" error. The API now returns `author` as a **String** (for legacy theme rendering) and `author_data` as an **Object** (for modern frontend hooks). 100% theme compatibility restored.
- **Post Date Correctness**: Resolved a critical issue where old posts displayed the current date. Themes now consistently use `createdAt` with robust fallbacks to `updatedAt` for 100% accurate historical reporting.
- **Type System Integrity**: Restored and hardened `src/types/index.ts`. All original interfaces are preserved, and `createdAt`/`scheduledAt` are now native to the `Post` and `Page` types.
- **Label Clarity**: Updated theme labels (e.g., Default theme) to correctly reflect "Post Date" instead of "Updated Date" for better user transparency.

### Absolute Path Integrity & Security

- **10-Round "Sula" Path Patch**: Standardized **100% of the API layer** (51 files) to use `__DIR__` for all inclusions. This ensures the CMS is portable across subfolders, symlinked hosting (cPanel), and OTA updates without session drops.
- **Master Audit Protocol**: Passed the full comprehensive security and logic deep scan. Verified SQLi, XSS, CSRF, and Session enforcement across all endpoints.
- **Production Certified**: Completed final pipeline (`tsc`, `prettier`, `audit`, `build`) with zero errors. Release packages v1.11.8 generated and sealed.

### [v1.11.7] - 2026-02-11 (Maintenance, Security & Mail Optimization)

This release focuses on security hardening, documentation accessibility, and a major fix for contact form SMTP integration.

- **Auto-Resolution**: Backend now automatically resolves system settings in contact form templates.
- **SMTP Alignment**: Improved mail transport logic to use authenticated SMTP accounts as the sender, significantly reducing spam flagging in Gmail/Outlook.
- **Reply-To Integrity**: Properly handles `Reply-To` headers for direct communication.

### Security & Hardening

- **Security Obfuscation**: Renamed `SECURITY.md` to `HARDENING.md` to avoid detection by automated online scanners looking for security policy fingerprints.
- **File Renaming**: Updated internal documentation references to match new hardening patterns.

### PHP Standardisation

- **Trailing Tag Cleanup**: Removed trailing `?>` tags from 6 core PHP files (`redirect_engine.php`, `updater.php`, `list_redirects.php`, `save_redirect.php`, `delete_redirect.php`, `fix_integrity.php`) to align with PSR-12 and prevent potential "headers already sent" errors caused by accidental whitespace.

### Documentation & Localization

- **Global Accessibility**: Translated the entire documentation suite (Theme Development Guide, Upgrade Guide, User Manual, VPS Setup) from Malay to English.
- **English Standardisation**: All technical guides are now standardized in English to support a broader developer ecosystem.

### Theme & UI Polish

- **Universal Pagination Fix**: Standardized pagination behavior across **Extension Manager**, **Content Manager**, and **Newsletter Manager**. The current page now automatically resets to 1 when switching tabs, applying filters, or changing search queries, preventing "empty result" issues.
- **Universal Ad Standardization**: Implemented standard container dimensions (`md:max-w-[728px] min-h-[90px]`) for Header Ads across all themes (**TechPress**, **Prism**, **Corporate-Pro**, **Digest**, **Default**) to prevent compression and layout shifts.
- **Responsive Popup Ads**: Optimized Popup Ad containers across all themes to be fully responsive (`max-w-[95vw] md:max-w-2xl`), ensuring compatibility with Google Responsive Ad Units.

### Build & Release

- **Environment Parity**: Full audit and verification of the build pipeline (`tsc`, `prettier`, `vite`).
- **Release Automation**: Updated release packaging engine for v1.11.7.

### [v1.11.6] - 2026-02-08 (Infrastructure Hardening & Stability)

This release introduces **Absolute Path Standardisation** across the entire core engine (66+ files), ensuring 100% path resolution consistency. This upgrade provides maximum stability for environments with complex symlinks or shared hosting architectures.

### Infrastructure & Stability

- **Absolute Path Standardisation**: Every core component has been upgraded to use `__DIR__` based pathing for all internal inclusions. This eliminates configuration resolution issues across diverse server topologies.
- **Integrity Radar Integration**: Full synchronisation with the **Integrity System**. The built-in "Hammer Fix" now covers 100% of the hardened API layer to ensure zero-downtime recovery.
- **Consistent Resolution**: Standardised the internal inclusion chain (Security -> Configuration -> Logic) into a single unified GPS pattern, preventing session and metadata resolution errors.

### SEO & Performance

- **IndexNow Powerhouse**: Verified and hardened the **IndexNow** async ping architecture. Search engine notification is now more resilient and optimized for peak performance.
- **Open Graph Precision**: Hardened the SEO engine's URL construction logic to ensure clean, 100% accurate canonical and `og:image` tags without path regressions.

### Quality Control

- **Quality Control**: Successfully underwent a full security and logic hardening audit focused on the hardened infrastructure.
- **Workflow Standardization**: Formally integrated "Absolute Pathing" into the official developer workflow for all future iterations.

### Theme & UI Polish

- **TechPress Layout Optimization**:
  - **Trending Stories**: Increased extraction count from 3 to **4 stories**.
  - **Grid Balance**: Adjusted layout to a 2x2 grid on Tablets (`md:grid-cols-2`) and a 1x4 grid on Desktop (`lg:grid-cols-4`) to eliminate visual gaps.

  - -

### [v1.11.5] - 2026-02-08 (Stability & Pathing Refinement - LEGACY)

### API Path Stability (Reverted to v1.11.3 Style)

- **Relative Path Reversion**: Audited and stabilized **66 API files** by reverting `__DIR__` based inclusions to relative paths (`require_once '../security.php'`).
- **Stability Fix**: Resolves "Session Kick-out" and 500 errors on cPanel/Shared Hosting (Symlink-sensitive) environments.
- **Full Coverage**: Standardized all sub-folders: `contact/`, `security/`, `system/`, and `tools/`.
- **Router Fix**: Patched `public/api.php` to ensure consistent path resolution across all endpoints.
- **500 Internal Error (General Settings)**: Fixed a critical pathing conflict when `api.php` calls `save_settings.php` by standardizing all inclusions using `__DIR__`.
- **403 Forbidden (DB Status)**: Corrected the endpoint mapping for `checkDbStatus` in `site.config.ts`, ensuring it points to the lightweight `system/check_db_status.php`.
- **Double Slash Prevention**: Verified `rtrim()` protection in `upload_file.php` prevents `//uploads/` path issues.

### New Features

- **Logo Toggle System**: Added "Use Logo as Title" option in General Settings.
- **Smart Visibility**: Hides Site Title and Description when enabled for a clean branded look.
- **Google Services Hub**: Centralized Search Console, Analytics, and AdSense into a "Google Services" tab.
- **Verification**: Added direct Search Console HTML tag injection.

### Social Sharing & SEO (Fully Verified)

- **Facebook 403 Fix (VVIP Lane)**: Confirmed L12-19 of `.htaccess` allows social bots to bypass security checks for image fetching.
- **OG Square Support**: Integrated `og:image:square` support in `index.php` for better previews on specific platforms.
- **Absolute URLs**: Forced `domain_url` prefixing for all `og:image` tags to ensure reliability.
- **Install Template Sync**: Verified `install.php` generates the exact same high-performance `.htaccess` for fresh installs.

### Technical Verification

- **Files Audited**: 66 API files, `index.php`, `.htaccess`, `install.php`.
- **Error Reference Manual**: Restructured into a searchable "Manual Book" format with unique error codes (`V-500-INC`, `V-403-GUARD`, etc.) for faster troubleshooting.
- **Build**: TypeScript | Prettier | Audit (0 vulnerabilities)
- **Stability**: Confirmed clean sessions on simulated cPanel environments.

---

### [v1.11.4] - 2026-02-05 (Security & Protocol-Safety Release)

This update marks a complete overhaul of the CMS's protocol-awareness and security, resolving complex "Mixed Content" and "Broken HTTPS" warnings across diverse hosting environments (cPanel, Cloudflare, XAMPP).

### Critical Security & HTTPS Hardening

- **Smart Protocol Detection (is_https)**: Implemented a robust, proxy-aware detection engine. It correctly identifies SSL status even behind Load Balancers or Reverse Proxies by validating `X-Forwarded-Proto` and `HTTPS` server variables.
- **Dynamic URL Upgrading (scrubUrl)**: Introduced `ResponseHelper::scrubUrl()`. This intelligent middleware dynamically upgrades `http://` links to `https://` **only when the site is accessed via SSL**. This prevents "Mixed Content" warnings without breaking local development (`http://localhost`).
- **Global Security Headers**: Standardised `sendApiHeaders()` and `is_https()` availability across all entry points (Sitemaps, Robots, API).
- **Session Persistence**: Fixed issue where `Secure` cookies prevented login on HTTP connections, while ensuring strict security on HTTPS.
- **Force HTTPS**: Updated `.htaccess` with **Proxy-Aware** logic to safely redirect traffic without loops.

### Global Path Standardisation

- **Protocol-Agnostic Sitemap**: `sitemap.php` and `IndexNow.php` now generate absolute URLs that dynamically match the current access protocol.
- **Secure Auth URLs**: Reset links and Email Verification tokens now use `SCRIPT_NAME` and `is_https()` for 100% path accuracy on subfolders and SSL.
- **Double-Slash Sanitization**: Hardened `vonFetch` and `upload_file.php` to prevent malformed URL construction (`//api/` -> `/api/`) that previously caused `ERR_EMPTY_RESPONSE`.

### Social & SEO Enhancements

- **Facebook Open Graph Fix**: `index.php` now generates **Absolute Canonical URLs** (using `domain_url`) for `og:image` and `og:url` tags, ensuring rich link previews work correctly on social media.
- **AdSense & Analytics Verification**: Patched `index.php` to correctly inject verification codes without path or variable issues ($siteName handling).
- **Dynamic Robots & Sitemap**: Hardened `robots.php` and `sitemap.php` to correctly include the security layer, preventing fatal errors on SSL-enabled sites.

### System Stability

- **Logic & Syntax Hardening**: Conducted a comprehensive brace and variable audit of `index.php` to eliminate "Blank Screen" (500) errors and orphaned logic blocks.
- **Localhost Compatibility**: SSL enforcement logic is automatically bypassed on `localhost` to ensure a smooth development experience.
- **Quality Assurance**: Successfully completed the final Security & Logic Quality Assurance (QA) cycle for all modified files.

---

### [v1.11.3] - 2026-02-04 (Integrity Release) - INSTANT INDEXING (INDEXNOW)

### Hotfixes (Feb 4)

- **Fix (Backend)**: Added missing database retrieval logic for `IndexNow` settings and mappings for `analytics`.
- **Fix (System)**: Implemented auto-cleanup for IndexNow verification files (`.txt`) to prevent root directory clutter.
- **Fix (Frontend)**: Moved Cookie Banner to frontend only (Was appearing in Admin).
- **Fix (App)**: Implemented Async/Await Save logic to prevent race conditions.

### IndexNow Integration (New Feature)

- **Instant Indexing**: Automatically notifies Bing, Yandex, and 1000+ other search engines whenever you publish or update content.
- **Backend**: New `IndexNow` class (`public/api/system/IndexNow.php`) handles key generation, validation, and batch pinging.
- **Auto-Ping**: `save_post.php` now triggers a non-blocking ping immediately after a post is published.
- **Admin UI**: New "IndexNow" section in **SEO Settings**.
- **One-Click Setup**: Generate API key and verification file automatically.
- **Status Dashboard**: See real-time status of API key and verification file.
- **Manual Ping**: Test button to ping homepage instantly.

### Analytics & Privacy (New Feature)

- **GA4 Injection**: Native Google Analytics 4 integration. Automatically loads `gtag.js` if an ID is provided.
- **Privacy Hardening**: Added strict Regex validation for GA IDs to prevent XSS via settings.
- **GDPR Compliance**: Built-in **Cookie Consent Banner**. Tracking is strictly blocked until user grants consent.
- **IP Anonymization**: Supports `anonymize_ip` flag for global privacy standards.

### User Management & Scaling

- **Increased Capacity**: Backend user fetch limit increased from 50 to **1000** (Max 2000) to support larger teams.
- **Verified Pagination**: Confirmed client-side pagination in User Manager.

### Compatibility & Security

- **OTA Safe**: Auto-ping logic is wrapped in `try-catch` blocks to prevent blocking post saves on older environments.
- **Performance**: Uses `curl` with strict 3-second timeout to ensure the Admin UI remains snappy even if Bing is down.
- **Type Safety**: Fixed TypeScript conflicts in `AnalyticsInjector` and `VonProviders`.
- **Prettier**: Codebase-wide formatting pass for clean source code.

### Stability & UX Polish (Feb 4 - Final)

- **Redirect Engine Integration**: Moved redirect logic from fragile `.htaccess` rules directly into `index.php` (Root & Public). This ensures redirects work on all hosting environments (Apache/Nginx/IIS) without "White Screen of Death" risks.
- **Opt-In Performance Mode**: Reverted `.htaccess` rules to commented-out state. Advanced users can uncomment for high-performance C-level redirects, but default is now "Safe Mode".
- **Remember Me**: Added "Remember Me" checkbox to Login UI. Extends session lifetime to **30 Days** when checked (Default: Session-only).
- **Public Index Sync**: Synced redirect logic to `public/index.php` so shared hosting setups (cPanel) benefit from the same robust redirect engine.
- **IndexNow Hardening**: Added auto-cleanup for verification files `.txt`. System now self-cleaning when keys are regenerated.
- **Quality Assurance**: Successfully completed the final Security & Logic Quality Assurance (QA) cycle for new features (SQL/XSS/CSRF).

---

> [!IMPORTANT]
> **DATABASE UPDATE REQUIRED**
> After updating, you **MUST** go to **Admin > System > Repair Database**.
> Until you do this, new features like **Redirect Manager** and **Smart Slug Protection** will **NOT WORK** (they will fail silently to prevent crashes).

### Redirect Manager (New Feature)

- **301 Redirect Engine**: High-performance server-side redirect handler (`redirect_engine.php`) that runs BEFORE the SPA boots.
- **Admin UI**: Full CRUD interface integrated into VonSEO Settings Redirects tab.
- **Hit Counter**: Track redirect usage for analytics and cleanup.
- **Smart Slug Protection**: Automatically creates 301 redirects when post slugs are changed to prevent broken links.

### Custom Category Permalinks (New Feature)

- **New URL Structure**: Added `/%category%/%slug%/` permalink option.
- **Settings UI**: New "Category & Name" option in Permalink Settings.
- **Frontend Hotfix**: Added routing support for `/:category/:slug` pattern.

### UI/UX Improvements

- **VonSEO Settings**: Expanded modal width (`max-w-5xl`) with new Redirects tab.
- **VonAnalytics Settings**: Expanded modal width (`max-w-4xl`).
- **Automated Content Analysis Redesign**: Premium card-based UI with gradient header and violet/purple numbered badges.

### Theme & UI Standardization

- **Navigation Overflow**: Implemented consistent "More" dropdown for navigation menus with > 5 items. Fixed `Corporate-Pro` theme.
- **Unified Pagination**: Standardized default items-per-page to **6** across all themes (adjusted `Digest` from 12) and Admin Extensions Manager (adjusted from 10).

### Security & Integrity Hotfixes (Feb 2)

- **Installation Enforcer**: Fixed critical redirect loophole in `index.php` that allowed access to nested paths (e.g., `/install/install`) on unconfigured sites.
- **Fresh Install Schema**: Updated `install.php` to include `media` metadata columns (`alt_text`, `caption`) by default, preventing false "Repair Database" warnings.
- **SQL Injection**: Fixed parameterization of LIMIT/OFFSET in `list_redirects.php`.
- **Open Redirect Hardening**: Improved target URL validation in `redirect_engine.php` to block `//` prefix attacks.
- **Subfolder Support**: Redirect Engine now auto-detects installation path (e.g. `/cms/`) and handles links correctly.
- **OTA Hardening**: `save_post.php` now safely handles missing `redirects` table (prevents post-update WSOD).

### Notes

- **Hammer Fix (Integrity Radar)**: Included since v1.11.1. If your site breaks after update, use `fix_integrity.php`.
- **Redirect Engine**: Available as `redirect_engine.php` but NOT auto-enabled in .htaccess (opt-in only).
- **Database**: Run "Repair Database" to create the `redirects` table (Auto-included for new installs).

---

## v1.11.1 (2026-02-02) - THEME SDK & PRIVACY SYNC

### Iron-Clad Session Security (v1.11.1 Overhaul)

- **Centralized Session Engine**: Consistently managed via `security.php`. Standardized secure cookie parameters (`Secure`, `HttpOnly`, `SameSite: Strict`).
- **Anti-Hijacking (UA Binding)**: Implemented session-to-identity binding using User-Agent hashing to prevent session stealing.
- **Anti-Fixation Protection**: Forced session regeneration (`session_regenerate_id`) during login and registration.
- **Auto-Handshake**: Harmonized include order in `api.php` and `index.php` to prioritize security headers before configuration load.

### Integrity Radar (New System Feature)

- **Proactive Monitoring**: System now automatically scans for missing or damaged `.htaccess` files and security shields.
- **Dashboard Alerts**: Real-time "Integrity Warning" toast in the Admin Dashboard with a one-click **"Hammer Fix"** button.
- **Emergency Bypass**: Added a safe `fix.flag` mechanism for `fix_integrity.php` to allow recovery even if admin access is lost (e.g., "Hello Universe" fallback).
- **Auto-Cleanup**: Emergency flags are automatically securely deleted after a successful repair.

### Theme SDK & System Stability

- **Standardized Imports**: Introduced `src/themes/shared` (Theme SDK). All themes now use a unified entry point for hooks, components, and utilities.
- **Fix (Security)**: Simplified `install.php` generation to prevent redundant session configuration in user files.
- **Fix (Updater)**: Resolved property syntax regression in `updater.php`.
- **Fix (Database)**: Implemented `FOR UPDATE` locking in `save_page.php` for concurrency-safe slug generation.

### Final Release Audit

- **Final Verification Cycle**: Successfully completed the final security and stability verification cycle for session security and integrity features.
- **Verified**: 100% compliance with `vonFetch` standards and role-based authorization.

---

## v1.11.0 "Nara" (2026-01-31) - MEDIA METADATA & SECURITY POLISH

### Media Intelligence (New Feature)

> [!IMPORTANT]
> **Database Sync Required**: After updating to v1.11.0, please go to **Admin > System > Repair Database** to automatically add the new metadata columns to your library.

- **Media Metadata**: Added full support for **Alt Text**, **Captions**, and **Descriptions** for all media assets.
- **Editor Integration**:
  - **Inline Editing**: Double-click images or use the new "Bubble Menu" to edit Alt Text directly in the post editor.
  - **Alignment Controls**: Added Left/Center/Right alignment buttons to the image context menu.
  - **SEO Sync**: SEO Analyzer now correctly reads Alt Text from images for accurate scoring.

### Release Quality & Security (Jan 31)

- **Gold Version (Final)**: System stabilized and certified for production.
- **Improved**: **"Smart Lookup"** implemented in `update_media.php`. Metadata now syncs back to the Gallery even for legacy images and subdirectory installations (e.g. `/portalkini/`).
- **Fix**: Resolved "Bubble Menu" disappearance issue in `Editor.tsx` by removing conflicting selection listeners.
- **Fix**: Restored database connectivity in `list_media.php` for persistent metadata retrieval.
- **Improvement**: Added default Alt Text and Caption (derived from filename) during file upload to ensure SEO-friendly library.
- **Security**: Added strict numeric ID validation and path-based fallback security in `update_media.php`.
- **Audit Passed**: Successfully completed standardized security and API protocol reviews.

### Hotfix (Media API Improvement)

- **Media API Fix**: Resolved JSON syntax error in `list_media.php` and auth check in `update_media.php`.
- **Verified**: Metadata (Alt/Caption) editing is fully functional.

### Major Release: Nara Series

- **New Versioning**: Officially upgraded to v1.11.x series.
- **System Stability**: Consolidated fixes from the endpoint of Solana (v1.10.x) series.
- **Ready for Roadmap**: Foundation laid for Advanced Search and VonSEO 2.0.

### Maintenance

- **Version Clean Sweep**: Updated all internal version references to 1.11.0.

---

## v1.10.11 (2026-01-28) - OTA INTEGRITY HOTFIX

### Critical Action Required (If Site Crashes)

> [!IMPORTANT]
> **Did your site revert to "Hello Universe" after updating?**
>
> This is expected for some users updating from **v1.10.9 or older** because the old updater fails to update the security config file (`.htaccess`).
>
> **How to Fix (One-Click):**
>
> 1. Visit: `https://yoursite.com/api/system/fix_integrity.php` (Login as Admin first)
> 2. The script will automatically repair your configuration.
> 3. Your site will instantly return to normal.
> 4. **Optional:** Once fixed, you may safely delete the `public/api/system/fix_integrity.php` file from your server.
>
> **If the script fails (Manual Force Update):**
>
> 1. Delete your `/assets` folder manually.
> 2. Upload the **new v1.10.11 zip file**.
> 3. Extract and overwrite everything.

### What's Fixed

- **Updater Logic**: The OTA updater now **forces overwrite of .htaccess** to ensure system integrity for all future updates.
- **Self-Healing Tool**: Included `/api/system/fix_integrity.php` as a permanent recovery tool.
- Note: This update automatically replaces your root `.htaccess` with the secure v1.10.10 standard. **Custom rules will be reset.**

## v1.10.10 (2026-01-28) - THE GOLDEN RELEASE (SOLANA SERIES)

### Enterprise-Grade API Synchronization (Total Overhaul)

- **Unified Fetch Logic**: Standardized **78+ API interaction points** across the entire platform using the new `vonFetch` utility.
- **Security Backbone**: Implemented automatic CSRF token injection and strict credential management (`credentials: 'include'`) for all internal requests.
- **Legacy Cleanup**: Purged redundant security header constructions and raw `fetch()` calls from core modules (Posts, Pages, Analytics, settings, etc.).
- **Feature Standardization**: Migrated high-impact administrative tools including the **WordPress Migrator**, **Database Manager**, and **Security Dashboard** to the synchronized layer.
- **Zero-Trust Audit**: Successfully achieved 100% compliance in a global security audit, ensuring no unsynchronized communication channels remain.

### Critical Security Patch (Jan 28) - Sync Required

> [!IMPORTANT]
> **Action Required for Existing Users:** Because the OTA update system protects `.htaccess` from being overwritten to preserve custom rules, existing users must manually sync the new security hardening.
>
> **Patch Instructions:**
> Overwrite these three files in your installation with the versions from the **v1.10.10 Release Package** to immediately apply the new safety baseline:
>
> 1. `/.htaccess` (Root)
> 2. `/public/.htaccess` (Public Folder)
> 3. `/public/uploads/.htaccess` (Media Folder - **Critical for RCE Prevention**)
>
> **The v1.10.10 Security Baseline Includes:**
>
> - **Unified Header Guard**: Implements `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.
> - **Zero-Exposure Policy**: Disables directory listing (`Options -Indexes`) globally.
> - **Package Protection**: Blocks direct HTTP access to sensitive extensions (`.sql`, `.env`, `.zip`, `.log`).
> - **Media Lockdown**: Prevents script execution (RCE) in the `public/uploads/` directory.

- **Stored XSS Remediation**: Specifically patched a **Critical Vulnerability** involving SVG uploads.
- **Action**: Removed `image/svg+xml` from the allowed whitelist in the File Upload API.
- **Reason**: SVG files can harbor executable JavaScript (`<script>` context) which triggers XSS when viewed directly.
- **Result**: System now strictly accepts only safe raster images (JPG, PNG, GIF, WEBP).
- **Hardened .htaccess Suite**:
  - **Clickjacking & MIME Protection**: Integrated standard security headers globally.
  - **Directory Privacy**: Disabled directory indexing (`Options -Indexes`) to prevent information leakage.
  - **Package Protection**: Blocked public access to `.zip` files via `.htaccess` (protects release packages).
  - **RCE Prevention**: Created `uploads/.htaccess` to strictly deny PHP/script execution in the media folder.
  - **Installer Synchronization**: Updated `install.php` to ensure new installations inherit all 1.10.10+ security hardening by default.
  - **Stress Testing Verification**: Conducted comprehensive 50-User Concurrency Flood test (99.95% Success Rate).

### Administrative Interface (UI/UX)

- **Vibrant Admin Sidebar**: Replaced flat gray icons with a curated, colorful palette (Sky Blue, Emerald, Indigo, etc.) for better visual hierarchy and scannability.
- **Enhanced Visual Scannability**: Changed the **Pages** icon to `FileStack` to distinguish it from the **Posts** icon (`FileText`).
- **Dashboard Synchronization**: Modernized the Admin Dashboard with colorful statistic cards matching the new sidebar theme.
- **Atomic Statistics**: Split the "Total Content" stat into independent **"Articles"** and **"Pages"** counters for more granular data visibility.
- **Hardened Styling**: Implemented HEX-based inline styling for navigation icons to ensure visual consistency across all browser and cache environments.
- **Visual Pulse (NProgress)**: Integrated lightweight loading bars (`nprogress`) for all route transitions. Provides immediate visual feedback during page loads, enhancing the perception of speed and "aliveness."

### Contact Form Architecture (Security & Pulse)

- **Database Separation**: Moved Contact Forms from a "JSON Blob" in the settings table to dedicated SQL tables (`contact_forms`).
- **Lead Storage**: Implemented `contact_submissions` table to permanently store all submitted messages (leads). messages are no longer email-only, preventing data loss if mail servers fail.
- **Settings Stability**: Fixed the critical "Settings Reset" issue caused by oversized form data overloading the general settings recovery logic.
- **Migration Engine**: Added a "One-Click Migrate" tool to the Contact Manager to move existing forms to the new high-performance table structure.
- **API Repair**: Fixed "Failed to load contact forms" by restoring missing `von_config.php` dependency across all specialized contact endpoints.

### Stability & Loop Prevention

- **Preflight Optimization**: Fixed critical logic inversion in `login.php`. CORS Preflight `OPTIONS` requests now exit early before method restrictions are applied, resolving infinite retry loops in the frontend.
- **Structural Symmetry**: Standardized 60+ API endpoints to a unified structural baseline (Preflight Security Config), restoring the "Aman Damai" stability of v1.10.9 while preserving next-gen features.
- **Monolithic Tracking**: Consolidated `track_visit.php` and `track_view.php` into a single high-efficiency `track_monolithic.php`. Reduces server CPU load and database connection overhead by 50% per page load.
- **Google Sitelinks Searchbox**: Enhanced **VonSEO** with `SearchAction` JSON-LD schema, enabling Google to display a dedicated search box for your site in search results.
- **Global Settings Expansion**:
  - **Membership Control**: Added "Anyone can register" toggle to enable/disable public registrations.
  - **SMTP Engine**: Integrated full SMTP configuration (Host, Port, Encryption, Auth) for reliable email delivery.
  - **Localization**: Added Timezone selection and Domain URL configuration for accurate logging and link generation.

### System-Wide Modernization

- **Version Synchronization**: Unified all legacy version references (v1.6, v1.8, etc.) across the entire codebase to **v1.10.10**.
- **Thematic Consistency**: All built-in Themes (Default, Prism, TechPress, Digest, Portfolio) and Plugins are now explicitly versioned to match the core engine.
- **Hardened API Headers**: Modernized information headers in `repair_db.php`, `install.php`, and `track_visit.php`.

### Security Hardening

- **Output Masking**: Integrated `ResponseHelper::sendError()` across all new endpoints for standardized, secure error reporting (hides details from public, logs for admins).
- **Input Sanitization**: Hardened form management logic with robust `sanitize_input()` filtering.
- **CSRF Enforcement**: Verified and enforced strict token validation for all destructive operations in the new contact management system.

### Media Library Integration (Editor)

- **Direct Selection**: Integrated Media Library directly into the WYSIWYG Editor.
- **Workflow**: Added `FolderOpen` button to toolbar. Users can now select existing images from the library without copying URLs.
- **Picker Mode**: Updated `MediaManager` to support `onSelect` prop for modal usage.

### UI Visibility & Theme Compatibility

- **Hardened Branding**: Applied explicit `!text-white` overrides to Dashboard and Installer headings.
- **Fix**: Prevents "invisible/sunken" text caused by global heading styles conflicting with dark-themed components in Light Mode.

---

## v1.10.9 (2026-01-23) - SYSTEM STABILITY & SECURITY HARDENING

### Critical Security Hardening & Data Integrity

- **CSRF Protection**: Implemented strict token validation on AI API endpoints (`ai_check.php`, `ai_generate.php`) preventing cross-site Request Forgery.
- **XSS Sanitization (Frontend)**: Applied comprehensive DOMPurify sanitization to all content renderers (`ContentRenderer`, `ContactFormRenderer`) and theme components, including a specific fix for the `TechPress` AdBlock renderer.
- **Synchronized Secure Headers**: Refactored AI services to utilize unified secure header propagation, ensuring CSRF tokens are consistently delivered.
- **Optimized Metadata Filtering**: Refined server-side object scrubbing to strictly limit configuration exposure during public-state calls.
- **Input Processing Normalization**: Standardized credential handling logic to ensure total data persistence across diverse character sets.
- **Unified Request Validation**: Consolidated administrative endpoints with the core system's secure request verification standards.

### Editorial Intelligence & Stability

- **Diagnostic Content Analysis**: Integrated a high-performance diagnostic engine for real-time editorial refinement (AI-driven).
- **Distributed Model Optimization**: Implementation of a dual-tier processing architecture for enhanced stability and quota reliability.
- **Hybrid Core Stabilization**: Restored legacy architectural patterns to resolve identified UI state inconsistencies while preserving next-gen functionality.

### Architectural Refinement

- **Universal Path Resolution**: Enhanced dynamic environment mapping to ensure seamless operation across various server topologies and subfolder deployments.
- **Standardized Execution Path**: Purged experimental logic to restore the core engine to a lean, high-reliability execution path.
- **Interface Verbosity Adjustment**: Fine-tuned client-side logging and suppressed non-critical system warnings for improved workspace clarity.

---

## v1.10.7 "Solana/Pre-release" - UI POLISH & UPDATER FIX

### Theme & UI Polish

- **Default Theme**: Fixed Footer Logo issue where it was hardcoded. It now dynamically checks `settings.logoUrl` to match the Header logo, falling back to the default Von Logo only if unset.
- **Login Modal**: Increased modal width (`max-w-md` `max-w-lg`) for better readability and input spacing on desktop screens.
- **Form Accessibility**:
  - Added `id` and `name` attributes to Search inputs across all themes (Default, TechPress, Prism, Digest) to resolve browser warnings.
  - Added `autoComplete` attributes to Newsletter and Comment forms for better autofill support.
  - **TechPress Ads**: Optimized In-Feed Ad frequency from every 3 posts to every 6 posts for better reading experience.

### Core Stability

- **Updater Hardening**: Fixed SSL verification issue in `updater.php`. Now correctly detects XAMPP/Localhost environments to prevent SSL certificate errors during local testing, while strictly enforcing SSL on production.

---

### Scalability & Performance (100K+ Posts)

- **Server-Side Search**:
  - Added `?search=keyword` parameter to `get_posts.php` with prepared statements.
  - Searches title, excerpt, content, and category.
  - Implemented `useServerSearch` hook for scalable search.
  - **Digest Theme**: Hybrid search implementation (Client-side instant + Server-side on Enter).
- **Backend Optimization**:
  - **Category Filtering**: Added `?category=` parameter to `get_posts.php` for server-side filtering.
  - **Scalability Indexes**: Integrated index creation into **Repair Database** tool. No manual queries required.
- **Sitemap Index**:
  - Rewrote `sitemap.php` to use Sitemap Index architecture.
  - Automatically chunks posts into multiple sitemaps (50,000 URLs limit per file).
  - Supports `/sitemap.xml?type=posts&page=X` structure.
  - Fixes memory issues when generating sitemaps for large datasets.

### Critical Security Hardening

- **Enhanced Error Handling**: Updated API response logic to implement standardized error masking strategies, preventing potential information disclosure during server exceptions.
- **Data Sanitization**: Hardened system configuration endpoints to enforce strict output filtering and prevent inadvertent exposure of internal parameters.
- **Recovery Resilience**: Improved backup recovery logic to ensure consistent session handling during restoration procedures.
- **SSL Hardening**: Implemented Smart SSL Verification in `updater.php` (Auto-detects Localhost vs Production) to prevent Man-in-the-Middle attacks during updates.
- **UI UX Polish**: Increased Login Modal width (Medium Large) for better readability and input spacing.

### Critical Bug Fixes

- **Single Post Content**:
  - Fixed "Missing Content" issue caused by Slim Query optimization.
  - Implemented `useSinglePost` hook to fetch full content on demand.
- **Tags Display**:
  - Added missing Tags/Keywords display to **Prism**, **Portfolio**, and **Corporate-Pro** themes.
  - **Quality Control Review**: Completed comprehensive codebase verification and regression testing.
  - **Opencode Comparison**: Verified superior security architecture compared to external "Sandbox" variants.

### Code Cleanup

- **Refactoring**:
  - Refactored `App.tsx` (reduced by ~60 lines) by moving logic to `useSinglePost`.
  - Removed unused variables (`totalResults`) in Digest theme.
  - Removed TODO comments in `useContent.ts`.

### Verified Performance Benchmark

- **Stress Test Results** (Localhost XAMPP, 100 concurrent):
- **7,300 requests** completed with **98.7% success rate**.
- **70ms average latency** per API response.
- **Peak RPS: 1,316** | **Sustained RPS: 521**.
- 67/73 batches (92%) stable before server resource exhaustion.

---

## v1.10.4 "Solana/Performance" (Pre-Planned Release) - PAGINATION UNIFIED

### Scalability & Performance

- **Backend Optimization (`get_posts.php`)**:
  - **Slim Query**: Removed heavy `content` field from list queries (payload reduced by ~95%).
  - **Hard Limits**: Enforced safe defaults (20 posts) and strict max cap (100 posts) to prevent server overload.
  - **Author Filter**: Added `?author=` parameter for efficient server-side profile filtering.
- **Frontend Scalability**:
  - **Independent Profile Fetching**: `UserProfile` now fetches its own data server-side, enabling unlimited history access (solved "empty profile" bug).
  - **Admin Dashboard**: Updated `useContent` to handle new API envelope `{ posts, meta }` correctly.

### Unified Pagination Strategy

- **Standardized "Load More"**: Replaced inconsistent numbered pagination and "View All" toggles with a unified "Load More" pattern across ALL themes and profile components.
- **Affected Themes**:
  - **Corporate Pro**: Removed complex "View All" toggle; implemented clean Load More flow for Main Feed and User Profile.
  - **Portfolio**: Converted to shared `LoadMoreButton` logic (preserving custom styling).
  - **TechPress & UserProfile**: Fully converted to efficient client-side slicing + server data envelope.
  - **Code Cleanup**: Removed ~175 lines of duplicate pagination logic (`currentPage`, `totalPages`, `.slice` redundancy).

### Security & Stability

- **Multi-Layer Defensive Review**: Validated through a multi-layer security defense review (SQL Injection, XSS, CSRF, Access Control, Data Exposure, Business Logic).
- **Hardened API**: `get_posts.php` inputs (`page`, `limit`) are strictly cast to integers; uses PDO prepared statements.
- **Type Safety**: Passed strict TypeScript checks across all theme modifications.

### Components

- **LoadMoreButton**: Enhanced shared component to support `style` prop for theme-specific customizations (used by Portfolio).

---

## v1.10.3 "Solana/Patch" (2026-01-14) - MEDIA SETTINGS COMPLETE

### Media Optimization (Now Fully Functional)

- **WebP Conversion**: Images automatically converted to WebP format when enabled. Both original + WebP versions saved for browser fallback compatibility.
- **Image Compression**: Compression levels (Low/Medium/High) now correctly applied during upload.
- **Auto-Resize**: Images exceeding max dimensions are automatically resized while maintaining aspect ratio.
- **Settings Path Fix**: Fixed media optimization not reading settings (was looking at wrong JSON file path).

### CDN URL Support

- **CDN Prefix Logic**: When CDN URL is configured in Media Settings, all uploaded file URLs are automatically prefixed with the CDN domain.
- **Upload Response Enhanced**: Response now includes `cdnEnabled` flag and `webpUrl` when applicable.

### Lazy Loading (Now Functional)

- **Native Lazy Load**: `loading="lazy"` attribute automatically injected into `<img>` and `<iframe>` tags in post content.
- **Configurable**: Can be toggled on/off via Media Settings Performance.
- **Smart Injection**: Only applies to tags that don't already have the attribute.

### Bug Fixes

- **spamKeywords**: Fixed spam keywords not saving to database (was missing from save_settings.php mappings).
- **Type Sync**: Synchronized duplicate `types/index.ts` with main `types.ts` to prevent TypeScript confusion.

### Cleanup

- **S3/Cloudinary Removed**: Removed "Coming Soon" placeholder options from Storage Location dropdown. CDN URL field handles CDN delivery use case.

---

## v1.10.2 "Solana/Patch" (2026-01-13) - UX POLISH

### Navigation & UX

- **Scroll to Top**: Added `ScrollToTop` component that automatically scrolls to top when navigating between routes. No more stuck scroll positions when clicking Home or navigating to new pages.

### Session Management

- **Silent Session Kick**: Improved session expiry handling. When session expires after 30 minutes of inactivity:
- Admin users are silently redirected to home (no scary error messages)
- Public users viewing content are gracefully logged out and page reloads
- **Loop Prevention**: Fixed infinite reload bug when already on login page
- **Clean Logout Flow**: Removed confusing "Session Expired" messages for a smoother UX.
- **Login Route Guard**: Logged-in users accessing `/login` are now auto-redirected to home instead of seeing the login form.

### Bug Fixes

- **Edit Profile Button Fix**: Fixed issue where Member/Writer users couldn't see "Edit Profile" button. Root cause: Public API previously omitted `user.id` for strict privacy, causing frontend permission checks to fail. Fix: Safely exposed `id` in `get_public_profile.php` (non-sensitive public data) to restore self-edit functionality for non-admins.

---

## v1.10.1 "Solana/Patch" (2026-01-11) - VISUAL STABILITY & SECURITY

### Visual Stability

- **Skeleton Loader Fix**: Resolved a regression where the loading skeleton would disappear prematurely, causing a "Flash of Unstyled Content" (FOUC). The loader now persists smoothly until all core data is ready.
- **Clean Transitions**: Optimized the initial loading state to ensure a seamless transition from index to dashboard.

### Security Hardening

- **Security Dashboard Integration**: Added `/admin/security` route with a comprehensive visual dashboard (`Live Monitoring`, `Auto-Purge`, `Login Monitoring`).
- **Startup Protection**: Patched an initialization logic issue that could trigger a false-positive `403 Forbidden` error for guest users.
- **Context-Aware CORS**: Validated and secured Cross-Origin policies to strictly whitelist allowed environments (Mobile App / Dev) while rejecting unauthorized external access.
- **CSRF Enforcement**: Verified strict token validation across all write operations.

### Deployment Hotfix

- **"White Page" Fix**: Resolved `Uncaught TypeError: Failed to resolve module specifier "prop-types"` by explicitly adding `prop-types` to `package.json`. This fixed a transitive dependency issue caused by `react-gravatar` in production builds.

### Security Dashboard (Full Integration)

- **Dedicated Dashboard**: Added `/admin/security` route with a comprehensive visual dashboard (`SecurityDashboard`).
- **Live Monitoring**: Real-time charts for Security Events (Line), Severity Breakdown (Pie), and Top IP Offenders (Bar).
- **Auto-Purge**: Implemented intelligent probabilistic auto-purge (10% chance) to delete logs older than 30 days during insertions, preventing database bloat.
- **Deep Integration**:
  - **Login Monitoring**: Failed login attempts are now auto-logged with 'medium' severity.
  - **Honeypot**: Captures suspicious bot activity on forms.
  - **Admin Menu**: Added direct access via Admin Sidebar > Security.

  - -

## v1.10.0 "Solana" (2026-01-09) - THE "AUTO-UPDATE" ERA

### One-Click OTA Updates

### One-Click OTA Updates

- **GitHub-Powered Updates**: Introduced seamless Over-The-Air (OTA) updates directly from GitHub Releases. Admins can now update VonCMS with a single click from the Dashboard.
- **Smart Version Detection**: Automatic semantic version comparison ensures updates only proceed when a newer version is available.
- **Secure Download**: Updates are whitelisted to GitHub domains only (`github.com`, `api.github.com`, `codeload.github.com`), with HTTPS enforcement.
- **Protected Files**: Critical files (`von_config.php`, `uploads/`, `.htaccess`, `.env`) are automatically excluded from updates.
- **Backup System**: Auto-creates backup before each update for rollback capability.

### Premium Update UI

- **Update Modal**: Beautiful modal with amber/orange gradient, step-by-step progress indicators, and real-time server logs.
- **Progress Bar**: WP Bridge-style progress bar showing download and installation status (Step 1/4, 2/4...).
- **Toast Notifications**: Success/error toasts using `react-hot-toast` for immediate feedback.
- **Dark Mode Ready**: Full dark mode support for Update Modal and Dashboard banner.

### Security Hardening

- **Admin-Only Access**: Update system strictly enforces `SessionManager` + Admin role check.
- **CSRF Protection**: Token validation on all update operations prevents cross-site attacks.
- **XSS Fix** (from v1.9.9): Non-admin users cannot inject malicious scripts into post content.

### Release Script Enhancement

- **Package.json Included**: `create_release.cjs` now includes `package.json` in Deploy zip for proper version detection.

---

## v1.9.9 (2026-01-08) - POLISH & AUDIT SESSION

### Security Patch

- **Content Sanitization**: Enhanced content filtering for non-admin users to ensure only safe HTML is saved. Admins retain full HTML access.

### Password UX Standardization

- **Consistent Error Messages**: Standardized password validation toast messages across 5 themes (TechPress, Prism, Corporate Pro, Portfolio, Digest) to show `"Password too weak (8+ chars, Upper, Number, Symbol)"`.
- **Helpful Placeholders**: Updated password input placeholders from generic `"New password"` to `"8+ chars, Upper, Number, Symbol"` for better UX guidance.
- **Install Wizard Verified**: Confirmed Install Wizard (`InstallWizard.tsx` & `install.php`) remains untouched and fully functional.

### Source Code Optimization

- **Workflow Image Removed**: Replaced 814KB PNG workflow diagram with Mermaid text diagram in `.agent/workflows/dev-workflow.md`, reducing source package size by ~800KB.
- **Release Package**: Source zip now 0.53MB (down from 1.31MB).

### Von Designer v1.10.1 Audit

- **Quality Review**: Reviewed Von Designer prototype, documented existing features (drag-drop, undo/redo, responsive viewports) and identified specialized requirements for inline text editing, multi-select, and visual guides.
- **Developer Documentation**: Created comprehensive internal documentation to continue Von Designer development.

---

## v1.9.9 (2026-01-07) - THE "INTELLIGENCE" UPDATE

### Security Hardening

- **CSRF Protection**: Strengthened token validation on the Profile Update endpoint for improved request authenticity verification.
- **Error Masking**: Implemented "Silent Fail" error handling in the API. Database errors (SQLState) are now logged internally to server logs but return a generic "Internal Error" to the client, preventing SQL Structure Disclosure.
- **Rate Limiter Fix**: Corrected a pathing issue in the Rate Limiter storage configuration, ensuring brute-force protection persists correctly across requests.

### AI Summary Plugin

- **Automated Summaries**: Introduced a powerful AI-driven summary engine that generates concise bullet points for long articles.
- **Smart Extraction**: Features "Paragraph Mode" (first few sentences) and "KEYWORD Mode" (for density) extraction methods.
- **Theme Integration**: Seamlessly injected into all 6 themes (Default, Digest, Portfolio, Corporate Pro, TechPress, Prism), appearing below the featured image.
- **Dark Mode Ready**: Fully styled with `dark:` classes to look premium in both Light and Dark modes.

### Related Posts Engine

- **Content Discovery**: Added a "Related Posts" engine that matches content based on tags, categories, or title similarity.
- **Flexible Layouts**: Supports Grid, List, and Card layouts to match any theme aesthetic.
- **Visual Enhancement**: Automatically displays tthumbnails and excerpts to increase user engagement.
- **Quality Assurance**: PASSED (Comprehensive 6-Layer Security Review covers API, CSRF, Role, SQLi, XSS, and Installer).
- **Security Hardening**: Implemented session regeneration on login to prevent session fixation.
- **Security Hardening**: Critical honeypot triggers are now prioritized in the Security Dashboard.
- **UI Fix:** Fixed Corporate Pro Settings tab sizing consistency.

### Theme #6: Corporate Pro

- **Official Release**: Included the new **Corporate Pro** theme in the core package.
- **Features**: A professional, business-oriented layout with clean lines, dedicated service sections, and plugin compatibility out of the box.

### Core Polish

- **Universal Injection**: Refactored `Layout.tsx` and specific view components (`SinglePostView`, `SingleProject`) in **Default**, **Portfolio**, **Digest**, and others to accept plugin hooks safely.
- **Type Safety**: Resolved complex TypeScript circular dependency and scope issues in `PublicSite.tsx` and theme layouts.
- **Quality Assurance Review**:
  - **Security**: Validated hook outputs against potential XSS.
  - **Performance**: Verified zero impact on initial load performance.
  - **Build**: Achieved a clean zero-error production build.

  - -

## v1.9.8 (2026-01-04) - THE "VISUAL" & "INSTALLER" UPDATE

### Advanced Image Processing System

- **Automatic Optimization**: Implemented seamless server-side resizing and compression for all new uploads using PHP GD Library.
- **Smart Compression**: Configured the **Internal Engine** to use intelligent compression (Level 6 PNG / 85% JPEG) ensuring 90% file size reduction with zero visual loss.
- **Tthumbnail Generation**: Added auto-generation of 300x300 tthumbnails for every upload, preparing the system for high-performance gallery views.

### Media Management Tools

- **Regenerate Tthumbnails**: Added a powerful utility (Tools Tab) to recursively scan and regenerate tthumbnails for the entire existing media library.
- **Performance**: Optimized for handling large libraries with thousands of images without interruption.
- **Cleanup Scanner**: Introduced a "Scan for Unused" tool that safely identifies orphaned files (files not linked in DB or Posts) to help reclaim disk space.

### Installation & Configuration

- **Enhanced Installer**: New installations now automatically generate an advanced **System Configuration File** with Secure Session Cookies, Error Logging, and Soft-Fail Database logic.
- **User-Friendly Error Page**: Implemented a professional static HTML error page ("Error establishing a database connection") that appears instantly if the database is down, replacing generic white screens.

### WP Bridge & Migration

- **Dual-Format XML Support**: Upgraded the **XML Scanner & Import Engine** to support both **Standard WordPress Export** (RSS/Namespaces) and **Generic XML Datasets** (Simple `<post>` tags). No more "0 posts found" on sanitized XMLs.
- **Smart Image Detection**: Implemented explicit detection for `<image>` tags in custom XMLs, treating them as Featured Images. Fallback logic still scans HTML content for `<img>` tags if no explicit tag exists.
- **Generic Category Support**: Enhanced importer to detect simple `<category>` tags in non-WordPress XML files, fixing metadata loss during generic imports.
- **Robust Parsing**: Removed strict dependency on `wp:` namespaces, allowing "Blind" scanning of non-compliant XML files while strictly maintaining XXE security protections.

### Security Hotfix (Jan 5)

- **Install Page Protection**: Fixed edge case where `/install` route was accessible when database connection failed but config file existed. Simplified logic to check file existence only, preventing potential reinstallation during DB maintenance/outages.

---

## v1.9.7 (2026-01-04) - DARK MODE & SEO POLISH

### Smart Dark Mode Sanitizer

- **Algorithmic Color Cleaning**: Implemented a "Smart Sanitizer" engine that mathematically detects and removes "Neutral" inline colors (Black, White, Dark Gray) from content upon saving.
- **Universal Fix**: Works for any source (MS Word, Google Docs) without relying on hardcoded blacklists. Preserves legitimate colors (Red, Blue) while ensuring text is readable in Dark Mode.

### Enhanced SEO System

- **Real-time Analysis**: Restored and improved SEO Analyzer with 0-100 scoring and live checklist.
- **Intelligent Keyword Extraction**: Auto-generate logic now prioritizes words from the **Title** (weighted 5x) over general content.

### Security & Hygiene

- **Backend Hardening**: Applied strict Admin Role checks to all new Media Tool endpoints.
- **XSS Protection**: Applied sanitization wrapper to Advertisement Blocks.
- **Clean Build**: Removed demo data (`samples` folder) and optimized release package size.

---

## v1.9.6 (2026-01-02) - SECURITY HARDENING

### Critical Security Fixes

- **Authorization Hardening**: Added ownership checks to critical API endpoints. Enhanced validation ensures proper access control on all resource operations.
- **Authorization Pattern**: Implemented consistent Owner/Admin validation checks before all UPDATE/DELETE operations.

### Comprehensive Security Review

- **Backend API**: Full review of all 45 API files for authentication, authorization, and CSRF protection.
- **Frontend React**: Verified XSS protection (DOMPurify), token storage (memory-only), no eval() usage.
- **Database**: Confirmed password hashing (BCRYPT), IP anonymization (SHA256), file access controls.
- **Functionality**: Deep scan of plugins, themes, settings, content, media, comments, newsletter, and contact forms.

### Release Script Fix

- **Exclusion Update**: Added `api_backup*` and `themes_backup*` to release script exclusions to prevent bloated zip files.

---

## v1.9.5 (2026-01-01) - THEME STANDARDIZATION & DEVELOPMENT STANDARDS

### Hook Refactoring

- **Shared Hooks**: Refactored `Digest`, `Prism`, and `Default` themes to use centralized logic hooks. Reduced code duplication by 40%.
- **Cleanup**: Removed redundant legacy logic for manual fetching and timeout handling across themes.

### Profile & Social

- **Discussion Tabs**: Implemented standard "Articles" vs "Discussion" tabs on User Profiles for **Digest**, **Prism**, and **Portfolio** themes.
- **Consistent Stats**: Added standardised user statistics (Joined Year, Posts Count, Comments Count) to Digest and Portfolio profiles.
- **Portfolio Fix**: Resolved bug where `comments` prop was not being passed to the Profile view, fixing the "No comments" issue.

### Navigation & UX

- **Pagination Reset (Universal)**: Implementing "Back to Home" now forces a hard reset to **Page 1** across all 5 themes (Default, Digest, Portfolio, Prism, TechPress). Prevents users from getting stuck on "Page 2" when navigating home.
- **Profile Pagination Fix**: Applied unique React keys to Profile components to ensure pagination state resets when switching between different user profiles.
- **Friendly Session Handling**: Replaced scary "403 Forbidden" errors with a gentle "Session Paused" popup during autosave/settings save.
- **Theme Standardization (Headers)**: Standardized Site Description truncation width (260px) across **TechPress**, **Digest**, and **Default** themes. Prevents long descriptions from breaking the mobile/tablet navigation layout.

### Developer Experience (DX)

- **Development Standards**: Added `THEME_DEV_GUIDE.md` to the project root. Contains drop-in templates for:
- Migrating legacy themes to Shared Hooks.
- Implementing specific layouts and features (SEO, Newsletter, Sidebar).
- Building new themes with 100% plugin compliance.

### Security

- **Install Route Protection**: Enhanced installation page access control to prevent unintended access after initial setup.

---

## v1.9.4 (2026-01-01) - DARK MODE "SNIPER" PATCH

### Dark Mode & Sanitization

- **Sniper CSS Hack**: Replaced broad `!important` color overrides with targeted "Sniper" selectors. Fixes "invisible text" from external sources (MS Word/Dark Mode) while preserving UI colors like badges.
- **Light Mode Sanitization**: Fixed bug where dark backgrounds from external sources (e.g. Dark Mode snippets) persisted in Light Mode. Added global background striping for common "dirty" dark patterns.
- **Digest Theme Fix**: Resolved layout "shrink" and corruption issues by removing restrictive CSS calculations and optimizing Flexbox behavior.
- **Improved Color Logic**: The sanitizer engine now handles both modes:
- **Dark Mode**: Lightens dark text and strips white backgrounds.
- **Light Mode**: Strips dark backgrounds to match the white page.
- **Cross-Theme Consistency**: Applied "Sniper" strategy to all 5 themes.

### Security & Stability Verification

- **API Hardening**: Verified session protection across all core API endpoints.
- **CSRF Protection**: Confirmed CSRF token enforcement on all mutation actions (Save, Delete, Import, Export).
- **Production Certification**: Verified as stable and production-ready for v1.9.4.

## v1.9.3 (2025-12-31) - GOLD MASTER / LAYOUT POLISH

### Database Safety

- **Safe Mode Switch**: Implemented a Safety Switch in Database Manager. Blocks `DROP`, `DELETE`, `TRUNCATE` by default. Requires manual toggle + confirmation to execute destructive queries.
- **SQL Auto-Repair Tool**: Added "Quick Repair" button. Automatically detects and fixes missing core tables and columns.

### Bug Fixes

- **JSON Save Error Fix**: Resolved syntax errors in API responses by implementing Output Buffering.
- **Editor Color Fix**: Fixed Tailwind CSS conflict where text colors appeared black in the editor. Added `dark:text-slate-100` to all input fields.
- **Media Upload Fix**: Updated `GeneralSettings` to show actual server errors instead of generic messages. Fixed missing `filetype` column schema.

### Visual Layout & UX

- **TechPress "Trending Stories"**: Refactored layout to display **3 Posts** (previously 2) in a full-width grid row immediately below the Hero section, providing a more balanced magazine look.
- **Sidebar Positioning**: Adjusted Sidebar to start alongside "Latest Updates" (below Trending Stories), ensuring content doesn't get squeezed.
- **Editor "Auto-Fill" Intelligence**: Upgraded Auto-Fill logic for Slug, Excerpt, and Meta Description to use a **Double-Pass Sanitization Strategy**, eliminating stubborn HTML entities.
- **Dark Mode Visibility**: Fixed specific inputs in the Editor (Slug, Title, Keywords) remaining dark/gray in Dark Mode. All texts are now crisp white in dark mode.

### Performance & Accessibility (Lighthouse Optimization)

- **Lighthouse Scores**: 89 Performance | 96 Accessibility | 100 Best Practices | 100 SEO
- **Code Splitting**: Implemented `React.lazy` for Admin components (Dashboard, Settings, Extensions, etc.) to reduce initial bundle size for public visitors.
- **ARIA Labels**: Added missing `aria-label` attributes to all icon-only buttons across all 5 themes (Default, TechPress, Prism, Digest, Portfolio).
- **Portfolio Mobile Menu**: Fixed missing mobile navigation menu in Portfolio theme.
- **Dynamic Labels**: Mobile menu toggles now use dynamic "Open/Close" labels for better screen reader UX.

### Architecture & Refactoring

- **Centralized Text Utilities**: Created shared text processing functions to prevent code duplication across themes.
- **Frontend Entity Decoding**: All 5 themes (Default, Digest, Portfolio, Prism, TechPress) now decode HTML entities (`&#039;` `'`) on display using the centralized utility.
- **Future-Proof**: New themes only need to import the centralized utility - no copy-paste required.

> **Found an issue?** Please [open an issue on GitHub](https://github.com/Vondereich/VonCMS/issues) your feedback helps improve VonCMS!

---

## v1.9.2 (2025-12-30) - NEWSLETTER RELEASE

### New Features

- **Newsletter System**: Complete subscriber management with API endpoints, admin manager, and footer/sidebar widgets.
- **Von Digest Theme**: Modern magazine-style theme with category filtering, hero sections, sidebar widgets, and newsletter integration.
- **Admin Newsletter Page**: Full subscriber list with search, filter, pagination, and CSV export.
- **DigestSettings Panel**: Theme configuration with accent color, layout toggles, and sidebar widget management.

### Bug Fixes

- **PHP Trailing Tags Cleanup**: Removed trailing `?>` from all 41 PHP files following PSR-12 best practices.
- **Digest Dark Mode Text**: Fixed post content with inline styles (from Word/editors) showing black text on dark backgrounds.
- **API Router Fix**: Removed trailing whitespace from core API files that could corrupt JSON responses.

### Security

- **Security Hardening**: Implemented rate limiting, email validation, and CSRF protection for newsletter management.
- **Verification**: Completed 100% PSR-12 compliance audit and verified session persistence logic across the API layer.

### UX Enhancements (v1.9.4 Patch)

- **Toast Notifications**: Replaced static alerts with `react-hot-toast` for Save/Delete/Export actions in Newsletter Manager.
- **Visual Feedback**: Added robust CSS constraints to Sidebar Ads to prevent layout overflow.

---

## v1.9.1 (2025-12-30) - STABILITY PATCH

### Bug Fixes

- **JSON Parse Error**: Removed trailing whitespace in core configuration files that caused garbled output.
- **Ads Manager Persistence**: Fixed ads settings not saving to database by adding missing data mapping.
- **Empty Content Validation**: Added frontend validation to prevent publishing posts/pages without title or content.

### UX Improvements

- **Save Feedback Toast**: Added success notifications for all save actions in Post/Page Editor.
- **Reset Cancel**: Renamed confusing "Reset" button to "Cancel" in Settings Manager.
- **Schedule Confirmation**: Added visual confirmation bar when schedule date is set.
- **Theme Flash Fix**: Fixed "flash of default theme" on reload using synchronous localStorage read.

---

## v1.9.0 (2025-12-29) - RAFFLESIA

### Polished User Experience

- **Smart Skeleton Integration**: Upgraded the skeleton loader to persist through React hydration phase. This eliminates the "Flash of Unstyled Content" (FOUC) and the momentary "Default Website" text, ensuring a seamless transition from index.html to fully loaded Theme key.

### Security Audit Complete (v1.8.8 Base)

- Includes ALL security hardening from v1.8.8 (Session Fixation Fix, Atomic Writes, Transactions).
- This version is functionally identical to v1.8.8 but with improved Visual Loading UX.

## v1.8.8 (2025-12-29) - PRODUCTION GOLD

### Production Certification

- **System Verification**: Successfully passed comprehensive stress tests including Logic, Security, and Scalability assessments.
- This release is certified **Production Gold**.

### Critical Vulnerability Fixes (Zero-Day Prevention)

- **Settings Race Condition**: Fixed "Million Click" bug in SettingsManager.
- **Config Corruption**: Implemented Atomic Write Pattern for `save_settings.php`. (Prevents blackout corruption).
- **Transaction Safety**: Wrapped User/Post/Delete operations in ACID Transactions (`beginTransaction`, `commit`, `rollBack`).
- **Data Integrity**: Added `FOR UPDATE` row locking to prevent duplicate Slugs/Usernames during concurrent requests.
- **Session Fixation**: Implemented `session_regenerate_id()` on login to prevent session hijacking.

### Logic & Resilience Hardening

- **Autosave Engine**: Added 60-second background autosave to `PostEditor` to prevent writing loss.
- **Visual Feedback**: Added "Last saved" timestamp indicator.
- **Global Error Boundary**: Implemented React Error Boundary to catch component crashes and prevent "White Screen of Death".
- **Stale State Fix**: Refactored `useUsers` to use functional state updates, fixing the rollback bug.
- **Type Safety**: Enforced Strict String Typing for all IDs in API responses (Contract Enforcement).

### Code Hygiene

- **Zero Bloat**: Deleted legacy scripts (`mega_health_check.php`, `fix_contacts.php`, etc.).
- **Ops Ready**: Verified `install.php` schema integrity.

---

## v1.8.7 (2025-12-28) - ANALYTICS OPTIMIZATION

### Performance

- **Smart Session Tracking**: Implemented 30-minute throttle for visit logging. Prevents DB flooding from single user.
- **Auto-Purge**: Added logic to automatically delete analytics logs older than 30 days.
- **Database Indexing**: Added composite index `idx_ip_date` to `analytics` table for blazing fast queries.

### Bug Fixes

- **Robots.txt**: Fixed dynamic generation to respect `site_url`.
- **Sitemap**: Added error logging for XML generation failures.
- **Htaccess**: Hardened rules to prevent direct access to `.json` files.

---

## v1.8.6 (2025-12-28) - PORTFOLIO & POLISH

### Themes

- **Portfolio Theme**: Fixed navigation visibility issues on mobile.
- **Contact Form**: Renamed shortcode to `[von-contact]` and removed branding.

### Features

- **Email System**: Verified SMTP integration for Reset Password and Contact Form.

---
