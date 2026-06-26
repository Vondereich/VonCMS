<?php
/**
 * VonCMS RSS 2.0 Feed
 * Latest published posts in standard RSS format
 *
 * URLs: /rss, /rss.xml, /feed, /feed.xml - all route to this file
 * Optional params: ?limit=20&category=News
 */

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

header('Content-Type: application/xml; charset=utf-8');

try {
  if (!isset($pdo) || $pdo === null) {
    throw new Exception('Database not configured');
  }

  voncms_apply_site_timezone($pdo);

  // Settings
  $limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : 20;
  $category =
    isset($_GET['category']) && preg_match('/^[\p{L}\p{N} ._-]+$/u', $_GET['category'])
      ? $_GET['category']
      : null;
  $offset = isset($_GET['offset']) ? max(0, (int) $_GET['offset']) : 0;

  // Get site settings
  $stmt = $pdo->prepare(
    "SELECT setting_key, setting_value FROM settings WHERE setting_group = 'general' AND setting_key IN ('site_name', 'site_description', 'domain_url', 'site_language')",
  );
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

  $siteName = $rows['site_name'] ?? 'My Website';
  $siteDesc = $rows['site_description'] ?? '';
  $domainUrl = $rows['domain_url'] ?? '';
  $siteLanguage = trim((string) ($rows['site_language'] ?? ''));

  // Fallback domain URL
  if (!$domainUrl) {
    $protocol = is_https() ? 'https://' : 'http://';
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    $domainUrl = rtrim($protocol . $host . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\'), '/');
  }
  $domainUrl = rtrim($domainUrl, '/');

  // If multiple languages (comma-separated), take the first as primary
  $primaryLanguage = preg_split('/\s*,\s*/', $siteLanguage, 2)[0];
  $normalizedSiteLanguage = preg_replace('/[^a-zA-Z-]/', '', $primaryLanguage);
  if (preg_match('/^[a-z]{2,3}$/i', $normalizedSiteLanguage)) {
    $normalizedSiteLanguage = strtolower($normalizedSiteLanguage);
  } elseif (preg_match('/^([a-z]{2,3})-([a-z]{2})$/i', $normalizedSiteLanguage, $langMatches)) {
    $normalizedSiteLanguage = strtolower($langMatches[1]) . '-' . strtoupper($langMatches[2]);
  } else {
    $normalizedSiteLanguage = 'en';
  }

  $buildAbsoluteUrl = function (?string $url) use ($domainUrl) {
    $url = trim((string) $url);
    if ($url === '') {
      return '';
    }

    if (preg_match('#^https?://#i', $url)) {
      return $url;
    }

    if (strpos($url, '//') === 0) {
      $scheme = parse_url($domainUrl, PHP_URL_SCHEME) ?: (is_https() ? 'https' : 'http');
      return $scheme . ':' . $url;
    }

    return $domainUrl . '/' . ltrim($url, '/');
  };

  // Get permalink style
  $plStmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='permalink_structure' LIMIT 1",
  );
  $plStmt->execute();
  $plRow = $plStmt->fetch(PDO::FETCH_ASSOC);
  $permalinkStyle = $plRow ? $plRow['setting_value'] : 'slug';

  // Build post URL helper
  $buildPostUrl =
    /**
     * @param array<string, mixed> $post
     * @return string
     */
    function ($post) use ($domainUrl, $permalinkStyle) {
      $slugOrId = $post['slug'] ?: $post['id'];
      switch ($permalinkStyle) {
        case 'date':
        case 'day_name':
          $d = new DateTime($post['created_at'] ?? 'now');
          return $domainUrl .
            '/' .
            $d->format('Y') .
            '/' .
            $d->format('m') .
            '/' .
            $d->format('d') .
            '/' .
            $slugOrId;
        case 'month_name':
          $d = new DateTime($post['created_at'] ?? 'now');
          return $domainUrl . '/' . $d->format('Y') . '/' . $d->format('m') . '/' . $slugOrId;
        case 'category':
          $cat = voncms_category_slug($post['category'] ?? 'uncategorized');
          return $domainUrl . '/' . $cat . '/' . $slugOrId;
        case 'post_name':
        case 'slug':
          return $domainUrl . '/' . $slugOrId;
        case 'plain':
          return $domainUrl . '/post/' . $post['id'];
        default:
          return $domainUrl . '/' . $slugOrId;
      }
    };

  // Query posts
  $where =
    " WHERE p.status = 'published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= :currentTime)";
  $currentTime = date('Y-m-d H:i:s');
  $hasDisplayNameColumn = false;
  try {
    $columnStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
    $hasDisplayNameColumn = $columnStmt && $columnStmt->rowCount() > 0;
  } catch (Throwable $e) {
    $hasDisplayNameColumn = false;
  }
  $authorNameSql = $hasDisplayNameColumn
    ? "COALESCE(NULLIF(u.display_name, ''), u.username)"
    : 'u.username';
  $authorDisplayNameSql = $hasDisplayNameColumn ? 'u.display_name' : 'NULL';

  if ($category) {
    $where .= ' AND p.category = :category';
  }

  $countSql = "SELECT COUNT(*) FROM posts p $where";
  $countStmt = $pdo->prepare($countSql);
  $countStmt->bindValue(':currentTime', $currentTime);
  if ($category) {
    $countStmt->bindValue(':category', $category);
  }
  $countStmt->execute();
  $total = (int) $countStmt->fetchColumn();

  $sql = "SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.category, p.author, p.author_id, p.keywords, p.image_url, p.created_at, p.updated_at, $authorNameSql AS author_name, u.username AS author_username, $authorDisplayNameSql AS author_display_name
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    $where
    ORDER BY p.created_at DESC
    LIMIT :limit OFFSET :offset";

  $stmt = $pdo->prepare($sql);
  $stmt->bindValue(':currentTime', $currentTime);
  if ($category) {
    $stmt->bindValue(':category', $category);
  }
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();
  $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Generate RSS
  $rssUrl = $category
    ? $domainUrl . '/rss.xml?category=' . urlencode($category)
    : $domainUrl . '/rss.xml';
  $feedTitle = $category ? "$category - $siteName" : $siteName;
  $feedDesc = $category ? "Latest posts in $category" : $siteDesc;

  echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
  ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title><?php echo htmlspecialchars($feedTitle, ENT_XML1, 'UTF-8'); ?></title>
    <link><?php echo htmlspecialchars($domainUrl, ENT_XML1, 'UTF-8'); ?></link>
    <description><?php echo htmlspecialchars($feedDesc, ENT_XML1, 'UTF-8'); ?></description>
    <language><?php echo htmlspecialchars($normalizedSiteLanguage, ENT_XML1, 'UTF-8'); ?></language>
    <lastBuildDate><?php echo !empty($posts)
      ? date('r', strtotime($posts[0]['updated_at'] ?? $posts[0]['created_at']))
      : date('r'); ?></lastBuildDate>
    <atom:link href="<?php echo htmlspecialchars(
      $rssUrl,
      ENT_XML1,
      'UTF-8',
    ); ?>" rel="self" type="application/rss+xml" />
    <generator>VonCMS RSS Feed</generator>
    <ttl>60</ttl>
<?php foreach ($posts as $post):

  // Normalize <img src> to absolute URLs when path is relative
  $scheme = is_https() ? 'https://' : 'http://';
  $currentHost = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
  $schemeAndHost = $scheme . $currentHost;
  $renderedContent = preg_replace_callback(
    '/(<img\b[^>]*src=(["\']))(\/(?!\/)[^"\']+)(\2)/i',
    /**
     * @param array<int, string> $m
     * @return string
     */
    function ($m) use ($schemeAndHost) {
      $quote = $m[2];
      $imgPath = $m[3];
      return $m[1] . $schemeAndHost . $imgPath . $quote;
    },
    $post['content'],
  );

  $postUrl = $buildPostUrl($post);
  $excerpt = !empty($post['excerpt'])
    ? strip_tags($post['excerpt'])
    : (!empty($renderedContent)
      ? mb_substr(strip_tags($renderedContent), 0, 300)
      : '');
  $author = $post['author_name'] ?? ($post['author'] ?? 'Unknown');
  $pubDate = date('r', strtotime($post['created_at']));
  ?>
    <item>
      <title><?php echo htmlspecialchars($post['title'], ENT_XML1, 'UTF-8'); ?></title>
      <link><?php echo htmlspecialchars($postUrl, ENT_XML1, 'UTF-8'); ?></link>
      <guid><?php echo htmlspecialchars($postUrl, ENT_XML1, 'UTF-8'); ?></guid>
      <pubDate><?php echo $pubDate; ?></pubDate>
      <dc:creator><?php echo htmlspecialchars($author, ENT_XML1, 'UTF-8'); ?></dc:creator>
      <category><?php echo htmlspecialchars(
        $post['category'] ?? 'Uncategorized',
        ENT_XML1,
        'UTF-8',
      ); ?></category>
      <description><?php echo htmlspecialchars($excerpt, ENT_XML1, 'UTF-8'); ?></description>
      <content:encoded><?php echo '<![CDATA[' .
        str_replace(']]>', ']]]]><![CDATA[>', $renderedContent) .
        ']]>'; ?></content:encoded>
<?php if (!empty($post['image_url'])):
  // Detect MIME type from image extension (SVG excluded - not allowed in upload pipeline)

  $imageUrl = $buildAbsoluteUrl($post['image_url']);
  $imgExt = strtolower(pathinfo($imageUrl, PATHINFO_EXTENSION));
  $mimeMap = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'ico' => 'image/x-icon',
  ];
  $mimeType = $mimeMap[$imgExt] ?? 'image/jpeg';

  // Only output enclosure for local images (external/CDN images can't have known file size)
  $fileSize = 0;
  $localPath = __DIR__ . '/' . ltrim(parse_url($post['image_url'], PHP_URL_PATH) ?? '', '/');
  if (file_exists($localPath)) {
    $fileSize = filesize($localPath);
  }
  if ($fileSize > 0): ?>
      <enclosure url="<?php echo htmlspecialchars(
        $imageUrl,
        ENT_XML1,
        'UTF-8',
      ); ?>" type="<?php echo htmlspecialchars(
  $mimeType,
  ENT_XML1,
  'UTF-8',
); ?>" length="<?php echo $fileSize; ?>" />
<?php endif;
endif; ?>
    </item>
<?php
endforeach; ?>
  </channel>
</rss>
<?php
} catch (Exception $e) {
  error_log('RSS feed error: ' . $e->getMessage());
  header('Content-Type: text/xml; charset=utf-8');
  echo '<?xml version="1.0" encoding="UTF-8"?>';
  ?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link><?php echo htmlspecialchars($domainUrl ?? '', ENT_XML1, 'UTF-8'); ?></link>
    <description>Failed to load RSS feed.</description>
  </channel>
</rss>
<?php
}
