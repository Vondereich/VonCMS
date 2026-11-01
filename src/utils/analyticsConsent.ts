import { BASE_PATH } from '../config/site.config';

const ANALYTICS_CONSENT_COOKIE = 'von_consent';
const CONSENT_RETENTION_DAYS = 365;

export type AnalyticsConsentDecision = 'accepted' | 'declined' | 'unset';

const getConsentCookiePath = (): string => {
  const configuredPath = BASE_PATH || '/';
  const normalizedPath = `/${configuredPath}`.replace(/\/{2,}/g, '/');
  return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
};

export const readAnalyticsConsent = (): AnalyticsConsentDecision => {
  if (typeof document === 'undefined') return 'unset';

  const prefix = `${ANALYTICS_CONSENT_COOKIE}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) return 'unset';

  const value = cookie.slice(prefix.length);
  if (value === 'true') return 'accepted';
  if (value === 'false') return 'declined';
  return 'unset';
};

export const analyticsTrackingAllowed = (consentRequired: boolean): boolean =>
  !consentRequired || readAnalyticsConsent() === 'accepted';

export const nativeAnalyticsCookieName = (): string =>
  'von_analytics_id_' +
  Array.from(new TextEncoder().encode(getConsentCookiePath()), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');

export const clearNativeAnalyticsIdentity = (): void => {
  if (typeof document === 'undefined' || !document.cookie.includes('von_analytics_id_')) return;
  const name = nativeAnalyticsCookieName();
  if (!document.cookie.split(';').some((part) => part.trim().startsWith(name + '='))) return;
  const secure = window.location.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${getConsentCookiePath()};SameSite=Lax${secure}`;
};

export const writeAnalyticsConsent = (accepted: boolean): void => {
  if (typeof document === 'undefined') return;
  if (!accepted) clearNativeAnalyticsIdentity();

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const secureAttribute = window.location.protocol === 'https:' ? ';Secure' : '';

  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${accepted ? 'true' : 'false'};expires=${expiresAt.toUTCString()};path=${getConsentCookiePath()};SameSite=Lax${secureAttribute}`;
};
