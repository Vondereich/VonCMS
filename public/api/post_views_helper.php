<?php
/** Daily anonymous article aggregates. No visitor identifiers or runtime DDL. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/publication_time_helper.php';

function voncms_post_views_ready(): bool
{
  return (voncms_read_publication_capabilities()['post_daily_views'] ?? false) === true;
}

/** Called only after the existing deduplicated lifetime increment succeeds. */
function voncms_record_daily_post_view(PDO $pdo, int $postId): void
{
  if (!voncms_post_views_ready() || $postId <= 0) {
    return;
  }
  voncms_apply_site_timezone($pdo);
  $today = new DateTimeImmutable('today');
  $stmt = $pdo->prepare(
    'INSERT INTO post_daily_views (post_id, view_date, views) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE views = views + 1',
  );
  $stmt->execute([$postId, $today->format('Y-m-d')]);
  if (random_int(1, 100) === 1) {
    $stmt = $pdo->prepare(
      'DELETE FROM post_daily_views WHERE view_date < ? ORDER BY view_date, post_id LIMIT 1000',
    );
    $stmt->execute([$today->modify('-29 days')->format('Y-m-d')]);
  }
}

/** Staff authorization belongs to track_visit.php, before this read-only function. */
function voncms_top_articles(PDO $pdo, int $days, string $basePath): array
{
  require_once dirname(__DIR__) . '/seo_route_helper.php';
  if (!voncms_post_views_ready()) {
    throw new RuntimeException('Article view storage requires Database Repair.');
  }
  $days = $days === 30 ? 30 : 7;
  voncms_apply_site_timezone($pdo);
  $today = new DateTimeImmutable('today');
  $from = $today->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
  $stmt = $pdo->prepare(
    "SELECT p.id, p.title, p.slug, p.category, p.created_at, SUM(v.views) AS period_views
     FROM post_daily_views v INNER JOIN posts p ON p.id = v.post_id
     WHERE v.view_date >= ? AND v.view_date <= ?
       AND (p.status = 'published' OR p.status IS NULL)
       AND (p.scheduled_at IS NULL OR p.scheduled_at <= ?)
     GROUP BY p.id, p.title, p.slug, p.category, p.created_at
     ORDER BY period_views DESC, p.id DESC LIMIT 10",
  );
  $stmt->execute([$from, $today->format('Y-m-d'), date('Y-m-d H:i:s')]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  $styleStmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'permalink_structure' LIMIT 1",
  );
  $styleStmt->execute();
  $style = (string) ($styleStmt->fetchColumn() ?: 'slug');
  $base = '/' . trim(str_replace('\\', '/', $basePath), '/');
  $base = $base === '/' ? '' : $base;
  $articles = array_map(static function (array $row) use ($style, $base): array {
    return [
      'id' => (string) $row['id'],
      'title' => (string) $row['title'],
      'category' => (string) ($row['category'] ?? ''),
      'views' => (int) $row['period_views'],
      'url' => $base . '/' . ltrim(buildCanonicalContentPath($row, $style), '/'),
    ];
  }, $rows);
  $since = (int) (voncms_read_publication_capabilities()['post_daily_views_since'] ?? 0);
  return [
    'articles' => $articles,
    'days' => $days,
    'from' => $from,
    'through' => $today->format('Y-m-d'),
    'since' => $since > 0 ? date('Y-m-d', $since) : null,
    'timeZone' => date_default_timezone_get(),
  ];
}
