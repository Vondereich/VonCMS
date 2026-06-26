import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div
      className="skeleton-loader-react"
      style={{
        fontFamily: "'Inter', sans-serif",
        padding: '2rem',
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
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .sk-card {
                    height: 300px;
                    background: #e5e7eb;
                    border-radius: 1rem;
                }
                /* Dark Mode Support based on system/parent */
                .dark .sk-nav, .dark .sk-hero, .dark .sk-card {
                    background: #1a1a1a;
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
                        rgba(255, 255, 255, 0.4) 20%,
                        rgba(255, 255, 255, 0.7) 60%,
                        rgba(255, 255, 255, 0)
                    );
                    animation: shimmer 2s infinite;
                }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>

      <div className="sk-nav"></div>
      <div className="sk-hero"></div>
      <div className="sk-grid">
        <div className="sk-card"></div>
        <div className="sk-card"></div>
        <div className="sk-card"></div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
