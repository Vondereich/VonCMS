import React from 'react';

interface PublicDiscoveryRefreshStatusProps {
  active: boolean;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}

const PublicDiscoveryRefreshStatus: React.FC<PublicDiscoveryRefreshStatusProps> = ({
  active,
  className = '',
  label = 'Loading category stories...',
  style,
}) => {
  if (!active) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className={`flex w-fit items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 ${className}`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-current motion-safe:animate-pulse"
      ></span>
      <span>{label}</span>
    </p>
  );
};

export default PublicDiscoveryRefreshStatus;
