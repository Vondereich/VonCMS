# VonCMS Theme Development Guide v1.25.3

This guide is the theme-specific source of truth for VonCMS v1.25.3. It is written for developers using VS Code, Cursor, Antigravity, Codex, CLI agents, or any AI-assisted IDE to build public themes without breaking the publishing runtime.

For plugin work, use [Plugin Development](PLUGIN_DEVELOPMENT.md).

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

The point is simple: a publisher should be able to ship a serious site on normal PHP hosting while still getting a modern editing and frontend experience.

## Why No Headless-Only Mode

VonCMS core does not require a Node.js production runtime or a headless-only frontend.

Reasons:

- shared hosting stays viable
- infrastructure cost stays low
- deployment remains understandable to non-platform teams
- public SEO output can be kept stable
- fewer moving parts means fewer operational failures
- agencies can hand off sites without handing off a JavaScript hosting stack

For bundled themes and release ZIPs, do not require a separate frontend server, SSR service, queue worker, or Node runtime in production. Open-source users can still build beyond the default stack, but the core theme contract must stay deployable on the normal PHP runtime.

## Golden Rules

- Never break public rendering contracts silently.
- Never bypass shared sanitization.
- Never hardcode plugin activation checks.
- Never duplicate theme runtime ownership from `PublicSite.tsx`.
- Prefer shared SDK utilities before custom implementations.
- Never create a second source of truth for SEO defaults or robots rules.
- Never treat profile and category routes as optional.
- Never update one bundled theme when the contract applies to all bundled themes.

## Security Principles

Security is top tier in VonCMS because this code runs inside a real CMS project, not a toy demo.

Theme developers must:

- render rich post/page HTML through `ContentRenderer`
- use `sanitizeHtml` only through established shared paths unless a new sanitizer contract is reviewed
- avoid raw `dangerouslySetInnerHTML`
- never inject unsanitized ad, plugin, profile, or post data
- avoid `javascript:` links and inline event handlers
- preserve auth-sensitive UI boundaries and never expose admin-only data in public layouts

All mutating backend requests in VonCMS must use authenticated sessions, CSRF validation, and centralized security gates. Themes normally should not create mutating API calls at all; if a theme needs one, treat it as backend feature work, not layout work.

## Public Data Contract

Public theme props are already shaped by the PHP response helpers before they reach React. Do not rebuild public privacy rules inside a theme.

The v1.25.3 public contract is:

- public post/page/bootstrap payloads do not expose internal `author_id`
- public comment payloads omit `dbId`, `userId`, moderation `status`, and `emailHash`
- appointed staff comment payloads may show `hasEmail`, while raw `emailHash` is primary-admin only
- public profile lookups do not expose numeric user IDs, staff roles, or joined dates
- profile owner UI must detect the current logged-in user by the authenticated session or username, not by stripped public numeric IDs
- avatar URLs are scrubbed to HTTPS-or-local paths before rendering

Themes may still render normal presentation fields such as title, slug, content, excerpt, author display name, avatar, category, dates, and public status where the shared content contract provides them. If a theme needs private user, role, email, moderation, or database identifiers, that is not theme work; it needs a backend capability review.

## Performance Philosophy

Performance is a core feature, not a cleanup pass.

Avoid:

- unnecessary hydration
- duplicate runtime fetches
- client-side overfetching
- theme-local search flows when shared discovery hooks already exist
- oversized framework dependencies
- importing inactive bundled themes into the initial public entry
- large images without responsive helpers

Use the shared public discovery path and responsive image helpers. A theme should make the current site feel faster, not hide work behind loading spinners.

For custom typography, start with [Custom Fonts](CUSTOM_FONTS.md). Keep fonts local, licensed, and scoped to the theme or bundle that owns them. Do not add runtime Google Fonts imports or broad CDN font dependencies to bundled themes.

## Visual WYSIWYG Contract

In this guide, WYSIWYG means what the visitor actually sees: spacing, hierarchy, responsive behavior, contrast, media framing, and final polish. The editor content contract is one part of that, not the whole definition.

Theme developers must:

- judge the theme by the public result on desktop, tablet, and mobile
- keep plugin output, content blocks, navigation, sidebars, and footer areas visually integrated
- avoid overlaps, unstable heights, clipped text, and awkward empty states
- render post/page body content through `ContentRenderer`
- preserve table, quote, code block, image figure, caption, credit, and video aspect styling
- keep live rendering aligned with editor preview where practical
- avoid stripping classes or attributes that the sanitizer and renderer intentionally allow
- test single-post content with images, embeds, tables, quotes, and code blocks

If the visible public result looks broken even though the code is technically mounted, the theme is not done. If a theme renders editor content differently, the theme is wrong unless the renderer contract was intentionally changed and covered by smoke tests.

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
```

Important rules:

- Registering a theme in `themeRegistry.ts` is not enough. New bundled themes must also be added to the lazy `themeLayouts` map in `PublicSite.tsx`.
- `header_top` and `footer_bottom` plugin slots are owned globally by `PublicSite.tsx`.
- Article-only plugin output belongs in theme layouts through `useAISummary` and `useRelatedPosts`.
- Public plugin state must be checked with `isSystemPluginActive(settings, pluginId)`.
- Media CDN support is delivery-only. Themes should render the media URLs they receive and should not prepend CDN domains themselves.

## Theme Layout Contract

Every public theme receives `ThemeLayoutProps` from `src/themes/types.ts`.

Required views:

- `home`
- `single-post`
- `page`
- `profile`
- `category`

If a theme ignores one of these, it is incomplete.

## Shared Theme SDK

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
| Article summaries           | `useAISummary`                             |
| Related posts               | `useRelatedPosts`                          |
| Profile articles/comments   | `useProfileActivity(targetUser, limit)`    |

Supported responsive image modes are `card`, `hero`, and `content`.

Profile views must use `useProfileActivity` for author article totals, article pagination, comment totals, and comment pagination. Do not derive profile activity from the theme's local `posts` or `comments` props, because those props can be capped for public discovery and may not contain the user's complete contribution history.

## Crawlable Theme Links

Public links to posts, pages, profiles, categories, feeds, or any crawlable public URL should be real anchors, not button-only `onClick` handlers.

For post cards, sidebar items, timeline entries, and related-post surfaces:

- build the URL with `getPermalink(post, settings)`
- render an `<a href="...">`
- use `handleCrawlableLinkClick` to keep normal SPA navigation for plain left-clicks
- let browser-native behavior work for copy link, open in new tab, middle click, and modifier-click

Use a `<button>` only for UI actions that are not public navigation, such as filters, modals, dropdowns, load-more actions, editor commands, and admin controls.

## Minimal Theme Skeleton

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

## Registering a Theme

1. Create `src/themes/my-theme/Layout.tsx`.
2. Add `src/themes/my-theme/theme.json` with the same stable theme id.
3. Add a `ThemeDefinition` in `src/plugins/von-core/features/themes/themeRegistry.ts` and import its manifest.
4. Add the layout id to `themeLayouts` in `PublicSite.tsx`.
5. Add a theme settings modal only if the theme needs one.
6. Add smoke coverage when the theme introduces a new contract.

The theme id in the registry must match the id in `PublicSite.tsx`.

### Homepage Hero Performance Metadata

Themes whose homepage hero renders the first post image should set
`homepageHero: 'first-post-image'` in their `theme.json` performance metadata:

```json
{
  "id": "theme-my-theme",
  "performance": {
    "homepageHero": "first-post-image"
  }
}
```

The build copies each `theme.json` into the matching Deploy theme folder. PHP SSR reads only the active
theme manifest, while React imports the same file into its theme definition. Omit `homepageHero` for
themes without that exact hero contract; preloading a normal card image can waste bandwidth and compete
with the real LCP resource.

## SEO and Robots Ownership

Do not create theme-specific robots or site-level default meta-description state.

Current ownership:

- site meta description default: `settings.siteDescription`
- admin edit location: General Settings
- VonSEO runtime fallback: `src/plugins/von-core/features/seo/VonSEO.tsx`
- robots default and delivery: `public/robots.php`
- robots UI fetch: `VonSEOSettings.tsx` calls `robots.php?default=json`
- direct PHP SSR in `public/index.php` owns crawler-facing canonical, Open Graph, JSON-LD, and initial hydration for known post/page routes
- public SSR must only hydrate published content whose schedule has passed

`robots.txt` must not emit `Crawl-delay: 1` as a default.

## Theme Verification

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
- image, video, table, quote, and code block content survives public rendering

## Common Theme Mistakes

- Adding a theme to `themeRegistry.ts` but not to `PublicSite.tsx`.
- Checking `activePlugins.includes(id)` directly instead of `isSystemPluginActive`.
- Rendering `VonSEO` while the VonSEO plugin is disabled.
- Duplicating `ContentRenderer`, comments, sidebar, newsletter, or ad behavior.
- Building a theme-local search system instead of using shared discovery.
- Rendering post navigation as button-only `onClick` handlers instead of crawlable anchors.
- Counting profile articles/comments from capped local `posts` or `comments` props instead of `useProfileActivity`.
- Reading `author_id`, `userId`, `dbId`, `emailHash`, profile role, or joined date from public payloads.
- Adding a CDN prefix in the theme instead of trusting the media URL returned by the backend.
- Updating only one bundled theme when the contract applies to all six.
