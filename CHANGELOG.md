### [v1.26.1] - 2026-07-28

> Word-safe discovery summaries and single-article schema parity maintenance.

- **Word-Safe Discovery Excerpts**: Homepage `CollectionPage` item descriptions and `<noscript>` article previews now keep complete words and Unicode code points within a 200-character ceiling, including the trailing `...`, instead of cutting summaries or emoji mid-character. Legacy encoded entities are decoded once before safe HTML output. Post Editor recommends 160-200 characters, shows a non-blocking warning after 220, and produces word-safe 200-character Auto Fill summaries. Server and hydrated route metadata also keep the existing 160-character SEO description boundary with the same behavior.
- **Article Schema Context**: Published post JSON-LD now aligns PHP SSR with hydrated VonSEO by declaring the canonical page through `mainEntityOfPage`, exposing the stored category as `articleSection`, and emitting a strictly validated primary `inLanguage` value from General Settings without hardcoding a portal locale. Invalid markup or punctuation is rejected consistently instead of being sanitized into different SSR and hydration values. Pages, permalinks, canonical URLs, breadcrumbs, routing, and media variants remain unchanged.
- **SEO Helper Boundary**: Server-side schema construction, 404 metadata, URL normalization, noscript text extraction, article-type validation, and language normalization now live in a dedicated guarded helper instead of expanding the public index bootstrap. Direct requests to the helper fail with `403`, while the public index is smaller than before this maintenance patch.
- **Category SSR Content Parity**: Populated `?category=...` discovery pages now server-render a bounded list of published posts from the requested category in both `<noscript>` output and the category `CollectionPage` `ItemList`, instead of exposing the homepage's latest five links until React hydration. Empty categories retain `noindex, follow`, while homepage boot data, public API behavior, permalinks, and hydrated theme rendering remain unchanged.
- **Fingerprint Asset Cache Boundary**: Apache and LiteSpeed installs now cache only fingerprinted `/assets/` build files for 30 days with `immutable`, matching the existing Nginx performance guidance without applying long-lived caching to HTML, PHP, APIs, crawler endpoints, uploads, or mutable public files. Fresh install and integrity repair generate the same bounded rule.
- **Portable Security Header Defaults**: Apache and LiteSpeed templates retain one-year HSTS for the active host without automatically opting every installation and subdomain into browser preload, while the deprecated `X-XSS-Protection` filter is removed. Operators who control HTTPS across every subdomain can still opt into `includeSubDomains` and preload explicitly at the server layer.
- **OTA Documentation Replacement**: OTA activation now replaces the shipped `docs/` directory as one rollback-protected release unit instead of overlaying individual files, so retired guides from older releases cannot remain beside the current consolidated documentation. Update packages must include the current docs directory; protected configuration, data, uploads, backups, and live `.htaccess` files remain untouched.
- **Dependency Maintenance**: Updated all compatible packages reported by the final dependency review: `@openrouter/sdk` from `1.1.8` to `1.1.13`; `@tiptap/core`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-table`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/pm`, `@tiptap/react`, and `@tiptap/starter-kit` from `3.29.0` to `3.29.1`; `@types/node` from `26.1.1` to `26.1.2`; `express-rate-limit` from `8.6.0` to `8.6.1`; and `postcss` from `8.5.23` to `8.5.24`. The v1.26 compiler, router, and Tailwind baselines remain unchanged.
- **Regression And Release**: Integration executes the shared schema text and language normalizers, guards PHP and React schema parity plus the server helper boundary, keeps invalid language values out of JSON-LD, locks category-specific raw HTML and `ItemList` content against homepage-post drift, prevents the fingerprint cache rule from widening beyond immutable build assets, and runtime-tests complete docs replacement plus rollback; package metadata and public docs identify `v1.26.1`.

### [v1.26.0] - 2026-07-26

> After Hours opens the v1.26 line with compiler, styling, and bundled-extension baseline modernization.

- **After Hours Release Identity**: Package metadata and public docs now identify `v1.26.0 "After Hours"` as the current line. The installer uses the major-series `v1.26 "After Hours"` label, while all six bundled themes and six built-in plugins report version `1.26` in Extensions Manager.
- **Tailwind CSS 4 Migration**: Tailwind moves to the dedicated v4 PostCSS adapter and CSS-first configuration with explicit source boundaries matching the previous scan scope. The official migration rewrites legacy utilities to their v4 canonical equivalents across admin, editor, plugins, and bundled themes while removing the retired JavaScript config file; integration smoke now rejects retired color-opacity helpers.
- **TypeScript 7 Native Compiler**: Production typechecking now runs on the TypeScript 7 native compiler. A scoped TypeScript 6 compatibility alias remains available for current smoke tooling that still depends on the legacy Compiler API, avoiding a false choice between faster builds and working integration checks.
- **Dependency Baseline Refresh**: OpenRouter moves to SDK 1, the TipTap family moves together to `3.29.0`, and compatible `fs-extra`, Lucide, PostCSS, Recharts, and React Router 8 releases are aligned in the regenerated lockfile. Source development now declares the Node.js 22.22+ baseline required by React Router 8, while PHP production hosting remains unchanged.
- **Post Editor Maintenance Extraction**: `PostEditor.tsx` now delegates edit-history presentation, SEO controls and score presentation, the featured-media picker modal, and shared text extraction to focused editor modules. Save, autosave, conflict handling, full-content restore, AI actions, media requests, and HTML storage remain owned by the existing controller paths.
- **Article Schema Selection**: VonSEO now offers `Article`, `NewsArticle`, and `BlogPosting` for published post JSON-LD while retaining `Article` as the fresh-install, legacy, and invalid-value fallback. PHP SSR, homepage item metadata, and hydrated React output use the same validated choice without changing pages, permalinks, canonical URLs, Open Graph types, redirects, sitemap, or routing.
- **Public Page Navigation Cleanup**: Page links resolved by the public shell now carry a slug-scoped route hint so SPA navigation fetches the full page directly instead of first producing an expected post-endpoint 404. Direct loads and genuinely ambiguous slugs retain the existing server metadata and dual page/post lookup fallback.
- **Default Card Image Ratio**: Default theme homepage cards now keep a consistent 16:9 thumbnail frame across mobile, tablet, and desktop while preserving responsive image sources and cover cropping.
- **Default Public Feed Stability**: Default theme now memoizes its published-post projection so ticker synchronization cannot repeatedly reset and refetch the homepage list, preventing continuous height flicker around the Load More area.
- **Dashboard Media Usage Clarity**: The Dashboard now labels upload-folder consumption as `Media Usage` and shows its real formatted size instead of a synthetic percentage that could be mistaken for the hosting account quota.
- **Dashboard Information Density**: The oversized system banner is replaced by a compact version/status identity, summary cards use a shorter horizontal layout, Visitor Traffic consumes less vertical space, and Recent Activity plus its history modal use full article titles, readable local timestamps, and honest activity wording instead of simulated audit-log attribution.
- **Dashboard Traffic Detail**: Visitor Traffic now uses the existing analytics response to show total visits, unique visitors, active days, a combined daily visits/unique-visitors chart, and a permalink-neutral period summary with daily average, peak day, and peak visits. Raw historical paths are no longer ranked as current pages after permalink changes, and no analytics table, column, migration, or additional endpoint is introduced.
- **Admin Brand Mark Alignment**: The admin sidebar now uses a white geometric SVG interpretation of the official VonCMS circle, `V`, and rising-arrow mark on the existing 40×40 responsive grid, while public-theme fallback branding retains its established color treatment.
- **Security Source Ranking Clarity**: Security Dashboard replaces the oversized full-width source-IP bar chart with an auto-height ranked list, bounded relative indicators, explicit localhost context, and neutral `Most Active Source` wording so recorded failures are not automatically presented as confirmed attackers.
- **Content Manager Edit Visibility**: Post and page lists now show a compact `Edited` date beneath the existing `Created` date when stored update metadata is newer, preserving the current table width while exposing the full update timestamp through the accessible label and desktop tooltip.
- **Content Manager Narrow-Width Clarity**: Long category and author values remain contained in their fixed columns, category tooltips now retain the full filter value, and `Publish At` uses a compact date/time label with the complete timestamp available to assistive technology and desktop hover.
- **Regression And Release**: Integration smoke now recognizes the After Hours documentation and `v1.26.x` routing labels while retaining the existing release, editor, public-theme, extension, security, and PHP contracts. Package creation continues to derive Deploy and Source artifact names from the canonical package version.

### [v1.25.13] - 2026-07-22

> Public theme startup, category handoff, and legacy sidebar compatibility closeout.

- **Public Theme Startup**: The active public theme now begins its existing dynamic import before React mounts and shares one resolved/pending layout cache with the public renderer, removing the React Suspense reveal delay without bundling inactive themes. Login, install, and admin routes skip the public-theme preload; runtime theme changes keep stale-load cancellation, the shared skeleton handoff, and the existing Error Boundary.
- **Category Transition Integrity**: Category navigation from a post, page, or profile now resets public discovery once so stale homepage/latest rows cannot flash while the category request is in flight. Category changes already on the homepage retain the existing visible-row refresh behavior and accessible busy feedback.
- **Legacy Sidebar Compatibility**: Unsupported stored legacy widgets such as the retired search block no longer count as active sidebar content, preventing an empty desktop column while supported trending, profile, custom, and sidebar-newsletter content retain their existing layouts.
- **Dependency Maintenance**: Updated the compatible `@vitejs/plugin-react` and PostCSS patch releases while leaving OpenRouter 1, Tailwind 4, and TypeScript 7 parked for dedicated migrations.
- **Regression And Release**: Integration now executes the shared sidebar visibility helper against legacy and supported widget states, guards the scoped post-to-category reset, and locks the early public-theme preload/code-split boundary. Public documentation now reflects the current 82 API and 96 public PHP file surface; package metadata and public docs identify `v1.25.13`.

### [v1.25.12] - 2026-07-22

> Guest homepage ticker continuity and slow category-navigation feedback.

- **Guest Ticker Hydration**: Default, Digest, and TechPress now source their homepage ticker from the same bounded public discovery results used by the visible story list, so opening a post in a new guest window and returning Home no longer leaves the ticker empty until reload. Default reuses its existing Home discovery request and guards Category-to-Home handoff from briefly publishing stale filtered rows instead of adding a duplicate fetch.
- **Category Navigation Feedback**: All six bundled themes keep their current visible stories during a slow category request while exposing the same accessible shared loading status and busy state, so delayed public discovery no longer looks like an ignored navigation click without replacing useful content with a second skeleton.
- **Adaptive Empty Sidebar Layout**: Default, Digest, and TechPress single posts now remove the sidebar column and center the article when every shared widget is hidden and no sidebar newsletter is active. When the TechPress homepage widget column is empty, Latest Updates now uses the full theme container with larger balanced thumbnails on tablet and desktop; enabling any homepage sidebar widget restores the original compact feed and sidebar proportions. Digest continues to respect its explicit theme-level sidebar toggle.
- **Dependency Maintenance**: Updated the compatible OpenRouter SDK, PostCSS, Prettier, React, React DOM, React Is, and Recharts releases while leaving the breaking OpenRouter 1, Tailwind 4, and TypeScript 7 migrations outside the final OpenGate patch line.
- **Regression And Release**: Integration guards all three bundled ticker themes against guest preload drift, locks the Default stale-scope handoff, shared category refresh state across every bundled theme, and adaptive empty-sidebar behavior across all sidebar-capable themes; package metadata plus public docs identify `v1.25.12`.

### [v1.25.11] - 2026-07-17

> Media Library safety, extension integrity, and responsive-variant maintenance.

- **Media Library**: Media Manager, editor, and Featured Image picker now use bounded server-backed full-library search; a real database no-result stays empty, while unavailable media tables keep the compatibility scan. Metadata requires an exact managed path and bounded text, and uploads verify browser-upload/MIME/image agreement then roll back all residue on later processing or indexing failure.
- **Cleanup And Variants**: Delete/cleanup stays within the uploads root, protects indexed media plus upload paths held by settings, user avatars, posts, and pages, removes variants before originals and rows only after physical cleanup, rechecks references immediately before removal, and aborts on a failed protection query. Registry writes are locked and atomic; safe legacy variants are recognised only with a source sibling; GD uses a bounded resource budget; runtime registry, lock, temp, and preview files remain excluded from packages.
- **Recovery And Migration**: `.htaccess` and IndexNow writes are atomic and backed up; database downloads complete in a verified temporary stream before response headers are sent; OTA serializes, verifies recovery/download/archive/version, stages the full Deploy payload, and rolls back every activated file after a later failure. Dashboard and legacy bridge now match the owner-only backend for `root` and primary administrator ID `1`; WordPress migration bounds XML, batches, downloads, fields, temporary data, and duplicate media rehosting.
- **Endpoint Boundaries**: Public comments require a published post, hide draft/scheduled discussions, bound input, and rate-account every add attempt; public post discussions now fetch deterministic bounded per-post pages with compact controls, reset local paging between posts, and distinguish first-load, failure/retry, and real empty states instead of hydrating every site comment. Writers read only their own audit history; remember-token rotation conflicts emit low-severity audit telemetry without token material; remaining mutation APIs consistently enforce method, scalar, size, path, and query boundaries.
- **Admin Data Integrity**: Content, Discussion, and User managers ignore superseded page responses; posts in a literal `Page` category remain visible with backend-authoritative totals; post lists, RSS, and sitemap pages use stable ID tie-breakers. Storage usage now calculates bytes and file count in one traversal, while SMTP command/body writes fail closed on incomplete socket writes.
- **Extensions And Plugins**: Extension settings now validate bounded server shapes, custom HTML/CSS stays primary-admin-only, and activation/configuration waits for persistence before updating UI; theme activation uses one canonical write. Redirect Manager consumes deterministic bounded backend pages and ignores stale responses. AI Summary repairs UTF-8 punctuation and memoizes extraction, Related Posts uses Fisher-Yates randomization, Promo/Gift honor boolean new-tab settings, and the source-only theme API limits mock tokens to loopback while requiring the configured token for comment mutations.
- **SEO Settings Ownership**: VonSEO now treats the General Settings Website Name as the single site-title source, shows it read-only beside the existing General Settings description, and removes stale independent SEO title values on save.
- **Loading Experience**: The production PHP entry, static HTML shell, React route fallback, lazy public-theme handoff, and all bundled theme discovery fetches now reuse the compact shared skeleton instead of exposing an empty mount, white theme-loading surface, or second full-width loading panel during cold JavaScript startup. Mobile retains three full-width cards, tablet portrait widths add a fourth tablet-only card for a balanced 2x2 grid, and desktop-style viewports from 960px keep three compact centered cards; one shared stylesheet owns all breakpoint sizing, palette, shimmer, accessible busy, and reduced-motion behavior without duplicate runtime style injection.
- **Public Category Navigation**: Category buttons now update query state in place on the homepage or navigate directly from post/page routes, while same-origin absolute category links saved in Navigation are recognized as internal SPA targets instead of forcing a full document reload. This avoids the previous redundant transition and cold skeleton/layout jump while preserving bounded public discovery fetches.
- **Canonical Entry Routing**: Direct `/index.php` requests now join the existing `/index.html` guard and redirect permanently to the canonical root or subfolder homepage instead of falling through to the strict public 404 boundary.
- **Maintainability Closeout**: Default and TechPress profile editors now share one typed profile/password save hook and only update global user state after backend success; public post SSR routes share one published-post query, metadata sanitizer, and Article/WebPage schema builder; Default and Portfolio navigation variants share their label/action resolvers so desktop, overflow, tablet, and mobile paths cannot drift independently.
- **Dependency Maintenance**: Updated compatible OpenRouter, TipTap, Inter variable font, Autoprefixer, PostCSS, Express Rate Limit, Lucide, and Vite releases while keeping Tailwind 4 and TypeScript 7 parked for dedicated migrations.
- **Regression And Release**: Integration covers media lifecycle and editor search scope, settings/user reference protection, fail-closed cleanup, complete backup/SMTP writes, recovery/import, OTA rollback and owner parity, deterministic admin/discovery pagination, comment visibility/recovery/pagination, extension ownership/save/runtime boundaries, plugin extraction/randomization, General Settings title/description ownership, accessible skeleton parity across the production PHP entry, static HTML shell, and React fallback, shared profile/SSR/navigation maintenance paths, audit ownership, remember-token conflict telemetry, and strict TypeScript paths without `as any` bypasses; package metadata and public docs identify `v1.25.11`.

### [v1.25.10] - 2026-07-17

> Settings ownership, database safety, and embedded-runtime isolation maintenance.

- **Settings And Secrets**: Only the primary administrator can change canonical domain or Media optimization/storage values; appointed-admin saves preserve owner-only mirror values. Domain/CDN/reset links require HTTP(S) and escape email markup; ad embeds use an opaque origin; audit history and rollback no longer expose SMTP, API, analytics, contact, profile-email, or IndexNow secrets; guests do not receive legacy contact-mail configuration.
- **Public Forms And Exports**: Honeypot attempts count toward throttling without storing raw trap input. Contact requests are POST-only, bounded, declared-field/scalar validated, retain leads for 90 days, remove linked leads with a form, and hide SMTP detail; newsletter requests are private, separately throttled, preserve unsubscribe state, and neutralize CSV formulas alongside security-log exports.
- **Database And Admin Tools**: Database restore accepts only VonCMS table-scoped backup SQL; pre-import dumps require complete verified writes, discard partial files, and retain a bounded history. Media input is normalized server-side, owner-only settings remain visibly read-only, rollback preserves private visibility, the SQL inspector matches its read-only backend, and Security Dashboard purge/reset stays primary-admin-only.
- **Regression And Release**: Integration covers ownership, URL/ad/audit boundaries, form privacy and retention, SQL allowlisting, backup short/zero/failed writes, CSV exports, and admin parity; package metadata and public docs identify `v1.25.10`.

### [v1.25.9] - 2026-07-16

> Profile polish and dedicated remember-token hardening.

- **Profile And Editor Fixes**: Default and Corporate Pro headers contain long identities; all bundled themes use the resolved pen name for browser titles when VonSEO is disabled; TechPress featured Gravatar resolves through `author_data.username`. Also fixes single-post noscript whitespace, atomic page-save conflicts, complete-word HourGlass focus-keyword scoring, and title-only keyword suggestions.
- **Remember-Me Security**: A separate `voncms_remember` selector/validator cookie stores only a validator SHA-256 hash server-side, rather than extending `PHPSESSID`. Valid restores rotate safely and refresh CSRF; logout and every password-change path revoke remembered sessions atomically; the cookie keeps root/subfolder path, `HttpOnly`, HTTPS-aware `Secure`, and `SameSite=Lax`.
- **Install And Repair**: Fresh install, source SQL, runtime first-use, and Database Repair create the same user-linked `remember_tokens` table with user-delete cleanup.
- **Regression And Release**: Integration covers profile/title/avatar behavior, token lifecycle and schema parity, noscript/editor regressions, and orphan-helper package hygiene; package metadata and public docs identify `v1.25.9`.

### [v1.25.8] - 2026-07-15

> SEO crawler polish for site-name and category discovery pages.

- **SEO Fixes**:
  - **Homepage Site Name Schema**: Homepage JSON-LD now keeps the `WebSite` schema node for Google site-name signals and adds the latest-post `CollectionPage`/`ItemList` as a separate graph node instead of replacing the site identity schema.
  - **Category Discovery SSR Metadata**: `?category=...` discovery URLs now receive server-rendered title, description, canonical, robots, and `CollectionPage` metadata so populated category filters no longer look like homepage duplicates to crawlers.
  - **Subfolder Category SSR Path Guard**: Homepage-path detection now treats both empty paths and `/` as the homepage, so subfolder installs such as `/blog/?category=...` receive the same category SSR metadata instead of falling back to homepage metadata.
  - **Empty Category Crawl Boundary**: Empty or unknown category discovery URLs keep the user-facing filter route but emit `noindex, follow` to avoid thin soft-404-style indexing signals.
  - **Hydrated Category Robots Parity**: VonSEO now preserves empty-category `noindex, follow` after React hydration, keeps category title/description wording aligned with SSR output, and uses a bounded public count-only category check when runtime navigation needs to distinguish populated and empty category filters.
  - **Public 404 Metadata Boundary**: Missing public routes now keep the real HTTP 404 response while also emitting 404-specific title/description metadata, current missing-route canonical, and `noindex, follow` robots instead of inheriting homepage indexable metadata.
  - **Nested Auth/Setup 404 Boundary**: Invalid nested auth/setup-style URLs such as `/login/...`, `/register/...`, `/reset-password/...`, and `/install/...` now resolve as real public 404/noindex responses before the HTML head is emitted, while exact `/login`, exact `/install`, and `/admin/*` remain valid React shell routes.
  - **Profile Hydration Title Parity**: Hydrated VonSEO profile titles now use the resolved public profile in TechPress and Corporate Pro instead of guest-only `allUsers` lookups, and React title formatting now matches SSR `Name | Site` output to avoid browser-tab title flicker after hydration.
  - **Fresh Install Path Initialization**: Fresh installer pages now initialize the shared request path before SSR head rendering, preventing homepage hero preload checks from emitting an undefined `$path` warning above the install wizard.
- **Security Hardening**:
  - **Remember Me Cookie SameSite Policy**: Extended login sessions now set the remember-me `PHPSESSID` cookie with explicit `SameSite=Lax`, matching the main session cookie policy instead of relying on browser defaults.
  - **Session Cookie Base Path Scope**: Core PHP session cookies now scope to the detected root/subfolder install path instead of always using host-root `/`, so installs such as `/blog` or `/zangetsu` do not share `PHPSESSID` across unrelated sibling apps.
- **Regression Guard**:
  - **Site Name Schema Smoke Coverage**: Integration smoke now guards the homepage `WebSite` + `CollectionPage` graph split.
  - **Category SSR SEO Smoke Coverage**: Integration smoke now guards category query metadata, canonical, robots, and category `CollectionPage` markers.
  - **Hydrated Category Robots Smoke Coverage**: Integration smoke now guards VonSEO against overwriting empty-category noindex metadata after hydration.
  - **Public 404 SEO Smoke Coverage**: Integration smoke now guards missing public routes so HTTP 404 responses cannot silently inherit indexable homepage metadata, while resolved public profiles stay outside the generic 404 fallback.
  - **Nested Auth/Setup 404 Smoke Coverage**: Integration smoke now guards the PHP SPA-route whitelist so invalid nested auth/setup URLs cannot fall back to homepage metadata.
  - **Profile Hydration SEO Smoke Coverage**: Integration smoke now guards TechPress/Corporate Pro profile SEO handoff and hydrated title separator parity with SSR output.
  - **Fresh Install Path Smoke Coverage**: Integration smoke now guards the early public index path fallback used before database-backed SSR settings are available.
  - **Remember Me Cookie Smoke Coverage**: Integration smoke now guards the explicit `SameSite=Lax` policy on extended login-session cookies.
  - **Session Cookie Base Path Smoke Coverage**: Integration smoke now guards root/subfolder-aware `PHPSESSID` path detection for PHP page and API requests.
- **Release Version Alignment**:
  - **v1.25.8 Metadata Bump**: Package metadata and public docs now identify the current OpenGate line as `v1.25.8`.
- **Dependency Maintenance**:
  - **Patch-Level Package Refresh**: Updated `@openrouter/sdk`, the TipTap editor package set, `autoprefixer`, and `postcss` to current compatible patch releases while intentionally leaving Tailwind 4 and TypeScript 7 parked.

### [v1.25.7] - 2026-07-13

> Related Posts `Most Viewed` data correctness patch.

- **Bug Fixes**:
  - **Related Posts Most Viewed Public Payload**: Public post list payloads now include the existing `posts.views` counter, so bounded guest fallback candidates can sort meaningfully in Related Posts `Most Viewed` mode without adding a new views table or restoring the old anonymous full-post preload.
  - **Widgets Save Failure Feedback**: Widgets now wait for the settings save result before showing success, and failed settings saves roll back optimistic in-memory settings so a rejected save cannot look persisted until refresh.
- **Public Theme Polish**:
  - **Prism Card Metadata Cleanup**: Prism public post cards now show reader-facing read time only and no longer expose internal post ID fragments.
  - **Digest Card And Category Cleanup**: Digest article cards now use a tighter 16:10 thumbnail frame, and the noisy all-category pill strip plus its dead admin toggle were removed while preserving per-article category labels.
- **Admin UX**:
  - **Top-Level Widgets Manager**: Added a primary-admin-only `Widgets` section between Users and Extensions so shared sidebar blocks are managed from one global screen instead of being duplicated inside Default, Digest, and TechPress theme settings. Trending/latest blocks, profile cards, custom HTML/text blocks, drag-and-drop ordering with arrow fallback, visibility, bounded item counts, and newsletter sidebar placement all save through the existing settings path. The screen now states that only sidebar-capable themes use these blocks, while themes without a sidebar ignore them.
  - **Compact Widget Area UI**: The Widgets manager now uses a centered General Settings-style two-column layout with compact sidebar and newsletter areas instead of stretching controls across the full admin width. Existing sidebar blocks stay collapsed by default and only reveal title/count/content controls when expanded for editing.
  - **Sidebar Widget Title Alignment**: Profile card and custom HTML/text sidebar widget headings now use the same left-aligned title baseline while keeping profile/custom body content centered where appropriate.
  - **Profile Widget Avatar Fallback**: General Settings now exposes an optional profile avatar URL for Profile Card widgets. Guest settings receive only the public-safe profile projection (`name`, restored public `email`, `bio`, and sanitized `avatar`) so protected placeholders cannot leak into the public sidebar, while Profile Cards render with the sanitized avatar URL when present, Gravatar/identicon from the public profile email when no avatar URL is set, or the existing initial-letter avatar when no email is available.
  - **Custom Widget Guidance**: Custom sidebar blocks now explain supported use cases such as ad snippets, iframe embeds, external badges/counters, and static HTML/text, while clarifying that script/iframe snippets stay sanitized and sandboxed and internal VonCMS stats should use a native widget or plugin.
- **Security Fixes**:
  - **Widgets Primary Admin Boundary**: Appointed admins can no longer open the shared Widgets manager or overwrite `sidebarLayout` through the settings save endpoint; root/admin 1 remains the owner for custom sidebar HTML and script-capable widget snippets.
- **Regression Guard**:
  - **Most Viewed Payload Smoke Coverage**: Integration smoke now guards the public list SELECT and shaped payload so `Most Viewed` cannot silently fall back to treating every related candidate as zero views.
  - **Admin Widgets Smoke Coverage**: Integration smoke now guards the Widgets admin route/nav, shared `sidebarLayout` manager ownership, bounded widget saves, newsletter placement ownership, profile/custom title alignment, profile avatar URL/Gravatar fallback, and removal of duplicate theme-level widget editors.
- **Release Version Alignment**:
  - **v1.25.7 Metadata Bump**: Package metadata and public docs now identify the current OpenGate line as `v1.25.7`.
- **Release Gate Cleanup**:
  - **Manual Gate Canonicalization**: Removed the stale `release-sequence.cjs` helper and `release:full` script so release work follows the explicit manual gate order before `create_release.cjs` packaging.

### [v1.25.6] - 2026-07-12

> Related Posts direct-link recovery after the lean public boot cleanup.

- **Bug Fixes**:
  - **Related Posts Guest And SPA Recovery**: Related Posts now fetches a bounded public/published candidate list when a guest direct-link, new-tab, refresh, or SPA single-post navigation has no global posts preload or only a partial latest/featured local candidate set. Fallback candidates are keyed per post so old related results cannot carry into the next article, preserving admin and SPA navigation behavior without restoring the old anonymous posts preload.
  - **Related Posts Source Stability**: Current-post fallback candidates now remain the active Related Posts source after later authenticated content hydration, preventing profile-dropdown or dark-mode state changes from reshuffling the widget after a direct article load.
  - **Related Posts Random Stability**: Random ordering now stays stable across unrelated theme/profile UI re-renders and only re-randomizes when the current article, candidate set, sort mode, or display count changes.
  - **Related Posts Partial Config Guard**: Saved Related Posts settings now merge with safe defaults and sanitize the display count before building fallback candidate fetch limits, so partial or malformed plugin config cannot collapse guest direct-link results.
- **Regression Guard**:
  - **Related Posts Candidate Fetch Smoke Coverage**: Integration smoke now guards the bounded public candidate fetch path so article-only Related Posts cannot disappear again on guest hard-load single-post routes or loop through a small featured/latest candidate list during SPA navigation.
  - **Related Posts Candidate Source Stability Coverage**: Integration smoke now guards against replacing current-post fallback candidates with later global content hydration.
  - **Related Posts Sort/Layout Stability Coverage**: Integration smoke now covers all four sort modes, all three layouts, and random-order memoization so dark-mode or profile dropdown renders cannot reshuffle random Related Posts.
- **Documentation**:
  - **README Release Snapshot Cleanup**: The README release snapshot now reflects the current Related Posts recovery patch and recent OpenGate hardening/polish work instead of carrying older generic onboarding/package bullets.
- **Dependencies**:
  - **Patch-Level Dependency Refresh**: Updated `dompurify` to `3.4.12` and `postcss` to `8.5.17` while leaving the parked Tailwind 4 and TypeScript 7 major upgrades untouched.
- **Public Theme Polish**:
  - **Single-Post Sidebar Normal Scroll**: Default, Digest, and TechPress single-post sidebars now scroll normally with article content on desktop instead of staying pinned until the article column ends.

### [v1.25.5] - 2026-07-10

> OpenGate security hardening, public-discovery copy polish, and lean performance cleanup.

- **Security Fixes**:
  - **Post Object Authorization Guard**: Writer-level users can now update or delete only posts they own, while admin, root, and moderator roles retain cross-author moderation. Update requests now verify ownership before row locks, conflict checks, slug checks, or SEO safety logic, with integration smoke coverage for that boundary.
  - **Staff Protected Content Read Boundary**: Moderator reads and writer-owned reads now recover authorized draft/scheduled posts without leaking protected content through forced-public discovery requests; moderator page reads also honor the same protected content boundary.
  - **Discussion Integrity Hardening**: Comment replies must now target a parent comment from the same post, comment likes are installed up front, deduped per authenticated user server-side, update relation rows and displayed counters atomically, reconcile displayed counters when liked users are deleted, cascade with deleted comments, and failed like writes roll back both optimistic count and liked-state UI.
  - **Canonical User Write Path**: User Manager create/delete flows now fail closed on the canonical PHP endpoints instead of falling through to legacy Node-style routes after a PHP error.
  - **Profile Update Primary Admin Boundary**: Profile updates now explicitly reject unsupported HTTP methods and prevent appointed admins from modifying admin 1/root profile data, while preserving own-profile edits and primary-admin authority.
  - **Mutating API Method Guards**: Core post/page/user write-delete endpoints and the profile-update endpoint now explicitly reject unsupported HTTP methods after CORS preflight handling.
  - **Single Post ID Parameter Guard**: Single-post reads now require the `id` parameter to be numeric and direct slug strings to the `slug` parameter, preventing numeric-prefixed slugs from being coerced into unrelated post IDs by the database.
  - **Post/Page Title Length Guard**: Shared post/page editor titles now expose the 255-character storage ceiling with an inline counter, while save APIs reject over-limit titles with a clear validation error instead of relying on database truncation/failure behavior.
- **Public Theme Discovery Polish**:
  - **TechPress Section Copy Alignment**: TechPress hero, latest ticker, latest highlights, latest updates, and sidebar labels now describe the actual latest-post data source instead of implying unsupported real-time or analytics-ranked signals. Internal source names were also aligned to latest/ticker/highlight wording while preserving existing settings keys for backward compatibility.
  - **TechPress In-Feed Ad Container Cap**: In-feed ads inside Latest Updates now stay capped by the available content column width, preventing fixed-width ad snippets from pushing the sidebar out of its intended layout.
  - **TechPress Hero And Featured Title Clamp**: TechPress main hero title now follows the Digest-style three-line cap, while featured/latest highlight cards keep the tighter two-line title baseline instead of reserving a taller title area.
  - **Bundled Card Title Clamp**: Default, Prism, and Portfolio card/list titles now also stay capped at two lines so unusually long post titles cannot stretch public card grids.
  - **Related Posts Audit And Copy Polish**: Built-in Related Posts defaults, title fallback, date/image/excerpt controls, empty-state handling, and published-only matching now have focused integration smoke coverage before any larger related-post feature work.
  - **Sidebar Default Copy Honesty**: New/default sidebar widget labels now use latest-content wording while preserving existing user-saved widget titles, with bounded freshness labels based on the effective publish/scheduled timestamp before falling back to normal dates when a portal has not published recently.
  - **Public Sidebar Staff Scope Guard**: Public sidebar latest widgets now hydrate their own public latest-post list so writer/admin sessions do not collapse the sidebar to the staff user's owned post preload.
  - **Footer Brand Minimalism**: Default, Digest, TechPress, and Corporate Pro footers now avoid duplicate uploaded-logo or decorative icon fallbacks in the footer brand line while preserving setting-driven footer copy.
- **Performance**:
  - **Public Boot Data Budget**: Anonymous first render now waits on the public settings refresh only, then refreshes public comments without restoring the old admin-scale posts/pages preload, while authenticated admin content and discussion preloads remain preserved after login.
  - **Post List Payload Budget**: Public/admin post lists no longer select full article bodies only to estimate reading time; full content remains reserved for the single-post endpoint.
  - **Dashboard Count-Only Totals**: Staff dashboard article totals now use a count-only global posts request instead of a writer-owned list request, preserving overall CMS statistics without exposing cross-author post rows.
  - **Public Cache Contract Tightening**: Count-only public requests now bypass the posts-list cache, and rollback/import/profile/user mutation paths clear public cache after successful writes so public-shaped cached payloads stay aligned with the current CMS state.
- **Maintenance**:
  - **Safe Dependency Refresh**: Updated the current semver-safe `@openrouter/sdk`, `adm-zip`, `lucide-react`, `prettier`, and `vite` package set while intentionally leaving the Tailwind and TypeScript major-line upgrades out of this release.
  - **Clean Release Build Logs**: Release packaging now strips inherited debug flags before running the production build so local shell diagnostics do not leak noisy Vite/Rolldown plugin timing output into clean release runs.
- **Regression Guard**:
  - **Discovery Copy Smoke Coverage**: Integration smoke now locks TechPress latest-copy markers, sidebar freshness fallback behavior, unsupported breaking/trending/top-story drift in audited defaults, footer brand minimalism, and Related Posts settings aligned with render fallbacks.
  - **Public Comment Hydration Note**: Integration smoke documents the current full-feed public comment hydration behavior as a correctness guard, not a route-scoped performance optimization.
  - **Audit Patch Smoke Coverage**: Integration smoke now guards staff draft/scheduled read access, full public comment hydration, reply parent post matching, canonical PHP user writes, bounded post-list read-time payloads, mutating API method guards, primary/root profile update protection, and early post ownership rejection.
  - **Writer Scope Regression Coverage**: Integration smoke now locks public-sidebar hydration, dashboard count-only staff totals, TechPress featured-card title height, and bundled card-list title clamps so writer/admin sessions keep public presentation and CMS statistics consistent.
  - **Title Limit Smoke Coverage**: Integration smoke now guards the shared post/page title max-length UI and backend 255-character validation contract.
  - **Single Post Parameter Smoke Coverage**: Integration smoke now guards the single-post numeric ID boundary so numeric-prefixed slug strings cannot regress into the ID lookup path.
  - **Clean Release Smoke Coverage**: Integration smoke now guards release packaging against inherited debug environment flags during production builds.

### [v1.25.4] - 2026-07-07

> OpenGate Ads Manager polish for responsive third-party ad snippets inside the existing Header, In-Feed, and Popup slots.

- **Ads Manager Responsive Safety**:
  - **Responsive Iframe Containment**: Shared ad rendering now bounds script and iframe-based snippets inside the active theme slot with stronger iframe width, min-width, box-sizing, and delayed height recalculation guards.
  - **Ad Visual Style Preservation**: Ads Manager now uses an ad-specific safe style allowlist so bounded inline ad backgrounds, borders, shadows, flex layouts, and spacing survive sanitizing without relaxing the normal editor/content sanitizer.
  - **Direct Markup Containment**: Static ad markup such as images, iframes, `ins`, links, and nested blocks now keeps fixed-width provider output inside the current theme container instead of allowing horizontal layout expansion.
  - **Popup Mobile Safety**: Popup ads now stay inside the mobile viewport with max-height, scroll-safe overflow, and an in-bounds close button while preserving the existing delayed popup behavior.
  - **Global Slot Overflow Guard**: Shared `.ad-slot-wrapper` and `.ad-slot-flex` helpers now clamp width and overflow so bundled theme placements cannot expand the page horizontally.
  - **Helper Copy Boundary**: Ads Manager guidance now clarifies that VonCMS contains the slot while the external ad network controls delivery and reporting.
- **Regression Guard**:
  - **Ads Containment Smoke Coverage**: Integration smoke now locks the responsive iframe contract, ad visual style allowlist, style-tag stripping boundary, popup viewport guard, global slot overflow guard, and Ads Manager boundary copy.
  - **Theme Logo Slot Coverage**: Bundled public themes now share a single object-contain logo slot, standardizing normal uploaded logos to a smaller 112x38 mobile render box and 140x45 desktop box, with logo-as-title mode using 150x48 on mobile and 180x56 on desktop without resizing the original uploaded file.
  - **Theme Logo Dark Mode Invert**: General Settings now exposes a default-off dark-mode invert toggle for uploaded PNG or monochrome logos, wired through public settings, installer seeds, first-paint hydration, and bundled themes.
  - **Public SEO Hydration Guard**: Server-rendered initial settings now keep the General Settings site description separate from per-route SEO descriptions, so single-post hydration no longer reuses post meta text as the site tagline.
  - **Large Social Card Alignment**: PHP SSR now emits `twitter:card=summary_large_image` for any resolved social image instead of downgrading valid uploaded assets whose filename contains `og-default`.
- **Dependency Review**:
  - **Safe Patch Refresh**: Updated the current semver-safe wanted set for `@openrouter/sdk`, TipTap, `@types/node`, and Recharts; Tailwind v4 and TypeScript v7 remain parked for dedicated migrations.
- **Documentation**:
  - **VPS Security Baseline**: VPS deployment guidance now calls out SSH, aaPanel, firewall, update, backup, and web-root hygiene responsibilities before the software stack setup, clarifying what VonCMS protects in-app versus what the server owner must harden.
  - **VPS Server Tuning Consolidation**: Server/CDN tuning guidance for static assets, fonts, uploads, image variants, Cloudflare, LiteSpeed, and cache boundaries now lives inside the VPS guide instead of a separate short tuning document.
  - **Docs Surface Cleanup**: Retired the redundant `docs/QUICKSTART.md` path and moved first-run guidance ownership back to the README, Installation, and VPS docs.
  - **Public Docs Consolidation**: Merged the Introduction and CMS Comparison material into Features, and merged the Theme and Plugin development guides into one Extension Development guide while preserving the theme skeleton, plugin shape, runtime ownership, SEO, security, WYSIWYG, and release-check details.
  - **Theme Logo Developer Guidance**: Extension Development now documents `ThemeLogo`, shared logo sizing, and the `invertLogoInDarkMode` setting so custom theme edits inherit the same uploaded-logo behavior as bundled themes.
- **Release Version Alignment**:
  - **IndexNow User-Agent Cleanup**: IndexNow single and batch submissions now use a shared versionless `VonCMS IndexNow` User-Agent so future patch releases do not carry stale runtime version labels.
  - Bumped the OpenGate line to `v1.25.4`.

### [v1.25.3] - 2026-06-29

> OpenGate follow-up for a lightweight public-shaped JSON cache on repeat public posts/settings reads.

- **Lightweight Public JSON Cache**:
  - **Public Posts List Cache**: Public-shaped `public=1` and `includeTotal=false` discovery reads now use a short server-side JSON cache for homepage, category, search, and load-more style post lists while admin, exact-total, count-only, profile, status, draft, preview, and scheduled-private paths stay uncached.
  - **Public Settings Snapshot**: Guest-shaped `get_settings.php` responses now cache only after public/sensitive-field scrubbing, while admin and primary-admin settings responses remain live database reads.
  - **Fail-Open Runtime Storage**: Cache files live under the protected `data/public-cache` runtime path (`public/data/public-cache` in source layout), use safe hashed query keys, short TTL checks, JSON validation, and atomic temp-file writes, and fall back to live database reads when the folder is missing, stale, corrupt, locked, or not writable.
  - **Bounded Write Closeout**: Successful cache writes now prune after the atomic rename so the 250-file cap applies to the final directory state, while temporary-name generation stays inside the fail-open exception boundary.
  - **Clear-All Purge Hooks**: Successful post/page/settings/category writes, settings rollback, database/WordPress imports, profile/user changes, and scheduled publishes now clear the public cache so public readers do not keep stale list/settings JSON after content, author, or public configuration changes.
  - **Manual Clear Action**: System Tools now exposes a primary-admin-only Clear Public Cache action backed by a POST + CSRF endpoint restricted to known public cache files.
  - **System Tools Layout Polish**: Tools cards now use a roomier responsive grid so the new cache action does not compress the maintenance buttons on normal desktop widths.
  - **Release Hygiene**: Generated public cache runtime files are ignored locally and excluded from Source and Deploy release packages.
- **Public Theme Polish**:
  - **Mobile Lightbox Swipe**: The shared public post-content lightbox now supports guarded left/right swipe navigation on mobile, covering bundled themes that use the global gallery overlay while preserving desktop click and keyboard controls.
  - **Homepage Hero Image Discovery**: Hero homepages now emit a guarded image preload for the first story, including responsive `imagesrcset` candidates when generated variants are available, `imagesizes`, and high fetch priority. Direct category/search discovery URLs skip the global homepage preload so they do not fetch an unrelated hero image. Each theme owns a server-readable `theme.json` capability manifest that is shared with React and copied into Deploy builds, so future hero themes opt in without theme IDs or capability rows in `public/index.php` and settings storage.
- **Subfolder Deployment Hardening**:
  - **Verification Email Fallback URL**: Verification links derived from the current request now preserve root and subfolder installs without inserting a duplicate slash before the API path when General Settings Domain URL is unavailable.
  - **Installer Redirect Base Path**: Uninstalled-site redirects now use the server-injected deployment base path directly, keeping `/install` navigation correct from root domains, subdomains, and subfolder routes.
- **Modern Crawler And SEO Alignment**:
  - **Canonical Domain Single Source**: Hydrated VonSEO canonical, Open Graph, schema, author, breadcrumb, and image URLs now use the General Settings Domain URL without duplicating subfolder paths; the retired independent canonical-host setting is removed on save.
  - **Homepage Canonical Consistency**: Server-rendered homepage canonical, Open Graph URL, and CollectionPage schema now use the same slash-terminated directory URL selected by Apache redirects, sitemap, and hydrated VonSEO output on root and subfolder installs.
  - **SPA Metadata Cleanup**: Client metadata now removes stale empty tags between SPA routes, adds `og:image:alt`, and stops emitting ignored meta keywords, an unverified author name as `twitter:creator`, or the retired sitelinks search action.
  - **Versioned Robots Policy**: Generated robots defaults now carry a v1.25.3 policy marker, apply protected-path crawl rules to specific social and AI-search groups instead of relying on wildcard inheritance, retain vendor Content Signals as an optional hint, and automatically replace recognizable legacy VonCMS defaults without overwriting custom policies.
  - **Sitemap State And Signals**: `robots.txt` advertises the canonical sitemap only while XML sitemap generation is enabled and avoids duplicate declarations, while sitemap output drops ignored `changefreq` and `priority` hints and retains authoritative URL, image, and `lastmod` data.
  - **Authoritative Sitemap Toggle**: Saved custom `Sitemap:` directives are removed in the SEO editor, settings API, and robots response before the single canonical declaration is conditionally emitted, preventing disabled or stale sitemap URLs from surviving in storage or `robots.txt`.
  - **Linked llms.txt Resources**: Category sections now expose Markdown links, latest posts follow effective scheduled publish time, internal keyword metadata is omitted, and generation failures return retryable HTTP 503 responses instead of false-success output.
  - **Subfolder IndexNow Ownership**: IndexNow submissions now include the deployed verification-key location and the saved post's canonical permalink structure, including category/date/plain paths and subfolder installs.
  - **IndexNow Typed Post Boundary**: Canonical post submission now accepts an explicit integer post id and casts the saved id at the caller boundary, keeping PHP runtime behavior and static analysis aligned.
  - **Temporary Maintenance Semantics**: Public maintenance responses remain HTTP 503 with `Retry-After`, while client SEO no longer attaches persistent `noindex` metadata for temporary outages.
  - **Crawler Detection Single Source**: Social-preview User-Agent detection now lives in the shared security bootstrap, removing copied regex and redundant status handling from robots, sitemap, and llms endpoints while preserving their explicit error statuses.
  - **Subfolder Robots Guidance**: Install and routing docs now explain that crawler standards require host-root `/robots.txt`, even when VonCMS itself is deployed under a subfolder.
- **API Runtime Polish**:
  - **Install-Local Runtime Storage**: Rate-limit state and generated PHP error logs now stay inside the current VonCMS installation instead of resolving one directory above root or subfolder deployments.
  - **Public Index Bootstrap Cleanup**: Server-rendered settings, permalink, theme, discussion, ads, SEO, and social-image inputs now come from one request snapshot instead of repeated settings queries, while unused PHP Analytics and OG type/square state has been removed without changing the React-owned analytics flow or public metadata contract.
  - **Site Name Whitespace Normalization**: General Settings now trims accidental leading and trailing whitespace from site names before saving, while server-rendered metadata also normalizes legacy stored values.
  - **Crawler Page Mode Naming**: Renamed the internal public crawler page-render marker and corrected misleading "bypass all security" comments so the code reflects its actual non-API GET/HEAD session-avoidance scope without changing request behavior.
  - **CORS Method Preservation**: Shared API header handling now preserves endpoint-specific allowed methods after POST endpoints enter auth or error helpers, preventing fallback error responses from downgrading their `Access-Control-Allow-Methods` header to the default GET contract.
  - **API Helper Direct Access Guard**: Runtime, installer, and `.htaccess` repair templates now deny direct web access to helper-only API PHP files and return a clean `404` for the invalid `api/public-cache/` pseudo path, while normal public and authenticated API endpoints keep their existing PHP-level access checks.
  - **Missing Upload Path Guard**: Runtime, installer, and `.htaccess` repair templates now return `404` for non-existent `uploads/` paths before the SPA fallback, while existing uploaded media files and protected upload directories keep their normal handling.
- **Dependency Review**:
  - **Safe Patch Refresh**: Updated the current semver-safe wanted set for `@openrouter/sdk`, `@types/node`, `adm-zip`, `fs-extra`, `lucide-react`, `postcss`, `prettier`, `react-router-dom`, Recharts, and Vite; Tailwind v4 remains parked for a dedicated migration.
- **Release Gate Alignment**:
  - **Full Sequence Coverage**: `release:full` now runs integration smoke and recursive PHP lint before packaging, while PHP lint dynamically discovers installed Laragon PHP versions instead of relying on fixed legacy paths.
- **Release Version Alignment**:
  - Bumped the OpenGate line to `v1.25.3`.

### [v1.25.2] - 2026-06-28

> OpenGate follow-up in progress for lightweight public JSON cache preparation and small UI consistency polish.

- **Loading UI Polish**:
  - **React Skeleton Palette Alignment**: Route and Suspense fallback skeletons now use the same dark-mode surface, border, and shimmer palette as the pre-React bundled `skeleton.css` loader, preventing a visible palette shift between initial shell loading and React route loading.
- **Public Theme Crawlability**:
  - **Canonical Post Card Links**: Bundled public themes and the Related Posts plugin now expose canonical `href` links for post cards while preserving the existing React single-page navigation behavior for normal clicks.
  - **Sidebar Trending Link Behavior**: Shared, TechPress, and Digest sidebar trending widgets now route clicks through the real post anchor instead of a parent-only click trap, preserving canonical href hover/open-new-tab behavior.
  - **Subfolder Href Base Path Guard**: Relative post-card hrefs now keep the active subfolder base path even when `domainUrl` already includes that same folder, preventing links like `/category/post` on local `/zangetsu` installs.
  - **Sitemap Image Base Path Guard**: Image sitemap entries now strip an already-present subfolder prefix from stored upload URLs before joining with the configured domain URL, preventing `/subfolder/subfolder/uploads/...` image URLs.
- **Release Version Alignment**:
  - Bumped the OpenGate line to `v1.25.2`.

### [v1.25.1] - 2026-06-25

> OpenGate follow-up for first public-source impression, sidebar reading context, release package truth, and GitHub contribution readiness.

- **Open Source First Impression Follow-Up**:
  - **Quickstart Guide**: Added `docs/QUICKSTART.md` as a short first-run path for Deploy ZIP hosting, Laragon/local checks, first admin login, first post publish, and source checkout commands.
  - **Install Docs Triage**: README, INSTALL, VPS, and UPGRADE guidance now keep shared-hosting Apache/LiteSpeed, Nginx-only VPS parity, manual update, and `v1.25.0` OTA `.htaccess` repair notes separated so the install paths do not contradict each other.
  - **Public Claim Verification**: Open-source-facing docs were re-aligned to the current release label and package names while preserving historical `v1.25.0` OTA warnings where they still apply.
  - **Package Hygiene Audit**: Release smoke continues to guard Deploy and Source ZIP contents for canonical README, license, metadata, docs, `.htaccess` files, and exclusions for local config, backups, logs, maps, `node_modules`, and private planning files.
  - **Open Source Issue Templates**: Added GitHub bug report, release-audit, issue-template config, and pull request templates, including private-report guidance for dangerous security findings.
- **Public Theme Polish**:
  - **Sidebar Current Post Highlight**: Shared public sidebar trending widgets now receive the active post id and mark the matching item with `aria-current="page"` plus a subtle highlight in Default, TechPress, and Digest single-post views.
  - **Public Author Display Name**: User profiles now support an optional display name/pen name for public bylines and profile headers while keeping the username as the stable login and `/profile/{username}` route key.
  - **Author Route Compatibility**: Public post, page, RSS, SSR schema, and client SEO payloads now keep `author_data.username` separate from the displayed byline so changing a pen name does not break author profile links.
  - **Multi-Word Category Breadcrumbs**: Category permalink surfaces now normalize multi-word category slugs consistently across SSR canonical URLs, homepage hydration, sitemap, RSS, and `llms.txt`, while SSR and React SEO breadcrumbs expose `Home > Category > Post` for clearer search-engine category signals.
- **Admin UI Polish**:
  - **Solid Admin Palette**: Admin dark mode now uses the `#16161e` shell with `#1a1b26` admin panels and `#101018` deep editor/terminal surfaces across the core admin UI, while updater UI accents now use solid orange instead of decorative gradients.
  - **Pending Email Approval**: Admin 1/root can now identify users with pending email verification in User Manager and approve the verification state from the user edit flow.
  - **Navigation Menu Reordering**: General Settings menu items can now be drag-reordered before saving, using the existing navigation settings array without adding a new storage path.
  - **Contact And Login Palette Cleanup**: Contact Form Manager and the public login/recovery form now use the solid slate admin palette instead of the older blue accent treatment.
  - **Final Palette And Menu Hygiene**: Contact Form Manager and login surfaces now use the same solid `#16161e`/`#1a1b26`/`#101018` admin palette, and General Settings quick-add menu checkboxes no longer reuse duplicate HTML ids.
- **Public Developer Docs**:
  - **Source ZIP Workflow Clarity**: README and CONTRIBUTING now point public source readers to shipped docs and maintainer instructions instead of requiring private `.agent` workflow files that are intentionally excluded from Source ZIP packages.
  - **Source Smoke Public Docs Guard**: Integration smoke now checks retired theme/plugin references against public README, contributor, theme, plugin, and quickstart docs instead of private `.agent` workflow files, so public Source ZIPs can run the gate without agent-local folders.
  - **README Open-Source Landing Page**: README now removes the external preview image table and uses a text-first open-source structure covering project status, hosting install, source development, architecture, theme/plugin extension points, release checks, and documentation links.
  - **Security Policy Disclosure Path**: `docs/SECURITY.md` now starts with private vulnerability reporting instructions, the maintainer contact email, and clearer wording that the guide is not a penetration-test certificate.
- **Dependency Review**:
  - **NPM Outdated Audit And Safe Refresh**: `npm outdated` was reviewed on 2026-06-25, the semver-safe wanted updates were applied for `@openrouter/sdk`, `@vitejs/plugin-react`, `autoprefixer`, `recharts`, and `vite`, and `@types/node` was moved to `26.0.1` after a compile/build audit. Tailwind v4 remains parked for a dedicated migration.
  - **OpenRouter SDK Patch Refresh**: Refreshed `@openrouter/sdk` from `0.13.14` to `0.13.16`, matching the current wanted/latest patch line while leaving the Tailwind v4 major migration parked.
- **Security Hardening**:
  - **SSR JSON-LD Script Safety**: Public schema JSON-LD now uses hex escaping for tag, quote, apostrophe, and ampersand characters so post/page metadata cannot close the schema script tag.
  - **Root Account Edit Boundary**: Appointed admins can no longer modify any Root account through direct user-save API calls; only admin 1/root can edit Root users.
  - **Guest Comment CSRF Guard**: Guest comment creation now requires the same same-site CSRF token used by normal public POST flows, while keeping anonymous rate limiting in place.
  - **WordPress Import File And Fetch Guard**: WordPress XML scan files now use random temp names, deny direct web access in the temp folder, clean up after final import batches, and pin cURL DNS resolution for remote media rehosting.
  - **CodeQL Follow-Up Cleanup**: Node AI dev routes now use scanner-visible `express-rate-limit` middleware, editor/theme video checks parse URLs instead of matching raw substrings, public image preview/avatar sources pass through a shared image URL normalizer, editor plain-text extraction uses the shared sanitizer helper, and release artifact cleanup now escapes the full version string before building its regex.
  - **Safe Image Sink Boundary**: CodeQL-alerted avatar and preview image surfaces now render through a centralized `SafeImage` component with fail-closed URL normalization, source-change fallback reset, load-error fallback, and a single audited `React.createElement` image sink for the remaining DOM reinterpretation alerts.
  - **CodeQL Source Hygiene Pass**: Removed the inactive legacy `server/themes-api.js` duplicate, tightened dev theme API upload/enable path handling, and routed theme/plugin external links through the shared URL normalizer so unsupported schemes fail closed.
  - **CodeQL Follow-Up Guard Pass**: Added explicit dev Node API middleware guards for theme/AI helper routes, tightened uploaded theme temp-path validation, replaced partial dev Node HTML/protocol regex filtering with text escaping, and removed the remaining raw custom-plugin `javascript:` href rewrite in favor of the shared URL normalizer.
- **Release Version Alignment**:
  - Bumped the OpenGate line to `v1.25.1`.

### [v1.25.0] - 2026-06-18

> OpenGate starts the v1.25 line with release-readiness fixes for direct entry routing, slow post/page loading, AI key expiry, Gemini completion handling, external font loading, and open-source onboarding documentation.

- **Runtime Entry Safety**:
  - **Direct `index.html` Guard**: Root, public, installer, and `.htaccess` repair templates now route direct `/index.html` requests through `index.php`, where the PHP entry redirects them back to the homepage with `301` instead of serving the static Vite shell or falling through as a missing slug.
  - **Generated Template Coverage**: Integration smoke now locks the runtime and generated `.htaccess` templates so installer/repair output cannot recreate the static-shell bypass.
  - **Sensitive File Rewrite Hardening**: Runtime and generated `.htaccess` templates now block sensitive extensions and config filenames before generic crawler handling, so spoofed social-crawler user agents cannot bypass `.sql`, `.json`, `.log`, `.bak`, `.zip`, `.lock`, `von_config.php`, `composer.lock`, or `package.json` protection.
- **Loading Stability**:
  - **Single-Post Full Payload Skeleton**: Single-post routes now keep the route skeleton visible while the full `get_post.php` payload is loading instead of rendering preload-card data first.
  - **Single-Page Pending Skeleton**: Ambiguous slug routes now check `get_pages.php` alongside `get_post.php` and keep the route skeleton visible until the current page lookup settles, preventing slow page fetches from falling through early.
  - **TechPress Breaking Bar Search Guard**: TechPress breaking news now stays tied to the latest published posts and hides during active search, preventing old search results from appearing in the top marquee.
  - **Skeleton Dark Palette**: Dark-mode pre-React skeleton blocks now use the same slate/blue surface family and shimmer tone as the runtime UI instead of flat near-black blocks with a light shimmer.
  - **TechPress Empty Category State**: TechPress now shows a clear no-results state for invalid or empty category/search discovery URLs, with a direct return path to all stories instead of an empty layout.
- **AI Settings And Generation**:
  - **Expired Gemini Key Auto-Clear**: Expired saved Gemini keys are cleared from Settings state and backend storage after the 30-day boundary, the Settings field stays empty, and admins see the fresh-key notice instead of a stale prompt-only key.
  - **Staff AI Key Session Memory**: Admin 2, Moderator, and Writer prompt-entered Gemini keys are reused in editor memory for the current runtime session without being saved to Settings, database, `localStorage`, or `sessionStorage`.
  - **Partial Gemini Response Guard**: AI generation and AI check now reject non-`STOP` Gemini finish reasons even when partial text is returned, and the generation token budget was raised to reduce avoidable cutoffs.
  - **SEO Health Empty Keyword Copy**: Empty keyword checks now name the missing title, meta, and content placements instead of repeating the same generic focus-keyword warning three times.
- **External Font Loading**:
  - **Self-Hosted Inter Default**: Static and PHP runtime entry HTML no longer load Google Fonts CSS or preconnects, while fresh installs/themes keep the original `Inter, sans-serif` look through local Inter font files shipped with the package.
  - **Compact Variable WOFF2 Inter Bundle**: The local Inter package now ships latin and latin-ext variable WOFF2 subsets through `@fontsource-variable/inter`, replacing per-weight static files while preserving bundled theme typography.
  - **Single Font CSS Owner**: Runtime entries load `skeleton.css` before `fonts/inter/inter.css`, while `inter.css` owns the `@font-face` declarations so the bundled font flow stays predictable as custom fonts are added later.
  - **Bundled Font Notice**: The packaged Inter font directory now includes an explicit font license notice so Deploy and Source ZIPs do not ship anonymous font binaries.
  - **Bundled Theme Font Choices**: Default Theme settings now offer only bundled Inter or system-safe font stacks, and bundled theme registry defaults no longer reference unshipped Google-font families.
- **Open Source Onboarding Docs**:
  - **README Developer Setup**: README now documents source install, Node/npm checks, audit/build/test commands, IDE/editor usage, CLI agent workflow, and links to theme/plugin/API docs for developers who fork or customize the CMS instead of only deploying ZIP packages.
  - **README Visual Preview**: README now includes four external preview thumbnails for the post editor, TechPress theme, installer wizard, and quick editor without adding heavy image files to the repository or release packages.
  - **Contributor Source Workflow**: CONTRIBUTING now covers the normal open-source editing flow, including Node.js setup, npm install/audit/outdated checks, Laragon/PHP linting, theme/plugin/extension ownership, installer boundaries, and release packaging commands.
  - **Open Source Private Planning Boundary**: `.gitignore`, release packaging, contributor docs, and release smoke keep private planning files such as `MASTERPLAN_2.0.md` and `ROADMAP.md` out of the public reader path and generated Source ZIP.
  - **GitHub Issue And Security Reporting Guidance**: Contributor and handoff docs now separate normal GitHub Issues/Pull Requests from dangerous security reports, which should be sent privately to the maintainer first for audit and coordinated disclosure.
  - **Integration Smoke Gate Positioning**: README and contributor docs now frame `npm run test:integration` as a maintainer/PR/release regression gate instead of normal first-time source reading.
  - **VPS Nginx `index.html` Parity**: VPS docs now include an explicit Nginx `index.html` route to `index.php`, matching the Apache/LiteSpeed hydration guard and preventing direct static shell delivery on Nginx-only installs.
  - **OTA `.htaccess` Upgrade Warning**: README, upgrade docs, and the OTA update modal now tell admins to run System Tools > Repair `.htaccess` once after an OTA update to v1.25.0, because OTA protects the live `.htaccess` file while this release changes the managed routing and sensitive-file block.
  - **GPL License Text**: Root `LICENSE.md` now carries the full GPL-3.0-only license text, while `docs/LICENSE.md` remains the short packaged license guide that points readers to the canonical root license.
- **Publishing And Admin Listing Polish**:
  - **Public Draft Visibility Guard**: Public discovery requests now force the published-only API contract even during an authenticated admin session, preventing autosaved drafts from appearing on public theme views.
  - **Content Manager Date Clarity**: Post and page managers now label creation dates as `Created`, and post manager keeps publish timing in a separate post-only `Publish At` column.
  - **Scheduled Publish Ordering**: Scheduled posts now retain their scheduled publish timestamp for latest-post ordering after publication while keeping the original creation date visible for admin history.
  - **Content Manager Publish Timing Visibility**: Instead of showing `-` for published posts, the `Publish At` column now displays scheduled timing when present and falls back to the available created timestamp for published posts, while keeping `-` only for drafts.
- **Release Packaging**:
  - **Deploy And Source ZIP Output**: `create_release.cjs` now keeps the normal two-package release flow: Deploy ZIP for hosting and Source ZIP for open-source code review, with no checksum sidecar artifacts.
  - **Package Size Copy Alignment**: Feature docs now describe the package surface without the old sub-1MB claim, matching the larger self-hosted-font package reality.
  - **Benchmark And Checklist Cleanup**: Removed the obsolete local benchmark snapshot and release checklist artifacts from the source tree, README, feature docs, and release smoke contract.
  - **Dependency Refresh**: Updated the low-risk npm dependency set, including TipTap `3.27.1`, Lucide, React Router, DOMPurify, Multer, Prettier, TypeScript, the Recharts `react-is` peer, and the Tailwind Typography patch release, while leaving the Tailwind v4 major migration parked for a later focused phase.
- **Release Version Alignment**:
  - Bumped the OpenGate line to `v1.25.0`.

### Older Releases

> HourGlass and earlier release history is compressed to keep the GitHub changelog focused on the active v1.25+ lines. Detailed notes remain available through repository history and archived release artifacts.

- **v1.24.11 HourGlass closeout**: Slow-network profile loading stability, dashboard count truth, AI crawler policy, Nginx deployment guidance, and Deploy-package parity.
- **v1.24.10**: Current comment-avatar fallback, managed .htaccess packaging proof, and SSR article/profile schema URL repair.
- **v1.24.9**: Durable TipTap image state, bounded search, OTA redirect handling, readiness-based skeletons, and open-source preflight proof.
- **v1.24.8**: Profile activity beyond preload limits, appointed-admin secret isolation, and public/profile/editor privacy closeout.
- **v1.24.7**: Built-in extension runtime parity for campaigns, SEO, analytics, AI summaries, gifts, promo bars, and related posts.
- **v1.24.6**: Category and search first-paint loading parity across bundled public themes.
- **v1.24.5**: Editor-engine maintenance extraction while preserving HTML storage, toolbar, media parsing, and save behavior.
- **v1.24.4**: Public interaction polish, comments-off first paint, editor video tools, import guardrails, and theme preload cleanup.
- **v1.24.3**: Dashboard count truth, public discovery beyond capped preloads, and release alignment.
- **v1.24.2**: Theme search stability, profile 404 behavior, responsive admin search, and editor styling parity.
- **v1.24.1**: TipTap stabilization for autosave, restore freshness, toolbar behavior, paste cleanup, navigation, and regression coverage.
- **v1.24.0 HourGlass foundation**: TipTap editor activation, content/SEO cleanup, escalating login penalties, and bundle-size optimization.

- **v1.23.10 Rentaka closeout**: API key privacy/rotation, media fallback reporting, Page Manager search parity, vertical video embed handling, scanner polish, form accessibility cleanup, and v1.24.x transition wording.
- **v1.23.9**: PHP 8.5 compatibility and static-analysis cleanup across importer, backup/import, public helpers, installer, repair, and security metadata surfaces.
- **v1.23.8**: CI/CD scanner-noise cleanup, sanitized HTML render guardrails, packaged README license-link alignment, and benchmark-copy cleanup.
- **v1.23.7**: WordPress importer remote-fetch hardening, redirect/DNS/IP validation, read-time alignment, and settings mirror hardening.
- **v1.23.6**: Database Manager restore/backup clarity, import restore fixes, public theme performance polish, settings and repair alignment, and roadmap pull-forward work.
- **v1.23.5 to v1.23.0 Rentaka line**: Security audit hardening, autosave/save feedback polish, promo bar color controls, build chunk optimization, release promotion, Kirana-to-Rentaka consolidation, and Content Manager alignment.
- **v1.22.x Kirana line**: Hybrid decoupled CMS stabilization, RSS and avatar fixes, manual excerpt/meta preservation, discussion/search/admin flow improvements, routing/path robustness, and broad publishing workflow polish.
- **v1.21.x Breeze line**: Managed `.htaccess` strategy, responsive image rollout, scheduler/security hardening, editor stability, packaging realignment, and performance/UI refinement.
- **v1.20.x Mandala line**: Universal path agnosticism, TechPress polish, SPA ad intelligence, engagement/discovery updates, image SEO engine, and early security hardening.
- **v1.11.x Nara foundation**: Core routing, hydration, SEO, security, mail, IndexNow, and early hybrid architecture work that formed the base for later release lines.

For forensic history before `v1.25.x`, use repository history or archived release artifacts instead of expanding this root changelog again.
