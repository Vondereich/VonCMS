<?php

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
