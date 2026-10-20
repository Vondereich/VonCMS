<?php
// Disposable boundary probes; --mysql uses ONLY the dedicated localhost QA instance.
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
function declaration(string $file, string $needle): string
{
  $source = file_get_contents($file);
  $offset = strpos($source, $needle);
  if ($offset === false) {
    throw new RuntimeException('Missing declaration: ' . $needle);
  }
  $tokens = token_get_all('<?php ' . substr($source, $offset));
  $result = '';
  $depth = 0;
  $opened = false;
  foreach (array_slice($tokens, 1) as $token) {
    $result .= is_array($token) ? $token[1] : $token;
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
  throw new RuntimeException('Incomplete declaration');
}
function between(string $source, string $start, string $end): string
{
  $offset = strpos($source, $start);
  if ($offset === false) {
    throw new RuntimeException('Missing start: ' . $start);
  }
  $limit = strpos($source, $end, $offset + strlen($start));
  if ($limit === false) {
    throw new RuntimeException('Missing end: ' . $end);
  }
  return substr($source, $offset, $limit - $offset);
}
class ResponseHelper
{
  public static function sendError(mixed $error, int $status = 500): never
  {
    throw new RuntimeException(
      $error instanceof Throwable ? $error->getMessage() : (string) $error,
      $status,
    );
  }
  public static function scrubAvatarUrl($value): string
  {
    return '';
  }
}
class SessionManager
{
  public static function isStaff(): bool
  {
    return false;
  }
}
function rejects(callable $test, int $status): void
{
  try {
    $test();
  } catch (RuntimeException $error) {
    check($error->getCode() === $status, 'Wrong rejection: ' . $error->getMessage());
    return;
  }
  throw new RuntimeException('Expected rejection ' . $status);
}
require $root . '/public/seo_schema_helper.php';
eval(declaration($root . '/public/security.php', 'class SecurityHelper'));
eval(
  str_replace(
    'class ResponseHelper',
    'class ActualResponseHelper',
    declaration($root . '/public/core/ResponseHelper.php', 'class ResponseHelper'),
  )
);
$commentPayloadMethod = new ReflectionMethod('ActualResponseHelper', 'shapeCommentPayload');
$shapeCommentPayload = $commentPayloadMethod->getClosure();
if ($shapeCommentPayload === null) {
  throw new RuntimeException('Actual comment payload helper is unavailable');
}
eval(
  declaration(
    $root . '/public/api/save_user.php',
    'function voncms_validate_managed_user_identity(',
  )
);

$body =
  '<p>Syarat kelayakan: jika x&lt;y maka keputusan adalah benar dan ayat seterusnya cukup panjang untuk ringkasan.</p>';
$expected =
  'Syarat kelayakan: jika x<y maka keputusan adalah benar dan ayat seterusnya cukup panjang untuk ringkasan.';
foreach (['save_post.php', 'save_page.php'] as $file) {
  $input = ['excerpt' => ''];
  $excerpt = '';
  $rawContent = $body;
  $source = file_get_contents($root . '/public/api/' . $file);
  eval(
    between(
      $source,
      '// Auto-generate excerpt from content if not provided',
      $file === 'save_post.php' ? '$db = null;' : 'try {',
    )
  );
  $text = $file === 'save_post.php' ? $excerpt : $input['excerpt'];
  check($text === $expected, 'Automatic excerpt changed');
  check(
    voncms_clean_seo_description(voncms_pick_seo_description(['excerpt' => $text])) === $expected,
    'Meta lost comparison',
  );
  check(
    voncms_pick_listing_schema_description(['excerpt' => $text]) === $expected,
    'Listing lost comparison',
  );
  check(voncms_extract_plaintext_for_noscript($text) === $expected, 'Noscript lost comparison');
}
check(
  voncms_clean_seo_description('<script>hidden</script><p>Visible &amp; safe.</p>') ===
    'Visible & safe.',
  'Hidden markup regression',
);
check(voncms_clean_seo_description('x<y and a<b') === 'x<y and a<b', 'Multiple comparisons lost');
check(voncms_clean_seo_description('x<y and y>z') === 'x<y and y>z', 'Closing comparison lost');
check(
  voncms_clean_seo_description('<p class="example">Visible</p><video controls>Video</video>') ===
    'Visible Video',
  'Ordinary attribute markup lost block text spacing',
);

foreach ([str_repeat('a', 69) . 'A1!', str_repeat('界', 23) . 'A1!'] as $password) {
  SecurityHelper::requireNewPasswordLength($password);
  check(strlen($password) === 72, 'Boundary password fixture');
  rejects(fn() => SecurityHelper::requireNewPasswordLength($password . 'x'), 400);
}
rejects(fn() => SecurityHelper::requireNewPasswordLength("Valid1!\0bad"), 400);
foreach (
  [
    'register.php' => '$password',
    'reset_password.php' => '$newPassword',
    'update_profile.php' => '$newPasswordValue',
    'install.php' => '$adminPass',
    'save_user.php' => "$" . "input['password']",
  ]
  as $file => $value
) {
  check(
    str_contains(
      file_get_contents($root . '/public/api/' . $file),
      'SecurityHelper::requireNewPasswordLength(' . $value . ')',
    ),
    'Unprotected credential writer: ' . $file,
  );
  check(
    str_contains(file_get_contents($root . '/public/api/' . $file), 'PASSWORD_BCRYPT') &&
      !str_contains(file_get_contents($root . '/public/api/' . $file), 'PASSWORD_DEFAULT'),
    'Credential writer algorithm disagrees with the shared 72-byte policy: ' . $file,
  );
}
check(
  str_contains(file_get_contents($root . '/public/api/login.php'), 'strlen($password) > 4096'),
  'Legacy login compatibility changed',
);
voncms_validate_managed_user_identity(['username' => 'valid_qa', 'email' => 'qa@example.invalid']);
rejects(
  fn() => voncms_validate_managed_user_identity([
    'username' => 'bad space',
    'email' => 'qa@example.invalid',
  ]),
  400,
);
rejects(
  fn() => voncms_validate_managed_user_identity([
    'username' => 'valid_qa',
    'email' => 'not-an-email',
  ]),
  400,
);
$legacy = ['username' => 'legacy.name', 'email' => 'legacy-value'];
voncms_validate_managed_user_identity($legacy, $legacy);
check(true, 'Unchanged legacy identity remains editable');
foreach ([[false, false], [true, false], [true, true]] as [$staff, $primary]) {
  $text = $shapeCommentPayload(
    [
      'username' => 'Tom &amp; Jerry&#039;s',
      'content' => '&lt;img src=x onerror=alert(1)&gt; &amp;amp;',
    ],
    $staff,
    $primary,
  );
  check($text['username'] === "Tom & Jerry's", 'Username entities still visible');
  check(
    $text['content'] === '<img src=x onerror=alert(1)> &amp;',
    'Must decode exactly one layer for text rendering',
  );
}

check(
  voncms_clean_seo_description('<!-- hidden --><p>Visible</p>') === 'Visible',
  'HTML comment leaked into description',
);
$uploadSource = file_get_contents($root . '/public/api/upload_file.php');
if (!function_exists('voncms_get_responsive_widths')) {
  function voncms_get_responsive_widths($width): array
  {
    return [];
  }
}
$mediaSettings = [];
eval(between($uploadSource, '  $mediaSettings = [', '  // CDN URL'));
check(
  isset($mediaSettings['enabled']) && is_bool($mediaSettings['enabled']),
  'Missing upload defaults',
);
$defaultEnabled = $mediaSettings['enabled'];
$enabledAssignment = between(
  $uploadSource,
  "      \$mediaSettings['enabled'] =",
  "      \$mediaSettings['maxWidth']",
);
foreach (
  [[null, true], [[], true], [['enabled' => false], false], [['enabled' => true], true]]
  as [$opt, $expectedEnabled]
) {
  $mediaSettings = ['enabled' => $defaultEnabled];
  if ($opt !== null) {
    eval($enabledAssignment);
  }
  check(
    $mediaSettings['enabled'] === $expectedEnabled,
    'Optimization fallback changed explicit ON/OFF',
  );
}

$mysql = in_array('--mysql', $argv, true);
if ($mysql) {
  $pdo = new PDO('mysql:host=127.0.0.1;port=33079;charset=utf8mb4', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  $pdo->exec('CREATE DATABASE IF NOT EXISTS voncms_patch_fixture');
  $pdo->exec('USE voncms_patch_fixture');
  check(
    $pdo->query('SELECT DATABASE()')->fetchColumn() === 'voncms_patch_fixture',
    'QA schema boundary',
  );
  $pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES'");
} else {
  require_once __DIR__ . '/sqlite-compat.php';
  $pdo = new VonCmsFixtureSqlitePDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
  $pdo->createFunction('NOW', fn() => date('Y-m-d H:i:s'));
}
$pdo->exec('CREATE TABLE IF NOT EXISTS settings(setting_key VARCHAR(100), setting_value TEXT)');
$pdo->exec(
  'CREATE TABLE IF NOT EXISTS posts(id INT PRIMARY KEY, status VARCHAR(20), scheduled_at DATETIME NULL)',
);
$pdo->exec('DELETE FROM posts');
$pdo->exec("INSERT INTO posts VALUES(1,'published',NULL)");
$idColumn = $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$pdo->exec(
  "CREATE TABLE IF NOT EXISTS comments(id $idColumn, post_id INT, user_id INT, parent_id INT, user_name VARCHAR(100) CHECK (length(user_name)<=100), user_avatar TEXT, content TEXT, likes INT, status VARCHAR(20), created_at DATETIME)",
);
$pdo->exec(
  'CREATE TABLE IF NOT EXISTS security_logs(event_type VARCHAR(50),ip_address VARCHAR(45),user_agent TEXT,endpoint TEXT,severity VARCHAR(20),details TEXT,blocked INT)',
);
$commentSource = str_replace(
  "\r\n",
  "\n",
  file_get_contents($root . '/public/api/save_comments.php'),
);
$add = between($commentSource, '    $postIdRaw =', '    echo json_encode([');
$add = str_replace('__DIR__', var_export($root . '/public/api', true), $add);
foreach (
  [
    ['ordinary', ['content' => "Tom & Jerry's comment"], null, 'approved'],
    ['short', ['content' => '<<<<<'], 400, null],
    ['escaped-name', ['username' => str_repeat("'", 100)], 400, null],
    [
      'honeypot-keyword',
      ['content' => 'this casino needs review', 'hp_field' => 'bot'],
      null,
      'spam',
    ],
    [
      'links-caps',
      ['content' => 'ALL UPPERCASE TEXT WWW.A WWW.B WWW.C WWW.D WWW.E WWW.F'],
      null,
      'spam',
    ],
    ['keyword', ['content' => 'this casino needs review'], null, 'pending'],
    ['hidden-parent', ['parentId' => 'r-9'], 404, null],
    ['approved-parent', ['parentId' => 'r-10'], null, 'approved'],
    ['other-post-parent', ['parentId' => 'r-11'], 400, null],
  ]
  as [$label, $values, $statusCode, $expectedStatus]
) {
  $pdo->exec('DELETE FROM comments');
  $pdo->exec(
    "INSERT INTO comments(id,post_id,user_name,content,status) VALUES(9,1,'QA','Hidden','pending'),(10,1,'QA','Visible','approved'),(11,2,'QA','Other post','approved')",
  );
  $input = $values + ['postId' => '1', 'username' => 'QA', 'content' => 'Ordinary comment text'];
  $hasValidSession = false;
  if ($statusCode) {
    rejects(function () use ($add, $input, $pdo, $hasValidSession) {
      eval($add);
    }, $statusCode);
  } else {
    eval($add);
    $row = $pdo->query('SELECT * FROM comments ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    check($row['status'] === $expectedStatus, 'Moderation priority: ' . $label);
    $visible = $shapeCommentPayload(['content' => $row['content']], false, false);
    check($visible['content'] === $input['content'], 'Comment text round trip: ' . $label);
  }
}
$pdo->exec('DELETE FROM comments');
$input = [
  'comments' => [
    ['postId' => '1', 'username' => 'First', 'content' => 'Valid first row'],
    ['postId' => '1', 'username' => str_repeat('x', 101), 'content' => 'Invalid second row'],
  ],
];
$action = null;
$hasValidSession = false;
$outer = substr($commentSource, strpos($commentSource, "try {\n  // Handle single comment add"));
rejects(function () use ($outer, $input, $pdo, $action, $hasValidSession) {
  eval($outer);
}, 500);
check(
  (int) $pdo->query('SELECT COUNT(*) FROM comments')->fetchColumn() === 0,
  'Bulk migration partially committed',
);

if ($mysql) {
  // This schema exists only on the dedicated QA port created for this test.
  $pdo->exec('DROP TABLE IF EXISTS users');
  $pdo->exec(
    'CREATE TABLE users(id INT PRIMARY KEY, username VARCHAR(50) UNIQUE, display_name VARCHAR(100), email VARCHAR(100) UNIQUE, role VARCHAR(20), avatar TEXT, bio TEXT, email_verified INT, verification_token VARCHAR(64), verification_token_expires DATETIME, reset_token VARCHAR(64), reset_token_expires DATETIME)',
  );
  $pdo->exec(
    "INSERT INTO users(id,username,email,role,email_verified) VALUES(1,'owner','owner@example.invalid','Root',1),(2,'qa_member','old@example.invalid','Member',1),(3,'other_qa','duplicate@example.invalid','Member',1)",
  );
  $managedUpdate = between(
    file_get_contents($root . '/public/api/save_user.php'),
    '    // Update existing user',
    '    // The target row is already locked',
  );
  $projection = [];
  preg_match(
    '/email_verified, (.+?) AS has_pending_verification/',
    file_get_contents($root . '/public/api/get_users.php'),
    $projection,
  );
  check(isset($projection[1]), 'Pending verification projection missing');
  $inputId = '2';
  $displayName = '';
  $requestedRole = 'member';
  $preservingExistingRoot = false;
  $isPrimaryAdminActor = true;
  $allowedNonPrimaryRoles = ['member', 'writer', 'moderator'];
  $assignableRoles = ['member' => 'Member'];
  $approveEmail = false;
  $hasNewPassword = false;
  foreach (
    [
      ['old@example.invalid', false, 1],
      ['new@example.invalid', false, 0],
      ['approved@example.invalid', true, 1],
    ]
    as [$email, $approveEmail, $verified]
  ) {
    $pdo->exec(
      "UPDATE users SET email='old@example.invalid', email_verified=1, verification_token='old-link', reset_token='old-reset' WHERE id=2",
    );
    $targetUser = $pdo->query('SELECT * FROM users WHERE id=2')->fetch(PDO::FETCH_ASSOC);
    $input = [
      'username' => 'qa_member',
      'email' => $email,
      'bio' => 'Changed bio',
      'password' => '',
    ];
    $pdo->beginTransaction();
    eval($managedUpdate);
    $pdo->commit();
    $row = $pdo->query('SELECT * FROM users WHERE id=2')->fetch(PDO::FETCH_ASSOC);
    check((int) $row['email_verified'] === $verified, 'Email verification state transition');
    check(
      (bool) $pdo->query('SELECT ' . $projection[1] . ' FROM users WHERE id=2')->fetchColumn() ===
        ($verified === 0 || $email === 'old@example.invalid'),
      'Owner approval visibility',
    );
    if ($email !== 'old@example.invalid') {
      check(
        $row['reset_token'] === null && $row['verification_token'] === null,
        'Stale account-action tokens survived email change',
      );
    }
  }
  $input['email'] = 'duplicate@example.invalid';
  $pdo->beginTransaction();
  rejects(function () use (
    $managedUpdate,
    $input,
    $inputId,
    $targetUser,
    $displayName,
    $requestedRole,
    $preservingExistingRoot,
    $isPrimaryAdminActor,
    $allowedNonPrimaryRoles,
    $assignableRoles,
    $approveEmail,
    $hasNewPassword,
    $pdo,
  ) {
    eval($managedUpdate);
  }, 400);
  check(!$pdo->inTransaction(), 'Duplicate update failed to roll back');
  $pdo->exec(
    'CREATE TABLE IF NOT EXISTS remember_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,selector VARCHAR(24),token_hash VARCHAR(64),expires_at DATETIME,last_used_at DATETIME NULL)',
  );
  $user = ['id' => 1];
  foreach (
    [['UTC', '+00:00'], ['Asia/Kuala_Lumpur', '+00:00'], ['UTC', '+08:00']]
    as [$phpZone, $sqlZone]
  ) {
    date_default_timezone_set($phpZone);
    $pdo->exec("SET SESSION time_zone = '$sqlZone'");
    eval(
      between(
        file_get_contents($root . '/public/api/reset_password.php'),
        '    $token = bin2hex(random_bytes(32));',
        '    $resetUrl =',
      )
    );
    $remaining = (int) $pdo
      ->query('SELECT TIMESTAMPDIFF(SECOND,NOW(),reset_token_expires) FROM users WHERE id=1')
      ->fetchColumn();
    check(abs($remaining - 3600) < 3, 'Reset expiry depends on PHP timezone');
    $pdo->exec('DELETE FROM remember_tokens');
    $rememberTokenHash = '';
    eval(
      between(
        file_get_contents($root . '/public/api/login.php'),
        '        $rememberSelector = bin2hex(random_bytes(12));',
        '        setcookie(',
      )
    );
    check(preg_match('/^[a-f0-9]{64}$/', $rememberTokenHash) === 1, 'Missing remember token hash');
    $remaining = (int) $pdo
      ->query('SELECT TIMESTAMPDIFF(SECOND,NOW(),expires_at) FROM remember_tokens')
      ->fetchColumn();
    check(abs($remaining - 2592000) < 3, 'Remember creation expiry mismatch');
    $rememberUser = [
      'remember_token_id' => $pdo->lastInsertId(),
      'token_hash' => $rememberTokenHash,
    ];
    eval(
      between(
        file_get_contents($root . '/public/api/check_auth.php'),
        '          $nextValidator = bin2hex(random_bytes(32));',
        '          if ($rotateStmt->rowCount()',
      )
    );
    $remaining = (int) $pdo
      ->query('SELECT TIMESTAMPDIFF(SECOND,NOW(),expires_at) FROM remember_tokens')
      ->fetchColumn();
    check(abs($remaining - 2592000) < 3, 'Remember rotation expiry mismatch');
  }
}
echo 'PASS Maintenance Boundaries: ' .
  $checks .
  ' checks (' .
  ($mysql ? 'MySQL 8 runtime' : 'SQLite fixture; MySQL expiry excluded') .
  ").\n";
