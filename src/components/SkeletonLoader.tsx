import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div
      className="skeleton-loader-react"
      role="status"
      aria-label="Loading content"
      aria-busy="true"
    >
      <div className="sk-nav"></div>
      <div className="sk-hero"></div>
      <div className="sk-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="sk-card"></div>
        ))}
        <div className="sk-card sk-card-tablet" aria-hidden="true"></div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
