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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
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
  $previousKey = $indexNow->getKey();

  // Generate new key
  $newKey = IndexNow::generateKey();

  // Create the verification file before changing the active database key.
  if (!$indexNow->createKeyFile($newKey)) {
    throw new Exception(
      'Failed to create key verification file. Check write permissions on public folder.',
    );
  }

  if (!$indexNow->saveKey($newKey)) {
    $indexNow->removeKeyFile($newKey);
    throw new Exception('Failed to save IndexNow key to database');
  }

  $indexNow->cleanupOldKeyFiles($previousKey, $newKey);

  echo json_encode([
    'success' => true,
    'message' => 'IndexNow key generated and verification file created',
    'key' => $newKey,
    'file_created' => true,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
