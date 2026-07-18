<?php
/**
 * VonCMS - Delete Media API
 * Deletes a file from both database and /uploads/ folder
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../media_variants.php';
require_once __DIR__ . '/media_library_filter_helper.php';
sendApiHeaders('POST, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// Get input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

$inputPath = isset($input['path']) && is_scalar($input['path']) ? (string) $input['path'] : '';
$cleanRelativePath = voncms_normalize_media_library_path($inputPath);
if ($cleanRelativePath === '') {
  ResponseHelper::sendError('File path required', 400);
}
if (!voncms_is_safe_media_relative_path($cleanRelativePath)) {
  ResponseHelper::sendError('Invalid media path', 400);
}

$uploadsDir = dirname(__DIR__) . '/uploads/';
$isRegisteredGeneratedVariant = voncms_is_registered_generated_media_variant(
  $cleanRelativePath,
  $uploadsDir,
);
$generatedVariantRelativePaths = $isRegisteredGeneratedVariant
  ? []
  : voncms_get_registered_generated_media_variants_for_source($cleanRelativePath, $uploadsDir);
$targetRelativePaths = array_values(
  array_unique(array_merge($generatedVariantRelativePaths, [$cleanRelativePath])),
);

foreach ($targetRelativePaths as $targetRelativePath) {
  if (voncms_resolve_media_path_within_uploads($targetRelativePath, $uploadsDir) === null) {
    ResponseHelper::sendError('Media path escapes the uploads directory', 400);
  }
}

$deletedPaths = [];
$removedVariantPaths = [];
foreach ($targetRelativePaths as $targetRelativePath) {
  $targetPath = voncms_resolve_media_path_within_uploads($targetRelativePath, $uploadsDir);
  if ($targetPath === null || !file_exists($targetPath)) {
    if ($targetRelativePath !== $cleanRelativePath || $isRegisteredGeneratedVariant) {
      $removedVariantPaths[] = $targetRelativePath;
    }
    continue;
  }
  if (!is_file($targetPath) || !unlink($targetPath)) {
    if (!empty($removedVariantPaths)) {
      voncms_unregister_generated_media_variant_paths($removedVariantPaths, $uploadsDir);
    }
    ResponseHelper::sendError(
      'Media deletion stopped before the original file was removed. Rebuildable variants may already be gone.',
      500,
    );
  }

  $deletedPaths[] = $targetRelativePath;
  if ($targetRelativePath !== $cleanRelativePath || $isRegisteredGeneratedVariant) {
    $removedVariantPaths[] = $targetRelativePath;
  }
}

if (!empty($removedVariantPaths)) {
  voncms_unregister_generated_media_variant_paths(array_unique($removedVariantPaths), $uploadsDir);
}

$lookupPaths = [];
foreach ($targetRelativePaths as $targetRelativePath) {
  $dbLookupPath = 'uploads/' . ltrim($targetRelativePath, '/');
  $legacyDbLookupPath = preg_replace('#^uploads/#', 'uploads//', $dbLookupPath, 1);
  $lookupPaths = array_merge($lookupPaths, [
    $targetRelativePath,
    '/' . $targetRelativePath,
    $dbLookupPath,
    '/' . $dbLookupPath,
    $legacyDbLookupPath,
    '/' . $legacyDbLookupPath,
  ]);
}
$lookupPaths = array_values(array_unique(array_filter($lookupPaths)));

$dbDeleted = false;
if (isset($pdo) && $pdo !== null && !empty($lookupPaths)) {
  try {
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
    if ($tableCheck && $tableCheck->rowCount() > 0) {
      $placeholders = implode(', ', array_fill(0, count($lookupPaths), '?'));
      $stmt = $pdo->prepare("DELETE FROM media WHERE filepath IN ($placeholders)");
      $stmt->execute($lookupPaths);
      $dbDeleted = $stmt->rowCount() > 0;
    }
  } catch (Throwable $e) {
    error_log('Delete media database cleanup failed: ' . $e->getMessage());
    ResponseHelper::sendError(
      'The files were removed, but the media database could not be updated. Run Media Sync/Repair.',
      500,
    );
  }
}

// Success if either DB or file was deleted
if ($dbDeleted || !empty($deletedPaths)) {
  echo json_encode([
    'success' => true,
    'message' => 'Deleted successfully',
    'deletedPath' => $cleanRelativePath,
    'dbDeleted' => $dbDeleted,
    'fileDeleted' => in_array($cleanRelativePath, $deletedPaths, true),
    'deletedVariants' => count(array_diff($deletedPaths, [$cleanRelativePath])),
  ]);
} else {
  ResponseHelper::sendError('Nothing to delete', 404);
}
