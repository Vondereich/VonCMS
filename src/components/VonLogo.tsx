import React from 'react';

interface VonLogoProps {
  variant?: 'default' | 'large' | 'simple';
  className?: string;
}

export const VonLogo: React.FC<VonLogoProps> = ({ variant = 'default', className = '' }) => {
  // Shared SVG Path
  const SvgContent = () => (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={
        variant === 'large' ? 'w-16 h-16' : variant === 'default' ? 'w-10 h-10' : 'w-7 h-7'
      }
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c5cfc" />
          <stop offset="100%" stopColor="#00e5a0" />
        </linearGradient>
      </defs>
      {/* Square 1 rotated 45deg */}
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
      {/* Square 2 rotated 90deg */}
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
