import React from 'react';
import ReactDOM from 'react-dom/client';
import { BASE_PATH } from './config/site.config';
import { preloadPublicThemeLayout } from './plugins/von-core/features/public/themeLayoutLoader';

/**
 * Global Console Suppression for Recharts width/height warnings (v1.22.0 Tech Debt Fix)
 * Hides: "The width(-1) and height(-1) of chart should be greater than 0"
 */
const suppressRechartsWarning = () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const pattern = 'The width(-1) and height(-1) of chart should be greater than 0';

  console.warn = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes(pattern)) return;
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes(pattern)) return;
    originalError(...args);
  };
};
suppressRechartsWarning();

import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const normalizeBasePath = (basePath: string): string => {
  const pathWithLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return pathWithLeadingSlash.endsWith('/') ? pathWithLeadingSlash : `${pathWithLeadingSlash}/`;
};

const getAppPathname = (): string => {
  const normalizedBasePath = normalizeBasePath(BASE_PATH || '/');
  const pathname = window.location.pathname;
  if (normalizedBasePath === '/' || !pathname.startsWith(normalizedBasePath)) return pathname;

  return `/${pathname.slice(normalizedBasePath.length).replace(/^\/+/, '')}`;
};

const shouldPreloadPublicTheme = (): boolean =>
  !/^\/(?:admin(?:\/|$)|login\/?$|install\/?$)/i.test(getAppPathname());

const renderApp = () => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const bootstrapApp = () => {
  const themePreload = shouldPreloadPublicTheme()
    ? preloadPublicThemeLayout(window.__INITIAL_SETTINGS__?.activeThemeId)
    : null;
  renderApp();

  void themePreload?.catch(() => {
    // PublicSite forwards a failed theme chunk to the existing ErrorBoundary.
  });
};

bootstrapApp();
