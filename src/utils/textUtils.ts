/**
 * Text Utilities for VonCMS Themes
 * Centralized functions for text processing across all themes
 */

import DOMPurify from 'dompurify';

/**
 * Decode HTML entities for display (e.g. &#039; -> ')
 * Decode one entity layer without interpreting literal text as HTML markup.
 */
export const decodeEntities = (text: string | undefined): string => {
  if (!text) return '';
  const decoded = DOMPurify.sanitize(text.replace(/</g, '&lt;'), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  return decoded.textContent ?? '';
};

/**
 * Truncate text to a maximum length with ellipsis
 */
export const truncateText = (text: string | undefined, maxLength: number = 160): string => {
  if (!text) return '';
  const decoded = decodeEntities(text);
  if (decoded.length <= maxLength) return decoded;
  return decoded.slice(0, maxLength).trim() + '...';
};

/**
 * Sanitize text for URL slug
 */
export const sanitizeForSlug = (text: string | undefined): string => {
  if (!text) return '';
  return decodeEntities(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .replace(/^-|-$/g, ''); // Trim hyphens
};
