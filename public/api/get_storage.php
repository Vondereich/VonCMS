<?php
/**
 * VonCMS - Get Storage Usage API
 * Returns disk usage of /uploads/ folder
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

SessionManager::requireStaff();
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

// Authorization is captured above; the recursive scan must not block the admin session.

/**
 * Calculate folder size and file count recursively
 *
 * @param string $dir
 * @return array{bytes: int, files: int}
 */
function getFolderStats($dir)
{
  $stats = ['bytes' => 0, 'files' => 0];
  if (is_dir($dir)) {
    $iterator = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
    );
    foreach ($iterator as $file) {
      if ($file instanceof SplFileInfo && !$file->isLink() && $file->isFile()) {
        $stats['bytes'] += $file->getSize();
        $stats['files']++;
      }
    }
  }
  return $stats;
}

/** Staff-only, bounded cache. Storage failures retain the live-read fallback.
 * @return array{bytes: int, files: int}
 */
function getCachedFolderStats(string $dir): array
{
  $cacheFile = dirname(__DIR__) . '/data/storage_usage.json';
  if (!is_dir(dirname($cacheFile)) || is_link(dirname($cacheFile)) || is_link($cacheFile)) {
    return getFolderStats($dir);
  }
  $mask = umask(0077);
  try {
    $handle = @fopen($cacheFile, 'c+b');
  } finally {
    umask($mask);
  }
  if ($handle === false) {
    return getFolderStats($dir);
  }
  try {
    if (!flock($handle, LOCK_EX)) {
      return getFolderStats($dir);
    }
    $cached = json_decode((string) stream_get_contents($handle, 4096), true);
    $now = time();
    if (
      is_array($cached) &&
      ($cached['version'] ?? null) === 1 &&
      ($cached['path'] ?? null) === (realpath($dir) ?: $dir) &&
      is_int($cached['at'] ?? null) &&
      $cached['at'] <= $now &&
      $cached['at'] > $now - 300 &&
      is_int($cached['bytes'] ?? null) &&
      $cached['bytes'] >= 0 &&
      is_int($cached['files'] ?? null) &&
      $cached['files'] >= 0
    ) {
      return ['bytes' => $cached['bytes'], 'files' => $cached['files']];
    }
    $stats = getFolderStats($dir);
    $encoded = json_encode(
      ['version' => 1, 'path' => realpath($dir) ?: $dir, 'at' => $now] + $stats,
    );
    if (is_string($encoded)) {
      rewind($handle);
      if (@ftruncate($handle, 0)) {
        @fwrite($handle, $encoded);
        @fflush($handle);
      }
    }
    return $stats;
  } finally {
    flock($handle, LOCK_UN);
    fclose($handle);
  }
}

/**
 * Format bytes to human readable
 *
 * @param int|float $bytes
 * @param int $precision
 * @return string
 */
function formatBytes($bytes, $precision = 2)
{
  $units = ['B', 'KB', 'MB', 'GB', 'TB'];
  $bytes = max($bytes, 0);
  $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
  $pow = (int) min($pow, count($units) - 1);
  $bytes /= pow(1024, $pow);
  return round($bytes, $precision) . ' ' . $units[$pow];
}

// Calculate storage
$uploadsPath = dirname(__DIR__) . '/uploads';

// Get used space and file count in one traversal
$folderStats = getCachedFolderStats($uploadsPath);
$usedBytes = $folderStats['bytes'];
$fileCount = $folderStats['files'];
$usedFormatted = formatBytes($usedBytes);

// Get total disk space (or use configurable limit)
// Default limit: 1GB for shared hosting
$limitBytes = 1 * 1024 * 1024 * 1024; // 1GB

// Try to get actual disk space on the partition
$totalDisk = @disk_total_space($uploadsPath);
$freeDisk = @disk_free_space($uploadsPath);

if ($totalDisk && $totalDisk > 0) {
  // Use actual disk space but cap at 10GB for display
  $limitBytes = min($totalDisk, 10 * 1024 * 1024 * 1024);
}

// Calculate percentage
$percentage = $limitBytes > 0 ? round(($usedBytes / $limitBytes) * 100, 1) : 0;

echo json_encode([
  'success' => true,
  'storage' => [
    'used' => $usedFormatted,
    'usedBytes' => $usedBytes,
    'limit' => formatBytes($limitBytes),
    'limitBytes' => $limitBytes,
    'percentage' => $percentage,
    'fileCount' => $fileCount,
    'diskTotal' => $totalDisk ? formatBytes($totalDisk) : null,
    'diskFree' => $freeDisk ? formatBytes($freeDisk) : null,
  ],
]);
