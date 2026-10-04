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
  const popupAllowed = Boolean(
    ads?.adsEnabled &&
    ads?.popupEnabled &&
    ads?.popupAd &&
    (currentView === undefined || currentView === 'home')
  );

  useEffect(() => {
    setShowPopup(false);
    if (popupAllowed) {
      const timer = setTimeout(() => setShowPopup(true), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [popupAllowed, ads?.popupAd, currentView, delay]);

  const closePopup = useCallback(() => setShowPopup(false), []);

  return {
    showPopup: showPopup && popupAllowed,
    closePopup,
    popupContent: ads?.popupAd || '',
  };
};

export default useAdsPopup;
