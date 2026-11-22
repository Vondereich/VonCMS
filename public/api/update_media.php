<?php

require_once __DIR__ . '/../core/DataBoundary.php';
/**
 * VonCMS - Update Media Metadata API
 * Allows updating Alt Text, Caption, and Description
 */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/role_capability_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 1. Load Config (connect to DB)
require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/media_library_filter_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit();
}

// 2. Verify Member Auth & CSRF
SessionManager::requireValidSession();
if (!voncms_role_has_capability(DataBoundary::userText('role'), 'media.access')) {
  ResponseHelper::sendError('Media access required', 403);
}
CSRFProtection::requireToken();
$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);

// 2. Get Input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

$id = isset($input['id']) && is_numeric($input['id']) ? (int) $input['id'] : null;
$path = isset($input['path']) && is_scalar($input['path']) ? trim((string) $input['path']) : null;
$row = null;

if ($id && $id > 0) {
  $findStmt = $pdo->prepare('SELECT id FROM media WHERE id = ? LIMIT 1');
  $findStmt->execute([$id]);
  $row = DataBoundary::row($findStmt->fetch(PDO::FETCH_ASSOC));
}

// Handle Smart Lookup: Find ID by path if ID is missing
if (!$row && $path) {
  $normalizedPath = voncms_normalize_media_library_path($path);
  if (!voncms_is_safe_media_relative_path($normalizedPath)) {
    ResponseHelper::sendError('Invalid media path', 400);
  }

  $pathVariants = [
    $normalizedPath,
    '/' . $normalizedPath,
    'uploads/' . $normalizedPath,
    '/uploads/' . $normalizedPath,
  ];
  $pathVariants = array_unique(array_filter($pathVariants));

  $placeholders = implode(',', array_fill(0, count($pathVariants), '?'));
  $findStmt = $pdo->prepare("SELECT id FROM media WHERE filepath IN ($placeholders) LIMIT 1");
  $findStmt->execute($pathVariants);
  $row = DataBoundary::row($findStmt->fetch(PDO::FETCH_ASSOC));

  if (!$row && strpos($normalizedPath, '/') === false) {
    $filenameStmt = $pdo->prepare(
      'SELECT id FROM media WHERE filename = ? ORDER BY id ASC LIMIT 2',
    );
    $filenameStmt->execute([$normalizedPath]);
    $filenameMatches = DataBoundary::rows($filenameStmt->fetchAll(PDO::FETCH_ASSOC));
    if (count($filenameMatches) > 1) {
      ResponseHelper::sendError('Media filename is ambiguous. Use the full media path.', 409);
    }
    $row = $filenameMatches[0] ?? null;
  }
}

if (!$row) {
  ResponseHelper::sendError('Media item not found', 404);
}
$id = (int) $row['id'];

$updates = [];
$values = [':id' => $id];
foreach (['alt_text' => 255, 'caption' => 5000, 'description' => 10000] as $field => $limit) {
  if (!array_key_exists($field, $input)) {
    continue;
  }
  if (!is_string($input[$field])) {
    ResponseHelper::sendError('Media metadata must be text', 400);
  }
  $updates[] = $field . ' = :' . $field;
  $values[':' . $field] = mb_substr(strip_tags(trim($input[$field])), 0, $limit);
}
if ($updates === []) {
  ResponseHelper::sendError('No media metadata supplied', 400);
}

// 3. Update Database
try {
  // Column names come only from the fixed allowlist above. Omitted fields stay unchanged.
  $stmt = $pdo->prepare('UPDATE media SET ' . implode(', ', $updates) . ' WHERE id = :id');
  $result = $stmt->execute($values);

  if ($result) {
    echo json_encode(['success' => true, 'message' => 'Media updated successfully']);
  } else {
    ResponseHelper::sendError('Failed to update database', 500);
  }
} catch (PDOException $e) {
  ResponseHelper::sendError($e);
}
