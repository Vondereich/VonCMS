import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readThemeStartup, type ThemeStartup } from './src/themes/shared/themeSettings.ts';
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env['VITE_PROXY_TARGET'] || '';

  return {
    plugins: [
      react(),
      {
        name: 'public-theme-startup',
        transformIndexHtml(html) {
          const marker = '<!-- Public theme startup metadata -->';
          if (!html.includes(marker)) return html;
          const startups: Record<string, ThemeStartup> = {};
          const themesDir = join(import.meta.dirname, 'src/themes');
          for (const directory of readdirSync(themesDir, { withFileTypes: true })) {
            if (!directory.isDirectory()) continue;
            try {
              const file = join(themesDir, directory.name, 'theme.json');
              if (statSync(file).size > 16384) continue;
              const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'));
              if (
                !manifest ||
                typeof manifest !== 'object' ||
                !('id' in manifest) ||
                typeof manifest.id !== 'string' ||
                !/^theme-[a-z0-9][a-z0-9-]*$/.test(manifest.id)
              )
                continue;
              const startup = readThemeStartup(manifest);
              if (startup) startups[manifest.id] = startup;
            } catch {
              // Missing/invalid metadata retains the ordinary startup canvas.
            }
          }
          return html.replace(
            marker,
            '<script>window.__PUBLIC_THEME_STARTUP__=' + JSON.stringify(startups) + ';</script>'
          );
        },
      },
    ],
    base: './', // Relative path for universal deployment
    server: {
      proxy: {
        // Proxy to backend (XAMPP/WAMP/etc)
        '/api': {
          target: proxyTarget || 'http://localhost',
          changeOrigin: true,
          secure: false,
        },
        // Also proxy uploads so images work
        '/uploads': {
          target: proxyTarget || 'http://localhost',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (id.includes('src/utils/security.ts')) {
              return 'security-core';
            }
            if (id.includes('node_modules')) {
              // Heavy admin-only libraries - split for better caching
              if (
                normalizedId.includes('/node_modules/@tiptap/') ||
                normalizedId.includes('/node_modules/prosemirror-') ||
                normalizedId.includes('/node_modules/orderedmap/') ||
                normalizedId.includes('/node_modules/rope-sequence/') ||
                normalizedId.includes('/node_modules/w3c-keyname/')
              ) {
                return 'vendor-editor';
              }
              if (id.includes('@google/genai')) return 'vendor-ai';
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('lucide-react')) {
                if (normalizedId.includes('/dist/esm/icons/')) {
                  const iconPath = normalizedId.split('/dist/esm/icons/')[1] || '';
                  const firstChar = iconPath.charAt(0).toLowerCase();

                  if (firstChar >= 'a' && firstChar <= 'f') return 'vendor-icons-a-f';
                  if (firstChar >= 'g' && firstChar <= 'l') return 'vendor-icons-g-l';
                  if (firstChar >= 'm' && firstChar <= 'r') return 'vendor-icons-m-r';
                  return 'vendor-icons-s-z';
                }
                return undefined;
              }
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
