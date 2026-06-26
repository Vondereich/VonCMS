export const isNeutralColor = (color: string): boolean => {
  const normalized = normalizeColor(color);
  if (!normalized) return false;

  const { r, g, b } = normalized;

  // Check if it's near black (0-50 range) - covers #000, rgb(0,0,0), and dark slates
  const isBlack = r <= 50 && g <= 50 && b <= 50;

  // Check if it's near white (200-255 range) - covers #fff, rgb(255,255,255)
  const isWhite = r >= 200 && g >= 200 && b >= 200;

  // Check if it's grayscale and dark (common in Tailwind slate 700/800/900)
  // Grayscale means R, G, B are close to each other
  // Check if it's grayscale and dark (common in Tailwind slate 700/800/900)
  // Grayscale means R, G, B are close to each other
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  const isGrayscale = maxDiff <= 35; // Increased tolerance (to catch Slate-900 which has diff of 27)
  const isDarkGray = isGrayscale && r <= 130; // Increased checking range (130 cover darker grays)

  return isBlack || isWhite || isDarkGray;
};

export const normalizeColor = (color: string): { r: number; g: number; b: number } | null => {
  if (!color) return null;
  const c = color.trim().toLowerCase();

  // Handle hex colors (#000000, #000)
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      return null;
    }

    return { r, g, b };
  }

  // Handle rgb/rgba
  const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
    };
  }

  // Handle named colors
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    darkgray: { r: 169, g: 169, b: 169 }, // Correct HTML darkgray
    darkgrey: { r: 169, g: 169, b: 169 },
    dimgray: { r: 105, g: 105, b: 105 },
    dimgrey: { r: 105, g: 105, b: 105 },
    silver: { r: 192, g: 192, b: 192 },
    lightgray: { r: 211, g: 211, b: 211 },
    lightgrey: { r: 211, g: 211, b: 211 },
  };

  return namedColors[c] || null;
};

export const sanitizeHTML = (html: string): { cleanedHTML: string; removedCount: number } => {
  if (!html) return { cleanedHTML: '', removedCount: 0 };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all elements with inline color styles
  // We query all elements with style attribute
  const elementsWithStyle = doc.querySelectorAll('[style]');

  let removedCount = 0;

  elementsWithStyle.forEach((el) => {
    const element = el as HTMLElement;
    const style = element.style;

    // Check Color
    if (style.color && isNeutralColor(style.color)) {
      style.color = ''; // Remove the neutral color
      removedCount++;
    }

    // Check Background Color (Remove white/black backgrounds too, usually copy-paste artifact)
    if (style.backgroundColor && isNeutralColor(style.backgroundColor)) {
      style.backgroundColor = '';
      removedCount++;
    }

    // --- Copy-Paste Layout Scrubber (Fixes spacing from alien HTML) ---
    // The editor paste sanitizer owns typography cleanup after this baseline pass.
    const propertiesToRemove = new Set([
      // Only remove structural/alien properties that break layout flow
      // But keep margins/paddings as they are needed for alignment and spacing
      'position',
      'top',
      'left',
      'right',
      'bottom',
      'z-index',
    ]);

    // Gather all properties currently applied to the element into a static array
    const appliedProps = Array.from(style);

    appliedProps.forEach((propName) => {
      // Remove listed alien properties OR any Tailwind variables
      if (propertiesToRemove.has(propName) || propName.startsWith('--tw-')) {
        style.removeProperty(propName);
        removedCount++;
      }
    });
    // --- END: Layout Scrubber  ---

    // If no other styles remain, remove the entire style attribute
    if (!element.getAttribute('style') || element.getAttribute('style')?.trim() === '') {
      element.removeAttribute('style');
    }
  });

  const cleanedHTML = trimTrailingHtml(doc.body.innerHTML);
  const finalHTML = trimLeadingHtml(cleanedHTML);

  return {
    cleanedHTML: finalHTML,
    removedCount,
  };
};

export const trimLeadingHtml = (html: string): string => {
  if (!html) return '';

  let cleaned = html.trim();
  let lastLength;

  do {
    lastLength = cleaned.length;

    // 1. Remove leading HTML comments (strictly the first comment only)
    cleaned = cleaned.replace(/^\s*<!--[\s\S]*?-->/g, '');

    // 2. Remove leading empty block tags or breaks
    cleaned = cleaned.replace(
      /^\s*(?:<h\d[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/h\d>|<p[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/p>|<div[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/div>|<br\s*\/?>|&nbsp;|\u00A0|\u200B)/gi,
      ''
    );
    cleaned = cleaned.trim();
  } while (cleaned.length < lastLength);

  return cleaned;
};

export const trimTrailingHtml = (html: string): string => {
  if (!html) return '';

  // 1. Remove trailing empty block tags and breaks/spaces
  // Covers <p>, <div>, <h1-6> that only contain space, <br>, &nbsp;, or zero-width joiners
  // Also removes trailing HTML comments like <!--EndFragment-->
  let cleaned = html.trim();
  let lastLength;

  do {
    lastLength = cleaned.length;

    // 1. Remove trailing HTML comments (strictly the final comment only, avoiding greedy backtracking)
    cleaned = cleaned.replace(/<!--(?![\s\S]*<!--)[\s\S]*?-->\s*$/g, '');

    // 2. Remove empty block tags
    cleaned = cleaned.replace(
      /(?:<h\d[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/h\d>|<p[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/p>|<div[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0|\u200B)?\s*<\/div>|<br\s*\/?>|&nbsp;|\u00A0|\u200B)\s*$/gi,
      ''
    );
    cleaned = cleaned.trim();
  } while (cleaned.length < lastLength);

  return cleaned;
};
