import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env['VITE_PROXY_TARGET'] || '';

  return {
    plugins: [react()],
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
