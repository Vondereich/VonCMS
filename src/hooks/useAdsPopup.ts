import { useState, useEffect, useCallback } from 'react';

interface AdsSettings {
  adsEnabled?: boolean;
  popupEnabled?: boolean;
  popupAd?: string;
}

/**
 * Hook to manage popup ad display with timer.
 * Centralizes popup logic used across all themes.
 *
 * @param ads - Ad settings object
 * @param currentView - Optional current view (if provided, popup only shows on 'home')
 * @param delay - Delay in ms before showing popup (default: 3000ms)
 */
export const useAdsPopup = (
  ads: AdsSettings | undefined,
  currentView?: string,
  delay: number = 3000
) => {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Show popup when ads are enabled
    // If currentView is provided, only show on 'home' (Digest behavior)
    // If currentView is undefined, always show (Default/TechPress/Prism behavior)
    const shouldShow = ads?.adsEnabled && ads?.popupEnabled && ads?.popupAd;
    const viewAllowed = currentView === undefined || currentView === 'home';

    if (shouldShow && viewAllowed) {
      const timer = setTimeout(() => setShowPopup(true), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [ads?.adsEnabled, ads?.popupEnabled, ads?.popupAd, currentView, delay]);

  const closePopup = useCallback(() => setShowPopup(false), []);

  return {
    showPopup,
    closePopup,
    popupContent: ads?.popupAd || '',
  };
};

export default useAdsPopup;
