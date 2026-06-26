<?php
// robots.php - Serves dynamic robots.txt from database settings
// Also provides JSON API for frontend SEO settings (?default=json)

// Buffer any potential PHP warnings/errors during config load
ob_start();
require_once __DIR__ . '/von_config.php';
require_once __DIR__ . '/security.php';
ob_end_clean();

// Force 200 OK for crawlers (addresses "Bad Response Code")
if (
  preg_match(
    '/(facebookexternalhit|Facebot|meta-external|meta-webindexer|Twitterbot|WhatsApp|TelegramBot)/i',
    $_SERVER['HTTP_USER_AGENT'] ?? '',
  )
) {
  if (!headers_sent()) {
    http_response_code(200);
  }
}

// ============================================
// URL Detection (Agnostic Birthplace)
// ============================================
$protocol = is_https() ? 'https://' : 'http://';
$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));

// Try to get base URL from settings first
$baseUrl = '';
if (isset($pdo)) {
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_key = 'domain_url' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['setting_value'])) {
      $baseUrl = rtrim($row['setting_value'], '/');
    }
  } catch (Exception $e) {
  }
}

// Fallback to auto-detection (Same logic as index.php/sitemap.php)
if (empty($baseUrl)) {
  $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
  $dir = str_replace('\\', '/', dirname($scriptPath));
  $dir = $dir === '/' ? '' : $dir;
  $baseUrl = $protocol . $host . $dir;
}

$siteUrl = rtrim($baseUrl, '/');
$basePath = parse_url($siteUrl, PHP_URL_PATH) ?: '';
$basePath = rtrim($basePath, '/') . '/';
if ($basePath === '//') {
  $basePath = '/';
}

// SINGLE SOURCE OF TRUTH: Default robots.txt
$DEFAULT_ROBOTS = <<<EOT
# Social Media Crawlers
User-agent: facebookexternalhit
Allow: /
User-agent: Facebot
Allow: /
User-agent: meta-externalagent
Allow: /
User-agent: meta-webindexer
Allow: /
User-agent: meta-externalads
Allow: /
User-agent: meta-externalfetcher
Allow: /
User-agent: Twitterbot
Allow: /
User-agent: Pinterest
Allow: /
User-agent: LinkedInBot
Allow: /
User-agent: WhatsApp
Allow: /
User-agent: TelegramBot
Allow: /
User-agent: Slackbot
Allow: /

# AI Search / User-Directed Assistants
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /

User-agent: *
Content-Signal: search=yes,ai-train=no
Allow: {$basePath}
Disallow: {$basePath}admin/
Disallow: {$basePath}api/
Disallow: {$basePath}install/
Disallow: {$basePath}von_config.php
Disallow: {$basePath}data/
Disallow: {$basePath}logs/

# AI Training / Bulk Dataset Crawlers
User-agent: GPTBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: Bytespider
Disallow: /
EOT;

function normalizeRobotsContent(string $content): string
{
  $content = preg_replace('/^\s*Crawl-delay\s*:\s*\d+\s*$/mi', '', (string) $content);
  $content = preg_replace("/\n{3,}/", "\n\n", (string) $content);
  return trim((string) $content);
}

$DEFAULT_ROBOTS = normalizeRobotsContent($DEFAULT_ROBOTS);

if (isset($_GET['default']) && $_GET['default'] === 'json') {
  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode([
    'success' => true,
    'robots' => $DEFAULT_ROBOTS,
    'sitemap' => "$siteUrl/sitemap.xml",
  ]);
  exit();
}

// Serve robots.txt
header('Content-Type: text/plain; charset=UTF-8');

// Try to load site-specific robots.txt from database
$robotsContent = $DEFAULT_ROBOTS;
if (isset($pdo)) {
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'robots_txt' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['setting_value'])) {
      $robotsContent = normalizeRobotsContent($row['setting_value']);
    } else {
      $stmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'site_config' LIMIT 1",
      );
      $stmt->execute();
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      $siteConfig =
        $row && !empty($row['setting_value']) ? json_decode($row['setting_value'], true) : null;
      if (is_array($siteConfig) && !empty($siteConfig['robotsTxt'])) {
        $robotsContent = normalizeRobotsContent($siteConfig['robotsTxt']);
      }
    }
  } catch (Exception $e) {
    // Fail gracefully to default
  }
}

echo $robotsContent;

// Append sitemap URL
echo "\n\nSitemap: $siteUrl/sitemap.xml\n";
