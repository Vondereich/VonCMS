<?php

require_once dirname(__DIR__, 2) . '/security.php';
require_once __DIR__ . '/ActivityLog.php';
sendApiHeaders('GET, POST, OPTIONS');
header('Cache-Control: private, no-store');

$method = DataBoundary::serverString('REQUEST_METHOD');
if ($method === 'OPTIONS') {
  exit(0);
}
SessionManager::requirePrimaryAdmin();
if ($method !== 'GET' && $method !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}
if ($method === 'POST') {
  CSRFProtection::requireToken();
}

$config = dirname(__DIR__, 2) . '/von_config.php';
if (is_file($config)) {
  require_once $config;
}
require_once dirname(__DIR__, 2) . '/scheduler_helper.php';

try {
  $pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
  voncms_apply_site_timezone($pdo);
  $activity = new VonCmsActivityLog($pdo);
  $activity->assertReady();
  if ($method === 'GET') {
    echo json_encode(['success' => true, ...$activity->listing($_GET)]);
    exit();
  }

  $input = json_decode(CSRFProtection::getRequestBody(), true);
  if (!is_array($input)) {
    throw new InvalidArgumentException('Invalid Activity request.');
  }
  $action = $input['action'] ?? null;
  if ($action === 'preview') {
    $preview = $activity->preview();
    $token = bin2hex(random_bytes(32));
    // One short-lived, session-owned preview; the client cannot choose the cutoff or IDs.
    $_SESSION['activity_purge_preview'] = [
      ...$preview,
      'token' => $token,
      'expires' => time() + 600,
    ];
    echo json_encode([
      'success' => true,
      ...$preview,
      'token' => $token,
      'batchSize' => VonCmsActivityLog::PURGE_BATCH,
    ]);
    exit();
  }
  if ($action !== 'purge') {
    throw new InvalidArgumentException('Invalid Activity action.');
  }
  $token = $input['token'] ?? null;
  $preview = $_SESSION['activity_purge_preview'] ?? null;
  if (
    !is_string($token) ||
    !is_array($preview) ||
    !is_string($preview['token'] ?? null) ||
    !hash_equals($preview['token'], $token) ||
    !is_int($preview['expires'] ?? null) ||
    $preview['expires'] < time() ||
    !is_string($preview['before'] ?? null) ||
    !is_int($preview['maxId'] ?? null)
  ) {
    ResponseHelper::sendError('Purge preview expired or invalid. Preview again.', 409);
  }
  $result = $activity->purge(
    DataBoundary::actor(),
    $preview['before'],
    $preview['maxId'],
    hash('sha256', $token),
  );
  // Keep the preview until expiry so a lost response can retry the same receipt safely.
  echo json_encode(['success' => true, ...$result]);
} catch (InvalidArgumentException $error) {
  ResponseHelper::sendError($error->getMessage(), 400);
} catch (Throwable $error) {
  error_log('VonCMS Activity endpoint unavailable: ' . get_class($error));
  ResponseHelper::sendError(
    'Activity Log unavailable. Run Database Repair if upgrading, then retry.',
    503,
  );
}
