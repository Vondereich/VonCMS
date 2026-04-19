# VonCMS Roadmap

Last updated: 18 April 2026

## Project Timeline & Context

> **Development started: ~October 2025 (6-7 months of continuous development as of April 2026).**
> This is not a 3-month side project — it is a sustained, committed product with a clear roadmap through v1.29 and beyond.
> Current release line: v1.23.x "Rentaka" → target v1.25.x for the Open Source milestone.
> Architecture: Hybrid Decoupled CMS (React 19 SPA + PHP REST API, single deploy, no Node.js production requirement).
> Codebase maturity: 78 API endpoints, 6 bundled themes, full admin/editor/media/SEO/redirect systems.
> Market positioning: WordPress alternative for publishers who want modern tooling on ordinary hosting.

This roadmap is a planning document, not a guarantee. Priorities can move as release work, hosting realities, and product direction change.

Important reading note:

- items below describe product direction and candidate work, not acceptance criteria for the current release
- some areas may already have partial groundwork in the codebase without being treated as finished product work
- release audits should treat `CHANGELOG.md` as the source of shipped truth, while this file stays focused on where VonCMS is heading next

## Musyawarah Protocol (Multi-Agent Coordination)

VonCMS is maintained by multiple AI agents (Qwen, Claude, Gemini, Codex) and the human owner.
This section defines how we work together without breaking context, overwriting each other, or creating loops.

### Core Principles

1. **Read before edit** — No agent touches code without reading the relevant files and any existing agent notes first.
2. **Evidence over ego** — Disagreements are resolved by reading actual code, not by who spoke first or loudest.
3. **Build on, don't undo** — If a previous agent left notes, audits, or estimates, treat them as a starting point — not something to redo from scratch.
4. **Owner has final say** — Agents advise, owner decides. No agent implements without user approval.
5. **Log everything** — Every audit, estimate, code read, and decision gets logged in this file so the next agent has context.

### How Agents Disagree

When an agent disagrees with a previous agent's assessment:

```
1. Read the code yourself — don't trust the previous agent blindly
2. If you disagree, state:
   - What the previous agent said
   - What the code actually shows (with file path and line references)
   - Why your reading differs
3. Do NOT undo the previous agent's work unless the owner approves
4. Update this file with your finding so the next agent sees both perspectives
```

**Example:**

> _"Previous agent estimated '2-3 lines' for LoadMoreButton error fix. After reading `src/components/LoadMoreButton.tsx` and grep-ing usage across 6 themes + UserProfile, the actual scope is ~20-30 lines because 8 parent components need to pass the new error prop."_

### How Agents Build On Each Other's Work

```
1. Read existing agent notes in this roadmap
2. If you agree → add your confirmation: *"AgentName (date): Confirmed. Same reading."*
3. If you have more detail → add supplementary notes: *"AgentName (date): Additional finding — X also affects Y file."*
4. If you disagree → add your counter-finding with code evidence (see "How Agents Disagree" above)
5. Never delete another agent's notes — only append your own
```

### Issue Lifecycle

Each issue in this roadmap goes through these stages:

```
[ ] Open — not started, has agent notes with scope estimate
[>] In Progress — an agent has user approval and is working on it
[x] Shipped — code changed, changelog updated, verified
```

When an agent completes an issue, they should:

- Change `[ ]` to `[x]`
- Add a **"Shipped by"** note with date and agent name
- Update `CHANGELOG.md` with the change
- Note any deviations from the original plan (e.g., _"Took different approach because X"_)

### What Agents Must NOT Do

- ❌ Delete or overwrite another agent's notes without owner approval
- ❌ "Standardize" or "harmonize" code across files unless explicitly asked
- ❌ Implement without telling the user what files will change and why
- ❌ Assume roadmap wording is current — verify against code first
- ❌ Treat backlog items as evidence that the current release is unstable

### What Agents MUST Do

- ✅ Read `golden-rules.md` before touching any code
- ✅ Read existing agent notes in this roadmap before starting
- ✅ State exact files and reason before any edit
- ✅ Wait for user confirmation before editing
- ✅ Log findings in this roadmap so the next agent has context
- ✅ Leave a clean handover — file list, what changed, what was verified
- ✅ Check `WAR-ROOM.md` for active discussions and current session status

---

## Active Coordination

Real-time agent discussion and session logs: see **`WAR-ROOM.md`** in repo root.

---

## Active Roadmap

Active planning starts below. Shipped `v1.22.x` items were moved into the archive section so this file stays backlog-focused.

## Current cycle: v1.23.x – v1.25+ release roadmap

Each version cycle has a clear focus. No cramming — if there's too much, it goes to the next version.

### v1.23 — New Features

User-facing features and admin enhancements.

> **Owner scope lock (2026-04-18):** With `v1.23.0` now cut as the public baseline, only 2 roadmap items remain in active follow-up scope for the `v1.23.x` series:
>
> 1. `ContentManager` author column
> 2. Promo bar solid color picker
>
> Duplicate post detection and Ads Manager sizing work stay deferred to the post-`v1.23.x` backlog.

> **Patch sequencing note (2026-04-18):**
>
> - `v1.23.1` target: `ContentManager` author column
> - next feature patch in `v1.23.x`: promo bar solid color picker
> - security / audit-only hardening can ship in between without changing the feature order above

#### `v1.23.1` target — Content Manager Enhancements (🟢 Low risk)

- [ ] Post/Page manager show author column in content list (`ContentManager.tsx`)
- [ ] Use the existing post/page author contract with a safe empty fallback instead of adding new API work (`get_posts.php`, `get_pages.php`)

#### Next feature patch in `v1.23.x` — Promo Bar Solid Color Picker (🟢 Low risk)

> Planned for the next feature-bearing `v1.23.x` patch after the author-column work. If a security-only patch needs to ship first, this item can move from `v1.23.2` to `v1.23.3` without changing scope.

- [ ] Remove hardcoded `bg-gradient-to-r from-pink-600 to-purple-600` from promo bar, replace with solid color picker (`promo-bar/index.tsx`)
- [ ] User can pick any solid background color via extension settings (default: `#db2777` pink-600)
- [ ] Auto text color (white on dark, dark on light) for readability

---

### Post-v1.23.x Deferred Backlog

Items below are intentionally out of scope for the active `v1.23.x` follow-up scope.

- [ ] Duplicate post detector — flag posts with same/similar title or content for easy cleanup (`ContentManager.tsx`, `get_posts.php`)
- [ ] Header ad responsiveness — keep header/banner ads responsive to the available container width on desktop, tablet, and mobile instead of treating desktop slots like fixed 728x90 leaderboards (`AdSettings.tsx`, `AdBlock.tsx`, `index.css`)
- [ ] Popup ad responsiveness — keep popup/interstitial ads inside the current viewport so they scale safely on smaller screens without horizontal overflow or clipped content (`useAdsPopup.ts`, `VonPopupAd.tsx`, `AdBlock.tsx`)
- [ ] In-feed ad lane locking — keep in-feed ads constrained to the post/content lane instead of behaving like a full-width banner, so injected ads stay visually aligned with article cards and feed spacing (`AdBlock.tsx`, `themes/*/Layout.tsx`)
- [ ] Desktop size preservation — preserve valid modern desktop banner sizes such as `600x90`, `728x90`, `970x90`, and adaptive/fluid units without forcing them all toward a 728x90 presentation (`AdSettings.tsx`, `AdBlock.tsx`, `index.css`)
- [ ] Mobile overflow safety — ensure header and popup ad containers never exceed viewport width, while in-feed ads remain bounded by the content column on phone layouts (`AdBlock.tsx`, `index.css`, `themes/*/Layout.tsx`)
- [ ] Settings guidance cleanup — update Ads Manager helper copy so recommendations describe adaptive/fluid behavior clearly instead of biasing users toward a single leaderboard format (`AdSettings.tsx`)

---

### v1.24 — Maintenance & Stability

Quality of life fixes for existing features.

#### Autosave Reliability (🟡 Medium risk)

- [ ] Autosave countdown UI misleading — no countdown exists, only `Last saved` timestamp; timer state drifts after browser tab switch (`PostEditor.tsx`)
- [ ] Draft save feedback unclear on slow networks — current `Saving...` button state and toast resolve too fast; add persistent save status until server confirms

#### Media System Overhaul (🟡 Medium risk)

- [ ] **Media Manager search upgrade** — currently filters local results by name/title; add type and date filters, plus server-side search support (`MediaManager.tsx`, `list_media.php`)
- [ ] **Variant rebuild progress feedback** — current flow shows only a spinner on large batches; add batch progress indicator (`MediaSettings.tsx`, `media_tools.php`)
- [ ] **Richer gallery insertion in editor** — current flow supports single image + media browse; next step is multi-image selection and practical gallery/grid insert (`PostEditor.tsx`, `MediaManager.tsx`)
- [ ] **Thumbnail `object-position` polish** — smarter default for portrait images with text near top/bottom (`themes/*/Layout.tsx`)
- [ ] **Smarter media source and credit handling** — track image origin, attribution, and licensing metadata across media library
- [ ] **AI image generation (BYOK)** — connect own API provider, generate prompt-based images, save to Media Library, insert into editor (`MediaManager.tsx`, `PostEditor.tsx`). Keep small: prompt → preview → save → insert. One or two providers first. Use `-latest` model variant as default (e.g., `gemini-flash-latest`, `stable-diffusion-xl-latest`) so users don't need to manually update when new models drop. Same BYOK pattern as AI Writing — user enters own API key, model auto-detects latest version.

#### Frontend Quick Edit Polish (🟡 Medium risk)

- [ ] Quick edit modal doesn't preserve scroll position on save — handler closes modal and navigates without saving/restoring scroll state (`App.tsx`)

#### Database Manager Polish (🟡 Medium risk)

- [ ] Backup download filename uses generic `backup_voncms_<timestamp>.sql` — make it descriptive per site/project name (`backup_db.php`)

---

### v1.25 — Security & Performance

Hardening, caching, and cleanup.

#### Redirect Hardening (🟡 Medium risk)

- [ ] Redirect loop scanner doesn't catch 3-hop cycles (A→B→C→A) (`redirect_engine.php`)
- [ ] Wildcard redirects (`/old-*`) not working with query strings

#### Performance & Caching (🔴 High risk — needs staging test)

- [ ] Add `If-Modified-Since` support for static assets (`.htaccess` + `index.php`)
- [ ] File-based cache for public `get_settings` and `get_posts` responses (shared hosting friendly, no Redis) — cache invalidation hooks into `save_post.php`, `delete_post.php`
- [ ] Settings cache layer — cache DB results in memory, invalidate on save
- [ ] **COUNT(\*) Optimization** — cache or approximate `meta.total` for paginated queries, or switch to `hasMore`-only pagination to eliminate the pre-query full scan on InnoDB
- [ ] **`list_media.php` Column Select** — replace `SELECT *` with specific columns; enables covering index optimization on media queries
- [ ] **Timezone Query Caching** — `voncms_apply_site_timezone()` hits DB on every request; cache result in PHP opcache or static variable so it only queries once per process lifetime
- [ ] **Search Rate Limiting** — add request throttling on search endpoint to prevent abuse patterns (crawl spam, rapid-fire queries)
- [ ] **Persistent PDO Connections** — enable `PDO::ATTR_PERSISTENT` or implement connection pooling to reduce TCP handshake overhead at 100+ req/s
- [ ] **Covering Index on Posts List Query** — add composite index on the columns used by `get_posts.php` list query to avoid table lookups after index scan

#### Final Cleanup (🟢 Low risk)

- [ ] Remove all `console.log` leftovers from dev debugging (`src/`)
- [ ] Version number sync across all theme metadata headers
- [ ] Changelog final review — every claim verified before release

---

### v1.26 — Content Versioning + Per-User AI BYOK

Full revision history for posts and pages. Per-user AI API key privacy.

#### Admin UI & Branding Polish (🟢 Low risk)

- [ ] Admin Dark Mode Logo — Ensure VonCMS logo renders white (or auto-inverts) when the browser/OS is in dark mode (`index.php`, `themes/*`)

#### Post Revisions (🟡 Medium risk)

- [ ] Save content snapshot before each edit — full revision history (`save_post.php`, `PostEditor.tsx`)
- [ ] Revision compare UI — diff view between versions (`ContentManager.tsx` or PostEditor panel)
- [ ] Rollback to any revision — restore previous content from revision history

#### Per-User AI BYOK (🟢 Low risk)

- [ ] Each user (admin, writer, moderator) brings their own API key via Profile → AI Settings
- [ ] Admin sets global fallback, but individual users can override with their own provider + key
- [ ] Privacy-focused — admin cannot view user's key (write-only, masked)
- [ ] Applies to both AI Writing and AI Image Generation

---

### v1.27 — Role & Permission System

Granular access control for newsroom workflows.

#### Custom Role Builder (🔴 High risk)

- [ ] Granular permission matrix — who can publish, edit, delete, manage users, manage settings
- [ ] Custom role creation UI — build roles with specific capabilities, not just preset tiers
- [ ] Category-level permissions — restrict writers to specific categories

---

### v1.28 — Theme Developer Experience

Better tooling for custom theme work.

#### Starter Theme (🟢 Low risk)

- [ ] Blank starter theme for custom design work
- [ ] Clearer custom-theme contract and documentation
- [ ] Simple theme scaffolding helper — duplicate starter theme into new custom theme

#### Theme Enhancements (🟢 Low risk)

- [ ] Theme-specific widget containment improvements (currently only `trending` and custom HTML; expand to recent posts, categories, tags, newsletter)

---

### v1.29 — Integration & Webhooks

External service connectivity.

#### Webhook System (🟡 Medium risk)

- [ ] Generic webhook triggers — fire on post publish, update, delete, comment submit
- [ ] Webhook management UI — enable/disable, view delivery history, retry failed deliveries
- [ ] CDN purge API integration — auto-purge CDN cache on content changes

## Archive — Shipped v1.22.x

Shipped items are archived here so the active roadmap above stays focused on open work. `CHANGELOG.md` remains the source of shipped truth.

### Release snapshots

#### v1.22.0

- managed `# BEGIN VonCMS` / `# END VonCMS` `.htaccess` blocks
- safer `.htaccess` integrity and repair behavior for existing installs
- theme hydration sync to avoid stale theme flicker after fresh install flows
- TechPress trending card polish for long titles and media framing
- RSS rollout with clean URL aliases, footer RSS icons/links, and VonSEO access
- docs cleanup across install, security, VPS, changelog, and supporting guides

#### v1.22.1

- WordPress Importer featured image resolution via `_thumbnail_id` to attachment URL to `image_url`
- RSS discoverability tags and `llms.txt` rollout polish
- UTF-8 cleanup, avatar URL sync, and email verification consistency
- canonical URL consistency across PHP and frontend fallbacks
- payload and backup-streaming cleanup, plus `content_audit_logs` rollout
- full changelog audit completed against shipped code

### Archived delivery notes

- `v1.22.1` Editor Quick Fixes — shipped 2026-04-13
- `v1.22.2` Comment & Search Polish — shipped 2026-04-11
- `v1.22.3` Canonical URL normalization + reserved word bypass fix — shipped 2026-04-12
- `v1.22.3` Laragon fix and navigation toggle hardening — shipped 2026-04-11
- `v1.22.3` Upload and import file-permission hardening — shipped 2026-04-11
- `v1.22.5` Admin server-side pagination and search upgrade — shipped 2026-04-14
- `v1.22.5` AI model default polish (`gemini-flash-latest`) — shipped 2026-04-14
- `v1.22.6` FULLTEXT search plus missing-index alignment — shipped 2026-04-15

## Beyond v1.29 — Long-Term Scalability

These are architectural changes that touch deeper patterns. Not urgent — current architecture works fine without them. They become relevant when VonCMS serves high-traffic sites or needs horizontal scaling.

#### Cursor Pagination (🟡 Medium risk)

- [ ] Replace OFFSET-based pagination with cursor/keyset pagination (`WHERE created_at < :last_seen ORDER BY created_at DESC LIMIT 15`) for admin ContentManager and public feeds
  - **Why:** MySQL must scan and discard `OFFSET` rows. At page 5000 with limit 15, it scans 74,985 rows to return 15. Cursor pagination seeks directly to the target range.
  - **Trade-off:** Breaks "go to page N" UX. Best for infinite-scroll or "load more" patterns where users don't jump to arbitrary pages.
  - **Affected:** `get_posts.php`, `list_media.php`, `useContent.ts`, admin `ContentManager.tsx`

#### Client-Side API Caching (🟢 Low risk)

- [ ] Replace raw `vonFetch` with React Query / SWR pattern — stale-while-revalidate, deduplication, background refetch, `localStorage` / `sessionStorage` caching with TTL
  - **Why:** Every `loadContent()` call hits the API. Same homepage posts fetched repeatedly by returning users.
  - **Trade-off:** Adds dependency. Need careful invalidation on content changes.
  - **Affected:** `src/utils/api.ts`, `src/hooks/useContent.ts`, `src/hooks/useServerSearch.ts`

#### Distributed Session Store (🔴 High risk — breaking change)

- [ ] Replace PHP native filesystem sessions with Redis-backed session store or database-backed sessions
  - **Why:** Current sessions are tied to local filesystem. Cannot scale horizontally across multiple PHP instances without sticky sessions.
  - **Trade-off:** Requires Redis or session table. Adds dependency for multi-server setups. Single-server installs unaffected.
  - **Affected:** `public/security.php` session handling

#### In-Memory Rate Limiting (🟡 Medium risk)

- [ ] Replace file-based rate limiting (`data/rate_limits/*.json`) with APCu (single-server) or Redis (multi-server) store
  - **Why:** File I/O per rate-limited request. At high concurrency, filesystem locking becomes a bottleneck and race conditions are possible.
  - **Trade-off:** APCu doesn't work across processes on some PHP-FPM configs. Redis adds dependency. Current file-based approach works fine for shared hosting.
  - **Affected:** `RateLimiter` class in `public/security.php`

## Near-term product milestones

## Mid-term work

These items matter, but are not locked to a specific release:

- more polished backup and recovery UX
- additional hosting guidance for non-standard server setups
- clearer backup history and restore flows so admins can see what was generated, when it was generated, and move toward restore-adjacent convenience instead of one-click download only
- broader admin-side health and verification utilities
- mobile app token auth (JWT) — session auth works for web, but mobile needs API token support

## Longer-term product direction

VonCMS is still moving toward a larger 2.0 era, but the path matters more than the slogan.

> **v2.0 target: ~2028.** This is not a near-term goal — v2.0 would require architectural shifts (real-time collaboration, multi-tenant support, plugin marketplace infrastructure, or a major framework upgrade). The 1.x line is deliberately paced: ship stable, document well, build community. v2.0 happens when the foundation and ecosystem are ready, not on a deadline.

### Future milestone: v1.32+

Potential collaboration-facing work once the current release line and developer tooling are more mature:

- `VonPresence`: editorial presence and draft-attribution tooling so multi-editor work can show live avatars, user colors, and draft-only contribution tracing without affecting published output
- start with live presence, user-color indicators, and draft-only overlays before attempting full real-time collaborative editing
- keep published output clean and neutral even when draft mode carries attribution markers

Key longer-term themes:

- stronger extension and marketplace story
- more advanced editorial assistance tools
- better deployment tooling for managed environments
- improved developer experience for themes and extensions

## Guiding principle

The roadmap stays grounded in one rule:

Each release should make VonCMS easier to run on real hosting, easier to maintain, and harder to break by accident.
