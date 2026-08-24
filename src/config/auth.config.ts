/**
 * VonCMS Auth Configuration
 *
 * VonCMS browser requests use the PHP session and CSRF token managed by vonFetch.
 * Static bearer credentials must never be compiled into the public Vite bundle.
 */

// Session timeout in milliseconds (30 minutes)
export const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Get auth header for internal API calls
 * Retained as an empty compatibility helper while older call sites migrate to vonFetch-only auth.
 */
export const getAuthHeader = (): string => '';

// Legacy export for backward compatibility
export const DEV_TOKENS = {
  mockDevToken: '',
  secureToken: '',
};
