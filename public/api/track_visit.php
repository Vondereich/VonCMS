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

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce CSRF for recording visits
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  CSRFProtection::requireToken();
}

if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

// Auto-migration: Create analytics table if not exists
try {
  $pdo->exec("CREATE TABLE IF NOT EXISTS analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page_url VARCHAR(500),
        referrer VARCHAR(500),
        user_agent TEXT,
        ip_hash VARCHAR(64),
        visit_date DATE,
        visit_time TIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_date (visit_date),
        INDEX idx_ip_date (ip_hash, visit_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (PDOException $e) {
  error_log('Analytics table creation: ' . $e->getMessage());
}

// ============================================
// AUTO-PURGE: Delete data older than 30 days
// ============================================
if (rand(1, 100) === 1) {
  try {
    $pdo->exec('DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
  } catch (PDOException $e) {
    error_log('Analytics auto-purge: ' . $e->getMessage());
  }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Record a visit
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  $pageUrl = $input['url'] ?? ($_SERVER['REQUEST_URI'] ?? '');
  $referrer = $input['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

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
  } catch (Exception $e) {
    ResponseHelper::sendError($e);
  }
} else {
  // SECURITY: Stats are for staff only
  SessionManager::requireStaff();

  try {
    $days = isset($_GET['days']) ? (int) $_GET['days'] : 7;
    if ($days < 1) {
      $days = 7;
    }

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
                COUNT(DISTINCT ip_hash) as unique_visitors,
                COUNT(DISTINCT page_url) as pages_viewed
            FROM analytics 
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY)
        ");
    $stmt->execute([$days]);
    $totals = $stmt->fetch(PDO::FETCH_ASSOC);

    // Get top pages
    $stmt = $pdo->prepare("
            SELECT page_url, COUNT(*) as views 
            FROM analytics 
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY)
            GROUP BY page_url
            ORDER BY views DESC
            LIMIT 10
        ");
    $stmt->execute([$days]);
    $topPages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
      'success' => true,
      'analytics' => [
        'daily' => $dailyStats,
        'totals' => $totals,
        'topPages' => $topPages,
        'period' => $days . ' days',
      ],
    ]);
  } catch (Exception $e) {
    ResponseHelper::sendError($e);
  }
}
