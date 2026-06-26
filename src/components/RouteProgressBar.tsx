import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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

  useEffect(() => {
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
