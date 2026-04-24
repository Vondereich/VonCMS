# VonCMS Theme Masterclass v1.23.5

This guide is the practical contract for building or refactoring public themes in the current VonCMS codebase.

It is not a design essay. It documents how themes are actually mounted, what props they receive, which shared building blocks already exist, and what must be verified before a theme is considered release-ready.

## 1. Runtime map

A VonCMS public theme does not run in isolation. The runtime flow is:

```text
App.tsx
  -> resolves route into currentView + selectedPost/selectedPage/selectedProfile/selectedCategory
  -> renders PublicSite

PublicSite.tsx
  -> reads activeTheme from ThemeContext
  -> chooses the matching Layout component
  -> injects global header/footer plugin slots
  -> mounts GlobalLightbox and CookieBanner

src/themes/[theme]/Layout.tsx
  -> renders the actual public UI for home, single-post, page, profile, and category views
```

Important consequence:

- Registering a theme in `themeRegistry.ts` is necessary, but not sufficient.
- `PublicSite.tsx` currently imports each bundled layout explicitly and switches on `activeTheme.id`.
- If you add a new bundled theme, you must wire both the registry and the `PublicSite.tsx` layout selector.

## 2. Files that matter

Core files for theme work:

- `src/themes/types.ts`
- `src/themes/shared/index.ts`
- `src/plugins/von-core/features/public/PublicSite.tsx`
- `src/plugins/von-core/features/themes/themeRegistry.ts`
- `src/plugins/von-core/features/themes/ThemeContext.tsx`
- `src/utils/siteUtils.ts`
- `src/themes/[theme]/Layout.tsx`

Bundled theme examples worth studying:

- `src/themes/default/Layout.tsx`
- `src/themes/techpress/Layout.tsx`
- `src/themes/digest/Layout.tsx`
- `src/themes/prism/Layout.tsx`
- `src/themes/portfolio/Layout.tsx`
- `src/themes/corporate-pro/Layout.tsx`

## 3. The layout contract

The standard public theme entrypoint is `ThemeLayoutProps` from `src/themes/types.ts`.

Your layout receives:

- content collections: `posts`, `pages`, `comments`, `allUsers`
- current user and full `settings`
- theme state: `isDarkMode`, `toggleDarkMode`
- navigation state: `currentView`, `selectedPost`, `selectedPage`, `selectedProfile`, `selectedCategory`
- navigation actions: `onPostClick`, `onPageClick`, `onViewProfile`, `onBackToHome`, `onCategoryClick`
- comment/user actions: `onAddComment`, `onLikeComment`, `onReplyComment`, `onUpdateUser`

Current valid public views are:

- `home`
- `single-post`
- `page`
- `profile`
- `category`

If your theme ignores one of these states, it is incomplete.

## 4. The real mounting rule

`PublicSite.tsx` already provides some global behavior for all themes:

- `PluginSlot location="header_top"`
- `PluginSlot location="footer_bottom"`
- `GlobalLightbox`
- `CookieBanner`
- fallback document title sync when `VonSEO` is disabled
- monolithic tracking request on route change

Theme authors should not duplicate those global mounts inside the layout.

## 5. Theme SDK: use the shared path first

VonCMS already exposes a shared theme SDK in `src/themes/shared/index.ts`.

Use that barrel before inventing local duplicates.

Shared exports you should prefer:

- `VonSEO`
- `ContentRenderer`
- `VpComments`
- `VpSidebarWidget`
- `VonNewsletter`
- `ShareButtons`
- `LoadMoreButton`
- `VonLogo`
- `AdBlock`
- `VonPopupAd`
- `decodeEntities`
- `sanitizeHtml`
- `formatDate`
- `getResponsiveImageAttributes`
- `usePublicProfile`
- `useAdsPopup`
- `useClickOutside`
- `useLoadMore`
- `useSinglePost`
- `useServerSearch`
- `useAISummary`
- `useRelatedPosts`
- `UserProfile`
- `ProseDarkModeStyles`

Rule: if the SDK already exports a solution, use it unless there is a concrete reason not to.

## 6. Non-negotiable rendering standards

### 6.1 Decode user-facing text

Titles and excerpts regularly contain encoded entities.

Use `decodeEntities(...)` for dynamic text such as:

- post titles
- excerpts
- ticker headlines
- headings rendered from stored content metadata

If you skip this, the UI will leak strings like `&amp;`.

### 6.2 Render rich content through the shared renderer

For page and post content:

- sanitize HTML with `sanitizeHtml(...)` when needed
- render the result with `ContentRenderer`

Do not hand-roll ad hoc `dangerouslySetInnerHTML` blocks for normal page/post body content.

### 6.3 Keep SEO centralized

Use `VonSEO` in every major public view branch that needs metadata context.

Typical cases:

- home
- single post
- page
- profile
- category

Do not create theme-specific `<meta>` hacks when `VonSEO` already knows the route context.

### 6.4 Use the responsive image helper for content images

Responsive image delivery is now part of the theme standard.

Use `getResponsiveImageAttributes(item, mode)` for content cards and hero images.

Available modes today:

- `card`
- `hero`
- `content`

Example:

```tsx
<img
  {...getResponsiveImageAttributes(post, 'card')}
  alt={decodeEntities(post.title)}
  className="w-full h-full object-cover"
/>
```

Important limits:

- Use this helper for post and content images.
- Do not use it for favicon, logo, avatar, or other system assets.
- The helper safely falls back to a normal `src` when `imageSrcSet` is absent.
- Old media stays compatible, but may need `Rebuild Responsive Variants` to gain full benefit.

### 6.5 Keep ads on the shared path

Use:

- `AdBlock` for normal ad slots
- `VonPopupAd` for popup ads
- `useAdsPopup` for popup timing/state

Do not inline raw ad HTML without the shared sanitization path.

### 6.6 Use the shared comments and sidebar components

For public comment threads, use `VpComments`.

For sidebar widgets, use `VpSidebarWidget`.

That keeps widget behavior, ad widget rendering, and content sanitization consistent across themes.

## 7. Recommended theme skeleton

A new public theme should start with a single readable `Layout.tsx` and split later only when the layout actually becomes large.

Minimal blueprint:

```tsx
import React from 'react';
import { ThemeLayoutProps } from '../types';
import {
  VonSEO,
  ContentRenderer,
  VpComments,
  decodeEntities,
  sanitizeHtml,
  getResponsiveImageAttributes,
  usePublicProfile,
} from '../shared';

const MyThemeLayout: React.FC<ThemeLayoutProps> = ({
  posts,
  comments,
  settings,
  currentView,
  selectedPost,
  selectedPage,
  selectedProfile,
  selectedCategory,
  allUsers,
  onPostClick,
  onViewProfile,
  onBackToHome,
  onAddComment,
  onLikeComment,
  onReplyComment,
}) => {
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);

  if (currentView === 'single-post' && selectedPost) {
    return (
      <>
        <VonSEO settings={settings} currentView={currentView} selectedPost={selectedPost} />
        <article>
          <h1>{decodeEntities(selectedPost.title)}</h1>
          {selectedPost.image && (
            <img
              {...getResponsiveImageAttributes(selectedPost, 'hero')}
              alt={decodeEntities(selectedPost.title)}
            />
          )}
          <ContentRenderer html={sanitizeHtml(selectedPost.content)} />
          <VpComments
            comments={comments.filter((c) => String(c.postId) === String(selectedPost.id))}
            onAddComment={(content) => onAddComment(selectedPost.id, content)}
            onLikeComment={onLikeComment}
            onReplyComment={onReplyComment}
          />
        </article>
      </>
    );
  }

  if (currentView === 'page' && selectedPage) {
    return (
      <>
        <VonSEO settings={settings} currentView={currentView} selectedPage={selectedPage} />
        <ContentRenderer html={sanitizeHtml(selectedPage.content)} />
      </>
    );
  }

  if (currentView === 'profile' && targetProfile) {
    return <div>{targetProfile.username}</div>;
  }

  const visiblePosts = selectedCategory
    ? posts.filter((post) => post.category === selectedCategory)
    : posts;

  return (
    <>
      <VonSEO settings={settings} currentView={currentView} selectedCategory={selectedCategory} />
      <section>
        {visiblePosts.map((post) => (
          <article key={post.id} onClick={() => onPostClick(post.id)}>
            {post.image && (
              <img
                {...getResponsiveImageAttributes(post, 'card')}
                alt={decodeEntities(post.title)}
              />
            )}
            <h2>{decodeEntities(post.title)}</h2>
          </article>
        ))}
      </section>
    </>
  );
};

export default MyThemeLayout;
```

This is not meant to be pretty. It is meant to show the route contract and the shared-path decisions that keep a theme compatible.

## 8. Registration checklist for a new bundled theme

To add a bundled theme, do all of the following:

1. Create `src/themes/your-theme/Layout.tsx`.
2. Register the theme definition in `src/plugins/von-core/features/themes/themeRegistry.ts`.
3. Import the layout into `src/plugins/von-core/features/public/PublicSite.tsx`.
4. Extend the `activeTheme.id` switch in `PublicSite.tsx` so the layout can actually render.
5. If the theme has theme-specific settings, keep the settings namespace stable.

Missing step 3 or 4 means the theme is registered but never mounted.

## 9. Theme-specific settings

Bundled themes commonly read theme-specific settings from `settings.theme`.

Examples in the codebase include namespaced config such as `settings.theme.techpress`.

Guidelines:

- Keep the namespace stable once shipped.
- Merge defaults locally in a helper instead of assuming settings are always complete.
- Do not break older saved settings by renaming keys casually.

## 10. Responsive image standard

Current responsive image behavior is width-based and content-focused.

The contract exposed to themes is simple:

- `image` remains the main image URL.
- `imageSrcSet` may be present for responsive candidates.
- `getResponsiveImageAttributes(...)` chooses `src`, `srcSet`, and `sizes` safely.

What this means for theme authors:

- Cards should usually use `card` mode.
- Main featured images should usually use `hero` mode.
- Inline content-specific image usage can use `content` mode where appropriate.
- If an item has no `imageSrcSet`, the theme still works normally.

This is intentionally backward-compatible.

## 11. Theme behavior standards by view

### Home

A production-ready home view should handle:

- empty content
- long and short titles
- mixed categories
- posts without images
- ad slots without breaking grid alignment

### Single post

A production-ready single post view should handle:

- missing featured image
- embedded video in content
- related posts
- comments
- author/profile navigation
- share buttons
- AI summary if the theme uses it

### Page

A production-ready page view should handle:

- clean title rendering
- sanitized rich content
- no dependency on post-only metadata

### Profile

A production-ready profile view should use `usePublicProfile` or a compatible derived profile object instead of guessing from string state alone.

### Category

A production-ready category view should:

- filter predictably
- show empty state when there are no posts
- avoid layout drift between filtered and unfiltered views

## 12. Common mistakes that cause regressions

Avoid these mistakes:

- registering a theme in `themeRegistry.ts` but forgetting `PublicSite.tsx`
- rendering dynamic titles without `decodeEntities`
- bypassing `ContentRenderer` for page/post body content
- hand-rolling SEO tags instead of using `VonSEO`
- manually inserting global header/footer plugin slots inside the theme
- using responsive image helpers for logos, favicons, or avatars
- assuming `selectedPost`, `selectedPage`, or `selectedProfile` is always present
- only testing `home` and ignoring `single-post`, `page`, `profile`, and `category`
- building around lorem ipsum and never testing real ugly content

## 13. Practical audit checklist

Before calling a theme update done, verify all of the following.

### Layout integrity

- homepage works with zero posts, one post, and many posts
- titles do not break rows when they are unusually long
- cards stay aligned with and without images
- navigation does not overflow on mobile
- sidebars do not collapse the main grid unexpectedly

### Content integrity

- encoded titles render correctly
- page content renders through `ContentRenderer`
- post content remains readable in both light and dark mode
- posts without images do not leave broken gaps
- comments still work

### Responsive media integrity

- card images use `getResponsiveImageAttributes(..., 'card')`
- hero images use `getResponsiveImageAttributes(..., 'hero')`
- avatars and logos do not use the content-image helper
- old content without `imageSrcSet` still renders without errors

### SEO and plugin integrity

- `VonSEO` is present in the major route branches
- header/footer plugin slots are not duplicated in the layout
- popup ads still work through `VonPopupAd`
- sidebar widgets still render through `VpSidebarWidget`

## 14. Release checklist

Before shipping a theme change:

1. run `npx prettier --write --ignore-unknown` on touched docs/files
2. run `npm run typecheck`
3. run `npm run build` if the theme code changed
4. test home, single-post, page, profile, and category views
5. test both light and dark mode
6. verify one realistic article with real content and a featured image
7. only then update `CHANGELOG.md`

## 15. Final rule

A good VonCMS theme is not defined by the homepage screenshot.

It is defined by whether it survives the full public routing contract, reuses the shared platform correctly, respects responsive image behavior, and keeps working with real content instead of ideal demo content.
