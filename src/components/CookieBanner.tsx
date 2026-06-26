import React, { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';

interface CookieBannerProps {
  cookieConsentRequired: boolean;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ cookieConsentRequired }) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Only show if consent is required AND cookie is not yet set
    if (cookieConsentRequired) {
      const hasConsent = document.cookie.split('; ').find((row) => row.startsWith('von_consent='));

      if (!hasConsent) {
        setShowBanner(true);
      }
    }
  }, [cookieConsentRequired]);

  const handleAccept = () => {
    // Set cookie for 365 days
    const d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + d.toUTCString();
    document.cookie = 'von_consent=true;' + expires + ';path=/';

    setShowBanner(false);

    // Slight delay to allow cookie to propagate, then reload cleanly to trigger AnalyticsInjector
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const handleDecline = () => {
    // Set cookie to false to stop asking
    const d = new Date();
    d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days memory for decline
    const expires = 'expires=' + d.toUTCString();
    document.cookie = 'von_consent=false;' + expires + ';path=/';

    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-fade-in-up">
      <div className="max-w-6xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <Cookie size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Cookies & Privacy
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
              We use cookies to enhance your experience and analyze site traffic. By clicking
              "Accept", you agree to our use of cookies for analytics and personalized content.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleDecline}
            className="flex-1 md:flex-none px-6 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 md:flex-none px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/30"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
};
