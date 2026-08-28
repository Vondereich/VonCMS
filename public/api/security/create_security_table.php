<?php
/**
 * Create Security Logs Table
 * Migration script for Security Dashboard
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// Compatibility endpoint retained for older admin bundles. Permanent DDL belongs to Database Repair.
SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

if (!isset($pdo) || !$pdo) {
  ResponseHelper::sendError('Database configuration missing', 503);
}

ResponseHelper::sendError(
  'Security log storage is managed by Database Repair. Open Settings > Tools as the primary admin.',
  409,
);
