import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div
      className="skeleton-loader-react"
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      style={{
        fontFamily: "'Inter', sans-serif",
        padding: 'clamp(1rem, 4vw, 2rem)',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* Style block to ensure animation works even if global CSS isn't perfect yet */}
      <style>{`
                .sk-nav {
                    height: 64px;
                    background: #e5e7eb;
                    margin-bottom: 3rem;
                    border-radius: 0.5rem;
                }
                .sk-hero {
                    height: 200px;
                    background: #e5e7eb;
                    margin-bottom: 2rem;
                    border-radius: 1rem;
                }
                .sk-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
                    gap: clamp(1rem, 3vw, 2rem);
                }
                .sk-card {
                    height: 300px;
                    background: #e5e7eb;
                    border-radius: 1rem;
                }
                /* Keep React fallbacks aligned with public/skeleton.css */
                .dark .sk-nav, .dark .sk-hero, .dark .sk-card {
                    background: #111827;
                    border: 1px solid rgba(148, 163, 184, 0.08);
                }
                
                /* Shimmer Animation */
                .sk-nav, .sk-hero, .sk-card {
                    position: relative;
                    overflow: hidden;
                }
                .sk-nav::after, .sk-hero::after, .sk-card::after {
                    content: "";
                    position: absolute;
                    top: 0; right: 0; bottom: 0; left: 0;
                    transform: translateX(-100%);
                    background-image: linear-gradient(
                        90deg,
                        rgba(255, 255, 255, 0) 0,
                        rgba(255, 255, 255, 0.2) 20%,
                        rgba(255, 255, 255, 0.5) 60%,
                        rgba(255, 255, 255, 0)
                    );
                    animation: shimmer 2s infinite;
                }
                .dark .sk-nav::after, .dark .sk-hero::after, .dark .sk-card::after {
                    background-image: linear-gradient(
                        90deg,
                        rgba(15, 23, 42, 0) 0,
                        rgba(59, 130, 246, 0.1) 20%,
                        rgba(148, 163, 184, 0.16) 60%,
                        rgba(15, 23, 42, 0)
                    );
                }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .sk-nav::after, .sk-hero::after, .sk-card::after {
                        animation: none;
                        transform: none;
                        opacity: 0;
                    }
                }
            `}</style>

      <div className="sk-nav"></div>
      <div className="sk-hero"></div>
      <div className="sk-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="sk-card"></div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;
