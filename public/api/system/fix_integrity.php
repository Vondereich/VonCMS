<?php

/**
 * VonCMS Integrity Check Tool
 * Usage: POST from an authenticated admin session with a CSRF token
 *
 * Purpose: Runs read-only checks for routing and security files.
 * No files are modified by this endpoint.
 */

define('IN_API', true);

$publicPath = realpath(__DIR__ . '/../..');
if ($publicPath === false || !file_exists($publicPath . '/security.php')) {
  $publicPath = dirname(__DIR__, 2);
}

if (file_exists($publicPath . '/security.php')) {
  require_once $publicPath . '/security.php';
}
if (file_exists($publicPath . '/von_config.php')) {
  require_once $publicPath . '/von_config.php';
}

$projectRoot = $publicPath;
if (strcasecmp(basename($publicPath), 'public') === 0) {
  $projectRoot = dirname($publicPath);
}

sendApiHeaders('POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  die(
    json_encode([
      'error' => 'Method Not Allowed. Please use POST from an authenticated admin session.',
      'method' => $_SERVER['REQUEST_METHOD'],
    ])
  );
}

SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

/**
 * @param string $content
 * @return bool
 */
function hasManagedFragmentNoise($content)
{
  $content = (string) $content;
  $firstMarkerPos = strpos($content, '# BEGIN VonCMS');
  if ($firstMarkerPos === false || $firstMarkerPos === 0) {
    return false;
  }

  $prefix = substr($content, 0, $firstMarkerPos);
  $signatures = [
    '# The directives (lines) between "# BEGIN VonCMS" and "# END VonCMS" are',
    'dynamically generated, and should only be modified via VonCMS integrity tools.',
    'PRIORITY 1 - VVIP LANE FOR SOCIAL CRAWLERS',
    '# NORMAL FLOW BELOW',
  ];

  foreach ($signatures as $signature) {
    if (stripos($prefix, $signature) !== false) {
      return true;
    }
  }

  return false;
}

/**
 * @param string $filePath
 * @param string $label
 * @return array<string, mixed>
 */
function analyzeHtaccessState($filePath, $label)
{
  $state = [
    'label' => $label,
    'path' => $filePath,
    'exists' => file_exists($filePath),
    'readable' => false,
    'beginMarkers' => 0,
    'endMarkers' => 0,
    'legacyTemplate' => false,
    'corruptedManagedFragment' => false,
    'healthy' => false,
    'issues' => [],
  ];

  if (!$state['exists']) {
    $state['issues'][] = '.htaccess file is missing.';
    return $state;
  }

  $content = @file_get_contents($filePath);
  if ($content === false) {
    $state['issues'][] = '.htaccess file could not be read.';
    return $state;
  }

  $state['readable'] = true;
  $state['beginMarkers'] = preg_match_all('/^[ \t]*# BEGIN VonCMS\r?$/m', $content);
  $state['endMarkers'] = preg_match_all('/^[ \t]*# END VonCMS\r?$/m', $content);
  $state['legacyTemplate'] = strpos($content, '## VonCMS Universal .htaccess') !== false;
  $state['corruptedManagedFragment'] = hasManagedFragmentNoise($content);

  if ($state['beginMarkers'] === 0 || $state['endMarkers'] === 0) {
    $state['issues'][] = 'Managed VonCMS block is missing.';
  }
  if ($state['beginMarkers'] !== $state['endMarkers']) {
    $state['issues'][] = 'Managed block markers are unbalanced.';
  }
  if ($state['beginMarkers'] > 1) {
    $state['issues'][] = 'Duplicate VonCMS managed blocks detected.';
  }
  if ($state['legacyTemplate']) {
    $state['issues'][] = 'Legacy .htaccess template detected.';
  }
  if ($state['corruptedManagedFragment']) {
    $state['issues'][] = 'Corrupted managed fragment detected before the first VonCMS block.';
  }

  $state['healthy'] = empty($state['issues']);
  return $state;
}

/**
 * @param string $publicPath
 * @param string $projectRoot
 * @return array<string, mixed>
 */
function analyzeUploadsShieldState($publicPath, $projectRoot)
{
  $uploadsDir = $publicPath . '/uploads';
  if (!is_dir($uploadsDir)) {
    $fallbackDir = $projectRoot . '/uploads';
    if (is_dir($fallbackDir)) {
      $uploadsDir = $fallbackDir;
    }
  }

  $state = [
    'path' => $uploadsDir,
    'directoryExists' => is_dir($uploadsDir),
    'shieldExists' => false,
    'readable' => false,
    'healthy' => true,
    'issues' => [],
  ];

  if (!$state['directoryExists']) {
    $state['issues'][] = 'Uploads directory not found. Shield check skipped.';
    return $state;
  }

  $shieldPath = $uploadsDir . '/.htaccess';
  $state['path'] = $shieldPath;
  $state['shieldExists'] = file_exists($shieldPath);

  if (!$state['shieldExists']) {
    $state['healthy'] = false;
    $state['issues'][] = 'Uploads Shield .htaccess is missing.';
    return $state;
  }

  $shieldContent = @file_get_contents($shieldPath);
  if ($shieldContent === false) {
    $state['healthy'] = false;
    $state['issues'][] = 'Uploads Shield .htaccess could not be read.';
    return $state;
  }

  $state['readable'] = true;
  if (
    strpos($shieldContent, 'Require all denied') === false ||
    strpos($shieldContent, 'Options -Indexes') === false
  ) {
    $state['healthy'] = false;
    $state['issues'][] = 'Uploads Shield .htaccess does not contain the expected deny rules.';
  }

  return $state;
}

/**
 * @param array<int, string> $checks
 * @param string $title
 * @param array<string, mixed> $state
 * @return void
 */
function appendHtaccessChecks(&$checks, $title, $state)
{
  if (!empty($state['sharedWithProjectRoot'])) {
    $checks[] = 'INFO: ' . $title . ' shares the project root .htaccess in this installation.';
    return;
  }

  if ($state['healthy']) {
    $checks[] = 'OK: ' . $title . ' looks healthy.';
    return;
  }

  foreach ($state['issues'] as $issue) {
    $checks[] = 'WARN: ' . $title . ' - ' . $issue;
  }
}

$checks = [];
$rootHtaccess = analyzeHtaccessState($projectRoot . '/.htaccess', 'project_root');
appendHtaccessChecks($checks, 'Project Root .htaccess', $rootHtaccess);

if ($publicPath !== $projectRoot) {
  $publicHtaccess = analyzeHtaccessState($publicPath . '/.htaccess', 'public');
} else {
  $publicHtaccess = [
    'label' => 'public',
    'path' => $publicPath . '/.htaccess',
    'sharedWithProjectRoot' => true,
    'healthy' => $rootHtaccess['healthy'],
    'issues' => [],
  ];
}
appendHtaccessChecks($checks, 'Public .htaccess', $publicHtaccess);

$uploadsShield = analyzeUploadsShieldState($publicPath, $projectRoot);
if ($uploadsShield['healthy']) {
  $checks[] = 'OK: Uploads Shield looks healthy.';
} else {
  foreach ($uploadsShield['issues'] as $issue) {
    $checks[] = 'WARN: Uploads Shield - ' . $issue;
  }
}

$integrityNeeded = SecurityHelper::isIntegrityCompromised();
$repairRecommended =
  $integrityNeeded ||
  !$rootHtaccess['healthy'] ||
  (empty($publicHtaccess['sharedWithProjectRoot']) && !$publicHtaccess['healthy']) ||
  !$uploadsShield['healthy'];

$response = [
  'status' => $repairRecommended ? 'warning' : 'success',
  'success' => true,
  'mode' => 'read_only_check',
  'message' => 'Integrity check completed. No files were modified.',
  'integrityNeeded' => $integrityNeeded,
  'repairRecommended' => $repairRecommended,
  'checks' => $checks,
  'rootHtaccess' => $rootHtaccess,
  'publicHtaccess' => $publicHtaccess,
  'uploadsShield' => $uploadsShield,
];

header('Content-Type: application/json');
echo json_encode($response);
