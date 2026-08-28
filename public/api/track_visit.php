<?php
/**
 * VonCMS - Track Visitor API Smart Session
 * Records page visits for analytics with throttling and auto-purge
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce CSRF for recording visits
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  CSRFProtection::requireToken();
} else {
  // Analytics statistics are staff-only.
  SessionManager::requireStaff();
}

if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

// CSRF and authorization state are captured above; database work must not serialize the session.

if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

// ============================================
// AUTO-PURGE: Delete data older than 30 days
// ============================================
if (rand(1, 100) === 1) {
  try {
    $pdo->exec('DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
  } catch (Throwable $e) {
    // Analytics is optional; missing storage must not affect or spam public requests.
  }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Record a visit
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  if (!is_array($input)) {
    ResponseHelper::sendError('Invalid JSON payload', 400);
  }
  $pageUrl = mb_substr(trim((string) ($input['url'] ?? ($_SERVER['REQUEST_URI'] ?? ''))), 0, 500);
  $referrer = mb_substr(
    trim((string) ($input['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? ''))),
    0,
    500,
  );
  $userAgent = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 1000);

  // Hash IP for privacy
  $ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('Y-m'));

  $throttleMinutes = 30;

  try {
    $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM analytics 
            WHERE ip_hash = ? 
            AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
        ");
    $stmt->execute([$ipHash, $throttleMinutes]);
    $recentLogs = $stmt->fetchColumn();

    if ($recentLogs > 0) {
      echo json_encode(['success' => true, 'message' => 'Already tracked', 'throttled' => true]);
      exit();
    }

    $stmt = $pdo->prepare(
      'INSERT INTO analytics (page_url, referrer, user_agent, ip_hash, visit_date, visit_time) VALUES (?, ?, ?, ?, CURDATE(), CURTIME())',
    );
    $stmt->execute([$pageUrl, $referrer, $userAgent, $ipHash]);

    echo json_encode(['success' => true, 'message' => 'Visit recorded']);
  } catch (Throwable $e) {
    echo json_encode(['success' => true, 'message' => 'Visit tracking unavailable']);
  }
} else {
  try {
    $days = isset($_GET['days']) ? (int) $_GET['days'] : 7;
    $days = max(1, min(365, $days));

    // Get visits per day
    $stmt = $pdo->prepare("
            SELECT visit_date, COUNT(*) as visits, COUNT(DISTINCT ip_hash) as unique_visitors
            FROM analytics 
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY)
            GROUP BY visit_date
            ORDER BY visit_date ASC
        ");
    $stmt->execute([$days]);
    $dailyStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get total stats
    $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT ip_hash) as unique_visitors
            FROM analytics 
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY)
        ");
    $stmt->execute([$days]);
    $totals = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
      'success' => true,
      'analytics' => [
        'daily' => $dailyStats,
        'totals' => $totals,
        'period' => $days . ' days',
      ],
    ]);
  } catch (Throwable $e) {
    echo json_encode([
      'success' => true,
      'analytics' => [
        'daily' => [],
        'totals' => ['total_views' => 0, 'unique_visitors' => 0],
        'period' => $days . ' days',
      ],
    ]);
  }
}
