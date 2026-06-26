/**
 * Text Utilities for VonCMS Themes
 * Centralized functions for text processing across all themes
 */

/**
 * Decode HTML entities for display (e.g. &#039; -> ')
 * Uses DOMParser for robust, XSS-safe decoding
 */
export const decodeEntities = (text: string | undefined): string => {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.body.textContent || text;
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
