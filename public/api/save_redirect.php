<?php
/**
 * VonCMS - Save Redirect API
 * Create or update 301 redirect rules.
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/redirect_loop_helper.php';

// Security: Admin Only
SessionManager::requireAdmin();
CSRFProtection::requireToken();

// Get JSON payload
$data = json_decode(file_get_contents('php://input'), true);

$id = $data['id'] ?? null;
$sourceUrl = trim($data['source_url'] ?? '');
$targetUrl = trim($data['target_url'] ?? '');
$redirectType = (int) ($data['redirect_type'] ?? 301);

// Validation
if (empty($sourceUrl) || empty($targetUrl)) {
  ResponseHelper::sendError('Source URL and Target URL are required.', 400);
}

// Sanitize: Ensure source starts with /
if (strpos($sourceUrl, '/') !== 0) {
  $sourceUrl = '/' . $sourceUrl;
}

// Remove trailing slash (except root)
if ($sourceUrl !== '/' && substr($sourceUrl, -1) === '/') {
  $sourceUrl = rtrim($sourceUrl, '/');
}

// Normalize target path for loop detection. The redirect engine matches by path only,
// so query strings or fragments cannot be treated as a different destination.
$currentHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
$basePath = voncms_get_redirect_loop_base_path($pdo);
$targetPath = voncms_normalize_redirect_loop_path($targetUrl, $currentHost, $basePath);

// Prevent obvious redirect loops
if ($sourceUrl === $targetUrl || ($targetPath !== '' && $sourceUrl === $targetPath)) {
  ResponseHelper::sendError('Source and Target URLs cannot be the same (redirect loop).', 400);
}

// Prevent simple and multi-hop local loops like /a -> /b and /b -> /a
// or /a -> /b -> /c -> /a.
if ($targetPath !== '') {
  $lookupStmt = $pdo->prepare(
    'SELECT id, source_url, target_url FROM redirects WHERE source_url = ?' .
      ($id ? ' AND id != ?' : '') .
      ' LIMIT 1',
  );

  $visitedPaths = [$sourceUrl => true];
  $currentPath = $targetPath;

  for ($hop = 0; $hop < 20 && $currentPath !== ''; $hop++) {
    if (isset($visitedPaths[$currentPath])) {
      ResponseHelper::sendError('This redirect would create a loop with an existing rule.', 400);
    }

    $visitedPaths[$currentPath] = true;
    $lookupStmt->execute($id ? [$currentPath, $id] : [$currentPath]);
    $existingRule = $lookupStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existingRule) {
      break;
    }

    $currentPath = voncms_normalize_redirect_loop_path(
      (string) ($existingRule['target_url'] ?? ''),
      $currentHost,
      $basePath,
    );
  }
}

// Valid redirect types
if (!in_array($redirectType, [301, 302, 307, 308])) {
  $redirectType = 301;
}

try {
  if ($id) {
    // Update existing
    $stmt = $pdo->prepare(
      'UPDATE redirects SET source_url = ?, target_url = ?, redirect_type = ? WHERE id = ?',
    );
    $stmt->execute([$sourceUrl, $targetUrl, $redirectType, $id]);
    echo json_encode(['success' => true, 'message' => 'Redirect updated.']);
  } else {
    // Create new
    $stmt = $pdo->prepare(
      'INSERT INTO redirects (source_url, target_url, redirect_type) VALUES (?, ?, ?)',
    );
    $stmt->execute([$sourceUrl, $targetUrl, $redirectType]);
    $newId = $pdo->lastInsertId();
    echo json_encode(['success' => true, 'message' => 'Redirect created.', 'id' => $newId]);
  }
} catch (PDOException $e) {
  if (strpos($e->getMessage(), 'Duplicate') !== false) {
    ResponseHelper::sendError('A redirect for this source URL already exists.', 409);
  } else {
    ResponseHelper::sendError($e);
  }
}
