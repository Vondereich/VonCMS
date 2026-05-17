### [v1.24.4] - 2026-05-17

> HourGlass micro-polish patch for public interaction smoothness, comments-off first paint, editor video tools, import runtime guardrails, and theme preload cleanup.

- **Public Interaction & Theme Loading**:
  - **Immediate Old-Post Navigation**: Public discovery clicks now fall straight into the internal `/post/:id` single-post route when an older result sits outside the current preload, removing the brief index/not-found-style bounce that happened while the app waited on a pre-navigation `get_post.php` lookup.
  - **Search Result Stability**: The shared public discovery hook now preserves the current visible list during repeated server-backed search/category fetches when the preload fallback would otherwise flash empty before the next response arrives, reducing the low-end-device flicker seen after multiple searches.
  - **Theme Search Loading Polish**: Default and Digest now show an explicit loading state during first server-backed search/category fetches instead of briefly jumping straight to the empty-results UI before the next response arrives.
  - **Comments-Off First-Paint Parity**: Initial public settings now hydrate `discussionEnabled` from the PHP bootstrap so comments-disabled posts do not briefly render discussion CTA copy like "Be the first to comment" before the async settings request settles.
  - **Corporate Pro Entry-Chunk Cleanup**: Removed the dedicated Corporate Pro manual chunk/preload path from the main Vite entry so TechPress, Digest, and other non-Corporate sites no longer prefetch the Corporate Pro theme bundle on every public page load.
  - **Sidebar Chunk Cycle Cleanup**: `VpSidebarWidget` now imports `AdBlock` and `sanitizeHtml` from their direct source modules instead of routing back through the shared theme barrel, removing the Rollup circular-chunk warning that started surfacing during production builds and release packaging.
- **Editor & Import UX Polish**:
  - **Video Bubble Anchor Repair**: Editor video tools now anchor directly to the selected iframe and recalculate after aspect/layout changes, preventing the floating bubble from drifting below the embed or needing a second click before it snaps back into place.
  - **Database Import Runtime Guard**: `import_db.php` now uses a bounded 300-second execution window instead of disabling PHP timeouts entirely, reducing shared-hosting stall risk while keeping the streamed SQL parser and destructive-import safety backup flow intact.
- **Regression & Quality Guard**:
  - **Public Discovery Interaction Smoke Coverage**: The smoke gate now locks immediate old-post route fallback, repeated-search non-empty transitions, comments-off hydration, and the no-Corporate-Pro preload contract.
  - **Sidebar Chunk Cycle Smoke Coverage**: Added smoke coverage that rejects `VpSidebarWidget` importing shared helpers back through the theme barrel, so future builds catch the circular chunk path before release packaging.
  - **Root License Version Guard**: Re-aligned the root license notice with `v1.24.4` and added it to the docs version smoke gate so Source packages cannot ship a stale canonical license version marker.
  - **Roadmap Closeout Alignment**: Updated `ROADMAP.md` so `v1.24.4` is marked closed after the full release audit and package refresh, with larger image-authoring ideas deferred instead of appearing as active patch blockers.
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
  - **HourGlass Plan Archive Cleanup**: Removed the stale root `HOURGLASS_PLAN.md` working-plan file and moved the active HourGlass planning guard to `ROADMAP.md` so release agents follow one current planning source.

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
  - **Roadmap Patch Slot Cleanup**: Clarified `v1.24.3` as a proof-backed HourGlass closeout buffer and added an explicit reserved `v1.24.4` skip slot so future agents do not treat empty patch headings as hidden feature scope.
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
  - Reorganized `Roadmap.md` and `HOURGLASS_PLAN.md` so shipped `v1.24.1` stabilization work is separated from `v1.24.2+` editor/Post Editor slimming and Quick Edit scroll-restore follow-up work.
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
  - **CRITICAL AUDIT NOTE (Codex/Dev)**: Verify if any custom icons set by users in the theme settings are missing. If the "Dynamic Icon" feature is too restricted, consider expanding the `LucideIconMap` or reverting to the bulk import after measuring the real bundle/LCP tradeoff.

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
