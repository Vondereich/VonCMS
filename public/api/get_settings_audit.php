<?php
/**
 * VonCMS - Settings Audit Log Viewer
 * View history of all settings changes
 * SECURITY: Primary-admin-only access
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/settings_audit_helper.php';

// 2. Send Headers immediately
sendApiHeaders('GET, OPTIONS');

// 3. Exit for Preflight (Zero logic execution for OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

SessionManager::requirePrimaryAdmin();

try {
  voncms_purge_sensitive_setting_audit_history($pdo);

  // Get filter parameters
  $settingId = isset($_GET['setting_id']) ? intval($_GET['setting_id']) : null;
  $settingKey = isset($_GET['setting_key']) ? trim((string) $_GET['setting_key']) : null;
  $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
  $limit = max(1, min(200, $limit));

  // Build query
  $sql = "SELECT 
                al.id,
                al.setting_id,
                al.setting_group,
                al.setting_key,
                al.old_value,
                al.new_value,
                al.change_type,
                al.changed_at,
                u.username as changed_by_username,
                al.ip_address,
                al.user_agent
            FROM settings_audit_log al
            LEFT JOIN users u ON al.changed_by = u.id
            WHERE 1=1";

  $params = [];

  if ($settingId) {
    $sql .= ' AND al.setting_id = :setting_id';
    $params[':setting_id'] = $settingId;
  }

  if ($settingKey !== null && $settingKey !== '') {
    $sql .= ' AND al.setting_key = :setting_key';
    $params[':setting_key'] = $settingKey;
  }

  $sql .= ' ORDER BY al.changed_at DESC LIMIT :limit';

  $stmt = $pdo->prepare($sql);
  foreach ($params as $name => $value) {
    $stmt->bindValue($name, $value);
  }
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->execute();
  $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Format output
  foreach ($logs as &$log) {
    // Truncate long values for display
    $oldValue = (string) ($log['old_value'] ?? '');
    $newValue = (string) ($log['new_value'] ?? '');

    if (strlen($oldValue) > 200) {
      $log['old_value_preview'] = substr($oldValue, 0, 200) . '...';
    }
    if (strlen($newValue) > 200) {
      $log['new_value_preview'] = substr($newValue, 0, 200) . '...';
    }
  }

  echo json_encode([
    'success' => true,
    'logs' => $logs,
    'count' => count($logs),
  ]);
} catch (Throwable $e) {
  ResponseHelper::sendError($e instanceof Exception ? $e : $e->getMessage());
}
