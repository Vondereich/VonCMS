<?php

require_once __DIR__ . '/../core/DataBoundary.php';
/**
 * VonCMS - Track Visitor API Smart Session
 * Records page visits for analytics with throttling and auto-purge
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/analytics_consent_helper.php';
require_once __DIR__ . '/post_query_helper.php';
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

if (!isset($pdo)) {
  ResponseHelper::sendError('Database not configured', 503);
}

// Reuse the authorized GET report boundary; visitor tracking and its consent policy are unchanged.
$days = 7;
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['report'] ?? '') === 'articles') {
  require_once __DIR__ . '/post_views_helper.php';
  try {
    $days = DataBoundary::inputInt($_GET['days'] ?? 7);
    $basePath = dirname(
      dirname(str_replace('\\', '/', DataBoundary::serverString('SCRIPT_NAME', ''))),
    );
    echo json_encode([
      'success' => true,
      'articleViews' => voncms_top_articles($pdo, $days, $basePath),
    ]);
  } catch (Throwable $error) {
    ResponseHelper::sendError(
      voncms_post_views_ready()
        ? 'Article view report is temporarily unavailable.'
        : 'Run Database Repair to enable daily article views.',
      503,
    );
  }
  exit();
}

$analyticsMode = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  if (!is_array($input)) {
    ResponseHelper::sendError('Invalid JSON payload', 400);
  }
  if (voncms_tracking_is_automated(DataBoundary::serverString('HTTP_USER_AGENT', ''))) {
    echo json_encode([
      'success' => true,
      'visit' => false,
      'retry' => false,
      'throttled' => false,
      'excluded' => true,
    ]);
    exit();
  }
  if (!voncms_analytics_request_allowed()) {
    echo json_encode(['success' => true, 'visit' => false, 'retry' => false, 'throttled' => true]);
    exit();
  }
  $analyticsMode = null;
  if (!voncms_native_analytics_allowed($pdo, $_COOKIE, $analyticsMode)) {
    if (isset($_COOKIE[voncms_analytics_identity_name()])) {
      voncms_analytics_identity_cookie(null, time());
    }
    echo json_encode([
      'success' => true,
      'visit' => false,
      'message' => 'Visitor analytics disabled',
    ]);
    exit();
  }
}

// ============================================
// AUTO-PURGE: Delete data older than 30 days
// ============================================
if (rand(1, 100) === 1) {
  try {
    $pdo->exec(
      'DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY visit_date, id LIMIT 1000',
    );
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $analyticsMode !== 'strict') {
      voncms_prune_analytics_sessions($pdo, time());
    }
  } catch (Throwable $e) {
    // Analytics is optional; missing storage must not affect or spam public requests.
  }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Record a visit
  $pageUrl = mb_substr(
    trim(DataBoundary::inputText($input['url'] ?? ($_SERVER['REQUEST_URI'] ?? ''))),
    0,
    500,
  );
  $referrer = mb_substr(
    trim(DataBoundary::inputText($input['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? ''))),
    0,
    500,
  );
  $userAgent = mb_substr(DataBoundary::serverString('HTTP_USER_AGENT', ''), 0, 1000);

  try {
    if (!is_string($analyticsMode)) {
      throw new LogicException('Analytics measurement mode is unavailable.');
    }
    $visit = voncms_record_native_visit(
      $pdo,
      $analyticsMode,
      $_COOKIE,
      $pageUrl,
      $referrer,
      $userAgent,
    );
    $message = $visit['visit']
      ? 'Visit recorded'
      : ($visit['throttled']
        ? 'Already tracked'
        : 'Visit tracking unavailable');
    echo json_encode(['success' => true, 'message' => $message] + $visit);
  } catch (Throwable $e) {
    echo json_encode(['success' => true, 'message' => 'Visit tracking unavailable']);
  }
} else {
  try {
    $days = isset($_GET['days']) ? DataBoundary::inputInt($_GET['days']) : 7;
    $days = max(1, min(365, $days));
    $mode = $_GET['mode'] ?? 'strict';
    if (!is_string($mode) || !in_array($mode, ['strict', 'balanced'], true)) {
      ResponseHelper::sendError('Invalid analytics measurement mode', 400);
    }
    $modeReady = voncms_analytics_mode_storage_ready($pdo);
    if ($mode === 'balanced' && !voncms_analytics_balanced_storage_ready($pdo)) {
      echo json_encode([
        'success' => true,
        'analytics' => [
          'daily' => [],
          'totals' => ['total_views' => 0, 'unique_visitors' => 0],
          'period' => $days . ' days',
          'mode' => $mode,
          'needsRepair' => true,
        ],
      ]);
      exit();
    }
    $modeWhere = $modeReady ? ' AND measurement_mode = ?' : '';
    $reportParams = $modeReady ? [$days, $mode] : [$days];
    $dailyIndexHint = voncms_query_index_hint($pdo, 'analytics', 'idx_visit_daily');

    // Get visits per day
    $stmt = $pdo->prepare("
            SELECT visit_date, COUNT(*) as visits, COUNT(DISTINCT ip_hash) as unique_visitors
            FROM analytics{$dailyIndexHint}
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY){$modeWhere}
            GROUP BY visit_date
            ORDER BY visit_date ASC
        ");
    $stmt->execute($reportParams);
    $dailyStats = DataBoundary::rows($stmt->fetchAll(PDO::FETCH_ASSOC));

    // Get total stats
    $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT ip_hash) as unique_visitors
            FROM analytics{$dailyIndexHint}
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) DAY){$modeWhere}
        ");
    $stmt->execute($reportParams);
    $totals = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

    echo json_encode([
      'success' => true,
      'analytics' => [
        'daily' => $dailyStats,
        'totals' => $totals,
        'period' => $days . ' days',
        'mode' => $mode,
      ],
    ]);
  } catch (Throwable $e) {
    echo json_encode([
      'success' => true,
      'analytics' => [
        'daily' => [],
        'totals' => ['total_views' => 0, 'unique_visitors' => 0],
        'unavailable' => true,
        'period' => $days . ' days',
      ],
    ]);
  }
}
