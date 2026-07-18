<?php
/**
 * VonCMS - List Media API
 * Returns media files from database with filesystem fallback
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/media_library_filter_helper.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}
// 2. Enforce Staff Media Security
SessionManager::requireMediaAccess();

/**
 * Format file size to human readable
 *
 * @param int|float $bytes
 * @return string
 */
function formatFileSize($bytes)
{
  if ($bytes >= 1073741824) {
    return number_format($bytes / 1073741824, 2) . ' GB';
  } elseif ($bytes >= 1048576) {
    return number_format($bytes / 1048576, 2) . ' MB';
  } elseif ($bytes >= 1024) {
    return number_format($bytes / 1024, 2) . ' KB';
  } else {
    return $bytes . ' bytes';
  }
}

// Base URL for uploaded files
// Auto-detect base URL
/** @var string $scriptDir */
$scriptDir = dirname($_SERVER['SCRIPT_NAME']);
// If script_name is /VonCMS/api/list_media.php, dirname is /VonCMS/api
// We want /VonCMS/uploads/
/** @var string $baseUrl */
$baseUrl = dirname($scriptDir);
// Fix backslashes on Windows
$baseUrl = str_replace('\\', '/', $baseUrl);
// Prevent double slash (//uploads)
$baseUrl = rtrim($baseUrl, '/') . '/uploads/';

/** @var string $uploadsDir */
$uploadsDir = dirname(__DIR__) . '/uploads/';

/** @var array<int, array<string, mixed>> $files */
$files = [];

/** @var string $source */
$source = 'database';

// Pagination - Declared before DB block so filesystem fallback can use them
/** @var int $page */
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;

/** @var int $limit */
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 32;
$page = max(1, $page);
$limit = min(100, max(1, $limit));
$search = voncms_normalize_media_search($_GET['search'] ?? '');
/** @var int $offset */
$offset = ($page - 1) * $limit;

/** @var int $totalItems */
$totalItems = 0;

/** @var int|float $totalPages */
$totalPages = 1;

/** @var bool $databaseReady */
$databaseReady = false;

/** @var bool $databaseHasRows */
$databaseHasRows = false;

// Try to get files from database first
if (isset($pdo) && $pdo !== null) {
  try {
    // Check if media table exists
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
    if ($tableCheck->rowCount() > 0) {
      // Fetch only the mapped media columns while tolerating older repaired schemas.
      $mediaColumns = [
        'id',
        'filename',
        'filepath',
        'filesize',
        'uploaded_at',
        'created_at',
        'uploaded_by',
        'alt_text',
        'caption',
        'description',
      ];
      $columnStmt = $pdo->query('SHOW COLUMNS FROM media');
      $availableMediaColumns = array_map(
        static fn($column) => $column['Field'] ?? '',
        $columnStmt ? $columnStmt->fetchAll(PDO::FETCH_ASSOC) : [],
      );
      $selectedMediaColumns = array_values(array_intersect($mediaColumns, $availableMediaColumns));
      if (
        !in_array('id', $selectedMediaColumns, true) ||
        !in_array('filename', $selectedMediaColumns, true)
      ) {
        throw new RuntimeException('Media table is missing required list columns.');
      }

      $databaseReady = true;
      $databaseRowCount = (int) $pdo->query('SELECT COUNT(*) FROM media')->fetchColumn();
      $databaseHasRows = $databaseRowCount > 0;

      $whereSql = '';
      $searchBindings = [];
      if ($search !== '') {
        $searchableColumns = array_values(
          array_intersect(
            ['filename', 'alt_text', 'caption', 'description'],
            $selectedMediaColumns,
          ),
        );
        $searchConditions = [];
        $escapedSearch = '%' . voncms_escape_media_like($search) . '%';
        foreach ($searchableColumns as $index => $column) {
          $placeholder = ':media_search_' . $index;
          $searchConditions[] = "$column LIKE $placeholder ESCAPE '!'";
          $searchBindings[$placeholder] = $escapedSearch;
        }
        if (!empty($searchConditions)) {
          $whereSql = ' WHERE (' . implode(' OR ', $searchConditions) . ')';
        }
      }

      $totalStmt = $pdo->prepare('SELECT COUNT(*) FROM media' . $whereSql);
      foreach ($searchBindings as $placeholder => $value) {
        $totalStmt->bindValue($placeholder, $value, PDO::PARAM_STR);
      }
      $totalStmt->execute();
      $totalItems = (int) $totalStmt->fetchColumn();
      $totalPages = max(1, (int) ceil($totalItems / $limit));
      if ($totalItems > 0 && $page > $totalPages) {
        $page = $totalPages;
        $offset = ($page - 1) * $limit;
      }

      $stmt = $pdo->prepare(
        'SELECT ' .
          implode(', ', $selectedMediaColumns) .
          ' FROM media' .
          $whereSql .
          ' ORDER BY id DESC LIMIT :limit OFFSET :offset',
      );
      foreach ($searchBindings as $placeholder => $value) {
        $stmt->bindValue($placeholder, $value, PDO::PARAM_STR);
      }
      $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
      $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
      $stmt->execute();
      $mediaRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

      foreach ($mediaRows as $row) {
        // Handle different column names (schema compatibility)
        $filename = $row['filename'] ?? '';
        // Fallback construct if filepath missing
        $filepath = $row['filepath'] ?? 'uploads/' . $filename;
        $filesize = $row['filesize'] ?? 0;
        // Handle created_at vs uploaded_at
        $uploadedAt = $row['uploaded_at'] ?? ($row['created_at'] ?? date('Y-m-d H:i:s'));
        $uploadedBy = $row['uploaded_by'] ?? null;

        if (!$filename) {
          continue;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Ensure filepath is relative for URL construction
        // Normalize slashes
        $cleanPath = str_replace(['\\', '//'], '/', $filepath);

        // Remove 'uploads/' prefix if present in DB path to avoid double prefixing
        if (strpos($cleanPath, 'uploads/') === 0) {
          $cleanPath = substr($cleanPath, 8);
        }

        $pathInfo = pathinfo($cleanPath);

        // Detect WebP variant (hotfix)
        $webpUrl = null;
        $webpVariant =
          ($pathInfo['dirname'] !== '.' ? $pathInfo['dirname'] . '/' : '') .
          $pathInfo['filename'] .
          '.webp';
        if ($ext !== 'webp' && file_exists($uploadsDir . $webpVariant)) {
          $webpUrl = ResponseHelper::scrubUrl($baseUrl . $webpVariant);
        }

        $files[] = [
          'id' => (string) $row['id'],
          'name' => $filename,
          'path' => $cleanPath,
          'url' => ResponseHelper::scrubUrl($baseUrl . $cleanPath),
          'webpUrl' => $webpUrl,
          'type' => 'image',
          'size' => formatFileSize($filesize),
          'sizeBytes' => (int) $filesize,
          'uploadedAt' => date('Y-m-d', strtotime($uploadedAt)),
          'extension' => $ext,
          'uploadedBy' => $uploadedBy,
          'altText' => $row['alt_text'] ?? '',
          'caption' => $row['caption'] ?? '',
          'description' => $row['description'] ?? '',
        ];
      }
    }
  } catch (Throwable $e) {
    error_log('ListMedia DB Error: ' . $e->getMessage());
    $databaseReady = false;
    $databaseHasRows = false;
    $source = 'filesystem';
  }
}

// Function to scan directory recursively
/**
 * @param string $dir
 * @param string $baseUrl
 * @param array<int, string> $allowedExtensions
 * @param array<int, array<string, mixed>> $files
 * @return void
 */
function scanDirectory($dir, $baseUrl, $allowedExtensions, &$files)
{
  if (!is_dir($dir)) {
    return;
  }

  $items = scandir($dir);
  if ($items === false) {
    return;
  }
  foreach ($items as $item) {
    if ($item === '.' || $item === '..') {
      continue;
    }

    $fullPath = $dir . '/' . $item;
    $relativePath = str_replace(dirname(__DIR__) . '/uploads/', '', $fullPath);

    if (is_link($fullPath)) {
      continue;
    }

    if (is_dir($fullPath)) {
      scanDirectory($fullPath, $baseUrl, $allowedExtensions, $files);
    } else {
      $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
      if (in_array($ext, $allowedExtensions)) {
        if (voncms_is_generated_media_variant($fullPath)) {
          continue;
        }

        $stat = stat($fullPath);
        $pathInfo = pathinfo($relativePath);

        // Detect WebP variant (hotfix)
        $webpUrl = null;
        $webpVariant =
          ($pathInfo['dirname'] !== '.' ? $pathInfo['dirname'] . '/' : '') .
          $pathInfo['filename'] .
          '.webp';
        if ($ext !== 'webp' && file_exists(dirname(__DIR__) . '/uploads/' . $webpVariant)) {
          $webpUrl = $baseUrl . $webpVariant;
        }

        $files[] = [
          'id' => md5($relativePath),
          'name' => $item,
          'path' => $relativePath,
          'url' => ResponseHelper::scrubUrl($baseUrl . $relativePath),
          'webpUrl' => $webpUrl ? ResponseHelper::scrubUrl($webpUrl) : null,
          'type' => 'image',
          'size' => formatFileSize($stat['size']),
          'sizeBytes' => $stat['size'],
          'uploadedAt' => date('Y-m-d', $stat['mtime']),
          'extension' => $ext,
        ];
      }
    }
  }
}

// Fallback: Scan filesystem only when the database table is empty or unavailable.
if (!$databaseReady || !$databaseHasRows) {
  $source = 'filesystem';

  /** @var array<int, string> $allowedExtensions */
  $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];

  scanDirectory($uploadsDir, $baseUrl, $allowedExtensions, $files);

  if ($search !== '') {
    $needle = mb_strtolower($search);
    $files = array_values(
      array_filter($files, static function ($file) use ($needle) {
        $name = mb_strtolower((string) ($file['name'] ?? ''));
        $path = mb_strtolower((string) ($file['path'] ?? ''));
        return str_contains($name, $needle) || str_contains($path, $needle);
      }),
    );
  }

  // Sort by upload date descending
  usort(
    $files /**
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     * @return int
     */,
    function ($a, $b) {
      return strtotime($b['uploadedAt']) - strtotime($a['uploadedAt']);
    },
  );

  // Apply Pagination (Fix)
  $totalItems = count($files);
  $totalPages = ceil($totalItems / $limit);
  $files = array_slice($files, $offset, $limit);
}

echo json_encode([
  'success' => true,
  'files' => $files,
  'count' => count($files),
  'totalItems' => $totalItems ?? count($files),
  'totalPages' => $totalPages ?? 1,
  'currentPage' => $page ?? 1,
  'source' => $source,
  'search' => $search,
]);
