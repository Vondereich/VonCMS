import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'vendor/**',
    'dist/**',
    'public/assets/**',
    'backups/**',
    '.agents/**',
    '.codex/**',
  ]),
  { files: ['**/*.{js,cjs,mjs,jsx}'], extends: [js.configs.recommended] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Underscored compatibility parameters and rest omissions are intentional.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: ['server/**', '*.{js,cjs,mjs,ts}'], languageOptions: { globals: globals.node } },
  // This harness intentionally evaluates callbacks in a real browser as well as Node.
  { files: ['server/test-security-hardening.cjs'], languageOptions: { globals: globals.browser } },
]);
