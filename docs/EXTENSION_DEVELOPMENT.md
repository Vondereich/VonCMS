# VonCMS Extension Development Guide v1.25.8

This guide is the public source of truth for VonCMS theme and plugin development in the OpenGate line. It is written for developers using VS Code, Cursor, Antigravity, Codex, CLI agents, or any AI-assisted IDE to customize the public runtime without weakening deployment, security, SEO, or visual output.

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

VonCMS v1.25.8 separates normal appointed Admin access from primary-admin ownership. Extensions must respect that split.

Current rules:

- Root or Admin ID 1 is the primary admin boundary for raw SMTP/API secrets, Database Manager, database backup/import, settings audit/rollback, OTA updater, IndexNow owner actions, system repair, WordPress Bridge scan/import, media maintenance, and destructive media deletion.
- Appointed Admin can keep normal newsroom operations such as User Manager access, but server-side guards protect Admin ID 1 and Root accounts from non-primary modification or deletion.
- Moderator and Writer are staff roles, not secret/system owners.
- Public callers must never receive staff roles, emails, numeric public-profile IDs, joined dates, comment email hashes, or internal comment database/moderation fields.

For comments, appointed Admin/Moderator/Writer payloads may expose only `hasEmail`; raw `emailHash` is primary-admin only. Do not reintroduce Gravatar hashes or database IDs through extension-specific endpoints.

## Public Data Contract

Public theme props and public plugin payloads are already shaped by PHP response helpers before they reach React. Do not rebuild public privacy rules inside an extension.

The v1.25.8 public contract is:

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

| Area                          | Owner file                                              |
| ----------------------------- | ------------------------------------------------------- |
| Public theme mount            | `src/plugins/von-core/features/public/PublicSite.tsx`   |
| Theme definitions             | `src/plugins/von-core/features/themes/themeRegistry.ts` |
| Theme props                   | `src/themes/types.ts`                                   |
| Shared theme SDK              | `src/themes/shared/index.ts`                            |
| Shared public discovery hooks | `src/hooks/`                                            |
| Article plugin hooks          | `src/hooks/usePlugins.tsx`                              |
| Integration smoke gate        | `server/test-integration.cjs`                           |

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

- Registering a theme in `themeRegistry.ts` is not enough. New bundled themes must also be added to the lazy `themeLayouts` map in `PublicSite.tsx`.
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
| Article summaries           | `useAISummary`                             |
| Related posts               | `useRelatedPosts`                          |
| Profile articles/comments   | `useProfileActivity(targetUser, limit)`    |

Supported responsive image modes are `card`, `hero`, and `content`.

Use `ThemeLogo` for uploaded site logos instead of hand-rolled `<img>` sizing. The shared logo slot keeps normal uploaded logos inside a 112x38 mobile box and 140x45 desktop box, while logo-as-title mode uses a 150x48 mobile box and 180x56 desktop box without resizing the original file. Pass `settings.useLogoAsTitle` and `settings.invertLogoInDarkMode` through to `ThemeLogo` so the General Settings logo title and dark-mode invert toggles work consistently across bundled and custom themes.

Profile views must use `useProfileActivity` for author article totals, article pagination, comment totals, and comment pagination. Do not derive profile activity from the theme's local `posts` or `comments` props, because those props can be capped for public discovery and may not contain the user's complete contribution history.

### Crawlable Theme Links

Public links to posts, pages, profiles, categories, feeds, or any crawlable public URL should be real anchors, not button-only `onClick` handlers.

For post cards, sidebar items, timeline entries, and related-post surfaces:

- build the URL with `getPermalink(post, settings)`
- render an `<a href="...">`
- use `handleCrawlableLinkClick` to keep normal SPA navigation for plain left-clicks
- let browser-native behavior work for copy link, open in new tab, middle click, and modifier-click

Use a `<button>` only for UI actions that are not public navigation, such as filters, modals, dropdowns, load-more actions, editor commands, and admin controls.

### Minimal Theme Skeleton

```tsx
import React from 'react';
import { ThemeLayoutProps } from '../types';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
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
  const aiSummary = useAISummary(settings, post.content || '');
  const relatedPosts = useRelatedPosts(settings, post, posts, (relatedPost) =>
    onPostClick(relatedPost.id)
  );

  return (
    <main>
      <VonSEO settings={settings} currentView={currentView} selectedPost={post} />
      {aiSummary?.position === 'top' && aiSummary.component}

      <article>
        <h1>{decodeEntities(post.title)}</h1>
        {post.image && (
          <img {...getResponsiveImageAttributes(post, 'hero')} alt={decodeEntities(post.title)} />
        )}
        <ContentRenderer content={post.content || ''} />
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

### Registering a Theme

1. Create `src/themes/my-theme/Layout.tsx`.
2. Add `src/themes/my-theme/theme.json` with the same stable theme id.
3. Add a `ThemeDefinition` in `src/plugins/von-core/features/themes/themeRegistry.ts` and import its manifest.
4. Add the layout id to `themeLayouts` in `PublicSite.tsx`.
5. Add a theme settings modal only if the theme needs one.
6. Add smoke coverage when the theme introduces a new contract.

The theme id in the registry must match the id in `PublicSite.tsx`.

### Homepage Hero Performance Metadata

Themes whose homepage hero renders the first post image should set `homepageHero: 'first-post-image'` in their `theme.json` performance metadata:

```json
{
  "id": "theme-my-theme",
  "performance": {
    "homepageHero": "first-post-image"
  }
}
```

The build copies each `theme.json` into the matching Deploy theme folder. PHP SSR reads only the active theme manifest, while React imports the same file into its theme definition. Omit `homepageHero` for themes without that exact hero contract; preloading a normal card image can waste bandwidth and compete with the real LCP resource.

### Theme Verification

Run:

```bash
npm run typecheck
npx prettier --check .
npm run build
node server/test-integration.cjs
```

Manual checks:

- home renders without console errors
- single post renders visually polished content correctly
- page view renders page content
- profile route holds a valid public profile state and uses `useProfileActivity` for server-backed article/comment totals
- public profile views do not depend on stripped numeric user IDs, staff roles, or joined dates
- category/search pages use shared discovery behavior
- desktop, tablet, and mobile nav do not overlap
- disabling VonSEO stops theme-level `VonSEO`
- disabling VonAnalytics stops cookie banner and native tracking
- uploaded logos respect `useLogoAsTitle` and `invertLogoInDarkMode` through `ThemeLogo`
- image, video, table, quote, and code block content survives public rendering

### Common Theme Mistakes

- Adding a theme to `themeRegistry.ts` but not to `PublicSite.tsx`.
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

## Plugin Development

Plugins and extensions are for optional behavior: SEO helpers, analytics, widgets, article blocks, campaign bars, integrations, and admin tools.

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
  version: '1.25',
  author: 'VonCMS Team',
  render: (location: PluginLocation, config?: any) => {
    if (location !== 'header_top') return null;
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

### Settings Modals

Built-in plugin settings usually live beside the plugin:

```text
src/plugins/von-core/features/plugins/built-in/[plugin]/SettingsModal.tsx
```

Then wire the modal from `ExtensionsManager.tsx`.

Do not mirror one plugin's settings in multiple admin areas unless there is a current runtime owner for that split. The v1.25.8 baseline keeps per-extension config in Extensions, while site identity stays in General Settings.

Secret-bearing configuration does not belong in public plugin config. Store it in a protected settings group or dedicated backend path, let `get_settings.php` mask it for non-primary admins, and make save paths ignore protected secret keys from non-primary admins.

Media CDN settings are delivery hints, not an upload/offload integration. Plugins should consume the media URL returned by upload/list APIs and should not add their own CDN prefix unless they own a future CDN/offload integration.

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

### Custom HTML Plugins

Custom HTML/CSS plugins are user-supplied content, not trusted system code.

Runtime rules:

- `PluginSlot` filters custom plugins by `enabled` and `location`
- HTML is sanitized with `sanitizeHtml`
- inline event attributes are stripped
- `javascript:` hrefs are stripped
- custom CSS is scoped by wrapper expectations, not trusted

Do not bypass the sanitizer for imported plugin HTML.

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
