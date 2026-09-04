# VonCMS User Manual v1.27.0

This guide is for site owners, editors, and admins who want to run VonCMS day to day without digging through the codebase.

## Getting into the admin panel

Open your site and go to:

- `/admin`
- or `/login`

Sign in with the account created during installation.

If you cannot see a menu that this manual mentions, the most common reasons are:

- your role does not have access
- the related module is disabled
- the current screen is hidden by the active layout or plugin state

## First things to do after install

Before you start publishing, check these basics:

1. Confirm `Site Name`, `Site URL`, and tagline.
2. Set your main theme in the Appearance section.
3. Review SEO defaults, sitemap, and robots.txt.
4. Upload your logo and favicon, then choose Logo + Text, Logo Only, or Text Only under Header Identity.
5. Create at least one category and one navigation item.
6. Make a backup once the site is configured.

## Dashboard

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

Admin dialogs and media lightboxes stay inside the visible viewport and can normally be closed with their Close control, the backdrop, or Escape. Update progress is deliberately protected from accidental backdrop or Escape dismissal while an OTA operation is running.

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

## Media library

Use the media area to upload and manage files.

Typical tasks:

- upload featured images
- re-use existing media inside posts and pages
- remove unused files
- inspect file names, URLs, and image variants

VonCMS supports a WebP-aware media flow. Depending on the upload context and settings, some image uploads may be converted during processing.

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

### Extensions and plugins

Use the extensions area to enable or disable built-in plugin modules.

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
