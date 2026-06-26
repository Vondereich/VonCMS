<?php
/**
 * VonCMS - IndexNow Setup API
 * Generates API key and creates verification file
 *
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();
SessionManager::requirePrimaryAdmin();

require_once __DIR__ . '/IndexNow.php';

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  $indexNow = new IndexNow($pdo);

  // Generate new key
  $newKey = IndexNow::generateKey();

  // Save to database
  if (!$indexNow->saveKey($newKey)) {
    throw new Exception('Failed to save IndexNow key to database');
  }

  // Create verification file in web root
  if (!$indexNow->createKeyFile($newKey)) {
    throw new Exception(
      'Failed to create key verification file. Check write permissions on public folder.',
    );
  }

  echo json_encode([
    'success' => true,
    'message' => 'IndexNow key generated and verification file created',
    'key' => $newKey,
    'file_created' => true,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
