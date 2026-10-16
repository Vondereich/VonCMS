<?php
// Isolated source-level regression checks. No installed site, production DB, or mail delivery.
$root = dirname(__DIR__, 2);
$checks = 0;
function check(bool $ok, string $message): void
{
  global $checks;
  if (!$ok) {
    throw new RuntimeException($message);
  }
  $checks++;
}
function declaration(string $path, string $needle): string
{
  $source = file_get_contents($path);
  $start = strpos($source, $needle);
  if ($start === false) {
    throw new RuntimeException('Missing declaration: ' . $needle);
  }
  $tokens = token_get_all('<?php ' . substr($source, $start));
  $result = '';
  $depth = 0;
  $opened = false;
  foreach (array_slice($tokens, 1) as $token) {
    $text = is_array($token) ? $token[1] : $token;
    $result .= $text;
    if (
      $token === '{' ||
      (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))
    ) {
      $depth++;
      $opened = true;
    } elseif ($token === '}' && --$depth === 0 && $opened) {
      return $result;
    }
  }
  throw new RuntimeException('Incomplete declaration.');
}
function loadFunction(string $file, string $name): void
{
  global $root;
  eval(declaration($root . '/' . $file, 'function ' . $name . '('));
}
function rejected(callable $callback): bool
{
  try {
    $callback();
    return false;
  } catch (Throwable $error) {
    return true;
  }
}
function cleanup(string $path): void
{
  if (is_file($path)) {
    unlink($path);
    return;
  }
  foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $item) {
    cleanup($path . '/' . $item);
  }
  rmdir($path);
}
class ResponseHelper
{
  public static function sendError(mixed $message, int $status = 400): never
  {
    throw new RuntimeException((string) $message, $status);
  }
}
function sendApiHeaders(...$args): void {}

// Force both legacy prechecks through one barrier; the real atomic gate must
// still admit only one request. No endpoint bootstrap or comment DB is loaded.
if (($argv[1] ?? '') === '--comment-quota-worker') {
  $fixture = $argv[2];
  $workerId = $argv[3];
  define('VONCMS_CORE_LOADED', true);
  require_once $root . '/public/core/RateLimiter.php';
  $workerStorage = new ReflectionProperty(RateLimiter::class, 'storageDir');
  $workerStorage->setValue(null, $fixture . '/');
  class CommentQuotaRateLimiter extends RateLimiter
  {
    private static function barrier(): void
    {
      global $fixture, $workerId;
      file_put_contents($fixture . '/comment-' . $workerId . '.ready', 'ready');
      $deadline = microtime(true) + 10;
      while (!is_file($fixture . '/comments.go')) {
        if (microtime(true) > $deadline) {
          throw new RuntimeException('Comment quota barrier timed out.');
        }
        usleep(10000);
        clearstatcache();
      }
    }
    public static function requireNotLimited($identifier = null)
    {
      parent::requireNotLimited($identifier);
      self::barrier();
    }
    public static function requireAttempt($identifier = null)
    {
      self::barrier();
      parent::requireAttempt($identifier);
    }
  }
  class CSRFProtection
  {
    public static function requireToken(): void {}
  }
  $action = 'add';
  $hasValidSession = false;
  $_SERVER['REMOTE_ADDR'] = '198.51.100.73';
  eval(
    str_replace(
      'RateLimiter::',
      'CommentQuotaRateLimiter::',
      declaration($root . '/public/api/save_comments.php', "if (\$action === 'add')"),
    )
  );
  echo json_encode(['continued' => true]);
  exit();
}
$temp = sys_get_temp_dir() . '/voncms-hardening-' . bin2hex(random_bytes(6));
mkdir($temp);
try {
  require_once $root . '/public/seo_schema_helper.php';
  require_once $root . '/public/api/content_embed_helper.php';
  class SessionManager
  {
    public static bool $admin = false;
    public static function isAdmin(): bool
    {
      return self::$admin;
    }
  }
  $postSource = file_get_contents($root . '/public/api/save_post.php');
  $filterStart = strpos($postSource, 'if (!SessionManager::isAdmin())');
  $filterEnd = strpos($postSource, "if (function_exists('sanitize_input'))", $filterStart);
  check($filterStart !== false && $filterEnd !== false, 'Post preprocessing boundary not found.');
  $postFilter = substr($postSource, $filterStart, $filterEnd - $filterStart);
  foreach (
    [
      'convert_supported_embeds',
      'strip_gutenberg_comments',
      'should_remap_internal_href',
      'remap_internal_links',
      'sanitize_imported_content_html',
      'normalize_imported_content',
    ]
    as $name
  ) {
    loadFunction('public/api/tools/wp_import.php', $name);
  }
  foreach (['https://example.test', 'https://example.test/zangetsu'] as $domainUrl) {
    eval(declaration($root . '/public/rss.php', '$buildAbsoluteUrl = function') . ';');
    /** @var Closure(?string): string $sanitizeRssContent */
    $sanitizeRssContent = eval(
      declaration($root . '/public/rss.php', '$sanitizeRssContent = function') .
        '; return $sanitizeRssContent;'
    );
    foreach (
      [
        'javascript:alert(1)',
        'java&#x73;cript:alert(1)',
        'java&#115;cript:alert(1)',
        'java&#9;script:alert(1)',
        'java%09script:alert(1)',
        'vbscript:msgbox(1)',
        'data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;',
        'https://user:password@example.test/private',
      ]
      as $url
    ) {
      $clean = $sanitizeRssContent(
        '<p><a href="' . $url . '">Link</a><img src="' . $url . '"></p>',
      );
      check(
        !str_contains($clean, 'href=') && !str_contains($clean, 'src='),
        'RSS unsafe URL survived: ' . $url,
      );
    }
    $safe = $sanitizeRssContent(
      '<p><a href="https://example.test/story?a=1&amp;b=2">Article</a>' .
        '<a href="mailto:qa@example.test">Email</a><a href="tel:+60123456789">Phone</a>' .
        '<a href="#section">Section</a><a href="another-story">Relative</a>' .
        '<img src="uploads/photo.webp" alt="Photo"><a href="//cdn.example.test/story">CDN</a></p>',
    );
    check(
      str_contains($safe, 'href="https://example.test/story?a=1&amp;b=2"') &&
        str_contains($safe, 'href="mailto:qa@example.test"') &&
        str_contains($safe, 'href="tel:+60123456789"') &&
        str_contains($safe, 'href="#section"') &&
        str_contains($safe, 'href="' . $domainUrl . '/another-story"') &&
        str_contains($safe, 'src="' . $domainUrl . '/uploads/photo.webp"') &&
        str_contains($safe, 'href="https://cdn.example.test/story"'),
      'RSS valid root/subfolder content changed.',
    );
    $clean = $sanitizeRssContent(
      '<p onclick="alert(1)">Keep</p><svg><a xlink:href="javascript:alert(1)">Bad</a></svg>' .
        '<math><mi href="javascript:alert(1)">Bad</mi></math>' .
        '<img src="/uploads/good.webp" srcset="data:text/html,bad 1x">' .
        '<iframe src="https://www.youtube.com/embed/qa"></iframe>',
    );
    check(
      !preg_match('/<(?:svg|math|iframe)\b|onclick=|srcset=|javascript:/i', $clean) &&
        str_contains($clean, 'Keep') &&
        str_contains($clean, 'https://www.youtube.com/embed/qa'),
      'RSS alternate active markup or embed conversion regressed.',
    );
    $chainPayload =
      '<p>Keep <a href="java&#x73;cript:alert(1)" onclick="alert(1)">Link</a>' .
      '<img src="https://example.test/photo.webp" alt="Keep image"></p>';
    foreach ([false, true] as $admin) {
      SessionManager::$admin = $admin;
      $rawContent = $chainPayload;
      eval($postFilter);
      $feed = $sanitizeRssContent($rawContent);
      check(
        !str_contains($feed, 'href=') &&
          !str_contains($feed, 'onclick=') &&
          str_contains($feed, 'Keep') &&
          str_contains($feed, 'https://example.test/photo.webp'),
        'Post preprocessing -> RSS chain lost the URL or content boundary.',
      );
    }
    $imported = normalize_imported_content($chainPayload, [], $domainUrl);
    $feed = $sanitizeRssContent($imported);
    check(
      !str_contains($feed, 'href=') &&
        !str_contains($feed, 'onclick=') &&
        str_contains($feed, 'https://example.test/photo.webp'),
      'WXR normalization -> RSS chain lost the URL or content boundary.',
    );
  }
  foreach (
    [
      '<script>alert(1)</script><style>body{display:none}</style><p>Keep</p>',
      '<p ONCLICK="alert(1)">Keep <a href="java&#x73;cript:alert(1)">link</a></p>',
      '<img src="data:text/html,bad" onerror="alert(1)" srcset="javascript:bad 1x">',
      '<svg><a xlink:href="javascript:bad">bad</a></svg><math><mi>bad</mi></math>',
      '<form action="https://evil.test"><input><button>Login</button></form>',
      '<iframe src="https://evil.test" srcdoc="bad"></iframe><p>Keep</p>',
      '<a href="java&#x26;#115;cript:bad">bad</a><img src="java&#9;script:bad">',
    ]
    as $payload
  ) {
    $clean = normalize_imported_content($payload, [], 'https://example.test/newsroom');
    check(
      !preg_match(
        '/<(?:script|style|svg|math|form|input|button|iframe)\b|\son[a-z]+=|(?:href|src|srcset|srcdoc)=/i',
        $clean,
      ),
      'WXR unsafe stored HTML survived.',
    );
  }
  $rich = normalize_imported_content(
    '<!-- wp:paragraph --><p style="text-align:center">Teks <strong>tebal</strong> &amp; sah</p>' .
      '<figure><img src="uploads/photo.webp" alt="Photo" width="640"><figcaption>Caption</figcaption></figure>' .
      '<table><tr><td>Cell</td></tr></table><a href="https://old.test/news/story" rel="sponsored nofollow">Story</a>' .
      '<a href="#section">Anchor</a><a href="mailto:qa@example.test">Email</a><a href="tel:+60123456789">Phone</a>' .
      '<a href="another-story">Relative</a><img src="//cdn.example.test/photo.webp">' .
      '<iframe src="https://www.youtube.com/embed/qa" width="560" height="315" allowfullscreen></iframe>',
    ['https://old.test'],
    'https://example.test/newsroom',
  );
  foreach (
    [
      'text-align:center',
      '<strong>tebal</strong>',
      'Teks',
      'uploads/photo.webp',
      'alt="Photo"',
      '<figcaption>Caption</figcaption>',
      '<table>',
      'https://example.test/newsroom/news/story',
      'rel="sponsored nofollow"',
      'href="#section"',
      'mailto:qa@example.test',
      'tel:+60123456789',
      'href="another-story"',
      'https://cdn.example.test/photo.webp',
      'https://www.youtube.com/embed/qa',
      'allowfullscreen',
    ]
    as $expected
  ) {
    check(str_contains($rich, $expected), 'WXR legitimate content changed: ' . $expected);
  }
  check(!str_contains($rich, '<!-- wp:'), 'WXR Gutenberg comments returned.');
  foreach (
    [
      'https://player.vimeo.com/video/123',
      'https://www.tiktok.com/player/v1/123',
      'https://www.instagram.com/reel/qa/embed',
      'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F',
    ]
    as $source
  ) {
    $clean = normalize_imported_content(
      '<iframe src="' . $source . '"></iframe>',
      [],
      'https://example.test',
    );
    check(
      str_contains($clean, '<iframe') && str_contains($clean, $source),
      'WXR supported provider removed: ' . $source,
    );
  }
  check(
    normalize_imported_content('', [], 'https://example.test') === '',
    'Empty WXR content changed.',
  );

  // Capture the real shared provider function at its cURL boundary, without networking.
  eval(
    'namespace GeminiHeaderProbe;
    function curl_init($url) { $GLOBALS["gemini_calls"][] = ["url" => $url]; return count($GLOBALS["gemini_calls"]) - 1; }
    function curl_setopt_array($ch, $options) { $GLOBALS["gemini_calls"][$ch]["options"] = $options; return true; }
    function curl_exec($ch) { return $GLOBALS["gemini_responses"][$ch]["body"]; }
    function curl_getinfo($ch, $option) { return $GLOBALS["gemini_responses"][$ch]["status"]; }
    function curl_errno($ch) { return $GLOBALS["gemini_responses"][$ch]["error"] ?? 0; }
    function curl_close($ch) {}
  ' .
      declaration(
        $root . '/public/api/ai_provider_helper.php',
        'function voncms_ai_generate_with_fallback(',
      )
  );
  $generateProbe = Closure::fromCallable('GeminiHeaderProbe\\voncms_ai_generate_with_fallback');
  $success = ['status' => 200, 'body' => '{"candidates":[]}'];
  foreach (
    [[$success], [['status' => 404, 'body' => '{"error":{"status":"NOT_FOUND"}}'], $success]]
    as $responses
  ) {
    $GLOBALS['gemini_calls'] = [];
    $GLOBALS['gemini_responses'] = $responses;
    $result = $generateProbe('qa-fake-key', 'gemini-2.5-pro', ['contents' => []], 12);
    check(
      $result['ok'] && $result['fallback_used'] === (count($responses) === 2),
      'Gemini success/fallback changed.',
    );
    foreach ($GLOBALS['gemini_calls'] as $call) {
      check(
        !str_contains($call['url'], '?') && !str_contains($call['url'], 'qa-fake-key'),
        'Gemini credential remains in URL.',
      );
      check(
        in_array('x-goog-api-key: qa-fake-key', $call['options'][CURLOPT_HTTPHEADER], true),
        'Gemini authentication header missing.',
      );
      check(
        $call['options'][CURLOPT_SSL_VERIFYPEER] === true &&
          $call['options'][CURLOPT_TIMEOUT] === 12 &&
          $call['options'][CURLOPT_POSTFIELDS] === '{"contents":[]}',
        'Gemini transport/payload contract changed.',
      );
    }
    if (count($responses) === 2) {
      check(
        str_contains($GLOBALS['gemini_calls'][1]['url'], 'gemini-flash-latest:generateContent'),
        'Gemini fallback model changed.',
      );
    }
  }
  foreach (
    [
      ['status' => 0, 'body' => false, 'error' => 1],
      ['status' => 200, 'body' => 'invalid'],
      ['status' => 403, 'body' => '{"error":{"message":"qa-fake-key"}}'],
      ['status' => 429, 'body' => '{"error":{"status":"RESOURCE_EXHAUSTED"}}'],
    ]
    as $response
  ) {
    $GLOBALS['gemini_calls'] = [];
    $GLOBALS['gemini_responses'] = [$response];
    $result = $generateProbe('qa-fake-key', 'gemini-2.5-pro', [], 12);
    check(
      !$result['ok'] &&
        count($GLOBALS['gemini_calls']) === 1 &&
        !str_contains(json_encode($result), 'qa-fake-key'),
      'Gemini error/fallback leaked key or changed.',
    );
  }
  foreach (["qa\r\nInjected: value", "qa\0key", '', 'qa key'] as $key) {
    $GLOBALS['gemini_calls'] = [];
    $result = $generateProbe($key, 'gemini-2.5-pro', [], 12);
    check(
      !$result['ok'] && $GLOBALS['gemini_calls'] === [],
      'Gemini header injection reached transport.',
    );
  }
  foreach (
    [
      'import_remote_ip_is_public',
      'import_remote_resolve_public_ips',
      'import_remote_host_resolves_publicly',
      'normalize_import_remote_fetch_url',
      'validate_import_remote_fetch_url',
    ]
    as $name
  ) {
    loadFunction('public/api/tools/wp_import.php', $name);
  }
  function debug_log($message): void {}
  foreach (
    [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '100.100.100.200',
      '100.64.0.1',
      '192.0.0.192',
      '198.18.0.1',
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      '0.0.0.0',
      '255.255.255.255',
      '224.0.0.1',
      '::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '3fff::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:100.100.100.200',
      '::ffff:6464:64c8',
      '::127.0.0.1',
      '64:ff9b::a9fe:a9fe',
      '64:ff9b::6464:64c8',
      '64:ff9b:1::808:808',
      '2002:7f00:1::1',
      '2001:0:4136:e378:8000:63bf:3fff:fdd2',
      'not-an-ip',
    ]
    as $ip
  ) {
    check(!import_remote_ip_is_public($ip), 'Import accepted a special/non-global IP: ' . $ip);
  }
  foreach (
    [
      '8.8.8.8',
      '1.1.1.1',
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
      '::ffff:8.8.8.8',
      '::ffff:808:808',
      '64:ff9b::808:808',
    ]
    as $ip
  ) {
    check(import_remote_ip_is_public($ip), 'Import rejected an ordinary public address: ' . $ip);
  }
  check(
    validate_import_remote_fetch_url('http://100.100.100.200/wp-content/uploads/qa.jpg') === '' &&
      validate_import_remote_fetch_url('http://[::ffff:7f00:1]/wp-content/uploads/qa.jpg') === '' &&
      validate_import_remote_fetch_url('https://8.8.8.8/wp-content/uploads/qa.jpg') !== '',
    'Import URL gate failed to use the corrected IP boundary.',
  );
  // Execute the real redirect loop with a non-network transport at the final sink.
  eval('namespace ImportRedirectProbe;
    function fetch_import_image_hop_with_curl($url, $path): array {
      $GLOBALS["import_hops"][] = $url;
      return count($GLOBALS["import_hops"]) === 1
        ? ["redirect" => true, "location" => $GLOBALS["import_location"], "http_code" => 302]
        : ["success" => true, "http_code" => 200];
    }');
  foreach (
    [
      'import_remote_ip_is_public',
      'import_remote_resolve_public_ips',
      'import_remote_host_resolves_publicly',
      'normalize_import_remote_fetch_url',
      'validate_import_remote_fetch_url',
      'resolve_import_remote_redirect_url',
      'fetch_import_image_url_with_redirect_validation',
    ]
    as $name
  ) {
    eval(
      'namespace ImportRedirectProbe;' .
        declaration($root . '/public/api/tools/wp_import.php', 'function ' . $name . '(')
    );
  }
  $redirectProbe = Closure::fromCallable(
    'ImportRedirectProbe\\fetch_import_image_url_with_redirect_validation',
  );
  foreach (
    [
      'http://100.100.100.200/qa.jpg',
      'http://[::ffff:7f00:1]/qa.jpg',
      'http://[64:ff9b::a9fe:a9fe]/qa.jpg',
    ]
    as $location
  ) {
    $GLOBALS['import_location'] = $location;
    $GLOBALS['import_hops'] = [];
    check(
      !$redirectProbe('https://8.8.8.8/wp-content/uploads/qa.jpg', $temp . '/redirect-probe.bin') &&
        count($GLOBALS['import_hops']) === 1,
      'Public redirect reached a rejected internal destination.',
    );
  }
  foreach (['https://1.1.1.1/photo.jpg', '/uploads/photo.jpg'] as $location) {
    $GLOBALS['import_location'] = $location;
    $GLOBALS['import_hops'] = [];
    check(
      $redirectProbe('https://8.8.8.8/wp-content/uploads/qa.jpg', $temp . '/redirect-probe.bin') &&
        count($GLOBALS['import_hops']) === 2,
      'Safe public/relative media redirect no longer works.',
    );
  }
  foreach (
    [
      'stripLeadingSqlComments',
      'maskImportSqlQuotes',
      'getAllowedImportStatementType',
      'requireCompatibleImportSqlMode',
      'isSqlQuoteEscaped',
      'iterateSqlStatementsFromFile',
    ]
    as $name
  ) {
    loadFunction('public/api/import_db.php', $name);
  }
  foreach (
    [
      "INSERT INTO posts (title) VALUES ('normal') /*!50000 ; UPDATE users SET role='Root' */",
      "INSERT INTO posts (title) VALUES ('normal') /*M!100000 UPDATE users SET role='Root' */",
      "/*+ hint */ INSERT INTO posts (title) VALUES ('normal')",
      "INSERT INTO posts (title) VALUES ('unterminated)",
      "INSERT INTO posts (title) VALUES (1); UPDATE users SET role='Root'",
    ]
    as $sql
  ) {
    check(
      rejected(fn() => getAllowedImportStatementType($sql)),
      'SQL comment/quote bypass accepted.',
    );
  }
  foreach (
    [
      'CREATE TABLE x (n INT) SELECT id FROM users',
      'CREATE TABLE x (n INT) AS SELECT id FROM users',
      'INSERT INTO posts (title) VALUES ((SELECT password FROM users LIMIT 1))',
      "INSERT INTO posts (title) VALUES (LOAD_FILE('/etc/passwd'))",
      "INSERT INTO posts (title) VALUES ('ok') ON DUPLICATE KEY UPDATE title='changed'",
    ]
    as $sql
  ) {
    check(getAllowedImportStatementType($sql) === '', 'SQL expression bypass accepted.');
  }
  foreach (
    [
      "INSERT INTO posts (title) VALUES ('/*! this is article content */')",
      "INSERT INTO posts (title) VALUES ('it\\'s safe; -- content'), ('doubled ''quotes''')",
      "INSERT /* harmless */ INTO posts (title) VALUES ('ok')",
      "-- VonCMS backup\nINSERT INTO posts (title) VALUES ('multiline\ntext'), (NULL)",
      "CREATE TABLE x (n INT, title VARCHAR(255) DEFAULT 'SELECT') ENGINE=InnoDB",
      'CREATE TABLE ' . chr(96) . 'select' . chr(96) . ' (n INT)',
      'SET FOREIGN_KEY_CHECKS=0',
      'DROP TABLE IF EXISTS posts',
    ]
    as $sql
  ) {
    check(getAllowedImportStatementType($sql) !== '', 'Trusted backup rejected: ' . $sql);
  }
  foreach (
    [
      str_repeat('a', 10000),
      str_repeat('b', 100000),
      str_repeat("quoted \\'word\\' and ''double''; -- body\n", 5000),
      str_repeat('c', 1048576),
    ]
    as $body
  ) {
    $sql = "INSERT INTO `posts` (`content`) VALUES ('" . $body . "')";
    check(
      getAllowedImportStatementType($sql) === 'insert',
      'Long trusted article backup rejected.',
    );
    check(
      maskImportSqlQuotes($sql) === 'INSERT INTO quoted_identifier (quoted_identifier) VALUES (0)',
      'Long SQL literal masking changed.',
    );
    file_put_contents($temp . '/long-backup.sql', $sql . ';');
    $longStatements = iterator_to_array(iterateSqlStatementsFromFile($temp . '/long-backup.sql'));
    check(
      count($longStatements) === 1 &&
        getAllowedImportStatementType($longStatements[0]) === 'insert',
      'Long backup streaming/sanitizer chain failed.',
    );
    check(
      getAllowedImportStatementType(
        "INSERT INTO posts (content, title) VALUES ('" . $body . "', (SELECT 1))",
      ) === '',
      'Long literal hid an SQL expression.',
    );
    check(
      getAllowedImportStatementType(
        "CREATE TABLE x (padding TEXT DEFAULT '" . $body . "') SELECT password FROM users",
      ) === '',
      'Long literal hid a query-backed CREATE TABLE.',
    );
  }
  file_put_contents(
    $temp . '/backup.sql',
    "-- backup\nINSERT INTO posts (title) VALUES ('a;b /* text */');\nSET FOREIGN_KEY_CHECKS=1;\n",
  );
  $statements = iterator_to_array(iterateSqlStatementsFromFile($temp . '/backup.sql'));
  check(
    count($statements) === 2 && getAllowedImportStatementType($statements[0]) === 'insert',
    'Backup splitter regression.',
  );
  check(
    !str_contains(
      stripLeadingSqlComments("INSERT /* comment */ INTO posts (title) VALUES ('ok')"),
      'comment',
    ),
    'Comments survive execution normalization.',
  );

  class ImportModeStatement extends PDOStatement
  {
    public function __construct(private mixed $mode) {}
    public function fetchColumn(int $column = 0): mixed
    {
      return $this->mode;
    }
  }
  class ImportModeProbe extends PDO
  {
    public array $queries = [];
    public function __construct(private mixed $mode) {}
    public function query(
      string $query,
      ?int $fetchMode = null,
      mixed ...$fetchModeArgs,
    ): PDOStatement|false {
      $this->queries[] = $query;
      if ($this->mode === null) {
        throw new PDOException('QA mode lookup failure');
      }
      return new ImportModeStatement($this->mode);
    }
  }
  foreach (['', 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY', 'ANSI_QUOTES_EXTRA'] as $mode) {
    $modeProbe = new ImportModeProbe($mode);
    requireCompatibleImportSqlMode($modeProbe);
    check(
      $modeProbe->queries === ['SELECT @@SESSION.sql_mode'],
      'Compatible restore mode changed connection state.',
    );
  }
  foreach (
    ['NO_BACKSLASH_ESCAPES', 'ANSI_QUOTES', 'strict_trans_tables, ansi_quotes ', false, null]
    as $mode
  ) {
    $modeProbe = new ImportModeProbe($mode);
    $status = 0;
    try {
      requireCompatibleImportSqlMode($modeProbe);
    } catch (RuntimeException $error) {
      $status = $error->getCode();
    }
    check(
      $status === (is_string($mode) ? 409 : 503) &&
        $modeProbe->queries === ['SELECT @@SESSION.sql_mode'],
      'Incompatible/unreadable restore mode did not fail closed before writes.',
    );
  }
  $importSource = file_get_contents($root . '/public/api/import_db.php');
  check(
    str_contains($importSource, "requireCompatibleImportSqlMode(\$pdo);\n\ntry {") ||
      str_contains($importSource, "requireCompatibleImportSqlMode(\$pdo);\r\n\r\ntry {"),
    'Restore mode rejection entered import cleanup instead of stopping before it.',
  );

  loadFunction('public/api/db_query.php', 'normalizeAdminReadQuery');
  loadFunction('public/api/db_query.php', 'beginAdminReadTransaction');
  foreach (
    [
      'EXPLAIN ANALYZE DELETE FROM posts',
      'EXPLAIN FORMAT=TREE ANALYZE UPDATE posts SET views=0',
      'SELECT 1; DELETE FROM posts',
      'SELECT LOAD_FILE("/etc/passwd")',
    ]
    as $sql
  ) {
    check(rejected(fn() => normalizeAdminReadQuery($sql)), 'Read-only SQL trigger accepted.');
  }
  foreach (
    ['SELECT 1', 'SHOW TABLES', 'DESCRIBE posts', 'EXPLAIN FORMAT=JSON SELECT * FROM posts']
    as $sql
  ) {
    check(normalizeAdminReadQuery($sql) === $sql, 'Read-only control rejected.');
  }
  class ReadOnlyProbe extends PDO
  {
    public array $queries = [];
    public function __construct() {}
    public function inTransaction(): bool
    {
      return false;
    }
    public function getAttribute(int $attribute): mixed
    {
      return 'mysql';
    }
    public function exec(string $statement): int|false
    {
      $this->queries[] = $statement;
      return 0;
    }
  }
  $probe = new ReadOnlyProbe();
  beginAdminReadTransaction($probe);
  check($probe->queries === ['START TRANSACTION READ ONLY'], 'DB read-only guard not enforced.');

  eval(declaration($root . '/public/core/RateLimiter.php', 'class RateLimiter'));
  $property = new ReflectionProperty(RateLimiter::class, 'storageDir');
  $property->setValue(null, $temp . '/');
  check(RateLimiter::getStorageHealth()['healthy'], 'Fixture limiter storage is not writable.');
  for ($i = 0; $i < 4; $i++) {
    check(
      RateLimiter::consumeAttempt('comment:ip:198.51.100.73'),
      'Comment fixture preseed failed.',
    );
  }
  $workers = [];
  try {
    for ($i = 0; $i < 4; $i++) {
      $pipes = [];
      $worker = proc_open(
        [PHP_BINARY, __FILE__, '--comment-quota-worker', $temp, (string) $i],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
      );
      check(is_resource($worker), 'Unable to start comment quota worker.');
      fclose($pipes[0]);
      $workers[] = [$worker, $pipes];
    }
    $deadline = microtime(true) + 10;
    do {
      clearstatcache();
      $ready = count(glob($temp . '/comment-*.ready') ?: []);
      if (microtime(true) > $deadline) {
        throw new RuntimeException('Comment quota workers did not reach the barrier.');
      }
      if ($ready < 4) {
        usleep(10000);
      }
    } while ($ready < 4);
    file_put_contents($temp . '/comments.go', 'go');
    $continued = 0;
    $rejectedWorkers = 0;
    foreach ($workers as [$worker, $pipes]) {
      $output = json_decode(stream_get_contents($pipes[1]), true);
      $errors = stream_get_contents($pipes[2]);
      check($errors === '', 'Comment quota worker failed: ' . $errors);
      $continued += (int) !empty($output['continued']);
      $rejectedWorkers += (int) isset($output['error']);
    }
    check(
      $continued === 1 && $rejectedWorkers === 3,
      'Concurrent comment requests exceeded quota.',
    );
  } finally {
    file_put_contents($temp . '/comments.go', 'go');
    foreach ($workers as [$worker, $pipes]) {
      foreach ([1, 2] as $pipe) {
        fclose($pipes[$pipe]);
      }
      if (proc_get_status($worker)['running']) {
        proc_terminate($worker);
      }
      proc_close($worker);
    }
  }
  $one = RateLimiter::normalizeLoginAddress('2001:db8:1234:5::1');
  check(
    RateLimiter::normalizeLoginAddress('::ffff:192.0.2.1') === '192.0.2.1',
    'Mapped IPv4 addresses are incorrectly grouped as one IPv6 subnet.',
  );
  check(
    $one === RateLimiter::normalizeLoginAddress('2001:0db8:1234:0005::abcd'),
    'IPv6 /64 aliases bypass login quota.',
  );
  check(
    $one !== RateLimiter::normalizeLoginAddress('2001:db8:1234:6::1'),
    'Independent IPv6 subnets combined.',
  );
  for ($i = 0; $i < 5; $i++) {
    check(RateLimiter::consumeAttempt('login:ip:control'), 'Ordinary IP attempt rejected early.');
  }
  check(!RateLimiter::consumeAttempt('login:ip:control'), 'Shared IP quota lost.');
  for ($i = 0; $i < 12; $i++) {
    check(
      RateLimiter::consumeAttempt('login:ip:shared-network'),
      'Legitimate shared-network login blocked.',
    );
    RateLimiter::refundSuccessfulAttempt('login:ip:shared-network');
  }
  for ($i = 0; $i < 4; $i++) {
    check(RateLimiter::consumeAttempt('login:ip:failures'), 'Failed attempts blocked early.');
  }
  check(RateLimiter::consumeAttempt('login:ip:failures'), 'Owned account control blocked early.');
  RateLimiter::refundSuccessfulAttempt('login:ip:failures');
  check(
    RateLimiter::consumeAttempt('login:ip:failures') &&
      !RateLimiter::consumeAttempt('login:ip:failures'),
    'Owned-account success erased earlier failures.',
  );
  for ($i = 0; $i < 20; $i++) {
    check(
      RateLimiter::consumeFixedWindow('login:account:1', 20, 900, 'login'),
      'Account quota rejected early.',
    );
  }
  check(
    !RateLimiter::consumeFixedWindow('login:account:1', 20, 900, 'login'),
    'Account quota not enforced.',
  );
  check(
    RateLimiter::consumeFixedWindow('login:account:2', 20, 900, 'login'),
    'Different account blocked.',
  );
  check(
    RateLimiter::consumeFixedWindow('password-recovery-email:1', 5, 900),
    'Recovery ledger changed.',
  );
  $ledger = $temp . '/' . md5('login-account-ledger:v1') . '.json';
  $buckets = json_decode(file_get_contents($ledger), true);
  foreach ($buckets as &$bucket) {
    $bucket['window_started_at'] = time() - 901;
  }
  unset($bucket);
  file_put_contents($ledger, json_encode($buckets));
  check(
    RateLimiter::consumeFixedWindow('login:account:1', 20, 900, 'login'),
    'Account quota expiry failed.',
  );
  file_put_contents($ledger, 'broken');
  check(
    !RateLimiter::consumeFixedWindow('login:account:1', 20, 900, 'login'),
    'Corrupt account storage fails open.',
  );
  check(
    !str_contains(file_get_contents($root . '/public/api/login.php'), 'RateLimiter::reset('),
    'Successful login can erase shared quota.',
  );
  loadFunction('public/api/login.php', 'voncms_verify_login_candidate');
  file_put_contents($ledger, '{}');
  // Record the actual verifier's bcrypt work, not a flaky wall-clock threshold.
  eval('namespace LoginWorkProbe;
    use \RateLimiter;
    function password_verify($password, $hash): bool {
      $info = \password_get_info($hash);
      $GLOBALS["login_work_units"] += 1 << (int) ($info["options"]["cost"] ?? 0);
      return \password_verify($password, $hash);
    }');
  eval(
    'namespace LoginWorkProbe; use \RateLimiter;' .
      declaration($root . '/public/api/login.php', 'function voncms_verify_login_candidate(')
  );
  $loginWorkProbe = Closure::fromCallable('LoginWorkProbe\\voncms_verify_login_candidate');
  $expectedWork = 1 << max(12, PASSWORD_BCRYPT_DEFAULT_COST);
  foreach ([10, 11, 12] as $cost) {
    $candidate = [
      'id' => 800 + $cost,
      'password' => password_hash('qa-work-password', PASSWORD_BCRYPT, ['cost' => $cost]),
    ];
    foreach (['qa-work-password' => true, 'wrong-password' => false] as $password => $expected) {
      $GLOBALS['login_work_units'] = 0;
      check(
        $loginWorkProbe($candidate, $password) === $expected &&
          $GLOBALS['login_work_units'] === $expectedWork,
        'Login work differs for valid/invalid legacy/current bcrypt hashes.',
      );
    }
  }
  foreach ([false, ['id' => 899, 'password' => 'malformed-hash']] as $candidate) {
    $GLOBALS['login_work_units'] = 0;
    check(
      !$loginWorkProbe($candidate, 'wrong-password') &&
        $GLOBALS['login_work_units'] === $expectedWork,
      'Unknown or malformed login bypasses normalized bcrypt work: ' .
        gettype($candidate) .
        ', ' .
        $GLOBALS['login_work_units'] .
        '/' .
        $expectedWork,
    );
  }
  $knownUser = [
    'id' => 73,
    'password' => password_hash('qa-only-password', PASSWORD_BCRYPT, ['cost' => 10]),
  ];
  for ($i = 0; $i < 20; $i++) {
    check(!voncms_verify_login_candidate($knownUser, 'wrong-password'), 'Wrong password accepted.');
  }
  check(
    voncms_verify_login_candidate($knownUser, 'wrong-password') ===
      voncms_verify_login_candidate(false, 'wrong-password'),
    'Known quota reveals account existence through the return contract.',
  );
  check(
    !voncms_verify_login_candidate($knownUser, 'qa-only-password'),
    'Spent quota permits correct credentials.',
  );
  check(
    voncms_verify_login_candidate(
      ['id' => 74, 'password' => $knownUser['password']],
      'qa-only-password',
    ),
    'Fresh account control rejected.',
  );
  check(
    !str_contains(file_get_contents($root . '/public/api/login.php'), 'Too many login attempts.'),
    'Account-specific status bypasses generic failure.',
  );

  foreach (['voncms_filter_settings_mirror', 'voncms_write_settings_json_mirror'] as $name) {
    loadFunction('public/api/save_settings.php', $name);
  }
  $settings = [
    'smtpHost' => 'mail.example.test',
    'smtpPass' => 'legacy-password',
    'api' => ['aiApiKey' => 'secret', 'enabled' => false],
    'seo' => ['indexnowKey' => 'secret'],
    'postsPerPage' => 13,
    'items' => [],
    'zero' => 0,
  ];
  voncms_write_settings_json_mirror($temp . '/settings.json', $settings);
  $mirror = json_decode(file_get_contents($temp . '/settings.json'), true);
  check(
    !isset($mirror['api']['aiApiKey']) && !isset($mirror['seo']['indexnowKey']),
    'Unused secrets survive mirror.',
  );
  check(
    $mirror['smtpPass'] === 'legacy-password' &&
      $mirror['api']['enabled'] === false &&
      $mirror['zero'] === 0 &&
      $mirror['items'] === [],
    'Mirror compatibility lost.',
  );
  if (PHP_OS_FAMILY !== 'Windows') {
    check((fileperms($temp . '/settings.json') & 0777) === 0600, 'Mirror permissions not private.');
  }

  require $root . '/public/api/mail_helper.php';
  $body = "<p>Bahasa Melayu, Unicode \u{2014} \u{1F600}</p>\r.\r\n" . str_repeat('x', 3000);
  $message = voncms_build_mail_message(
    "Tajuk \u{2014}\r\nBcc: blocked",
    $body,
    'sender@example.test',
    "Nama \u{2014}\r\nInjected",
    'reply@example.test',
  );
  check(
    base64_decode($message['body'], true) === preg_replace('/\r\n|\r|\n/', "\r\n", $body),
    'MIME body roundtrip failed.',
  );
  foreach (explode("\r\n", $message['body']) as $line) {
    check(strlen($line) <= 76 && $line !== '.', 'SMTP line/terminator unsafe.');
  }
  check(
    str_starts_with($message['subject'], '=?UTF-8?B?') &&
      !str_contains($message['subject'], "\r\nBcc:"),
    'Header serialization unsafe.',
  );
  $header = voncms_encode_mail_header(str_repeat("\u{1F600}", 100));
  foreach (explode("\r\n ", $header) as $word) {
    check(
      strlen($word) <= 75 && preg_match('//u', base64_decode(substr($word, 10, -2))),
      'Encoded-word split invalid.',
    );
  }
  check(
    rejected(
      fn() => voncms_build_mail_message(
        'title',
        'body',
        "sender@example.test\r\nBcc:x",
        'name',
        'reply@example.test',
      ),
    ),
    'Final fallback-derived header injection accepted.',
  );
  check(
    sendWithSmtp('recipient@example.test', 'title', 'body', '', ['encryption' => 'none'])[
      'success'
    ] === false,
    'Plaintext SMTP accepted.',
  );

  define('VONCMS_UPDATER_TESTING', true);
  define('IN_API', true);
  require $root . '/public/api/system/updater.php';
  class OfficialReleaseProbe extends SystemUpdater
  {
    public array $responses = [];
    protected function downloadRemoteBody($url, $accept = 'application/octet-stream')
    {
      return $this->responses[$url] ?? ['status' => 404, 'body' => ''];
    }
  }
  $updater = new OfficialReleaseProbe();
  $logProperty = new ReflectionProperty(SystemUpdater::class, 'logFile');
  $logProperty->setValue($updater, $temp . '/updater.log');
  $hashMethod = new ReflectionMethod(SystemUpdater::class, 'resolveExpectedHash');
  $digest = str_repeat('a', 64);
  foreach (['1.27.9', 'v1.27.9', 'v.1.27.9'] as $tag) {
    $url =
      'https://github.com/Vondereich/VonCMS/releases/download/' .
      $tag .
      '/VonCMS_v1.27.9_Deploy.zip';
    $api = 'https://api.github.com/repos/Vondereich/VonCMS/releases/tags/' . rawurlencode($tag);
    $asset = [
      'name' => basename($url),
      'browser_download_url' => $url,
      'digest' => 'sha256:' . $digest,
    ];
    $release = ['tag_name' => $tag, 'assets' => [$asset]];
    $updater->responses[$api] = ['status' => 200, 'body' => json_encode($release)];
    check(
      $hashMethod->invoke($updater, '1.27.9', $url, str_repeat('b', 64)) === $digest,
      'Forged client digest trusted / tag control failed.',
    );
    $release['assets'][0]['digest'] = null;
    $updater->responses[$api]['body'] = json_encode($release);
    check(
      rejected(fn() => $hashMethod->invoke($updater, '1.27.9', $url, $digest)),
      'Missing official digest accepted.',
    );
    $release['assets'][] = ['browser_download_url' => $url . '.sha256'];
    $updater->responses[$api]['body'] = json_encode($release);
    $updater->responses[$url . '.sha256'] = [
      'status' => 200,
      'body' => $digest . '  ' . basename($url),
    ];
    check(
      $hashMethod->invoke($updater, '1.27.9', $url) === $digest,
      'Official listed checksum fallback rejected.',
    );
  }
  foreach (
    [
      'https://github.com/evil/VonCMS/releases/download/v1.27.9/VonCMS_v1.27.9_Deploy.zip',
      'https://github.com/Vondereich/VonCMS/releases/download/v1.27.9/VonCMS_v1.27.9_Source.zip',
      'https://github.com/Vondereich/VonCMS/releases/download/v1.27.9/VonCMS_v1.27.9_Deploy.zip?x=1',
      'https://codeload.github.com/evil/repo/zip/main',
    ]
    as $url
  ) {
    check(
      rejected(fn() => $hashMethod->invoke($updater, '1.27.9', $url, $digest)),
      'Non-official deployment accepted.',
    );
  }

  $_SERVER['PHP_SELF'] = '/qa.php';
  require $root . '/public/api/ImageProcessor.php';
  $processor = new ImageProcessor(['convertToWebP' => true, 'generateResponsiveVariants' => false]);
  // Two GIF frames: byte identity proves animation survives, not just one decoded frame.
  $gif = base64_decode(
    'R0lGODlhAQABAIAAAP8AAAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAIfkEAAAAAAAsAAAAAAEAAQAAAgJEAQA7',
  );
  file_put_contents($temp . '/animated.gif', $gif);
  check(
    $processor->processUpload($temp . '/animated.gif')['success'] &&
      file_get_contents($temp . '/animated.gif') === $gif,
    'GIF animation changed.',
  );
  check(
    $processor->generateResponsiveVariants($temp . '/animated.gif', [1]) === [],
    'GIF variants flattened.',
  );
  $image = imagecreatetruecolor(30, 20);
  foreach (
    [
      [0, 0, 14, 9, 255, 0, 0],
      [15, 0, 29, 9, 0, 255, 0],
      [0, 10, 14, 19, 0, 0, 255],
      [15, 10, 29, 19, 255, 255, 0],
    ]
    as $rectangle
  ) {
    imagefilledrectangle(
      $image,
      $rectangle[0],
      $rectangle[1],
      $rectangle[2],
      $rectangle[3],
      imagecolorallocate($image, $rectangle[4], $rectangle[5], $rectangle[6]),
    );
  }
  imagejpeg($image, $temp . '/plain.jpg', 100);
  imagedestroy($image);
  $jpeg = file_get_contents($temp . '/plain.jpg');
  foreach (range(1, 8) as $orientation) {
    $tiff =
      'II' .
      pack('vVv', 42, 8, 1) .
      pack('vvVv', 0x0112, 3, 1, $orientation) .
      "\0\0" .
      pack('V', 0);
    $exif = "Exif\0\0" . $tiff;
    $path = $temp . '/orientation-' . $orientation . '.jpg';
    file_put_contents(
      $path,
      substr($jpeg, 0, 2) . "\xff\xe1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2),
    );
    $plainProcessor = new ImageProcessor(['generateResponsiveVariants' => false]);
    check($plainProcessor->processUpload($path)['success'], 'JPEG processing failed.');
    $size = getimagesize($path);
    check(
      $size[0] === ($orientation >= 5 ? 20 : 30) && $size[1] === ($orientation >= 5 ? 30 : 20),
      'JPEG orientation dimensions wrong.',
    );
    $expectedCorners = [
      1 => 'rgby',
      2 => 'gryb',
      3 => 'ybgr',
      4 => 'byrg',
      5 => 'rbgy',
      6 => 'bryg',
      7 => 'ygbr',
      8 => 'gyrb',
    ];
    $processed = imagecreatefromjpeg($path);
    $corners = '';
    foreach (
      [[3, 3], [$size[0] - 4, 3], [3, $size[1] - 4], [$size[0] - 4, $size[1] - 4]]
      as [$x, $y]
    ) {
      $rgb = imagecolorsforindex($processed, imagecolorat($processed, $x, $y));
      $corners .=
        $rgb['red'] > 170 && $rgb['green'] > 170
          ? 'y'
          : ($rgb['red'] > 170
            ? 'r'
            : ($rgb['green'] > 170
              ? 'g'
              : 'b'));
    }
    imagedestroy($processed);
    check(
      $corners === $expectedCorners[$orientation],
      'JPEG orientation pixels wrong: ' . $orientation,
    );
  }
  echo "PASS security hardening: $checks assertions\n";
} finally {
  cleanup($temp);
}
