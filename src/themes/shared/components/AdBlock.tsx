import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AD_ALLOWED_STYLE_PROPS, sanitizeHtml } from '../../../utils/security';
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
                ADD_TAGS: ['script', 'iframe', 'ins', 'div', 'span', 'a', 'img'],
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
                styleAllowlist: AD_ALLOWED_STYLE_PROPS,
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
    iframe.style.maxWidth = '100%';
    iframe.style.minWidth = '0';
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
      const height = Number(event.data?.height);
      if (event.data?.type === 'adHeight' && Number.isFinite(height) && height > 0 && iframe) {
        iframe.style.height = Math.ceil(height) + 'px';
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
            html, body {
              width: 100%;
              max-width: 100%;
              min-width: 0;
              margin: 0;
              padding: 0;
              overflow: hidden;
              box-sizing: border-box;
            }

            *, *::before, *::after {
              box-sizing: border-box;
              max-width: 100%;
            }

            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 1px;
            }

            img, iframe, ins, div, span, a {
              max-width: 100%;
              min-width: 0;
            }

            img {
              height: auto;
            }

            iframe, ins {
              display: block;
              margin-left: auto;
              margin-right: auto;
            }

            ins {
              width: 100% !important;
            }
          </style>
        </head>
        <body>
          ${safeContent}
          <script>
            const updateHeight = () => {
              const height = Math.ceil(Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight
              ));
              if (height > 0 && window.parent) {
                window.parent.postMessage({ type: 'adHeight', height: height }, '*');
              }
            };
            window.onload = () => requestAnimationFrame(updateHeight);
            requestAnimationFrame(updateHeight);
            window.setTimeout(updateHeight, 100);
            window.setTimeout(updateHeight, 500);
            window.setTimeout(updateHeight, 1000);
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
      minWidth: '0',
      overflow: 'hidden',
      margin: '0 auto',
      boxSizing: 'border-box' as const,
    },
  };

  // If NO scripts, render directly to allow theme CSS integration
  if (!hasExecutable) {
    return (
      <div
        {...wrapperProps}
        className={`${wrapperProps.className} [&_*]:box-border [&_*]:min-w-0 [&_a]:inline-block [&_a]:max-w-full [&_div]:max-w-full [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:align-middle [&_img]:inline-block [&_img]:h-auto [&_img]:max-w-full [&_ins]:inline-block [&_ins]:w-full [&_ins]:max-w-full`}
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
