<?php
/**
 * VonCMS - Settings Rollback API
 * Rollback a setting to a previous version from audit log
 * SECURITY: Primary-admin-only access
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
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
$auditLogId = $input['audit_log_id'] ?? null;

if (!$auditLogId) {
  ResponseHelper::sendError('audit_log_id required', 400);
}

$userId = $_SESSION['user']['id'] ?? null;

try {
  $pdo->beginTransaction();

  // Get the audit log entry
  $stmt = $pdo->prepare('SELECT * FROM settings_audit_log WHERE id = ?');
  $stmt->execute([$auditLogId]);
  $auditEntry = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$auditEntry) {
    $pdo->rollBack();
    ResponseHelper::sendError('Audit log entry not found', 404);
  }

  // Rollback to old_value
  $rollbackValue = $auditEntry['old_value'];
  $settingGroup = $auditEntry['setting_group'];
  $settingKey = $auditEntry['setting_key'];

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

  $pdo->commit();
  voncms_public_cache_clear();

  echo json_encode([
    'success' => true,
    'message' => 'Setting rolled back successfully',
    'setting_group' => $settingGroup,
    'setting_key' => $settingKey,
    'rolled_back_to' => $rollbackValue,
  ]);
} catch (Exception $e) {
  $pdo->rollBack();
  ResponseHelper::sendError($e);
}
