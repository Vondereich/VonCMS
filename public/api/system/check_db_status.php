<?php
/**
 * VonCMS - Database Status Check
 * Lightweight check to see if DB needs repair/migration.
 */

require_once __DIR__ . '/../../security.php';
require_once __DIR__ . '/../schema_repair_helper.php';
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

if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

if (!isset($pdo) || !($pdo instanceof PDO)) {
  ResponseHelper::sendError('Database not configured', 503);
}

try {
  $needsRepair = false;
  $missingItems = [];

  // 1. Check every structure owned by the explicit core repair path.
  try {
    foreach (voncms_schema_missing_core_repair_items($pdo) as $missingItem) {
      $needsRepair = true;
      $missingItems[] = "Core schema requires Database Repair: {$missingItem}";
    }
  } catch (Throwable $e) {
    $needsRepair = true;
    $missingItems[] = 'Core schema could not be verified';
  }

  // 2. Check shared runtime capabilities without mutating the schema.
  $capabilityLabels = [
    'registration' => 'Registration schema',
    'password_reset' => 'Password reset schema',
    'profile_display_name' => 'Profile display-name schema',
    'remember_tokens' => 'Remember-token storage',
    'analytics' => 'Analytics storage',
    'comment_likes' => 'Comment-like storage',
    'content_audit' => 'Content audit storage',
    'security_logs' => 'Security log storage',
  ];

  foreach ($capabilityLabels as $capability => $label) {
    try {
      if (!voncms_schema_has_capability($pdo, $capability)) {
        $needsRepair = true;
        $missingItems[] = $label . ' requires Database Repair';
      }
    } catch (Throwable $e) {
      $needsRepair = true;
      $missingItems[] = $label . ' could not be verified';
    }
  }

  try {
    $userColumns = voncms_schema_column_map($pdo, 'users');
    foreach (['verification_token', 'reset_token'] as $tokenColumn) {
      $tokenType = strtolower((string) ($userColumns[$tokenColumn]['Type'] ?? ''));
      if ($tokenType !== '' && $tokenType !== 'varchar(64)') {
        $needsRepair = true;
        $missingItems[] = "Column users.{$tokenColumn} requires VARCHAR(64) reconciliation";
      }
    }
  } catch (Throwable $e) {
    $needsRepair = true;
    $missingItems[] = 'Token column widths could not be verified';
  }

  echo json_encode([
    'success' => true,
    'needs_repair' => $needsRepair,
    'details' => $missingItems,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
