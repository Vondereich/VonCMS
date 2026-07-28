import React from 'react';

interface VonLogoProps {
  variant?: 'default' | 'large' | 'simple';
  className?: string;
}

export const VonLogo: React.FC<VonLogoProps> = ({ variant = 'default', className = '' }) => {
  const SvgContent = () => (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={
        variant === 'large' ? 'w-16 h-16' : variant === 'default' ? 'w-10 h-10' : 'w-7 h-7'
      }
    >
      {variant === 'simple' ? (
        <>
          <path
            d="M29.4 9.1A14.5 14.5 0 1 0 31.2 29.7"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
          />
          <path
            d="M11.1 16.2 19.5 31.5 29.2 11.2"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m24.9 11.3 6.9-4.1.9 7.9-3.5-3.9-4.3.1Z" fill="currentColor" />
        </>
      ) : (
        <>
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c5cfc" />
              <stop offset="100%" stopColor="#00e5a0" />
            </linearGradient>
          </defs>
          <rect
            x="10"
            y="10"
            width="20"
            height="20"
            fill="url(#logoGrad)"
            fillOpacity="0.12"
            stroke="url(#logoGrad)"
            strokeWidth="2.2"
            strokeLinejoin="miter"
            transform="rotate(45 20 20)"
          />
          <rect
            x="10"
            y="10"
            width="20"
            height="20"
            fill="url(#logoGrad)"
            fillOpacity="0.12"
            stroke="url(#logoGrad)"
            strokeWidth="2.2"
            strokeLinejoin="miter"
            transform="rotate(90 20 20)"
          />
        </>
      )}
    </svg>
  );

  // Minimalist / Large Style
  if (variant === 'large') {
    return (
      <div className={`w-16 h-16 flex items-center justify-center mx-auto mb-4 ${className}`}>
        <SvgContent />
      </div>
    );
  }

  // Default / Admin Style (Small with Gradient)
  if (variant === 'default') {
    return (
      <div className={`w-10 h-10 flex items-center justify-center mr-3 ${className}`}>
        <SvgContent />
      </div>
    );
  }

  // Simple (Just SVG, responsive to parent color)
  return (
    <div className={className}>
      <SvgContent />
    </div>
  );
};
