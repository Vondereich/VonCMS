<?php
/**
 * VonCMS - Redirect Loop Scanner API
 * Scans existing redirect rules for self-loops and local redirect cycles.
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

require_once __DIR__ . '/../von_config.php';
require_once __DIR__ . '/redirect_loop_helper.php';

SessionManager::requireAdmin();

$currentHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
$basePath = voncms_get_redirect_loop_base_path($pdo);

try {
  $scan = voncms_scan_redirect_loops($pdo, $currentHost, $basePath);
  echo json_encode([
    'success' => true,
    'summary' => $scan['summary'],
    'issues' => $scan['issues'],
  ]);
} catch (Throwable $e) {
  ResponseHelper::sendError($e);
}
