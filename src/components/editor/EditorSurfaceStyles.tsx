import { EDITOR_SURFACE_CLASS } from './editorExtensions';

export const EditorSurfaceStyles = () => (
  <style>{`
        .editor-content .${EDITOR_SURFACE_CLASS} {
          min-height: 320px;
          padding: 1.5rem 1.25rem 4rem;
          outline: none;
          color: #0f172a;
          line-height: 1.75;
          caret-color: #2563eb;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > *:first-child { margin-top: 0; }
        .editor-content .${EDITOR_SURFACE_CLASS} > *:last-child { margin-bottom: 0; }
        .editor-content .${EDITOR_SURFACE_CLASS} p { margin-bottom: 1rem; }
        .editor-content .${EDITOR_SURFACE_CLASS} a {
          color: #0284c7;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} ul {
          list-style: disc;
          list-style-position: outside;
          margin: 1rem 0 1rem 1.5rem;
          padding-left: 1.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} ol {
          list-style: decimal;
          list-style-position: outside;
          margin: 1rem 0 1rem 1.5rem;
          padding-left: 1.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} li {
          margin: 0.35rem 0;
          padding-left: 0.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} blockquote {
          border-left: 4px solid #3b82f6;
          background: #eff6ff;
          color: #475569;
          font-style: italic;
          margin: 1.25rem 0;
          padding: 0.85rem 1rem;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} pre {
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
        .editor-content .${EDITOR_SURFACE_CLASS} code {
          background: #f1f5f9;
          color: #b45309;
          border-radius: 0.375rem;
          padding: 0.15rem 0.35rem;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', monospace;
          font-size: 0.9em;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} pre code {
          background: transparent;
          color: inherit;
          border-radius: 0;
          padding: 0;
          font-size: inherit;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > figure,
        .editor-content .${EDITOR_SURFACE_CLASS} > img,
        .editor-content .${EDITOR_SURFACE_CLASS} > iframe {
          margin: 1.5rem 0;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} figure {
          max-width: 100%;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} figure img {
          margin-top: 0;
          margin-bottom: 0;
          width: revert-layer;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          overflow: hidden;
          border-radius: 0.75rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} th,
        .editor-content .${EDITOR_SURFACE_CLASS} td {
          border: 1px solid #cbd5e1;
          padding: 0.75rem;
          vertical-align: top;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} th {
          background: #f8fafc;
          font-weight: 700;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > p:first-child:last-child:has(> br.ProseMirror-trailingBreak)::before {
          content: 'Start Writing';
          color: #cbd5e1;
          float: left;
          height: 0;
          pointer-events: none;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: inherit;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} img { cursor: pointer; }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} {
          color: #e2e8f0;
          caret-color: #60a5fa;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} a { color: #38bdf8; }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} blockquote {
          background: var(--color-admin-canvas);
          color: #cbd5e1;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} pre {
          background: var(--color-admin-inset);
          color: #e2e8f0;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} code {
          background: var(--color-admin-hover);
          color: #fbbf24;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} pre code {
          background: transparent;
          color: inherit;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} th,
        .dark .editor-content .${EDITOR_SURFACE_CLASS} td {
          border-color: var(--color-admin-border-strong);
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} th {
          background: var(--color-admin-hover);
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} > p:first-child:last-child:has(> br.ProseMirror-trailingBreak)::before {
          color: #475569;
        }
        @media (min-width: 640px) {
          .editor-content .${EDITOR_SURFACE_CLASS} {
            padding: 1.75rem 1.5rem 4rem;
          }
        }
        /* Theme-aware colours and matching top corners; keep the existing toolbar layout. */
        .editor-toolbar {
          --editor-toolbar-bg: #f1f3f5;
          --editor-control-bg: #ffffff;
          --editor-control-border: #cfd4d9;
          --editor-control-text: #303236;
          --editor-divider: #cbd0d5;
          --editor-focus: #657b30;
          background-color: var(--editor-toolbar-bg);
          border-color: #d5dade;
          border-top-left-radius: inherit;
          border-top-right-radius: inherit;
          --tw-shadow-color: rgb(0 0 0 / 0.1);
          --tw-ring-color: rgb(48 50 54 / 0.1);
        }
        .dark .editor-toolbar {
          --editor-toolbar-bg: #303236;
          --editor-control-bg: #3a3d42;
          --editor-control-border: #51555a;
          --editor-control-text: #e2e8f0;
          --editor-divider: #62666c;
          --editor-focus: #c3f63c;
          border-color: #4b4e52;
          --tw-shadow-color: rgb(0 0 0 / 0.2);
          --tw-ring-color: rgb(255 255 255 / 0.1);
        }
        .editor-toolbar > button,
        .editor-toolbar > div > button,
        .editor-toolbar > select {
          background-color: var(--editor-control-bg);
          border-color: var(--editor-control-border);
          color: var(--editor-control-text);
        }
        .editor-toolbar > button > svg,
        .editor-toolbar > div > button > svg {
          color: inherit;
        }
        .editor-toolbar > button:hover,
        .editor-toolbar > div > button:hover {
          background-color: #c3f63c;
          border-color: #c3f63c;
          color: #20252b;
        }
        .editor-toolbar > button:focus-visible,
        .editor-toolbar > div > button:focus-visible,
        .editor-toolbar > select:focus {
          border-color: var(--editor-focus);
          outline-color: var(--editor-focus);
          --tw-ring-color: rgb(195 246 60 / 0.25);
        }
        .editor-toolbar > .w-px {
          background-color: var(--editor-divider);
        }
        .editor-content h1 { font-size: 2.25rem !important; font-weight: 800; line-height: 1.2; margin-bottom: 0.8em; }
        .editor-content h2 { font-size: 1.875rem !important; font-weight: 700; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.6em; }
        .editor-content h3 { font-size: 1.5rem !important; font-weight: 600; line-height: 1.4; margin-top: 1.2em; margin-bottom: 0.5em; }
        .editor-content h4 { font-size: 1.25rem !important; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
        .editor-content h5 { font-size: 1.125rem !important; font-weight: 600; text-transform: uppercase; color: #64748b; margin-top: 1em; margin-bottom: 0.4em; }
        .editor-content h6 { font-size: 1rem !important; font-weight: 700; letter-spacing: 0.05em; color: #475569; margin-top: 1em; }
        .dark .editor-content h5 { color: #94a3b8; }
        .dark .editor-content h6 { color: #cbd5e1; }
  `}</style>
);
