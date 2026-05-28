# VonCMS Upgrade Guide

Most modern VonCMS installs can be updated from the admin panel.

## Recommended path to v1.24.8

1. Back up your database.
2. Back up `uploads/` if you store media locally.
3. If your hosting folder already has a host-generated `.htaccess`, keep a copy before updating.
4. In the admin panel, go to `Settings > System` and run the updater.
5. After the update, verify the homepage, one single post, and the admin dashboard.

## What to verify after updating to v1.24.8

This release line focuses on profile activity totals beyond the preload boundary, appointed-admin secret isolation, primary-admin-only destructive/admin tool surfaces, dashboard comment-count truth, and the existing HourGlass installer, `.htaccess`, editor, and admin reliability baseline.

Check these items:

- the public site loads correctly on your main path
- `/admin` still opens and login works
- one single post page loads without layout glitches
- one public page route resolves correctly
- the editor opens and saves normally for one draft
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
- saved Gemini API keys still work, or prompt for a fresh key if the optional 30-day expiry is enabled and expired
- portrait embeds such as TikTok, Instagram Reels, Facebook Reels, and YouTube Shorts keep a vertical aspect ratio
- comments display numbered pagination (Prev/Next, page buttons)
- if you upload or import images on restrictive hosting, they appear correctly on the frontend (no broken images)
- if you use shared hosting, `.htaccess` still contains your host-managed PHP handler block

## When to use Integrity Fix

Use Integrity Fix only if routing or core protection files are out of sync.

Current behavior:

- it creates a `.bak` backup first
- it repairs the VonCMS-managed routing block
- it is designed to preserve hosting-specific rules outside that managed block

That means it is safer than the older full-overwrite approach.

## Updating from older 1.21.x or earlier installs

If you are coming from an older Breeze or Mandala install:

1. run the normal updater first
2. clear your browser cache
3. open the public homepage and admin once
4. only run Integrity Fix if you actually see routing or protection issues

There is no benefit in pressing Integrity Fix on every update if the site is already healthy.

## Manual upgrade for older installs

If your site is too old for the current OTA flow or the admin panel is unavailable:

1. download the latest release package from the official release
2. back up your database, `uploads/`, and your live `von_config.php`
3. **Delete the `assets/` folder** in your hosting to prevent stale asset conflicts or lingering old files
4. use the latest VonCMS Deploy package and overwrite the existing deployment files
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
