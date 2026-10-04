import React, { useEffect, useState } from 'react';

const PRIVATE_ENTRY_LOADER_DELAY_MS = 180;

interface PrivateEntryLoaderProps {
  label?: string;
}

const PrivateEntryLoader: React.FC<PrivateEntryLoaderProps> = ({
  label = 'Loading secure access',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), PRIVATE_ENTRY_LOADER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 font-sans dark:bg-admin-inset"
      aria-busy="true"
    >
      {isVisible ? (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-admin-border-strong bg-admin-panel shadow-lg shadow-slate-950/15"
          role="status"
          aria-live="polite"
        >
          <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-500 border-t-white motion-reduce:animate-none" />
          <span className="sr-only">{label}</span>
        </div>
      ) : null}
    </div>
  );
};

export default PrivateEntryLoader;
