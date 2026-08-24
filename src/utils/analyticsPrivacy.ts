const SENSITIVE_ANALYTICS_QUERY_KEYS = new Set([
  'reset_token',
  'verification_token',
  'token',
  'api_key',
  'key',
  'code',
]);

const isAuthenticationPath = (pathname: string): boolean => /(?:^|\/)login\/?$/i.test(pathname);

export const resolveAnalyticsPageLocation = (href: string, pathname: string): string | null => {
  if (isAuthenticationPath(pathname)) return null;

  try {
    const url = new URL(href);
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (SENSITIVE_ANALYTICS_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    });
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};
