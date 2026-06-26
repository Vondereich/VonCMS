<?php
require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

$configPath = __DIR__ . '/../../von_config.php';
if (!file_exists($configPath)) {
  ResponseHelper::sendError('Server Config Error: Config file not found', 500);
}

require_once $configPath;
// Debug Logger
function debug_log($msg)
{
  // Production mode: logging disabled
}

/**
 * @param string $url
 * @return string
 */
function normalize_scan_url($url)
{
  $trimmed = trim((string) $url);
  return $trimmed !== '' ? rtrim($trimmed, '/') : '';
}

/**
 * @param string $url
 * @return string
 */
function get_url_origin($url)
{
  $parts = parse_url((string) $url);
  if (empty($parts['scheme']) || empty($parts['host'])) {
    return '';
  }

  $origin = $parts['scheme'] . '://' . $parts['host'];
  if (!empty($parts['port'])) {
    $origin .= ':' . $parts['port'];
  }

  return rtrim($origin, '/');
}

debug_log('Script accessed. Server Req Method: ' . $_SERVER['REQUEST_METHOD']);
// Session already handled in security.php
SessionManager::requireValidSession();
CSRFProtection::requireToken();

$userRole = strtolower($_SESSION['user']['role'] ?? '');
SessionManager::requirePrimaryAdmin();

debug_log('Config loaded + Auth verified.');
debug_log('Starting scan process... (Phase 2)');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Invalid request method', 405);
}

if (!isset($_FILES['xml_file']) || $_FILES['xml_file']['error'] !== UPLOAD_ERR_OK) {
  ResponseHelper::sendError('File upload failed', 400);
}

$file = $_FILES['xml_file'];
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
debug_log('File uploaded: ' . $file['name'] . ' (Size: ' . $file['size'] . ')');

if (strtolower($ext) !== 'xml') {
  ResponseHelper::sendError('Invalid file type. Only XML allowed.', 400);
}

// Move to temp directory
$uploadDir = __DIR__ . '/../../uploads/temp/';
debug_log('Upload Dir: ' . realpath($uploadDir));

if (!file_exists($uploadDir)) {
  debug_log('Creating dir: ' . $uploadDir);
  mkdir($uploadDir, 0755, true);
}

$tempShield = $uploadDir . '.htaccess';
if (!file_exists($tempShield)) {
  @file_put_contents($tempShield, "Require all denied\nDeny from all\n");
}

$tempPath = $uploadDir . 'wp_import_' . bin2hex(random_bytes(16)) . '.xml';

if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
  ResponseHelper::sendError('Failed to save temporary file', 500);
}

debug_log('File moved to: ' . $tempPath);

// Scan XML for stats
$stats = [
  'posts' => 0,
  'pages' => 0,
  'media' => 0,
  'authors' => [],
];
$sourceSiteUrl = '';
$sourceBlogUrl = '';

try {
  // XXE Protection - disable external entity loading
  if (PHP_VERSION_ID < 80000 && function_exists('libxml_disable_entity_loader')) {
    call_user_func('libxml_disable_entity_loader', true);
  }
  libxml_use_internal_errors(true);

  $reader = new XMLReader();
  if (!$reader->open($tempPath)) {
    throw new Exception('Failed to open XML file at: ' . $tempPath);
  }

  debug_log('XML Reader opened');

  // Debug logging to file
  $debugFile = __DIR__ . '/../../uploads/wp_debug.log';
  file_put_contents($debugFile, "Scan Started: $tempPath\n", FILE_APPEND);

  while ($reader->read()) {
    if ($reader->nodeType == XMLReader::ELEMENT) {
      if ($reader->localName === 'base_site_url' && $sourceSiteUrl === '') {
        $sourceSiteUrl = normalize_scan_url($reader->readString());
        continue;
      }

      if ($reader->localName === 'base_blog_url' && $sourceBlogUrl === '') {
        $sourceBlogUrl = normalize_scan_url($reader->readString());
        continue;
      }

      // Check for Standard WP <item> OR Generic <post>
      if ($reader->name == 'item' || $reader->name == 'post') {
        $node = $reader->expand();
        $dom = new DOMDocument();
        $n = $dom->importNode($node, true);
        $dom->appendChild($n);
        $sxe = simplexml_import_dom($n);

        $namespaces = $sxe->getNamespaces(true);
        $post_type = '';

        // Strategy 1: Smart Namespace Check (WP Standard)
        if (isset($namespaces['wp'])) {
          $post_type = (string) $sxe->children($namespaces['wp'])->post_type;
        }
        // Strategy 2: Direct Child Check (Generic XML or RSS)
        if (empty($post_type)) {
          if (isset($sxe->post_type)) {
            $post_type = (string) $sxe->post_type;
          } elseif ($reader->name == 'post') {
            // If the tag itself is <post>, treat it as a post type
            $post_type = 'post';
          }
        }

        if (($sourceSiteUrl === '' || $sourceBlogUrl === '') && isset($sxe->link)) {
          $itemLink = normalize_scan_url((string) $sxe->link);
          $itemOrigin = get_url_origin($itemLink);
          if ($sourceSiteUrl === '' && $itemOrigin !== '') {
            $sourceSiteUrl = $itemOrigin;
          }
          if ($sourceBlogUrl === '' && $itemOrigin !== '') {
            $sourceBlogUrl = $itemOrigin;
          }
        }

        // Debug log found items
        // file_put_contents($debugFile, "Found Item: Type=$post_type\n", FILE_APPEND);

        if ($post_type === 'post') {
          $stats['posts']++;
        } elseif ($post_type === 'page') {
          $stats['pages']++;
        } elseif ($post_type === 'attachment') {
          $stats['media']++;
        }
      }
    }
  }
  $reader->close();
  debug_log('Scan finished. Stats: ' . json_encode($stats));

  echo json_encode([
    'success' => true,
    'message' => 'Scan complete',
    'stats' => $stats,
    'source_site_url' => $sourceSiteUrl,
    'source_blog_url' => $sourceBlogUrl,
    'temp_file' => basename($tempPath), // Send back filename for next step
  ]);
} catch (Exception $e) {
  debug_log('Exception: ' . $e->getMessage());
  ResponseHelper::sendError($e);
}
