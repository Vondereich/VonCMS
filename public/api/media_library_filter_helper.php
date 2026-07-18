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

/**
 * @param mixed $value
 */
function voncms_normalize_media_search($value, int $maxLength = 120): string
{
  if (!is_scalar($value)) {
    return '';
  }

  return mb_substr(trim((string) $value), 0, max(1, $maxLength));
}

function voncms_escape_media_like(string $value): string
{
  return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
}

function voncms_is_safe_media_relative_path(string $path): bool
{
  $normalized = voncms_normalize_media_library_path($path);
  if ($normalized === '' || str_contains($normalized, "\0")) {
    return false;
  }

  foreach (explode('/', $normalized) as $segment) {
    if ($segment === '' || $segment === '.' || $segment === '..') {
      return false;
    }
  }

  return true;
}

function voncms_resolve_media_path_within_uploads(string $path, string $uploadsDir): ?string
{
  $relativePath = voncms_normalize_media_library_path($path);
  if (!voncms_is_safe_media_relative_path($relativePath)) {
    return null;
  }

  $realUploadsDir = realpath($uploadsDir);
  if ($realUploadsDir === false) {
    return null;
  }

  $candidatePath =
    rtrim($realUploadsDir, '/\\') .
    DIRECTORY_SEPARATOR .
    str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
  if (!file_exists($candidatePath)) {
    return $candidatePath;
  }

  $realCandidatePath = realpath($candidatePath);
  if ($realCandidatePath === false) {
    return null;
  }

  $rootPrefix = rtrim(str_replace('\\', '/', $realUploadsDir), '/') . '/';
  $normalizedCandidate = str_replace('\\', '/', $realCandidatePath);
  return str_starts_with($normalizedCandidate, $rootPrefix) ? $realCandidatePath : null;
}

function voncms_is_legacy_generated_media_variant_path(
  string $path,
  ?string $uploadsDir = null,
): bool {
  $relativePath = voncms_normalize_media_library_path($path);
  if ($relativePath === '') {
    return false;
  }

  $pathInfo = pathinfo($relativePath);
  $filename = (string) ($pathInfo['filename'] ?? '');
  $extension = (string) ($pathInfo['extension'] ?? '');
  if ($filename === '' || $extension === '') {
    return false;
  }

  if (!preg_match('/^(.*?)(?:_thumb|_[1-9][0-9]{1,4}w)$/i', $filename, $matches)) {
    return false;
  }

  $sourceFilename = trim((string) ($matches[1] ?? ''));
  if ($sourceFilename === '') {
    return false;
  }

  $sourceRelativePath =
    (($pathInfo['dirname'] ?? '.') !== '.' ? $pathInfo['dirname'] . '/' : '') .
    $sourceFilename .
    '.' .
    $extension;
  $normalizedUploadsDir = $uploadsDir
    ? rtrim(str_replace('\\', '/', $uploadsDir), '/') . '/'
    : dirname(__DIR__) . '/uploads/';

  return is_file($normalizedUploadsDir . $sourceRelativePath);
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

  return voncms_is_registered_generated_media_variant($relativePath, $normalizedUploadsDir) ||
    voncms_is_legacy_generated_media_variant_path($relativePath, $normalizedUploadsDir);
}

function voncms_is_generated_media_variant(string $fullPath): bool
{
  return voncms_is_generated_media_variant_path($fullPath, dirname(__DIR__) . '/uploads/');
}
