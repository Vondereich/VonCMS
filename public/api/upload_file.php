<?php
/**
 * VonCMS - File Upload API
 * Uploads images to /uploads/ folder with optional folder structure
 * Also saves to media database table for persistence
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

require_once __DIR__ . '/../media_variants.php';
require_once __DIR__ . '/ImageProcessor.php';

function voncms_build_cdn_media_url(string $cdnUrl, string $relativePath): string
{
  $cdnBase = rtrim($cdnUrl, '/');
  $relativePath = ltrim($relativePath, '/');

  if (preg_match('#/uploads$#i', parse_url($cdnBase, PHP_URL_PATH) ?: '')) {
    return $cdnBase . '/' . $relativePath;
  }

  return $cdnBase . '/uploads/' . $relativePath;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// Enforce Security
SessionManager::requireMediaAccess();
CSRFProtection::requireToken();

if (!isset($_FILES['file'])) {
  ResponseHelper::sendError('No file uploaded', 400);
}

$file = $_FILES['file'];
$baseUploadDir = dirname(__DIR__) . '/uploads/'; // Standardised to __DIR__ based resolution

// Check for folder structure preference (from POST data or default to year_month)
$folderStructure = $_POST['folderStructure'] ?? 'year_month';

// Determine upload directory based on folder structure setting
if ($folderStructure === 'year_month') {
  $year = date('Y');
  $month = date('m');
  $uploadDir = $baseUploadDir . $year . '/' . $month . '/';

  // Auto-detect base URL
  $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
  // dirname($scriptDir) gets us to /VonCMS/ (parent of api)
  $parentBase = dirname($scriptDir);
  // Fix backslashes for Windows
  $parentBase = str_replace('\\', '/', $parentBase);
  // Prevent double slash (which creates protocol-relative URL //uploads)
  $parentBase = rtrim($parentBase, '/');

  $urlPrefix = $parentBase . '/uploads/' . $year . '/' . $month . '/';
} else {
  // Flat structure
  $uploadDir = $baseUploadDir;

  // Auto-detect base URL (same logic as above)
  $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
  $parentBase = dirname($scriptDir);
  $parentBase = str_replace('\\', '/', $parentBase);
  // Prevent double slash
  $parentBase = rtrim($parentBase, '/');

  $urlPrefix = $parentBase . '/uploads/';
}

// Create uploads directory if it doesn't exist
if (!is_dir($uploadDir)) {
  mkdir($uploadDir, 0755, true);
}

// Validate file type (Checked against MIME and Extension)
$allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon'];
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'ico'];

$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

// Server-side MIME sniffing
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$realMime = finfo_file($finfo, $file['tmp_name']);

if (!in_array($realMime, $allowedMimes) || !in_array($extension, $allowedExts)) {
  ResponseHelper::sendError('Invalid file type. Only images are allowed.', 400);
}

// Validate file size (max 10MB)
$maxSize = 10 * 1024 * 1024; // 10MB
if ($file['size'] > $maxSize) {
  ResponseHelper::sendError('File too large. Maximum size is 10MB.', 400);
}

// Generate unique filename (preserve original extension)
$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$originalName = pathinfo($file['name'], PATHINFO_FILENAME);
// Sanitize original name
$safeName = preg_replace('/[^a-zA-Z0-9_-]/', '', $originalName);
$safeName = substr($safeName, 0, 50); // Limit length
$filename = $safeName . '_' . uniqid() . '.' . $extension;
$targetPath = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
  // Ensure uploaded file is world-readable (Apache needs 0644, not 0600 from restrictive umask)
  @chmod($targetPath, 0644);

  // ========================================
  // IMAGE PROCESSING
  // ========================================
  $processResult = null;

  // Load media optimization settings
  $mediaSettings = [
    'enabled' => true, // Default ON (WebP auto-conversion spec)
    'maxWidth' => 1920,
    'maxHeight' => 1080,
    'quality' => 85,
    'convertToWebP' => false,
    'generateResponsiveVariants' => true,
    'responsiveWidths' => voncms_get_responsive_widths(1920),
  ];

  // CDN URL for prefixing
  $cdnUrl = null;

  // Try to load from site_settings.json (correct path)
  $settingsFile = dirname(__DIR__) . '/data/site_settings.json';
  if (file_exists($settingsFile)) {
    $allSettings = json_decode(file_get_contents($settingsFile), true);
    if (isset($allSettings['media']['optimization'])) {
      $opt = $allSettings['media']['optimization'];
      $mediaSettings['enabled'] = $opt['enabled'] ?? false;
      $mediaSettings['maxWidth'] = (int) ($opt['maxWidth'] ?? 1920);
      $mediaSettings['maxHeight'] = (int) ($opt['maxHeight'] ?? 1080);
      // Convert compressionLevel (low/medium/high) to numeric quality
      $mediaSettings['compressionLevel'] = $opt['compressionLevel'] ?? 'medium';
      $qualityMap = ['low' => 90, 'medium' => 75, 'high' => 60];
      $mediaSettings['quality'] =
        (int) ($opt['quality'] ?? ($qualityMap[$mediaSettings['compressionLevel']] ?? 85));
      $mediaSettings['convertToWebP'] = filter_var(
        $opt['convertToWebP'] ?? false,
        FILTER_VALIDATE_BOOLEAN,
      );
    }
    // Get CDN URL if configured
    if (!empty($allSettings['media']['storage']['cdnUrl'])) {
      $cdnUrl = rtrim($allSettings['media']['storage']['cdnUrl'], '/');
    }
  }

  if (($_POST['context'] ?? '') === 'system') {
    $mediaSettings['skipAbsolute'] = true;
    $mediaSettings['convertToWebP'] = false;
    $mediaSettings['generateResponsiveVariants'] = false;
  }

  $mediaSettings['responsiveWidths'] = voncms_get_responsive_widths($mediaSettings['maxWidth']);

  // Process image if GD available and optimization enabled
  $webpUrl = null;
  $responsiveVariantStatus = !empty($mediaSettings['generateResponsiveVariants'])
    ? 'not_processed'
    : 'disabled';
  $responsiveVariantMessage = '';
  if (ImageProcessor::isGdAvailable() && $mediaSettings['enabled']) {
    $processor = new ImageProcessor($mediaSettings);
    $processResult = $processor->processUpload($targetPath);
    $responsiveVariantStatus =
      $processResult['responsiveVariantStatus'] ?? $responsiveVariantStatus;
    $responsiveVariantMessage =
      $processResult['responsiveVariantMessage'] ?? $responsiveVariantMessage;

    // Get WebP URL if converted
    if (!empty($processResult['webpPath'])) {
      $webpFilename = basename($processResult['webpPath']);
      $webpUrl = $urlPrefix . $webpFilename;

      // Absolute Conversion Support
      // If the processor replaced the original file, update our pointers
      if (
        !empty($processResult['convertedToWebP']) &&
        $processResult['processed'] === $processResult['webpPath']
      ) {
        $filename = $webpFilename;
        $targetPath = $processResult['processed'];
        $extension = 'webp';
        $realMime = 'image/webp';
      }
    }
  }
  // ========================================

  // Get file size for response (after processing)
  $size = filesize($targetPath);
  $sizeFormatted =
    $size >= 1048576
      ? number_format($size / 1048576, 2) . ' MB'
      : number_format($size / 1024, 2) . ' KB';

  // Build relative path for storage
  $relativePath =
    $folderStructure === 'year_month' ? date('Y') . '/' . date('m') . '/' . $filename : $filename;

  // Save to database (if available)
  $mediaId = null;
  if (isset($pdo) && $pdo !== null) {
    // Save to Database
    try {
      // Check if media table exists
      $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
      if ($tableCheck->rowCount() > 0) {
        $stmt = $pdo->prepare(
          'INSERT INTO media (filename, filepath, filetype, filesize, uploaded_by, alt_text, caption)
           VALUES (:filename, :filepath, :filetype, :filesize, :user_id, :alt, :caption)',
        );
        $stmt->execute([
          'filename' => $filename,
          'filepath' => 'uploads/' . $relativePath,
          'filetype' => $realMime,
          'filesize' => $size,
          'user_id' => $_SESSION['user']['id'],
          'alt' => pathinfo($filename, PATHINFO_FILENAME),
          'caption' => pathinfo($filename, PATHINFO_FILENAME),
        ]);
        $mediaId = $pdo->lastInsertId();
      }
    } catch (Exception $e) {
      // CRITICAL: Database insert failed.
      // We must DELETE the uploaded file to prevent "Orphaned Files" (Disk Usage Leak)
      if (file_exists($targetPath)) {
        unlink($targetPath);
      }
      ResponseHelper::sendError($e);
    }
  }

  // Build final URL with optional CDN prefix
  $finalUrl = $urlPrefix . $filename;
  $finalImageSrcSet = null;
  if ($cdnUrl !== null) {
    // CDN URL configured - prefix all URLs
    $finalUrl = voncms_build_cdn_media_url($cdnUrl, $relativePath);
    if ($webpUrl !== null) {
      $webpRelativeDir = dirname($relativePath);
      if ($webpRelativeDir === '.' || $webpRelativeDir === DIRECTORY_SEPARATOR) {
        $webpRelativeDir = '';
      }
      $webpRelativePath =
        ($webpRelativeDir !== ''
          ? rtrim(str_replace('\\', '/', $webpRelativeDir), '/') . '/'
          : '') . basename((string) (parse_url($webpUrl, PHP_URL_PATH) ?: $webpUrl));
      $webpUrl = voncms_build_cdn_media_url($cdnUrl, $webpRelativePath);
    }
  }
  if (!empty($mediaSettings['generateResponsiveVariants'])) {
    $responsiveImage = voncms_build_responsive_image_data(
      $finalUrl,
      dirname(__DIR__) . '/uploads/',
      $mediaSettings['responsiveWidths'] ?? [],
    );
    $finalImageSrcSet = $responsiveImage['srcSet'] ?? null;
  }
  if (
    !empty($mediaSettings['generateResponsiveVariants']) &&
    empty($finalImageSrcSet) &&
    $responsiveVariantStatus === 'not_processed'
  ) {
    $responsiveVariantStatus = 'fallback_original';
    $responsiveVariantMessage =
      'Responsive variants were not generated; original optimized image is being served.';
  }
  $responsiveVariantFallback = $responsiveVariantStatus === 'fallback_original';
  if ($responsiveVariantFallback) {
    error_log('Responsive variant generation fallback: ' . $relativePath);
  }
  echo json_encode([
    'success' => true,
    'url' => $finalUrl,
    'webpUrl' => $webpUrl,
    'imageSrcSet' => $finalImageSrcSet,
    'responsiveVariantStatus' => $responsiveVariantStatus,
    'responsiveVariantMessage' => $responsiveVariantMessage,
    'responsiveVariantFallback' => $responsiveVariantFallback,
    'filename' => $filename,
    'path' => $relativePath,
    'size' => $sizeFormatted,
    'type' => 'image',
    'extension' => $extension,
    'uploadedAt' => date('Y-m-d'),
    'id' => $mediaId,
    'cdnEnabled' => $cdnUrl !== null,
    'processed' =>
      $processResult !== null
        ? [
          'resized' => $processResult['resized'] ?? false,
          'compressed' => $processResult['compressed'] ?? false,
          'convertedToWebP' => $processResult['convertedToWebP'] ?? false,
          'responsiveVariantStatus' => $responsiveVariantStatus,
          'responsiveVariantMessage' => $responsiveVariantMessage,
        ]
        : null,
  ]);
} else {
  ResponseHelper::sendError('Failed to move uploaded file', 500);
}
