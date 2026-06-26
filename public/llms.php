<?php
/**
 * VonCMS llms.txt Generator
 * Serves a Markdown summary of the site for AI/LLM crawlers.
 *
 * Route: /llms.txt - public/llms.php (via .htaccess rewrite)
 * Standard: https://llmstxt.org/
 *
 * @since Breeze
 */

// Buffer any potential PHP warnings/errors during config load
ob_start();
require_once __DIR__ . '/von_config.php';
require_once __DIR__ . '/security.php';

if (!function_exists('voncms_category_slug')) {
  /**
   * @param mixed $category
   * @return string
   */
  function voncms_category_slug($category)
  {
    $categorySlug = html_entity_decode(trim((string) $category), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($categorySlug === '') {
      return 'uncategorized';
    }

    $categorySlug = function_exists('mb_strtolower')
      ? mb_strtolower($categorySlug, 'UTF-8')
      : strtolower($categorySlug);
    $categorySlug = preg_replace('/[^\p{L}\p{N}\s_-]+/u', '', $categorySlug);
    $categorySlug = str_replace('_', ' ', $categorySlug ?? '');
    $categorySlug = preg_replace('/\s+/u', '-', $categorySlug);
    $categorySlug = preg_replace('/-+/', '-', $categorySlug);
    $categorySlug = trim((string) $categorySlug, '-');

    return $categorySlug !== '' ? $categorySlug : 'uncategorized';
  }
}
ob_end_clean();

// Force 200 OK for crawlers
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

// Set plain text header
if (!headers_sent()) {
  header('Content-Type: text/plain; charset=utf-8');
}

if (!function_exists('llmsMarkdownText')) {
  /**
   * @param mixed $value
   * @param int $maxLen
   * @return string
   */
  function llmsMarkdownText($value, $maxLen = 0)
  {
    $text = strip_tags((string) $value);
    $text = preg_replace('/\s+/u', ' ', trim($text));
    $text = str_replace(
      ['\\', '[', ']', '(', ')', '*', '_', '`', '>'],
      ['\\\\', '\[', '\]', '\(', '\)', '\*', '\_', '\`', '\>'],
      $text,
    );

    if ($maxLen > 0) {
      if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text, 'UTF-8') > $maxLen) {
          $text = mb_substr($text, 0, $maxLen, 'UTF-8') . '...';
        }
      } elseif (strlen($text) > $maxLen) {
        $text = substr($text, 0, $maxLen) . '...';
      }
    }

    return $text;
  }
}

try {
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database not configured');
  }

  voncms_apply_site_timezone($pdo);
  $currentTime = date('Y-m-d H:i:s');

  // =====================
  // SITE INFO
  // =====================
  $siteName = 'VonCMS Site';
  $siteDescription = '';
  $baseUrl = '';

  // Get site name
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'site_name' LIMIT 1",
  );
  $stmt->execute();
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if ($row && !empty($row['setting_value'])) {
    $siteName = strip_tags($row['setting_value']);
  }

  // Get site description
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'site_description' LIMIT 1",
  );
  $stmt->execute();
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if ($row && !empty($row['setting_value'])) {
    $siteDescription = strip_tags($row['setting_value']);
  }

  // Get base URL (same logic as sitemap.php)
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_key = 'domain_url' LIMIT 1",
  );
  $stmt->execute();
  $urlRow = $stmt->fetch(PDO::FETCH_ASSOC);
  $baseUrl = $urlRow ? $urlRow['setting_value'] : '';

  if (!$baseUrl) {
    $protocol = is_https() ? 'https://' : 'http://';
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    $scriptPath = $_SERVER['SCRIPT_NAME'];
    $dir = str_replace('\\', '/', dirname($scriptPath));
    if ($dir === '/') {
      $dir = '';
    }
    $baseUrl = $protocol . $host . $dir;
  }
  $baseUrl = rtrim($baseUrl, '/');

  // Get permalink structure
  $plStmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='permalink_structure' LIMIT 1",
  );
  $plStmt->execute();
  $plRow = $plStmt->fetch(PDO::FETCH_ASSOC);
  $permalinkStyle = $plRow && !empty($plRow['setting_value']) ? $plRow['setting_value'] : 'slug';

  // Get site language for HTML lang attribute
  // Get site language (optional)
  $siteLang = '';
  $langStmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='site_language' LIMIT 1",
  );
  $langStmt->execute();
  $langRow = $langStmt->fetch(PDO::FETCH_ASSOC);
  if ($langRow && !empty($langRow['setting_value'])) {
    $siteLang = strip_tags($langRow['setting_value']);
  }

  // =====================
  // OUTPUT: HEADER
  // =====================
  echo "# $siteName\n\n";
  if ($siteDescription) {
    echo "> $siteDescription\n\n";
  }
  if ($siteLang) {
    echo "Language: $siteLang\n\n";
  }

  // =====================
  // OUTPUT: CATEGORIES
  // =====================
  $catStmt = $pdo->prepare(
    "SELECT category, COUNT(*) as total FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY total DESC LIMIT 200",
  );
  $catStmt->bindValue(':currentTime', $currentTime);
  $catStmt->execute();
  $hasCategories = false;
  while ($cat = $catStmt->fetch(PDO::FETCH_ASSOC)) {
    if (!$hasCategories) {
      echo "## Categories\n\n";
      $hasCategories = true;
    }
    $catName = llmsMarkdownText($cat['category'] ?? '', 120);
    $catCount = (int) ($cat['total'] ?? 0);
    echo "- $catName ($catCount)\n";
  }
  if ($hasCategories) {
    echo "\n";
  }

  // =====================
  // OUTPUT: POSTS
  // =====================
  $postStmt = $pdo->prepare(
    "SELECT id, title, slug, excerpt, keywords, created_at, category FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) ORDER BY created_at DESC LIMIT 50",
  );
  $postStmt->bindValue(':currentTime', $currentTime);
  $postStmt->execute();
  $hasPosts = false;
  while ($post = $postStmt->fetch(PDO::FETCH_ASSOC)) {
    if (!$hasPosts) {
      echo "## Posts\n\n";
      $hasPosts = true;
    }
    $postSlug = !empty($post['slug']) ? (string) $post['slug'] : (string) $post['id'];
    $path = '/' . $postSlug; // Default: use slug

    // Permalink switch (exact copy from sitemap.php)
    switch ($permalinkStyle) {
      case 'date':
      case 'day_name':
        $postDate = new DateTime(!empty($post['created_at']) ? $post['created_at'] : 'now');
        $path =
          '/' .
          $postDate->format('Y') .
          '/' .
          $postDate->format('m') .
          '/' .
          $postDate->format('d') .
          '/' .
          $postSlug;
        break;
      case 'month_name':
        $postDate = new DateTime(!empty($post['created_at']) ? $post['created_at'] : 'now');
        $path = '/' . $postDate->format('Y') . '/' . $postDate->format('m') . '/' . $postSlug;
        break;
      case 'category':
        $catSlug = voncms_category_slug($post['category'] ?? 'uncategorized');
        $path = '/' . $catSlug . '/' . $postSlug;
        break;
      case 'post_name':
      case 'slug':
        $path = '/' . $postSlug;
        break;
      case 'plain':
        $path = '/post/' . $post['id'];
        break;
      default:
        $path = '/' . $postSlug; // Fallback to slug
        break;
    }

    $url = $baseUrl . $path;
    $title = llmsMarkdownText($post['title'] ?? 'Untitled', 180);
    $excerpt = llmsMarkdownText($post['excerpt'] ?? '', 200);
    $keywords = llmsMarkdownText($post['keywords'] ?? '', 200);

    // Format date if available
    $dateStr = '';
    if (!empty($post['created_at'])) {
      try {
        $dt = new DateTime($post['created_at']);
        $dateStr = ' (' . $dt->format('Y-m-d') . ')';
      } catch (Exception $e) {
        $dateStr = '';
      }
    }

    if ($excerpt) {
      echo "- [$title]($url): $excerpt$dateStr\n";
    } else {
      echo "- [$title]($url)$dateStr\n";
    }

    if ($keywords) {
      echo "  Keywords: $keywords\n";
    }
  }
  if ($hasPosts) {
    echo "\n";
  }

  // =====================
  // OUTPUT: PAGES
  // =====================
  $pageStmt = $pdo->prepare(
    "SELECT slug, title, excerpt FROM pages WHERE status = 'published' ORDER BY title ASC LIMIT 500",
  );
  $pageStmt->execute();
  $hasPages = false;
  while ($page = $pageStmt->fetch(PDO::FETCH_ASSOC)) {
    if (($page['slug'] ?? '') === 'home') {
      continue; // Skip homepage
    }
    if (!$hasPages) {
      echo "## Pages\n\n";
      $hasPages = true;
    }

    $url = $baseUrl . '/' . ($page['slug'] ?? '');
    $title = llmsMarkdownText($page['title'] ?? 'Untitled', 180);
    $excerpt = llmsMarkdownText($page['excerpt'] ?? '', 200);

    if ($excerpt) {
      echo "- [$title]($url): $excerpt\n";
    } else {
      echo "- [$title]($url)\n";
    }
  }

  // =====================
  // OUTPUT: RSS FEED
  // =====================
  echo "## RSS Feed\n\n";
  echo "Subscribe to updates via RSS: [$baseUrl/rss.xml]($baseUrl/rss.xml)\n";
} catch (Exception $e) {
  // Graceful fallback
  echo "# VonCMS\n\n";
  echo "> Site information temporarily unavailable.\n";
}
