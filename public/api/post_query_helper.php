<?php
/** Indexed, late-materialized post lists. SQL fragments come only from trusted callers. */
$postQueryHelperPath = realpath(__FILE__);
if (
  $postQueryHelperPath !== false &&
  realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === $postQueryHelperPath
) {
  http_response_code(403);
  exit('Forbidden');
}
unset($postQueryHelperPath);
require_once __DIR__ . '/publication_time_helper.php';

function voncms_query_index_hint(PDO $pdo, string $table, string $index): string
{
  $allowed = [
    'posts' => [
      'idx_listing_order',
      'idx_listing_category',
      'idx_listing_author',
      'idx_sitemap_order',
    ],
    'analytics' => ['idx_visit_window', 'idx_visit_daily'],
  ];
  if (!in_array($index, $allowed[$table] ?? [], true)) {
    throw new InvalidArgumentException('Unsupported query index.');
  }
  $capabilities = voncms_read_publication_capabilities();
  if (($capabilities['query_indexes'][$table][$index] ?? false) !== true) {
    return '';
  }
  try {
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql') {
      return '';
    }
  } catch (Throwable $error) {
    return '';
  }
  return ' FORCE INDEX (' . $index . ')';
}

/** Preserve predicates, timestamp ties, visibility and payloads; bound wide row reads to the selected IDs. */
function voncms_post_listing_sql(
  PDO $pdo,
  string $projection,
  string $where,
  bool $withUsers = true,
  bool $updatedOrder = false,
): string {
  $userJoin = $withUsers ? ' LEFT JOIN users u ON p.author_id = u.id' : '';
  $order = $updatedOrder
    ? 'p.updated_at DESC, p.id DESC'
    : voncms_publication_expression_sql($pdo, 'posts', 'p') . ' DESC, p.created_at DESC, p.id DESC';
  $legacy =
    'SELECT ' .
    $projection .
    ' FROM posts p' .
    $userJoin .
    ' ' .
    $where .
    ' ORDER BY ' .
    $order .
    ' LIMIT :limit OFFSET :offset';
  // Search and explicit status filters retain optimizer choice; rare old drafts must not scan the date index.
  if (
    str_contains($where, ':search') ||
    str_contains($where, ':statusFilter') ||
    (!$updatedOrder && !voncms_has_publication_column($pdo, 'posts'))
  ) {
    return $legacy;
  }
  $index = $updatedOrder ? 'idx_sitemap_order' : 'idx_listing_order';
  if (!$updatedOrder && str_contains($where, 'p.category = :category')) {
    $index = 'idx_listing_category';
  } elseif (!$updatedOrder && str_contains($where, 'p.author_id = :currentUserId')) {
    $index = 'idx_listing_author';
  }
  $hint = voncms_query_index_hint($pdo, 'posts', $index);
  if ($hint === '') {
    return $legacy;
  }
  $innerOrder = $updatedOrder ? $order : 'p.listing_at DESC, p.created_at DESC, p.id DESC';
  // A username predicate must be applied before LIMIT, not after choosing IDs.
  $innerUsers = str_contains($where, 'u.') ? $userJoin : '';
  return 'SELECT ' .
    $projection .
    ' FROM (SELECT p.id FROM posts p' .
    $hint .
    $innerUsers .
    ' ' .
    $where .
    ' ORDER BY ' .
    $innerOrder .
    ' LIMIT :limit OFFSET :offset) chosen JOIN posts p ON p.id = chosen.id' .
    $userJoin .
    ' ORDER BY ' .
    $order;
}

function voncms_post_count_sql(string $where): string
{
  // Author filters need users; ordinary counts can stay on narrow post indexes.
  $join = str_contains($where, 'u.') ? ' LEFT JOIN users u ON p.author_id = u.id' : '';
  return 'SELECT COUNT(*) FROM posts p' . $join . ' ' . $where;
}
