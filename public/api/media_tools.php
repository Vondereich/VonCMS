<?php
/**
 * VonCMS - Media Tools API
 *
 * Handles bulk media maintenance operations.
 * - Rebuild and purge responsive variants
 * - Cleanup orphaned/unused files
 * - Report media storage statistics
 * @package VonCMS
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}
require_once __DIR__ . '/../media_variants.php';
require_once __DIR__ . '/ImageProcessor.php';

SessionManager::requirePrimaryAdmin();

CSRFProtection::requireToken();

$action = $_POST['action'] ?? '';

switch ($action) {
  case 'rebuild_responsive_variants':
    rebuildResponsiveVariants();
    break;
  case 'preview_responsive_variants':
    previewResponsiveVariants();
    break;
  case 'purge_responsive_variants':
    purgeResponsiveVariants();
    break;
  case 'regenerate_thumbnails':
    ResponseHelper::sendError('Legacy thumbnail rebuild has been removed from this version.', 410);
    break;
  case 'cleanup_unused':
    cleanupUnusedFiles();
    break;
  case 'get_stats':
    getMediaStats();
    break;
  default:
    ResponseHelper::sendError('Invalid action', 400);
}

function formatMediaToolBytes(int $bytes): string
{
  if ($bytes >= 1048576) {
    return number_format($bytes / 1048576, 2) . ' MB';
  }

  return number_format($bytes / 1024, 2) . ' KB';
}

function getResponsiveVariantConfig(): array
{
  $maxWidth = 1920;
  $quality = 85;
  $settingsFile = dirname(__DIR__) . '/data/site_settings.json';

  if (file_exists($settingsFile)) {
    $settings = json_decode(file_get_contents($settingsFile), true);
    $optimization = $settings['media']['optimization'] ?? [];
    $maxWidth = (int) ($optimization['maxWidth'] ?? 1920);
    $compressionLevel = $optimization['compressionLevel'] ?? 'medium';
    $qualityMap = ['low' => 90, 'medium' => 75, 'high' => 60];
    $quality = (int) ($qualityMap[$compressionLevel] ?? 85);
  }

  return [
    'maxWidth' => $maxWidth,
    'quality' => $quality,
    'responsiveWidths' => voncms_get_responsive_widths($maxWidth),
  ];
}

function acquireMediaToolLock(string $lockName)
{
  $lockDir = dirname(__DIR__) . '/data';
  if (!is_dir($lockDir)) {
    @mkdir($lockDir, 0755, true);
  }

  $lockPath = $lockDir . '/' . $lockName . '.lock';
  $handle = @fopen($lockPath, 'c+');
  if ($handle === false) {
    return false;
  }

  if (!flock($handle, LOCK_EX | LOCK_NB)) {
    fclose($handle);
    return false;
  }

  fwrite($handle, (string) time());
  fflush($handle);

  return $handle;
}

/**
 * @param resource|false $handle
 * @return void
 */
function releaseMediaToolLock($handle): void
{
  if (is_resource($handle)) {
    flock($handle, LOCK_UN);
    fclose($handle);
  }
}

function getMediaCleanupPreviewDir(): string
{
  $dir = dirname(__DIR__) . '/data/media_cleanup_previews';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }

  return $dir;
}

function pruneMediaCleanupPreviewFiles(?int $userId = null): void
{
  $previewDir = getMediaCleanupPreviewDir();
  $files = glob($previewDir . '/*.json') ?: [];
  $expiry = time() - 7200;

  foreach ($files as $file) {
    $basename = basename($file);
    if ($userId !== null && strpos($basename, 'user' . $userId . '-') !== 0) {
      continue;
    }

    $payload = json_decode((string) @file_get_contents($file), true);
    $createdAt = (int) ($payload['created_at'] ?? 0);
    if ($userId !== null || $createdAt < $expiry) {
      @unlink($file);
    }
  }
}

function createMediaCleanupPreview(array $orphaned): ?string
{
  $userId = (int) ($_SESSION['user']['id'] ?? 0);
  if ($userId <= 0) {
    return null;
  }

  pruneMediaCleanupPreviewFiles($userId);

  try {
    $token = bin2hex(random_bytes(16));
  } catch (Throwable $e) {
    return null;
  }

  $payload = [
    'user_id' => $userId,
    'created_at' => time(),
    'orphaned' => $orphaned,
  ];

  $previewPath = getMediaCleanupPreviewDir() . '/user' . $userId . '-' . $token . '.json';
  $written = @file_put_contents(
    $previewPath,
    json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
    LOCK_EX,
  );

  return $written === false ? null : $token;
}

function loadMediaCleanupPreview(string $token): ?array
{
  if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
    return null;
  }

  $userId = (int) ($_SESSION['user']['id'] ?? 0);
  if ($userId <= 0) {
    return null;
  }

  $previewPath = getMediaCleanupPreviewDir() . '/user' . $userId . '-' . $token . '.json';
  if (!is_file($previewPath)) {
    return null;
  }

  $payload = json_decode((string) @file_get_contents($previewPath), true);
  if (!is_array($payload)) {
    @unlink($previewPath);
    return null;
  }

  if ((int) ($payload['user_id'] ?? 0) !== $userId) {
    @unlink($previewPath);
    return null;
  }

  if ((int) ($payload['created_at'] ?? 0) < time() - 7200) {
    @unlink($previewPath);
    return null;
  }

  $payload['__path'] = $previewPath;
  return $payload;
}

function buildMediaCleanupPath(string $uploadsDir, string $relativePath): ?string
{
  $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
  if ($relativePath === '' || strpos($relativePath, '..') !== false) {
    return null;
  }

  return rtrim(str_replace('\\', '/', $uploadsDir), '/') . '/' . $relativePath;
}

function getReferencedUploadRelativePaths(): array
{
  global $pdo;

  if (!isset($pdo)) {
    return [];
  }

  $paths = [];

  try {
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
    if ($tableCheck && $tableCheck->rowCount() > 0) {
      $stmt = $pdo->query(
        'SELECT filepath FROM media WHERE filepath IS NOT NULL AND filepath <> ""',
      );
      foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $filepath) {
        $relativePath = voncms_resolve_upload_relative_path((string) $filepath);
        if ($relativePath !== null) {
          $paths[] = $relativePath;
        }
      }
    }
  } catch (Throwable $e) {
    // Ignore media table issues and continue with content scans.
  }

  // Scan posts in chunks to avoid loading all content into memory
  try {
    $chunkSize = 200;
    $offset = 0;
    do {
      $postsStmt = $pdo->prepare(
        'SELECT content, image_url FROM posts LIMIT :limit OFFSET :offset',
      );
      $postsStmt->bindValue(':limit', $chunkSize, PDO::PARAM_INT);
      $postsStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
      $postsStmt->execute();
      $rows = $postsStmt->fetchAll(PDO::FETCH_ASSOC);
      foreach ($rows as $post) {
        $imageUrl = trim((string) ($post['image_url'] ?? ''));
        if ($imageUrl !== '') {
          $relativePath = voncms_resolve_upload_relative_path($imageUrl);
          if ($relativePath !== null) {
            $paths[] = $relativePath;
          }
        }
        preg_match_all(
          "/uploads\/[^\\s\"'<>]+\.(jpg|jpeg|png|gif|webp)/i",
          $post['content'] ?? '',
          $matches,
        );
        foreach ($matches[0] as $match) {
          $relativePath = voncms_resolve_upload_relative_path($match);
          if ($relativePath !== null) {
            $paths[] = $relativePath;
          }
        }
      }
      $offset += $chunkSize;
    } while (count($rows) === $chunkSize);
  } catch (Throwable $e) {
    // Ignore posts scan issues.
  }

  // Scan pages in chunks
  try {
    $chunkSize = 200;
    $offset = 0;
    do {
      $pagesStmt = $pdo->prepare('SELECT content FROM pages LIMIT :limit OFFSET :offset');
      $pagesStmt->bindValue(':limit', $chunkSize, PDO::PARAM_INT);
      $pagesStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
      $pagesStmt->execute();
      $rows = $pagesStmt->fetchAll(PDO::FETCH_ASSOC);
      foreach ($rows as $page) {
        preg_match_all(
          "/uploads\/[^\\s\"'<>]+\.(jpg|jpeg|png|gif|webp)/i",
          $page['content'] ?? '',
          $matches,
        );
        foreach ($matches[0] as $match) {
          $relativePath = voncms_resolve_upload_relative_path($match);
          if ($relativePath !== null) {
            $paths[] = $relativePath;
          }
        }
      }
      $offset += $chunkSize;
    } while (count($rows) === $chunkSize);
  } catch (Throwable $e) {
    // Ignore pages scan issues.
  }

  $paths = array_values(array_unique(array_filter($paths)));
  sort($paths, SORT_STRING);

  return $paths;
}

function collectResponsiveVariantInventory(): array
{
  return voncms_collect_registered_generated_media_variant_inventory(
    dirname(__DIR__) . '/uploads/',
  );
}

function previewResponsiveVariants(): void
{
  global $pdo;

  if (!isset($pdo)) {
    echo json_encode([
      'success' => false,
      'error' => 'Database connection not available',
    ]);
    return;
  }

  $inventory = collectResponsiveVariantInventory();
  $variants = $inventory['variants'];
  $totalSize = array_sum(array_column($variants, 'size'));

  echo json_encode([
    'success' => true,
    'message' =>
      count($variants) > 0
        ? 'Responsive variant preview ready. Original uploads are not included in this list.'
        : 'No generated responsive variants were found for referenced media.',
    'stats' => [
      'count' => count($variants),
      'sourceCount' => count($inventory['sources']),
      'totalSize' => $totalSize,
      'totalSizeFormatted' => formatMediaToolBytes($totalSize),
      'isExecuted' => false,
    ],
    'variants' => array_slice($variants, 0, 50),
  ]);
}

/**
 * Rebuild responsive width variants for featured images referenced by posts.
 */
function rebuildResponsiveVariants(): void
{
  global $pdo;
  set_time_limit(0);

  if (!ImageProcessor::isGdAvailable()) {
    echo json_encode([
      'success' => false,
      'error' => 'PHP GD extension not available. Please enable it.',
    ]);
    return;
  }

  if (!isset($pdo)) {
    echo json_encode([
      'success' => false,
      'error' => 'Database connection not available',
    ]);
    return;
  }

  $lockHandle = acquireMediaToolLock('responsive_variants');
  if ($lockHandle === false) {
    echo json_encode([
      'success' => false,
      'error' => 'Another responsive variant job is already running. Please wait for it to finish.',
    ]);
    return;
  }

  try {
    $config = getResponsiveVariantConfig();
    $responsiveWidths = $config['responsiveWidths'];
    $uploadsDir = dirname(__DIR__) . '/uploads/';
    $processor = new ImageProcessor([
      'enabled' => true,
      'quality' => $config['quality'],
      'responsiveWidths' => $responsiveWidths,
    ]);

    $stmt = $pdo->query(
      "SELECT DISTINCT image_url FROM posts WHERE image_url IS NOT NULL AND image_url <> ''",
    );
    $processed = 0;
    $skipped = 0;
    $skippedWebP = 0;
    $errors = 0;
    $results = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
      $imageUrl = trim((string) ($row['image_url'] ?? ''));
      if ($imageUrl === '') {
        $skipped++;
        continue;
      }

      $relativePath = voncms_resolve_upload_relative_path($imageUrl);
      if ($relativePath === null) {
        $skipped++;
        continue;
      }

      $sourcePath = $uploadsDir . $relativePath;
      if (!file_exists($sourcePath)) {
        $errors++;
        continue;
      }

      // Skip WebP images — GD's WebP decoder can crash with buffer allocation errors
      // on certain encoded WebP files (especially from WordPress imports).
      // WebP is already compressed, variants provide minimal benefit.
      $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
      if ($ext === 'webp') {
        $skippedWebP++;
        continue;
      }

      try {
        $generated = $processor->generateResponsiveVariants($sourcePath, $responsiveWidths);
        if (!empty($generated)) {
          $processed++;
          $results[] = [
            'file' => $relativePath,
            'status' => 'updated',
            'variants' => array_keys($generated),
          ];
        } else {
          $skipped++;
        }
      } catch (Throwable $e) {
        $errors++;
      }
    }

    echo json_encode([
      'success' => true,
      'message' => "Responsive variant rebuild complete: $processed updated, $skippedWebP WebP skipped, $skipped unchanged, $errors errors",
      'stats' => [
        'processed' => $processed,
        'skipped' => $skipped,
        'skippedWebP' => $skippedWebP,
        'errors' => $errors,
      ],
      'results' => array_slice($results, 0, 20),
    ]);
  } finally {
    releaseMediaToolLock($lockHandle);
  }
}

function purgeResponsiveVariants(): void
{
  global $pdo;
  set_time_limit(0);

  if (!isset($pdo)) {
    echo json_encode([
      'success' => false,
      'error' => 'Database connection not available',
    ]);
    return;
  }

  $lockHandle = acquireMediaToolLock('responsive_variants');
  if ($lockHandle === false) {
    echo json_encode([
      'success' => false,
      'error' => 'Another responsive variant job is already running. Please wait for it to finish.',
    ]);
    return;
  }

  try {
    $inventory = collectResponsiveVariantInventory();
    $uploadsDir = $inventory['uploadsDir'];
    $variants = $inventory['variants'];

    if ($uploadsDir === null) {
      echo json_encode([
        'success' => false,
        'error' => 'Uploads directory not found',
      ]);
      return;
    }

    $deletedCount = 0;
    $deletedSize = 0;
    $failedDeletions = [];
    $deletedVariantPaths = [];

    foreach ($variants as $variant) {
      $physicalPath = $uploadsDir . ltrim($variant['path'], '/');
      $physicalPath = str_replace('\\', '/', $physicalPath);

      if (file_exists($physicalPath) && is_file($physicalPath)) {
        if (unlink($physicalPath)) {
          $deletedCount++;
          $deletedSize += (int) ($variant['size'] ?? 0);
          $deletedVariantPaths[] = (string) ($variant['path'] ?? '');
        } else {
          $failedDeletions[] = $variant['path'];
        }
      }
    }

    if (!empty($deletedVariantPaths)) {
      voncms_unregister_generated_media_variant_paths($deletedVariantPaths, $uploadsDir);
    }

    echo json_encode([
      'success' => true,
      'message' =>
        $deletedCount > 0
          ? 'Responsive variant purge complete. Original uploads were not deleted.'
          : 'No responsive variants were deleted. Original uploads remain untouched.',
      'stats' => [
        'count' => count($variants),
        'deletedCount' => $deletedCount,
        'deletedSize' => $deletedSize,
        'deletedSizeFormatted' => formatMediaToolBytes($deletedSize),
        'failedCount' => count($failedDeletions),
        'isExecuted' => true,
      ],
      'failedDeletions' => $failedDeletions,
    ]);
  } finally {
    releaseMediaToolLock($lockHandle);
  }
}

/**
 * Cleanup unused/orphaned media files
 */
function cleanupUnusedFiles(): void
{
  global $pdo;
  set_time_limit(0); // Prevent timeout for large libraries

  if (!isset($pdo)) {
    echo json_encode([
      'success' => false,
      'error' => 'Database connection not available',
    ]);
    return;
  }

  $uploadsDir = realpath(dirname(__DIR__) . '/uploads');
  if (!$uploadsDir) {
    echo json_encode(['success' => false, 'error' => 'Uploads directory not found']);
    return;
  }
  $uploadsDir = str_replace('\\', '/', $uploadsDir) . '/';

  $executeCleanup = isset($_POST['execute_cleanup']) && $_POST['execute_cleanup'] === 'true';
  $previewToken = trim((string) ($_POST['preview_token'] ?? ''));
  $orphaned = [];
  $totalSize = 0;

  if ($executeCleanup) {
    if ($previewToken === '') {
      ResponseHelper::sendError('Preview token required before deleting orphaned files.', 400);
    }

    $preview = loadMediaCleanupPreview($previewToken);
    if (!$preview || !is_array($preview['orphaned'] ?? null)) {
      ResponseHelper::sendError(
        'Saved orphaned-file review not found. Please scan again before deleting.',
        409,
      );
    }

    $orphaned = $preview['orphaned'];
    foreach ($orphaned as $orphanInfo) {
      $totalSize += (int) ($orphanInfo['size'] ?? 0);
    }
  } else {
    // Get all media entries from database
    $stmt = $pdo->query('SELECT filepath FROM media');
    $dbFiles = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Normalize paths
    $dbFilesNormalized = array_map(function ($path) {
      return str_replace(['\\', 'uploads/'], ['/', ''], $path);
    }, $dbFiles);

    // Also check posts and pages for image references
    $contentFiles = [];

    // Check posts
    $postsStmt = $pdo->query('SELECT content, image_url FROM posts');
    while ($post = $postsStmt->fetch(PDO::FETCH_ASSOC)) {
      preg_match_all(
        "/uploads\/[^\\s\"'<>]+\.(jpg|jpeg|png|gif|webp)/i",
        $post['content'] ?? '',
        $matches,
      );
      foreach ($matches[0] as $match) {
        $contentFiles[] = str_replace('uploads/', '', $match);
      }
      if (!empty($post['image_url'])) {
        $contentFiles[] = str_replace('uploads/', '', $post['image_url']);
      }
    }

    // Check pages
    $pagesStmt = $pdo->query('SELECT content FROM pages');
    while ($page = $pagesStmt->fetch(PDO::FETCH_ASSOC)) {
      preg_match_all(
        "/uploads\/[^\\s\"'<>]+\.(jpg|jpeg|png|gif|webp)/i",
        $page['content'] ?? '',
        $matches,
      );
      foreach ($matches[0] as $match) {
        $contentFiles[] = str_replace('uploads/', '', $match);
      }
    }

    $allUsedFiles = array_unique(array_merge($dbFilesNormalized, $contentFiles));

    // Extract base paths (without extensions) for smarter matching of variants (WebP, Thumbnails)
    $usedBaseFiles = [];
    foreach ($allUsedFiles as $uf) {
      $pathInfo = pathinfo($uf);
      $baseWithDir =
        !empty($pathInfo['dirname']) && $pathInfo['dirname'] !== '.'
          ? $pathInfo['dirname'] . '/' . $pathInfo['filename']
          : $pathInfo['filename'];
      $usedBaseFiles[] = $baseWithDir;
    }
    $usedBaseFiles = array_unique($usedBaseFiles);

    $iterator = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($uploadsDir, RecursiveDirectoryIterator::SKIP_DOTS),
    );

    foreach ($iterator as $file) {
      if (!$file->isFile()) {
        continue;
      }

      $systemFiles = ['.htaccess', 'index.php', 'index.html'];
      if (in_array(strtolower($file->getFilename()), $systemFiles)) {
        continue;
      }

      $fullPath = str_replace('\\', '/', $file->getPathname());
      $relativePath = str_replace($uploadsDir, '', $fullPath);
      $relativePath = ltrim($relativePath, '/');

      $isUsed = false;
      if (in_array($relativePath, $allUsedFiles)) {
        $isUsed = true;
      } else {
        $fileInfo = pathinfo($relativePath);
        $baseName = $fileInfo['filename'];
        $baseName = preg_replace('/(_thumb|_\\d+w)$/', '', $baseName) ?: $baseName;

        $fileBaseWithDir =
          !empty($fileInfo['dirname']) && $fileInfo['dirname'] !== '.'
            ? $fileInfo['dirname'] . '/' . $baseName
            : $baseName;

        if (in_array($fileBaseWithDir, $usedBaseFiles)) {
          $isUsed = true;
        }
      }

      if (!$isUsed) {
        $size = $file->getSize();
        $orphaned[] = [
          'path' => $relativePath,
          'size' => $size,
          'sizeFormatted' => formatMediaToolBytes($size),
          'modified' => date('Y-m-d H:i:s', $file->getMTime()),
        ];
        $totalSize += $size;
      }
    }

    $previewToken = count($orphaned) > 0 ? createMediaCleanupPreview($orphaned) : null;
  }

  $deletedCount = 0;
  $deletedSize = 0;
  $failedDeletions = [];

  if ($executeCleanup) {
    foreach ($orphaned as $orphanInfo) {
      $physicalPath = buildMediaCleanupPath($uploadsDir, (string) ($orphanInfo['path'] ?? ''));
      if ($physicalPath === null) {
        $failedDeletions[] = (string) ($orphanInfo['path'] ?? '[invalid path]');
        continue;
      }

      if (file_exists($physicalPath) && is_file($physicalPath)) {
        if (unlink($physicalPath)) {
          $deletedCount++;
          $deletedSize += (int) ($orphanInfo['size'] ?? 0);
        } else {
          $failedDeletions[] = (string) ($orphanInfo['path'] ?? '[unknown file]');
        }
      } else {
        $failedDeletions[] =
          (string) ($orphanInfo['path'] ?? '[unknown file]') .
          ' (File not found at ' .
          $physicalPath .
          ')';
      }
    }

    $preview = loadMediaCleanupPreview($previewToken);
    if ($preview && !empty($preview['__path'])) {
      @unlink($preview['__path']);
    }
  }

  $sizeFormatted = formatMediaToolBytes($totalSize);
  $deletedSizeFormatted = formatMediaToolBytes($deletedSize);

  $message = count($orphaned) . ' orphaned files found (' . $sizeFormatted . ')';
  if ($executeCleanup) {
    $message = "Successfully deleted $deletedCount orphaned files (Freed $deletedSizeFormatted)";
  }

  echo json_encode([
    'success' => true,
    'message' => $message,
    'stats' => [
      'count' => count($orphaned),
      'deletedCount' => $deletedCount,
      'totalSize' => $totalSize,
      'totalSizeFormatted' => $sizeFormatted,
      'deletedSizeFormatted' => $deletedSizeFormatted,
      'isExecuted' => $executeCleanup,
      'failedCount' => count($failedDeletions),
    ],
    'previewToken' => $executeCleanup ? null : $previewToken,
    'failedDeletions' => $failedDeletions,
    'orphaned' => $orphaned,
  ]);
}

/**
 * Get media storage stats
 */
function getMediaStats(): void
{
  global $pdo;
  set_time_limit(0); // Prevent timeout for large libraries

  $uploadsDir = dirname(__DIR__) . '/uploads/';
  $totalFiles = 0;
  $totalSize = 0;

  if (is_dir($uploadsDir)) {
    $iterator = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($uploadsDir, RecursiveDirectoryIterator::SKIP_DOTS),
    );

    foreach ($iterator as $file) {
      if ($file->isFile()) {
        $totalFiles++;
        $totalSize += $file->getSize();
      }
    }
  }

  $dbCount = 0;
  if (isset($pdo)) {
    try {
      $stmt = $pdo->query('SELECT COUNT(*) FROM media');
      $dbCount = (int) $stmt->fetchColumn();
    } catch (Exception $e) {
      // Ignore
    }
  }

  echo json_encode([
    'success' => true,
    'stats' => [
      'totalFiles' => $totalFiles,
      'totalSize' => $totalSize,
      'totalSizeFormatted' =>
        $totalSize >= 1048576
          ? number_format($totalSize / 1048576, 2) . ' MB'
          : number_format($totalSize / 1024, 2) . ' KB',
      'dbEntries' => $dbCount,
    ],
  ]);
}
