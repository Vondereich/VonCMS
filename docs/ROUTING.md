# VonCMS Routing Flow v1.25.x

This document explains VonCMS routing in plain English.

Its purpose is simple:

- quickly understand what happens when a user opens a normal URL
- quickly understand what happens when the frontend calls an API
- clearly separate the router, the guard layer, and the helper layer

## Big Picture

```text
USER OPENS A URL
    |
    v
.htaccess
    |
    +--> if the request is for api/... -------------------------+
    |                                                          |
    |                                                          v
    |                                                  public/api/*.php
    |                                                          |
    |                                                          v
    |                                                   security.php
    |                                                          |
    |                                                          v
    |                                                     JSON response
    |
    +--> if the request is for a normal page
           |
           v
        index.php
           |
           +--> checks install / maintenance / canonical URL
           +--> decides whether the path is a post, page, SPA route, or 404
           +--> injects initial settings / initial state
           |
           v
        React App
           |
           v
      BrowserRouter
           |
           v
      Public page / Admin / Login / Install
```

## Who Does What

### 1. `.htaccess`

This is the first layer.

It decides:

- whether the request is for a real file
- whether the request is an API call or a normal page request
- when to fall back to `index.php`

In simple terms:
`.htaccess` is the first traffic director.

For subfolder installs, crawler standards only recognize the host-root `/robots.txt`. An install
at `/blog` can serve its sitemap and llms.txt under `/blog`, but the parent server must expose the
VonCMS crawl policy at `/robots.txt` or maintain a root policy that references
`/blog/sitemap.xml`.

## 2. `public/index.php`

This is the backend router for page requests.

It handles things like:

- catching `robots.txt`, `sitemap.xml`, and `rss`
- calculating the base path
- checking install mode
- checking maintenance mode
- redirecting non-canonical URLs
- deciding whether a slug is a post, a page, or a 404
- injecting initial data into the frontend

In simple terms:
`index.php` is the main brain for normal page requests.

## 3. React Router in `src/App.tsx`

Once the HTML is loaded and the app is running, React takes over routing in the browser.

Examples of routes it handles:

- `/`
- `/:slug`
- `/:category/:slug`
- `/profile/:username`
- `/login`
- `/install`
- `/admin/*`

In simple terms:
React Router handles the SPA experience after the first page load.

## 4. `public/api/*.php`

These are the real API endpoints for most modern flows.

Examples:

- `api/get_posts.php`
- `api/save_post.php`
- `api/get_settings.php`
- `api/save_settings.php`

In simple terms:
when the frontend needs data or needs to save something, it usually calls these files directly.

## 5. `security.php`

This is not a router.

This is the guard layer.

It usually handles:

- API headers
- sessions
- CSRF
- rate limiting
- other security checks

In simple terms:
`security.php` is the bodyguard, not the traffic director.

## 6. `vonFetch`

This is also not a router.

`vonFetch` is only a frontend helper for calling APIs.

It usually:

- cleans the URL
- ensures `credentials: include`
- adds the CSRF token for requests that need it

In simple terms:
`vonFetch` is the courier that sends requests from the frontend.

## Flow 1: When a user opens `/some-slug`

```text
Browser
  -> .htaccess
  -> index.php
  -> checks slug
     -> if post/page exists: prepares SEO + initial state
     -> if not found: marks as 404
  -> React App hydrates
  -> BrowserRouter renders the final page
```

What this means in practice:

1. The user opens a URL.
2. `.htaccess` sees that it is not an API request, so it sends it to `index.php`.
3. `index.php` tries to understand what kind of content that URL points to.
4. If a post or page exists, PHP prepares the metadata and initial state.
5. React takes over and renders the final UI.

## Flow 2: When the frontend calls an API

Example: the admin panel wants to load the posts list.

```text
React component
  -> vonFetch(API.getPosts)
  -> /api/get_posts.php
  -> security.php
  -> endpoint logic / query
  -> JSON back to frontend
```

What this means:

1. A React component calls `vonFetch`.
2. `vonFetch` sends the request to the real endpoint.
3. The PHP endpoint loads `security.php`.
4. The endpoint runs its own logic.
5. JSON is returned to the frontend.

## Modern Routes vs Legacy Bridges

In current VonCMS, most modern routes use direct files under `public/api/`.

Modern examples:

- `api/get_settings.php`
- `api/save_settings.php`
- `api/get_posts.php`

There are also a few special bridge files:

- `public/api.php`
- `public/von_system.php`

These are not the main path for everything.
They are more like compatibility or action-based entry points for a smaller set of flows.

## Shortest Summary

If you want to remember it in one line:

```text
Page route: .htaccess -> index.php -> React Router
API route: frontend -> vonFetch -> api/*.php -> security.php
```

## Which Files To Check

If the issue looks like page routing:

- check `.htaccess`
- check `public/index.php`
- check `src/App.tsx`

If the issue looks like an API request:

- check `src/config/site.config.ts`
- check `src/utils/api.ts`
- check the endpoint file in `public/api/`
- check `public/security.php`

If the issue looks like a compatibility flow:

- check `public/api.php`
- check `public/von_system.php`
