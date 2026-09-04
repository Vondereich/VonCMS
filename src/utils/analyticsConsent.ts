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

export const writeAnalyticsConsent = (accepted: boolean): void => {
  if (typeof document === 'undefined') return;

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + CONSENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const secureAttribute = window.location.protocol === 'https:' ? ';Secure' : '';

  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${accepted ? 'true' : 'false'};expires=${expiresAt.toUTCString()};path=${getConsentCookiePath()};SameSite=Lax${secureAttribute}`;
};
