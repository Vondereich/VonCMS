<?php

require_once __DIR__ . '/../core/DataBoundary.php';
/**
 * VonCMS - Monolithic Tracking API
 * Replaces separate track_visit and track_view for CPU efficiency.
 * Selaras dengan architecture Singularity v2.0.
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/analytics_consent_helper.php';
require_once __DIR__ . '/post_query_helper.php';
require_once __DIR__ . '/post_views_helper.php';
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
if (!isset($pdo)) {
  ResponseHelper::sendError('Database not configured', 503);
}

// 0. Enforce CSRF
CSRFProtection::requireToken();

// 1. Get Input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}
if (!voncms_analytics_request_allowed()) {
  echo json_encode([
    'success' => true,
    'visit' => false,
    'retry' => false,
    'view' => false,
    'view_throttled' => true,
    'throttled' => true,
  ]);
  exit();
}
$analyticsMode = null;
$recordAnalytics = voncms_native_analytics_allowed($pdo, $_COOKIE, $analyticsMode);
if (!$recordAnalytics && isset($_COOKIE[voncms_analytics_identity_name()])) {
  voncms_analytics_identity_cookie(null, time());
}
$url = $recordAnalytics
  ? mb_substr(trim(DataBoundary::inputText($input['url'] ?? '')), 0, 500)
  : '';
$referrer = $recordAnalytics
  ? mb_substr(trim(DataBoundary::inputText($input['referrer'] ?? '')), 0, 500)
  : '';
$postId =
  isset($input['postId']) &&
  is_scalar($input['postId']) &&
  preg_match('/^\d+$/', (string) $input['postId'])
    ? (int) $input['postId']
    : null;
$pageId =
  isset($input['pageId']) &&
  is_scalar($input['pageId']) &&
  preg_match('/^\d+$/', (string) $input['pageId'])
    ? (int) $input['pageId']
    : null;
$userAgent = $recordAnalytics
  ? mb_substr(DataBoundary::serverString('HTTP_USER_AGENT', ''), 0, 1000)
  : '';

// 2. Visit Tracking (Analytics Table)
$throttleMinutes = 30;

// Analytics is optional. Missing storage must not block content delivery or view counters.
$recentLogs = 0;
$visitRecorded = false;
$visitRetry = false;
if ($recordAnalytics && is_string($analyticsMode)) {
  try {
    $visit = voncms_record_native_visit(
      $pdo,
      $analyticsMode,
      $_COOKIE,
      $url,
      $referrer,
      $userAgent,
    );
    $visitRecorded = $visit['visit'];
    $recentLogs = (int) $visit['throttled'];
    $visitRetry = $visit['retry'];

    if (rand(1, 100) === 1) {
      $pdo->exec(
        'DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY visit_date, id LIMIT 1000',
      );
      if ($analyticsMode === 'balanced') {
        voncms_prune_analytics_sessions($pdo, time());
      }
    }
  } catch (Throwable $analyticsError) {
    $recentLogs = 0;
    $visitRecorded = false;
  }
}

$viewRecorded = false;
$viewThrottled = false;
try {
  if ($postId) {
    if (ContentViewDeduplicator::claim('post', $postId)) {
      $stmt = $pdo->prepare(
        "UPDATE posts SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ? AND (status = 'published' OR status IS NULL)",
      );
      $stmt->execute([$postId]);
      $viewRecorded = $stmt->rowCount() === 1;
      if ($viewRecorded) {
        try {
          voncms_record_daily_post_view($pdo, $postId);
        } catch (Throwable $dailyViewError) {
          // Optional reporting must not undo a recorded lifetime view or release its claim.
          if (rand(1, 100) === 1) {
            error_log('VonCMS daily article views: aggregate write unavailable');
          }
        }
      }
      if (!$viewRecorded) {
        ContentViewDeduplicator::release('post', $postId);
      }
    } else {
      $viewThrottled = true;
    }
  } elseif ($pageId) {
    if (ContentViewDeduplicator::claim('page', $pageId)) {
      $stmt = $pdo->prepare(
        "UPDATE pages SET views = COALESCE(views, 0) + 1, updated_at = updated_at WHERE id = ? AND (status = 'published' OR status IS NULL)",
      );
      $stmt->execute([$pageId]);
      $viewRecorded = $stmt->rowCount() === 1;
      if (!$viewRecorded) {
        ContentViewDeduplicator::release('page', $pageId);
      }
    } else {
      $viewThrottled = true;
    }
  }
} catch (Throwable $viewError) {
  if ($postId) {
    ContentViewDeduplicator::release('post', $postId);
  } elseif ($pageId) {
    ContentViewDeduplicator::release('page', $pageId);
  }
  $viewRecorded = false;
}

echo json_encode([
  'success' => true,
  'visit' => $visitRecorded,
  'retry' => $visitRetry,
  'view' => $viewRecorded,
  'view_throttled' => $viewThrottled,
  'throttled' => $recordAnalytics && $recentLogs > 0,
]);
