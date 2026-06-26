<?php
/**
 * VonCMS Root Entry Point
 * Smart Delegator: Prioritizes production build (dist) over source (public)
 * to ensure assets load correctly.
 */

// 1. Production Build (Best Option)
// If dist/index.php exists, use it because it sits next to compiled assets (dist/assets)
if (file_exists(__DIR__ . '/dist/index.php')) {
  // Use the PHP SEO Engine (Fixes Soft 404 & Redirect Loop)
  define('VON_ROOT_SHIM', true);
  require_once __DIR__ . '/dist/index.php';
  exit();
}

// 2. Source Fallback (Dev / API Only)
// If dist is missing (e.g. fresh clone), fallback to public/index.php
// Warning: Assets might be missing here if not built!
if (file_exists(__DIR__ . '/public/index.php')) {
  define('VON_ROOT_SHIM', true);
  require_once __DIR__ . '/public/index.php';
} else {
  // 3. Critical Error
  http_response_code(500);
  echo '<h1>VonCMS System Error</h1><p>Master Engine not found. Please run <code>npm run build</code> to generate the dist folder.</p>';
}
