<?php

require_once __DIR__ . '/../media_variants.php';

function voncms_normalize_media_library_path(string $path): string
{
  $path = str_replace('\\', '/', trim($path));
  if ($path === '') {
    return '';
  }

  if (preg_match('~^https?://~i', $path)) {
    $path = (string) (parse_url($path, PHP_URL_PATH) ?? '');
  }

  $uploadsPos = stripos($path, '/uploads/');
  if ($uploadsPos !== false) {
    $path = substr($path, $uploadsPos + 9);
  } elseif (strpos($path, 'uploads/') === 0) {
    $path = substr($path, 8);
  }

  $path = ltrim(preg_replace('#/+#', '/', $path) ?? $path, '/');
  return $path;
}

function voncms_is_generated_media_variant_path(string $path, ?string $uploadsDir = null): bool
{
  $relativePath = voncms_normalize_media_library_path($path);
  if ($relativePath === '') {
    return false;
  }

  $normalizedUploadsDir = $uploadsDir
    ? rtrim(str_replace('\\', '/', $uploadsDir), '/') . '/'
    : dirname(__DIR__) . '/uploads/';

  return voncms_is_registered_generated_media_variant($relativePath, $normalizedUploadsDir);
}

function voncms_is_generated_media_variant(string $fullPath): bool
{
  return voncms_is_generated_media_variant_path($fullPath, dirname(__DIR__) . '/uploads/');
}
