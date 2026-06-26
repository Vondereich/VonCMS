<?php
/**
 * VonCMS - Database Query Endpoint
 * Admin-only database inspector for the Database Manager UI.
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('POST method required', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

SessionManager::requireValidSession();
CSRFProtection::requireToken();
SessionManager::requirePrimaryAdmin();

if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

/**
 * Normalize and validate a single read-only SQL statement.
 */
function normalizeAdminReadQuery(string $sql): string
{
  $sql = trim($sql);
  if ($sql === '') {
    ResponseHelper::sendError('Query is required', 400);
  }

  $sql = preg_replace('/;+\s*$/', '', $sql);
  if (!is_string($sql) || trim($sql) === '') {
    ResponseHelper::sendError('Query is required', 400);
  }

  // Keep the Database Manager to single-statement inspection queries only.
  if (strpos($sql, ';') !== false) {
    ResponseHelper::sendError('Only single-statement queries are allowed.', 400);
  }

  if (preg_match('/(--|#|\/\*)/', $sql)) {
    ResponseHelper::sendError('SQL comments are not allowed in Database Manager queries.', 400);
  }

  if (!preg_match('/^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $sql)) {
    ResponseHelper::sendError(
      'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed for security reasons.',
      403,
    );
  }

  if (
    preg_match(
      '/\b(INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE|LOAD\s+DATA|BENCHMARK|SLEEP)\b/i',
      $sql,
    )
  ) {
    ResponseHelper::sendError('This query uses blocked SQL functions or file operations.', 403);
  }

  return $sql;
}

/**
 * Fetch tabular results with a hard safety cap.
 * This prevents the Database Manager from exhausting memory on huge reads.
 *
 * @return array{rows: array<int, array<int, mixed>>, truncated: bool}
 */
function fetchLimitedRows(PDOStatement $stmt, int $maxRows = 500): array
{
  $rows = [];
  $count = 0;
  while (($row = $stmt->fetch(PDO::FETCH_NUM)) !== false) {
    if ($count >= $maxRows) {
      return ['rows' => $rows, 'truncated' => true];
    }

    $rows[] = $row;
    $count++;
  }

  return ['rows' => $rows, 'truncated' => false];
}

try {
  // Mode 1: Raw admin read query used by Database Manager.
  if (isset($input['query'])) {
    $sql = normalizeAdminReadQuery((string) $input['query']);
    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    $headers = [];
    for ($i = 0; $i < $stmt->columnCount(); $i++) {
      $col = $stmt->getColumnMeta($i);
      $headers[] = $col['name'] ?? 'column_' . ($i + 1);
    }

    $result = fetchLimitedRows($stmt);
    $message = 'Query executed successfully';
    if ($result['truncated']) {
      $message .= ' (limited to first 500 rows)';
    }

    echo json_encode([
      'success' => true,
      'message' => $message,
      'headers' => $headers,
      'data' => $result['rows'],
      'truncated' => $result['truncated'],
    ]);
    exit();
  }

  // Mode 2: Legacy helper for simple whitelisted table browsing.
  if (isset($input['table'])) {
    $allowedTables = [
      'posts' => 'posts',
      'pages' => 'pages',
      'users' => 'users',
      'comments' => 'comments',
    ];

    $table = (string) $input['table'];
    if (!isset($allowedTables[$table])) {
      ResponseHelper::sendError('Invalid table', 400);
    }

    $limit = isset($input['limit']) ? (int) $input['limit'] : 100;
    $limit = max(1, min(200, $limit));

    $safeTable = $allowedTables[$table];
    $sql = "SELECT * FROM `$safeTable` LIMIT :limit";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode([
      'success' => true,
      'message' => 'Table data fetched successfully',
      'data' => $result,
      'limit' => $limit,
    ]);
    exit();
  }

  ResponseHelper::sendError('Invalid request format. "query" or "table" is required.', 400);
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
