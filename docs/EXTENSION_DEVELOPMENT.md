# VonCMS Extension Development Guide v1.26.9

This guide is the public source of truth for VonCMS theme and plugin development in the After Hours line. It is written for developers using VS Code, Cursor, Antigravity, Codex, CLI agents, or any AI-assisted IDE to customize the public runtime without weakening deployment, security, SEO, or visual output.

Use the shared contracts first, then the theme-specific or plugin-specific sections below.

## Architecture Philosophy

VonCMS is intentionally designed as:

- hybrid decoupled
- shared-hosting first
- PHP runtime friendly
- React-powered for admin and public UX
- publishing-first, not app-shell-first
- core production deploy does not require Node.js

The architecture prioritizes:

- maintainability
- deployment simplicity
- long-term compatibility
- SEO stability
- low hosting barrier
- predictable release packaging

The point is simple: a publisher should be able to ship a serious site on normal PHP hosting while still getting a modern editing and frontend experience. Extensions should make that workflow better without turning VonCMS into a plugin-chaos platform.

## Why No Headless-Only Mode

VonCMS core does not require a Node.js production runtime or a headless-only frontend.

Reasons:

- shared hosting stays viable
- infrastructure cost stays low
- deployment remains understandable to non-platform teams
- public SEO output can be kept stable
- fewer moving parts means fewer operational failures
- agencies can hand off sites without handing off a JavaScript hosting stack

Bundled themes, bundled plugins, and release ZIPs must not require a separate frontend server, SSR service, queue worker, serverless function layer, or persistent Node process in production. Open-source users can build beyond the default stack, but the core extension contract must stay deployable on the normal PHP runtime.

## Golden Rules

- Never break public rendering contracts silently.
- Never bypass shared sanitization.
- Never hardcode plugin activation checks.
- Never invent a second plugin status store.
- Never duplicate public runtime ownership from `PublicSite.tsx`.
- Prefer shared SDK utilities and hooks before custom implementations.
- Never create a second source of truth for SEO defaults or robots rules.
- Never treat profile and category routes as optional.
- Never mutate editor content behind the user's back.
- Never ship extension output that is mounted but visually broken.
- Treat custom HTML plugins as untrusted user content.
- Add smoke coverage for every new runtime contract.
- Never update one bundled theme when the contract applies to all bundled themes.

## Compatibility Levels

This guide uses three compatibility levels:

| Level       | Meaning                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Required    | The extension is not VonCMS-compatible if this contract is missing or bypassed.                                         |
| Conditional | Required when the extension uses the named route, setting, slot, API, media position, or public behavior.               |
| Recommended | Not a runtime gate by itself, but should be followed unless the extension documents and tests a deliberate alternative. |

Compilation is not the compatibility standard. A theme can compile while still breaking category discovery, subfolder links, plugin activation, public privacy, SEO hydration, responsive media, or keyboard navigation. A plugin can render while still bypassing status ownership, leaking private settings, or leaving stale network work behind. VonCMS compatibility means the extension follows the complete applicable contract and passes the verification matrix in this guide.

Bundled themes and built-in plugins must satisfy every Required rule and every Conditional rule they activate. Third-party source extensions should use the same standard before claiming compatibility with a VonCMS release.

## Security Principles

Security is top tier in VonCMS because themes and plugins run inside real production sites.

Theme developers must:

- render rich post/page HTML through `ContentRenderer`
- use `sanitizeHtml` only through established shared paths unless a new sanitizer contract is reviewed
- avoid raw `dangerouslySetInnerHTML`
- never inject unsanitized ad, plugin, profile, or post data
- avoid `javascript:` links and inline event handlers
- preserve auth-sensitive UI boundaries and never expose admin-only data in public layouts

Plugin developers must also:

- require authenticated sessions for mutating requests
- pass CSRF validation
- use centralized security gates
- validate role/capability before work
- validate input on the PHP side
- return structured JSON errors
- keep secrets in private settings, never public plugin config
- avoid broad file writes, broad filesystem scans, and direct SQL string interpolation

Themes normally should not create mutating API calls at all. If a theme or plugin needs a backend mutation, treat it as security-sensitive backend feature work, not layout polish.

## RBAC and Private Data Boundaries

VonCMS v1.26.9 separates normal appointed Admin access from primary-admin ownership. Extensions must respect that split.

Current rules:

- Root or Admin ID 1 is the primary admin boundary for raw SMTP/API secrets, Database Manager, database backup/import, settings audit/rollback, OTA updater, IndexNow owner actions, system repair, WordPress Bridge scan/import, media maintenance, and destructive media deletion.
- Appointed Admin can keep normal newsroom operations such as User Manager access, but server-side guards protect Admin ID 1 and Root accounts from non-primary modification or deletion.
- Moderator and Writer are staff roles, not secret/system owners.
- Public callers must never receive staff roles, emails, numeric public-profile IDs, joined dates, comment email hashes, or internal comment database/moderation fields.

For comments, appointed Admin/Moderator/Writer payloads may expose only `hasEmail`; raw `emailHash` is primary-admin only. Do not reintroduce Gravatar hashes or database IDs through extension-specific endpoints.

## Public Data Contract

Public theme props and public plugin payloads are already shaped by PHP response helpers before they reach React. Do not rebuild public privacy rules inside an extension.

The v1.26.9 public contract is:

- public post/page/bootstrap payloads do not expose internal `author_id`
- public comment payloads omit `dbId`, `userId`, moderation `status`, and `emailHash`
- appointed staff comment payloads may show `hasEmail`, while raw `emailHash` is primary-admin only
- public profile lookups do not expose numeric user IDs, staff roles, or joined dates
- profile owner UI must detect the current logged-in user by the authenticated session or username, not by stripped public numeric IDs
- avatar URLs are scrubbed to HTTPS-or-local paths before rendering
- draft and scheduled content is not visible to guest/public SSR or public APIs until published and due

Extensions may render normal presentation fields such as title, slug, content, excerpt, author display name, avatar, category, dates, and public status where the shared content contract provides them. If an extension needs private user, role, email, moderation, database identifiers, or settings secrets, it needs a backend capability review.

## Performance Philosophy

Performance is a core feature, not a cleanup pass.

Avoid:

- unnecessary hydration
- duplicate runtime fetches
- client-side overfetching
- polling without a bounded reason
- theme-local search flows when shared discovery hooks already exist
- oversized framework dependencies
- importing inactive bundled themes or plugin UI into the initial public entry
- large images without responsive helpers
- doing expensive work for every page view when a post-only hook would do

Use the shared public discovery path, responsive image helpers, lazy loading, active-state gates, and scoped view hooks. An extension should make the current site feel faster, not hide work behind loading spinners.

For custom typography, start with [Custom Fonts](CUSTOM_FONTS.md). Keep fonts local, licensed, and scoped to the theme or bundle that owns them. Do not add runtime Google Fonts imports or broad CDN font dependencies to bundled themes.

## Visual WYSIWYG Contract

In this guide, WYSIWYG means what the visitor actually sees: spacing, hierarchy, responsive behavior, contrast, media framing, loading states, empty states, and final polish. The editor content contract is one part of that, not the whole definition.

Extension developers must:

- judge public output on desktop, tablet, and mobile
- keep plugin output, content blocks, navigation, sidebars, and footer areas visually integrated
- avoid overlaps, unstable heights, clipped labels, and awkward default states
- render post/page body content through `ContentRenderer`
- preserve table, quote, code block, image figure, caption, credit, and video aspect styling
- keep live rendering aligned with editor preview where practical
- avoid stripping classes or attributes that the sanitizer and renderer intentionally allow
- test single-post content with images, embeds, tables, quotes, and code blocks
- not rewrite post/page content unless the user explicitly triggers that action
- use `post_after` or article hooks for article add-ons instead of mutating the article body
- preserve SEO fields and manual excerpts unless the feature explicitly owns them

If the visible public result looks broken even though the code is technically mounted, the extension is not done. AI-assisted plugins must be especially careful: suggestions are allowed, silent content mutation is not.

## Source of Truth

When docs and code disagree, use this order:

1. Runtime code in `src/`, `public/`, and `server/test-integration.cjs`.
2. `CHANGELOG.md`.
3. Product docs in `docs/`.

Theme owner files:

| Area                          | Owner file                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| Public theme mount            | `src/plugins/von-core/features/public/PublicSite.tsx`       |
| Active-theme lazy loader      | `src/plugins/von-core/features/public/themeLayoutLoader.ts` |
| Theme definitions             | `src/plugins/von-core/features/themes/themeRegistry.ts`     |
| Theme props                   | `src/themes/types.ts`                                       |
| Shared theme SDK              | `src/themes/shared/index.ts`                                |
| Shared public discovery hooks | `src/hooks/`                                                |
| Article plugin hooks          | `src/hooks/usePlugins.tsx`                                  |
| Integration smoke gate        | `server/test-integration.cjs`                               |

Plugin owner files:

| Area                       | Owner file                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| System plugin registry     | `src/plugins/von-core/features/plugins/registry.tsx`             |
| Plugin active-state helper | `src/utils/pluginRuntime.ts`                                     |
| Article plugin hooks       | `src/hooks/usePlugins.tsx`                                       |
| Extensions dashboard       | `src/plugins/von-core/features/extensions/ExtensionsManager.tsx` |
| Built-in plugin folders    | `src/plugins/von-core/features/plugins/built-in/`                |
| Public global slots        | `src/plugins/von-core/features/public/PublicSite.tsx`            |
| Custom HTML sanitizer path | `src/plugins/von-core/features/plugins/registry.tsx`             |
| Integration smoke gate     | `server/test-integration.cjs`                                    |

## VonCMS Compatibility Contract

Every theme or plugin must keep these owners intact:

| Concern                     | Required owner and behavior                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Public route resolution     | `App.tsx` resolves the route and passes state into `PublicSite.tsx`; themes render that state rather than creating a second router.            |
| Theme selection             | `ThemeContext.tsx`, `themeRegistry.ts`, and `themeLayoutLoader.ts` own selection, fallback, and active-theme lazy loading.                     |
| Posts and category search   | Shared public hooks own bounded server discovery, stale-request rejection, loading, error, pagination, and search limits.                      |
| Public URLs                 | `siteUtils.ts` owns base-path-aware permalinks, category/profile links, configured menu targets, and safe URL normalization.                   |
| Rich content                | `ContentRenderer` owns sanitized post/page body rendering, supported embeds, figures, tables, quotes, code, shortcodes, and public typography. |
| SEO and crawler output      | PHP SSR owns raw crawler output; conditional `VonSEO` rendering owns the hydrated plugin layer. Themes do not invent separate canonical rules. |
| Plugin activation           | `isSystemPluginActive` owns the combined `activePlugins` plus `pluginStatus` decision.                                                         |
| Site and extension settings | General Settings owns site identity; theme namespaces and `pluginConfig[pluginId]` own extension-specific values.                              |
| Public privacy              | PHP response shaping owns field removal. Extensions consume the safe payload and must not recreate stripped private identifiers.               |
| Release proof               | Typecheck, formatting, build, integration tests, PHP lint where applicable, and route-level manual checks prove compatibility.                 |

An extension may add presentation or a bounded feature, but it must not take ownership away from these shared contracts without a deliberate core change that updates all consumers, SSR behavior, tests, and documentation together.

## Runtime Map

```text
App.tsx
  -> resolves currentView and selected content
  -> renders PublicSite

PublicSite.tsx
  -> reads activeTheme from ThemeContext
  -> lazy-loads the selected theme layout
  -> mounts global plugin slots
  -> mounts GlobalLightbox
  -> gates CookieBanner and native tracking through VonAnalytics state

src/themes/[theme]/Layout.tsx
  -> renders home, single-post, page, profile, and category views
  -> uses the shared theme SDK
  -> calls article plugin hooks when rendering a post
  -> renders VonSEO only when the shared runtime says VonSEO is active

ExtensionsManager.tsx
  -> reads AVAILABLE_PLUGINS
  -> persists activePlugins and pluginConfig.pluginStatus
  -> opens per-plugin settings modals

PluginSlot
  -> filters system plugins through isSystemPluginActive
  -> filters custom HTML plugins by enabled + location
  -> sanitizes custom HTML before injection
```

Important rules:

- Registering a theme in `themeRegistry.ts` is not enough. New bundled themes must also be added to `publicThemeLayoutLoaders` in `themeLayoutLoader.ts`.
- `header_top` and `footer_bottom` plugin slots are owned globally by `PublicSite.tsx`.
- Article-only plugin output belongs in theme layouts through `useAISummary` and `useRelatedPosts`.
- Public plugin state must be checked with `isSystemPluginActive(settings, pluginId)`.
- Media CDN support is delivery-only. Extensions should render the media URLs they receive and should not prepend CDN domains themselves.

## Theme Development

Themes are for presentation and public UX. Every public theme receives `ThemeLayoutProps` from `src/themes/types.ts`.

Required views:

- `home`
- `single-post`
- `page`
- `profile`
- `category`

If a theme ignores one of these, it is incomplete.

Search is not a sixth `currentView`. Public search stays on the homepage discovery surface through `publicSearchQuery` and `onPublicSearchChange`, while category URLs use the `category` view and `selectedCategory`.

### Theme Route and State Matrix

| Public surface | Required input                                                                 | Required output and behavior                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home           | `posts`, `settings`, and shared public discovery state                         | Render the configured listing, honest loading/error/empty states, bounded Load More behavior, and stable layout during background refresh.                      |
| Search         | `publicSearchQuery`, `onPublicSearchChange`, and `onClearSearch` when provided | Keep the shared bounded query synchronized, render server-backed results, preserve direct/reload URL state, and do not create a second search parameter format. |
| Category       | `currentView === 'category'`, `selectedCategory`, `onCategoryClick`            | Render the selected category through shared discovery, keep the stored category label visible, and preserve base-path-safe category links.                      |
| Single post    | `selectedPost`                                                                 | Render title, effective publish information, responsive featured media, sanitized body content, comments, and active article plugins without refetching it.     |
| Page           | `selectedPage`                                                                 | Render the page title and body through `ContentRenderer`; do not assume page payloads have post-only fields.                                                    |
| Profile        | `selectedProfile` and the shared profile hooks                                 | Resolve public identity safely and use `useProfileActivity` for totals, pagination, loading, errors, and complete article/comment activity.                     |

`App.tsx` handles unresolved post/page/profile loading and public 404 decisions before the final theme view is mounted. A theme must not turn a missing selection into a fabricated post, redirect unknown content to Home, or run its own ambiguous slug resolver.

### ThemeLayoutProps Ownership

Treat `ThemeLayoutProps` as a read-only runtime contract:

- `posts` is a lightweight initial/public discovery set, not a complete database export.
- `pages`, `comments`, and `allUsers` may be intentionally bounded or privacy-shaped.
- `selectedPost` and `selectedPage` are the resolved full-content records for their routes.
- `settings` is the current sanitized site configuration and may contain runtime-only public projections that must never be persisted by a theme.
- navigation callbacks are the SPA actions owned by the core; use them only after providing a valid crawlable `href` where one exists.
- comment callbacks and loading/error fields belong to the shared discussion flow; do not create a second comment store inside a layout.
- `user` is the authenticated viewer, not the public profile target.
- themes must not mutate prop arrays, settings objects, selected content, or user objects in place.

Use `usePublicPostsQuery` when a homepage, search, category, or Load More surface needs results beyond the initial set. Use `useProfileActivity` for profile contributions and `useSinglePost`/the selected route record for exact article content. Do not fetch all posts, pages, users, or comments to make a theme self-sufficient.

### Shared Theme SDK

Import shared behavior from `src/themes/shared/index.ts` before creating local copies.

| Need                        | Use                                        |
| --------------------------- | ------------------------------------------ |
| Rich post/page HTML         | `ContentRenderer`                          |
| User-facing titles/excerpts | `decodeEntities`                           |
| Content images              | `getResponsiveImageAttributes(item, mode)` |
| Comments                    | `VpComments`                               |
| Sidebar widgets             | `VpSidebarWidget`                          |
| Newsletter                  | `VonNewsletter`                            |
| Ads                         | `AdBlock`, `VonPopupAd`, `useAdsPopup`     |
| SEO                         | `VonSEO`                                   |
| Site logo                   | `ThemeLogo`                                |
| Configured navigation       | `PublicNavigationLink` component path      |
| Article summaries           | `useAISummary`                             |
| Related posts               | `useRelatedPosts`                          |
| Profile articles/comments   | `useProfileActivity(targetUser, limit)`    |

Choose the responsive image mode that matches the rendered slot, not the source file width:

- `portalHero` for the TechPress/Digest 60 percent desktop lead image
- `splitHero` for a full-width mobile image that becomes half of the viewport on desktop
- `articleHero` or `wideArticleHero` for single-content headers
- `gridTwoMd`, `gridThreeMd`, and `gridFourMd` when a grid starts at the `md` breakpoint
- `gridTwoSm`, `gridThreeSm`, and `gridFourSm` when a grid starts at the `sm` breakpoint
- `gridThreeFromMd` when the layout changes directly from one to three columns at `md`
- `gridThreeSmMd` when a grid changes from one to two columns at `sm` and three at `md`
- `listCard`, `thumbnail96`, and `thumbnail128` for fixed or compact slots
- `card`, `hero`, and `content` remain available for backward-compatible custom-theme usage

The helper never upscales an original. A 740-pixel upload stays at 740 pixels; larger uploads can expose 480, 768, 960, and original-width candidates as available.

Use `getHeaderIdentityState(settings)` before rendering a custom theme header. Its `showUploadedLogo`, `showFallbackMark`, `showTitle`, and `logoUsesTitleSlot` values implement Logo + Text, Logo Only, Text Only, missing-logo fallback, and legacy-setting compatibility in one place. Then use `ThemeLogo` for an uploaded logo instead of a hand-rolled `<img>`. The shared logo slot keeps normal uploaded logos inside a 112x38 mobile box and 140x45 desktop box, while logo-only mode uses a 150x48 mobile box and 180x56 desktop box without resizing the original file. Pass `logoUsesTitleSlot` and `settings.invertLogoInDarkMode` through to `ThemeLogo`.

The legacy `settings.useLogoAsTitle` boolean remains synchronized for older extensions, but it only represents the older Logo + Text and Logo Only states. A custom theme that reads only that boolean cannot hide a stored logo for Text Only. Use the shared resolver to support all three modes.

Profile views must use `useProfileActivity` for author article totals, article pagination, comment totals, and comment pagination. Do not derive profile activity from the theme's local `posts` or `comments` props, because those props can be capped for public discovery and may not contain the user's complete contribution history.

`PublicNavigationLink` currently lives at `src/themes/shared/components/PublicNavigationLink.tsx`. Use it for configured menu entries because it resolves published page/post projections, normal URLs, base paths, and unresolved-target button fallback in one place.

### Theme Settings Ownership

Keep site-wide and theme-specific settings separate:

| Setting kind                        | Owner                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Site name, tagline, logo, favicon   | General Settings top-level fields                                                       |
| Header identity and logo dark mode  | `headerIdentityMode`, legacy synchronization, and `invertLogoInDarkMode`                |
| Shared theme tokens                 | `settings.theme.primaryColor`, `fontFamily`, `borderRadius`, and reviewed shared fields |
| Theme-specific options              | A stable `settings.theme.<themeNamespace>` object                                       |
| Theme registration defaults         | `ThemeDefinition.config` and `extendedConfig`                                           |
| Optional performance preload signal | The matching `theme.json` manifest                                                      |

When saving one theme namespace, spread the current `settings.theme` object and the current namespace before applying changed fields. Replacing the complete `theme` object can erase the settings of inactive themes. A new namespace must be added to `ThemeConfig`, validated by its settings UI, bounded on the server when it accepts URLs, HTML, lists, or large text, and preserved by unrelated saves.

Do not store site identity again under a theme namespace. A theme may choose how to display `siteName`, `siteTagline`, `logoUrl`, and the resolved header identity state, but General Settings remains their only owner.

### Crawlable Theme Links

Public links to posts, pages, profiles, categories, feeds, or any crawlable public URL should be real anchors, not button-only `onClick` handlers.

For post cards, sidebar items, timeline entries, and related-post surfaces:

- build the URL with `getPermalink(post, settings)`
- render an `<a href="...">`
- use `handleCrawlableLinkClick` to keep normal SPA navigation for plain left-clicks
- let browser-native behavior work for copy link, open in new tab, middle click, and modifier-click

Use a `<button>` only for UI actions that are not public navigation, such as filters, modals, dropdowns, load-more actions, editor commands, and admin controls.

Never concatenate the install folder manually. Root domains, subdomains, and subfolder installs must use `getPermalink`, `getPublicHomeHref`, `getPublicCategoryHref`, `getPublicProfileHref`, `getPublicNavigationHref`, or `normalizeSiteUrl` as appropriate. Do not assume the base path is `/`, do not prefix `domainUrl` twice, and do not copy the current permalink format into theme-local code.

### Theme SEO, SSR, and No-JavaScript Boundary

Theme React code is not the raw page-source owner. `public/index.php` and the shared SEO helpers generate crawler-facing status, canonical, robots, Open Graph, Twitter metadata, JSON-LD, initial hydration, and the theme-neutral no-JavaScript reading view.

Required rules:

- render `VonSEO` only when `isSystemPluginActive(settings, 'vp_von_seo')` is true
- pass the current view and selected route data into `VonSEO`; do not build a second metadata tree in the theme
- let `PublicSite.tsx` provide the fallback document title when VonSEO is inactive
- never change a post permalink, canonical, breadcrumb, robots directive, schema identity, or publication timestamp in presentation code
- do not add a theme-owned `<title>`, canonical link, robots tag, Open Graph set, Twitter set, or JSON-LD script
- preserve search as `noindex, follow` through the existing server route rather than trying to control it from a search component
- keep article/page HTML semantic, but do not duplicate the core no-JavaScript fallback inside each theme

If a future extension introduces a new public content type or route, React output alone is insufficient. The core change must also define PHP route matching, HTTP status, canonical behavior, robots policy, raw metadata, hydration data, no-JavaScript output when appropriate, sitemap/feed ownership, root/subfolder behavior, and integration tests before the route is considered supported.

### Theme Media Contract

- Use the final media URL supplied by the backend. Do not prepend a CDN or upload path in the theme.
- Use `getResponsiveImageAttributes` with the mode that matches the rendered slot.
- Keep intrinsic aspect ratio or a stable CSS aspect box so loading does not move surrounding content.
- The first visible LCP candidate may use eager loading and high fetch priority; below-fold cards, profile media, and related items should remain lazy.
- Set meaningful `alt` text for informative images and an empty `alt` for truly decorative images.
- Do not upscale a small original or request an original file merely because the CSS box is wide.
- Do not preload a conditional image. Use theme manifest preload metadata only when the first post image is always the homepage hero.

### Theme Accessibility and Interaction Contract

- Use semantic `header`, `nav`, `main`, `article`, `aside`, and `footer` landmarks where applicable.
- Use anchors for destinations and buttons with `type="button"` for actions.
- Give icon-only controls an accessible name and visible keyboard focus.
- Menus and disclosures must expose their expanded state, remain reachable by keyboard, and not depend on hover alone.
- Preserve modifier-click, middle-click, copy-link, and open-in-new-tab behavior on public links.
- Keep text and controls readable in light and dark mode with saved theme colors, long labels, translated copy, and browser zoom.
- Respect reduced-motion preferences for non-essential movement and avoid animation that blocks interaction.
- Provide honest loading, empty, error, retry, and disabled states instead of blank containers.

### Minimal Theme Skeleton

```tsx
import React from 'react';
import { ThemeLayoutProps } from '../types';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { getPermalink } from '../../utils/siteUtils';
import {
  VonSEO,
  ContentRenderer,
  decodeEntities,
  getResponsiveImageAttributes,
  useAISummary,
  useRelatedPosts,
} from '../shared';

const SinglePostView: React.FC<{
  props: ThemeLayoutProps;
  post: NonNullable<ThemeLayoutProps['selectedPost']>;
}> = ({ props, post }) => {
  const { posts, settings, currentView, onPostClick } = props;
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');
  const aiSummary = useAISummary(settings, post.content || '');
  const relatedPosts = useRelatedPosts(settings, post, posts, (relatedPost) =>
    onPostClick(relatedPost.id)
  );

  return (
    <main>
      {shouldRenderVonSEO && (
        <VonSEO settings={settings} currentView={currentView} selectedPost={post} />
      )}
      {aiSummary?.position === 'top' && aiSummary.component}

      <article>
        <h1>{decodeEntities(post.title)}</h1>
        {post.image && (
          <img
            {...getResponsiveImageAttributes(post, 'articleHero')}
            alt={decodeEntities(post.title)}
          />
        )}
        <ContentRenderer html={post.content || ''} />
      </article>

      {aiSummary?.position === 'bottom' && aiSummary.component}
      {relatedPosts}
    </main>
  );
};

const MyThemeLayout: React.FC<ThemeLayoutProps> = (props) => {
  const { posts, settings, currentView, selectedPost, onPostClick } = props;

  if (currentView === 'single-post' && selectedPost) {
    return <SinglePostView props={props} post={selectedPost} />;
  }

  return (
    <main>
      {posts.map((post) => (
        <a
          key={post.id}
          href={getPermalink(post, settings)}
          onClick={(event) =>
            handleCrawlableLinkClick(event, () => {
              onPostClick(post.id);
            })
          }
        >
          {decodeEntities(post.title)}
        </a>
      ))}
    </main>
  );
};

export default MyThemeLayout;
```

This skeleton demonstrates shared ownership only. It is not a complete theme until the page, profile, category, search/discovery, comments, settings, plugin, empty/error, responsive, and accessibility contracts applicable to the design are implemented and verified.

### Registering a Theme

1. Create `src/themes/my-theme/Layout.tsx`.
2. Add `src/themes/my-theme/theme.json` with the same stable theme id.
3. Add or extend the theme-specific settings type under `ThemeConfig` only when the theme owns configurable fields.
4. Add a complete `ThemeDefinition` in `src/plugins/von-core/features/themes/themeRegistry.ts`, import its manifest, and add it to `THEMES`.
5. Add the same id and lazy layout import to `publicThemeLayoutLoaders` in `themeLayoutLoader.ts`.
6. If the theme has settings, add one settings component and wire its exact id in `ExtensionsManager.tsx`; save only its namespace while preserving sibling theme settings.
7. Reuse the global `header_top` and `footer_bottom` slots already mounted by `PublicSite.tsx`. Do not mount them again inside the theme.
8. Implement every required view and all applicable shared plugin hooks.
9. Add integration coverage for registration, loader presence, route behavior, links, plugin toggles, and any new runtime contract.

The id in `theme.json`, `ThemeDefinition`, `THEMES`, `publicThemeLayoutLoaders`, settings wiring, and saved `activeThemeId` must match exactly. A missing loader causes the runtime to resolve to the Default theme; a registry-only entry is not a working theme.

The manifest is not a free-form settings file. Its current runtime purpose is stable theme identity plus optional bounded performance metadata copied into Deploy artifacts. Keep editable site preferences in `SiteSettings`, not in `theme.json`.

### Homepage Hero Performance Metadata

Themes whose homepage hero always renders the first post image should set `homepageHero: 'first-post-image'` and publish the exact same `sizes` string used by the React hero:

```json
{
  "id": "theme-my-theme",
  "performance": {
    "homepageHero": "first-post-image",
    "homepageHeroSizes": "(max-width: 1023px) calc(100vw - 40px), 960px"
  }
}
```

The build copies each `theme.json` into the matching Deploy theme folder. PHP SSR reads only the active theme manifest, while React imports the same file into its theme definition. The preload and rendered image must use identical `sizes` values so the browser reuses the selected candidate instead of downloading two files. Omit `homepageHero` for conditional hero-image modes or themes without that exact first-post contract; preloading an unused image or a normal card can waste bandwidth and compete with the real LCP resource.

### Theme Verification

Run:

```bash
npm run typecheck
npx prettier --check .
npm run build
node server/test-integration.cjs
npm run lint:php
```

Manual checks:

- home renders without console errors
- root domain, subdomain, and subfolder installs produce the same route behavior without doubled or missing path prefixes
- single post renders visually polished content correctly
- page view renders page content
- profile route holds a valid public profile state and uses `useProfileActivity` for server-backed article/comment totals
- public profile views do not depend on stripped numeric user IDs, staff roles, or joined dates
- category/search pages use shared discovery behavior
- direct search URLs restore the field and results where the theme exposes public search
- configured menu, logo, category, profile, post, page, Home, and Back destinations are real safe anchors when resolvable
- modifier clicks and keyboard navigation keep browser-native link behavior
- desktop, tablet, and mobile nav do not overlap
- light mode, dark mode, long site names, long menu labels, empty content, loading, error, and no-result states remain usable
- disabling VonSEO stops theme-level `VonSEO`
- disabling VonAnalytics stops cookie banner and native tracking
- uploaded logos respect `getHeaderIdentityState`, `logoUsesTitleSlot`, and `invertLogoInDarkMode` through `ThemeLogo`
- image, video, table, quote, and code block content survives public rendering
- the first meaningful image has the intended LCP behavior and below-fold images stay lazy
- raw page source keeps the core metadata and no-JavaScript contract because the theme did not create competing ownership

### Common Theme Mistakes

- Adding a theme to `themeRegistry.ts` but not to `THEMES` and `themeLayoutLoader.ts`.
- Checking `activePlugins.includes(id)` directly instead of `isSystemPluginActive`.
- Rendering `VonSEO` while the VonSEO plugin is disabled.
- Duplicating `ContentRenderer`, comments, sidebar, newsletter, or ad behavior.
- Building a theme-local search system instead of using shared discovery.
- Rendering post navigation as button-only `onClick` handlers instead of crawlable anchors.
- Counting profile articles/comments from capped local `posts` or `comments` props instead of `useProfileActivity`.
- Reading `author_id`, `userId`, `dbId`, `emailHash`, profile role, or joined date from public payloads.
- Adding a CDN prefix in the theme instead of trusting the media URL returned by the backend.
- Rendering custom logo `<img>` elements instead of `ThemeLogo`, which breaks shared sizing and the dark-mode invert setting.
- Updating only one bundled theme when the contract applies to all six.
- Treating a successful TypeScript build as proof that route, SEO, privacy, base-path, responsive, and accessibility contracts pass.
- Fetching settings, the selected post/page, or a complete post list again inside the theme.
- Replacing `settings.theme` when saving one theme namespace.
- Creating theme-owned canonical, robots, metadata, schema, or no-JavaScript output.
- Importing every theme into the initial public bundle instead of using the active-theme lazy loader.

## Plugin Development

Plugins and extensions are for optional behavior: SEO helpers, analytics, widgets, article blocks, campaign bars, integrations, and admin tools.

### Supported Plugin Models

| Model                     | Purpose                                                                                             | Delivery boundary                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Built-in system plugin    | Typed React behavior shipped with VonCMS                                                            | Source change, registry entry, admin/runtime wiring, build, tests, and release package               |
| Custom HTML/CSS plugin    | Bounded administrator-authored visual output in an existing slot                                    | Stored configuration, server bounds, enabled/location filter, sanitized HTML, and scoped CSS         |
| Backend-integrated plugin | A system plugin that also needs PHP persistence, an authenticated mutation, a public read, or a job | Source-built React plus reviewed PHP endpoint, security gates, API documentation, and PHP/runtime QA |

VonCMS does not treat an arbitrary uploaded PHP file as an installable safe plugin. Code plugins are source extensions that must pass the normal build, backend review, and release process. The Custom HTML/CSS model is presentation-only and does not grant PHP execution.

### System Plugin Shape

System plugins are React plugins that ship with VonCMS. They are registered in:

```text
src/plugins/von-core/features/plugins/registry.tsx
```

Plugin shape:

```ts
export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  render: (location: PluginLocation, props?: any) => React.ReactNode;
}
```

Allowed locations:

```ts
type PluginLocation = 'header_top' | 'footer_bottom' | 'sidebar_top' | 'post_after';
```

Use stable ids. Existing built-in plugins use the `vp_` prefix.

### Creating a System Plugin

Create a folder:

```text
src/plugins/von-core/features/plugins/built-in/my-plugin/index.tsx
src/plugins/von-core/features/plugins/built-in/my-plugin/types.ts
src/plugins/von-core/features/plugins/built-in/my-plugin/SettingsModal.tsx
```

Minimal plugin:

```tsx
import React from 'react';
import { PluginDefinition, PluginLocation } from '../../../../../../types';

export const MyPlugin: PluginDefinition = {
  id: 'vp_my_plugin',
  name: 'My Plugin',
  description: 'Short admin-facing description.',
  version: '1.26',
  author: 'VonCMS Team',
  render: (location: PluginLocation, rawConfig?: unknown) => {
    if (location !== 'header_top') return null;
    const config =
      rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
        ? (rawConfig as { enabled?: boolean })
        : {};
    if (config?.enabled === false) return null;

    return <div className="vp-my-plugin">My plugin output</div>;
  },
};
```

Register it:

```tsx
import { MyPlugin } from './built-in/my-plugin';

export const AVAILABLE_PLUGINS: PluginDefinition[] = [MyPlugin];
```

`ExtensionsManager.tsx` uses `AVAILABLE_PLUGINS` to build admin cards.

### Activation and Settings Ownership

Plugin-specific config belongs in:

```ts
settings.pluginConfig?.[pluginId];
```

Plugin status belongs in:

```ts
settings.activePlugins;
settings.pluginConfig?.pluginStatus?.[pluginId];
```

Runtime checks must use:

```ts
isSystemPluginActive(settings, pluginId);
```

That helper requires:

- the plugin id exists in `activePlugins`
- `pluginConfig.pluginStatus[pluginId]` is absent or equals `active`

Do not check only `activePlugins`.

Plugin versions are descriptive metadata in the current registry, not an automatic core compatibility gate. Keep the value accurate, document the VonCMS baseline tested, and retest the plugin whenever a shared type, slot, payload, security boundary, or route contract changes.

### Settings Modals

Built-in plugin settings usually live beside the plugin:

```text
src/plugins/von-core/features/plugins/built-in/[plugin]/SettingsModal.tsx
```

Then wire the modal from `ExtensionsManager.tsx`.

Do not mirror one plugin's settings in multiple admin areas unless there is a current runtime owner for that split. The v1.26.9 baseline keeps per-extension config in Extensions, while site identity stays in General Settings.

Secret-bearing configuration does not belong in public plugin config. Store it in a protected settings group or dedicated backend path, let `get_settings.php` mask it for non-primary admins, and make save paths ignore protected secret keys from non-primary admins.

Media CDN settings are delivery hints, not an upload/offload integration. Plugins should consume the media URL returned by upload/list APIs and should not add their own CDN prefix unless they own a future CDN/offload integration.

### Backend Plugin and API Contract

A plugin that introduces PHP behavior must follow [API](API.md) and [Security](SECURITY.md) in addition to this guide.

Required for mutating endpoints:

- allow only the required HTTP method and handle bounded preflight behavior where applicable
- load the central security/config bootstrap through the established path
- require a current authenticated session and the narrowest role or primary-owner capability that fits the action
- validate CSRF before mutation
- validate JSON/form input shape, scalar types, lengths, enum values, counts, URLs, and file boundaries on the server
- use prepared statements and transactions when several writes must succeed or fail together
- apply a dedicated rate limit to abuse-sensitive public or authentication-adjacent actions
- return controlled JSON through the shared response helpers without PHP warning HTML, stack traces, secrets, submitted tokens, or database diagnostics
- release the PHP session lock before slow read-only database or network work when the endpoint no longer needs to mutate session state

Required for public read endpoints:

- expose only fields needed by public rendering
- enforce published and schedule-ready visibility before returning content
- bound page, limit, offset, search length, and sort options
- use deterministic secondary ordering for pagination
- avoid fetching full content when a list card does not need it
- preserve root and subfolder URL behavior through the shared API base path

Any plugin that writes files must use a confined owned directory, normalized paths, bounded sizes, complete temporary writes before activation, and reference-safe cleanup. Do not add broad recursive writes or infer ownership from a URL string.

### Crawlable Plugin Links

Plugins that render public navigation to posts, pages, profiles, categories, feeds, or other public routes should output real anchors, not button-only click handlers.

For article widgets, related-post blocks, sidebar widgets, and campaign content that points to a public route:

- use the same permalink helper contract as themes, such as `getPermalink(post, settings)` for posts
- render an `<a href="...">`
- use `handleCrawlableLinkClick` when the plugin needs SPA-style in-app navigation on plain left-clicks
- preserve browser-native behavior for copy link, open in new tab, middle click, and modifier-click

Use buttons for plugin actions, dismissals, toggles, modals, and admin controls. Do not use `javascript:` URLs or inline event attributes.

### Rendering Locations

| Location        | Owner                                       |
| --------------- | ------------------------------------------- |
| `header_top`    | `PublicSite.tsx` global slot                |
| `footer_bottom` | `PublicSite.tsx` global slot                |
| `sidebar_top`   | Theme or sidebar code when explicitly wired |
| `post_after`    | Theme-level article plugin hooks            |

Article plugins should normally use `src/hooks/usePlugins.tsx`. That keeps every bundled theme consistent and avoids hidden global post state.

Global slots must remain outside theme layout ownership. A theme must not remount `header_top` or `footer_bottom`, and a plugin must not assume `sidebar_top` or `post_after` exists unless the active theme explicitly wires the relevant shared hook or slot.

### Custom HTML Plugins

Custom HTML/CSS plugins are user-supplied content, not trusted system code.

Runtime rules:

- only the primary administrator may change the site-wide `customPlugins` collection
- saves require a bounded list with valid IDs, names, supported locations, and bounded HTML/CSS text
- `PluginSlot` filters custom plugins by `enabled` and `location`
- HTML is sanitized with `sanitizeHtml`
- inline event attributes are stripped
- `javascript:` hrefs are stripped
- custom CSS is scoped by wrapper expectations, not trusted

Do not bypass the sanitizer for imported plugin HTML.

Custom CSS must use a plugin-specific wrapper prefix and must not reset `html`, `body`, `#root`, theme layout, admin, or generic element styles globally. Sanitized HTML does not make unrestricted CSS harmless.

### Plugin Lifecycle, Accessibility, and Performance

- Return `null` outside the plugin's supported location and when its own bounded config disables output.
- Keep hooks unconditional and place activation decisions inside the hook or stable component boundary.
- Clean up timers, observers, DOM listeners, and subscriptions when output unmounts or activation changes.
- Abort or ignore stale network responses; do not allow an older request to replace newer state.
- Do not poll unless the feature has a bounded reason, a visible-tab rule, serialization, and cleanup.
- Scope CSS and DOM ids to the plugin id so two extensions cannot collide.
- Use semantic output, accessible names, keyboard focus, and visible focus states for plugin controls.
- Preserve browser-native link behavior and use safe normalized URLs.
- Provide an honest empty/error state or render nothing; do not leave a blank reserved slot.
- Avoid importing admin settings UI, editor dependencies, or unrelated plugins into the public entry bundle.
- Activation, deactivation, route changes, post changes, dark mode, and unmount/remount must not leave duplicate UI or stale state.

### Built-In Plugin Baselines

| Plugin        | Runtime owner                   | Notes                                                                                                                             |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| VonSEO        | Theme layouts plus `VonSEO.tsx` | Reads site-level default description from General Settings and uses route-specific overrides for posts/pages/profiles/categories. |
| VonAnalytics  | Providers plus `PublicSite.tsx` | GA injection, native tracking, and cookie banner are gated by `vp_analytics`.                                                     |
| Promo Bar     | `header_top` slot               | Supports text, link, color, campaign windows, dismiss hours, and target behavior.                                                 |
| Gift Widget   | `footer_bottom` slot            | Supports target URL, tooltip, label, color, position, and target behavior.                                                        |
| AI Summary    | article hook                    | Uses post content and active plugin state.                                                                                        |
| Related Posts | article hook                    | Uses current post, all posts, theme colors, and active plugin state.                                                              |

### Plugin Smoke Coverage

When changing plugins, extend `server/test-integration.cjs` for the behavior you touched.

Useful existing smoke contracts:

- `System Plugin Runtime Helper Contract`
- `VonSEO Theme Toggle Contract`
- `VonAnalytics Runtime Toggle Contract`
- `VonSEO General Description Source Contract`
- `VonSEO Default Description Drift Guard`
- `Robots Crawl Delay Google Contract`
- `Robots Crawl Delay Warning Guard`
- `Built-In Plugin Product Polish Contract`
- `Article Plugin Render Guard`
- `Extensions Runtime Status Contract`
- `Centralized Public Payload Privacy Boundary`
- `Public Comment Minimal Payload Boundary`
- `Primary Admin Owner Endpoint Boundary`
- `Appointed Admin User Manager Boundary`
- `Public SSR Visibility Contract`

### Release Checklist

Run:

```bash
npm run typecheck
npx prettier --check .
npm run build
node server/test-integration.cjs
npm run lint:php
```

If the change ships in release artifacts:

```bash
node create_release.cjs
node server/test-integration.cjs
```

Record warnings honestly. The current known warning is PHP lint skip when no PHP binary is available locally.

### Common Plugin Mistakes

- Checking `activePlugins.includes(id)` directly.
- Saving plugin status outside `pluginConfig.pluginStatus`.
- Rendering article-only plugins without post context.
- Shipping visually broken plugin output because the data path works.
- Rendering public post/category/profile navigation as button-only click handlers.
- Mutating editor content silently.
- Bypassing `sanitizeHtml` for custom HTML.
- Duplicating VonSEO robots or site-description ownership.
- Adding frontend settings without a backend persistence path.
- Adding PHP endpoints without auth, CSRF, and role checks.
- Exposing `author_id`, `userId`, `dbId`, raw `emailHash`, staff role, joined date, or settings secrets in public plugin output.
- Treating appointed Admin as primary admin for backup/import/query/settings-audit/system-repair/media-delete behavior.
- Prefixing uploaded media URLs with a CDN domain after the backend has already returned the final URL.
- Assuming registry version text automatically protects the plugin from an incompatible core release.
- Leaving timers, requests, observers, or document listeners active after deactivation or route change.
- Using global CSS selectors that restyle the theme or admin outside the plugin wrapper.
- Treating sanitized custom HTML as permission to run arbitrary JavaScript or PHP.

## SEO and Robots Ownership

Extensions must not create a second site-level default meta description, robots default, sitemap default, or crawler policy owner.

Current ownership:

- site meta description default: `settings.siteDescription`
- admin edit location: General Settings
- VonSEO runtime fallback: `src/plugins/von-core/features/seo/VonSEO.tsx`
- robots default and delivery: `public/robots.php`
- robots UI fetch: `VonSEOSettings.tsx` calls `robots.php?default=json`
- direct PHP SSR in `public/index.php` owns crawler-facing canonical, Open Graph, JSON-LD, and initial hydration for known post/page routes
- public SSR must only hydrate published content whose schedule has passed

`robots.txt` must not emit `Crawl-delay: 1` as a default.

## Cross-Extension Acceptance Matrix

Before a theme or plugin is considered compatible, verify every applicable row:

| Area                 | Minimum proof                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration         | Stable id, every required registry/loader/settings entry, inactive/default fallback, and no duplicate owner.                                        |
| Root and subfolder   | Home, post, page, profile, category, search, assets, API requests, and configured navigation work at `/` and a subfolder such as `/news/`.          |
| Public discovery     | Direct load, SPA navigation, hard reload, category change, search restore/clear, Load More, empty, error, and retry behavior.                       |
| SEO and crawler      | Correct raw status/canonical/robots/metadata/schema, conditional VonSEO hydration, crawlable anchors, and no competing theme/plugin metadata owner. |
| Content rendering    | Long text, headings, lists, links, colors, images, captions, embeds, tables, quotes, code, shortcodes, and malformed legacy content fail safely.    |
| Privacy and security | Guest, Member, Writer, Moderator, appointed Admin, and primary Admin receive only their permitted data and actions.                                 |
| Settings persistence | Saving one extension preserves unrelated site, inactive-theme, and other-plugin settings; secret placeholders cannot overwrite stored secrets.      |
| Responsive behavior  | Phone, tablet, desktop, zoom, light/dark mode, long labels, keyboard navigation, focus, reduced motion, and touch interaction remain usable.        |
| Performance          | No duplicate boot fetch, no unbounded list, no inactive polling, no inactive-theme eager import, correct responsive images, and no false preload.   |
| Lifecycle            | Activate, configure, deactivate, reactivate, navigate, hard reload, and uninstall/state-retention behavior matches the documented product decision. |
| Packaging            | Source and Deploy contain required manifests/assets and exclude runtime credentials, generated private data, and local development files.           |

For a public navigation or related-post change, do not stop at a direct article load. Run a multi-hop flow such as Home -> Post A -> related Post B -> related Post C, then separately verify direct load and hard reload. This catches stale selected-content state that a one-page screenshot cannot prove.

## Definition of Compatible

An extension is ready only when:

1. its runtime owner and settings owner are unambiguous
2. every Required and applicable Conditional rule above is implemented
3. source types, all affected bundled themes, PHP SSR, and backend endpoints remain aligned
4. automated checks pass without dismissing real failures as environment noise
5. manual route, responsive, accessibility, and lifecycle checks pass
6. changelog and developer documentation describe the real shipped behavior without claiming unsupported compatibility
7. release artifacts contain the required extension files and no live secrets or private runtime data

If any of those are unknown, report the extension as under verification rather than VonCMS-compatible.
