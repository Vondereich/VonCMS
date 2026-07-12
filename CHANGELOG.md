### [v1.25.6] - 2026-07-12

> Related Posts direct-link recovery after the lean public boot cleanup.

- **Bug Fixes**:
  - **Related Posts Guest And SPA Recovery**: Related Posts now fetches a bounded public/published candidate list when a guest direct-link, new-tab, refresh, or SPA single-post navigation has no global posts preload or only a partial latest/featured local candidate set. Fallback candidates are keyed per post so old related results cannot carry into the next article, preserving admin and SPA navigation behavior without restoring the old anonymous posts preload.
  - **Related Posts Partial Config Guard**: Saved Related Posts settings now merge with safe defaults and sanitize the display count before building fallback candidate fetch limits, so partial or malformed plugin config cannot collapse guest direct-link results.
- **Regression Guard**:
  - **Related Posts Candidate Fetch Smoke Coverage**: Integration smoke now guards the bounded public candidate fetch path so article-only Related Posts cannot disappear again on guest hard-load single-post routes or loop through a small featured/latest candidate list during SPA navigation.
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

### [v1.24.11] - 2026-06-11

> Emergency HourGlass stabilization for slow-network profile loading and admin dashboard count truth before the v1.25 line starts.

- **Profile Loading Stability**:
  - **Footer-Safe Activity Tabs**: TechPress, Digest, Corporate Pro, and the default public profile now reserve activity-tab height while author articles or comments are loading, preventing the page footer from floating upward during slow profile fetches.
  - **Activity Skeleton States**: Empty article/comment arrays no longer render a blank or false-empty activity area while `articlesLoading` or `commentsLoading` is active; the affected profile surfaces now show lightweight skeleton placeholders until the first payload settles.
- **Dashboard Count Loading Truth**:
  - **Article/Page Total Placeholder**: Dashboard Articles and Pages cards no longer seed their visible values from capped preloaded arrays before the count-only API metadata returns, avoiding the temporary `200` total flash on slow connections.
  - **Staff Count Placeholder**: Dashboard Comments and Active Users now use the same loading-placeholder pattern while their count-only totals resolve, so slow admin loads do not expose fallback hydrated counts as final totals.
- **Public Search Count Copy**:
  - **Approximate Count Wording**: Default and Digest public search headers now avoid exact `results found` wording when discovery is running in count-skipping load-more mode, using loaded-result wording until an exact total is available.
- **TechPress Public Theme Polish**:
  - **Top Stories Rank Row**: TechPress now labels the former trending row as `Top Stories` and overlays `01`-style rank badges on the latest-story cards, keeping the simple latest-post ordering while avoiding a false real-time trending claim.
- **AI-Friendly Robots Defaults**:
  - **Search-Friendly AI Crawler Policy**: Default robots rules now explicitly allow AI search and user-directed assistant crawlers while keeping sensitive VonCMS paths blocked for general crawlers.
  - **AI Training Opt-Out Defaults**: Default robots rules now disallow common AI training and bulk dataset crawlers, including `GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot`, `Applebot-Extended`, and `Bytespider`, while preserving the dynamic sitemap append.
  - **Robots Response Cleanup**: `robots.php` now serves text and JSON defaults with explicit UTF-8 charset headers and removes the stale `/api/public/` allowance from the default robots rules.
- **VPS Deployment Guide**:
  - **Nginx Rewrite Parity**: VPS guide now documents the Nginx equivalents for VonCMS routing, uploads script blocking, sensitive-file protection, and the `.htaccess` limitation on Nginx installs.
- **Release Packaging Parity**:
  - **Deploy License/Metadata Inclusion**: Deploy ZIPs now include the root `LICENSE.md`, `metadata.json`, and `docs/LICENSE.md`, keeping the packaged README license link and release metadata available without shipping `package.json`.
- **Roadmap Cleanup**:
  - **v1.25.x Release Slicing**: Roadmap now splits the next line into `v1.25.1` open-source onboarding, `v1.25.2` simple public API cache, `v1.25.3` i18n seed work, and `v1.25.4` public-theme discovery polish after checking for source features that already exist.
- **Smoke Coverage**:
  - **Profile Loading Contract**: Integration smoke now guards that bundled profile activity tabs reserve space and render skeletons while loading.
  - **Dashboard Count Contract**: Integration smoke now guards dashboard loading placeholders for article/page totals, staff counts, and the Active Users count-only path.
  - **Public Search Count Contract**: Integration smoke now guards the approximate-count copy so public discovery cannot label count-skipped totals as exact.
  - **AI Robots Contract**: Integration smoke now guards the new AI search allowances, AI training crawler blocks, and `Content-Signal` default.
- **Release Version Alignment**:
  - Bumped the HourGlass line to `v1.24.11`.

### [v1.24.10] - 2026-06-02

> HourGlass final hotfix for stale public comment avatars and `.htaccess` release packaging proof before the v1.25 line starts.

- **Comment Avatar Fallback Repair**:
  - **Current Profile Avatar Source**: Account-linked comments now use the current `users.avatar` value from `get_comments.php`, so clearing a custom external profile avatar stops old saved comment rows from returning the stale URL and lets the frontend fall back to email/Gravatar behavior.
  - **Guest/Legacy Comment Compatibility**: Guest and legacy comments without a linked `user_id` can still use their saved `comments.user_avatar` value after the shared avatar scrubber.
- **Release `.htaccess` Packaging & Audit**:
  - **Deploy Routing Dotfile Inclusion**: `create_release.cjs` now explicitly packages `public/.htaccess` as the Deploy ZIP root `.htaccess`, avoiding dotfile omission when folder-based ZIP creation skips hidden files.
  - **Uploads Shield Inclusion**: Deploy and Source packages now explicitly include the uploads shield `.htaccess` when present, so script-execution blocking and directory-listing protection survive packaging.
  - **Source Routing Dotfile Inclusion**: Source packages now explicitly include both source-root `.htaccess` and `public/.htaccess` routing templates.
  - **Canonical Changelog Packaging**: Release packages now ship the canonical `CHANGELOG.md` only, removing the temporary `Changelog.md` alias before the Open Source handoff.
  - **Smoke Coverage**: Added release smoke guards for account-comment live avatar fallback and explicit `.htaccess` package inclusion markers.
- **SSR SEO Schema URL Repair**:
  - **Article/Page JSON-LD URL Parity**: Server-rendered VonSEO schema now sets JSON-LD `url` to the same canonical content URL used by `og:url` and `<link rel="canonical">`, so view-source output for posts and pages no longer leaves Article/WebPage schema at the site root.
  - **Article Publisher Schema**: Server-rendered Article schema now includes an Organization publisher with the configured site name, domain URL, and logo ImageObject when a logo is set, matching the React VonSEO publisher graph more closely for crawlers that rely on raw HTML.
  - **Subfolder Schema URL Repair**: Server-rendered schema now keeps Article `name` and `description` aligned with the current post metadata and strips an already-present install base path from relative media/profile URLs before joining them to the canonical site URL, preventing `/subfolder/subfolder/...` output on subfolder installs.
  - **Page SSR Query Narrowing**: Server-rendered page fallback now fetches explicit page columns instead of `SELECT p.*`, keeping the SEO hydration query aligned with the narrowed post SSR path.
  - **Public Profile SSR SEO**: `/profile/{username}` view-source output now gets a canonical profile URL, `og:type=profile`, and public-safe `ProfilePage` / `Person` schema from `username`, `avatar`, and `bio` only, without exposing role, email, joined date, or numeric user IDs.
  - **Analytics Timestamp Guard**: Monolithic post/page view counters now preserve `updated_at` while incrementing `views`, so schema `dateModified`, sitemap `lastmod`, and editor conflict baselines only move after real content edits.
  - **Page Editor Meta Description Reload**: Admin page payload normalization now preserves saved `meta_description` as `metaDescription` across seed data, page-list reloads, and hard-refresh editor recovery, so manual page SEO descriptions stay visible after reload.
  - **Settings Audit Viewer Runtime Guard**: Admin settings-audit listing now clamps and integer-binds its SQL limit while formatting nullable audit values safely, preventing the authenticated audit API from returning a 500 on populated audit logs.
- **React Runtime Cleanup**:
  - **Ad Slot Hook Order**: Shared ad rendering now keeps hooks unconditional while
    memoizing sanitized ad HTML and executable-script detection without changing ad output.
  - **Corporate Pro Profile Hook Order**: Corporate Pro now calls the public-profile hook
    directly instead of conditionally selecting a hook path, preserving profile behavior.
  - **Discussion Manager Split**: Admin discussion moderation now uses a reducer-backed
    state model with module-scope helper components for header, search, tabs, rows,
    pagination, and delete confirmation while preserving global search, search-safe badges,
    and delete-confirmation smoke coverage.
  - **React Safety Follow-up**: Tightened effect cleanup, mutable route dependency,
    fresh dependency, direct mutation, and missing-alt surfaces in AdminLayout,
    RouteProgressBar, ThemeProvider, TechPress, Editor video aspect handling, and
    Corporate Pro profile article images without changing editor storage, routing,
    or public theme contracts.
- **Search API Robustness**:
  - **Boolean Payload Guard**: Post and page search endpoints now normalize FULLTEXT
    terms and escape LIKE wildcards before binding, so punctuation-heavy boolean
    search payloads cannot trip MySQL boolean-mode parsing while normal title and
    content matching remains intact.
- **Release Version Alignment**:
  - Bumped the HourGlass line to `v1.24.10`.

### [v1.24.9] - 2026-05-31

> HourGlass closeout for durable TipTap image state, bounded search, OTA release redirects, readiness-based skeleton loading, late micro-polish, and Open Source preflight proof.

- **Editor Image Bubble Repair**:
  - **Explicit Image State Contract**: TipTap image nodes now persist `data-von-image-size` and `data-von-image-align` alongside inline style, so the editor can restore M/L/Full size and left/center/right alignment from saved content instead of guessing from fragile DOM width.
  - **Image Width Persistence Guard**: Image resize and alignment actions merge the saved TipTap node style with the rendered DOM style before writing updates, keeping resized images from expanding back to full width after a save/reload/update cycle.
  - **Image Style Normalization Guard**: Saved image styles now normalize width, max-width, height, display, and margin defaults before editor rehydration, so live editing and saved markup share the same sizing baseline.
  - **Image Attribute Preservation Guard**: Sanitized editor HTML preserves explicit image size and alignment attributes through post/page save and reload paths.
  - **Editor Preview Rehydration Guard**: The editor now rebuilds image preview width/alignment from saved `data-von-image-size` and `data-von-image-align` attributes, preventing the bubble toolbar from showing the right size while the editor canvas falls back to a full-width image.
  - **Image Alignment Active State**: Image alignment controls now expose the selected left/center/right state in the bubble toolbar.
  - **Video Alignment Active State**: Video alignment controls now expose the selected left/center/right state in the bubble toolbar.
  - **Stable Figure Boundary**: Image rendering keeps non-captioned and captioned images inside a stable `figure` boundary, and editor/live CSS avoids forcing saved inline image widths back to full width.
  - **Caption/Video Save Preservation**: Post and page save endpoints preserve editor `figure`, `figcaption`, and `iframe` wrappers for non-admin staff saves while retaining event-handler and `javascript:` stripping.
- **Search Query Guard**:
  - **Public Search Length Guard**: Public theme search and admin Content Manager search now clamp search input to 120 characters and show a visible limit warning.
  - **API Search Clamp**: Post and page search endpoints clamp oversized query strings before SQL binding.
  - **Debounce Loading Truth**: Public discovery search keeps live typing local, uses the debounced trimmed query for server fetches, and treats debounce gaps as loading instead of flashing premature no-results states.
- **OTA Update Recovery**:
  - **GitHub Release Asset Redirect Host**: The OTA updater now accepts GitHub's `release-assets.githubusercontent.com` redirect host while still validating every redirect hop before download and preserving mandatory SHA256 verification.
  - **Direct Updater Digest Forwarding**: The direct `public/api/system/updater.php?action=start` path now forwards caller-supplied `expected_hash` into `startUpdate()`, matching the dashboard bridge path so both OTA entry points use the same SHA256 verification source.
- **Frontend First-Paint Polish**:
  - **Initial Skeleton Hold**: The bundled skeleton stylesheet no longer auto-fades on a fixed timer, so fast pages render immediately when React replaces the root while slow boots keep the skeleton instead of exposing a blank shell.
- **Ads Manager Helper Copy Cleanup**:
  - **Concise Slot Guidance**: Header, in-feed, and popup helper panels now use plain behavior-neutral copy and remove noisy helper labels without changing ad placement, sizing, frequency, or injection behavior.
- **Late HourGlass Micro-Polish**:
  - **Profile Public Email Masking Repair**: `adminProfile.email` remains a public profile field for appointed Admin settings reads, and stale protected placeholders cannot overwrite the saved public profile email.
  - **Admin Profile Read-Only Boundary**: Guest settings reads no longer expose `adminProfile`, appointed Admin settings sessions can view the Profile tab without editing it, and non-primary settings saves ignore direct `adminProfile` payloads.
  - **Media CDN URL Helper Polish**: Upload URL generation now accepts either a CDN root or a CDN `/uploads` base without producing duplicate `/uploads/uploads/...` paths, WebP upload responses use the same CDN helper as the primary URL, and Media Settings storage guidance now explains when to use the CDN URL, the benefit, accepted formats, and when to leave it blank.
  - **TechPress Brand Header Alignment**: The TechPress header now keeps long logos, site name, and site description inside one bounded aligned brand row instead of relying on a fixed tagline margin.
  - **Final Redirect Exact-Match Audit**: Both the integrated `public/index.php` redirect runtime and standalone `redirect_engine.php` remain exact-match only, skip admin/API/assets/uploads paths, reject same-path loops, and now have separate smoke coverage preventing accidental wildcard/pattern drift.
  - **Media List Query Narrowing**: `list_media.php` now fetches only mapped media columns through a schema-aware allowlist instead of `SELECT *`, preserving fallback behavior for repaired older installs.
  - **Public Posts COUNT Skip**: Public discovery requests now opt out of exact totals and use a `limit + 1` fetch to derive `hasMore`, while admin, profile activity, and default API callers still receive exact `COUNT(*)` totals.
  - **Thumbnail Object-Position Polish**: Shared responsive card-image attributes now default to an upper-center crop so portrait thumbnails preserve more likely subject detail without touching editor storage or media metadata.
  - **Widget/Ad Containment Micro-Fix**: Shared ad/widget rendering now bounds direct custom HTML media inside the active theme container so image, iframe, and ad-slot markup cannot force horizontal overflow.
  - **Responsive/Legacy Debt Closeout**: The remaining proof-backed responsive and legacy-debt slots closed with the shared thumbnail/ad containment repairs plus smoke coverage, without a bundled theme redesign or broad extraction.
- **Regression & Release Guard**:
  - **Preflight Smoke Coverage**: Added smoke coverage for explicit editor image size/alignment state, image/video bubble active state, image width roundtrip markers, bounded search UI/API paths, skeleton timer removal, and GitHub release asset redirects.
  - **Roadmap Closeout Guard**: Smoke coverage now keeps `v1.24.9` closed as the HourGlass preflight and late micro-polish lane, while `v1.24.10` remains the security hotfix reserve.
  - **Package Audit Dry Run**: Source and Deploy ZIPs were re-inspected for expected `v1.24.9` package contents and accidental local-only config leakage.
  - **Changelog Casing Package Truth**: Release packaging now reads the canonical `CHANGELOG.md` source and publishes both `CHANGELOG.md` and `Changelog.md` ZIP entries so docs, Source packages, and Deploy packages stay case-safe.
  - **Upgrade Path Caveat**: README and Upgrade Guide now make the `v1.24.8 -> v1.24.9`
    manual Deploy ZIP jump explicit because the OTA redirect/digest recovery fixes ship inside
    `v1.24.9`; once a site is on `v1.24.9` or newer, the admin OTA updater remains the
    preferred future patch path.
  - **Safe Dependency Lock Refresh**: Refreshed in-range npm dependencies for the final `v1.24.9`
    package while leaving major-version jumps such as Vite 8, Tailwind 4, TypeScript 6,
    lucide-react 1.x, and React plugin 6 for a dedicated future migration lane.
  - **Late Micro-Polish Smoke Coverage**: Added smoke coverage for public profile email masking, admin profile read-only boundaries, CDN upload/WebP URL normalization, TechPress brand header alignment, redirect exact-match behavior, media query narrowing, public discovery count skipping, thumbnail object-position defaults, and shared ad/widget containment.
  - **Public Claim Verification Dry Run**: Current public release claims were checked against source markers, smoke coverage, and package-audit scope before closing the late HourGlass lane.
  - **Release Version Alignment**: Bumped the HourGlass line to `v1.24.9`.

### [v1.24.8] - 2026-05-24

> HourGlass maintenance patch for profile activity truth beyond the preload boundary, appointed-admin secret isolation, and the final public/profile/editor privacy closeout.

- **Profile Activity Truth Alignment**:
  - **Shared Profile Activity Hook**: Added a shared `useProfileActivity` hook that fetches author articles through `get_posts.php?author=...` and profile comments through a server-backed flat comments query, so profile tabs no longer derive totals from the capped global preload arrays.
  - **Bundled Profile 200+ Parity**: Default/shared UserProfile, TechPress, Prism, Digest, Corporate Pro, and Portfolio profile views now display server `meta.total` counts and load-more state for profile articles/comments instead of freezing around the first 200 posts or first 10 comments.
  - **Profile Comments API Filter**: `get_comments.php` now supports safe profile filters by `user_id` or username in flat mode while keeping public users restricted to approved comments.
  - **Profile Activity Stale Response Guard**: The shared profile activity hook now ignores slow article/comment responses from a previous profile after fast profile-to-profile navigation, keeping profile totals and activity lists tied to the current viewed user.
  - **Dashboard Comments Total Truth**: The admin dashboard comments card now fetches the real comments `meta.total` with a one-row flat query instead of trusting the globally hydrated comments batch.
  - **Dashboard User Total Truth**: The admin dashboard Active Users card now fetches the real user `meta.total` through a count-only `get_user_stats.php` staff endpoint, so Admin, Moderator, and Writer dashboards no longer show `0` when the hydrated user slice is empty while `get_users.php` remains the User Manager list/search API.
- **Appointed Admin Secret Boundary**:
  - **Primary Admin Capability**: Added a server-side primary-admin capability for Root or Admin ID 1, separate from normal appointed Admin access.
  - **Settings Secret Masking**: `get_settings.php` now masks SMTP/API/token/password-style values for appointed Admin, Moderator, Writer, and public callers; only the primary admin receives unmasked secrets and server-info diagnostics.
  - **Sensitive Settings Save Guard**: `save_settings.php` strips SMTP/API/indexing secret payloads from non-primary Admin saves, preventing masked or manually crafted requests from overwriting protected credentials.
  - **Database Manager Lockdown**: Database Manager UI and `db_query.php` are now primary-admin only, so appointed Admin cannot inspect raw settings-table secrets through read-only database queries.
  - **Masked AI Key Runtime Guard**: AI writing/check flows now treat protected settings values as unavailable keys, so appointed Admin, Moderator, and Writer sessions are prompted for their own Gemini key instead of sending the primary admin's masked placeholder to the AI gateway.
  - **Admin Tool Surface Lockdown**: Database Manager, database backup/import, settings audit/rollback, Settings Media tools, System Tools, OTA updater, IndexNow owner actions, WordPress Bridge, media maintenance, media deletion, WP scan/import, and system repair endpoints are now primary-admin only while normal editor upload/list metadata paths remain available to staff roles that need them for writing.
  - **User Manager Admin Parity**: Appointed Admin access to User Manager is restored for normal newsroom management, while server-side save/delete guards keep Admin ID 1 and Root accounts protected from non-primary admins.
- **Public & Editor Polish**:
  - **Public Profile Privacy**: `get_public_profile.php` no longer exposes numeric user IDs, staff roles, or joined dates to guest profile lookups; bundled profile views no longer render public account-age/joined-date cards.
  - **Own Profile Edit/Role Sync Repair**: Bundled profile edit buttons, avatar/bio sync, and own-profile role badges now detect the logged-in owner by username as well as ID, so public numeric ID/role removal does not make appointed Admin, Moderator, or Writer profiles fall back to `Member`.
  - **Public SSR Visibility Parity**: `public/index.php` direct post/homepage SEO hydration follows the same public published and scheduled cutoff rules as the post APIs, while direct page SSR stays published-only to match the pages API contract, preventing draft or future-scheduled post content from appearing in meta tags, JSON initial state, or noscript output when a URL is known.
  - **Public SSR Schema Polish**: Direct SSR routes now normalize schema image URLs before JSON-LD output and render resolved pages as `WebPage` schema instead of treating every resolved slug as an article.
  - **Centralized Public Payload Privacy**: Public post, page, single-post, bootstrap, and comment responses now share server-side response shaping helpers for internal author/comment identifiers; public comments omit `dbId`, `status`, and `emailHash` entirely, appointed staff receive only `hasEmail: true`, and raw comment email hashes stay primary-admin only.
  - **Avatar URL Safety**: User/comment avatar inputs and outputs now use a shared avatar scrubber that allows local upload paths and HTTPS external avatars while rejecting `javascript:` / `data:` / insecure external URLs, with public comment avatars falling back if the image fails to load.
  - **Session Check Noise Reduction**: Browser tab visibility checks now throttle `check_auth.php` session pings with a cooldown and in-flight guard, reducing repeated auth requests when switching tabs while preserving session-expiry detection.
  - **TechPress Profile Asset Cleanup**: Removed the external `grainy-gradients.vercel.app/noise.svg` dependency from the TechPress profile header.
  - **TipTap Link Repair**: Editor hyperlink insertion now uses one configured official TipTap Link extension and shared URL normalization, preserving selected text and complex query-string links such as WhatsApp send URLs while avoiding duplicate `link` extension registration; public light-mode content links now render with explicit blue underline styling.
- **Regression & Release Guard**:
  - **Profile Activity 200+ Smoke Coverage**: Added smoke coverage requiring bundled profile surfaces to use server-backed profile activity totals instead of capped global `posts` / `comments` arrays, with stale-response guards for fast profile-to-profile navigation.
  - **Appointed Admin Secret Smoke Coverage**: Added smoke coverage requiring server-side settings masking, sensitive-save guarding, and primary-admin Database Manager gating.
  - **Appointed Admin Closeout Smoke Coverage**: Added smoke coverage requiring masked AI key prompting, User Manager appointed-admin parity with Admin ID 1 protection, dashboard user total truth, primary-admin-only destructive tool/media/WP/system/backup/import/settings-audit/updater/IndexNow surfaces, public profile owner-edit/avatar/role sync after numeric ID/role removal, public SSR visibility/schema parity, centralized public payload/comment/email-hash shaping, avatar URL safety, throttled session visibility checks, TechPress external asset removal, and single-instance TipTap query-string hyperlink/link-color parity.
  - **v1.24.9 Roadmap Sequencing**: Reordered the next HourGlass polish lane so low-risk helper-copy/profile-email/theme micro-fixes land before broader regression, version-label, claim-verification, and package-audit sweeps.
  - **Release Version Alignment**: Bumped the HourGlass line to `v1.24.8` so the profile/RBAC maintenance fix ships as its own patch before broader v1.24.8 roadmap polish continues.

### [v1.24.7] - 2026-05-21

> HourGlass built-in extension upgrade patch for making the older bundled plugin surfaces obey the saved runtime state and carry current campaign/SEO/analytics behavior.

- **Built-In Extension Runtime Alignment**:
  - **Shared Plugin Runtime Gate**: Added a single `isSystemPluginActive` helper so system plugin checks consistently combine `activePlugins` with saved `pluginStatus` across public slot rendering, article plugin hooks, providers, and theme-level headless integrations.
  - **VonSEO Theme Toggle Parity**: Default, Prism, TechPress, Portfolio, Corporate Pro, and Digest now gate `VonSEO` rendering through the same runtime helper, so disabling or uninstalling VonSEO stops title/meta/schema injection across bundled themes.
  - **VonAnalytics Runtime Toggle Parity**: GA injection, native monolithic page tracking, and the frontend cookie banner now respect the VonAnalytics plugin state instead of running from analytics settings alone.
- **Built-In Extension Product Polish**:
  - **VonSEO Social Image Fallback**: Social metadata now prefers post images, then the configured large OG image, then logo/square fallbacks without writing a second `og:image` through the same single-meta helper.
  - **VonSEO General Description Sync**: Site-level meta descriptions now read directly from the General Settings site description, the SEO modal shows that value as read-only, and stale `seo.defaultMetaDescription` overrides are dropped on the next SEO save.
  - **Google-Compatible Robots Defaults**: Default and served `robots.txt` output no longer emits unsupported `Crawl-delay` directives, saved legacy robots rules are normalized before display or crawler delivery, and VonSEO `robotsTxt` saves now mirror into the crawler-facing `seo/robots_txt` row with a `site_config` fallback for older databases.
  - **Crawler Surface Scheduled Cutoff**: `sitemap.xml` and `llms.txt` now use the same PHP/CMS-time scheduled publish cutoff as RSS, so future scheduled posts do not appear in crawler-facing discovery files before their publish time.
  - **LLMS Route Interceptor Parity**: `llms.txt` now shares the same ultra-early public-index fallback route as `robots.txt`, `sitemap.xml`, and RSS/feed aliases, while `.htaccess` still routes it directly in normal Apache deployments.
  - **Old Search Result Permalink Repair**: Older search/discovery results outside the preload now reuse the server-backed discovery cache to navigate directly to the saved permalink when slug/date/category data is already known, while the immediate `/post/:id` route remains only as an uncached fallback and canonicalizes after the full post loads.
  - **Auth Email Feedback Polish**: Login, registration, forgot-password, and reset-password forms now surface backend validation messages from the shared API error field, so duplicate registration, unverified login, invalid reset token, and weak reset password states show the real guidance instead of generic request failures.
  - **Extension Fallback Cleanup**: Removed the old Extensions Manager VonSEO fallback that still seeded a separate default meta description and legacy blank robots rules, keeping new extension sessions aligned with the shared VonSEO settings modal and `robots.php` defaults.
  - **Promo Bar Campaign Controls**: Promo Bar now supports campaign start/end windows, configurable dismiss duration, and explicit target behavior while keeping the existing text/link/color configuration.
  - **Gift Widget Campaign Controls**: Gift Widget now supports saved target URL, tooltip, optional label, button color, position, and target behavior instead of staying locked to the original bottom-left demo button.
  - **System Asset Upload Compatibility**: Logo, favicon, and social image uploads now skip WebP derivative generation entirely when uploaded from General Settings, preventing Media Library thumbnails from preferring a broken `.webp` sidecar while preserving the original system asset URL.
- **Developer Documentation Refresh**:
  - **Theme Development Guide**: Added `docs/THEME_DEVELOPMENT.md` as the current v1.24.7 guide for theme architecture philosophy, core production deploy expectations, visual WYSIWYG output, shared SDK usage, theme registration, SEO ownership, performance, security, and verification.
  - **Plugin Development Guide**: Added `docs/PLUGIN_DEVELOPMENT.md` as the current v1.24.7 guide for system plugin registration, activation state, settings ownership, custom HTML sanitization, PHP security principles, article hooks, visual output quality, and release checks.
  - **Root Theme Guide Retirement**: Removed the outdated root `THEME_GUIDE.md` and redirected developer references to the packaged Theme Development and Plugin Development guides so v1.25 preparation no longer points new contributors at the old v1.23 theme baseline.
  - **Roadmap Closeout Cleanup**: Cleaned stale future-backlog wording so the roadmap no longer describes the already-shipped v1.24 TipTap migration as future Editor V2 work.
- **Regression & Release Guard**:
  - **Extension Upgrade Smoke Coverage**: Added smoke coverage for the shared plugin runtime helper, VonSEO theme gating, VonAnalytics runtime gating, social image fallback, duplicate `og:image` protection, and Promo/Gift campaign-grade settings.
  - **SEO/Robots Smoke Coverage**: Added smoke coverage that locks General Settings as the only site-level meta description source, rejects default `Crawl-delay` output from the robots defaults, blocks legacy Extension Manager fallback seeds from returning, and verifies admin-saved `robotsTxt` reaches `robots.php`.
  - **Crawler Surface Smoke Coverage**: Added smoke coverage that requires `sitemap.xml` and `llms.txt` to filter scheduled posts with the same PHP/CMS-time cutoff used by the RSS feed.
  - **LLMS Interceptor Smoke Coverage**: Added smoke coverage requiring `public/index.php` to keep `llms.txt` in the same early crawler route map as robots, sitemap, and RSS aliases.
  - **Public Post Permalink Smoke Coverage**: Added smoke coverage requiring cached old discovery results to navigate directly to saved permalinks and uncached id-backed routes to replace themselves with the saved permalink after the full post loads.
  - **Auth Email Flow Smoke Coverage**: Added smoke coverage requiring login, registration, forgot-password, and reset-password UI paths to display backend API error fields instead of hiding validation details behind generic failures.
  - **System Asset Upload Smoke Coverage**: Added smoke coverage requiring General Settings system uploads to disable both responsive variants and WebP derivative output.
  - **OTA Redirect Hardening**: The updater now validates every GitHub download redirect hop instead of letting cURL follow redirects automatically before the existing SHA256 package verification.
  - **Safe Dependency Lock Refresh**: Refreshed in-range npm dependencies for the v1.24.7 package lock while holding major-version jumps for the dedicated v1.25 migration lane.
  - **Source Changelog Casing Parity**: Source packages now include both `Changelog.md` and `CHANGELOG.md` entries so case-sensitive external tooling can resolve either canonical changelog casing.
  - **Release Quality Gate Cleanup**: `npm test` now runs the real smoke gate, PHP lint now targets public PHP files recursively when `php` or `PHP_BIN` is available, and stale TypeScript suppressions were removed from typed runtime paths. This cleanup improves the gate wiring, but PHP syntax-clean status still requires verification in an environment with a PHP binary.
  - **Release Version Alignment**: Bumped the HourGlass line to `v1.24.7` so the built-in extension behavior changes ship as a new patch release instead of mutating the already-packaged `v1.24.6` artifacts.

### [v1.24.6] - 2026-05-20

> HourGlass public discovery loading parity patch for closing the remaining category/search first-paint polish gaps across bundled themes.

- **Public Discovery Loading Closeout**:
  - **Shared Initial Loading State**: `usePublicPostsQuery` now starts in loading state when a server-backed category/search request is needed and the local preload fallback would be empty, preventing the first paint from briefly looking like an empty result set.
  - **Remaining Theme Loading Parity**: TechPress, Prism, Corporate Pro, and Portfolio now render explicit initial loading panels before empty grids while older category/search results are being fetched from the server.
- **Regression & Release Guard**:
  - **Discovery Loading Smoke Coverage**: Added smoke coverage that requires the shared public discovery hook to start loading for empty fallback server fetches and requires TechPress, Prism, Corporate Pro, and Portfolio to expose initial loading states.
  - **Release Version Alignment**: Bumped the HourGlass line to `v1.24.6` so this follow-up ships as its own patch instead of mutating the already-packaged `v1.24.5` artifacts.

### [v1.24.5] - 2026-05-19

> HourGlass maintenance extraction patch for keeping the editor engine boundary smaller while preserving the existing HTML storage, toolbar, defined media parse-render subset, and save behavior.

- **Editor Maintenance Extraction**:
  - **TipTap Extension Boundary Split**: Moved the TipTap extension list, legacy image node, video iframe node, media alignment helpers, and editor surface constants out of `src/components/Editor.tsx` into `src/components/editor/editorExtensions.ts`, reducing the editor component surface without changing the saved HTML format or the existing image/video parse-render subset.
  - **Post Editor Save Helper Split**: Moved autosave countdown/status copy, draft-change candidate checks, schedule-time normalization, saved snapshot merging, and save-conflict message ownership into `src/components/editor/postEditorSaveHelpers.ts`, keeping the existing save buttons, autosave timer, and publish/schedule flow behavior intact.
  - **Editor Behavior Lock**: Left toolbar JSX, image/video bubble state, upload flow, modal flow, preview flow, placeholder/focus handling, and save/restore behavior inside `Editor.tsx` so the first `v1.24.5` extraction remains behavior-preserving instead of becoming a broad editor rewrite.
- **Legacy Contact & Newsletter Closeout**:
  - **Contact Submit Backend Validation**: Contact form submissions now validate required template fields on the PHP endpoint before saving leads or sending mail, so direct API calls cannot bypass fields that the browser marks as required.
  - **Contact Submit Rate Limit Alignment**: Valid contact submissions no longer get recorded as failed rate-limit attempts, while honeypot and invalid payload paths still count toward the existing lockout guard.
  - **Newsletter Subscribe Setting Parity**: The public subscribe API now honors the saved Newsletter enabled setting instead of only relying on the hidden frontend widget state.
  - **Newsletter Admin Query Polish**: Subscriber search now builds its list URL with `URLSearchParams`, includes the explicit page limit, and keeps pagination display aligned with the API response size.
  - **Contact Admin Polish**: Contact submissions now use bounded server pagination, visible shortcode previews show the real form id, and the tag helper inserts a valid submit tag instead of a required-field placeholder.
- **Admin Closeout Polish**:
  - **Security Dashboard Setup Parity**: The dashboard auto-create path now calls the security-table setup endpoint as `POST`, matching the endpoint method and CSRF contract.
  - **Security Logs Pagination Clamp**: Admin security-log reads now clamp page and limit values before querying, keeping direct requests bounded even outside the dashboard UI.
  - **Extensions Install/Uninstall Persistence**: Plugin install and uninstall actions now persist `pluginStatus`, and uninstall also removes the plugin from `activePlugins`, so the Extensions dashboard no longer reports a local-only state after refresh.
  - **Extensions Runtime Status Parity**: Public plugin rendering now treats `inactive` and `not_installed` statuses as disabled, admin plugin cards derive active state from saved `activePlugins`, and article-only plugins stay out of global header/footer slots.
- **Public Route Stability**:
  - **Profile Pending & Theme Handoff Guard**: Public profile routes now hold the existing route skeleton while the profile lookup is unresolved, reject stale profile fetches during fast profile-to-profile navigation, and cache resolved public users so the active theme does not briefly fall back to home/not-found after the app shell has already resolved the profile.
  - **TechPress Profile Tab Contrast**: The active Articles tab on TechPress public profiles now uses a light-mode readable text and underline color while preserving the existing dark-mode contrast.
  - **TechPress Profile Username Solid Color**: TechPress public profile usernames and status copy now use responsive solid colors instead of gradient-clipped or low-contrast text, keeping the mobile profile header readable when the content flows below the dark header panel.
- **Regression & Quality Guard**:
  - **Editor Extraction Smoke Coverage**: Added smoke guards that require `Editor.tsx` to consume the extracted editor support module, keep the legacy image/video TipTap nodes and media compatibility helpers present, and reject those extracted definitions reappearing in the parent editor file.
  - **Post Editor Save Helper Smoke Coverage**: Added smoke coverage that requires `PostEditor.tsx` to consume the extracted save helper boundary, rejects duplicated save/autosave helper definitions in the parent file, and preserves live-content save source, schedule normalization, autosave feedback, and conflict guard markers.
  - **Contact & Newsletter Smoke Coverage**: Added smoke guards for backend contact required-field enforcement, contact rate-limit alignment, newsletter enabled-state parity, newsletter honeypot wiring, URL-encoded subscriber search, paginated contact submissions, and valid shortcode/tag helper output.
  - **Admin Closeout Smoke Coverage**: Added smoke guards for security-table setup method parity, bounded security-log pagination, persisted Extensions install/uninstall state, public plugin status parity, and article-only plugin render guards.
  - **Profile Route Smoke Coverage**: Added smoke coverage for route-level profile pending skeletons, positive profile cache handoff, request-id stale response rejection, abortable profile fetches, username-match validation, and real 404 fallback for unresolved public profiles.
  - **TechPress Profile Tab Smoke Coverage**: Added smoke coverage so the active TechPress profile Articles tab cannot regress to white text or underline on a light background.
  - **TechPress Profile Username Smoke Coverage**: Added smoke coverage so the TechPress public profile username and status copy cannot regress to gradient-clipped or low-contrast mobile text.
  - **Roadmap Scope Merge**: Folded the former `v1.24.6` Post Editor extraction reserve into the same `v1.24.5` maintenance-extraction lane so HourGlass does not carry two separate editor-refactor patch slots for the same functional area.

### [v1.24.4] - 2026-05-17

> HourGlass micro-polish patch for public interaction smoothness, comments-off first paint, editor video tools, import runtime guardrails, and theme preload cleanup.

- **Public Interaction & Theme Loading**:
  - **Immediate Old-Post Navigation & Route-Level Pending Guard**: Public discovery clicks now fall straight into the internal `/post/:id` single-post route when an older result sits outside the current preload, and the app holds a route-level loading state until the current `get_post.php` request settles instead of letting theme-level not-found/home fallbacks flash first.
  - **Debounced Search Result Stability**: The shared public discovery hook now keeps live typing local, sends server-backed search/category requests only from the debounced term, aborts stale in-flight requests, and preserves the current visible list when the preload fallback would otherwise flash empty before the next response arrives.
  - **Theme Search Loading Polish**: Default and Digest now show an explicit loading state during first server-backed search/category fetches instead of briefly jumping straight to the empty-results UI before the next response arrives.
  - **Comments-Off First-Paint Parity**: Initial public settings now hydrate `discussionEnabled` from the PHP bootstrap so comments-disabled posts do not briefly render discussion CTA copy like "Be the first to comment" before the async settings request settles.
  - **Corporate Pro Entry-Chunk Cleanup**: Removed the dedicated Corporate Pro manual chunk/preload path from the main Vite entry so TechPress, Digest, and other non-Corporate sites no longer prefetch the Corporate Pro theme bundle on every public page load.
  - **Sidebar Chunk Cycle Cleanup**: `VpSidebarWidget` now imports `AdBlock` and `sanitizeHtml` from their direct source modules instead of routing back through the shared theme barrel, removing the Rollup circular-chunk warning that started surfacing during production builds and release packaging.
- **Editor & Import UX Polish**:
  - **Video Bubble Anchor Repair**: Editor video tools now anchor directly to the selected iframe and recalculate after aspect/layout changes, preventing the floating bubble from drifting below the embed or needing a second click before it snaps back into place.
  - **Database Import Runtime Guard**: `import_db.php` now uses a bounded 300-second execution window instead of disabling PHP timeouts entirely, reducing shared-hosting stall risk while keeping the streamed SQL parser and destructive-import safety backup flow intact.
- **Regression & Quality Guard**:
  - **Public Discovery Interaction Smoke Coverage**: The smoke gate now locks immediate old-post route fallback, route-level single-post pending protection before real 404s, stale single-post request rejection, debounced/abortable public search fetches, repeated-search non-empty transitions, comments-off hydration, and the no-Corporate-Pro preload contract.
  - **Sidebar Chunk Cycle Smoke Coverage**: Added smoke coverage that rejects `VpSidebarWidget` importing shared helpers back through the theme barrel, so future builds catch the circular chunk path before release packaging.
  - **Root License Version Guard**: Re-aligned the root license notice with `v1.24.4` and added it to the docs version smoke gate so Source packages cannot ship a stale canonical license version marker.
  - **Roadmap Closeout Alignment**: Updated `ROADMAP.md` so `v1.24.4` is marked closed after the full release audit and package refresh, with larger image-authoring ideas deferred instead of appearing as active patch blockers.
  - **Ads Roadmap Clarification**: Clarified that the next Ads Manager lane first hardens the existing Header / In-Feed / Popup slots for responsive safety, while larger background, page-skin, gutter, and other theme-aware placement zones remain a separate future expansion.
  - **Editor Video Bubble Smoke Coverage**: Added smoke coverage that rejects broad wrapper-based video targeting and requires post-change repositioning markers for the video bubble.
  - **Database Import Runtime Smoke Coverage**: Added smoke coverage that rejects unbounded `set_time_limit(0)` database imports.

### [v1.24.3] - 2026-05-13

> HourGlass closeout patch for dashboard truth, public discovery beyond the 200-post preload boundary, and final release alignment.

- **Admin Dashboard Truth Alignment**:
  - **Welcome Stats Total Fix**: The dashboard `Articles` and `Pages` cards now fetch real `meta.total` counts from `get_posts.php` and `get_pages.php` instead of trusting the globally preloaded 200-item arrays, so sites with 201+ posts no longer freeze the welcome stats at `200` while the Post Manager already shows the correct total.
- **Public Discovery Scale Follow-up**:
  - **Shared Public Posts Query Hook**: Added a shared public discovery hook that keeps homepage preload lightweight but switches search/category/load-more flows onto `get_posts.php` with `page`, `limit`, `category`, `search`, and `meta.hasMore` / `meta.total` once the public list needs more than the first 200 posts.
  - **Search-Enabled Theme Parity**: Default, TechPress, Prism, and Digest now keep public search on the server-backed discovery path instead of relying on the capped `useContent` preload, so older published posts stay discoverable after a site grows beyond 200 items.
  - **Category & Load-More Parity**: Default, TechPress, Prism, Digest, Portfolio, and Corporate Pro now continue category browsing and load-more from server pagination instead of local preload-only slicing, so category views can keep surfacing older posts beyond the homepage preload boundary.
  - **Fallback Search Contract Alignment**: The public fallback search path now mirrors the narrow server search contract (`title` / `content`) instead of briefly matching `excerpt` or `category` locally and then dropping those results after the server-backed handoff.
  - **Category Label Contract Alignment**: Public category discovery now trims and binds the same saved category labels that the admin/category settings flow allows, instead of silently skipping punctuation-heavy or non-ASCII category names because of an API-side regex mismatch.
  - **Theme Search Timing Alignment**: Default and Prism now let the shared public discovery hook own the search debounce, removing the extra theme-level delay so public search timing stays consistent with TechPress and Digest.
- **Theme Hero Framing**:
  - **TechPress/Digest 16:9 Hero Restore**: TechPress and Digest desktop hero images now keep the same stable `16:9` frame used on smaller screens instead of overriding into tall min-height stretch crops, reducing aggressive cropping for text-heavy news thumbnails.
- **Regression & Quality Guard**:
  - **Dashboard Totals Smoke Coverage**: Added a dedicated smoke guard so the dashboard keeps its own total-count owner path instead of falling back to capped `posts.length` / `pages.length` values.
  - **Public Discovery 200+ Smoke Coverage**: Tightened the smoke gate so the shared public posts query hook, Default parent wiring, search-enabled themes, category/load-more themes, category-label contract, and fallback search semantics cannot silently fall back to preload-only filtering capped at the first 200 posts.
  - **TechPress/Digest Hero Framing Smoke Coverage**: Added a smoke guard that rejects the old desktop `lg:aspect-auto` and min-height hero overrides so both sibling news themes keep the intended `aspect-video` frame.
  - **Category Count Metadata Alignment**: `get_posts.php` now binds the same trimmed category label for both the paginated result query and `meta.total`, preventing padded direct category requests from returning correct rows with mismatched counts.
  - **GPL License Packaging Alignment**: Re-aligned the packaged README license link with `docs/LICENSE.md` and added the current release marker to the packaged GPL license summary so release smoke checks match the GitHub-ready license copy.
  - **Release Changelog Casing Hygiene**: Release packaging and docs now use the real `Changelog.md` filename casing so Deploy/Source packages and case-sensitive documentation links stay aligned.
  - **Roadmap Scope Wording Cleanup**: Clarified `v1.24.3` as the active HourGlass closeout buffer instead of implying unfinished editor/theme follow-ups were already closed.
  - **HourGlass Plan Archive Cleanup**: Removed the stale HourGlass working-plan file and moved the active planning guard to `ROADMAP.md` so future release work follows one current planning source.

### [v1.24.2] - 2026-05-08

> HourGlass stability and reliability patch. Fixes theme search crashes, profile 404 behavior, admin search responsiveness, and editor styling parity.

- **Theme & Profile Stability**:
  - **TechPress Search Crash Fix**: Fixed a regression where searching for non-existent content caused a crash on the front page. Added a safety guard for `heroArticle` and `author_data` in the TechPress theme layout.
  - **Authentic Profile 404s**: Removed the placeholder user fallback that created "ghost" profile pages for non-existent usernames. Implemented a strict 404 redirect gate in the main router.
  - **Portfolio Profile Resolver Parity**: Removed the remaining Portfolio theme `temp` profile fallback and routed profile rendering through the shared public-profile resolver so invalid usernames cannot render fake portfolio profiles.
  - **FOUC Prevention**: Fixed the Flash of Unstyled Content on hard reloads by injecting critical background and text colors directly into the `index.html` head before Tailwind CSS is parsed.
  - **Disabled Comments Notice Restore**: Restored the public "Comments are disabled for this site." notice when discussions are turned off, preventing theme wrappers from leaving an empty bordered discussion shell.
- **Admin Post Manager Search Overhaul**:
  - **Manual Trigger Search Restored**: The Post Manager search now uses manual form submission to eliminate "two-step" latency and ensure deliberate fetching.
  - **Flicker-Free UX**: Eliminated the "blinking" loading state by keeping the current table visually stable during manual search fetches instead of fading the table or showing an input spinner.
  - **Practical Search Logic**: Updated the backend `get_posts.php` to keep the direct FULLTEXT search path with a narrow title `LIKE` fallback, avoiding broad content `LIKE` scans and per-request index probing.
  - **Search Smoothness Follow-up**: Tightened the Post Manager search cleanup so manual search keeps the table visually stable during fetches, while `get_posts.php` uses the direct FULLTEXT path with a narrow title `LIKE` fallback instead of broad content `LIKE` or per-request index probing.
- **Editor & Content Parity**:
  - **Table Styling Parity**: Implemented a public style system for tables, headers, and cells so that content created in the editor maintains its visual structure in the public view.
  - **Quote & Code Block Parity**: Code Block insertion now creates a native TipTap `codeBlock` node instead of relying on sanitized raw HTML, while public post rendering now gives blockquotes, inline code, and code blocks visible styling that matches the editor/preview intent.
  - **News-Site Paste Typography Guard**: TipTap now sanitizes pasted HTML through the editor paste transform before ProseMirror parses it, preventing intermittent news-site or office paste fragments from carrying font-size/font-family residue into individual paragraphs.
  - **Sticky Editor Toolbar Offset**: Re-anchored the scrolling editor toolbar to the top edge of the editor like the stable `v1.23.10` behavior, while keeping the subtle floating elevation only after the toolbar actually sticks.
  - **Image Source & Alignment Parity**: Credited images now preserve the surrounding `figure` style through TipTap restore/save, and the editor alignment controls update the image and figure together so centered/right/left images and source captions match the public render after editing old posts.
  - **Image Bubble Alignment Spam Fix**: Image bubble alignment, size, alt-text, and credit updates now write directly to the selected TipTap `legacyImage` node attributes instead of reparsing the ProseMirror DOM, preventing repeated alignment clicks from accumulating empty paragraph spacing below images.
  - **Public Image/Figcaption Styling**: `ContentRenderer.tsx` now carries baseline image, figure, and figcaption styles so source captions have the same visible treatment outside the editor instead of relying on theme accidents.
- **Regression & Quality Guard**:
  - **Post Slug Separator Normalization**: Frontend and backend post save paths now collapse repeated hyphens after slug cleanup, so titles with spaced dash separators like `dalaman - Annuar` save as a canonical single-hyphen slug instead of `---`.
  - **Save Post PDO Static Analysis Cleanup**: Narrowed the configured PDO handle in `save_post.php` before transaction and `prepare()` calls, clearing nullable-PDO IDE warnings without changing save behavior.
  - **PHP Warning Cleanup**: Initialized search-related variables in `get_posts.php` to clear IDE "undefined variable" warnings during SQL binding.
  - **Static Analysis Cleanup**: Narrowed the configured PDO handle in `get_posts.php` before `prepare()` calls and documented the single-post noscript helper parameter/return contract, clearing IDE warnings without changing request behavior.
  - **Public Index Noscript Safety**: The single-post `<noscript>` visibility fallback now renders escaped, block-aware, entity-normalized text-only post content instead of echoing raw saved HTML or concatenating image captions into article paragraphs.
  - **Live Table/Header Parity Follow-up**: Public post rendering now keeps TipTap tables on real table layout instead of forcing `display: block`, paints table header cells directly for tables saved without a `<thead>`, and keeps mobile `h4`/`h5`/`h6` sizing in a clear descending hierarchy.
  - **README Release Snapshot Alignment**: Updated the README release snapshot and shipped-work summary from the closed `v1.23.10` Rentaka baseline to the current `v1.24.2` HourGlass release line.
  - **Roadmap Patch Slot Cleanup**: Clarified `v1.24.3` as a proof-backed HourGlass closeout buffer and added an explicit reserved `v1.24.4` skip slot so empty patch headings are not mistaken for hidden feature scope.
  - **Integration Test Coverage**: Added fresh regression guards for search logic, profile 404 behavior, Portfolio profile resolver parity, disabled-comments notice rendering, image figure/alignment restore parity, image alignment node-attribute updates, TipTap paste typography cleanup, sticky editor toolbar offset, slug separator normalization, PDO static-analysis narrowing, table styling, stable manual search UX, public-index `<noscript>` normalization, live header-cell styling, mobile heading hierarchy, and public quote/code block parity.

### [v1.24.1] - 2026-05-06

> HourGlass editor stabilization patch focused on the TipTap migration follow-up bugs found after the initial `v1.24.0` activation.

- **HourGlass Editor Stabilization**:
  - Preserved `type/id` in the admin editor URL so post/page edit routes can recover the active item after browser refresh instead of redirecting back to the Content Manager list.
  - Reset the editor route scroll position on entry so opening the editor from a scrolled list starts at the title and toolbar instead of a mid-page offset.
  - Added an explicit content revision sync between `PostEditor.tsx` and `Editor.tsx` so AI append/replace actions and full-content restores update both the TipTap canvas and SEO analysis state.
  - Prevented blank-surface clicks from forcing non-empty documents to jump to the end while keeping the empty-canvas focus contract intact.
  - Restored viewport-sticky toolbar behavior and added clearer image/video block spacing so the writing canvas rhythm better matches the public render.
  - Re-anchored image/video editor tooltips to the editor shell and recalculated them on page/container scroll so media tools stay attached to the selected block instead of drifting after the TipTap layout change.
  - Added scroll-aware toolbar elevation so the sticky editor toolbar gains a subtle shadow/ring only while floating and returns flat at its original position.
  - Repaired toolbar link/table/cursor behavior by normalizing pasted link URLs, adding visible table cell styling in the writing canvas, and removing hover movement from toolbar buttons.
  - Restored explicit bullet-list, numbered-list, and blockquote canvas styling so TipTap list/quote commands render visibly instead of appearing as ghost/plain text changes.
- **Public Discussion Toggle Fix**:
  - Disabled public discussions now hide the entire comment block instead of leaking the empty-state "Be the first to comment" placeholder.
  - Public settings hydration now includes `discussionEnabled`, and the public settings fallback whitelist includes `discussion_enabled` for older settings-table schemas.
- **Editor SEO Score Fix**:
  - SEO Health now uses the manual excerpt as the meta-description fallback and no longer returns `0` just because full content is empty or still loading.
  - Admin editor SEO analysis now keeps full post content/SEO restore separate from navigation/add-to-menu updates, preventing restored content from being reset back to the slim post-list payload.
  - SEO analysis now scores visible text extracted from restored editor HTML and detects H2/H3 headings and images case-insensitively, matching what authors see in the editor instead of raw HTML noise.
  - The admin editor now shows a temporary "Restoring SEO data" state instead of flashing a misleading SEO score from the slim post-list payload while full content is loading.
  - Empty drafts no longer start with a fake `5/100` SEO score from the old no-image bonus; the SEO panel now renders the analyzer's real empty-state baseline instead.
  - Empty editor drafts now keep the SEO Health card visible in the right sidebar with the analyzer's real `0/100` baseline instead of hiding the score panel entirely.
  - TipTap external content restores now cancel any pending debounced editor change before syncing the restored HTML, preventing stale empty editor updates from overwriting full post content and dropping the dashboard SEO score to a title/meta-only baseline.
  - Manual save and autosave now read the latest TipTap/source editor content from a live ref, so edits made immediately before Save, Publish, or the autosave tick cannot be missed while the debounced React state is still settling.
  - Existing posts now always refresh their full post HTML before admin SEO analysis, so legacy/teaser payloads cannot make the dashboard score diverge from the frontend Quick Edit score for the same post.
  - Word/office paste cleanup now strips font-size, font-family, and `mso-*` residue from pasted editor HTML so imported text follows the active theme instead of carrying document typography into posts.
  - Autosave now treats restored full post content as the clean baseline and sends the editor's last-known `updated_at` timestamp with saves, preventing a stale same-user tab from silently overwriting newer edits while showing a conflict-specific reload notice when a `409` blocks the save.
  - Successful autosave/manual saves now refresh the Post Editor's local `updated_at` baseline, item ref, and live content ref, preventing false `409` conflict notices when publishing a newly created draft after image insertion or autosave.
  - Existing-post full-content restore now refreshes the live autosave item ref immediately, preventing old post edits from autosaving against the slim/stale list payload timestamp and showing a false conflict notice.
  - Admin/editor single-post reads no longer increment public `views`, and public view tracking now preserves `updated_at`, preventing the editor's own full-content restore request from making old post saves fail with a false `409` conflict.
- **Release Packaging Safety**:
  - `create_release.cjs` now cleans only standard VonCMS Deploy/Source release ZIPs and SHA256 pairs, preserving non-standard backup/reference ZIPs instead of deleting every root ZIP.
- **Build Bundle Hygiene**:
  - Split TipTap, ProseMirror, and their small editor support dependencies into a dedicated `vendor-editor` build chunk so the HourGlass editor stack no longer bloats the generic vendor bundle.
- **Theme Navigation Responsiveness**:
  - Added a shared three-item header navigation cutoff and wired it into Default, Digest, TechPress, Corporate Pro, Portfolio, and Prism so tablet headers switch to the burger menu when a site has more than three menu items.
  - Desktop theme headers now keep only the first three menu items visible before the existing More/overflow menu, reducing mid-width header crowding without changing saved navigation data.
- **Open Source Contributor Guardrails**:
  - Added root `CONTRIBUTING.md` with VonCMS-specific source-of-truth order, core contracts, do-not-break rules, verification expectations, and pull request checklist for the future open-source milestone.
  - The guide explicitly protects the HTML editor storage contract, bundled-theme parity, `public/security.php`, `server/test-integration.cjs`, and `create_release.cjs`.
- **HourGlass Plan Cleanup**:
  - Reorganized HourGlass planning in `ROADMAP.md` so shipped `v1.24.1` stabilization work is separated from `v1.24.2+` editor/Post Editor slimming and Quick Edit scroll-restore follow-up work.
- **Regression Coverage**:
  - Added smoke guards for editor URL persistence, reload recovery, external content sync, sticky toolbar behavior, media spacing rhythm, and the no-jump focus contract.
  - Added smoke guards for scroll-tracked editor tooltips, public discussion toggle rendering, and SEO score input fallback behavior.
  - Added smoke guards for Admin SEO single-source sync, sticky toolbar elevation, URL normalization, table visibility, and stable toolbar hitboxes.
  - Added smoke guards for list/number/blockquote visibility, visible-text SEO scoring, and the admin SEO restore gate.
  - Added a runtime smoke guard for the SEO analyzer baseline so empty drafts must score `0` and missing images cannot grant free points.
  - Tightened the admin SEO restore guard so any existing post must use the full single-post payload, even when the opening payload already contains partial content.
  - Added a smoke guard so the Post Editor SEO Health card cannot disappear when the editor content is empty.
  - Added a smoke guard so full-content TipTap restores clear stale debounced editor updates before the SEO analyzer sees the restored post body.
  - Added smoke guards for TipTap save freshness so pending visual/source edits flush before focus leaves the editor and save/autosave paths read live editor content.
  - Added a smoke guard so release cleanup cannot regress to deleting non-release backup/reference ZIPs.
  - Added a smoke guard for the Vite editor vendor chunk policy so TipTap/ProseMirror dependencies cannot fall back into the generic vendor chunk.
  - Replaced the old paste-typography preservation guard with a Word paste cleanliness guard covering font-size, font-family, and `mso-*` style residue.
  - Added a smoke guard for autosave conflict handling so restored content updates the clean baseline, stale editor tabs receive a `409`, and publishers see a clear reload notice instead of silently missing the failed save.
  - Added a smoke guard so successful saves must refresh the local Post Editor timestamp baseline before the next publish/save attempt.
  - Added a smoke guard so existing-post full-content restore must refresh the autosave item/timestamp baseline before the next autosave or update attempt.
  - Added a smoke guard so admin/editor single-post reads skip public view tracking and public view tracking cannot mutate `updated_at` or poison the editor conflict baseline.
  - Added smoke guards for the shared three-item tablet navigation cutoff, all six bundled theme header integrations, the root contributor guide, and the HourGlass roadmap/working-plan cleanup.
- **Release Scope**:
  - Version, README, primary docs, package manifests, and release artifacts are aligned on `v1.24.1`.
  - Remaining editor/Post Editor file-slimming work stays in the roadmap as the next HourGlass follow-up, not as a blocker for this stabilization patch.

### [v1.24.0] - 2026-05-03

> Initial patch of the `v1.24.x` "HourGlass" series focused on the TipTap editor migration, content cleanup, SEO polish, login-rate-limit hardening, and bundle-size cleanup.

- **HourGlass Editor V2 Activation & Canvas Polish**:
  - `Editor.tsx` now runs on the TipTap HTML-backed editing surface instead of the older raw `contentEditable` engine while preserving VonCMS HTML save/render compatibility, media tools, and source-view flow.
  - The visual editor now restores typing reliably when authors click the empty canvas area, removing the dead-zone behavior where keyboard input only resumed after clicking the exact live text line.
  - Refreshed the editor shell so the TipTap migration reads as an actual new writing experience instead of a silent internal swap.
  - Follow-up UI cleanup removed the temporary migration banner, made the toolbar the first visible row again, tightened canvas chrome, replaced the hardcoded empty-canvas rail with the TipTap paragraph placeholder line, and reworked the image insert control into a cleaner split-style dropdown button.
  - AI writing and grammar review no longer sit in the `PostEditor` action bar. The flow now lives in a dedicated right-side `AI Assistant` panel with explicit preview, append, replace, and discard actions before content touches the article body.
  - AI generation now uses a stricter human-tone prompt contract that rejects generic conclusion/final-thoughts sections, em-dash output, and obvious AI-signature phrases before sending requests to Gemini.
- **Release Surface Alignment**:
  - README and primary docs now identify the current `v1.24.0` line as "HourGlass" instead of carrying stale current-release "Rentaka" labels, while historical `v1.23.10` Rentaka closeout notes remain unchanged.
  - The smoke gate now checks the HourGlass docs label and `v1.24.x` routing guide marker so future release packages catch stale release copy before shipping.
- **Content Cleanup & SEO Polish**:
  - **Excerpt vs Meta Description Auto-Fill**: `PostEditor.tsx` now applies distinct constraints when auto-filling text. Excerpts are safely extracted up to 250 characters for richer feed UI, while Meta Descriptions strictly pull exactly 160 characters direct from the content (ignoring the longer excerpt) to meet precise Google/SEO limits. This eliminates identical duplicate text between the two fields.
  - **Language-Agnostic Strict Bigrams**: `seoAnalyzer.ts` now enforces a stricter bigram (2-word phrase) extraction algorithm. By requiring BOTH words to bypass the statistical stop-word filter (`&&` instead of `||`), the AI tag generator naturally drops filler phrases (e.g., "yang lebih", "the car") globally. This preserves full multilingual support without hardcoding language-specific dictionaries.
  - **Article Schema Polish (H-21)**: `public/index.php` and `VonSEO.tsx` now keep post schema on `Article`, attach `author.url` to the canonical `/profile/:username` route, and emit explicit ISO 8601 publish/modify timestamps with timezone data so Google rich-result warnings do not fall back to partial article metadata.
- **Security & Stability Polish**:
  - **Escalating Rate-Limit Penalties**: `RateLimiter` (`public/security.php`) now tracks repeat offenders. Instead of resetting the slate to zero after a 15-minute ban, subsequent lockouts now escalate mathematically (15 minutes → 1 hour → 24 hours). A successful login will completely clear the penalty history.
- **Performance & Asset Optimization**:
  - **Corporate Pro Icon Slimming**: Removed the bulk `import * as Icons from 'lucide-react'` in `src/themes/corporate-pro/Layout.tsx`. Replaced it with a selective `LucideIconMap` (Menu, X, Target, Cpu, etc.) to reduce the theme icon import surface and support better first-load behavior.
  - **Corporate Pro Icon Compatibility Guard**: Corporate Pro now uses a curated Lucide icon map for known theme icons; any broader custom-icon expansion should preserve the measured bundle/LCP benefit instead of reintroducing the bulk icon import.

### Older Releases

> Pre-HourGlass release history was compressed on 2026-05-14 to keep the GitHub changelog readable. The detailed v1.24.x release notes above remain the active source of truth for the current HourGlass line.

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

For forensic history before `v1.24.x`, use repository history or archived release artifacts instead of expanding this root changelog again.
