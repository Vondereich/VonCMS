import { getCsrfToken } from './security';

/**
 * VonCMS Centralized Fetch Utility
 * Automatically injects credentials and security headers
 */
export const vonFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // 1. Clean URL: Replace double slashes // with single /, but only after the protocol
  // This handles cases where BASE_PATH is '/' and the path starts with '/'
  const cleanUrl = url.replace(/([^:]\/)\/+/g, '$1');

  // 2. Force credentials to 'include' for Cross-Origin session support
  const mergedOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };

  // 3. Inject CSRF Token automatically for POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      mergedOptions.headers = {
        ...mergedOptions.headers,
        'X-CSRF-TOKEN': csrfToken,
      };
    }
  }

  return fetch(cleanUrl, mergedOptions);
};
