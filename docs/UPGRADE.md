# VonCMS Upgrade Guide

Most modern VonCMS installs can be updated from the admin panel.

For a fresh install, use the root [README](../README.md) or [Installation](INSTALL.md) instead. This guide is only for existing sites.

> [!IMPORTANT]
> **v1.25.0 OTA upgrade warning**
> If you update from `v1.24.x` to `v1.25.0` through OTA, the update modal shown by the old site may not mention the new `.htaccess` requirement.
> After the update finishes, sign in as the primary admin and run **System Tools > Repair `.htaccess`** once.
> This applies the v1.25.0 managed routing and sensitive-file protection rules while preserving host-specific rules outside the VonCMS block.

## Recommended path to v1.26.6

1. Back up your database.
2. Back up `uploads/` if you store media locally.
3. If your hosting folder already has a host-generated `.htaccess`, keep a copy before updating.
4. If your current site is on an older version, use the manual Deploy ZIP flow to upgrade to `v1.26.6`. OTA updates are available again from the `v1.24.10` baseline after the updater download and SHA256 verification flow was fixed. Sites on the affected `v1.25.11` through `v1.26.0` packages or the pre-fix `v1.26.1` package must complete this manual update once because Dashboard release discovery can be skipped.
5. If you update to `v1.25.0` through OTA, open **System Tools** after the update and run **Repair `.htaccess`** once. The OTA updater protects the live `.htaccess` file, so this manual repair step applies the new v1.25.0 managed routing and sensitive-file rules while preserving host-specific rules outside the VonCMS block.
6. If your site already passed the `v1.25.0` `.htaccess` repair step, update normally to `v1.26.6`.
7. After the update, verify the homepage, one single post, and the admin dashboard.
8. After the site is on a fixed updater package and already passed the `v1.25.0` `.htaccess` repair step, use the admin panel updater for later releases.

The OTA updater treats the shipped `assets/` and `docs/` directories as release-managed content. During activation it replaces each directory as one rollback-protected unit, which removes retired fingerprinted bundles and guides instead of leaving them beside the current release. Keep personal or hosting-specific notes outside `docs/` so an OTA update does not replace them. Runtime configuration, database data, uploads, backups, and the live `.htaccess` remain protected.

## What to verify after updating to v1.26.6

After Hours keeps the Tailwind CSS 4, TypeScript 7 native compilation, OpenRouter SDK 1, and refreshed editor/UI baseline. v1.26.2 made publishing and administration responsive across phone, tablet, and desktop; v1.26.3 closed the audited category canonical, crawler endpoint, indexing, metadata fallback, and duplicate-slash gaps; v1.26.4 made Security Dashboard charts truthful and protected unsaved Quick Editor work during exit; v1.26.5 added accurate admin editor route context and a broader advisory publish-readiness summary; v1.26.6 improves editor label legibility, adds three explicit header identity modes, aligns list and single-post read time, and exposes public publish times. The OpenGate installer, `.htaccess`, privacy, ownership, and admin security baselines remain in place.

Check these items:

- the public site loads correctly on your main path
- `/index.html` redirects back to the homepage instead of showing the static shell
- System Tools **Repair `.htaccess`** has been run once if the site reached `v1.25.0` through OTA
- `/admin` still opens and login works
- the admin menu opens as a drawer on phone and tablet, closes after navigation, and does not leave the page locked
- the editor Write, Publish, and AI panels can be switched without losing the current draft
- the bottom Draft and Publish/Schedule/Update actions remain visible above the phone safe area
- an admin settings or media dialog stays inside the viewport with a blurred backdrop and returns focus after closing
- Security Dashboard shows an explicit no-events message when the seven-day trend is empty and renders distribution data when logs exist
- Quick Editor asks before Close, Back, Escape, or Dashboard Editor discards unsaved changes
- one single post page loads without layout glitches
- one public page route resolves correctly
- lowercase and uppercase variants of one populated category redirect to its stored category spelling
- nested lookalikes such as `/foo/robots.txt`, `/foo/sitemap.xml`, and `/foo/rss.xml` return the normal public 404 instead of crawler documents
- `/login`, `/admin`, `/install`, and public search results expose the expected non-indexing metadata
- the editor opens and saves normally for one draft
- saved Gemini API keys still work, or prompt for a fresh key if the optional 30-day expiry is enabled and expired
- AI writing/check actions show an incomplete-response error instead of accepting cut-off Gemini output
- dashboard `Articles` / `Pages` welcome stats match the real totals for sites with 201+ posts
- dashboard `Comments` matches the real moderation total
- dashboard `Active Users` matches the real user total for Admin, Moderator, and Writer staff accounts without exposing the User Manager list API
- public profile article/comment totals remain correct beyond the latest 200 posts and first 10 comments
- fast profile-to-profile navigation does not show stale article/comment totals from the previously viewed profile
- appointed Admin accounts cannot see SMTP/API secrets in Settings responses, cannot access Database Manager, database backup/import, settings audit/rollback, Media Manager destructive deletes, WordPress Bridge, System Tools, OTA updater, or IndexNow owner actions, and AI writing prompts for their own Gemini key instead of using a protected placeholder
- appointed Admin accounts can still open User Manager for normal user management, but cannot modify or delete Admin ID 1/Root accounts
- guest public profile responses do not expose numeric user IDs, staff roles, or joined dates
- logged-in users can still edit their own public profile and see avatar/bio/role display sync after save even though public profile responses hide staff roles
- guest/public post, page, single-post, bootstrap, and comment responses do not expose internal numeric `author_id` / `userId` fields, comment `dbId` / `status`, or comment email hashes
- direct guest requests to known draft or future-scheduled post/page URLs do not render public SSR meta, JSON initial state, or noscript content
- appointed Admin/Moderator/Writer comment responses show only `hasEmail` instead of raw `emailHash`; raw comment email hashes remain primary-admin only
- external avatar URLs are HTTPS-only, unsafe `javascript:` / `data:` avatar values are rejected, and broken public comment avatars fall back cleanly
- switching browser tabs while logged in should no longer spam `check_auth.php`; visibility checks are cooldown and in-flight guarded while still detecting expired sessions
- TechPress profile pages do not request the external grainy-gradients noise SVG
- editor hyperlink insertion preserves selected text, keeps WhatsApp-style query-string links intact through a single TipTap Link extension, and public light-mode links render visibly blue
- bundled public discovery flows can still surface posts older than the latest 200 on search/category/load-more paths
- older public search/category results open immediately without bouncing on the homepage first
- repeated public searches do not flash an empty results state before the next server response lands
- comments-disabled post pages do not briefly show comment CTA copy on first paint
- the editor video bubble stays attached to the selected video after clicking and changing aspect ratio
- database imports still complete normally on your host without leaving unbounded request runtime
- Page Manager search returns matching pages from the server
- portrait embeds such as TikTok, Instagram Reels, Facebook Reels, and YouTube Shorts keep a vertical aspect ratio
- comments display numbered pagination (Prev/Next, page buttons)
- if you upload or import images on restrictive hosting, they appear correctly on the frontend (no broken images)
- if you use shared hosting, `.htaccess` still contains your host-managed PHP handler block
- account-linked public comments fall back to email/Gravatar after the user clears a custom external avatar URL
- the Deploy ZIP contains the root `.htaccess` routing file and uploads shield `.htaccess`

## When to use Integrity Fix

Use Integrity Fix only if routing or core protection files are out of sync.

Current behavior:

- it creates a `.bak` backup first
- it repairs the VonCMS-managed routing block
- it is designed to preserve hosting-specific rules outside that managed block

That means it is safer than the older full-overwrite approach.

## Updating from older 1.21.x or earlier installs

If you are coming from an older Breeze or Mandala install:

1. update with the current Deploy ZIP manual flow first
2. clear your browser cache
3. open the public homepage and admin once
4. only run Integrity Fix if you actually see routing or protection issues

There is no benefit in pressing Integrity Fix on every update if the site is already healthy.

## Manual upgrade for older installs

If your site is too old for the current OTA flow or the admin panel is unavailable:

1. download the latest release package from the official release
2. back up your database, `uploads/`, and your live `von_config.php`
3. In cPanel/File Manager or FTP, **delete the old `assets/` folder first** so old hashed JS/CSS files cannot stay behind
4. upload or extract the latest VonCMS Deploy package and overwrite the existing deployment files
5. if the hosting folder already contains cPanel-generated PHP handlers, custom `.htaccess` blocks, or hardcoded redirects, verify `.htaccess` after extraction and restore your backup or `.bak` copy if needed
6. keep your real `von_config.php` in place and do not replace it with the sample file
7. sign in to the admin panel and verify the system version

## Shared hosting note

A truly fresh install writes a fresh VonCMS `.htaccess` template.

If you are updating inside a folder that already contains hosting-generated `.htaccess` content, custom redirects, or hardcoded rewrite rules, keep a backup of `.htaccess` first and verify the generated `.bak` copy after extraction. This matters most on cPanel or similar hosts that manage PHP versions through `.htaccess` rules.

## Rollback checklist

If something looks wrong after an update:

- restore your database backup if the issue is data-related
- restore your saved `.htaccess` or the `.bak` copy if routing was changed unexpectedly
- restore your `uploads/` backup only if media files are missing or corrupted
- compare your active theme and plugin settings before assuming the core update failed

## Final advice

Update in this order:

1. backup
2. update
3. verify
4. repair only if needed

That keeps the process calm and makes troubleshooting much easier.
