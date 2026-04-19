# VonCMS User Manual v1.23.0

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
4. Upload your logo and favicon.
5. Create at least one category and one navigation item.
6. Make a backup once the site is configured.

## Dashboard

The dashboard is your control center. It usually gives you a quick read on:

- content counts
- latest activity
- system health
- storage or maintenance tools

Use it as the first place to check whether the site is behaving normally after updates or configuration changes.

## Managing posts

Posts are used for articles, news, and normal publishing work.

Typical flow:

1. Open `Posts`.
2. Create a new post or edit an existing one.
3. Fill in title, content, excerpt, category, image, and status.
4. Save as draft or publish.

Good habits:

- keep titles clear and specific
- add an excerpt for listing pages
- use a featured image with sensible dimensions
- review the public permalink before sharing

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
