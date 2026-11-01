<?php

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/role_capability_helper.php';
require_once __DIR__ . '/publication_time_helper.php';
require_once __DIR__ . '/schema_repair_helper.php';
require_once __DIR__ . '/../core/Calendar.php';
sendApiHeaders('GET, POST, DELETE, OPTIONS');
header('Cache-Control: private, no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
  exit();
}
if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) {
  ResponseHelper::sendError('Method not allowed', 405);
}
SessionManager::requireValidSession();
$actor = DataBoundary::actor();
if (!voncms_role_has_capability($actor['role'] ?? '', 'calendar.manage')) {
  ResponseHelper::sendError('Calendar access requires Admin or Moderator permission.', 403);
}
if ($method !== 'GET') {
  CSRFProtection::requireToken();
}
if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}
if (is_file(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}
if (!isset($pdo) || !($pdo instanceof PDO)) {
  ResponseHelper::sendError('Database not configured', 503);
}
voncms_apply_site_timezone($pdo);

try {
  $calendar = new EditorialCalendar($pdo, $actor);
  $calendar->assertStorage();
  if ($method === 'GET') {
    $result = $calendar->read($_GET);
  } else {
    $body = CSRFProtection::getRequestBody();
    if (strlen($body) > 65536) {
      throw new CalendarProblem('Calendar payload is too large.', 413);
    }
    $input = json_decode($body, true);
    if (!is_array($input) || array_is_list($input)) {
      throw new CalendarProblem('Invalid calendar payload.', 400);
    }
    $action = $input['action'] ?? null;
    if ($method === 'POST' && $action !== null && $action !== 'delete') {
      throw new CalendarProblem('Invalid calendar action.', 400);
    }
    if ($method === 'POST' && $action !== 'delete') {
      $result = ['id' => $calendar->save($input)];
    } else {
      $calendar->delete($input);
      $result = [];
    }
  }
  echo json_encode(
    ['success' => true] + $result,
    JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
  );
} catch (CalendarProblem $error) {
  ResponseHelper::sendError($error->getMessage(), $error->getCode());
} catch (Throwable $error) {
  if (voncms_schema_error_requires_repair($error)) {
    ResponseHelper::sendError(
      'Calendar storage requires Database Repair by the Primary Admin.',
      409,
    );
  }
  ResponseHelper::sendError($error);
}
