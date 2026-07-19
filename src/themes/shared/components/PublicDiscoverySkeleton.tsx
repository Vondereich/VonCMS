import React from 'react';

interface PublicDiscoverySkeletonProps {
  className?: string;
  label?: string;
}

const PublicDiscoverySkeleton: React.FC<PublicDiscoverySkeletonProps> = ({
  className = '',
  label = 'Loading stories',
}) => (
  <div className={className} role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="sk-grid">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="sk-card"></div>
      ))}
      <div className="sk-card sk-card-tablet" aria-hidden="true"></div>
    </div>
  </div>
);

export default PublicDiscoverySkeleton;
