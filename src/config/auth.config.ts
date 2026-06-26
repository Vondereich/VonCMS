/**
 * VonCMS Auth Configuration
 *
 * Environment Variables:
 * - VITE_AUTH_TOKEN: Optional. Set in .env.production for custom auth token
 *
 * Note: VonCMS uses PHP session-based auth. These tokens are for API compatibility only.
 */

// Session timeout in milliseconds (30 minutes)
export const SESSION_TIMEOUT = 30 * 60 * 1000;

// Auth token - uses env var in production, empty string otherwise
export const AUTH_TOKEN = import.meta.env['VITE_AUTH_TOKEN'] || '';

/**
 * Get auth header for internal API calls
 * Note: PHP session handles actual authentication, this is for API layer compatibility
 */
export const getAuthHeader = (): string => {
  if (!AUTH_TOKEN) return '';
  return `Bearer ${AUTH_TOKEN}`;
};

// Legacy export for backward compatibility
export const DEV_TOKENS = {
  mockDevToken: AUTH_TOKEN,
  secureToken: AUTH_TOKEN,
};
