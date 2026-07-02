# VonCMS Plugin Development Guide v1.25.3

This guide is the plugin-specific source of truth for VonCMS v1.25.3. It is written for developers using VS Code, Cursor, Antigravity, Codex, CLI agents, or any AI-assisted IDE to create plugins without weakening the runtime, visual output, or security baseline.

For theme work, use [Theme Development](THEME_DEVELOPMENT.md).

## Architecture Philosophy

VonCMS is intentionally designed as:

- hybrid decoupled
- shared-hosting first
- PHP runtime friendly
- React-powered for admin and public UX
- publishing-first CMS
- core production deploy does not require Node.js

The architecture prioritizes:

- maintainability
- deployment simplicity
- long-term compatibility
- SEO stability
- low hosting barrier
- predictable release packaging

Plugins should extend publishing workflows without turning VonCMS into a plugin-chaos platform.

## Why No Headless-Only Mode

VonCMS core intentionally avoids requiring Node.js in production runtime.

Reason:

- simpler deployment
- shared hosting compatibility
- lower infrastructure cost
- easier handoff for publishers and agencies
- reduced operational complexity
- stable SEO and crawler output from the PHP runtime

Bundled plugins and release ZIPs must not assume a persistent Node process, serverless function layer, queue worker, or headless-only frontend. Open-source users can extend VonCMS with other technologies, but plugin code shipped with the core project must still fit the PHP API and security model.

## Golden Rules

- Never bypass shared sanitization.
- Never hardcode plugin activation checks.
- Never invent a second plugin status store.
- Never ship plugin output that is mounted but visually broken.
- Never mutate editor content behind the user's back.
- Never duplicate public runtime ownership from `PublicSite.tsx`.
- Prefer shared SDK utilities and hooks before custom implementations.
- Treat custom HTML plugins as untrusted user content.
- Add smoke coverage for every new runtime contract.

## Security Principles

Security is top tier in VonCMS because plugins run inside real production sites.

All mutating requests must:

- require authenticated sessions
- pass CSRF validation
- use centralized security gates
- validate role/capability before work
- validate input on the PHP side
- return structured JSON errors

Plugin developers must also:

- sanitize public HTML
- strip inline events and `javascript:` links
- avoid leaking admin-only settings to public routes
- avoid broad file writes or filesystem scans
- avoid direct SQL string interpolation
- keep secrets in private settings, never public plugin config

If a plugin touches PHP, treat it as a security-sensitive feature, not UI polish.

## RBAC and Private Data Boundaries

VonCMS v1.25.3 separates normal appointed Admin access from primary-admin ownership. Plugins must respect that split.

Current rules:

- Root or Admin ID 1 is the primary admin boundary for raw SMTP/API secrets, Database Manager, database backup/import, settings audit/rollback, OTA updater, IndexNow owner actions, system repair, WordPress Bridge scan/import, media maintenance, and destructive media deletion.
- Appointed Admin can keep normal newsroom operations such as User Manager access, but server-side guards protect Admin ID 1 and Root accounts from non-primary modification or deletion.
- Moderator and Writer are staff roles, not secret/system owners.
- Public callers must never receive staff roles, emails, numeric public-profile IDs, joined dates, comment email hashes, or internal comment database/moderation fields.

For comments, appointed Admin/Moderator/Writer payloads may expose only `hasEmail`; raw `emailHash` is primary-admin only. Do not reintroduce Gravatar hashes or database IDs through plugin-specific endpoints.

## Public Response Contract

Use the centralized PHP response helpers instead of hand-shaping public payloads in plugin endpoints.

Plugin endpoints that expose public content should follow the same v1.25.3 rules as core:

- post/page/bootstrap payloads: no public `author_id`
- public comments: no `dbId`, `userId`, `status`, or `emailHash`
- public profiles: no numeric user ID, staff role, email, or joined date
- avatar URLs: HTTPS-or-local only, with frontend fallback on image failure
- draft/scheduled content: not visible to guest/public SSR or public APIs until published and due

If a plugin needs privileged data, gate it through the narrowest role/capability and document why public output cannot use the safe shaped payload.

## Performance Philosophy

Performance is a core feature.

Avoid:

- duplicate runtime fetches
- client-side overfetching
- polling without a bounded reason
- importing heavy dependencies into the main entry
- loading plugin UI when the plugin is inactive
- doing expensive work for every page view when a post-only hook would do

Plugins should be lazy, gated, and scoped to the view where they matter.

## Visual WYSIWYG Contract

In this guide, WYSIWYG means what the visitor actually sees: a plugin should feel complete in the final page, not merely render a working component. Spacing, contrast, loading states, responsive behavior, empty states, and theme fit are part of the contract.

Plugins must:

- look integrated in every supported theme surface they use
- avoid overlapping content, unstable layout shifts, clipped labels, and awkward default states
- keep admin controls and public output understandable without hidden setup knowledge
- not rewrite post/page content unless the user explicitly triggers that action
- not strip editor-supported image, video, table, quote, or code markup
- not inject unsanitized HTML into `ContentRenderer`
- use `post_after` or article hooks for article add-ons instead of mutating the article body
- preserve SEO fields and manual excerpts unless the feature explicitly owns them

AI-assisted plugins must be especially careful: suggestions are allowed, silent content mutation is not. Security stays top tier because the plugin will run inside a real CMS project.

## Source of Truth

When docs and code disagree, use this order:

1. Runtime code in `src/`, `public/`, and `server/test-integration.cjs`.
2. `CHANGELOG.md`.
3. Product docs in `docs/`.

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
ExtensionsManager.tsx
  -> reads AVAILABLE_PLUGINS
  -> persists activePlugins and pluginConfig.pluginStatus
  -> opens per-plugin settings modals

PluginSlot
  -> filters system plugins through isSystemPluginActive
  -> filters custom HTML plugins by enabled + location
  -> sanitizes custom HTML before injection

PublicSite.tsx
  -> mounts global header_top and footer_bottom slots
  -> gates VonAnalytics native tracking and CookieBanner

Theme Layouts
  -> render article-only plugins through useAISummary and useRelatedPosts
```

## System Plugin Shape

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

## Creating a System Plugin

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

## Activation and Settings Ownership

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

## Settings Modals

Built-in plugin settings usually live beside the plugin:

```text
src/plugins/von-core/features/plugins/built-in/[plugin]/SettingsModal.tsx
```

Then wire the modal from `ExtensionsManager.tsx`.

Do not mirror one plugin's settings in multiple admin areas unless there is a current runtime owner for that split. The v1.25.3 baseline keeps per-extension config in Extensions, while site identity stays in General Settings.

Secret-bearing configuration does not belong in public plugin config. Store it in a protected settings group or dedicated backend path, let `get_settings.php` mask it for non-primary admins, and make save paths ignore protected secret keys from non-primary admins.

Media CDN settings are delivery hints, not an upload/offload integration. Plugins should consume the media URL returned by upload/list APIs and should not add their own CDN prefix unless they own a future CDN/offload integration.

## Crawlable Plugin Links

Plugins that render public navigation to posts, pages, profiles, categories, feeds, or other public routes should output real anchors, not button-only click handlers.

For article widgets, related-post blocks, sidebar widgets, and campaign content that points to a public route:

- use the same permalink helper contract as themes, such as `getPermalink(post, settings)` for posts
- render an `<a href="...">`
- use `handleCrawlableLinkClick` when the plugin needs SPA-style in-app navigation on plain left-clicks
- preserve browser-native behavior for copy link, open in new tab, middle click, and modifier-click

Use buttons for plugin actions, dismissals, toggles, modals, and admin controls. Do not use `javascript:` URLs or inline event attributes.

## Rendering Locations

| Location        | Owner                                       |
| --------------- | ------------------------------------------- |
| `header_top`    | `PublicSite.tsx` global slot                |
| `footer_bottom` | `PublicSite.tsx` global slot                |
| `sidebar_top`   | Theme or sidebar code when explicitly wired |
| `post_after`    | Theme-level article plugin hooks            |

Article plugins should normally use `src/hooks/usePlugins.tsx`. That keeps every bundled theme consistent and avoids hidden global post state.

## Custom HTML Plugins

Custom HTML/CSS plugins are user-supplied content, not trusted system code.

Runtime rules:

- `PluginSlot` filters custom plugins by `enabled` and `location`
- HTML is sanitized with `sanitizeHtml`
- inline event attributes are stripped
- `javascript:` hrefs are stripped
- custom CSS is scoped by wrapper expectations, not trusted

Do not bypass the sanitizer for imported plugin HTML.

## Built-In Plugin Baselines

| Plugin        | Runtime owner                   | Notes                                                                                                                             |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| VonSEO        | Theme layouts plus `VonSEO.tsx` | Reads site-level default description from General Settings and uses route-specific overrides for posts/pages/profiles/categories. |
| VonAnalytics  | Providers plus `PublicSite.tsx` | GA injection, native tracking, and cookie banner are gated by `vp_analytics`.                                                     |
| Promo Bar     | `header_top` slot               | Supports text, link, color, campaign windows, dismiss hours, and target behavior.                                                 |
| Gift Widget   | `footer_bottom` slot            | Supports target URL, tooltip, label, color, position, and target behavior.                                                        |
| AI Summary    | article hook                    | Uses post content and active plugin state.                                                                                        |
| Related Posts | article hook                    | Uses current post, all posts, theme colors, and active plugin state.                                                              |

## SEO and Robots Ownership

Plugins must not create a second site-level default meta description or robots default.

Current ownership:

- site meta description default: `settings.siteDescription`
- admin edit location: General Settings
- VonSEO runtime fallback: `src/plugins/von-core/features/seo/VonSEO.tsx`
- robots default and delivery: `public/robots.php`
- robots UI fetch: `VonSEOSettings.tsx` calls `robots.php?default=json`

`robots.txt` must not emit `Crawl-delay: 1` as a default.

## Smoke Coverage

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

## Release Checklist

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

## Common Plugin Mistakes

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
