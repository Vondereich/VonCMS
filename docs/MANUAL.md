# VonCMS User Manual v1.28.3

This manual covers the v1.28.3 "The BluePrint" release. Follow the [Changelog](../CHANGELOG.md) for exact changes, release status and compatibility boundaries.

### Personal AI key

Open **Users** in the private admin panel. Writer/Moderator see only **Your Account**; Root/Admin can choose **My Account** without losing their existing user-management view. Edit your own account to open **Personal AI Key**. Saved keys are masked; enter a new value and use **Save Key** or **Replace Key**, or explicitly **Remove Personal Key**. These actions are separate from saving profile fields. Username, email and role are read-only in the self-only view; existing profile/password validation remains in force.

Your saved personal key takes priority for AI Generate/Check. Only when no personal key is saved can shared access apply. An expired, damaged or provider-rejected personal key returns an error instead of silently using the shared paid key. Optional 30-day expiry starts on Save/Replace and does not revoke the key at Google. Keys survive reload/login on the server, never in posts or browser storage. Member/Guest do not gain AI access.

On an upgraded installation, the Primary Admin must run **Database Repair** first. Encrypted credentials need both the SQL data and the matching private `data/credential_master.key.php` backup. Do not delete this file to renew a key. See [Security](SECURITY.md) and [Upgrade](UPGRADE.md).

This release supports PHP 8.2 or newer; PHP 8.3+ is recommended. Use a supported, patched PHP build; see [Installation](INSTALL.md) and [Security](SECURITY.md).

This guide is for site owners, editors, and admins who want to run VonCMS day to day without digging through the codebase.

## Getting into the admin panel

Open your site and go to:

- `/admin`
- or `/login`

Sign in with the account created during installation.

If a registration verification email is missing or expired, enter that account's username/email and password on the login form and choose **Resend verification email**. This sends a new 24-hour link without signing in or verifying the account. Only the latest link works. Wait at least one minute between requests; the limit is three resends in 15 minutes. If delivery fails, retry later or ask the site administrator; the account is not automatically approved.

If you cannot see a menu that this manual mentions, the most common reasons are:

- your role does not have access
- the related module is disabled
- the current screen is hidden by the active layout or plugin state

## Admin navigation

Dashboard stays directly accessible. Content groups Posts, Pages and Calendar; Extensions opens Plugins or Themes; Monitoring contains the existing Security screen. Only destinations allowed for your account appear. Gallery, Widgets and Database retain their Primary Admin restriction.

Use Create for New Post, New Page or New Event / Agenda when your role permits it. These open a fresh form, not the last item you edited. Selecting Create again while writing unsaved text asks before starting over. Status and Activity Log remain unavailable until their own implementation.

Click or press Enter/Space on a group to open or close it, including the current page's group. Entering a child route opens its group automatically; closing that group manually does not change the current page or its active highlighting. On a compact desktop sidebar, selecting a group expands the sidebar; on phones and tablets, use the navigation button and Escape to close the drawer. Create and group links are also included in admin search.

Unsaved dashboard edits prompt before following navigation links or using the editor's Back action. Cancel keeps the current draft open. Reload/close uses the browser warning; browser-history Back/Forward and session-expiry redirects are not blocked by this link guard. Save important work before using history navigation.

## Deleting posts and pages

In Content > Posts or Pages, Delete opens a preview of the selected item's title, ID, status and available summary. Bulk Delete lists the selected items from the current manager page. Review these list details, then choose **Delete permanently**; Cancel, Escape or clicking outside the preview does not delete anything. The preview does not lock a record or replace the server's current permission checks.

Deletion is permanent: this feature does not add Trash, Restore or Undo. Uploaded media files are not removed by deleting a Post/Page. Export a database backup first if you need your own recovery point.

During a deletion request, the dialog cannot be dismissed as if the request were cancelled. A bulk failure stops the operation and retains the unconfirmed items for review/retry; earlier successful deletions are not rolled back. If a network response is lost, reload the list to verify the actual state before retrying. Navigating away cannot undo a request already sent, but stops further requests from that bulk operation. Within the same loaded app, a confirmed deletion still refreshes its own Post/Page list if you leave and return before the response arrives.

## Google services and AI usage

Settings > Google configures Search Console verification, Google Analytics 4 and AdSense. A saved code means configured, not verified ownership, working collection or advertising approval. Google tracking follows the analytics master plugin, its own Enable Tracking switch and the configured consent requirement. Native VonAnalytics is a separate local reporting flow.

GA4 privacy and IP handling are managed through Google's service and property controls. The retired IP-masking checkbox was not a GDPR compliance switch; existing stored settings are retained without rewriting them. Review [Google's privacy controls](https://support.google.com/analytics/answer/9019185?hl=en) and the site's actual consent requirements.

Settings > API uses Google Gemini for AI writing and editing. New selections offer Gemini 3.8 Flash, 3.6 Flash, 3.5 Flash-Lite and the automatic Flash Latest alias. The default remains 3.6 Flash. Older saved models remain visible only as the current legacy configuration and are not silently replaced when unrelated settings are saved; select a current model explicitly to migrate. Account access, provider retirements and pricing still apply.

Writing and editing requests, including the existing model-not-found fallback, explicitly send `store: false` to opt out of optional Generate Content request storage. This does not promise zero provider retention: Google's applicable service, safety and abuse-monitoring terms still apply. Built-in local AI Summary is not a Gemini request.

The Primary Admin's saved global Gemini key is masked in Settings. On an upgraded site, a **legacy storage** notice means the existing key has not been rewritten yet: click Save Settings once to encrypt it, preserving its existing expiry. New or replaced keys are encrypted on Save. An expired key stays masked and cannot be used until explicitly replaced/re-entered or the owner changes the expiry policy; unrelated Saves do not renew or erase it. Clear the key field and Save to remove it deliberately.

Back up the installation's private `data/credential_master.key.php` separately from the SQL backup. It is not included in release ZIPs or SQL exports, and OTA keeps the existing file. A restore or hosting move needs the matching file; if it is missing or corrupt, Settings shows an unavailable-key notice instead of erasing the saved value. See [credential recovery and advanced deployment](SECURITY.md#global-gemini-credential-encryption). This is global owner-key storage, not the planned personal key section for individual staff.

To replace the private encryption key, save/discard outstanding Settings edits, then choose **Rotate Encryption Key** and confirm as Primary Admin. The panel shows status and the last successful rotation time, not the master key. No manual file deletion, SQL editing or provider-key re-entry is needed. The saved Gemini key and its expiry do not change. Back up the private file again afterward. If rotation cannot be confirmed, reload Settings before retrying; the transition keeps the old/pending credential readable. A missing/corrupt key still needs recovery, and a read-only/mounted secret location may require server-operator management.

## Editorial Calendar

Open **Content > Calendar** as an Admin or Moderator. Writers, Members and guests have no Calendar access. On an upgraded installation, ask the Primary Admin to run **Database > Schema Repair** if Calendar reports missing storage. Opening the page never creates tables.

- Use Month or Agenda, previous/next, Today and the month field to navigate. Select a day, then an item, to see its details. The details panel becomes an accessible side drawer on phones/tablets.
- All, Events / Agenda, Posts and Pages filter record types. Content author filters apply to Post/Page entries, not event organisers. The list shows authors represented in the requested date range, not the complete user directory.
- New event, or **Create > New Event / Agenda**, opens the event form. Supply a title, start/end and optional plain-text notes. All-day events include the Last day shown in the form. Events are limited to 366 days; titles to 200 characters and notes to 10,000. HTML-like notes are text, not executable markup.
- Save, reopen and edit an event, or use Delete event with confirmation. An event deletion never deletes an article/page. Failed saves preserve the form. If another editor changed/deleted the event, reload before editing again; stale changes are rejected rather than overwriting the newer version. Retrying the same successful create request does not create a second event.
- Post/Page details show author, publication date and Published/Scheduled labels. Open editor is available only with the existing edit permission. Reading Calendar does not run the scheduler or change article statuses, slugs or publication times.
- Calendar uses the site's existing General timezone, with no separate General Calendar settings. Dates are stored in the site's wall-clock format, like existing publication timestamps; changing the site timezone does not rewrite existing rows. All-day storage uses an exclusive end internally; the form shows the included last day.
- Results are paginated, 200 records per request. If more exist, use Load more; counts describe loaded records only. Refresh retries the current date/type/author range. There is no background polling or full-body article download.
- Event changes record actor, action, event ID, version and time in private audit storage, not a full content revision. Mutations opportunistically prune up to 500 audit rows older than 90 days. Event deletion retains its audit record until pruning. No public calendar, reminders, recurring events, invitations or external calendar sync is included.

Sidebar and search Create actions both ask before discarding an edited event form. If you accept a new entry while an earlier save is pending, the earlier request still finishes its own operation but cannot replace the newer form or its feedback.

Save important work before using browser-history navigation or leaving after session expiry; the link/unload guard is not a history-navigation blocker.

## First things to do after install

Before you start publishing, check these basics:

1. Confirm `Site Name`, `Site URL`, and tagline.
2. Set your main theme under Extensions > Themes.
3. Review SEO defaults, sitemap, and robots.txt.
4. Confirm **Settings > General > Domain URL** contains the exact public HTTPS URL, including any installation subfolder. VonCMS intentionally does not derive production crawler URLs from an untrusted request Host when this value is missing.
5. Upload your logo and favicon, then choose Logo + Text, Logo Only, or Text Only under Header Identity.
6. Create at least one category and one navigation item.
7. Make a backup once the site is configured.

## Dashboard

Storage usage is staff-only and may be cached for up to five minutes to avoid repeatedly scanning the complete media archive. Successful uploads and media deletions invalidate the cache. An unavailable cache falls back to a live count; existing files are not moved or modified.

The Analytics card offers Visitor Traffic and Top Articles. Top Articles lists up to 10 currently published articles by recorded views for the last 7 or 30 calendar days, including today in the site's timezone. These are anonymous aggregate views, not unique readers. Existing sites need Database Repair once to activate daily storage; the tab shows its activation date because previous lifetime views cannot be backfilled. Temporary reporting faults do not change lifetime article/page counters.

Visitor Traffic totals cover the entire selected 7/30-day period. The chart shows daily visits and daily unique IPs (Strict) or browsers (Balanced). A returning IP/browser is counted once on each active day in the chart, but only once across the selected period in the unique total. Daily unique counts therefore must not be added together to calculate that total; neither mode measures verified individual people.

Collection is separate from reporting. The Primary Admin selects Strict only, Balanced only, or Hybrid in **Extensions > Plugins > VonAnalytics > Settings**. Hybrid records both eligible measurements independently; Dashboard report switching only reads Strict or Balanced history and never changes collection. Existing settings are not silently switched during upgrade. Run Schema Repair before enabling Balanced/Hybrid if their storage is missing. Newly enabled modes have no earlier history; empty results do not prove tracking failure. Consent, blocked cookies, admission limits and storage availability can reduce recorded visits. Never add Strict and Balanced totals together.

From v1.28.1, recognized crawler/automation User-Agents are excluded from new native visit and content-view measurements, but may still read public articles. A crawler-rendered PHP document also tells the bundled frontend not to send native tracking, including when a cooperative renderer changes its User-Agent. This does not identify all automation: an undeclared bot loading an ordinary document can still look like a browser. Older records are not reclassified or deleted, and neither mode measures verified humans. Search/crawl permissions remain a separate operator policy; this change does not block Exa, Google or Bing from reading content.

The dashboard is your control center. It usually gives you a quick read on:

- content counts
- latest activity
- system health
- storage or maintenance tools

Use it as the first place to check whether the site is behaving normally after updates or configuration changes.

## Database backups and restores

Use `Database Manager` for the database that the current VonCMS install is already connected to.

The active database is defined by `public/von_config.php`. Backup exports SQL from that database. Import runs the uploaded SQL against that same configured database. It does not switch database names based on the uploaded file.

Use Import for VonCMS-generated SQL backups. A normal VonCMS backup can drop and recreate tables during restore, so importing into the wrong install can overwrite that install's current data.

For the full operating notes, see [Database Manager](DATABASE_MANAGER.md).

## Managing posts

Posts are used for articles, news, and normal publishing work.

Typical flow:

1. Open `Posts`.
2. Create a new post or edit an existing one.
3. Fill in title, content, excerpt, category, image, and status.
4. Save as draft or publish.

### Writer review flow

The buttons shown in the post editor follow the signed-in role:

- A **Writer** can create and edit only their own Draft posts, use Gallery media from the editor, and choose **Submit for Review**.
- A submitted post appears under **Submitted** and becomes read-only for the Writer. **Withdraw to Draft** reopens it for editing.
- A **Moderator**, **Admin**, or **Root** account sees the shared **Review** tab and the pending count beside Posts.
- A reviewer can save editorial changes, return the submission to Draft, publish it, or schedule it. Returning, publishing, or scheduling does not silently save unsaved editor changes; save reviewer changes first when the article body was edited.
- The original Writer remains the post author after review.

Review applies to posts only in v1.27.0. Pages keep their existing workflow, and published-post change proposals are not part of this stage.

Good habits:

- keep titles clear and specific
- add an excerpt for listing pages
- use a featured image with sensible dimensions
- review the public permalink before sharing

### Publishing from a phone or tablet

The admin uses the same permissions and save paths on every viewport, but rearranges the controls for touch:

1. Use the menu button in the admin header to open navigation. Choosing a route closes the drawer automatically.
2. In the editor, use **Write** for the title and article body. The formatting toolbar stays on one row; swipe it sideways to reach controls that are off-screen.
3. Open **Publish** to review status, category, excerpt, featured media, SEO details, and scheduling controls.
4. Open **AI** only when you need the configured writing assistant. Switching panels does not unmount the editor or discard the current draft.
5. Use the fixed bottom actions to save a draft or run the same Publish, Schedule, or Update action used on desktop.
6. Use Preview from the editor toolbar before sharing a long or media-heavy article.

Admin dialogs and media lightboxes stay inside the visible viewport and can normally be closed with their Close control, the backdrop, or Escape. The OTA dialog presents bounded GitHub release notes as readable Markdown and reports Checking, Installing, Complete, or Failed without inventing a percentage. Update progress is deliberately protected from accidental backdrop or Escape dismissal while an OTA operation is running; a failed discovery or installation leaves the dashboard usable and provides a controlled retry path.

## Managing pages

Pages are for static sections such as:

- About
- Contact
- Privacy Policy
- Terms

Use `Pages` when the content is not part of your normal post feed.

## Using the editor

The editor supports rich content workflows such as:

- headings and paragraph formatting
- links and images
- embeds and tables
- code blocks
- inline formatting
- optional AI-assisted content tools when configured

Editorial advice:

- write first, style second
- keep heading levels in order
- preview long posts before publishing
- avoid pasting messy formatting from office software without checking the output
- upload pasted inline/base64 images through the Media Library before saving; Post/Page saves reject `data:image/` sources with an explanatory message instead of saving a broken image
- use `%20` for spaces inside URLs written directly in HTML source; unsupported URL schemes and literal whitespace in absolute HTTP(S) or protocol-relative URLs are rejected, while percent-encoding Unicode URL characters preserves the destination

The inline/base64 image rule also applies when saving an existing article or page. Replace any such image through the Media Library before saving again. When this validation rejects a Save or autosave, the last saved content stays unchanged and the editor retains the unsaved text with an explanatory status.

## Media library

Use the media area to upload and manage files.

Typical tasks:

- upload featured images
- re-use existing media inside posts and pages
- remove unused files
- inspect file names, URLs, and image variants

VonCMS supports a WebP-aware media flow. Depending on the upload context and settings, some image uploads may be converted during processing.

Gallery, editor and system-image uploads use the saved Flat or Year/Month folder default unless an upload supplies an explicit override. Changing that setting does not move existing images. WordPress import retains its Year/Month layout.

### Moving content from WordPress

Use **Settings > WordPress Bridge** as Primary Admin with a WordPress WXR export and a current backup. The Bridge imports supported Post/Page HTML and images, native excerpts/tags and supported Yoast/Rank Math descriptions. Password-protected items become Drafts with a warning; WordPress passwords are not transferred. Long metadata is shortened to the editor limits with a warning, while articles above 1 MiB pause rather than losing their ending.

Let both import and final link-resolution phases finish. A failed item pauses with its XML/checkpoint retained; resume retries it. A completed import with warnings is not an all-content success claim. Temporary files expire after 24 hours when a later scan cleans them up. Do not change the destination domain or permalink setting during an import.

Verify article bodies, source-URL redirects, metadata and images before retiring WordPress. Query-based external redirects need server configuration. Authors, comments, schedules, page hierarchy, custom post types, arbitrary metadata and dynamic/plugin-rendered blocks are not transferred in full. Duplicate slugs are skipped, not updated, and older imported content is not rewritten automatically. See the [Bridge API contract](API.md#wordpress-bridge-endpoints).

## Comments and discussion

If discussion is enabled, comment moderation usually happens through the admin comments screen.

You can normally:

- review incoming comments
- approve or reject them
- remove spam
- moderate replies

If you run a high-traffic site, make comment review part of your daily routine.

## Users and profiles

The users area lets you manage access to the system.

Common admin tasks:

- create user accounts
- change roles
- reset credentials
- update user profiles
- remove unused accounts

Use the smallest role that still gets the job done. Do not hand out admin access unless someone truly needs it.

For publishing teams, assign **Writer** when someone should prepare posts but not publish them. Assign **Moderator** when someone should review submissions and manage ordinary pages without receiving user-management, site-settings, or destructive media authority.

## Settings

The settings area is where most site-wide behavior lives.

### General

Use this section for core identity and publishing basics such as:

- site name
- tagline or description
- site URL
- posts per page
- maintenance mode

### SEO

This section usually covers:

- site title defaults
- meta description defaults
- canonical host
- sitemap state
- robots.txt content
- IndexNow setup and status

If you use IndexNow, verify the status after enabling it so you know the key and verification file are ready.

#### Optional News sitemap

In **Extensions > VonSEO > Advanced**, enable XML Sitemap, then enable **News Sitemap**. It is OFF by default; enabling it does not change existing articles or the site's schema type.

- `/sitemap-news.xml` serves the first file; if more than 1,000 articles qualify, additional files use `?page=2`, `?page=3`, and so on. `/sitemap.xml` lists every News chunk automatically. These are dynamic responses, not files to upload or regenerate manually.
- Only Published posts whose original publication falls within the preceding 48 hours qualify. Future posts, Drafts, Pages and profiles are excluded. Editing an old article does not make it new. The shared fallback uses scheduled time, then creation time where a first-publication timestamp is unavailable; the CMS cannot reconstruct an unknown historical publication date.
- News also requires the existing protected publication-readiness capability. Fresh installation activates it automatically. After upgrade or database restore, Primary Admin must run **Database Repair** before relying on the feed; missing, invalid or cleared readiness returns HTTP 503 with Repair guidance, while the ordinary sitemap index stays available without News links. No public request creates columns or changes a stored date. Publications created after readiness use the configured CMS clock; pre-Repair dates are not silently reinterpreted.
- Choose **All categories** only for a news publication, or select specific news categories. Selection does not automatically judge whether an article meets Google's news policies. At least one category is required in selected-category mode; deselecting everything never silently means all categories.
- Leave publication name and language blank to inherit General Settings. The name must match your publication as shown in Google News, without parenthetical additions. A comma-separated site language list uses its first code, just like the shared schema language helper; the saved General setting is unchanged. Regional site codes such as `ms-MY` become `ms`; overrides use ISO 639 two/three-letter codes. Chinese needs `zh-cn` or `zh-tw` (recognized regional/script site tags are normalized automatically).
- A recent window with no eligible articles returns valid, empty XML. No older content is used as filler; Google may show an intentional Empty Sitemap warning. A disabled feed returns 404. Missing/invalid publication metadata or a database failure returns 503, not invented publication details; a News-only configuration failure does not disable the ordinary sitemap index.
- Images are not filtered by width. For large-image Discover previews, Google recommends source images at least 1,200px wide and permission for large previews; this is not a News sitemap admission requirement or a guarantee that Google will choose an image.

The ordinary sitemap, RSS and llms.txt keep their existing roles. There is no new table, migration or cron job for News; an already-ready installation does not need another Repair just to toggle the feature. A News sitemap aids discovery; it does not guarantee Google News eligibility, indexing or ranking. See [Google's News sitemap specification](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap) and [Discover image guidance](https://developers.google.com/search/docs/appearance/google-discover).

#### Understanding orphan-page audit reports

An orphan-page warning means an audit crawler discovered a URL from a sitemap, Search Console source, or another imported list but did not find an incoming internal HTML link to that URL during its crawl. It does not mean that the page is empty, broken, or automatically missing from Google.

VonCMS public themes use React for interactive listings and Load More behavior. From v1.27.0, each public Load More control also exposes a real `?page=N` destination. A normal browser click still appends the next batch in place, while a crawler, a modified click, or a browser without JavaScript can follow the same bounded page chain. Category and search scope are preserved in those links, and subfolder installations keep their configured base path.

When reviewing this warning:

1. Finish the current crawl before reading its issue totals.
2. Start a new crawl after upgrading so the crawler can discover the new page links. Changing crawler settings or site code does not rewrite an older report.
3. Inspect the incoming internal links for several reported URLs instead of accepting only the total count.
4. Compare the result with Google Search Console indexing and live URL inspection. A third-party audit and Search Console measure different things.
5. Confirm that visible navigation, article cards, categories, and Related Posts use real `<a href>` destinations.

The XML sitemap is a discovery source, not an incoming HTML link. Do not add hidden crawler-only links or place the complete article library on the homepage merely to clear an audit warning. VonCMS pagination remains intentionally bounded by Posts Per Page, but the real Older and Newer links now give non-JavaScript crawlers a complete public discovery path. If an audit still reports orphan pages, verify that it was started after the upgrade and inspect several incoming-link records before treating the total as a code defect.

### Appearance and themes

Current bundled themes include:

- VonCMS Default
- Von TechPress
- Von Prism
- Von Digest
- Von Portfolio
- Corporate Pro

When switching themes:

1. save your change
2. refresh the public site
3. check homepage, single post, and mobile layout

If you use custom theme settings, review them after each theme change instead of assuming every theme shares the same visual structure.

Inactive theme customizations remain saved for the next activation. Visitors receive only the active bundled theme's configuration plus shared appearance fields; Admin editing still loads the complete saved configuration. This trimming does not reset themes or move any data.

### Navigation

Use the navigation settings to control your public menu.

Typical items include:

- home
- pages
- categories
- external links

Check both desktop and mobile after changing navigation.

### Newsletter, ads, and widgets

Depending on your enabled modules, you may also manage:

- newsletter copy and placement
- ad slots
- sidebar layout
- extension-specific settings

Treat these as presentation tools. Keep them tidy so they support content instead of fighting it.

Ads Settings provides Header, In-feed, and Popup snippets. The in-feed interval applies to
listed posts, not the body of an individual article. Master Ad Switch controls these slots
and the built-in AdSense loader; a saved AdSense verification tag remains available when
ads are disabled. Script, iframe, and stylesheet snippets run in an isolated sandbox.
Configure any advertising consent required by your provider separately: the analytics
consent banner does not gate ad snippets, and a configured Publisher ID does not prove
Google approval or ad delivery. Custom sidebar widgets remain independently controlled.

### Extensions and plugins

Use the extensions area to enable or disable built-in plugin modules.

IndexNow, Google Analytics in Settings > Google, and VonAnalytics privacy controls are read-only for appointed Admins. Only the Primary Admin can change those controls; other SEO tabs, Search Console and AdSense retain their existing permissions.

Best practice:

- enable only what you actually use
- after changing extension settings, verify the related frontend area
- if a plugin exposes public UI and admin settings, keep both sides in sync

Developer documentation for building or auditing themes, plugins, and extensions lives in [Extension Development](EXTENSION_DEVELOPMENT.md).

## Backups and database tools

VonCMS includes database-oriented admin tooling for maintenance work.

Depending on your role and environment, you may be able to:

- export the database
- import a backup
- run repairs
- inspect storage or audit information

Always keep an external backup before doing destructive or high-impact maintenance.

## Updating the system

For supported installs, update from `Settings > System`.

Recommended routine:

1. back up database and uploads
2. run the update
3. verify homepage, admin, and one post
4. stop there if everything is healthy

Do not run Integrity Fix out of habit. Use it when you actually need to repair routing or protection files.

## Integrity Fix

Integrity Fix is a recovery tool, not a daily button.

Current behavior:

- creates a `.bak` backup
- repairs the VonCMS-managed routing block in `.htaccess`
- is designed to leave host-managed rules outside that block alone

Use it if routing looks broken, not as a normal publishing step.

## Troubleshooting checklist

If something feels wrong, check in this order:

1. confirm the issue is reproducible
2. check the public site and admin separately
3. clear browser cache
4. check theme and extension state
5. review `.htaccess` or recent host-level changes if pathing broke
6. restore from a backup if the problem came from a risky change

## Where to go next

- Installation and hosting: [INSTALL.md](INSTALL.md)
- Security notes: [SECURITY.md](SECURITY.md)
- Upgrade workflow: [UPGRADE.md](UPGRADE.md)
- API map: [API.md](API.md)

VonCMS works best when the admin workflow stays boring: publish, verify, back up, and only repair when there is a real reason.
