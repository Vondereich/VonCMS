<?php
declare(strict_types=1);

// CLI-only, in-memory fixtures. Never load a configured site's database.
if (PHP_SAPI !== 'cli') {
  http_response_code(403);
  exit('Forbidden');
}
$root = dirname(__DIR__, 2);
if (file_exists($root . '/public/von_config.php')) {
  throw new RuntimeException('Page-read fixtures require an unconfigured source checkout.');
}
ini_set('session.save_path', sys_get_temp_dir());
$_SERVER['PHP_SELF'] = 'get_pages.php';
$_SERVER['SCRIPT_NAME'] = '/api/get_pages.php';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['HTTP_USER_AGENT'] = 'voncms-page-read-fixture';
$_GET = json_decode($argv[1] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
$role = $argv[2] ?? 'guest';
require_once $root . '/public/security.php';
if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
  echo 'skip';
  exit(0);
}
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, role TEXT, password TEXT)');
$pdo->exec(
  'CREATE TABLE pages (id INTEGER PRIMARY KEY, title TEXT, slug TEXT, content TEXT, excerpt TEXT, status TEXT, keywords TEXT, meta_description TEXT, author_id INTEGER, created_at TEXT, updated_at TEXT)',
);
$passwordHash = password_hash('Disposable-QA-Only1!', PASSWORD_BCRYPT, ['cost' => 4]);
$pdo
  ->prepare('INSERT INTO users VALUES (7, ?, ?, ?)')
  ->execute(['page-read-qa', $role === 'guest' ? 'member' : $role, $passwordHash]);
$insert = $pdo->prepare('INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?, ?, ?, 7, ?, ?)');
for ($id = 1; $id <= 224; $id++) {
  $slug = match ($id) {
    221 => '00123',
    222 => '123',
    default => 'page-' . $id,
  };
  $insert->execute([
    $id,
    'Page ' . $id,
    $slug,
    str_repeat('Complete page body 😀. ', 40),
    'Page excerpt 中文 😀',
    $id > 222 ? 'draft' : 'published',
    'page,qa',
    'Explicit page meta description.',
    '2026-10-16 00:00:00',
    '2026-10-16 00:00:00',
  ]);
}
if ($role !== 'guest') {
  SessionManager::establishAuthenticatedSession(
    [
      'id' => 7,
      'username' => 'page-read-qa',
      'role' => $role,
    ],
    $passwordHash,
  );
}
register_shutdown_function(static function (): void {
  if (session_id() !== '' && session_status() !== PHP_SESSION_ACTIVE) {
    @session_start();
  }
  if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION = [];
    session_destroy();
  }
});
require $root . '/public/api/get_pages.php';
