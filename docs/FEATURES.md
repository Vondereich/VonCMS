# VonCMS Features

> VonCMS v1.25.12 feature baseline for the OpenGate line.

## Introduction to VonCMS v1.25.12 "OpenGate"

### Publishing should not feel like plugin maintenance.

Most people start a site because they have something to publish, not because they want to spend their week juggling plugins, updates, rebuilds, and hosting workarounds.

VonCMS came from that frustration. The goal was simple: keep the editing experience modern, keep deployment practical, and reduce the amount of glue work needed to run a content site.

Many CMS choices still force a tradeoff:

- **WordPress** - flexible, but often dependent on a long plugin stack for the basics.
- **Headless CMS** - fast and modern, but usually means a separate frontend deploy and a more complex hosting setup.
- **Static site generators** - great for some sites, but awkward for teams that publish and update content every day.

**VonCMS is built to avoid that tradeoff.**

### What you actually get

| You're tired of...                         | VonCMS gives you...                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Installing plugins for every basic feature | SEO, analytics, newsletter, comments, and media tools built in from the start.     |
| Waiting for pages to reload                | React 19 SPA navigation that stays fast after first load.                          |
| Needing a VPS for modern tech              | A PHP backend that still fits shared hosting and straightforward server setups.    |
| Your site breaking after an update         | OTA updates from the dashboard and a simpler stack to maintain.                    |
| Choosing between pretty and functional     | Six bundled themes with responsive layouts and dark mode support.                  |
| Google can't find your content             | Built-in sitemap, robots.txt, JSON-LD schema, IndexNow, and canonical URL support. |

### Who is this for?

- **You run a news site or content portal** - you need authors, editors, scheduled posts, editorial tracking, and quick publishing.
- **You are a blogger or creator** - you want a cleaner editor, bundled themes, and built-in SEO without extra setup.
- **You build client sites** - you want to deliver something modern without maintaining a large plugin stack on every install.
- **You work with a team** - roles, audit logs, draft workflows, and moderation need to be part of the CMS, not bolted on later.
- **You want fewer moving parts** - less time maintaining software, more time publishing.

### What makes VonCMS different

It's not trying to be everything. It's trying to be **the right thing** for people who publish content and want the technology to get out of the way.

- **One codebase.** Not a frontend repo + backend repo + deployment pipeline. One download. One install. You're live.
- **One hosting target.** Shared hosting. cPanel. The same $3/month plan you already have. No Docker. No Node.js. No DevOps degree required.
- **One system that includes the basics.** SEO? Built in. Analytics? Built in. Newsletter? Built in. Comments? Built in. You don't assemble your CMS from 15 different plugins hoping they don't fight each other.
- **Your data. Your server. Your rules.** VonCMS keeps your content on your hosting and under your control instead of pushing you into someone else's platform model.
- **Built for publishers first.** From the admin dashboard to the editor to the theme system, the product is meant to reduce friction for the people doing the publishing work.

### This is v1.25.12 "OpenGate"

_"OpenGate" - the open-source handoff line, focused on making VonCMS easier to inspect, fork, customize, install, and verify._

**OpenGate** builds on the closed HourGlass editor baseline with clearer developer onboarding, safer direct-entry routing, self-hosted default fonts, slow-route loading guards, and AI key/completion handling polish.

It keeps the **Hybrid Decoupled CMS** identity, the server-bound admin scalability work, and the installer/repair hardening together under one stable line without introducing a separate Node.js production requirement.

_A more inspectable source boundary for the same publisher-first direction._

---

## CMS Comparison Guide 2026

### Let's be honest about what you're actually choosing.

You're not picking a CMS. You're picking your daily workflow for the next few years.

Every choice here has trade-offs. The question is: **which trade-offs match your reality?**

### The honest breakdown

| What matters to you    | VonCMS                                             | WordPress                                          | Ghost                                                  | Headless CMS                                    |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **Hosting cost**       | Shared hosting, $3/month works                     | Shared hosting, $3/month works                     | Usually needs managed hosting                          | Separate frontend + backend means double stack  |
| **How the site feels** | SPA navigation is instant after first load         | Page reloads every click unless heavily customized | Clean and fast, but still page-driven                  | Whatever your frontend team builds              |
| **Plugin dependency**  | Low: SEO, analytics, newsletter, comments built in | High: most real sites need 15-30 plugins           | Moderate: some things built in, many need integrations | Custom development instead of plugins           |
| **Setup effort**       | Download, upload, install wizard                   | Download, install, then start adding plugins       | Easy on managed hosting, harder when self-hosted       | High: developers and deployment pipeline needed |
| **Who manages it?**    | You, the publisher                                 | You plus your plugin ecosystem                     | You, the writer                                        | Your dev team                                   |
| **Best for**           | Modern publishing on normal hosting                | Maximum plugin ecosystem                           | Clean blogging experience                              | Teams with custom requirements                  |

### The real conversation nobody has

**"But WordPress has 60,000 plugins!"**

Yes. And many are abandoned, outdated, or security risks. The average WordPress site runs a long plugin stack. Each one is a dependency you did not write, cannot fully audit, and must update hoping nothing breaks.

The question is not "how many plugins exist?" It is "how many plugins can you afford to maintain?" VonCMS ships with the essentials built in, so you are not assembling a working CMS from 15 different strangers' code.

**"But headless is the future!"**

It is if you have a frontend team, a backend team, and a DevOps person. If you are a solo publisher or a small team, headless often means managing three repositories, two hosting bills, and a deployment pipeline just to change a blog post.

There is also the bigger question: **where does your data actually live?** With most headless platforms, your content sits on their servers, behind their API, under their terms. If they change pricing, shut down, or have an outage, your site can go dark.

VonCMS gives you the React frontend experience without the headless deployment headache and without handing your content over to a third-party platform. One codebase. One server. Your data.

**"But Ghost is simpler!"**

For pure blogging, yes. Ghost is elegant. But the moment you need custom themes beyond their defaults, third-party integrations, or self-hosting on cheap shared hosting, the walls close in. Ghost's extension model is narrow compared to what VonCMS includes out of the box.

### When to pick each platform

Pick VonCMS when:

- You want a React-based frontend that feels like an app.
- You want to host on normal PHP hosting: shared hosting, cPanel, or a small VPS.
- You want SEO, analytics, newsletter, comments, media management, and themes working on day one.
- You are tired of managing 20+ plugins and hoping they do not break each other.
- You run a news site, blog, content portal, or agency client site.
- You want fewer moving parts than a headless stack.

Pick WordPress when you need the largest plugin ecosystem, rely on niche third-party integrations that already exist as WordPress plugins, are comfortable maintaining plugin conflicts and security patches, or are building an ecommerce-first site where WooCommerce is the priority.

Pick Ghost when your site is primarily a publication or newsletter, you want the smallest focused writing experience, you accept a narrower extension surface, and you are willing to pay for managed hosting or run Node.js hosting yourself.

Pick a headless CMS when you already have frontend developers building custom applications, need the same content API across many channels, and accept the cost of a more complex deployment and hosting story.

### The maintenance cost nobody talks about

The real difference between CMS platforms is not the download price. It is what you pay over time in time, money, and frustration.

| Platform      | Long-term operating shape                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **WordPress** | Cheap install, then plugin costs, security overhead, maintenance contracts, speed work, and more plugins to fix plugin problems. |
| **Headless**  | Developer time, separate hosting layers, deployment pipeline, ongoing maintenance, and scaling complexity.                       |
| **Ghost**     | Easy start, managed hosting premium pricing, limited customization, and possible outgrowth.                                      |
| **VonCMS**    | Install, publish, OTA updates, minimal maintenance, and focus on content.                                                        |

VonCMS tries to keep the operating model simple: one publish stack, one hosting target, one codebase. Not because it is the easiest to build, but because it is easier to live with.

### Current product state

| Detail         | Value                                     |
| -------------- | ----------------------------------------- |
| Stable release | `v1.25.12 "OpenGate"`                     |
| Minimum PHP    | `8.2+`                                    |
| Architecture   | React 19 frontend + PHP API backend       |
| Hosting        | Shared hosting, cPanel, VPS - your choice |
| Full changelog | [CHANGELOG.md](../CHANGELOG.md)           |

### Bottom line

VonCMS is for people who want a clean publishing workflow, a modern frontend feel, and hosting requirements that stay realistic. It is built for users, not developers: every design decision prioritizes the person creating content, not the person writing code.

---

## Everything you need. Nothing you don't.

Most CMS projects hand you an empty shell and say "figure it out with plugins."

VonCMS arrives with the lights on, the furniture in place, and the kitchen already stocked.

It's not a starter kit. It's not a boilerplate. It's a **fully working publishing platform** that you could hand to a client tomorrow and they could start using it immediately.

---

## Publishing & Admin

### Your command center.

The admin dashboard is where you'll spend most of your time. It should feel good.

- **Post manager** — create, edit, schedule, archive. Full draft workflow.
- **Page manager** — static pages with the same editor experience.
- **Media manager** — upload, organize, search, regenerate thumbnails, clean orphaned files. WebP conversion built in.
- **User manager** — admins, moderators, writers, subscribers. Role-based permissions that actually work.
- **Comment moderation** — approve, reject, reply, track spam. Staff see pending comments, guests see only approved.
- **Database manager** — inspect, export, import, and repair the active VonCMS database. See [Database Manager](DATABASE_MANAGER.md).
- **Security dashboard** — login logs, session monitoring, security health at a glance.
- **Contact forms manager** — build forms, manage submissions, no third-party service needed.
- **Newsletter manager** — subscriber lists, export CSV, manage subscriptions.
- **Extensions manager** — toggle plugins, configure settings, all from one place.

**Why this matters:** Every single one of these would be a separate plugin in WordPress. Here, they're just... tabs in the sidebar.

---

## SEO & Discoverability

### Google should find you. Not the other way around.

You shouldn't need an SEO degree to make your site visible. VonCMS handles the technical SEO automatically so you can focus on writing good content.

- **Dynamic sitemap.xml** — updates automatically when you publish.
- **Dynamic robots.txt** — generated crawl-policy defaults discourage indexing of internal paths; server access controls remain authoritative.
- **Dynamic llms.txt** — publishes a concise Markdown content index for compatible AI/LLM clients.
- **Canonical URL handling** — no duplicate content penalties.
- **SEO-aware permalinks** — slug-based, date-based, category-based — your choice.
- **Redirect manager** — 301 redirects with loop detection. No broken links.
- **Open Graph & social meta** — your links look good when shared on Facebook, Twitter, WhatsApp.
- **JSON-LD schema output** — structured data for Google rich results.
- **IndexNow support** — submits the canonical post URL when content is published; indexing remains controlled by each participating search engine.
- **RSS feed** — full content, images, author metadata. `?limit`, `?category`, `?offset` support.

**Why this matters:** In WordPress, this is Yoast + RankMath + Redirection + IndexNow plugin + RSS customizer. Five plugins. Five update cycles. Five things that can break. In VonCMS, it's just how the system works.

---

## Media & Site Operations

### Your media library should work as hard as you do.

- **Image upload pipeline** — drag and drop, multi-upload, progress tracking.
- **WebP support** — smaller files, faster pages, automatic conversion.
- **Responsive image variants** — auto-generates widths for srcset. Mobile gets small images, desktop gets large ones.
- **Thumbnail regeneration** — fix aspect ratios across your entire library in one click.
- **Orphan media cleanup** — find and delete files no post references.
- **CDN URL support** — point uploads to your CDN without changing upload workflow.
- **Media sync tool** — scans the `uploads/` folder and indexes FTP/file manager uploads into the database.
- **OTA updater** — one-click updates from the dashboard. No FTP. No manual file replacement.
- **Integrity Check** — verifies core files haven't been corrupted or tampered with.
- **Repair .htaccess** — one-click fix for broken rewrite rules.
- **Database repair utility** — fixes missing schema columns, auto-heals common issues.
- **WordPress XML migrator** — import from WordPress with auto media re-hosting, Gutenberg cleanup, embed conversion, and checkpoint resume.

**Why this matters:** Your media library shouldn't be a black hole. VonCMS gives you tools to manage it, clean it, and optimize it — without touching a single plugin.

---

## Engagement & Monetization

### Your audience should stay, not bounce.

- **Native comments system** — nested replies, likes, moderation queue, no Disqus dependency.
- **Newsletter subscribe widget** — capture emails from any page.
- **Newsletter subscriber manager** — view, export, manage your list. No Mailchimp tax.
- **Contact form submission** — built-in forms with validation, spam protection, email delivery.
- **Ad slots** — header, in-feed, popup placements. Built for AdSense and custom ad networks.
- **Promo bar** — announcement bar at the top of your site.
- **Floating gift widget** — seasonal promotions, floating action button.

**Why this matters:** Every engagement feature ships with the system. You're not installing "comments plugin v3.2.1" and hoping it doesn't conflict with your theme.

---

## AI & Smart Features

### AI that helps, not hypes.

VonCMS includes AI-oriented tooling without the marketing noise:

- **AI Write endpoint** — optional draft generation from prompts when the AI backend is configured.
- **AI Check endpoint** — optional content review workflow when the AI backend is configured.
- **AI Summary plugin** — auto-extract article summaries without external API calls. Fast and free.
- **AI-ready site language settings** — configure how AI interacts with your content.

**Why this matters:** The local AI Summary flow works without API billing, while editor AI drafting and checking can be enabled when you actually want an external AI provider in the workflow.

---

## Built-In Plugins

### Extensions that come with the house.

These plugins ship with every install. No marketplace. No purchase. No "premium upgrade" wall.

| Plugin                  | What it does                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **VonSEO**              | Full SEO system — Schema.org, OpenGraph, meta tags, sitemap, IndexNow, RSS feed link |
| **VonAnalytics**        | Privacy-focused visitor tracking dashboard. No Google dependency.                    |
| **Related Posts**       | Auto-show related articles after each post based on category and tags.               |
| **Promo Bar**           | Top announcement bar — display notifications above the main menu.                    |
| **Holiday Gift Widget** | Floating gift icon at bottom right — seasonal promotions and campaigns.              |
| **AI Summary**          | Auto-extract article summaries — no API, no cost, no delay.                          |

---

## Included Themes

### Six themes. Six different vibes. All production-ready.

Every theme ships with dark mode, responsive design, and modern styling out of the box.

| Theme             | Best for                    | Vibe                                           |
| ----------------- | --------------------------- | ---------------------------------------------- |
| **Default**       | Clean minimal sites         | Simple, fast, no distractions                  |
| **TechPress**     | News portals & tech blogs   | Professional, structured, breaking news ticker |
| **Digest**        | Magazines & content portals | Modern magazine layout with category filtering |
| **Prism**         | Creative & colorful sites   | Vibrant, bold, futuristic accents              |
| **Portfolio**     | Creatives & freelancers     | Stunning single-page showcase                  |
| **Corporate Pro** | Business & enterprise       | Professional, structured, service-oriented     |

**Why this matters:** Most CMS platforms give you one theme and call it a day. VonCMS gives you six — each designed for a different type of site. Pick the one that matches your vision and start publishing.

Developer note: extension work is documented in [Extension Development](EXTENSION_DEVELOPMENT.md).

---

## Who VonCMS Is For

VonCMS is not for everyone. And that's intentional.

**It's a strong fit if you:**

- Run a news site, blog, or content portal and want to publish faster
- Are a small agency delivering client sites on budget hosting
- Want a modern admin experience without Node.js complexity
- Are tired of managing 20+ WordPress plugins and hoping they don't conflict
- Need SEO, analytics, newsletter, comments, and media tools — all working on day one
- Want to host on shared hosting (cPanel, $3/month) and still have a React-powered site

**It's probably not for you if you:**

- Need an ecommerce-first platform (use WooCommerce or Shopify)
- Want the largest plugin ecosystem on the planet (use WordPress)
- Already have a dev team building custom apps from a headless API
- Need a specific niche integration that only exists as a WordPress plugin

---

## Summary

VonCMS is best understood as a **complete CMS product**, not a thin shell or empty framework.

The default package already includes enough functionality to run a production site. No plugin assembly required. No "essential plugins" shopping list. No "you'll also need..." recommendations.

Install it. Pick a theme. Start publishing.

**Everything else is already there.**

### The VonCMS Philosophy

**VonCMS is built for users, not developers.**

This isn't a subtle distinction — it's the core design principle behind every feature, every UI decision, every default setting:

- The admin dashboard is designed for the person who publishes content daily, not the engineer who configured the server.
- The editor feels like writing in a document, not coding in an IDE.
- Settings are explained in plain language, not technical jargon.
- OTA updates work with one click — no SSH, no Git pull, no "clear your cache and pray."

If a feature makes life easier for a non-technical user, it ships. If it only impresses developers, it doesn't.

**VonCMS doesn't exist to make developers feel clever. It exists to make publishers feel empowered.**

---

## Performance Under the Hood

### Performance posture

VonCMS is built to stay light on disk and direct at runtime. The current `v1.25.12` release line keeps a small package surface, server-side pagination, indexed read paths for large content libraries, and a direct React-to-PHP-to-MySQL request path without a plugin-heavy middleware stack.

### Why does this matter?

Because the important promise is architectural: when traffic climbs, VonCMS already avoids the common plugin-stack overhead and keeps the request path short enough for disciplined tuning.

### What's behind the posture?

- **80 PHP API files** — current API surface under `public/api/`, with 94 public PHP files covered by the lint gate across the public runtime.
- **Release audit coverage** — routing hardening, response contracts, host-header risk reduction, importer SSRF blocking, and race-condition fixes were all reviewed in the current release pass.
- **Light package surface** — current local `v1.25.12` release artifacts stay small for a full CMS package while keeping installer, docs, bundled themes, and self-hosted Inter font files intact.
- **Direct API calls** — React talks to PHP. PHP talks to MySQL. Done.
