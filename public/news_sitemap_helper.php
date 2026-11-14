<?php
/** Optional News feed. Shares publication dates and canonical paths with public rendering. */
if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/seo_schema_helper.php';

final class VonCmsNewsPublicationUnavailable extends RuntimeException {}

/** @return array{enabled: bool, publicationName: string, language: string, scope: string, categories: list<string>} */
function voncms_news_sitemap_settings(mixed $value): array
{
  $defaults = [
    'enabled' => false,
    'publicationName' => '',
    'language' => '',
    'scope' => 'all',
    'categories' => [],
  ];
  if ($value === null) {
    return $defaults;
  }
  if (!is_array($value)) {
    throw new InvalidArgumentException('Invalid News sitemap configuration.');
  }
  $config = array_replace($defaults, $value);
  if (!is_bool($config['enabled'])) {
    throw new InvalidArgumentException('Invalid News sitemap enabled value.');
  }
  foreach (['publicationName' => 200, 'language' => 5] as $key => $limit) {
    if (!is_string($config[$key]) || mb_strlen($config[$key], 'UTF-8') > $limit) {
      throw new InvalidArgumentException('Invalid News sitemap ' . $key . '.');
    }
    $config[$key] = trim($config[$key]);
  }
  $config['language'] = strtolower($config['language']);
  if (
    $config['language'] === 'zh' ||
    ($config['language'] !== '' &&
      !preg_match('/^(?:[a-z]{2,3}|zh-cn|zh-tw)$/D', $config['language']))
  ) {
    throw new InvalidArgumentException(
      'Use a two/three-letter publication language, zh-cn or zh-tw.',
    );
  }
  if (!in_array($config['scope'], ['all', 'categories'], true)) {
    throw new InvalidArgumentException('Invalid News sitemap category scope.');
  }
  if (!is_array($config['categories']) || count($config['categories']) > 200) {
    throw new InvalidArgumentException('Invalid News sitemap categories.');
  }
  $categories = [];
  foreach ($config['categories'] as $category) {
    if (!is_string($category) || trim($category) === '' || mb_strlen($category, 'UTF-8') > 255) {
      throw new InvalidArgumentException('Invalid News sitemap category.');
    }
    $categories[] = trim($category);
  }
  if ($config['enabled'] && $config['scope'] === 'categories' && $categories === []) {
    throw new InvalidArgumentException('Select at least one category for the News sitemap.');
  }
  return [
    'enabled' => $config['enabled'],
    'publicationName' => $config['publicationName'],
    'language' => $config['language'],
    'scope' => $config['scope'],
    'categories' => array_values(array_unique($categories)),
  ];
}

function voncms_news_sitemap_text(string $value): string
{
  // Clean markup/entities once without shortening the article's original headline.
  return voncms_clean_seo_description($value, max(1, mb_strlen($value, 'UTF-8')));
}

/** @param array<string, mixed> $config
 * @return array{name: string, language: string, permalink: string}
 */
function voncms_news_sitemap_publication(PDO $pdo, array $config): array
{
  $config = voncms_news_sitemap_settings($config);
  $stmt = $pdo->query(
    "SELECT setting_key, setting_value FROM settings WHERE setting_group = 'general' AND setting_key IN ('site_name', 'site_language', 'permalink_structure')",
  );
  if (!($stmt instanceof PDOStatement)) {
    throw new RuntimeException('News publication settings unavailable.');
  }
  try {
    $general = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
  } finally {
    $stmt->closeCursor();
  }
  $name = voncms_news_sitemap_text(
    (string) (($config['publicationName'] ?? '') !== ''
      ? $config['publicationName']
      : $general['site_name'] ?? ''),
  );
  $language = (string) ($config['language'] ?? '');
  if ($language === '') {
    $siteLanguage = trim((string) ($general['site_language'] ?? ''));
    $tag = strtolower(
      voncms_normalize_schema_language(
        str_replace('_', '-', $siteLanguage !== '' ? $siteLanguage : 'en'),
      ),
    );
    if (preg_match('/^zh-(?:cn|sg|hans)(?:-|$)/', $tag)) {
      $language = 'zh-cn';
    } elseif (preg_match('/^zh-(?:tw|hk|mo|hant)(?:-|$)/', $tag)) {
      $language = 'zh-tw';
    } elseif (preg_match('/^([a-z]{2,3})(?:-[a-z0-9]+)*$/D', $tag, $parts)) {
      $language = $parts[1];
    }
  }
  if ($name === '' || $language === '' || $language === 'zh') {
    throw new RuntimeException('Configure a News publication name and language in VonSEO.');
  }
  return [
    'name' => $name,
    'language' => $language,
    'permalink' => (string) ($general['permalink_structure'] ?? 'slug'),
  ];
}

/** @param array<string, mixed> $config */
function voncms_news_sitemap_query(
  PDO $pdo,
  array $config,
  DateTimeImmutable $now,
  ?int $page = null,
): PDOStatement {
  $config = voncms_news_sitemap_settings($config);
  // Ordinary public reads keep their legacy fallback. News promises a bounded
  // publication window, so require Repair's trusted capability before querying.
  if (!voncms_has_publication_column($pdo, 'posts')) {
    throw new VonCmsNewsPublicationUnavailable(
      'News publication storage is not ready. Run Database Repair before using the News sitemap.',
    );
  }
  $publication = voncms_publication_expression_sql($pdo, 'posts', 'p');
  $where = "p.status = 'published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= :visibleAt)
    AND $publication >= :since AND $publication <= :until AND TRIM(p.title) <> ''";
  $params = [
    ':visibleAt' => $now->format('Y-m-d H:i:s'),
    ':since' => $now->setTimestamp($now->getTimestamp() - 172800)->format('Y-m-d H:i:s'),
    ':until' => $now->format('Y-m-d H:i:s'),
  ];
  if (($config['scope'] ?? 'all') === 'categories') {
    $categories = $config['categories'] ?? [];
    $keys = [];
    foreach (is_array($categories) ? $categories : [] as $category) {
      if (!is_string($category)) {
        throw new InvalidArgumentException('Invalid News category.');
      }
      $key = ':category' . count($keys);
      $keys[] = $key;
      $params[$key] = $category;
    }
    $where .= $keys === [] ? ' AND 1 = 0' : ' AND p.category IN (' . implode(',', $keys) . ')';
  }
  $fields =
    $page === null
      ? 'COUNT(*)'
      : "p.id, p.title, p.slug, p.category, p.created_at, $publication AS publication_date";
  $sql = "SELECT $fields FROM posts p WHERE $where";
  if ($page !== null) {
    if ($page < 1 || $page > intdiv(PHP_INT_MAX, 1000)) {
      throw new InvalidArgumentException('Invalid News sitemap page.');
    }
    $sql .= " ORDER BY $publication DESC, p.id DESC LIMIT :limit OFFSET :offset";
  }
  $stmt = $pdo->prepare($sql);
  if (!($stmt instanceof PDOStatement)) {
    throw new RuntimeException('News sitemap query unavailable.');
  }
  foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value, PDO::PARAM_STR);
  }
  if ($page !== null) {
    $stmt->bindValue(':limit', 1000, PDO::PARAM_INT);
    $stmt->bindValue(':offset', ($page - 1) * 1000, PDO::PARAM_INT);
  }
  $stmt->execute();
  return $stmt;
}

function voncms_news_sitemap_xml_text(string $value): string
{
  return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE | ENT_DISALLOWED, 'UTF-8');
}

/** @param list<array<string, mixed>> $posts
 * @param array{name: string, language: string, permalink: string} $publication
 */
function voncms_news_sitemap_xml(
  array $posts,
  array $publication,
  string $baseUrl,
  DateTimeImmutable $now,
): string {
  $xml =
    '<?xml version="1.0" encoding="UTF-8"?>' .
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">';
  foreach ($posts as $post) {
    $rawDate = $post['publication_date'] ?? null;
    $title = $post['title'] ?? null;
    if (!is_string($rawDate) || !is_string($title)) {
      continue;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $rawDate, $now->getTimezone());
    if (
      $date === false ||
      $date->format('Y-m-d H:i:s') !== $rawDate ||
      $date > $now ||
      $date->getTimestamp() < $now->getTimestamp() - 172800
    ) {
      continue;
    }
    $title = voncms_news_sitemap_text($title);
    if ($title === '') {
      continue;
    }
    $url = rtrim($baseUrl, '/') . buildCanonicalContentPath($post, $publication['permalink']);
    $xml .=
      '<url><loc>' .
      voncms_news_sitemap_xml_text($url) .
      '</loc><news:news><news:publication>' .
      '<news:name>' .
      voncms_news_sitemap_xml_text($publication['name']) .
      '</news:name>' .
      '<news:language>' .
      voncms_news_sitemap_xml_text($publication['language']) .
      '</news:language>' .
      '</news:publication><news:publication_date>' .
      $date->format('c') .
      '</news:publication_date>' .
      '<news:title>' .
      voncms_news_sitemap_xml_text($title) .
      '</news:title></news:news></url>';
  }
  return $xml . '</urlset>';
}
