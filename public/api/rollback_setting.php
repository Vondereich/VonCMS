<?php

require_once __DIR__ . '/../core/DataBoundary.php';
/**
 * VonCMS - Settings Rollback API
 * Rollback a setting to a previous version from audit log
 * SECURITY: Primary-admin-only access
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../core/SettingsStorage.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/settings_audit_helper.php';

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

// Authenticate, Authorize, and Verify CSRF
SessionManager::requireValidSession();
CSRFProtection::requireToken();

SessionManager::requirePrimaryAdmin();

// Enforce Security
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid rollback data', 400);
}
$auditLogId = $input['audit_log_id'] ?? null;

if (!$auditLogId) {
  ResponseHelper::sendError('audit_log_id required', 400);
}

$userId = (int) DataBoundary::userText('id');
$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
$maintenanceFlagFile = __DIR__ . '/../data/maintenance.flag';
$maintenanceFlagPreviouslyEnabled = is_file($maintenanceFlagFile);
$maintenanceFlagTouched = false;
$settingsCommitted = false;

try {
  $pdo->beginTransaction();

  // Get the audit log entry
  $stmt = $pdo->prepare('SELECT * FROM settings_audit_log WHERE id = ?');
  $stmt->execute([$auditLogId]);
  $auditEntry = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

  if (!$auditEntry) {
    $pdo->rollBack();
    ResponseHelper::sendError('Audit log entry not found', 404);
  }

  // Rollback to old_value
  $rollbackValue = $auditEntry['old_value'];
  $settingGroup = (string) $auditEntry['setting_group'];
  $settingKey = (string) $auditEntry['setting_key'];

  if (voncms_setting_audit_is_sensitive($settingGroup, $settingKey)) {
    $deleteAuditStmt = $pdo->prepare('DELETE FROM settings_audit_log WHERE id = ?');
    $deleteAuditStmt->execute([$auditLogId]);
    $pdo->commit();
    ResponseHelper::sendError('Sensitive settings cannot be restored from audit history.', 400);
  }

  // Determine public status based on key sensitivity
  $isPublic =
    ($settingGroup === 'api' && $settingKey === 'config') ||
    ($settingGroup === 'contact' && $settingKey === 'forms') ||
    SecurityHelper::isSensitiveKey($settingKey)
      ? 0
      : 1;

  $lockSuffix = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
  $beforeStmt = $pdo->prepare(
    'SELECT id, setting_group, setting_key, setting_value FROM settings WHERE setting_group = ? AND setting_key = ?' .
      $lockSuffix,
  );
  $beforeStmt->execute([$settingGroup, $settingKey]);
  $beforeSnapshot = DataBoundary::row($beforeStmt->fetch(PDO::FETCH_ASSOC));
  if (!$beforeSnapshot) {
    ResponseHelper::sendError('Setting not found', 404);
  }

  try {
    // Update the setting
    $updateStmt = $pdo->prepare("
          UPDATE settings 
          SET setting_value = ?, 
              updated_by = ?,
              is_public = ?,
              version = version + 1
          WHERE setting_group = ? AND setting_key = ?
      ");

    $updateStmt->execute([$rollbackValue, $userId, $isPublic, $settingGroup, $settingKey]);
  } catch (PDOException $qe) {
    // RESILIENCE: Handle missing 'is_public' column during OTA update transition
    if (
      strpos($qe->getMessage(), 'is_public') !== false ||
      strpos($qe->getMessage(), 'updated_by') !== false
    ) {
      $legacyUpdate = $pdo->prepare("
          UPDATE settings
          SET setting_value = ?,
              version = version + 1
          WHERE setting_group = ? AND setting_key = ?
      ");
      $legacyUpdate->execute([$rollbackValue, $settingGroup, $settingKey]);
      $updateStmt = $legacyUpdate;
    } else {
      throw $qe;
    }
  }

  if ($updateStmt->rowCount() === 0) {
    $pdo->rollBack();
    ResponseHelper::sendError('Setting not found', 404);
  }

  voncms_record_setting_audit(
    $pdo,
    $settingGroup,
    $settingKey,
    $beforeSnapshot,
    $rollbackValue === null ? null : (string) $rollbackValue,
    $userId,
  );
  if ($settingGroup === 'general' && $settingKey === 'maintenance_mode') {
    if (!in_array($rollbackValue, ['0', '1', 'false', 'true'], true)) {
      throw new RuntimeException('Invalid maintenance mode history value.');
    }
    $maintenanceFlagTouched = true;
    voncms_apply_maintenance_flag(
      $maintenanceFlagFile,
      in_array($rollbackValue, ['1', 'true'], true),
    );
  }
  $pdo->commit();
  $settingsCommitted = true;
  voncms_public_cache_clear();

  $mirrorWarning = null;
  try {
    voncms_write_settings_json_mirror(
      __DIR__ . '/../data/site_settings.json',
      voncms_read_settings_mirror($pdo),
    );
  } catch (Throwable $mirrorError) {
    error_log('Settings rollback mirror refresh failed: ' . $mirrorError->getMessage());
    $mirrorWarning =
      'Setting restored in database, but the legacy JSON mirror could not be refreshed.';
  }

  echo json_encode([
    'success' => true,
    'message' => 'Setting rolled back successfully',
    'setting_group' => $settingGroup,
    'setting_key' => $settingKey,
    'rolled_back_to' => $rollbackValue,
    'warning' => $mirrorWarning,
  ]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  if (!$settingsCommitted && $maintenanceFlagTouched) {
    try {
      voncms_apply_maintenance_flag($maintenanceFlagFile, $maintenanceFlagPreviouslyEnabled);
    } catch (Throwable $restoreError) {
      error_log('Settings rollback maintenance recovery failed: ' . $restoreError->getMessage());
    }
  }
  ResponseHelper::sendError($e);
}
