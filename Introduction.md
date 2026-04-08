# Introduction to VonCMS v1.22.0 "Kirana"

## Publishing should not feel like plugin maintenance.

Most people start a site because they have something to publish, not because they want to spend their week juggling plugins, updates, rebuilds, and hosting workarounds.

VonCMS came from that frustration. The goal was simple: keep the editing experience modern, keep deployment practical, and reduce the amount of glue work needed to run a content site.

Many CMS choices still force a tradeoff:

- **WordPress** - flexible, but often dependent on a long plugin stack for the basics.
- **Headless CMS** - fast and modern, but usually means a separate frontend deploy and a more complex hosting setup.
- **Static site generators** - great for some sites, but awkward for teams that publish and update content every day.

**VonCMS is built to avoid that tradeoff.**

## What you actually get

| You're tired of...                         | VonCMS gives you...                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Installing plugins for every basic feature | SEO, analytics, newsletter, comments, and media tools built in from the start.     |
| Waiting for pages to reload                | React 19 SPA navigation that stays fast after first load.                          |
| Needing a VPS for modern tech              | A PHP backend that still fits shared hosting and straightforward server setups.    |
| Your site breaking after an update         | OTA updates from the dashboard and a simpler stack to maintain.                    |
| Choosing between pretty and functional     | Six bundled themes with responsive layouts and dark mode support.                  |
| Google can't find your content             | Built-in sitemap, robots.txt, JSON-LD schema, IndexNow, and canonical URL support. |

## Who is this for?

- **You run a news site or content portal** - you need authors, editors, scheduled posts, editorial tracking, and quick publishing.
- **You are a blogger or creator** - you want a cleaner editor, bundled themes, and built-in SEO without extra setup.
- **You build client sites** - you want to deliver something modern without maintaining a large plugin stack on every install.
- **You work with a team** - roles, audit logs, draft workflows, and moderation need to be part of the CMS, not bolted on later.
- **You want fewer moving parts** - less time maintaining software, more time publishing.

## What makes VonCMS different

It's not trying to be everything. It's trying to be **the right thing** for people who publish content and want the technology to get out of the way.

- **One codebase.** Not a frontend repo + backend repo + deployment pipeline. One download. One install. You're live.
- **One hosting target.** Shared hosting. cPanel. The same $3/month plan you already have. No Docker. No Node.js. No DevOps degree required.
- **One system that includes the basics.** SEO? Built in. Analytics? Built in. Newsletter? Built in. Comments? Built in. You don't assemble your CMS from 15 different plugins hoping they don't fight each other.
- **Your data. Your server. Your rules.** VonCMS keeps your content on your hosting and under your control instead of pushing you into someone else's platform model.
- **Built for publishers first.** From the admin dashboard to the editor to the theme system, the product is meant to reduce friction for the people doing the publishing work.

## This is v1.22.0 "Kirana"

_"Kirana" - a ray of light; beauty and elegance that radiates._

In classical Malay, **kirana** means light, radiance, beauty, or grace - a word from old literary tradition that describes the kind of beauty which shines through.

It's the name we chose for the release that gave VonCMS a clearer identity: a **Hybrid Decoupled CMS** with a React SPA on the front and a PHP API on the back, shipped as one deploy without a Node.js production requirement.

_A ray of light that finally gave this project its name._

---

**Ready to see it in action?** -> [Installation Guide](INSTALL.md)  
**Want the full feature list?** -> [Features Overview](FEATURES.md)  
**Need help getting started?** -> [User Manual](MANUAL.md)
