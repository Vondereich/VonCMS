<?php
/**
 * VonCMS - Media Sync Script
 * Scans uploads folder and syncs with database
 * Run once: http://yoursite.com/api/sync_media.php
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/media_library_filter_helper.php';
sendApiHeaders('POST, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

/** @var string $uploadsDir */
$uploadsDir = rtrim(str_replace('\\', '/', dirname(__DIR__) . '/uploads/'), '/');

/** @var array<int, string> $allowedExtensions */
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];

/** @var int $uploadedBy */
$uploadedBy = (int) ($_SESSION['user']['id'] ?? 1);

/** @var int $synced */
$synced = 0;

/** @var int $skipped */
$skipped = 0;

/** @var int $skippedVariants */
$skippedVariants = 0;

/** @var array<int, string> $errors */
$errors = [];

/**
 * @param string $dir
 * @param string $uploadsDir
 * @param PDO $pdo
 * @param array<int, string> $allowedExtensions
 * @param int $uploadedBy
 * @param int $synced
 * @param int $skipped
 * @param int $skippedVariants
 * @param array<int, string> $errors
 * @return void
 */
function scanAndSync(
  $dir,
  $uploadsDir,
  $pdo,
  $allowedExtensions,
  $uploadedBy,
  &$synced,
  &$skipped,
  &$skippedVariants,
  &$errors,
) {
  if (!is_dir($dir)) {
    return;
  }

  $items = scandir($dir);
  foreach ($items as $item) {
    if ($item === '.' || $item === '..') {
      continue;
    }

    $fullPath = rtrim(str_replace('\\', '/', $dir), '/') . '/' . $item;

    if (is_dir($fullPath)) {
      scanAndSync(
        $fullPath,
        $uploadsDir,
        $pdo,
        $allowedExtensions,
        $uploadedBy,
        $synced,
        $skipped,
        $skippedVariants,
        $errors,
      );
    } else {
      $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
      if (in_array($ext, $allowedExtensions, true)) {
        if (voncms_is_generated_media_variant($fullPath)) {
          $skippedVariants++;
          continue;
        }

        // Get relative path from uploads folder
        $relativePath = ltrim(str_replace($uploadsDir . '/', '', $fullPath), '/');
        $relativePath = preg_replace('#/+#', '/', $relativePath);
        if ($relativePath === '' || strpos($relativePath, '../') !== false) {
          continue;
        }
        $dbFilePath = 'uploads/' . $relativePath;
        $legacyDbFilePath = preg_replace('#^uploads/#', 'uploads//', $dbFilePath, 1);

        // Check if already in database
        $stmt = $pdo->prepare('SELECT id FROM media WHERE filepath IN (?, ?, ?, ?)');
        $stmt->execute([
          $dbFilePath,
          '/' . $dbFilePath,
          $legacyDbFilePath,
          '/' . $legacyDbFilePath,
        ]);

        if ($stmt->rowCount() > 0) {
          $skipped++;
          continue;
        }

        // Get file info
        $stat = stat($fullPath);
        $mimeType = mime_content_type($fullPath);

        // Insert into database
        try {
          $stmt = $pdo->prepare(
            'INSERT INTO media (filename, filepath, filetype, filesize, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
          );
          $stmt->execute([
            $item,
            $dbFilePath,
            $mimeType,
            $stat['size'],
            $uploadedBy,
            date('Y-m-d H:i:s', $stat['mtime']),
          ]);
          $synced++;
        } catch (PDOException $e) {
          $errors[] = "Failed to insert $item: " . $e->getMessage();
        }
      }
    }
  }
}

try {
  scanAndSync(
    $uploadsDir,
    $uploadsDir,
    $pdo,
    $allowedExtensions,
    $uploadedBy,
    $synced,
    $skipped,
    $skippedVariants,
    $errors,
  );

  echo json_encode(
    [
      'success' => true,
      'message' => 'Sync complete!',
      'synced' => $synced,
      'skipped' => $skipped,
      'skippedVariants' => $skippedVariants,
      'errors' => $errors,
    ],
    JSON_PRETTY_PRINT,
  );
} catch (Exception $e) {
  echo json_encode([
    'success' => false,
    'error' => $e->getMessage(),
  ]);
}
