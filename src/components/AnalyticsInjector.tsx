import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface AnalyticsSettings {
  googleAnalyticsId?: string;
  enableTracking?: boolean;
  trackPageViews?: boolean;
  trackEvents?: boolean;
  anonymizeIP?: boolean;
  cookieConsent?: boolean;
}

interface AnalyticsInjectorProps {
  analytics?: AnalyticsSettings;
}

// Removed conflicting global declaration
// We will cast window to any for Google Analytics injection to avoid Type conflicts with other libraries

export const AnalyticsInjector: React.FC<AnalyticsInjectorProps> = ({ analytics }) => {
  const location = useLocation();

  useEffect(() => {
    // 1. Validation: ID must exist, tracking enabled, and ID must be valid format (Prevent XSS)
    // Allows G-XXXXXX, UA-XXXXXX, and alphanumeric characters only.
    const validIdRegex = /^[a-zA-Z0-9-_]+$/;

    if (
      !analytics?.googleAnalyticsId ||
      analytics.enableTracking === false ||
      typeof analytics.googleAnalyticsId !== 'string' ||
      !validIdRegex.test(analytics.googleAnalyticsId.trim())
    ) {
      return;
    }

    const gaId = analytics.googleAnalyticsId.trim();

    // 2. Cookie Consent Check
    if (analytics.cookieConsent) {
      const hasConsent = document.cookie
        .split('; ')
        .find((row) => row.startsWith('von_consent=true'));

      if (!hasConsent) return;
    }

    // 3. Inject Script (Idempotent)
    const scriptId = `von-ga-script-${gaId}`;
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);

      // Initialize DataLayer
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = function () {
        // eslint-disable-next-line
        (window as any).dataLayer.push(arguments);
      };
      (window as any).gtag('js', new Date());

      const config: any = {
        anonymize_ip: analytics.anonymizeIP || false,
        send_page_view: false,
      };

      (window as any).gtag('config', gaId, config);
    }

    // 4. Track Page View (SPA)
    if (analytics.trackPageViews !== false && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title,
      });
    }
  }, [analytics, location]);

  return null;
};
