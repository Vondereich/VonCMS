<?php
declare(strict_types=1);
// SQL-only regression fixture. --mysql uses a new disposable loopback database, never the CMS config.
$root = dirname(__DIR__, 2);
require_once $root . '/public/api/post_query_helper.php';
require_once $root . '/public/api/schema_repair_helper.php';
require_once $root . '/public/seo_route_helper.php';
$checks = 0;
function check(bool $condition, string $label): void
{
  if (!$condition) {
    throw new RuntimeException($label);
  }
  $GLOBALS['checks']++;
  echo "PASS {$label}\n";
}
function queryRows(PDO $pdo, string $sql, array $parameters): array
{
  $statement = $pdo->prepare($sql);
  foreach ($parameters as $key => $value) {
    $statement->bindValue(':' . $key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $statement->execute();
  return $statement->fetchAll(PDO::FETCH_ASSOC);
}
class ScalePlanPdo extends PDO
{
  public function __construct() {}
  public function getAttribute(int $attribute): mixed
  {
    return 'mysql';
  }
}
$mock = new ScalePlanPdo();
$GLOBALS['voncms_publication_capability_cache'] = [
  'version' => 1,
  'published_at' => ['posts' => true],
];
$where =
  "WHERE (p.status = 'published' OR p.status IS NULL) AND (p.scheduled_at IS NULL OR p.scheduled_at <= :currentTime)";
$projection =
  'p.id, p.title, p.content, p.views, u.username, ' .
  voncms_publication_expression_sql($mock, 'posts', 'p') .
  ' AS effective_publish_at';
$legacy = voncms_post_listing_sql($mock, $projection, $where);
check(
  !str_contains($legacy, 'FORCE INDEX') && !str_contains($legacy, ') chosen'),
  'unrepaired installs use the original query',
);
$caps = [];
foreach (voncms_schema_listing_index_specs() as $table => $indexes) {
  $caps[$table] = array_fill_keys(array_keys($indexes), true);
}
$GLOBALS['voncms_publication_capability_cache']['query_indexes'] = $caps;
check(
  str_contains(voncms_post_listing_sql($mock, $projection, $where), 'idx_listing_order'),
  'public lists choose indexed IDs before wide rows',
);
check(
  str_contains(
    voncms_post_listing_sql($mock, $projection, $where . ' AND p.category = :category'),
    'idx_listing_category',
  ),
  'category equality uses its ordered index',
);
check(
  str_contains(
    voncms_post_listing_sql($mock, $projection, 'WHERE p.author_id = :currentUserId'),
    'idx_listing_author',
  ),
  'writer ownership stays inside the ID selection',
);
$authorSql = voncms_post_listing_sql($mock, $projection, $where . ' AND u.username = :authorName');
check(
  substr_count($authorSql, 'LEFT JOIN users') === 2 &&
    strpos($authorSql, ':authorName') < strpos($authorSql, 'LIMIT'),
  'author filtering happens before pagination',
);
check(
  !str_contains(voncms_post_count_sql($where), 'JOIN users') &&
    str_contains(voncms_post_count_sql($where . ' AND u.username = :authorName'), 'JOIN users'),
  'counts omit only unnecessary author joins',
);
check(
  !str_contains(
    voncms_post_listing_sql($mock, $projection, $where . ' AND p.title LIKE :searchLike'),
    'FORCE INDEX',
  ),
  'search keeps its existing query and semantics',
);
foreach (
  [
    'WHERE 1=1 AND p.status = :statusFilter',
    'WHERE p.author_id = :currentUserId AND p.status = :statusFilter',
    'WHERE p.category = :category AND p.status = :statusFilter',
  ]
  as $statusWhere
) {
  $statusSql = voncms_post_listing_sql($mock, $projection, $statusWhere);
  check(
    !str_contains($statusSql, 'FORCE INDEX') &&
      !str_contains($statusSql, ') chosen') &&
      str_contains($statusSql, $statusWhere),
    'explicit status filters retain optimizer choice and every permission/filter predicate',
  );
}
check(
  voncms_normalize_public_page('166667') === 166667 &&
    voncms_normalize_public_page('99999999') === 1000000 &&
    voncms_normalize_public_page(['2']) === 1,
  'page ceiling is raised without accepting malformed pages',
);
$invalidIndexRejected = false;
try {
  voncms_query_index_hint($mock, 'posts', 'arbitrary_index');
} catch (InvalidArgumentException $error) {
  $invalidIndexRejected = true;
}
check($invalidIndexRejected, 'SQL index names are allowlisted');
$mysql = ($argv[1] ?? '') === '--mysql';
if (!$mysql) {
  echo "PASS {$checks} focused checks (no database changes)\n";
  exit(0);
}
$database = 'voncms_qa_scale_' . bin2hex(random_bytes(6));
$admin = null;
$created = false;
try {
  $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false];
  $admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', '', $options);
  $exists = $admin->prepare('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
  $exists->execute([$database]);
  if ($exists->fetchColumn() !== false) {
    throw new RuntimeException('Refuse an existing QA database');
  }
  $admin->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  $created = true;
  $pdo = new PDO("mysql:host=127.0.0.1;dbname={$database};charset=utf8mb4", 'root', '', $options);
  // The distribution SQL has a sample CREATE DATABASE/USE preamble. Execute table DDL only in QA.
  $schema = (string) file_get_contents($root . '/public/install.sql');
  $schema = preg_replace('/^CREATE DATABASE[^;]*;\s*USE[^;]*;/m', '', $schema);
  if (preg_match('/\b(?:CREATE\s+DATABASE|USE\s+example_db)\b/i', $schema)) {
    throw new RuntimeException('Unexpected distribution SQL database selector');
  }
  $pdo->exec($schema);
  $pdo->exec('ALTER TABLE posts MODIFY views INT DEFAULT 0');
  $pdo->exec('ALTER TABLE pages MODIFY views INT DEFAULT 0');
  $pdo->exec('ALTER TABLE analytics MODIFY id INT NOT NULL AUTO_INCREMENT');
  $pdo->exec(
    "INSERT INTO users(id,username,email,password,role) VALUES(1,'writer1','qa1@example.test','not-a-password','Writer'),(2,'writer2','qa2@example.test','not-a-password','Writer')",
  );
  $insert = $pdo->prepare(
    'INSERT INTO posts(id,title,slug,content,excerpt,author_id,status,scheduled_at,published_at,category,views,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  for ($id = 1; $id <= 240; $id++) {
    $insert->execute([
      $id,
      'Malaysia bantuan ' . $id,
      'qa-' . $id,
      '<p>Synthetic content</p>',
      'Excerpt',
      ($id % 2) + 1,
      $id % 7 === 0 ? 'draft' : ($id % 11 === 0 ? null : 'published'),
      $id % 13 === 0 ? '2099-01-01 00:00:00' : null,
      $id % 5 === 0 ? null : '2026-01-02 00:00:00',
      'Category ' . $id % 3,
      $id,
      '2026-01-01 00:00:00',
      '2026-01-03 00:00:00',
    ]);
  }
  $pdo->exec(
    "INSERT INTO pages(id,title,slug,views,status) VALUES(1,'QA page','qa-page',2147483647,'published')",
  );
  $pdo->exec(
    "INSERT INTO analytics(id,ip_hash,visit_date,created_at) VALUES(2147483647,'qa-hash',CURDATE(),NOW())",
  );
  $before = $pdo
    ->query(
      'SELECT id,title,slug,content,excerpt,author_id,status,scheduled_at,published_at,category,views,created_at,updated_at FROM posts ORDER BY id',
    )
    ->fetchAll(PDO::FETCH_ASSOC);
  $GLOBALS['voncms_publication_capability_cache'] = [
    'version' => 1,
    'published_at' => ['posts' => true, 'pages' => true],
  ];
  $cases = [
    [$where, ['currentTime' => '2026-10-03 00:00:00']],
    [
      $where . ' AND p.category = :category',
      ['currentTime' => '2026-10-03 00:00:00', 'category' => 'Category 1'],
    ],
    ['WHERE 1=1', []],
    ['WHERE 1=1 AND p.status = :statusFilter', ['statusFilter' => 'draft']],
    [
      'WHERE p.author_id = :currentUserId AND p.status = :statusFilter',
      ['currentUserId' => 1, 'statusFilter' => 'draft'],
    ],
    [
      $where . ' AND u.username = :authorName',
      ['currentTime' => '2026-10-03 00:00:00', 'authorName' => 'writer1'],
    ],
  ];
  $originalQueries = [];
  foreach ($cases as [$condition, $parameters]) {
    $originalQueries[] = voncms_post_listing_sql($pdo, $projection, $condition);
  }
  $runtime = voncms_schema_repair_runtime_capabilities($pdo);
  check($runtime['warnings'] === [], 'runtime repair accepts populated analytics integer widening');
  voncms_schema_repair_core_columns($pdo);
  $repair = voncms_schema_repair_listing_indexes($pdo);
  check($repair['warnings'] === [], 'query index migration completes without warnings');
  $verified = voncms_schema_listing_capabilities($pdo);
  check(
    $verified === $caps,
    'only verified generated expressions and full indexes activate fast paths',
  );
  $GLOBALS['voncms_publication_capability_cache']['query_indexes'] = $verified;
  foreach ($cases as $case => [$condition, $parameters]) {
    foreach ([6, 20, 50, 200] as $limit) {
      foreach ([0, 20, 150, 1000000] as $offset) {
        $parameters['limit'] = $limit;
        $parameters['offset'] = $offset;
        $old = queryRows($pdo, $originalQueries[$case], $parameters);
        $new = queryRows($pdo, voncms_post_listing_sql($pdo, $projection, $condition), $parameters);
        if ($old !== $new) {
          throw new RuntimeException('Listing row parity failed');
        }
      }
    }
  }
  check(
    true,
    '96 public/category/admin/status/writer/author pagination cases preserve full row parity',
  );
  $mapWhere =
    "WHERE p.status = 'published' AND (p.scheduled_at IS NULL OR p.scheduled_at <= :currentTime)";
  $mapProjection = 'p.id,p.slug,p.updated_at,p.created_at,p.category';
  $legacyMap =
    'SELECT ' .
    $mapProjection .
    ' FROM posts p ' .
    $mapWhere .
    ' ORDER BY p.updated_at DESC,p.id DESC LIMIT :limit OFFSET :offset';
  $parameters = ['currentTime' => '2026-10-03 00:00:00', 'limit' => 1000, 'offset' => 20];
  check(
    queryRows($pdo, $legacyMap, $parameters) ===
      queryRows(
        $pdo,
        voncms_post_listing_sql($pdo, $mapProjection, $mapWhere, false, true),
        $parameters,
      ),
    'post sitemap chunk preserves update-time ordering and rows',
  );
  $categories =
    "SELECT DISTINCT category FROM posts%s WHERE (status='published' OR status IS NULL) AND (scheduled_at IS NULL OR scheduled_at<=:currentTime) AND category IS NOT NULL AND TRIM(category)<>'' ORDER BY category";
  check(
    queryRows($pdo, sprintf($categories, ''), ['currentTime' => '2026-10-03 00:00:00']) ===
      queryRows(
        $pdo,
        sprintf($categories, voncms_query_index_hint($pdo, 'posts', 'idx_listing_category')),
        ['currentTime' => '2026-10-03 00:00:00'],
      ),
    'category discovery returns the same complete category list',
  );
  $after = $pdo
    ->query(
      'SELECT id,title,slug,content,excerpt,author_id,status,scheduled_at,published_at,category,views,created_at,updated_at FROM posts ORDER BY id',
    )
    ->fetchAll(PDO::FETCH_ASSOC);
  check($before === $after, 'index and integer widening preserves every original post field');
  $second = voncms_schema_repair_listing_indexes($pdo);
  check(
    $second['fixes'] === [] &&
      $second['warnings'] === [] &&
      voncms_schema_repair_runtime_identities($pdo) === [],
    'repair is idempotent',
  );
  $pdo->exec('UPDATE pages SET views=views+1,updated_at=updated_at WHERE id=1');
  $pdo->exec("INSERT INTO analytics(ip_hash,visit_date) VALUES('next-hash',CURDATE())");
  $nextAnalyticsId = (int) $pdo->lastInsertId();
  check(
    (int) $pdo->query('SELECT views FROM pages WHERE id=1')->fetchColumn() === 2147483648 &&
      $nextAnalyticsId === 2147483648,
    'view counters and analytics identities pass the old signed-INT boundary',
  );
  $dailyLegacy =
    'SELECT visit_date,COUNT(*) AS visits,COUNT(DISTINCT ip_hash) AS unique_visitors FROM analytics GROUP BY visit_date ORDER BY visit_date';
  $dailyIndexed = str_replace(
    'FROM analytics',
    'FROM analytics' . voncms_query_index_hint($pdo, 'analytics', 'idx_visit_daily'),
    $dailyLegacy,
  );
  check(
    queryRows($pdo, $dailyLegacy, []) === queryRows($pdo, $dailyIndexed, []),
    'daily analytics aggregate values are unchanged',
  );
  $pdo->exec(
    "INSERT INTO analytics(ip_hash,visit_date) SELECT 'expired',DATE_SUB(CURDATE(),INTERVAL 60 DAY) FROM posts",
  );
  $pdo->exec(
    "INSERT INTO analytics(ip_hash,visit_date) SELECT 'expired',DATE_SUB(CURDATE(),INTERVAL 60 DAY) FROM posts",
  );
  $pdo->exec(
    "INSERT INTO analytics(ip_hash,visit_date) SELECT 'expired',DATE_SUB(CURDATE(),INTERVAL 60 DAY) FROM posts",
  );
  $pdo->exec(
    "INSERT INTO analytics(ip_hash,visit_date) SELECT 'expired',DATE_SUB(CURDATE(),INTERVAL 60 DAY) FROM posts",
  );
  $pdo->exec(
    "INSERT INTO analytics(ip_hash,visit_date) SELECT 'expired',DATE_SUB(CURDATE(),INTERVAL 60 DAY) FROM posts",
  );
  $purged = $pdo->exec(
    'DELETE FROM analytics WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY visit_date, id LIMIT 1000',
  );
  check(
    $purged === 1000 &&
      (int) $pdo
        ->query(
          'SELECT COUNT(*) FROM analytics WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)',
        )
        ->fetchColumn() === 2,
    'purge removes at most 1000 expired rows and preserves retained rows',
  );
  // Reproduce the selective-status regression only in this disposable QA database.
  $pdo->exec('CREATE TABLE draft_plan_posts LIKE posts');
  $digits =
    '(SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)';
  $pdo->exec(
    "INSERT INTO draft_plan_posts(id,title,slug,content,author_id,status,created_at,published_at)
     SELECT n,CONCAT('QA ',n),CONCAT('draft-plan-',n),'QA',1,
       IF(n<=20,'draft','published'),
       IF(n<=20,'2010-01-01 00:00:00','2026-01-01 00:00:00'),
       IF(n<=20,NULL,'2026-01-01 00:00:00')
     FROM (SELECT 1+a.n+10*b.n+100*c.n+1000*d.n n FROM {$digits} a CROSS JOIN {$digits} b CROSS JOIN {$digits} c CROSS JOIN {$digits} d) numbers",
  );
  $pdo->query('ANALYZE TABLE draft_plan_posts')->fetchAll();
  $statusWhere = 'WHERE 1=1 AND p.status = :statusFilter';
  $statusParameters = ['statusFilter' => 'draft', 'limit' => 20, 'offset' => 0];
  $fixedSql = str_replace(
    'posts p',
    'draft_plan_posts p',
    voncms_post_listing_sql($pdo, $projection, $statusWhere),
  );
  $forcedSql =
    'SELECT p.id FROM draft_plan_posts p FORCE INDEX(idx_listing_order) ' .
    $statusWhere .
    ' ORDER BY p.listing_at DESC,p.created_at DESC,p.id DESC LIMIT :limit OFFSET :offset';
  $indexReads = static function (PDO $connection): int {
    // Include the initial cursor entry as well as traversal steps.
    $rows = $connection
      ->query(
        "SHOW SESSION STATUS WHERE Variable_name IN ('Handler_read_first','Handler_read_last','Handler_read_next','Handler_read_prev')",
      )
      ->fetchAll(PDO::FETCH_ASSOC);
    return array_sum(array_column($rows, 'Value'));
  };
  $beforeReads = $indexReads($pdo);
  $forcedRows = queryRows($pdo, $forcedSql, $statusParameters);
  $forcedReads = $indexReads($pdo) - $beforeReads;
  $beforeReads = $indexReads($pdo);
  $fixedRows = queryRows($pdo, $fixedSql, $statusParameters);
  $fixedReads = $indexReads($pdo) - $beforeReads;
  check(
    count($fixedRows) === 20 && array_column($fixedRows, 'id') === array_column($forcedRows, 'id'),
    'old drafts preserve exact IDs and ordering among 10000 posts',
  );
  echo "Draft index cursor reads: forced={$forcedReads}, fixed={$fixedReads}\n";
  check(
    $forcedReads >= 10000 && $fixedReads <= 40,
    'selective Draft lookup avoids the forced full date-index scan',
  );
  $pdo->exec('ALTER TABLE posts DROP INDEX idx_listing_order');
  $pdo->exec('CREATE INDEX idx_listing_order ON posts(title)');
  $conflict = voncms_schema_repair_listing_indexes($pdo);
  check(
    $conflict['warnings'] !== [] &&
      !voncms_schema_listing_capabilities($pdo)['posts']['idx_listing_order'],
    'conflicting indexes are not replaced or trusted',
  );
  $pdo->exec('ALTER TABLE posts ALTER INDEX idx_listing_category INVISIBLE');
  check(
    !voncms_schema_listing_capabilities($pdo)['posts']['idx_listing_category'],
    'invisible indexes are not activated',
  );
  echo "PASS {$checks} focused checks with isolated MySQL\n";
} finally {
  if ($created && $admin instanceof PDO) {
    $admin->exec("DROP DATABASE `{$database}`");
    echo "QA database removed\n";
  }
}
