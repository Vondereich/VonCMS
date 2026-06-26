import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import { BASE_PATH } from '../config/site.config';

// Safe CSS properties that are needed for editor alignment and layout
const ALLOWED_STYLE_PROPS = new Set([
  'text-align',
  'display',
  'margin-left',
  'margin-right',
  'margin',
  'max-width',
  'width',
  'height',
  'aspect-ratio',
  'float',
  'border-left', // blockquote styling
  'border-radius',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'font-style', // italic for blockquotes
  'min-width',
  'overflow',
  // Typography and Colors
  'color',
  'background-color',
  'font-size',
  'font-family',
  'font-weight',
  'line-height',
  'letter-spacing',
]);

const EDITOR_ALLOWED_PASTE_STYLE_PROPS = new Set([
  'text-align',
  'font-weight',
  'font-style',
  'line-height',
]);

const EDITOR_DROP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'form',
  'button',
  'input',
  'select',
  'option',
  'textarea',
]);

const EDITOR_REMOVE_CHROME_TAGS = new Set(['header', 'footer', 'nav', 'aside']);
const EDITOR_UNWRAP_TAGS = new Set(['article', 'section', 'main']);
const EDITOR_ALLOWED_IFRAME_HOSTS = [
  /youtube\.com\/embed\//i,
  /youtube-nocookie\.com\/embed\//i,
  /facebook\.com\/plugins\/video\.php/i,
  /tiktok\.com\/player\/v1\//i,
  /instagram\.com\/reel\/[^/]+\/embed/i,
];
const EDITOR_ALLOWED_PASTE_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'iframe',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];
const EDITOR_ALLOWED_PASTE_ATTRS = [
  'allow',
  'allowfullscreen',
  'alt',
  'colspan',
  'data-id',
  'frameborder',
  'height',
  'href',
  'loading',
  'rel',
  'rowspan',
  'scrolling',
  'src',
  'style',
  'target',
  'title',
  'width',
];

const unwrapElement = (element: Element) => {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
};

const isAllowedIframeSrc = (src: string): boolean => {
  if (!src) return false;
  return EDITOR_ALLOWED_IFRAME_HOSTS.some((pattern) => pattern.test(src));
};

const shouldConvertDivToParagraph = (element: HTMLElement): boolean => {
  if (element.tagName.toLowerCase() !== 'div') return false;
  if (
    element.querySelector(
      'div, p, img, iframe, table, pre, blockquote, ul, ol, h1, h2, h3, h4, h5, h6, hr'
    )
  ) {
    return false;
  }
  const text = element.textContent?.replace(/\u00A0/g, ' ').trim() || '';
  return text.length > 0;
};
const EDITOR_CHROME_TEXT_PATTERNS = [
  /\badvertisement\b/i,
  /\bsponsored\b/i,
  /\bpromoted\b/i,
  /related posts?/i,
  /recommended/i,
  /you may also like/i,
  /share this/i,
  /follow us/i,
  /newsletter/i,
  /subscribe/i,
  /cookie policy/i,
  /privacy policy/i,
  /terms of use/i,
];

const getElementTextMetrics = (element: HTMLElement) => {
  const text =
    element.textContent
      ?.replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '';
  const anchors = Array.from(element.querySelectorAll('a'));
  const anchorCount = anchors.length;
  const anchorTextLength = anchors.reduce((sum, anchor) => {
    const anchorText =
      anchor.textContent
        ?.replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || '';
    return sum + anchorText.length;
  }, 0);

  return {
    text,
    textLength: text.length,
    anchorCount,
    anchorTextLength,
    linkDensity: text.length > 0 ? anchorTextLength / text.length : 0,
  };
};

const looksLikeNonContentBlock = (element: HTMLElement): boolean => {
  const tag = element.tagName.toLowerCase();
  if (!['div', 'p', 'ul', 'ol', 'table'].includes(tag)) return false;
  if (element.closest('blockquote, pre, code')) return false;

  const { text, textLength, anchorCount, linkDensity } = getElementTextMetrics(element);

  if (!textLength && !element.querySelector('img, iframe, table')) {
    return true;
  }

  if (
    textLength > 0 &&
    textLength <= 220 &&
    EDITOR_CHROME_TEXT_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return true;
  }

  if (anchorCount >= 4 && textLength <= 260) {
    return true;
  }

  if (anchorCount >= 3 && linkDensity >= 0.65) {
    return true;
  }

  if ((tag === 'ul' || tag === 'ol') && anchorCount >= 3 && linkDensity >= 0.55) {
    return true;
  }

  if (tag === 'table' && anchorCount >= 3 && textLength <= 320) {
    return true;
  }

  return false;
};

const normalizeEditorMarkup = (content: string, mode: 'paste' | 'save' = 'save'): string => {
  if (!content) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
    }
  });

  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (EDITOR_DROP_TAGS.has(tag) || EDITOR_REMOVE_CHROME_TAGS.has(tag)) {
      element.remove();
      return;
    }

    if (EDITOR_UNWRAP_TAGS.has(tag)) {
      unwrapElement(element);
    }
  });

  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    let element = node as HTMLElement;
    let tag = element.tagName.toLowerCase();

    if (tag === 'iframe') {
      const src = element.getAttribute('src') || '';
      if (!isAllowedIframeSrc(src)) {
        element.remove();
        return;
      }
    }

    if (tag === 'div' && shouldConvertDivToParagraph(element)) {
      const paragraph = doc.createElement('p');
      paragraph.innerHTML = element.innerHTML;
      element.replaceWith(paragraph);
      element = paragraph;
      tag = 'p';
    }

    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const keepInternalDataId = mode === 'save' && tag === 'img' && name === 'data-id';
      const keepVideoAspectData =
        tag === 'iframe' &&
        name === 'data-von-video-aspect' &&
        (value === 'portrait' || value === 'landscape');
      const keepImageSizeData =
        tag === 'img' &&
        name === 'data-von-image-size' &&
        (value === '25' || value === '50' || value === '75' || value === '100');
      const keepImageAlignmentData =
        tag === 'img' &&
        name === 'data-von-image-align' &&
        (value === 'left' || value === 'center' || value === 'right');

      if (name === 'class' || name === 'id' || name === 'role' || name.startsWith('aria-')) {
        element.removeAttribute(attr.name);
        return;
      }

      if (
        name.startsWith('data-') &&
        !keepInternalDataId &&
        !keepVideoAspectData &&
        !keepImageSizeData &&
        !keepImageAlignmentData
      ) {
        element.removeAttribute(attr.name);
        return;
      }

      if (mode === 'paste' && name === 'style') {
        const filteredStyle = filterPasteStyles(value);
        if (filteredStyle) {
          element.setAttribute(attr.name, filteredStyle);
        } else {
          element.removeAttribute(attr.name);
        }
        return;
      }

      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attr.name);
      }
    });

    if (mode === 'paste' && looksLikeNonContentBlock(element)) {
      element.remove();
      return;
    }
  });

  Array.from(doc.body.querySelectorAll('*'))
    .reverse()
    .forEach((node) => {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (['img', 'iframe', 'br', 'hr', 'td', 'th'].includes(tag)) return;
      const text = element.textContent?.replace(/\u00A0/g, ' ').trim() || '';
      if (!text && element.children.length === 0) {
        element.remove();
      }
    });

  return doc.body.innerHTML;
};
/**
 * Filters a CSS style string to keep only safe, layout-related properties.
 * Strips colors, backgrounds, font-size, etc. to maintain theme consistency & dark mode.
 */
const filterStyleProps = (styleValue: string, allowedProps: Set<string>): string => {
  if (!styleValue) return '';
  return styleValue
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      const prop = s.split(':')[0]?.trim().toLowerCase();
      if (!prop || prop.startsWith('mso-')) return false;
      return prop && allowedProps.has(prop);
    })
    .join('; ');
};

const filterStyles = (styleValue: string): string =>
  filterStyleProps(styleValue, ALLOWED_STYLE_PROPS);

const filterPasteStyles = (styleValue: string): string =>
  filterStyleProps(styleValue, EDITOR_ALLOWED_PASTE_STYLE_PROPS);

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip dangerous tags and attributes.
 * Inline styles are filtered to allow only safe layout properties
 * (alignment, margins, sizing) while blocking colors and fonts
 * to maintain dark mode and theme consistency.
 *
 * @param content The raw HTML content string
 * @param options Optional DOMPurify configuration
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (content: string, options?: DOMPurifyConfig): string => {
  if (!content) return '';
  const hasStrictAllowlist = Boolean(options?.ALLOWED_TAGS || options?.ALLOWED_ATTR);
  const config: DOMPurifyConfig = hasStrictAllowlist
    ? { ...options }
    : {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: [
          'allow',
          'allowfullscreen',
          'frameborder',
          'scrolling',
          'loading',
          'target',
          'style',
        ],
        ...options,
      };

  // Hook: filter inline styles to whitelist-only safe properties
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
      const filtered = filterStyles(data.attrValue);
      if (filtered) {
        data.attrValue = filtered;
      } else {
        // No safe properties remain — remove the attribute entirely
        data.attrValue = '';
        data.forceKeepAttr = false;
      }
    }
  });

  // Hook: Auto-add rel="noopener noreferrer" to target="_blank" links
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      const rel = node.getAttribute('rel');
      if (!rel || (!rel.includes('noopener') && !rel.includes('noreferrer'))) {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  const result = DOMPurify.sanitize(content, config) as unknown as string;

  // Clean up hooks to prevent accumulation across calls
  DOMPurify.removeHook('uponSanitizeAttribute');
  DOMPurify.removeHook('afterSanitizeAttributes');

  return result;
};

export const sanitizeEditorHtml = (content: string): string => {
  if (!content) return '';

  const normalized = normalizeEditorMarkup(content, 'save');
  return sanitizeHtml(normalized, {
    ADD_ATTR: [
      'style',
      'data-id',
      'data-von-video-aspect',
      'data-von-image-size',
      'data-von-image-align',
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['class', 'id', 'role'],
    FORBID_TAGS: [
      'html',
      'head',
      'body',
      'meta',
      'link',
      'style',
      'script',
      'noscript',
      'template',
      'svg',
      'canvas',
      'header',
      'footer',
      'nav',
      'aside',
      'form',
      'button',
      'input',
      'select',
      'option',
      'textarea',
    ],
  });
};

export const sanitizePastedHtml = (content: string): string => {
  if (!content) return '';

  const normalized = normalizeEditorMarkup(content, 'paste');
  return sanitizeHtml(normalized, {
    ADD_ATTR: [],
    ADD_TAGS: [],
    ALLOW_DATA_ATTR: false,
    ALLOWED_ATTR: EDITOR_ALLOWED_PASTE_ATTRS,
    ALLOWED_TAGS: EDITOR_ALLOWED_PASTE_TAGS,
    FORBID_ATTR: ['class', 'id', 'role'],
    FORBID_TAGS: [
      'html',
      'head',
      'body',
      'meta',
      'link',
      'style',
      'script',
      'noscript',
      'template',
      'svg',
      'canvas',
      'header',
      'footer',
      'nav',
      'aside',
      'form',
      'button',
      'input',
      'select',
      'option',
      'textarea',
    ],
  });
};
/**
 * Apply lazy loading to img and iframe tags in HTML content.
 * Adds loading="lazy" attribute to enable native browser lazy loading.
 *
 * @param content The HTML content string
 * @param options Options for lazy loading
 * @returns HTML string with lazy loading applied
 */
export const applyLazyLoad = (
  content: string,
  options: { images?: boolean; iframes?: boolean } = { images: true, iframes: true }
): string => {
  if (!content) return '';

  let result = content;

  // Add loading="lazy" to img tags that don't already have it or fetchpriority
  if (options.images) {
    result = result.replace(
      /<img\s+(?![^>]*loading=)(?![^>]*fetchPriority=)/gi,
      '<img loading="lazy" '
    );
  }

  // Add loading="lazy" to iframe tags that don't already have it
  if (options.iframes) {
    result = result.replace(/<iframe\s+(?![^>]*loading=)/gi, '<iframe loading="lazy" ');
  }

  return result;
};

/**
 * Get CSRF token from backend
 * Fetches from server and caches in memory
 */
let cachedCsrfToken: string = '';

/**
 * Set CSRF token manually (e.g. after login)
 */
export const setCsrfToken = (token: string) => {
  cachedCsrfToken = token;
};

export const getCsrfToken = async (): Promise<string> => {
  // Return cached token if available
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  try {
    // Try to fetch from PHP backend
    const response = await fetch(`${BASE_PATH}api.php?action=get_csrf_token`);
    if (response.ok) {
      const data = await response.json();
      if (data.csrf_token) {
        cachedCsrfToken = data.csrf_token;
        return cachedCsrfToken;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch CSRF token from backend:', error);
  }

  // Checking meta tag as backup (Server Side Rendering support)
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken) {
    cachedCsrfToken = metaToken.getAttribute('content') || '';
    return cachedCsrfToken;
  }

  return ''; // Return empty if failed (Backend should reject invalid token)
};

/**
 * Get secure headers with CSRF token
 * Merges provided headers with security headers
 */
export const getSecureHeaders = (
  existingHeaders: Record<string, string> = {}
): Record<string, string> => {
  // Note: This is now synchronous, but getCsrfToken is async
  // For immediate use, we use the cached token
  // Frontend should call getCsrfToken() on app init to populate cache

  return {
    ...existingHeaders,
    'X-CSRF-TOKEN': cachedCsrfToken,
  };
};
