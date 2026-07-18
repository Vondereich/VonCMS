<?php

function voncms_settings_audit_available(PDO $pdo): bool
{
  static $cache = [];

  $cacheKey = spl_object_id($pdo);
  if (array_key_exists($cacheKey, $cache)) {
    return $cache[$cacheKey];
  }

  try {
    $pdo->query('SELECT 1 FROM settings_audit_log LIMIT 1');
    $cache[$cacheKey] = true;
  } catch (Throwable $e) {
    $cache[$cacheKey] = false;
  }

  return $cache[$cacheKey];
}

function voncms_setting_audit_is_sensitive(string $group, string $key): bool
{
  if (in_array($group, ['smtp', 'api', 'analytics', 'contact'], true)) {
    return true;
  }

  if (in_array($key, ['admin_profile', 'email_smtp', 'indexnow_key'], true)) {
    return true;
  }

  return class_exists('SecurityHelper') && SecurityHelper::isSensitiveKey($key);
}

function voncms_purge_sensitive_setting_audit_history(PDO $pdo): void
{
  if (!voncms_settings_audit_available($pdo)) {
    return;
  }

  try {
    $pdo->exec(
      "DELETE FROM settings_audit_log
       WHERE setting_group IN ('smtp', 'api', 'analytics', 'contact')
          OR setting_key IN ('admin_profile', 'email_smtp', 'indexnow_key')",
    );
  } catch (Throwable $e) {
    error_log('Sensitive settings audit cleanup failed: ' . $e->getMessage());
  }
}

function voncms_get_setting_audit_snapshot(PDO $pdo, string $group, string $key): ?array
{
  try {
    $stmt = $pdo->prepare(
      'SELECT id, setting_group, setting_key, setting_value FROM settings WHERE setting_group = ? AND setting_key = ? LIMIT 1',
    );
    $stmt->execute([$group, $key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
  } catch (Throwable $e) {
    return null;
  }
}

function voncms_record_setting_audit(
  PDO $pdo,
  string $group,
  string $key,
  ?array $beforeSnapshot,
  ?string $newValue,
  ?int $changedBy,
  ?string $changeType = null,
): void {
  if (!voncms_settings_audit_available($pdo)) {
    return;
  }

  if (voncms_setting_audit_is_sensitive($group, $key)) {
    return;
  }

  try {
    $resolvedChangeType = $changeType;
    if ($resolvedChangeType === null || $resolvedChangeType === '') {
      if ($beforeSnapshot === null) {
        $resolvedChangeType = 'INSERT';
      } elseif ((string) ($beforeSnapshot['setting_value'] ?? '') === (string) ($newValue ?? '')) {
        return;
      } else {
        $resolvedChangeType = 'UPDATE';
      }
    }

    $settingId = isset($beforeSnapshot['id']) ? (int) $beforeSnapshot['id'] : 0;
    if ($settingId <= 0 && $resolvedChangeType !== 'DELETE') {
      $afterSnapshot = voncms_get_setting_audit_snapshot($pdo, $group, $key);
      if (!$afterSnapshot || !isset($afterSnapshot['id'])) {
        return;
      }

      $settingId = (int) $afterSnapshot['id'];
    }

    if ($settingId <= 0) {
      return;
    }

    $stmt = $pdo->prepare(
      'INSERT INTO settings_audit_log (
        setting_id,
        setting_group,
        setting_key,
        old_value,
        new_value,
        changed_by,
        change_type,
        ip_address,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->execute([
      $settingId,
      $group,
      $key,
      $beforeSnapshot['setting_value'] ?? null,
      $newValue,
      $changedBy,
      $resolvedChangeType,
      $_SERVER['REMOTE_ADDR'] ?? null,
      $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);
  } catch (Throwable $e) {
    error_log('Settings audit log write failed: ' . $e->getMessage());
  }
}
