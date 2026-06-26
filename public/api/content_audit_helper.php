<?php

function voncms_get_content_audit_logs_table_sql(): string
{
  return "CREATE TABLE IF NOT EXISTS content_audit_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        content_type ENUM('post', 'page') NOT NULL,
        content_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(32) NOT NULL,
        actor_user_id BIGINT UNSIGNED NULL,
        actor_username VARCHAR(255) NOT NULL DEFAULT '',
        actor_role VARCHAR(64) NOT NULL DEFAULT '',
        summary VARCHAR(255) NOT NULL DEFAULT '',
        context_json LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_content_lookup (content_type, content_id, created_at),
        INDEX idx_actor_user (actor_user_id),
        INDEX idx_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
}

function voncms_ensure_content_audit_logs_table(PDO $pdo): void
{
  $pdo->exec(voncms_get_content_audit_logs_table_sql());
}

function voncms_record_content_audit(
  PDO $pdo,
  string $contentType,
  int $contentId,
  string $action,
  array $actor = [],
  ?string $summary = null,
  array $context = [],
): void {
  $normalizedType = in_array($contentType, ['post', 'page'], true) ? $contentType : 'post';
  $normalizedAction = trim(strtolower($action)) ?: 'update';
  $contextJson = !empty($context)
    ? json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
    : null;

  $stmt = $pdo->prepare(
    'INSERT INTO content_audit_logs (
        content_type,
        content_id,
        action,
        actor_user_id,
        actor_username,
        actor_role,
        summary,
        context_json
      ) VALUES (
        :content_type,
        :content_id,
        :action,
        :actor_user_id,
        :actor_username,
        :actor_role,
        :summary,
        :context_json
      )',
  );

  $stmt->execute([
    'content_type' => $normalizedType,
    'content_id' => $contentId,
    'action' => $normalizedAction,
    'actor_user_id' => isset($actor['id']) && $actor['id'] !== '' ? (int) $actor['id'] : null,
    'actor_username' => isset($actor['username']) ? trim((string) $actor['username']) : '',
    'actor_role' => isset($actor['role']) ? trim((string) $actor['role']) : '',
    'summary' => $summary ? trim($summary) : '',
    'context_json' => $contextJson,
  ]);
}
