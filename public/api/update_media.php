<?php
/**
 * VonCMS - Update Media Metadata API
 * Allows updating Alt Text, Caption, and Description
 */
require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 1. Load Config (connect to DB)
require_once __DIR__ . '/../von_config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit();
}

// 2. Verify Member Auth & CSRF
CSRFProtection::requireToken();
SessionManager::requireMediaAccess(); // Enforces valid session + Staff role

// 2. Get Input
$input = json_decode(CSRFProtection::getRequestBody(), true);

$id = isset($input['id']) && is_numeric($input['id']) ? (int) $input['id'] : null;
$path = isset($input['path']) ? trim($input['path']) : null;

// Handle Smart Lookup: Find ID by path if ID is missing
if (!$id && $path) {
  // 1. Clean & Normalize Path
  $cleanPath = ltrim(preg_replace('/^https?:\/\/[^\/]+\//i', '', $path), '/');
  $normalizedDbPath = ltrim(str_replace('\\', '/', $cleanPath), '/');

  // 2. Extra Clean: Take everything after 'uploads/' if present
  if (strpos($normalizedDbPath, 'uploads/') !== false) {
    $normalizedDbPath = substr($normalizedDbPath, strpos($normalizedDbPath, 'uploads/'));
  }

  // 3. Prepare variants for lookup (Exact Match)
  $pathVariants = [
    $normalizedDbPath,
    '/' . $normalizedDbPath,
    'uploads/' . $normalizedDbPath,
    '/uploads/' . $normalizedDbPath,
    ltrim($normalizedDbPath, 'uploads/'),
  ];
  $pathVariants = array_unique(array_filter($pathVariants));

  // Strategy 1: Exact Match
  $placeholders = implode(',', array_fill(0, count($pathVariants), '?'));
  $findStmt = $pdo->prepare(
    "SELECT id FROM media WHERE filepath IN ($placeholders) OR filename = ? LIMIT 1",
  );
  $findStmt->execute(array_merge($pathVariants, [basename($normalizedDbPath)]));
  $row = $findStmt->fetch(PDO::FETCH_ASSOC);

  // Strategy 2: Suffix Match (No LIKE wildcard suffix)
  if (!$row) {
    $findStmt = $pdo->prepare('SELECT id FROM media WHERE filepath LIKE ? LIMIT 1');
    $findStmt->execute(['%' . basename($normalizedDbPath)]);
    $row = $findStmt->fetch(PDO::FETCH_ASSOC);
  }

  if ($row) {
    $id = (int) $row['id'];
  }
}

if (!$id) {
  ResponseHelper::sendError('Valid numeric media ID or identifiable path is required', 400);
}

$altText = isset($input['alt_text']) ? strip_tags(trim($input['alt_text'])) : null;
$caption = isset($input['caption']) ? strip_tags(trim($input['caption'])) : null;
$description = isset($input['description']) ? strip_tags(trim($input['description'])) : null;

// 3. Update Database
try {
  $stmt = $pdo->prepare("
        UPDATE media 
        SET alt_text = :alt, caption = :caption, description = :desc 
        WHERE id = :id
    ");

  $result = $stmt->execute([
    ':alt' => $altText,
    ':caption' => $caption,
    ':desc' => $description,
    ':id' => $id,
  ]);

  if ($result) {
    echo json_encode(['success' => true, 'message' => 'Media updated successfully']);
  } else {
    ResponseHelper::sendError('Failed to update database', 500);
  }
} catch (PDOException $e) {
  ResponseHelper::sendError($e);
}
