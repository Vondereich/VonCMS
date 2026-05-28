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
