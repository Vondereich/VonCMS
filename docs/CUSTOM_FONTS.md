# Custom Fonts

VonCMS v1.25.8 ships with local Inter variable WOFF2 files so fresh installs do not depend on Google Fonts at runtime.

Use this guide when you fork VonCMS, build a custom theme, or package a client-specific font.

## Default Font Bundle

The default bundle lives in:

```text
public/fonts/inter/
```

It contains:

- `inter-latin-wght-normal.woff2`
- `inter-latin-ext-wght-normal.woff2`
- `inter.css`
- `LICENSE.txt`

The CSS is loaded by the public entry HTML and PHP runtime entry. The font covers normal-style variable weights through one latin file and one latin-ext file, so the browser can use `400`, `500`, `600`, `700`, `800`, or `900` without downloading separate files for each weight.

## Why Local WOFF2

Local WOFF2 is preferred for bundled themes because:

- the site does not need `fonts.googleapis.com` or `fonts.gstatic.com`
- the Deploy ZIP contains the typography needed by a fresh install
- the browser and CDN can cache the font from the same domain as the site
- privacy and offline/local development behavior are more predictable

Do not inline large base64 font files into app CSS for normal VonCMS themes. Inline fonts can hide network requests, but they make CSS larger and prevent the font from being cached separately.

## Add A Theme Font

For a custom theme, keep the font beside the theme or under a clearly named public font folder:

```text
public/fonts/my-theme/
src/themes/my-theme/
```

Add a CSS file such as:

```css
@font-face {
  font-family: 'My Theme Display';
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url('/fonts/my-theme/my-theme-display.woff2') format('woff2');
}

.my-theme-root {
  --my-theme-display: 'My Theme Display', Georgia, 'Times New Roman', serif;
}
```

Then use the font inside the owning theme:

```tsx
<main className="my-theme-root">
  <h1 className="font-[var(--my-theme-display)]">{post.title}</h1>
</main>
```

Keep the default Inter bundle available unless the whole install intentionally changes the global font contract.

## Variable vs Static Fonts

Prefer a variable WOFF2 file when the font supports it. One variable file can cover a range such as `300 900`, which avoids shipping separate `400`, `500`, `600`, `700`, and `900` files.

Use static WOFF2 files only when:

- the font has no variable build
- the theme uses one or two fixed weights
- visual testing shows the variable build changes the design in a bad way

Avoid TTF/OTF for web delivery unless there is no WOFF2 source available.

## Licensing Rules

Every bundled or theme-shipped font must include a license notice.

For open-source fonts:

- keep the license text or a clear license notice beside the font files
- mention the upstream package or source
- do not rename the font in a way that violates its license

For commercial or client fonts:

- confirm the license allows web embedding
- do not commit private fonts to a public repository unless the license allows redistribution
- keep client-only fonts out of public release ZIPs if redistribution is not allowed

## Testing Checklist

After changing fonts:

1. Run `npm run build`.
2. Open the site and check DevTools Network with the `Font` filter.
3. Confirm there are no `fonts.googleapis.com` or `fonts.gstatic.com` requests.
4. Confirm WOFF2 files load from your own domain.
5. Check mobile Lighthouse for layout shift and render delay.
6. Run `npm run test:integration` before release packaging.

If the browser downloads more font files than expected, check how many `@font-face` blocks are declared and which weights the theme actually uses.
