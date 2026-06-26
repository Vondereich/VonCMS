<?php
/**
 * VonCMS - Database Status Check
 * Lightweight check to see if DB needs repair/migration.
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}
SessionManager::requirePrimaryAdmin();

try {
  $needsRepair = false;
  $missingItems = [];

  // 1. Check for Redirects Table
  try {
    $result = $pdo->query("SHOW TABLES LIKE 'redirects'");
    if ($result->rowCount() === 0) {
      $needsRepair = true;
      $missingItems[] = "Missing 'redirects' table";
    }
  } catch (Exception $e) {
    $needsRepair = true;
  }

  // 2. Check for Media Metadata Columns
  try {
    $stmt = $pdo->query("SHOW COLUMNS FROM media LIKE 'alt_text'");
    if ($stmt->rowCount() === 0) {
      $needsRepair = true;
      $missingItems[] = 'Missing media metadata columns';
    }
  } catch (Exception $e) {
    $needsRepair = true;
  }

  // 3. Check for Settings Public Column
  try {
    $stmt = $pdo->query("SHOW COLUMNS FROM settings LIKE 'is_public'");
    if ($stmt->rowCount() === 0) {
      $needsRepair = true;
      $missingItems[] = "Missing 'is_public' column in settings";
    }
  } catch (Exception $e) {
    $needsRepair = true;
  }

  // 4. Check for Content Audit Logs Table
  try {
    $result = $pdo->query("SHOW TABLES LIKE 'content_audit_logs'");
    if ($result->rowCount() === 0) {
      $needsRepair = true;
      $missingItems[] = "Missing 'content_audit_logs' table";
    }
  } catch (Exception $e) {
    $needsRepair = true;
  }

  // 5. Check for public author display-name column
  try {
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    if ($stmt->rowCount() === 0) {
      $needsRepair = true;
      $missingItems[] = "Missing 'display_name' column in users";
    }
  } catch (Exception $e) {
    $needsRepair = true;
  }

  echo json_encode([
    'success' => true,
    'needs_repair' => $needsRepair,
    'details' => $missingItems,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
