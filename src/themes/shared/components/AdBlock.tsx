import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { sanitizeHtml } from '../../../utils/security';
import { BASE_PATH } from '../../../config/site.config';

interface AdBlockProps {
  content?: string;
  className?: string;
  slotId?: string; // e.g. 'header', 'sidebar', 'infeed'
}

export const AdBlock: React.FC<AdBlockProps> = ({ content, className, slotId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const pathname = location.pathname;

  const safeContent = useMemo(
    () =>
      content
        ? (() => {
            try {
              return sanitizeHtml(content, {
                ADD_TAGS: ['script', 'iframe', 'style', 'ins', 'div', 'span', 'a', 'img'],
                ADD_ATTR: [
                  'src',
                  'async',
                  'crossorigin',
                  'style',
                  'class',
                  'id',
                  'target',
                  'width',
                  'height',
                  'allow',
                  'frameborder',
                  'scrolling',
                  'href',
                  'alt',
                ],
                ALLOW_DATA_ATTR: true,
                FORCE_BODY: true,
              });
            } catch {
              return '';
            }
          })()
        : '',
    [content]
  );

  // Smart Detection: Check if content contains script or iframe tags
  const hasExecutable = useMemo(() => /<(script|iframe)/i.test(safeContent), [safeContent]);

  useEffect(() => {
    // Only use Iframe Isolation for Script/Iframe based ads
    if (!hasExecutable || !containerRef.current || !safeContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.style.display = 'block';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-popups allow-forms allow-same-origin allow-modals'
    );

    containerRef.current.replaceChildren();
    containerRef.current.appendChild(iframe);

    const handleMessage = (event: MessageEvent) => {
      // Origin check — only accept messages from same origin (our own iframe)
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'adHeight' && event.data?.height > 0 && iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    };
    window.addEventListener('message', handleMessage);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      const finalHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <base href="${window.location.origin}${BASE_PATH}">
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              min-height: 1px;
            }
            * { max-width: 100%; }
          </style>
        </head>
        <body>
          ${safeContent}
          <script>
            const updateHeight = () => {
              const height = document.body.scrollHeight;
              if (height > 0 && window.parent) {
                window.parent.postMessage({ type: 'adHeight', height: height }, '*');
              }
            };
            window.onload = updateHeight;
            if (window.ResizeObserver) {
              const observer = new ResizeObserver(() => updateHeight());
              observer.observe(document.body);
            }
          </script>
        </body>
        </html>
      `;
      iframeDoc.write(finalHtml);
      iframeDoc.close();
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (containerRef.current) containerRef.current.replaceChildren();
    };
  }, [safeContent, pathname, hasExecutable]);

  if (!safeContent) return null;

  const wrapperProps = {
    key: pathname + (slotId || ''),
    id: slotId ? `ad-slot-${slotId}` : undefined,
    className: `ad-slot-wrapper ${slotId ? `ad-slot-${slotId}` : ''} ${className || ''}`,
    style: {
      minHeight: '1px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      margin: '0 auto',
    },
  };

  // If NO scripts, render directly to allow theme CSS integration
  if (!hasExecutable) {
    return (
      <div
        {...wrapperProps}
        className={`${wrapperProps.className} [&_a]:inline-block [&_iframe]:max-w-full [&_iframe]:align-middle [&_img]:inline-block [&_img]:h-auto [&_img]:max-w-full [&_ins]:inline-block [&_ins]:max-w-full`}
        style={{
          ...wrapperProps.style,
          textAlign: 'center' as const,
        }}
        // nosemgrep: react-dangerouslysetinnerhtml -- non-executable ad markup is rendered only after sanitizeHtml builds safeContent.
        dangerouslySetInnerHTML={{ __html: safeContent }}
      />
    );
  }

  // If Scripts found, use the isolated container handled by useEffect
  return <div {...wrapperProps} ref={containerRef} />;
};

export default AdBlock;
