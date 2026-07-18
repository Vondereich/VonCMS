<?php
/**
 * VonCMS - Lightweight Public JSON Cache Helper
 *
 * Server-side cache for guest-safe public JSON responses only. All read/write
 * failures intentionally fail open so public APIs fall back to live database reads.
 */

if (!function_exists('voncms_public_cache_directory')) {
  function voncms_public_cache_directory(): string
  {
    return dirname(__DIR__) . '/data/public-cache';
  }
}

if (!function_exists('voncms_public_cache_normalize_value')) {
  /**
   * @param mixed $value
   * @return mixed
   */
  function voncms_public_cache_normalize_value($value)
  {
    if (is_array($value)) {
      ksort($value);
      $normalized = [];
      foreach ($value as $key => $item) {
        $normalized[(string) $key] = voncms_public_cache_normalize_value($item);
      }
      return $normalized;
    }

    if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
      return $value;
    }

    return trim((string) $value);
  }
}

if (!function_exists('voncms_public_cache_key')) {
  /**
   * @param array<string, mixed> $params
   */
  function voncms_public_cache_key(string $bucket, array $params = []): string
  {
    $safeBucket = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $bucket);
    $safeBucket = trim((string) $safeBucket, '-_');
    if ($safeBucket === '') {
      $safeBucket = 'public-json';
    }

    ksort($params);
    $encoded = json_encode(voncms_public_cache_normalize_value($params));
    if (!is_string($encoded)) {
      $encoded = '';
    }

    return strtolower($safeBucket) . '-' . hash('sha256', $encoded) . '.json';
  }
}

if (!function_exists('voncms_public_cache_path')) {
  function voncms_public_cache_path(string $cacheKey): ?string
  {
    $fileName = basename($cacheKey);
    if ($fileName === '' || !preg_match('/^[a-z0-9_-]+-[a-f0-9]{64}\.json$/', $fileName)) {
      return null;
    }

    return voncms_public_cache_directory() . '/' . $fileName;
  }
}

if (!function_exists('voncms_public_cache_is_known_file')) {
  function voncms_public_cache_is_known_file(string $fileName, bool $includeTemp = true): bool
  {
    if (preg_match('/^[a-z0-9_-]+-[a-f0-9]{64}\.json$/', $fileName) === 1) {
      return true;
    }

    return $includeTemp &&
      preg_match('/^[a-z0-9_-]+-[a-f0-9]{64}\.json\.[a-f0-9]+\.tmp$/', $fileName) === 1;
  }
}

if (!function_exists('voncms_public_cache_prune')) {
  function voncms_public_cache_prune(int $ttlSeconds = 60, int $maxFiles = 250): void
  {
    $cacheDir = voncms_public_cache_directory();
    if (!is_dir($cacheDir)) {
      return;
    }

    $entries = glob($cacheDir . '/*');
    if (!is_array($entries)) {
      return;
    }

    $maxFiles = max(1, $maxFiles);
    $now = time();
    $freshCacheFiles = [];

    foreach ($entries as $entry) {
      $fileName = basename((string) $entry);
      if (!voncms_public_cache_is_known_file($fileName)) {
        continue;
      }

      clearstatcache(true, $entry);
      if (!is_file($entry)) {
        continue;
      }

      $isTempFile = str_ends_with($fileName, '.tmp');
      $modifiedAt = filemtime($entry);
      if ($modifiedAt === false || $isTempFile || $now - $modifiedAt > $ttlSeconds) {
        @unlink($entry);
        continue;
      }

      $freshCacheFiles[] = [
        'path' => (string) $entry,
        'modifiedAt' => $modifiedAt,
      ];
    }

    if (count($freshCacheFiles) <= $maxFiles) {
      return;
    }

    usort(
      $freshCacheFiles,
      static fn(array $left, array $right): int => $left['modifiedAt'] <=> $right['modifiedAt'],
    );

    foreach (array_slice($freshCacheFiles, 0, count($freshCacheFiles) - $maxFiles) as $cacheEntry) {
      @unlink($cacheEntry['path']);
    }
  }
}

if (!function_exists('voncms_public_cache_get')) {
  function voncms_public_cache_get(string $cacheKey, int $ttlSeconds): ?string
  {
    if ($ttlSeconds < 1) {
      return null;
    }

    $cacheFile = voncms_public_cache_path($cacheKey);
    if ($cacheFile === null) {
      return null;
    }

    clearstatcache(true, $cacheFile);
    if (!is_file($cacheFile) || !is_readable($cacheFile)) {
      return null;
    }

    $modifiedAt = filemtime($cacheFile);
    if ($modifiedAt === false || time() - $modifiedAt > $ttlSeconds) {
      @unlink($cacheFile);
      return null;
    }

    $json = file_get_contents($cacheFile);
    if (!is_string($json) || trim($json) === '') {
      return null;
    }

    json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
      return null;
    }

    return $json;
  }
}

if (!function_exists('voncms_public_cache_set')) {
  function voncms_public_cache_set(string $cacheKey, string $json): void
  {
    if (trim($json) === '') {
      return;
    }

    json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
      return;
    }

    $cacheFile = voncms_public_cache_path($cacheKey);
    if ($cacheFile === null) {
      return;
    }

    $cacheDir = dirname($cacheFile);
    if (!is_dir($cacheDir) && !@mkdir($cacheDir, 0755, true) && !is_dir($cacheDir)) {
      return;
    }

    if (!is_writable($cacheDir)) {
      return;
    }

    voncms_public_cache_prune(60, 250);

    $tempFile = null;
    try {
      $tempFile = $cacheFile . '.' . bin2hex(random_bytes(6)) . '.tmp';
      $bytesWritten = @file_put_contents($tempFile, $json, LOCK_EX);
      if ($bytesWritten === false || $bytesWritten !== strlen($json)) {
        return;
      }

      clearstatcache(true, $tempFile);
      if (!is_file($tempFile) || filesize($tempFile) <= 0) {
        return;
      }

      if (!rename($tempFile, $cacheFile)) {
        @unlink($tempFile);
        return;
      }
      voncms_public_cache_prune(60, 250);
    } catch (Throwable $e) {
      // Cache writes are best-effort.
    } finally {
      if (isset($tempFile) && is_file($tempFile)) {
        @unlink($tempFile);
      }
    }
  }
}

if (!function_exists('voncms_public_cache_clear')) {
  /**
   * @return array{removed: int, errors: array<int, string>}
   */
  function voncms_public_cache_clear(): array
  {
    $cacheDir = voncms_public_cache_directory();
    $result = ['removed' => 0, 'errors' => []];

    if (!is_dir($cacheDir)) {
      return $result;
    }

    $entries = glob($cacheDir . '/*');
    if (!is_array($entries)) {
      return $result;
    }

    foreach ($entries as $entry) {
      $fileName = basename((string) $entry);
      if (!voncms_public_cache_is_known_file($fileName)) {
        continue;
      }

      if (@unlink($entry)) {
        $result['removed']++;
      } else {
        $result['errors'][] = $fileName;
      }
    }

    return $result;
  }
}
