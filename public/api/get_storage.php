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

/**
 * Calculate folder size recursively
 *
 * @param string $dir
 * @return int
 */
function getFolderSize($dir)
{
  $size = 0;
  if (is_dir($dir)) {
    $iterator = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
    );
    foreach ($iterator as $file) {
      $size += $file->getSize();
    }
  }
  return $size;
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
  $pow = min($pow, count($units) - 1);
  $bytes /= pow(1024, $pow);
  return round($bytes, $precision) . ' ' . $units[$pow];
}

// Calculate storage
$uploadsPath = dirname(__DIR__) . '/uploads';

// Get used space
$usedBytes = getFolderSize($uploadsPath);
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

// Count files
$fileCount = 0;
if (is_dir($uploadsPath)) {
  $iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($uploadsPath, RecursiveDirectoryIterator::SKIP_DOTS),
  );
  foreach ($iterator as $file) {
    if ($file->isFile()) {
      $fileCount++;
    }
  }
}

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
