<?php
/**
 * VonCMS - Responsive Media Helpers
 */

function voncms_get_responsive_widths(int $maxWidth = 1920): array
{
  $maxWidth = max(1, $maxWidth);
  $candidates = [480, 960, 1920];
  $widths = [];

  foreach ($candidates as $candidate) {
    if ($candidate < $maxWidth) {
      $widths[] = $candidate;
    }
  }

  $widths[] = $maxWidth;
  $widths = array_values(array_unique(array_map('intval', $widths)));
  sort($widths, SORT_NUMERIC);

  return $widths;
}

function voncms_build_responsive_variant_relative_path(string $relativePath, int $width): string
{
  $pathInfo = pathinfo($relativePath);
  $dirname = ($pathInfo['dirname'] ?? '.') !== '.' ? rtrim($pathInfo['dirname'], '/\\') . '/' : '';

  return $dirname . $pathInfo['filename'] . '_' . $width . 'w.' . $pathInfo['extension'];
}

function voncms_build_responsive_variant_url(string $imageUrl, int $width): string
{
  $imageUrl = trim($imageUrl);
  if ($imageUrl === '') {
    return '';
  }

  if (preg_match('~^https?://~i', $imageUrl)) {
    $parts = parse_url($imageUrl);
    if (!$parts || empty($parts['path'])) {
      return ResponseHelper::scrubUrl($imageUrl);
    }

    $pathInfo = pathinfo($parts['path']);
    $dirname =
      ($pathInfo['dirname'] ?? '.') !== '.' ? rtrim($pathInfo['dirname'], '/\\') . '/' : '';
    $variantPath = $dirname . $pathInfo['filename'] . '_' . $width . 'w.' . $pathInfo['extension'];

    $rebuilt = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
    if (!empty($parts['port'])) {
      $rebuilt .= ':' . $parts['port'];
    }
    $rebuilt .= $variantPath;
    if (!empty($parts['query'])) {
      $rebuilt .= '?' . $parts['query'];
    }
    if (!empty($parts['fragment'])) {
      $rebuilt .= '#' . $parts['fragment'];
    }

    return ResponseHelper::scrubUrl($rebuilt);
  }

  $pathPart = $imageUrl;
  $query = '';
  $fragment = '';

  $fragmentPos = strpos($pathPart, '#');
  if ($fragmentPos !== false) {
    $fragment = substr($pathPart, $fragmentPos);
    $pathPart = substr($pathPart, 0, $fragmentPos);
  }

  $queryPos = strpos($pathPart, '?');
  if ($queryPos !== false) {
    $query = substr($pathPart, $queryPos);
    $pathPart = substr($pathPart, 0, $queryPos);
  }

  $pathInfo = pathinfo($pathPart);
  $dirname = ($pathInfo['dirname'] ?? '.') !== '.' ? rtrim($pathInfo['dirname'], '/\\') . '/' : '';
  $variantPath = $dirname . $pathInfo['filename'] . '_' . $width . 'w.' . $pathInfo['extension'];

  return ResponseHelper::scrubUrl($variantPath . $query . $fragment);
}

function voncms_resolve_upload_relative_path(?string $imagePath): ?string
{
  $imagePath = trim((string) $imagePath);
  if ($imagePath === '' || preg_match('~^data:~i', $imagePath)) {
    return null;
  }

  $pathPart = preg_match('~^https?://~i', $imagePath)
    ? (parse_url($imagePath, PHP_URL_PATH) ?:
    '')
    : $imagePath;

  $pathPart = str_replace('\\', '/', $pathPart);

  $uploadsPos = stripos($pathPart, '/uploads/');
  if ($uploadsPos !== false) {
    $pathPart = substr($pathPart, $uploadsPos + 9);
  } elseif (strpos($pathPart, 'uploads/') === 0) {
    $pathPart = substr($pathPart, 8);
  } else {
    return null;
  }

  return ltrim($pathPart, '/');
}

function voncms_normalize_generated_media_variant_uploads_dir(?string $uploadsDir = null): string
{
  $uploadsDir = $uploadsDir !== null ? $uploadsDir : __DIR__ . '/uploads';
  $uploadsDir = rtrim(str_replace('\\', '/', $uploadsDir), '/');
  return $uploadsDir . '/';
}

function voncms_get_generated_media_variant_registry_path(?string $uploadsDir = null): string
{
  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  $publicDir = rtrim(str_replace('\\', '/', dirname(rtrim($normalizedUploadsDir, '/'))), '/');
  return $publicDir . '/data/generated_media_variants.php';
}

function voncms_get_generated_media_variant_registry_lock_path(?string $uploadsDir = null): string
{
  return dirname(voncms_get_generated_media_variant_registry_path($uploadsDir)) .
    '/generated_media_variants.lock';
}

/**
 * @return resource|false
 */
function voncms_acquire_generated_media_variant_registry_lock(
  ?string $uploadsDir = null,
  int $operation = LOCK_SH,
) {
  $lockPath = voncms_get_generated_media_variant_registry_lock_path($uploadsDir);
  $lockDir = dirname($lockPath);
  if (!is_dir($lockDir) && !@mkdir($lockDir, 0755, true) && !is_dir($lockDir)) {
    return false;
  }

  $handle = @fopen($lockPath, 'c+');
  if ($handle === false || !flock($handle, $operation)) {
    if (is_resource($handle)) {
      fclose($handle);
    }
    return false;
  }

  return $handle;
}

/**
 * @param resource|false $handle
 */
function voncms_release_generated_media_variant_registry_lock($handle): void
{
  if (is_resource($handle)) {
    flock($handle, LOCK_UN);
    fclose($handle);
  }
}

function voncms_normalize_generated_media_variant_relative_path(?string $path): ?string
{
  $relativePath = voncms_resolve_upload_relative_path($path);
  if ($relativePath !== null) {
    return ltrim(str_replace('\\', '/', $relativePath), '/');
  }

  $path = ltrim(str_replace('\\', '/', trim((string) $path)), '/');
  return $path !== '' ? $path : null;
}

function voncms_normalize_generated_media_variant_registry(array $registry): array
{
  $normalized = [
    'version' => 1,
    'sources' => [],
    'variants' => [],
  ];

  $sources = $registry['sources'] ?? [];
  if (!is_array($sources)) {
    return $normalized;
  }

  foreach ($sources as $sourcePath => $sourceEntry) {
    $normalizedSourcePath = voncms_normalize_generated_media_variant_relative_path(
      (string) $sourcePath,
    );
    if ($normalizedSourcePath === null) {
      continue;
    }

    $sourceEntry = is_array($sourceEntry) ? $sourceEntry : [];
    $variantEntries = $sourceEntry['variants'] ?? [];
    if (!is_array($variantEntries)) {
      $variantEntries = [];
    }

    $normalizedVariantEntries = [];
    foreach ($variantEntries as $variantPath => $variantEntry) {
      $candidateVariantPath = is_string($variantPath)
        ? $variantPath
        : (is_array($variantEntry)
          ? (string) ($variantEntry['path'] ?? '')
          : (string) $variantEntry);
      $normalizedVariantPath = voncms_normalize_generated_media_variant_relative_path(
        $candidateVariantPath,
      );
      if ($normalizedVariantPath === null) {
        continue;
      }

      $variantEntry = is_array($variantEntry) ? $variantEntry : [];
      $hash = strtolower(trim((string) ($variantEntry['hash'] ?? '')));
      $size = isset($variantEntry['size']) ? (int) $variantEntry['size'] : null;

      $normalizedVariantEntries[$normalizedVariantPath] = [
        'hash' => $hash,
        'size' => $size,
      ];
      $normalized['variants'][$normalizedVariantPath] = [
        'source' => $normalizedSourcePath,
        'hash' => $hash,
        'size' => $size,
      ];
    }

    $normalized['sources'][$normalizedSourcePath] = [
      'updatedAt' => trim((string) ($sourceEntry['updatedAt'] ?? '')),
      'variants' => $normalizedVariantEntries,
    ];
  }

  ksort($normalized['sources'], SORT_STRING);
  ksort($normalized['variants'], SORT_STRING);

  return $normalized;
}

function voncms_load_generated_media_variant_registry_file(string $registryPath): array
{
  $registry = [];
  if (is_file($registryPath)) {
    try {
      $loaded = @include $registryPath;
      if (is_array($loaded)) {
        $registry = $loaded;
      }
    } catch (Throwable $e) {
      error_log('Generated media variant registry read failed: ' . $e->getMessage());
    }
  }

  return voncms_normalize_generated_media_variant_registry($registry);
}

function voncms_load_generated_media_variant_registry(?string $uploadsDir = null): array
{
  $registryPath = voncms_get_generated_media_variant_registry_path($uploadsDir);
  if (
    isset($GLOBALS['voncms_generated_media_variant_registry_cache'][$registryPath]) &&
    is_array($GLOBALS['voncms_generated_media_variant_registry_cache'][$registryPath])
  ) {
    return $GLOBALS['voncms_generated_media_variant_registry_cache'][$registryPath];
  }

  $lockHandle = voncms_acquire_generated_media_variant_registry_lock($uploadsDir, LOCK_SH);
  if ($lockHandle === false) {
    return voncms_normalize_generated_media_variant_registry([]);
  }

  try {
    $normalized = voncms_load_generated_media_variant_registry_file($registryPath);
  } finally {
    voncms_release_generated_media_variant_registry_lock($lockHandle);
  }

  if (!isset($GLOBALS['voncms_generated_media_variant_registry_cache'])) {
    $GLOBALS['voncms_generated_media_variant_registry_cache'] = [];
  }
  $GLOBALS['voncms_generated_media_variant_registry_cache'][$registryPath] = $normalized;

  return $normalized;
}

/**
 * @param resource $handle
 */
function voncms_write_generated_media_variant_registry_bytes($handle, string $content): bool
{
  $length = strlen($content);
  $written = 0;
  while ($written < $length) {
    $result = fwrite($handle, substr($content, $written));
    if ($result === false || $result === 0) {
      return false;
    }
    $written += $result;
  }

  return $written === $length && fflush($handle);
}

function voncms_write_generated_media_variant_registry_unlocked(
  array $registry,
  ?string $uploadsDir = null,
): bool {
  $registryPath = voncms_get_generated_media_variant_registry_path($uploadsDir);
  $registryDir = dirname($registryPath);
  if (!is_dir($registryDir) && !@mkdir($registryDir, 0755, true) && !is_dir($registryDir)) {
    return false;
  }

  $normalized = voncms_normalize_generated_media_variant_registry($registry);
  $content = "<?php\nreturn " . var_export($normalized, true) . ";\n";

  try {
    $suffix = bin2hex(random_bytes(8));
  } catch (Throwable $e) {
    $suffix = str_replace('.', '', uniqid('', true));
  }

  $tempPath = $registryPath . '.tmp.' . $suffix;
  $handle = @fopen($tempPath, 'xb');
  if ($handle === false) {
    return false;
  }

  $writeOk = false;
  try {
    $writeOk = voncms_write_generated_media_variant_registry_bytes($handle, $content);
    if ($writeOk && function_exists('fsync')) {
      $writeOk = fsync($handle);
    }
  } finally {
    $closeOk = fclose($handle);
    $writeOk = $writeOk && $closeOk;
  }

  clearstatcache(true, $tempPath);
  if (!$writeOk || !is_file($tempPath) || filesize($tempPath) !== strlen($content)) {
    @unlink($tempPath);
    return false;
  }

  if (!@rename($tempPath, $registryPath)) {
    $targetHandle = @fopen($registryPath, 'c+b');
    if ($targetHandle === false) {
      @unlink($tempPath);
      return false;
    }

    $fallbackOk = false;
    try {
      $fallbackOk = ftruncate($targetHandle, 0);
      if ($fallbackOk) {
        rewind($targetHandle);
        $fallbackOk = voncms_write_generated_media_variant_registry_bytes($targetHandle, $content);
      }
      if ($fallbackOk && function_exists('fsync')) {
        $fallbackOk = fsync($targetHandle);
      }
    } finally {
      $closeOk = fclose($targetHandle);
      $fallbackOk = $fallbackOk && $closeOk;
      @unlink($tempPath);
    }

    clearstatcache(true, $registryPath);
    if (!$fallbackOk || !is_file($registryPath) || filesize($registryPath) !== strlen($content)) {
      return false;
    }
  }

  @chmod($registryPath, 0640);
  if (!isset($GLOBALS['voncms_generated_media_variant_registry_cache'])) {
    $GLOBALS['voncms_generated_media_variant_registry_cache'] = [];
  }
  $GLOBALS['voncms_generated_media_variant_registry_cache'][$registryPath] = $normalized;

  return true;
}

function voncms_write_generated_media_variant_registry(
  array $registry,
  ?string $uploadsDir = null,
): bool {
  $lockHandle = voncms_acquire_generated_media_variant_registry_lock($uploadsDir, LOCK_EX);
  if ($lockHandle === false) {
    return false;
  }

  try {
    return voncms_write_generated_media_variant_registry_unlocked($registry, $uploadsDir);
  } finally {
    voncms_release_generated_media_variant_registry_lock($lockHandle);
  }
}

function voncms_build_generated_media_variant_registry_entry(string $absoluteVariantPath): ?array
{
  $absoluteVariantPath = str_replace('\\', '/', $absoluteVariantPath);
  if (!is_file($absoluteVariantPath)) {
    return null;
  }

  $hash = @sha1_file($absoluteVariantPath);
  if (!is_string($hash) || $hash === '') {
    return null;
  }

  return [
    'hash' => strtolower($hash),
    'size' => (int) filesize($absoluteVariantPath),
  ];
}

function voncms_record_generated_media_variants(
  string $sourcePath,
  array $variantPaths,
  ?string $uploadsDir = null,
): bool {
  $sourceRelativePath = voncms_normalize_generated_media_variant_relative_path($sourcePath);
  if ($sourceRelativePath === null) {
    return false;
  }

  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  $lockHandle = voncms_acquire_generated_media_variant_registry_lock(
    $normalizedUploadsDir,
    LOCK_EX,
  );
  if ($lockHandle === false) {
    return false;
  }

  try {
    $registryPath = voncms_get_generated_media_variant_registry_path($normalizedUploadsDir);
    $registry = voncms_load_generated_media_variant_registry_file($registryPath);
    $sourceEntry = $registry['sources'][$sourceRelativePath] ?? ['variants' => []];
    $sourceVariants = is_array($sourceEntry['variants'] ?? null) ? $sourceEntry['variants'] : [];

    foreach (array_keys($sourceVariants) as $existingVariantRelativePath) {
      $variantEntry = $registry['variants'][$existingVariantRelativePath] ?? null;
      $absoluteVariantPath = $normalizedUploadsDir . $existingVariantRelativePath;
      $expectedHash = is_array($variantEntry)
        ? strtolower(trim((string) ($variantEntry['hash'] ?? '')))
        : '';
      $currentHash = is_file($absoluteVariantPath) ? @sha1_file($absoluteVariantPath) : false;
      if (
        $expectedHash === '' ||
        !is_string($currentHash) ||
        !hash_equals($expectedHash, strtolower($currentHash))
      ) {
        unset($sourceVariants[$existingVariantRelativePath]);
        unset($registry['variants'][$existingVariantRelativePath]);
      }
    }

    foreach ($variantPaths as $variantPath) {
      $variantRelativePath = voncms_normalize_generated_media_variant_relative_path(
        (string) $variantPath,
      );
      if ($variantRelativePath === null || $variantRelativePath === $sourceRelativePath) {
        continue;
      }

      $variantEntry = voncms_build_generated_media_variant_registry_entry(
        $normalizedUploadsDir . $variantRelativePath,
      );
      if ($variantEntry === null) {
        continue;
      }

      $previousSourcePath = (string) ($registry['variants'][$variantRelativePath]['source'] ?? '');
      if (
        $previousSourcePath !== '' &&
        $previousSourcePath !== $sourceRelativePath &&
        isset($registry['sources'][$previousSourcePath]['variants'][$variantRelativePath])
      ) {
        unset($registry['sources'][$previousSourcePath]['variants'][$variantRelativePath]);
        if (empty($registry['sources'][$previousSourcePath]['variants'])) {
          unset($registry['sources'][$previousSourcePath]);
        }
      }

      $sourceVariants[$variantRelativePath] = $variantEntry;
      $registry['variants'][$variantRelativePath] = [
        'source' => $sourceRelativePath,
        'hash' => $variantEntry['hash'],
        'size' => $variantEntry['size'],
      ];
    }

    if (empty($sourceVariants)) {
      return false;
    }

    ksort($sourceVariants, SORT_STRING);
    $registry['sources'][$sourceRelativePath] = [
      'updatedAt' => gmdate('c'),
      'variants' => $sourceVariants,
    ];

    return voncms_write_generated_media_variant_registry_unlocked($registry, $normalizedUploadsDir);
  } finally {
    voncms_release_generated_media_variant_registry_lock($lockHandle);
  }
}

function voncms_unregister_generated_media_variants_for_source(
  string $sourcePath,
  ?string $uploadsDir = null,
): bool {
  $sourceRelativePath = voncms_normalize_generated_media_variant_relative_path($sourcePath);
  if ($sourceRelativePath === null) {
    return false;
  }

  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  $lockHandle = voncms_acquire_generated_media_variant_registry_lock(
    $normalizedUploadsDir,
    LOCK_EX,
  );
  if ($lockHandle === false) {
    return false;
  }

  try {
    $registryPath = voncms_get_generated_media_variant_registry_path($normalizedUploadsDir);
    $registry = voncms_load_generated_media_variant_registry_file($registryPath);
    $sourceEntry = $registry['sources'][$sourceRelativePath] ?? null;
    if (!is_array($sourceEntry)) {
      return true;
    }

    foreach (array_keys($sourceEntry['variants'] ?? []) as $variantRelativePath) {
      unset($registry['variants'][$variantRelativePath]);
    }
    unset($registry['sources'][$sourceRelativePath]);

    return voncms_write_generated_media_variant_registry_unlocked($registry, $normalizedUploadsDir);
  } finally {
    voncms_release_generated_media_variant_registry_lock($lockHandle);
  }
}

function voncms_unregister_generated_media_variant_paths(
  array $variantPaths,
  ?string $uploadsDir = null,
): bool {
  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  $lockHandle = voncms_acquire_generated_media_variant_registry_lock(
    $normalizedUploadsDir,
    LOCK_EX,
  );
  if ($lockHandle === false) {
    return false;
  }

  try {
    $registryPath = voncms_get_generated_media_variant_registry_path($normalizedUploadsDir);
    $registry = voncms_load_generated_media_variant_registry_file($registryPath);
    $changed = false;

    foreach ($variantPaths as $variantPath) {
      $variantRelativePath = voncms_normalize_generated_media_variant_relative_path(
        (string) $variantPath,
      );
      if ($variantRelativePath === null || !isset($registry['variants'][$variantRelativePath])) {
        continue;
      }

      $sourceRelativePath = (string) ($registry['variants'][$variantRelativePath]['source'] ?? '');
      unset($registry['variants'][$variantRelativePath]);

      if (
        $sourceRelativePath !== '' &&
        isset($registry['sources'][$sourceRelativePath]['variants'][$variantRelativePath])
      ) {
        unset($registry['sources'][$sourceRelativePath]['variants'][$variantRelativePath]);
        if (empty($registry['sources'][$sourceRelativePath]['variants'])) {
          unset($registry['sources'][$sourceRelativePath]);
        } else {
          $registry['sources'][$sourceRelativePath]['updatedAt'] = gmdate('c');
        }
      }

      $changed = true;
    }

    return !$changed ||
      voncms_write_generated_media_variant_registry_unlocked($registry, $normalizedUploadsDir);
  } finally {
    voncms_release_generated_media_variant_registry_lock($lockHandle);
  }
}

function voncms_get_registered_generated_media_variants_for_source(
  string $sourcePath,
  ?string $uploadsDir = null,
): array {
  $sourceRelativePath = voncms_normalize_generated_media_variant_relative_path($sourcePath);
  if ($sourceRelativePath === null) {
    return [];
  }

  $registry = voncms_load_generated_media_variant_registry($uploadsDir);
  $variantEntries = $registry['sources'][$sourceRelativePath]['variants'] ?? [];
  $variantPaths = array_keys(is_array($variantEntries) ? $variantEntries : []);
  sort($variantPaths, SORT_STRING);

  return $variantPaths;
}

function voncms_is_registered_generated_media_variant(
  string $path,
  ?string $uploadsDir = null,
): bool {
  $variantRelativePath = voncms_normalize_generated_media_variant_relative_path($path);
  if ($variantRelativePath === null) {
    return false;
  }

  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  $registry = voncms_load_generated_media_variant_registry($normalizedUploadsDir);
  $variantEntry = $registry['variants'][$variantRelativePath] ?? null;
  if (!is_array($variantEntry)) {
    return false;
  }

  $expectedHash = strtolower(trim((string) ($variantEntry['hash'] ?? '')));
  if ($expectedHash === '') {
    return false;
  }

  $absolutePath = $normalizedUploadsDir . $variantRelativePath;
  if (!is_file($absolutePath)) {
    return false;
  }

  $currentHash = @sha1_file($absolutePath);
  return is_string($currentHash) && $currentHash !== ''
    ? hash_equals($expectedHash, strtolower($currentHash))
    : false;
}

function voncms_collect_registered_generated_media_variant_inventory(
  ?string $uploadsDir = null,
): array {
  $normalizedUploadsDir = voncms_normalize_generated_media_variant_uploads_dir($uploadsDir);
  if (!is_dir($normalizedUploadsDir)) {
    return [
      'uploadsDir' => null,
      'sources' => [],
      'variants' => [],
    ];
  }

  $registry = voncms_load_generated_media_variant_registry($normalizedUploadsDir);
  $sources = [];
  $variants = [];

  foreach ($registry['variants'] as $variantRelativePath => $variantEntry) {
    if (
      !voncms_is_registered_generated_media_variant($variantRelativePath, $normalizedUploadsDir)
    ) {
      continue;
    }

    $absolutePath = $normalizedUploadsDir . $variantRelativePath;
    $sourceRelativePath = (string) ($variantEntry['source'] ?? '');
    if ($sourceRelativePath !== '') {
      $sources[$sourceRelativePath] = $sourceRelativePath;
    }

    $variants[$variantRelativePath] = [
      'path' => $variantRelativePath,
      'source' => $sourceRelativePath,
      'size' => (int) filesize($absolutePath),
      'modified' => date('Y-m-d H:i:s', filemtime($absolutePath)),
    ];
  }

  ksort($sources, SORT_STRING);
  ksort($variants, SORT_STRING);

  return [
    'uploadsDir' => $normalizedUploadsDir,
    'sources' => array_values($sources),
    'variants' => array_values($variants),
  ];
}

function voncms_build_responsive_image_data(
  ?string $imagePath,
  string $uploadsDir,
  ?array $widths = null,
): array {
  $imagePath = trim((string) $imagePath);
  if ($imagePath === '') {
    return ['srcSet' => null, 'candidates' => []];
  }

  $relativePath = voncms_resolve_upload_relative_path($imagePath);
  if ($relativePath === null) {
    return ['srcSet' => null, 'candidates' => []];
  }

  $uploadsDir = rtrim(str_replace('\\', '/', $uploadsDir), '/') . '/';
  $absolutePath = $uploadsDir . $relativePath;
  if (!file_exists($absolutePath)) {
    return ['srcSet' => null, 'candidates' => []];
  }

  $widths = $widths ?: voncms_get_responsive_widths();
  $candidatesByWidth = [];

  foreach ($widths as $width) {
    $width = (int) $width;
    if ($width <= 0) {
      continue;
    }

    $variantRelativePath = voncms_build_responsive_variant_relative_path($relativePath, $width);
    $variantAbsolutePath = $uploadsDir . $variantRelativePath;
    if (file_exists($variantAbsolutePath)) {
      $candidatesByWidth[$width] = voncms_build_responsive_variant_url($imagePath, $width);
    }
  }

  $imageInfo = @getimagesize($absolutePath);
  if (is_array($imageInfo) && !empty($imageInfo[0])) {
    $candidatesByWidth[(int) $imageInfo[0]] = ResponseHelper::scrubUrl($imagePath);
  }

  if (count($candidatesByWidth) < 2) {
    return ['srcSet' => null, 'candidates' => []];
  }

  ksort($candidatesByWidth, SORT_NUMERIC);
  $parts = [];
  $candidates = [];
  foreach ($candidatesByWidth as $width => $url) {
    $parts[] = $url . ' ' . $width . 'w';
    $candidates[] = ['width' => $width, 'url' => $url];
  }

  return [
    'srcSet' => implode(', ', $parts),
    'candidates' => $candidates,
  ];
}
