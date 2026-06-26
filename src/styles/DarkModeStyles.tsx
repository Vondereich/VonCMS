/**
 * VonCMS Dark Mode Styles Component
 * Minimal CSS for dark mode content - just link/code styling
 *
 * Note: Color sanitization is now handled by colorSanitizer.ts on save.
 * This file only provides accent colors for links and code blocks.
 */

import React from 'react';

interface DarkModeStylesProps {
  /** Prefix for content class, e.g. "digest" creates ".digest-content" selector */
  prefix: string;
  /** Custom accent color for links (default: #60a5fa) */
  accentColor?: string;
  /** Custom code highlight color (default: #a78bfa) */
  codeColor?: string;
}

export const DarkModeStyles: React.FC<DarkModeStylesProps> = ({
  prefix,
  accentColor = '#60a5fa',
  codeColor = '#a78bfa',
}) => (
  <style>{`
        .dark .${prefix}-content a { color: ${accentColor}; }
        .dark .${prefix}-content code { color: ${codeColor}; }
        .dark .${prefix}-content pre code { color: #f5f5f7; }
    `}</style>
);

/**
 * Prose Dark Mode Fix
 * Minimal version - just for Tailwind Typography prose classes
 */
export const ProseDarkModeStyles: React.FC = () => (
  <style>{`
        .dark .prose a { color: #60a5fa; }
        .dark .prose code { color: #a78bfa; }
        .dark .prose pre code { color: #f5f5f7; }
    `}</style>
);

export default DarkModeStyles;
