<?php
// robots.php - Serves dynamic robots.txt from database settings
// Also provides JSON API for frontend SEO settings (?default=json)

// Buffer any potential PHP warnings/errors during config load
ob_start();
require_once __DIR__ . '/von_config.php';
require_once __DIR__ . '/security.php';
ob_end_clean();

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

// SINGLE SOURCE OF TRUTH: Default robots.txt.
// This is a crawl policy, not an access-control boundary; server guards protect these paths.
$DEFAULT_ROBOTS = <<<EOT
# VonCMS Robots Policy v1.25.3

# Social Preview Crawlers
User-agent: facebookexternalhit
User-agent: Facebot
User-agent: meta-externalagent
User-agent: meta-webindexer
User-agent: meta-externalads
User-agent: meta-externalfetcher
User-agent: Twitterbot
User-agent: Pinterest
User-agent: LinkedInBot
User-agent: WhatsApp
User-agent: TelegramBot
User-agent: Slackbot
Allow: {$basePath}
Disallow: {$basePath}admin/
Disallow: {$basePath}api/
Disallow: {$basePath}install/
Disallow: {$basePath}von_config.php
Disallow: {$basePath}data/
Disallow: {$basePath}logs/

# AI Search / User-Directed Assistants
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
Allow: {$basePath}
Disallow: {$basePath}admin/
Disallow: {$basePath}api/
Disallow: {$basePath}install/
Disallow: {$basePath}von_config.php
Disallow: {$basePath}data/
Disallow: {$basePath}logs/

# General Crawlers
User-agent: *
# Content-Signal is a vendor extension; standard crawlers may ignore it.
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
User-agent: Google-Extended
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Applebot-Extended
User-agent: Bytespider
Disallow: /
EOT;

function stripRobotsSitemapDirectives(string $content): string
{
  $content = preg_replace('/^\s*Sitemap\s*:\s*.*$/mi', '', $content);
  $content = preg_replace("/\n{3,}/", "\n\n", (string) $content);
  return trim((string) $content);
}

function normalizeRobotsContent(string $content): string
{
  $content = preg_replace('/^\s*Crawl-delay\s*:\s*\d+\s*$/mi', '', (string) $content);
  $content = preg_replace("/\n{3,}/", "\n\n", (string) $content);
  return trim((string) $content);
}

function isLegacyVonCmsRobotsPolicy(string $content): bool
{
  if (strpos($content, 'VonCMS Robots Policy v1.25.3') !== false) {
    return false;
  }

  foreach (
    [
      '# Social Media Crawlers',
      'User-agent: OAI-SearchBot',
      'Content-Signal: search=yes,ai-train=no',
      'User-agent: GPTBot',
      'von_config.php',
    ]
    as $marker
  ) {
    if (strpos($content, $marker) === false) {
      return false;
    }
  }

  return true;
}

$DEFAULT_ROBOTS = normalizeRobotsContent($DEFAULT_ROBOTS);
$siteConfig = [];
$savedRobotsContent = '';

if (isset($pdo)) {
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'site_config' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $decodedConfig =
      $row && !empty($row['setting_value']) ? json_decode($row['setting_value'], true) : null;
    if (is_array($decodedConfig)) {
      $siteConfig = $decodedConfig;
      $savedRobotsContent = (string) ($siteConfig['robotsTxt'] ?? '');
    }

    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'robots_txt' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['setting_value'])) {
      $savedRobotsContent = (string) $row['setting_value'];
    }
  } catch (Exception $e) {
    // Fail gracefully to generated defaults.
  }
}

$sitemapEnabled =
  !array_key_exists('sitemapEnabled', $siteConfig) ||
  filter_var($siteConfig['sitemapEnabled'], FILTER_VALIDATE_BOOLEAN);

if (isset($_GET['default']) && $_GET['default'] === 'json') {
  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode([
    'success' => true,
    'robots' => $DEFAULT_ROBOTS,
    'sitemapEnabled' => $sitemapEnabled,
    'sitemap' => $sitemapEnabled ? "$siteUrl/sitemap.xml" : null,
  ]);
  exit();
}

// Serve robots.txt
header('Content-Type: text/plain; charset=UTF-8');

$robotsContent = $DEFAULT_ROBOTS;
if ($savedRobotsContent !== '') {
  $normalizedSavedRobots = normalizeRobotsContent($savedRobotsContent);
  if (!isLegacyVonCmsRobotsPolicy($normalizedSavedRobots)) {
    $robotsContent = $normalizedSavedRobots;
  }
}
$robotsContent = stripRobotsSitemapDirectives($robotsContent);

echo $robotsContent;

if ($sitemapEnabled) {
  $sitemapUrl = "$siteUrl/sitemap.xml";
  $hasCanonicalSitemap = preg_match(
    '/^\s*Sitemap:\s*' . preg_quote($sitemapUrl, '/') . '\s*$/mi',
    $robotsContent,
  );
  if (!$hasCanonicalSitemap) {
    echo "\n\nSitemap: $sitemapUrl";
  }
}

echo "\n";
