<?php
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

SessionManager::requireValidSession();

$contentType = strtolower((string) ($_GET['type'] ?? 'post'));
$contentId = (int) ($_GET['id'] ?? 0);
$currentRole = strtolower((string) ($_SESSION['user']['role'] ?? ''));

if (!in_array($contentType, ['post', 'page'], true)) {
  ResponseHelper::sendError('Invalid content type', 400);
}

if ($contentId <= 0) {
  ResponseHelper::sendError('Valid content ID is required', 400);
}

$canViewLogs =
  $contentType === 'page'
    ? in_array($currentRole, ['admin', 'root', 'moderator'], true)
    : in_array($currentRole, ['admin', 'root', 'moderator', 'writer'], true);

if (!$canViewLogs) {
  ResponseHelper::sendError('Not authorized to view edit history', 403);
}

try {
  if (!isset($pdo)) {
    ResponseHelper::sendError('Database not configured', 503);
  }

  try {
    voncms_ensure_content_audit_logs_table($pdo);
  } catch (Throwable $tableError) {
    echo json_encode(['success' => true, 'logs' => []]);
    exit();
  }

  $stmt = $pdo->prepare(
    'SELECT id, content_type, content_id, action, actor_user_id, actor_username, actor_role, summary, context_json, created_at
     FROM content_audit_logs
     WHERE content_type = :content_type AND content_id = :content_id
     ORDER BY created_at DESC, id DESC
     LIMIT 50',
  );
  $stmt->execute([
    'content_type' => $contentType,
    'content_id' => $contentId,
  ]);

  $logs = array_map(
    static function (array $row): array {
      $context = null;
      if (!empty($row['context_json'])) {
        $decoded = json_decode((string) $row['context_json'], true);
        if (is_array($decoded)) {
          $context = $decoded;
        }
      }

      return [
        'id' => (string) ($row['id'] ?? ''),
        'contentType' => (string) ($row['content_type'] ?? ''),
        'contentId' => (string) ($row['content_id'] ?? ''),
        'action' => (string) ($row['action'] ?? ''),
        'actorUserId' => isset($row['actor_user_id']) ? (string) $row['actor_user_id'] : null,
        'actorUsername' => (string) ($row['actor_username'] ?? ''),
        'actorRole' => (string) ($row['actor_role'] ?? ''),
        'summary' => (string) ($row['summary'] ?? ''),
        'context' => $context,
        'createdAt' => (string) ($row['created_at'] ?? ''),
      ];
    },
    $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
  );

  echo json_encode([
    'success' => true,
    'logs' => $logs,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
