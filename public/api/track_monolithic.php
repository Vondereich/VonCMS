<?php
/**
 * VonCMS - Monolithic Tracking API
 * Replaces separate track_visit and track_view for CPU efficiency.
 * Selaras dengan architecture Singularity v2.0.
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

// 0. Enforce CSRF
CSRFProtection::requireToken();

// 1. Get Input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}
$url = mb_substr(trim((string) ($input['url'] ?? '')), 0, 500);
$referrer = mb_substr(trim((string) ($input['referrer'] ?? '')), 0, 500);
$postId =
  isset($input['postId']) && preg_match('/^\d+$/', (string) $input['postId'])
    ? (int) $input['postId']
    : null;
$pageId =
  isset($input['pageId']) && preg_match('/^\d+$/', (string) $input['pageId'])
    ? (int) $input['pageId']
    : null;
$userAgent = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 1000);

// 2. Visit Tracking (Analytics Table)
$ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('Y-m'));
$throttleMinutes = 30;

try {
  // Check if IP already logged recently (Throttling)
  $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM analytics 
        WHERE ip_hash = ? 
        AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    ");
  $stmt->execute([$ipHash, $throttleMinutes]);
  $recentLogs = $stmt->fetchColumn();

  $visitRecorded = false;
  if ($recentLogs == 0) {
    $stmt = $pdo->prepare(
      'INSERT INTO analytics (page_url, referrer, user_agent, ip_hash, visit_date, visit_time) VALUES (?, ?, ?, ?, CURDATE(), CURTIME())',
    );
    $stmt->execute([$url, $referrer, $userAgent, $ipHash]);
    $visitRecorded = true;
  }

  // 3. View Tracking (Posts/Pages Counter)
  $viewRecorded = false;
  if ($postId) {
    $stmt = $pdo->prepare(
      'UPDATE posts SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ?',
    );
    $stmt->execute([$postId]);
    $viewRecorded = true;
  } elseif ($pageId) {
    $stmt = $pdo->prepare(
      'UPDATE pages SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ?',
    );
    $stmt->execute([$pageId]);
    $viewRecorded = true;
  }

  // 4. Auto-Purge (1 in 100 requests)
  if (rand(1, 100) === 1) {
    $pdo->exec('DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
  }

  echo json_encode([
    'success' => true,
    'visit' => $visitRecorded,
    'view' => $viewRecorded,
    'throttled' => $recentLogs > 0,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
