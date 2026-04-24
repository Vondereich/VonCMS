# VonCMS Features

> VonCMS v1.23.7 feature baseline for the Rentaka line.

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
- **Dynamic robots.txt** — secure by default, blocks sensitive paths.
- **Dynamic llms.txt** — AI crawlers can read your content structure.
- **Canonical URL handling** — no duplicate content penalties.
- **SEO-aware permalinks** — slug-based, date-based, category-based — your choice.
- **Redirect manager** — 301 redirects with loop detection. No broken links.
- **Open Graph & social meta** — your links look good when shared on Facebook, Twitter, WhatsApp.
- **JSON-LD schema output** — structured data for Google rich results.
- **IndexNow support** — ping search engines instantly when you publish. No waiting for crawlers.
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

VonCMS is built to stay light on disk and direct at runtime. The current `v1.23.7` release line keeps a small package surface, server-side pagination and FULLTEXT baselines for large content libraries, and a direct React-to-PHP-to-MySQL request path without a plugin-heavy middleware stack.

Internal Rentaka benchmark notes were useful during tuning, but they are environment-specific and should be treated as directional engineering evidence, not a universal production guarantee. Final throughput depends on hosting tier, database shape, traffic mix, CDN or cache layers, and the exact endpoint under load.

### Why does this matter?

Because the important promise is architectural: when traffic climbs, VonCMS already avoids the common plugin-stack overhead and keeps the request path short enough for disciplined tuning.

### Search benchmark snapshot

This local benchmark snapshot used a dataset of `30,035` posts, with `20,150` published posts in the measured read path.

| Test                                   | Query                                         | Results                | Avg Time | Min      | Max      |
| -------------------------------------- | --------------------------------------------- | ---------------------- | -------- | -------- | -------- |
| FULLTEXT Search                        | `MATCH(title, content) AGAINST('teknologi')`  | 5,665                  | 133.98ms | 117.53ms | 186.21ms |
| LIKE Search (Legacy)                   | `LIKE '%teknologi%'`                          | 5,665                  | 220.69ms | 213.09ms | 235.66ms |
| FULLTEXT Multi-Word                    | `AGAINST('teknologi carian' IN BOOLEAN MODE)` | 7,615                  | 144.91ms | 136.40ms | 156.49ms |
| Status Filter (`idx_status_date`)      | `WHERE status = 'published'`                  | 20,150                 | 7.98ms   | 7.52ms   | 8.51ms   |
| Category Filter (`idx_category`)       | `WHERE category = 'Teknologi'`                | 3,082                  | 1.43ms   | 1.30ms   | 1.78ms   |
| Comments by Post (`idx_post_id`)       | `WHERE post_id = 1`                           | 1 total / 0 for post 1 | 0.13ms   | 0.11ms   | 0.22ms   |
| Pages by Status (`idx_status`)         | `WHERE status = 'published'`                  | 0 total / 0 published  | 0.21ms   | 0.11ms   | 0.57ms   |
| Media Sort by Date (`idx_uploaded_at`) | `ORDER BY uploaded_at DESC LIMIT 20`          | 57 total / 20 returned | 0.29ms   | 0.22ms   | 0.49ms   |

- FULLTEXT was `1.6x` faster than the legacy `LIKE` search path on this dataset.
- Indexed status, category, comments, pages, and media lookups stayed in the low-millisecond range during the same run.
- Treat this as a local benchmark snapshot, not as a universal SLA for every host or content mix.

### What's behind the posture?

- **73 HTTP API request handlers** — 71 dedicated handlers under `public/api/` plus 2 legacy bridge handlers in `public/`.
- **Release audit coverage** — routing hardening, response contracts, host-header risk reduction, importer SSRF blocking, and race-condition fixes were all reviewed in the current release pass.
- **Light package surface** — current local `v1.23.7` release artifacts stay in the sub-1MB class while keeping installer, docs, and bundled themes intact.
- **Direct API calls** — React talks to PHP. PHP talks to MySQL. Done.
