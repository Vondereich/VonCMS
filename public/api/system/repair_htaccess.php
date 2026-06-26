<?php

/**
 * VonCMS .htaccess Repair Tool
 * Usage: POST from an authenticated admin session with a CSRF token
 *
 * Purpose: Repairs VonCMS-managed .htaccess blocks and the Uploads Shield.
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

$prefix = file_exists($projectRoot . '/public/index.php') ? 'public/' : '';

/**
 * @param string $prefix
 * @return string
 */
function getHtaccessContent($prefix)
{
  return <<<EOT
  # BEGIN VonCMS
  # The directives (lines) between "# BEGIN VonCMS" and "# END VonCMS" are
  # dynamically generated, and should only be modified via VonCMS integrity tools.
  # Any changes to the directives between these markers will be overwritten.

  # Force PHP priority over static HTML when both exist in root
  DirectoryIndex index.php index.html

  <IfModule mod_rewrite.c>
    RewriteEngine On

    # =====================================================
    # PRIORITY 1 - VVIP LANE FOR SOCIAL CRAWLERS
    # =====================================================

    # Detect social bots (Mark them, don't stop processing)
    RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|Facebot|meta-externalagent|Twitterbot|Pinterest|LinkedInBot|WhatsApp|TelegramBot|Slackbot) [NC]
    RewriteRule ^ - [E=SOCIAL_BOT:1]

    # CRITICAL: Allow Facebook to fetch IMAGES immediately (Skip everything else)
    # Addresses: No cookie, No referer, Query string cache busting
    RewriteCond %{HTTP_USER_AGENT} ^(facebookexternalhit|Facebot|meta-externalagent) [NC]
    RewriteCond %{REQUEST_URI} \.(jpg|jpeg|png|webp|gif|ico|svg)$ [NC]
    RewriteRule ^ - [L]

    # =====================================================
    # NORMAL FLOW BELOW
    # =====================================================

    # FORCE HTTPS (skip on localhost for local dev)
    RewriteCond %{HTTP_HOST} !^(localhost|127\.0\.0\.1) [NC]
    RewriteCond %{HTTPS} off
    RewriteCond %{HTTP:X-Forwarded-Proto} !https
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # WWW CANONICALIZATION (Choose ONE option below)
    # Option A: Force non-www (DEFAULT - strip www)
    RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
    RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

    # Auto-detect base path (no manual RewriteBase needed!)
    RewriteCond %{REQUEST_URI}::\$1 ^(/.+)/(.*)::\\2$
    RewriteRule ^(.*) - [E=BASE:%1]

    # SECURITY BLOCK
    RewriteRule \.(sql|md|json|log|bak|env|zip|lock)$ - [F,L]

    RewriteRule ^von_config\.php$ - [F,L]

    RewriteRule ^composer\.lock$ - [F,L]

    RewriteRule ^package\.json$ - [F,L]

    # Route direct index.html requests through PHP hydration
    RewriteRule ^index\.html$ {$prefix}index.php [L,QSA]

    # Serve real files
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^ - [L]

    # Serve existing directories directly
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # Keep PHP endpoints accessible
    RewriteRule ^(api\.php|index\.php)$ {$prefix}$1 [L]

    # Handle API requests
    RewriteRule ^api/(.*)$ {$prefix}api/$1 [L]

    # Dynamic robots.txt
    RewriteRule ^robots\.txt$ {$prefix}robots.php [L]

    # Dynamic llms.txt (AI/LLM-friendly site summary)
    RewriteRule ^llms\.txt$ {$prefix}llms.php [L]

    # Dynamic sitemap.xml
    RewriteRule ^sitemap\.xml$ {$prefix}sitemap.php [L]

    # RSS feed (clean URL)
    RewriteRule ^rss$ {$prefix}rss.php [L]
    RewriteRule ^rss\.xml$ {$prefix}rss.php [L]
    RewriteRule ^feed$ {$prefix}rss.php [L]
    RewriteRule ^feed\.xml$ {$prefix}rss.php [L]

    # Fallback to index.php for SPA routing
    RewriteRule ^ index.php [L,QSA]
  </IfModule>

  # Security Headers
  <IfModule mod_headers.c>
    Header set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
    Header set X-XSS-Protection "1; mode=block"
    Header set X-Content-Type-Options "nosniff"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set X-Frame-Options "SAMEORIGIN"
    Header unset Server
    Header unset X-Powered-By
  </IfModule>

  # Security - block hidden files
  <FilesMatch "^\.+">
    Require all denied
  </FilesMatch>

  <IfModule mod_mime.c>
  AddType application/javascript .js
  AddType text/css .css
  AddType image/webp .webp
  AddType font/woff2 .woff2
  </IfModule>

  # Prevent directory listing globally
  Options -Indexes

  # ENABLE GZIP COMPRESSION
  <IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
    AddOutputFilterByType DEFLATE application/javascript application/json
    AddOutputFilterByType DEFLATE application/xml image/svg+xml
  </IfModule>
  # END VonCMS
  EOT;
}

/**
 * @param string $content
 * @return int|null
 */
function findManagedNoiseStart($content)
{
  $signatures = [
    '# The directives (lines) between "# BEGIN VonCMS" and "# END VonCMS" are',
    'dynamically generated, and should only be modified via VonCMS integrity tools.',
    'PRIORITY 1 - VVIP LANE FOR SOCIAL CRAWLERS',
    '# NORMAL FLOW BELOW',
  ];

  $noiseStart = null;
  foreach ($signatures as $signature) {
    $pos = stripos($content, $signature);
    if ($pos !== false && ($noiseStart === null || $pos < $noiseStart)) {
      $noiseStart = $pos;
    }
  }

  return $noiseStart;
}

/**
 * @param string $content
 * @return string
 */
function stripCorruptedManagedPrefix($content)
{
  $content = (string) $content;
  $firstMarkerPos = strpos($content, '# BEGIN VonCMS');
  if ($firstMarkerPos === false || $firstMarkerPos === 0) {
    return $content;
  }

  $prefix = substr($content, 0, $firstMarkerPos);
  $noiseStart = findManagedNoiseStart($prefix);
  if ($noiseStart === null) {
    return $content;
  }

  $cleanPrefix = rtrim(substr($prefix, 0, $noiseStart));
  $managedAndAfter = ltrim(substr($content, $firstMarkerPos));

  return $cleanPrefix === '' ? $managedAndAfter : $cleanPrefix . "\n\n" . $managedAndAfter;
}

/**
 * @param string $content
 * @return string
 */
function normalizePreservedHtaccessContent($content)
{
  $normalized = trim((string) $content);
  if ($normalized === '') {
    return '';
  }

  if (
    strpos($normalized, '# BEGIN VonCMS') === false &&
    findManagedNoiseStart($normalized) !== null
  ) {
    return '';
  }

  return $normalized;
}

/**
 * @param string $filePath
 * @param string $prefix
 * @return array{status: string, removedCorruptedPrefix: bool, path: string}
 */
function updateHtaccessWithBlock($filePath, $prefix)
{
  $newBlock = trim(getHtaccessContent($prefix));
  $existingContent = file_exists($filePath) ? (string) file_get_contents($filePath) : '';
  $sanitizedExistingContent = stripCorruptedManagedPrefix($existingContent);
  $blockPattern = '/^[ \t]*# BEGIN VonCMS\r?$[\s\S]*?^[ \t]*# END VonCMS\r?\n?/im';
  $managedBlockCount = preg_match_all('/^[ \t]*# BEGIN VonCMS\r?$/m', $sanitizedExistingContent);
  $removedCorruptedPrefix = $sanitizedExistingContent !== $existingContent;

  if ($managedBlockCount > 0) {
    $remainingContent = trim((string) preg_replace($blockPattern, '', $sanitizedExistingContent));
    $remainingContent = normalizePreservedHtaccessContent($remainingContent);
    $finalContent = $remainingContent === '' ? $newBlock : $remainingContent . "\n\n" . $newBlock;
  } elseif (strpos($sanitizedExistingContent, '## VonCMS Universal .htaccess') !== false) {
    $parts = explode('## VonCMS Universal .htaccess', $sanitizedExistingContent, 2);
    $prefixContent = normalizePreservedHtaccessContent($parts[0]);
    $finalContent = $prefixContent === '' ? $newBlock : $prefixContent . "\n\n" . $newBlock;
  } else {
    $preservedContent = normalizePreservedHtaccessContent($sanitizedExistingContent);
    $finalContent = $preservedContent === '' ? $newBlock : $preservedContent . "\n\n" . $newBlock;
  }

  $finalContent = rtrim($finalContent) . "\n";
  $currentContent = rtrim($existingContent) . "\n";

  if ($currentContent === $finalContent) {
    return [
      'status' => 'unchanged',
      'removedCorruptedPrefix' => false,
      'path' => $filePath,
    ];
  }

  if (file_exists($filePath)) {
    @copy($filePath, $filePath . '.bak');
  }

  $written = @file_put_contents($filePath, $finalContent);
  if ($written === false) {
    return [
      'status' => 'failed',
      'removedCorruptedPrefix' => $removedCorruptedPrefix,
      'path' => $filePath,
    ];
  }

  return [
    'status' => 'written',
    'removedCorruptedPrefix' => $removedCorruptedPrefix,
    'path' => $filePath,
  ];
}

/**
 * @param string $publicPath
 * @param string $projectRoot
 * @return array{status: string, path: string}
 */
function repairUploadsShield($publicPath, $projectRoot)
{
  $uploadsDir = $publicPath . '/uploads';
  if (!is_dir($uploadsDir)) {
    $fallbackDir = $projectRoot . '/uploads';
    if (is_dir($fallbackDir)) {
      $uploadsDir = $fallbackDir;
    }
  }

  if (!is_dir($uploadsDir)) {
    return [
      'status' => 'skipped',
      'path' => $uploadsDir,
    ];
  }

  $shieldPath = $uploadsDir . '/.htaccess';
  $shieldRule =
    "<FilesMatch \"\\.(php|phtml|php3|php4|php5|pl|py|jsp|asp|html|htm|js|sh|exe)$\">\n    Require all denied\n</FilesMatch>\nOptions -Indexes\n";

  if (file_exists($shieldPath)) {
    $existing = (string) @file_get_contents($shieldPath);
    if (
      $existing !== '' &&
      strpos($existing, 'Require all denied') !== false &&
      strpos($existing, 'Options -Indexes') !== false
    ) {
      return [
        'status' => 'unchanged',
        'path' => $shieldPath,
      ];
    }
  }

  $written = @file_put_contents($shieldPath, $shieldRule);
  if ($written === false) {
    return [
      'status' => 'failed',
      'path' => $shieldPath,
    ];
  }

  return [
    'status' => 'written',
    'path' => $shieldPath,
  ];
}

$repairs = [];
$changesApplied = false;
$failed = false;

$projectRepair = updateHtaccessWithBlock($projectRoot . '/.htaccess', $prefix);
if ($projectRepair['removedCorruptedPrefix']) {
  $repairs[] =
    'WARN: Removed corrupted managed-fragment noise before rebuilding project root .htaccess.';
}
if ($projectRepair['status'] === 'written') {
  $repairs[] = 'OK: Project root .htaccess repaired.';
  $changesApplied = true;
} elseif ($projectRepair['status'] === 'unchanged') {
  $repairs[] = 'INFO: Project root .htaccess was already healthy.';
} else {
  $repairs[] = 'WARN: Failed to write project root .htaccess. Check file permissions.';
  $failed = true;
}

if ($publicPath !== $projectRoot) {
  $publicRepair = updateHtaccessWithBlock($publicPath . '/.htaccess', '');
  if ($publicRepair['removedCorruptedPrefix']) {
    $repairs[] =
      'WARN: Removed corrupted managed-fragment noise before rebuilding public .htaccess.';
  }
  if ($publicRepair['status'] === 'written') {
    $repairs[] = 'OK: Public .htaccess repaired.';
    $changesApplied = true;
  } elseif ($publicRepair['status'] === 'unchanged') {
    $repairs[] = 'INFO: Public .htaccess was already healthy.';
  } else {
    $repairs[] = 'WARN: Failed to write public .htaccess. Check file permissions.';
    $failed = true;
  }
}

$uploadsRepair = repairUploadsShield($publicPath, $projectRoot);
if ($uploadsRepair['status'] === 'written') {
  $repairs[] = 'OK: Uploads Shield .htaccess repaired.';
  $changesApplied = true;
} elseif ($uploadsRepair['status'] === 'unchanged') {
  $repairs[] = 'INFO: Uploads Shield was already healthy.';
} elseif ($uploadsRepair['status'] === 'skipped') {
  $repairs[] = 'INFO: Uploads directory not found. Shield repair skipped.';
} else {
  $repairs[] = 'WARN: Failed to repair Uploads Shield .htaccess.';
  $failed = true;
}

$response = [
  'status' => $failed ? 'warning' : 'success',
  'success' => !$failed,
  'mode' => 'repair_htaccess',
  'changesApplied' => $changesApplied,
  'message' => $failed
    ? 'One or more .htaccess repairs failed. Check file permissions.'
    : ($changesApplied
      ? '.htaccess repair completed successfully.'
      : 'No .htaccess changes were needed.'),
  'repairs' => $repairs,
];

header('Content-Type: application/json');
echo json_encode($response);
