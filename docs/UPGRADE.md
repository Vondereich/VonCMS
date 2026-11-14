# VonCMS Upgrade Guide

Most modern VonCMS installs can be updated from the admin panel.

**Managed routing:** After applying v1.28.3 through OTA or another update that preserves `.htaccess`, Primary Admin should run **System Tools > Repair `.htaccess`** once. This refreshes the managed rules while preserving hosting-specific directives outside the VonCMS block; the routing fix does not require a database migration.

The v1.28.3 development snapshot introduces private personal Gemini keys. After applying the files, Primary Admin must run **Database Repair** to create `user_ai_keys` and the private API-settings lock anchor before using personal/shared credential actions. Fresh installations create both automatically. Existing shared credentials and expiry are preserved; no personal key is invented for existing users. Writer/Moderator gain only an own-account User Manager view, not general user-management permission. Analytics and publishing policy are unchanged. Use a published package for production.

Back up `data/credential_master.key.php` separately from SQL, and again after encryption-key rotation. Rotation enrolls the shared key and every saved personal key in the same transaction. Restore the matching private key file with restrictive permissions if it is lost; replacing a credential cannot create a new master while encrypted records remain. Do not delete encrypted rows or private key files as a routine upgrade step. A files-only rollback leaves the private table intact; older versions ignore personal keys and may use the existing shared-key path instead, so review paid-key access before rolling back.

**News Sitemap readiness:** After upgrading or restoring a database, Primary Admin must run the existing **Database Repair** before relying on the optional News feed. Fresh installation activates publication readiness automatically. Without its protected capability marker, News returns HTTP 503 with Repair guidance, and the ordinary sitemap index omits News links while remaining available. Ordinary pages and RSS retain their compatibility fallback. Repair enables correct timestamps for subsequent publications; dates saved before Repair are not silently reinterpreted or timezone-migrated.

VonCMS v1.28.2 adds Lean Public Settings, reducing initial HTML and non-admin settings responses to the active bundled theme and eligible feature content. Saved inactive configuration remains available to authorized Admins, and explicit OFF/empty values are retained. There is no database migration, new setting, or change to analytics collection or authentication. The existing guest cache can retain the previous response for up to 60 seconds after a files-only upgrade; a successful Settings save invalidates that cache. After testing an upgrade, check the homepage, one post and one Page, then confirm that switching themes restores their saved customization. Review the [Changelog](../CHANGELOG.md) and use a published package for production upgrades.

VonCMS v1.28.1 builds on v1.28.0 without adding a database table or required data migration. Installer, bundled theme and built-in plugin labels remain 1.28. Hybrid analytics reuses existing analytics storage and does not change saved collection policy automatically; select it explicitly as Primary Admin after confirming Schema Repair readiness. The optional News Sitemap also requires explicit configuration in VonSEO Advanced settings. No historical browser data is invented. Review the [Changelog](../CHANGELOG.md) and back up before applying the published package.

Before rolling files back to v1.28.0 or another version without Hybrid support, use the Primary Admin's VonAnalytics settings to save **Strict** or **Balanced** first. Older code does not recognize a saved `hybrid` value and will stop visitor analytics rather than silently change its privacy policy; ordinary pages and aggregate content views remain available. If files were already downgraded, explicitly select and save Strict/Balanced in the older settings screen. Retained analytics history does not need to be deleted or converted.

The released v1.28.0 "The BluePrint" baseline builds on the closed v1.27.12 line. That CMS package uses version 1.28.0; installer, bundled theme and built-in plugin labels use 1.28. PHP 8.2 remains the compatibility minimum and PHP 8.3+ is recommended, with a non-blocking dashboard recommendation on PHP 8.2. Before updating, confirm the web-serving PHP build has current security patches; updating CMS files does not update PHP.

Grouped admin navigation adds distinct icons and role-aware New Post/New Page/Event actions, with URL-scoped editor identity and navigation-link confirmation for unsaved edits. Plugins/Themes use query-based tabs under the existing Extensions route. The optional Node Themes API dependency receives a `body-parser` security update; the deployed PHP transport is unchanged. Editorial Calendar introduces internal event/audit tables. Back up first, test the package on a local or staging installation, and follow the repair instructions below. Later roadmap modules remain planned.

### OTA temporary-file isolation

OTA temporary files now receive a deny-all Apache/LiteSpeed shield before payload writes, retained while failed cleanup leaves payload behind. Run Repair `.htaccess` when Integrity flags the new staging-prefix rule; OTA still preserves live routing files. Nginx-only/OpenLiteSpeed hosts must apply equivalent directory-wide HTTP denial through their server configuration; see [VPS](VPS.md). The updated code cannot protect an OTA already running through an older installed updater: install the server/root deny before that first transition, or use a controlled manual Deploy replacement. This hardening does not change the release source, update lock, activation or rollback protocol.

### v1.28.0 Calendar storage

Back up the database before testing an upgrade. Sign in as Primary Admin and run **Database > Schema Repair** to create and verify `calendar_events` and `calendar_event_audit`. Fresh installation creates them through the same schema owner; merely opening Calendar never runs DDL. Existing Post/Page content and publication/schedule fields are not migrated or rewritten by Calendar.

Check Month/Agenda, author/type filters, date/timezone boundaries and one disposable event's create/reopen/update/delete flow. Verify stale-version rejection and no changes to published articles. Event writes are transactional; MySQL DDL during explicit repair is not one rollback transaction, so review warnings and retry an interrupted repair. On rollback to older CMS files, retain the new tables and their backup rather than automatically deleting event data.

### v1.28.0 analytics and account links

Strict analytics remains the default and works with the previous analytics table. Before selecting Balanced in VonAnalytics, back up the database and run Primary Admin **Database > Schema Repair**. This adds `analytics.measurement_mode` (old rows remain Strict) and `analytics_sessions`; it does not reconstruct past browser identities. Reports select one mode at a time. The Balanced browser cookie lasts 30 days, is installation-scoped and is separate from login. A new visit begins after 30 minutes without recorded browser activity. Cookie blocking prevents Balanced visit recording; aggregate article/page views remain independent. Cleanup is opportunistic, not an exact-time deletion service.

New reset/verification links store a versioned digest in the existing token columns; old links retain their original lifetime. No token-column migration or bulk invalidation is required. The updated updater rejects a package declaring an incompatible or malformed minimum PHP requirement before live activation. That new check cannot retroactively change the updater installed on an old site; this package keeps PHP 8.2 compatibility.

### v1.27.12 maintenance baseline

v1.27.12 is a maintenance and security follow-up for the v1.27.x "OverDrive" series. It improves Post/Page HTML validation, metadata consistency, save feedback, media storage consistency, contact handling and profile text. Updating from v1.27.11 requires no new database migration, bulk content rewrite or hosting-rule repair. Clear a stale browser/CDN asset cache if the previous frontend is still served, then check a direct-loaded page and its manual description after JavaScript runs.

### v1.27.12 upgrade checks

- Enable PHP DOM before saving Post/Page HTML. Fresh installation checks the parser; an existing installation also needs the extension because HTML validation fails before persistence when it is unavailable.
- Existing articles are not rewritten in bulk. If an old Post or Page contains an inline/base64 `data:image/` source, saving it again is rejected with Media Library upload guidance. Upload that image and replace its inline source before saving. Rejection by this validation leaves the last saved database content unchanged and retains the unsaved editor text with the validation reason.
- IndexNow, GA4 and VonAnalytics privacy controls are read-only for appointed Admins. Primary Admin access and existing server authorization are unchanged; other SEO tabs, Search Console and AdSense remain available under their existing permissions.
- New Gallery, editor and system-image uploads follow the saved Flat or Year/Month default unless an explicit upload override is supplied. Existing files are not moved, and WordPress import retains its Year/Month layout.
- Existing HTML-encoded profile names and bios are not bulk-decoded. Correct previously encoded text by editing that field; do not run a blanket database replacement.
- Test one Post/Page Save and reopen, a normal Media Library image, and the site's contact form. A stored contact submission remains accepted if its email notification fails; acceptance is not proof of email delivery, and failures remain logged rather than shown as a delivery-status badge.

v1.27.11 closed the series' planned maintenance scope with account validation, public form quotas, post/page metadata and excerpts, numeric-slug routing, and compatible dependencies. No database migration or bulk content rewrite was introduced. OTA preserves live `.htaccess` files: run Repair `.htaccess` if Integrity Check prompts you to add the internal content-slug helper shield. Nginx administrators should update the corresponding helper-deny rule in [VPS](VPS.md). Earlier upgrade requirements below still apply when updating from an older baseline. New feature development is planned for v1.28.x, outside this package.

v1.27.10 is a maintenance package: inactive plugin data is omitted from public settings, while saved admin configuration and meaningful OFF/empty values remain intact. Internal helpers now load from the protected `core/` folder through the existing `security.php` entry point; no database migration is required. OTA preserves existing `.htaccess` files, so run Repair `.htaccess` if Integrity Check prompts you to restore the new core shield. Existing installations that completed earlier database repair steps can update normally; the guest settings cache may retain the previous payload until its existing 60-second lifetime expires.

v1.27.9: the new Dashboard Top Articles tab needs one explicit Database Repair after updating an existing site. Fresh installs create its anonymous daily-count table automatically. Until repair, lifetime article/page views continue normally and the new tab explains that storage is not enabled. Daily history begins at activation; existing lifetime views cannot be reconstructed into 7/30-day totals. Repair `.htaccess` when prompted to include the new private reporting helper in the managed deny rule.

> **v1.27.9 upgrade:** "OverDrive" adds Dashboard Top Articles and a new daily aggregate table. Existing sites, including already-repaired v1.27.7/v1.27.8 installations, must run Database Repair once to activate daily tracking.

> **v1.27.1 sample note:** Updaters released before v1.27.1 protected `von_config.sample.php` alongside the live config, so the first OTA transition may retain the older blank-credential sample. This does not expose or alter `von_config.php`. To adopt the direct-access guard immediately, copy the matching blank sample manually from the v1.27.1 Deploy package; later updates treat the sample as release-managed content.

> Existing sites that have not completed the v1.26.11 schema migration must run the explicit Database Repair step below after updating through OTA or a manual Deploy ZIP.

> [!IMPORTANT]
> **v1.27.4 `.htaccess` hardening:** VonCMS no longer constructs HTTPS or canonical-host redirects from the request `Host` header. Before updating, configure Force HTTPS and the preferred root or `www` hostname with a fixed domain in Cloudflare, cPanel/DirectAdmin, the reverse proxy, or the virtual host. OTA protects the live `.htaccess`, so after v1.27.4 arrives, sign in as the primary administrator and run **System Tools > Repair `.htaccess`** once. The repair replaces the unsafe legacy managed rules while preserving hosting-specific directives outside the VonCMS block.

### v1.27.7 large-archive indexes and counters

After upgrading an existing site to v1.27.7, back up the database, sign in as the primary administrator, and run **Database > Schema Repair** once during a quiet period. This is a schema update, not an `OPTIMIZE TABLE` operation. Repair adds optional publication-order, category, author, sitemap, and analytics indexes, and safely widens existing post/page view counters and analytics IDs. It does not reset content, views, or analytics IDs. Fresh installations receive these structures automatically. Index construction on a large database can take time and may wait for database locks; use a maintenance window and follow the existing repair guidance if hosting interrupts it.

Only indexes and generated expressions verified by install/repair are activated through the protected schema-capability marker. Uploading files alone does not activate the new query plans, and ordinary public requests never alter the schema. Conflicting optional definitions are left untouched and produce warnings; unrepaired or unsupported installations keep their previous SQL paths. Search is unchanged and has not been certified efficient at million-record scale. SQL fixture results are not a whole-site throughput guarantee.

The post API still caps each response at 200; Posts Per Page remains 6-50 and numbered `?page=` URLs and Load More are unchanged. The page ceiling is now 1,000,000. Analytics still expires logs using the 30-day cutoff, but cleanup drains expired backlog in batches of up to 1,000 rows on the existing opportunistic schedule; it is not a guarantee that every expired row disappears exactly at day 30.

### v1.26.11 database repair ownership

The v1.26.11 release removes permanent table and column creation from ordinary registration, recovery, profile, comment, analytics, audit, and security-log request paths. After upgrading an existing site:

1. back up the database
2. sign in as the primary administrator
3. follow any database status notice to **Database > Schema Repair**
4. review both completed fixes and compatibility warnings
5. if hosting interrupts a DDL statement or the repair reports a controlled stop, correct the reported database condition and run the same repair again

The status check is read-only. Repair uses a bounded advisory lock and verifies completed structures, but MySQL DDL is not transactionally rolled back as one unit. The repair therefore adds a correct index or foreign key before removing a conflicting definition, verifies InnoDB and `utf8mb4` table storage, converts only empty storage-drifted tables automatically, preserves populated or orphaned legacy data for manual review, and remains resumable. OTA does not silently run this DDL during public traffic.

The same repair adds and safely backfills the v1.26.11 `published_at` columns for existing published posts and pages, then activates a protected local capability marker. Until that explicit repair succeeds, ordinary public pages and RSS keep serving the older scheduled-or-created publication-time fallback without running schema probes during ordinary traffic. The optional News feed instead requires this readiness and returns 503 until Repair succeeds. A destructive database restore clears the marker and requires Database Repair again.

For a fresh install, use the root [README](../README.md) or [Installation](INSTALL.md) instead. This guide is only for existing sites.

> [!IMPORTANT]
> **v1.25.0 OTA upgrade warning**
> If you update from `v1.24.x` to `v1.25.0` through OTA, the update modal shown by the old site may not mention the new `.htaccess` requirement.
> After the update finishes, sign in as the primary admin and run **System Tools > Repair `.htaccess`** once.
> This applies the v1.25.0 managed routing and sensitive-file protection rules while preserving host-specific rules outside the VonCMS block.

## v1.27.12 maintenance upgrade path

Use the complete v1.27.12 Deploy ZIP for manual upgrades and keep the protected runtime files listed below intact. Back up the site and test the package on a local or staging installation before production use.

1. Back up your database.
2. Back up `uploads/` if you store media locally.
3. If your hosting folder already has a host-generated `.htaccess`, keep a copy before updating.
4. If your current site is on an older version, use the latest published Deploy ZIP for the manual upgrade flow. OTA updates are available again from the `v1.24.10` baseline after the updater download and SHA256 verification flow was fixed. Sites on the affected `v1.25.11` through `v1.26.0` packages or the pre-fix `v1.26.1` package must complete this manual update once because Dashboard release discovery can be skipped.
5. If you update to `v1.25.0` through OTA, open **System Tools** after the update and run **Repair `.htaccess`** once. The OTA updater protects the live `.htaccess` file, so this manual repair step applies the new v1.25.0 managed routing and sensitive-file rules while preserving host-specific rules outside the VonCMS block.
6. If your site already passed the `v1.25.0` `.htaccess` repair step, update normally to the latest published release.
7. When entering v1.27.4 from an older release, confirm fixed-host HTTPS/canonical redirects are active at the hosting or CDN layer, then run **System Tools > Repair `.htaccess`** once as the primary administrator.
   When upgrading an existing site to v1.27.7, also complete **Database > Schema Repair** once to activate the verified large-archive indexes and counter changes described above.
8. After the update, verify the homepage, one single post, one page, login, the editor, and the admin dashboard. Check numeric post/page slugs if the site uses them, plus excerpt and meta-description fields and Auto Fill.
9. After the site is on a fixed updater package and already passed the required `.htaccess` repair steps, use the admin panel updater for later releases.

New or changed passwords must fit bcrypt's 72-byte limit; non-ASCII characters can occupy more than one byte. Existing password logins remain compatible, and this release does not require a forced password reset. Existing stored excerpts and manual meta descriptions are not rewritten in bulk.

Login no longer applies the cross-IP account quota introduced in v1.27.10; the IP/IPv6 /64 limiter and successful-attempt refund remain active. The old internal login-ledger namespace is retained for partial manual upgrades and rollback compatibility, but current login does not read it. No automatic deletion or reset of existing limiter files is performed. Recovery now returns the same generic HTTP 200 response when its mail quota is exhausted, without issuing a token or sending mail. An already-full pre-upgrade recovery ledger can remain temporarily unavailable until its existing windows expire (up to 15 minutes).

The OTA updater treats the shipped `assets/` and `docs/` directories as release-managed content. During activation it replaces each directory as one rollback-protected unit, which removes retired fingerprinted bundles and guides instead of leaving them beside the current release. Keep personal or hosting-specific notes outside `docs/` so an OTA update does not replace them. Runtime configuration, database data, uploads, backups, and the live `.htaccess` remain protected.

From v1.27.2, the dashboard reads a bounded GitHub release response and presents supported Markdown without executing raw HTML. The modal reports only operation states the synchronous updater can prove; it does not fabricate percentage progress. These presentation and discovery safeguards do not change package SHA256 verification, protected-file handling, backup creation, activation, or rollback behavior.

## Optional `von_config.php` feature migration for v1.26.9

The Deploy package and OTA updater deliberately do not overwrite a live `von_config.php` because it contains database credentials and may contain installation-specific definitions. Replacing that working file is not required for a normal application update; an existing site can continue using VonCMS with its current configuration. A fresh v1.26.9 installation receives the current fail-closed environment detection and private PHP log location automatically. Sites installed before v1.26.9 that want those complete current configuration features can adopt them once through this manual migration:

1. Back up the live `von_config.php` outside the public document root. Do not leave a credentialed `.bak`, `.txt`, or editor backup copy inside the website directory.
2. Take `von_config.sample.php` from the matching Deploy package. Source checkouts keep the same template at `public/von_config.sample.php`.
3. Copy the sample to a temporary private file named `von_config.new.php`. Do not put real credentials into the tracked or distributable sample file.
4. Copy the complete `$db_host`, `$db_name`, `$db_user`, and `$db_pass` assignment lines from the working config into the matching four assignments in `von_config.new.php`. Copying the complete valid PHP lines avoids accidentally damaging quotes or special characters in a password.
5. Copy any installation-specific definitions that are not present in the sample, including `CRON_KEY` when the optional external publishing cron is configured. Preserve other host-specific constants or deliberate local customizations only after checking that they are still required and are not duplicated by the new template.
6. Run `php -l von_config.new.php`. If the host does not provide command-line PHP, lint the file locally with the same PHP major version before uploading it.
7. During a short maintenance window, activate the validated file as `von_config.php`. Keep the external backup until verification finishes, but immediately remove any temporary credentialed copy created inside the public website directory.
8. Verify the homepage, `/login`, and the admin dashboard. Confirm that production pages do not display PHP diagnostics. Developers who intentionally need browser-visible local diagnostics must explicitly set the web-server environment variable `VONCMS_ENV=development`.

This migration is not required during every update. Once the live file uses the v1.26.9 template, keep protecting it from normal Deploy ZIP and OTA replacement.

## What to verify after updating to v1.27.0

The first OverDrive stage adds the fixed-role Writer review workflow without a database migration. On a development or canary install, verify these paths before wider use:

- Writer can save an owned Draft, use editor Gallery media, and submit it for review.
- Writer sees the post under Submitted, cannot edit it while pending, and can withdraw it to Draft.
- Moderator, Admin, or Root sees the Review tab and pending count, can save reviewer edits, and can return, publish, or schedule the submission without changing its author.
- a second stale review action is rejected and succeeds only after the reviewer reloads.
- direct guest requests and public lists do not expose the pending post.
- normal public `get_posts.php?public=1&includeTotal=false` cache hits still return without loading the database configuration.

No Database Repair step is required for `pending_review`; it uses the existing post status column. The usual backup and canary rules still apply to production updates.

## What to verify after updating to v1.26.9

After Hours keeps the Tailwind CSS 4, TypeScript 7 native compilation, OpenRouter SDK 1, and refreshed editor/UI baseline. v1.26.2 made publishing and administration responsive across phone, tablet, and desktop; v1.26.3 closed the audited category canonical, crawler endpoint, indexing, metadata fallback, and duplicate-slash gaps; v1.26.4 made Security Dashboard charts truthful and protected unsaved Quick Editor work during exit; v1.26.5 added accurate admin editor route context and a broader advisory publish-readiness summary; v1.26.6 improved editor label legibility, added three explicit header identity modes, aligned list and single-post read time, and exposed public publish times; v1.26.7 added a public-safe Categories sidebar widget, category scroll reset, resilient saved theme colors, a contrast-aware TechPress search control, a timezone-aware dashboard clock, and compatible OpenRouter SDK and TipTap maintenance; v1.26.8 added bounded production-warning maintenance, reliable media search, persistent public search URLs, crawlable navigation across all six bundled themes, stricter system-image validation, and compatible dependency maintenance; v1.26.9 rejects malformed structured inputs before PHP string handling and removes an obsolete WordPress import transport. The OpenGate installer, `.htaccess`, privacy, ownership, and admin security baselines remain in place.

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
- global Gemini keys show a masked storage status; save Settings once as Primary Admin to migrate a legacy key, without restarting its existing expiry
- back up `data/credential_master.key.php` separately before moving/restoring an encrypted-key installation; a SQL backup alone does not contain the decryption key
- on Linux, restore the automatically managed private key with correct ownership and `0600` permissions after FTP/file restores; a restored `0644` mode is rejected rather than silently accepted
- Primary Admin can use API Settings > Rotate Encryption Key without deleting files or re-entering the provider key; save/discard pending edits first and back up the private key file again afterward
- if reverting to code without encrypted-key support, re-enter the provider key in that version or restore a compatible pre-migration API settings backup; file-only rollback does not decrypt persisted credentials
- expired keys remain masked and unusable; explicit re-entry starts a new local 30-day period when that option is enabled
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

The instruction above protects the working site during the application-file upgrade. If the installation predates v1.26.9 and the owner wants the complete current configuration features, complete the separate [`von_config.php` migration](#optional-von_configphp-feature-migration-for-v1269) only after the updated site is loading normally.

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
