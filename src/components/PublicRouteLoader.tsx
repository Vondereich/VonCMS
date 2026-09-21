import React from 'react';

const PUBLIC_ROUTE_LOADER_DELAY_MS = 300;

const PublicRouteLoader: React.FC = () => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), PUBLIC_ROUTE_LOADER_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="voncms-public-route-loader"
      role={isVisible ? 'status' : undefined}
      aria-live={isVisible ? 'polite' : undefined}
      aria-busy={isVisible ? 'true' : undefined}
    >
      {isVisible ? (
        <>
          <span className="voncms-loader-spinner" aria-hidden="true" />
          <span className="sr-only">Loading content</span>
        </>
      ) : null}
    </div>
  );
};

export default PublicRouteLoader;
