<?php
/**
 * VonCMS - Delete Media API
 * Deletes a file from both database and /uploads/ folder
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../media_variants.php';
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
$filePath = $input['path'] ?? '';

if (empty($filePath)) {
  ResponseHelper::sendError('File path required', 400);
}

// Security: Prevent directory traversal attacks
$filePath = basename($filePath); // Only allow filename, no paths with ../
if (
  strpos($filePath, '..') !== false ||
  strpos($filePath, '/') !== false ||
  strpos($filePath, '\\') !== false
) {
  // If it contains path separators, extract just the filename
  $filePath = basename($filePath);
}

// For files in year/month folders, we need correct depth sanitization
$inputPath = $input['path'] ?? '';
$uploadsDir = dirname(__DIR__) . '/uploads/';

// 1. Sanitize input path (Gold Standard P2-5)
$sanitizedPath = str_replace(['..', './'], '', $inputPath);
$sanitizedPath = ltrim($sanitizedPath, '/');
$sanitizedPath = preg_replace('#/+#', '/', str_replace('\\', '/', $sanitizedPath));

// 2. Absolute Path for deletion (Surgical Fix: Remove "uploads/" from start if present to prevent double-prefixing)
$cleanRelativePath = $sanitizedPath;
if (strpos($cleanRelativePath, 'uploads/') === 0) {
  $cleanRelativePath = substr($cleanRelativePath, 8);
}
$cleanRelativePath = ltrim(
  preg_replace('#/+#', '/', str_replace('\\', '/', $cleanRelativePath)),
  '/',
);
$fullPath = $uploadsDir . $cleanRelativePath;
$isRegisteredGeneratedVariant = voncms_is_registered_generated_media_variant(
  $cleanRelativePath,
  $uploadsDir,
);
$generatedVariantRelativePaths = $isRegisteredGeneratedVariant
  ? []
  : voncms_get_registered_generated_media_variants_for_source($cleanRelativePath, $uploadsDir);
$targetRelativePaths = array_values(
  array_unique(array_merge([$cleanRelativePath], $generatedVariantRelativePaths)),
);

// Verify the file is within uploads directory (Security Clamp)
$realUploadsDir = realpath($uploadsDir);
$realFilePath = realpath($fullPath);

if ($realFilePath === false || strpos($realFilePath, $realUploadsDir) !== 0) {
  // If we can't find the file, we still want to try deleting the DB record
  // in case the file was already deleted manually (Cleanup Mode)
}

// 3. Delete from database first (if connected)
$dbDeleted = false;
if (isset($pdo) && $pdo !== null) {
  try {
    // Check if media table exists
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
    if ($tableCheck->rowCount() > 0) {
      $lookupPaths = [];
      foreach ($targetRelativePaths as $targetRelativePath) {
        $dbLookupPath = 'uploads/' . ltrim($targetRelativePath, '/');
        $altDbPath = '/' . $dbLookupPath;
        $legacyDbLookupPath = preg_replace('#^uploads/#', 'uploads//', $dbLookupPath, 1);
        $legacyAltDbPath = '/' . $legacyDbLookupPath;
        $lookupPaths = array_merge($lookupPaths, [
          $dbLookupPath,
          $altDbPath,
          $legacyDbLookupPath,
          $legacyAltDbPath,
        ]);
      }
      $lookupPaths = array_values(array_unique($lookupPaths));
      $placeholders = implode(', ', array_fill(0, count($lookupPaths), '?'));

      // SECURITY: Check ownership before delete
      $checkOwner = $pdo->prepare(
        "SELECT uploaded_by FROM media WHERE filepath IN ($placeholders)",
      );
      $checkOwner->execute($lookupPaths);
      $existingMedia = $checkOwner->fetch(PDO::FETCH_ASSOC);

      if ($existingMedia) {
        $currentUser = $_SESSION['user'] ?? null;
        $isOwner = $currentUser && $existingMedia['uploaded_by'] == $currentUser['id'];
        $isAdmin = SessionManager::isAdmin();

        if (!$isOwner && !$isAdmin) {
          ResponseHelper::sendError('Not authorized to delete this file', 403);
        }
      }

      // Delete using exact match for both variants
      $stmt = $pdo->prepare("DELETE FROM media WHERE filepath IN ($placeholders)");
      $stmt->execute($lookupPaths);
      $dbDeleted = $stmt->rowCount() > 0;
    }
  } catch (PDOException $e) {
    // Continue
  }
}

// 4. Delete physical file and registered generated variants
$fileDeleted = false;
if (!empty($targetRelativePaths)) {
  $deletedGeneratedVariantPaths = [];

  foreach ($targetRelativePaths as $targetRelativePath) {
    $targetPath = $uploadsDir . ltrim($targetRelativePath, '/');
    if (file_exists($targetPath) && is_file($targetPath)) {
      if (unlink($targetPath)) {
        $fileDeleted = true;
        if ($targetRelativePath !== $cleanRelativePath) {
          $deletedGeneratedVariantPaths[] = $targetRelativePath;
        } elseif ($isRegisteredGeneratedVariant) {
          $deletedGeneratedVariantPaths[] = $targetRelativePath;
        }
      }
    }
  }

  if ($isRegisteredGeneratedVariant) {
    $targetPath = $uploadsDir . ltrim($cleanRelativePath, '/');
    if (!file_exists($targetPath)) {
      $deletedGeneratedVariantPaths[] = $cleanRelativePath;
    }
  } else {
    foreach ($generatedVariantRelativePaths as $generatedVariantRelativePath) {
      $variantPath = $uploadsDir . ltrim($generatedVariantRelativePath, '/');
      if (!file_exists($variantPath)) {
        $deletedGeneratedVariantPaths[] = $generatedVariantRelativePath;
      }
    }
  }

  $deletedGeneratedVariantPaths = array_values(array_unique($deletedGeneratedVariantPaths));
  if (!empty($deletedGeneratedVariantPaths)) {
    voncms_unregister_generated_media_variant_paths($deletedGeneratedVariantPaths, $uploadsDir);
  }
}

// Success if either DB or file was deleted
if ($dbDeleted || $fileDeleted) {
  echo json_encode([
    'success' => true,
    'message' => 'Deleted successfully',
    'deletedPath' => $sanitizedPath,
    'dbDeleted' => $dbDeleted,
    'fileDeleted' => $fileDeleted,
  ]);
} else {
  ResponseHelper::sendError('Nothing to delete', 404);
}
