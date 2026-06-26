<?php
/**
 * VonCMS Sitemap Index
 * Supports 100K+ posts with chunked sitemaps
 *
 * Routes:
 * - /sitemap.xml - Index file (lists all sitemap chunks)
 * - /sitemap.xml?type=posts&page=1 - Posts chunk 1 (max 50K URLs)
 * - /sitemap.xml?type=pages - All pages
 */

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

// Constants
define('MAX_URLS_PER_SITEMAP', 1000); // Optimized for performance (Standard: 50k)

try {
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database not configured');
  }

  voncms_apply_site_timezone($pdo);
  $currentTime = date('Y-m-d H:i:s');

  // Get base URL from settings
  $stmtGeneral = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_key = 'domain_url' LIMIT 1",
  );
  $stmtGeneral->execute();
  $genRow = $stmtGeneral->fetch(PDO::FETCH_ASSOC);

  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'seo' AND setting_key = 'site_config' LIMIT 1",
  );
  $stmt->execute();
  $seoRow = $stmt->fetch(PDO::FETCH_ASSOC);
  $seoSettings = $seoRow ? json_decode($seoRow['setting_value'], true) : [];

  // Check if enabled
  $isEnabled = isset($seoSettings['sitemapEnabled']) ? $seoSettings['sitemapEnabled'] : true;
  if (!$isEnabled) {
    header('Content-Type: text/plain');
    http_response_code(404);
    die('Sitemap is disabled.');
  }

  // Fallback base URL
  $baseUrl = $genRow ? $genRow['setting_value'] : '';
  if (!$baseUrl) {
    $protocol = is_https() ? 'https://' : 'http://';
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    // Subfolder detection: Get the directory part of the current script
    $scriptPath = $_SERVER['SCRIPT_NAME']; // e.g., /mycms/public/sitemap.php or /sitemap.php
    $dir = str_replace('\\', '/', dirname($scriptPath));
    if ($dir === '/') {
      $dir = '';
    }
    $baseUrl = $protocol . $host . $dir;
  }
  $baseUrl = rtrim($baseUrl, '/');

  // Determine request type
  $type = isset($_GET['type']) ? $_GET['type'] : 'index';
  $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;

  // Set XML header
  if (!headers_sent()) {
    header('Content-Type: application/xml; charset=utf-8');
  }

  // =====================
  // SITEMAP INDEX
  // =====================
  if ($type === 'index') {
    // Count total posts
    $countStmt = $pdo->prepare(
      "SELECT COUNT(*) FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)",
    );
    $countStmt->bindValue(':currentTime', $currentTime);
    $countStmt->execute();
    $totalPosts = (int) $countStmt->fetchColumn();
    $postPages = max(1, ceil($totalPosts / MAX_URLS_PER_SITEMAP));

    // Count total pages
    $pageCountStmt = $pdo->query("SELECT COUNT(*) FROM pages WHERE status = 'published'");
    $totalPages = (int) $pageCountStmt->fetchColumn();

    // Get last modified dates
    $lastPostModStmt = $pdo->prepare(
      "SELECT COALESCE(MAX(updated_at), MAX(created_at)) FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)",
    );
    $lastPostModStmt->bindValue(':currentTime', $currentTime);
    $lastPostModStmt->execute();
    $lastPostMod = $lastPostModStmt->fetchColumn();
    $lastPageMod = $pdo
      ->query(
        "SELECT COALESCE(MAX(updated_at), MAX(created_at)) FROM pages WHERE status = 'published'",
      )
      ->fetchColumn();

    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    // Post sitemaps
    for ($i = 1; $i <= $postPages; $i++) {
      echo '<sitemap>';
      echo '<loc>' .
        htmlspecialchars($baseUrl) .
        '/sitemap.xml?type=posts&amp;page=' .
        $i .
        '</loc>';
      if ($lastPostMod) {
        echo '<lastmod>' . date('c', strtotime($lastPostMod)) . '</lastmod>';
      }
      echo '</sitemap>';
    }

    // Pages sitemap (if any pages exist)
    if ($totalPages > 0) {
      echo '<sitemap>';
      echo '<loc>' . htmlspecialchars($baseUrl) . '/sitemap.xml?type=pages</loc>';
      if ($lastPageMod) {
        echo '<lastmod>' . date('c', strtotime($lastPageMod)) . '</lastmod>';
      }
      echo '</sitemap>';
    }

    // RSS feed reference for content syndication
    echo '<sitemap>';
    echo '<loc>' . htmlspecialchars($baseUrl) . '/rss.xml</loc>';
    if ($lastPostMod) {
      echo '<lastmod>' . date('c', strtotime($lastPostMod)) . '</lastmod>';
    }
    echo '</sitemap>';

    echo '</sitemapindex>';
    exit();
  }

  // =====================
  // POSTS SITEMAP (chunked)
  // =====================
  if ($type === 'posts') {
    $offset = ($page - 1) * MAX_URLS_PER_SITEMAP;

    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';

    // Homepage on first page
    if ($page === 1) {
      echo '<url>';
      echo '<loc>' . htmlspecialchars($baseUrl) . '/</loc>';
      echo '<changefreq>daily</changefreq>';
      echo '<priority>1.0</priority>';
      echo '</url>';
    }

    // Get permalink structure
    $plStmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='permalink_structure' LIMIT 1",
    );
    $plStmt->execute();
    $plRow = $plStmt->fetch(PDO::FETCH_ASSOC);
    $permalinkStyle = $plRow && !empty($plRow['setting_value']) ? $plRow['setting_value'] : 'slug';

    $postStmt = $pdo->prepare(
      "SELECT id, slug, updated_at, created_at, category, image_url FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) ORDER BY updated_at DESC LIMIT :limit OFFSET :offset",
    );
    $postStmt->bindValue(':currentTime', $currentTime);
    $postStmt->bindValue(':limit', MAX_URLS_PER_SITEMAP, PDO::PARAM_INT);
    $postStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $postStmt->execute();

    while ($post = $postStmt->fetch(PDO::FETCH_ASSOC)) {
      $postSlug = $post['slug'] ?: $post['id'];
      $path = ''; // Wait for switch statement to define it

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
          $path = '/' . $postSlug; // Fallback to slug (safer than /post/{id})
          break;
      }

      $date = $post['updated_at'] ?: ($post['created_at'] ?: date('c'));
      $date = date('c', strtotime($date));

      echo '<url>';
      echo '<loc>' . htmlspecialchars($baseUrl . $path) . '</loc>';
      echo '<lastmod>' . $date . '</lastmod>';
      if (!empty($post['image_url'])) {
        $imgUrl = $post['image_url'];
        if (strpos($imgUrl, 'http') !== 0) {
          $imgUrl = $baseUrl . '/' . ltrim($imgUrl, '/');
        }
        echo '<image:image>';
        echo '<image:loc>' . htmlspecialchars($imgUrl) . '</image:loc>';
        echo '</image:image>';
      }
      echo '<changefreq>weekly</changefreq>';
      echo '<priority>0.8</priority>';
      echo '</url>';
    }

    echo '</urlset>';
    exit();
  }

  // =====================
  // PAGES SITEMAP
  // =====================
  if ($type === 'pages') {
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    $pageStmt = $pdo->prepare(
      "SELECT slug, updated_at, created_at FROM pages WHERE status = 'published' ORDER BY updated_at DESC",
    );
    $pageStmt->execute();

    while ($page = $pageStmt->fetch(PDO::FETCH_ASSOC)) {
      if ($page['slug'] === 'home') {
        continue;
      }

      $path = "/{$page['slug']}";
      $date = $page['updated_at'] ?: ($page['created_at'] ?: date('c'));
      $date = date('c', strtotime($date));

      echo '<url>';
      echo '<loc>' . htmlspecialchars($baseUrl . $path) . '</loc>';
      echo '<lastmod>' . $date . '</lastmod>';
      echo '<changefreq>monthly</changefreq>';
      echo '<priority>0.6</priority>';
      echo '</url>';
    }

    echo '</urlset>';
    exit();
  }

  // Default: redirect to index
  header("Location: {$baseUrl}/sitemap.xml");
  exit();
} catch (Exception $e) {
  http_response_code(500);
  error_log('Sitemap Generation Error: ' . $e->getMessage());
  echo 'Error generating sitemap.';
}
