import React from 'react';
import ReactDOM from 'react-dom/client';

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
