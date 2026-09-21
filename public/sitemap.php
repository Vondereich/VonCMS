<?php
/**
 * VonCMS Sitemap Index
 * Supports 100K+ posts with chunked sitemaps
 *
 * Routes:
 * - /sitemap.xml - Index file (lists all sitemap chunks)
 * - /sitemap.xml?type=posts&page=1 - Posts chunk 1 (max 1,000 posts)
 * - /sitemap.xml?type=pages&page=1 - Pages chunk 1 (max 1,000 pages)
 */

ob_start();
require_once __DIR__ . '/von_config.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/seo_route_helper.php';
ob_end_clean();

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

  $scriptPath = (string) ($_SERVER['SCRIPT_NAME'] ?? '/sitemap.php');
  $scriptDir = str_replace('\\', '/', dirname($scriptPath));
  $sitemapBasePath =
    $scriptDir === '/' || $scriptDir === '.' ? '/' : '/' . trim($scriptDir, '/') . '/';
  $baseUrl = voncms_resolve_public_base_url($genRow['setting_value'] ?? '', $sitemapBasePath);
  if ($baseUrl === '') {
    throw new RuntimeException('Canonical Domain URL is not configured');
  }

  if (!function_exists('voncms_sitemap_absolute_url')) {
    /**
     * @param mixed $url
     * @param string $baseUrl
     * @return string
     */
    function voncms_sitemap_absolute_url($url, $baseUrl)
    {
      $url = trim((string) $url);
      if ($url === '') {
        return '';
      }

      if (preg_match('/^https?:\/\//i', $url)) {
        return $url;
      }

      if (strpos($url, '//') === 0) {
        return '';
      }

      $relativeUrl = ltrim($url, '/');
      $basePath = trim((string) (parse_url($baseUrl, PHP_URL_PATH) ?: ''), '/');
      if ($basePath !== '') {
        $basePrefix = $basePath . '/';
        if ($relativeUrl === $basePath) {
          $relativeUrl = '';
        } elseif (strpos($relativeUrl, $basePrefix) === 0) {
          $relativeUrl = substr($relativeUrl, strlen($basePrefix));
        }
      }

      return rtrim($baseUrl, '/') . ($relativeUrl === '' ? '' : '/' . $relativeUrl);
    }
  }

  // Determine request type
  $typeValue = $_GET['type'] ?? 'index';
  $type =
    is_string($typeValue) && in_array($typeValue, ['index', 'posts', 'pages'], true)
      ? $typeValue
      : 'index';
  $pageValue = $_GET['page'] ?? 1;
  $page = is_scalar($pageValue) ? max(1, (int) $pageValue) : 1;

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
    $postPages = voncms_sitemap_page_count($totalPosts, MAX_URLS_PER_SITEMAP);

    // Count total pages
    $pageCountStmt = $pdo->query(
      "SELECT COUNT(*) FROM pages WHERE status = 'published' AND slug <> 'home'",
    );
    $totalPages = (int) $pageCountStmt->fetchColumn();
    $pagePages = voncms_sitemap_page_count($totalPages, MAX_URLS_PER_SITEMAP);

    // Get last modified dates
    $lastPostModStmt = $pdo->prepare(
      "SELECT COALESCE(MAX(updated_at), MAX(created_at)) FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)",
    );
    $lastPostModStmt->bindValue(':currentTime', $currentTime);
    $lastPostModStmt->execute();
    $lastPostMod = $lastPostModStmt->fetchColumn();
    $lastPageMod = $pdo
      ->query(
        "SELECT COALESCE(MAX(updated_at), MAX(created_at)) FROM pages WHERE status = 'published' AND slug <> 'home'",
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
      for ($i = 1; $i <= $pagePages; $i++) {
        echo '<sitemap>';
        echo '<loc>' .
          htmlspecialchars($baseUrl) .
          '/sitemap.xml?type=pages&amp;page=' .
          $i .
          '</loc>';
        if ($lastPageMod) {
          echo '<lastmod>' . date('c', strtotime($lastPageMod)) . '</lastmod>';
        }
        echo '</sitemap>';
      }
    }

    echo '</sitemapindex>';
    exit();
  }

  // =====================
  // POSTS SITEMAP (chunked)
  // =====================
  if ($type === 'posts') {
    $postCountStmt = $pdo->prepare(
      "SELECT COUNT(*) FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime)",
    );
    $postCountStmt->bindValue(':currentTime', $currentTime);
    $postCountStmt->execute();
    $postPageCount = max(1, (int) ceil((int) $postCountStmt->fetchColumn() / MAX_URLS_PER_SITEMAP));
    if ($page > $postPageCount) {
      http_response_code(404);
      echo '<?xml version="1.0" encoding="UTF-8"?>';
      echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
      exit();
    }

    $offset = ($page - 1) * MAX_URLS_PER_SITEMAP;

    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';

    // Homepage on first page
    if ($page === 1) {
      echo '<url>';
      echo '<loc>' . htmlspecialchars($baseUrl) . '/</loc>';
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
      "SELECT id, slug, updated_at, created_at, category, image_url FROM posts WHERE status = 'published' AND (scheduled_at IS NULL OR scheduled_at <= :currentTime) ORDER BY updated_at DESC, id DESC LIMIT :limit OFFSET :offset",
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
        $imgUrl = voncms_sitemap_absolute_url($post['image_url'], $baseUrl);
        echo '<image:image>';
        echo '<image:loc>' . htmlspecialchars($imgUrl) . '</image:loc>';
        echo '</image:image>';
      }
      echo '</url>';
    }

    echo '</urlset>';
    exit();
  }

  // =====================
  // PAGES SITEMAP
  // =====================
  if ($type === 'pages') {
    $pageCountStmt = $pdo->query(
      "SELECT COUNT(*) FROM pages WHERE status = 'published' AND slug <> 'home'",
    );
    $pageWindow = voncms_sitemap_page_window(
      $page,
      (int) $pageCountStmt->fetchColumn(),
      MAX_URLS_PER_SITEMAP,
    );
    if (!$pageWindow['valid']) {
      http_response_code(404);
      echo '<?xml version="1.0" encoding="UTF-8"?>';
      echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
      exit();
    }

    $offset = $pageWindow['offset'];

    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    $pageStmt = $pdo->prepare(
      "SELECT slug, updated_at, created_at FROM pages WHERE status = 'published' AND slug <> 'home' ORDER BY updated_at DESC, id DESC LIMIT :limit OFFSET :offset",
    );
    $pageStmt->bindValue(':limit', MAX_URLS_PER_SITEMAP, PDO::PARAM_INT);
    $pageStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $pageStmt->execute();

    while ($page = $pageStmt->fetch(PDO::FETCH_ASSOC)) {
      $path = "/{$page['slug']}";
      $date = $page['updated_at'] ?: ($page['created_at'] ?: date('c'));
      $date = date('c', strtotime($date));

      echo '<url>';
      echo '<loc>' . htmlspecialchars($baseUrl . $path) . '</loc>';
      echo '<lastmod>' . $date . '</lastmod>';
      echo '</url>';
    }

    echo '</urlset>';
    exit();
  }

  // Default: redirect to index
  header("Location: {$baseUrl}/sitemap.xml");
  exit();
} catch (Throwable $e) {
  http_response_code(503);
  header('Retry-After: 300');
  error_log('Sitemap Generation Error: ' . $e->getMessage());
  echo 'Sitemap temporarily unavailable.';
}
