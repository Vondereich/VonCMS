import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import nprogress from 'nprogress';
import 'nprogress/nprogress.css';

// Configure NProgress (no spinner, faster speed)
nprogress.configure({
  showSpinner: false,
  speed: 400,
  minimum: 0.2, // Start slightly visible
  easing: 'ease',
  trickleSpeed: 200, // Trickle more often for "aliveness"
});

const RouteProgressBar = () => {
  const { pathname, search } = useLocation();
  const lastLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const currentLocation = `${pathname}${search}`;

    // The first page load already has a server-owned boot canvas (and public data when
    // available), so showing a simulated route progress bar here only creates a misleading
    // 20-30% flash during hydration. Remember the first location instead; the equality guard
    // also prevents React StrictMode's repeated development effect from starting the bar.
    if (lastLocationRef.current === null) {
      lastLocationRef.current = currentLocation;
      nprogress.remove();
      return;
    }

    if (lastLocationRef.current === currentLocation) return;
    lastLocationRef.current = currentLocation;

    // Start progress on location change
    nprogress.start();

    // Finish progress after short delay to simulate "arrival" even if instant
    const timer = setTimeout(() => {
      nprogress.done();
    }, 150); // 150ms delay keeps it visible just enough to be felt

    return () => {
      clearTimeout(timer);
      nprogress.done(); // Ensure cleanup
    };
  }, [pathname, search]);

  return null; // This component handles side-effects only
};

export default RouteProgressBar;
