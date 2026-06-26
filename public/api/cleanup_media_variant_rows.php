<?php
/**
 * VonCMS - Cleanup generated media variant rows from the media table.
 * This removes library noise without deleting physical files.
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/media_library_filter_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

$uploadsDir = dirname(__DIR__) . '/uploads/';

try {
  $tableCheck = $pdo->query("SHOW TABLES LIKE 'media'");
  if (!$tableCheck || $tableCheck->rowCount() === 0) {
    echo json_encode([
      'success' => true,
      'message' => 'Media table not found. Nothing to clean.',
      'deleted' => 0,
      'scanned' => 0,
    ]);
    exit();
  }

  $stmt = $pdo->query('SELECT id, filepath FROM media ORDER BY id ASC');
  $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

  $variantIds = [];
  foreach ($rows as $row) {
    $filepath = (string) ($row['filepath'] ?? '');
    if (voncms_is_generated_media_variant_path($filepath, $uploadsDir)) {
      $variantIds[] = (int) ($row['id'] ?? 0);
    }
  }

  if (empty($variantIds)) {
    echo json_encode([
      'success' => true,
      'message' => 'No generated variant rows found in the media library.',
      'deleted' => 0,
      'scanned' => count($rows),
    ]);
    exit();
  }

  $placeholders = implode(', ', array_fill(0, count($variantIds), '?'));
  $deleteStmt = $pdo->prepare("DELETE FROM media WHERE id IN ($placeholders)");
  $deleteStmt->execute($variantIds);

  echo json_encode([
    'success' => true,
    'message' => 'Generated variant rows removed from the media library.',
    'deleted' => $deleteStmt->rowCount(),
    'scanned' => count($rows),
  ]);
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
