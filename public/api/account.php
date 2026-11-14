<?php
/** Private, session-owned staff account and personal AI credential controls. */
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/ai_provider_helper.php';
sendApiHeaders('GET, POST, OPTIONS');
header('Cache-Control: private, no-store, max-age=0');
header('Pragma: no-cache');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit();
}
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
  ResponseHelper::sendError('Method not allowed', 405);
}
SessionManager::requireValidSession();
if (!voncms_role_has_capability(DataBoundary::userText('role'), 'posts.create')) {
  ResponseHelper::sendError('Staff account required.', 403);
}
$userId = DataBoundary::userText('id');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  CSRFProtection::requireToken();
}
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}
$pdo = DataBoundary::optionalDatabase($GLOBALS['pdo'] ?? null);
try {
  $pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);
  // This API never accepts a target user, even from an administrator.
  if (array_diff(array_keys($_GET), ['section']) !== []) {
    throw new InvalidArgumentException('Target account parameters are not accepted.');
  }
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['section']) && $_GET['section'] !== 'ai') {
      throw new InvalidArgumentException('Unknown account section.');
    }
    if (($_GET['section'] ?? '') === 'ai') {
      $pdo->beginTransaction();
      $config = voncms_ai_lock_config($pdo, false);
      voncms_ai_own_account($pdo, $userId);
      $status = voncms_ai_personal_projection(voncms_ai_personal_row($pdo, $userId), $userId);
      $shared = voncms_ai_configured_key($config) !== '';
      $pdo->commit();
      echo json_encode([
        'success' => true,
        'accountId' => $userId,
        'credential' => $status,
        'sharedAvailable' => $shared,
      ]);
    } else {
      $user = voncms_ai_own_account($pdo, $userId);
      $user['avatar'] = ResponseHelper::scrubAvatarUrl($user['avatar'] ?? '');
      echo json_encode(['success' => true, 'user' => $user]);
    }
    exit();
  }
  $input = json_decode(CSRFProtection::getRequestBody(), true);
  if (
    !is_array($input) ||
    array_diff(array_keys($input), [
      'action',
      'key',
      'revision',
      'expireAfter30Days',
      'expectedUserId',
    ]) !== [] ||
    !in_array($input['action'] ?? null, ['save', 'remove'], true) ||
    !is_string($input['revision'] ?? null) ||
    !is_string($input['expectedUserId'] ?? null) ||
    (array_key_exists('key', $input) && !is_string($input['key'])) ||
    (array_key_exists('expireAfter30Days', $input) && !is_bool($input['expireAfter30Days'])) ||
    ($input['revision'] !== '' && preg_match('/^[a-f0-9]{64}$/D', $input['revision']) !== 1)
  ) {
    throw new InvalidArgumentException('Invalid personal key request.');
  }
  // An assertion against session switches, never a target selector.
  if (!hash_equals($userId, $input['expectedUserId'])) {
    throw new RuntimeException('Your signed-in account changed. Reload before saving.', 409);
  }
  $status = voncms_ai_save_personal(
    $pdo,
    $userId,
    $input['action'],
    trim($input['key'] ?? ''),
    $input['revision'],
    $input['expireAfter30Days'] ?? false,
  );
  echo json_encode(['success' => true, 'credential' => $status]);
} catch (Throwable $error) {
  if ($pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  if ($error instanceof InvalidArgumentException) {
    ResponseHelper::sendError($error->getMessage(), 400);
  }
  $status = in_array($error->getCode(), [400, 403, 409], true) ? (int) $error->getCode() : 503;
  error_log('VonCMS own-account action unavailable: ' . $status);
  ResponseHelper::sendError(
    $status === 503
      ? 'Personal AI storage is unavailable. Run Database Repair or restore the matching private encryption key; nothing was confirmed saved.'
      : $error->getMessage(),
    $status,
  );
}
