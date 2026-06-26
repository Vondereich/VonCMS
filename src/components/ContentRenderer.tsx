import React from 'react';
import ContactFormRenderer from './ContactFormRenderer';
import { applyLazyLoad, sanitizeHtml } from '../utils/security';
import { useSettings } from '../hooks/useSettings';

interface ContentRendererProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ html, className, style }) => {
  const { settings } = useSettings();

  if (!html) return null;

  // Apply lazy loading based on media settings
  const mediaPerf = settings?.media?.performance;
  const processedHtml = applyLazyLoad(html, {
    images: mediaPerf?.lazyLoadImages ?? true,
    iframes: mediaPerf?.lazyLoadIframes ?? true,
  });

  // Check for [von-contact id="..."] shortcode (handle both literal and encoded variants)
  const hasShortcode =
    processedHtml.includes('[von-contact') ||
    processedHtml.includes('&#91;von-contact') ||
    processedHtml.includes('&lbrack;von-contact');

  if (hasShortcode) {
    // Robust split: handles literal [, encoded &#91;, &lbrack;, etc.
    const parts = processedHtml.split(
      /((?:\[|&#91;|&lbrack;)von-contact\s+id=(?:["']|&quot;)?(?:[a-zA-Z0-9-_]+)(?:["']|&quot;)?.*?\])/g
    );

    return (
      <div className={className} style={style}>
        {parts.map((part, index) => {
          // Match the ID from the captured group
          const match = part.match(
            /(?:\[|&#91;|&lbrack;)von-contact\s+id=(?:["']|&quot;)?([a-zA-Z0-9-_]+)/
          );

          if (match) {
            const formId = match[1];
            return (
              <div key={index} className="mb-8">
                <ContactFormRenderer id={formId} />
              </div>
            );
          }

          return (
            <div
              key={index}
              className="text-slate-900 dark:text-slate-200 [&>p]:mb-3 [&>*:last-child]:mb-0 [&_a]:font-semibold [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-blue-400"
              // nosemgrep: react-dangerouslysetinnerhtml -- content fragments are sanitized via sanitizeHtml before rendering.
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }}
            />
          );
        })}
      </div>
    );
  }

  // Default behavior
  return (
    <div className={className} style={style}>
      <style>{`
        .prose h1, .voncms-content h1 { font-size: 2.25rem !important; font-weight: 800; line-height: 1.2; margin-bottom: 0.8em; }
        .prose h2, .voncms-content h2 { font-size: 1.875rem !important; font-weight: 700; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.6em; }
        .prose h3, .voncms-content h3 { font-size: 1.5rem !important; font-weight: 600; line-height: 1.4; margin-top: 1.2em; margin-bottom: 0.5em; }
        .prose h4, .voncms-content h4 { font-size: 1.25rem !important; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
        .prose h5, .voncms-content h5 { font-size: 1.125rem !important; font-weight: 600; text-transform: uppercase; color: #64748b; margin-top: 1em; margin-bottom: 0.4em; }
        .prose h6, .voncms-content h6 { font-size: 1rem !important; font-weight: 700; letter-spacing: 0.05em; color: #475569; margin-top: 1em; }
        .dark .prose h5, .dark .voncms-content h5 { color: #94a3b8; }
        .dark .prose h6, .dark .voncms-content h6 { color: #cbd5e1; }
        .prose a, .voncms-content a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 600;
        }
        .dark .prose a, .dark .voncms-content a {
          color: #60a5fa;
        }
        .prose blockquote, .voncms-content blockquote {
          border-left: 4px solid #3b82f6;
          background: #eff6ff;
          color: #475569;
          font-style: italic;
          margin: 1.25rem 0;
          padding: 0.85rem 1rem;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .prose blockquote p, .voncms-content blockquote p {
          margin: 0;
        }
        .prose pre, .voncms-content pre {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          margin: 1.25rem 0;
          overflow-x: auto;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', monospace;
          font-size: 0.875rem;
          line-height: 1.65;
        }
        .prose code, .voncms-content code {
          background: #f1f5f9;
          color: #b45309;
          border-radius: 0.375rem;
          padding: 0.15rem 0.35rem;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', monospace;
          font-size: 0.9em;
        }
        .prose code::before, .prose code::after, .voncms-content code::before, .voncms-content code::after {
          content: none;
        }
        .prose pre code, .voncms-content pre code {
          background: transparent;
          color: inherit;
          border-radius: 0;
          padding: 0;
          font-size: inherit;
        }
        .dark .prose blockquote, .dark .voncms-content blockquote {
          background: #0f172a;
          color: #cbd5e1;
        }
        .dark .prose pre, .dark .voncms-content pre {
          background: #020617;
          color: #e2e8f0;
        }
        .dark .prose code, .dark .voncms-content code {
          background: #1e293b;
          color: #fbbf24;
        }
        .dark .prose pre code, .dark .voncms-content pre code {
          background: transparent;
          color: inherit;
        }
        .prose img, .voncms-content img {
          max-width: 100%;
          height: auto;
        }
        .prose figure, .voncms-content figure {
          max-width: 100%;
          margin: 1.5rem 0;
        }
        .prose figure img, .voncms-content figure img {
          margin-top: 0;
          margin-bottom: 0;
        }
        .prose figcaption, .voncms-content figcaption {
          margin-top: 0.35rem;
          color: #64748b;
          font-size: 0.75rem;
          font-style: italic;
          line-height: 1.4;
        }
        .dark .prose figcaption, .dark .voncms-content figcaption {
          color: #94a3b8;
        }
        .prose table, .voncms-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
        }
        .prose thead, .voncms-content thead {
          background: #e2e8f0;
        }
        .prose th, .prose td, .voncms-content th, .voncms-content td {
          border: 1px solid #cbd5e1;
          padding: 0.75rem 1rem;
          text-align: left;
          vertical-align: top;
          min-width: 120px;
        }
        .prose th, .voncms-content th {
          background: #f8fafc;
          font-weight: 700;
          color: #0f172a;
        }
        .dark .prose thead, .dark .voncms-content thead {
          background: #1e293b;
        }
        .dark .prose th, .dark .prose td, .dark .voncms-content th, .dark .voncms-content td {
          border-color: #334155;
        }
        .dark .prose th, .dark .voncms-content th {
          background: #1e293b;
          color: #f8fafc;
        }
        .voncms-content iframe[data-von-video-aspect='portrait'],
        .voncms-content iframe[src*='tiktok.com/player']:not([data-von-video-aspect='landscape']),
        .voncms-content iframe[src*='instagram.com/reel']:not([data-von-video-aspect='landscape']),
        .voncms-content iframe[src*='facebook.com/plugins/video.php'][src*='width=380']:not([data-von-video-aspect='landscape']),
        .voncms-content iframe[src*='von_vertical=shorts']:not([data-von-video-aspect='landscape']) {
          display: block;
          width: min(100%, 380px) !important;
          max-width: 100% !important;
          aspect-ratio: 9 / 16 !important;
          height: auto !important;
          min-height: min(80vh, 560px);
          margin-left: auto;
          margin-right: auto;
        }
        .voncms-content iframe[data-von-video-aspect='landscape'] {
          display: block;
          width: 100% !important;
          max-width: 100% !important;
          aspect-ratio: 16 / 9 !important;
          height: auto !important;
          min-height: 0;
          margin-left: auto;
          margin-right: auto;
        }
        @media (max-width: 640px) {
          .prose h1, .voncms-content h1 { font-size: 1.5rem !important; }
          .prose h2, .voncms-content h2 { font-size: 1.375rem !important; }
          .prose h3, .voncms-content h3 { font-size: 1.25rem !important; }
          .prose h4, .voncms-content h4 { font-size: 1.125rem !important; }
          .prose h5, .voncms-content h5 { font-size: 1rem !important; }
          .prose h6, .voncms-content h6 { font-size: 0.875rem !important; }
        }
      `}</style>
      <div
        className="voncms-content overflow-x-auto [&>p]:mb-3 [&>*:last-child]:mb-0"
        // nosemgrep: react-dangerouslysetinnerhtml -- post/page content is sanitized via sanitizeHtml before rendering.
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedHtml) }}
      />
    </div>
  );
};

export default React.memo(ContentRenderer);
