<?php
// Actual limiter and process races with disposable files only. No site, DB or mail.
$root = dirname(__DIR__, 2);
define('VONCMS_CORE_LOADED', true);
require_once $root . '/public/core/RateLimiter.php';

if (($argv[1] ?? '') === '--worker') {
  $directory = $argv[2];
  $worker = $argv[3];
  (new ReflectionProperty(RateLimiter::class, 'storageDir'))->setValue(null, $directory . '/');
  file_put_contents($directory . '/ready-' . $worker, 'ready');
  $deadline = microtime(true) + 15;
  while (!is_file($directory . '/go')) {
    if (microtime(true) > $deadline) {
      throw new RuntimeException('Submission worker barrier timed out.');
    }
    usleep(10000);
    clearstatcache();
  }
  echo RateLimiter::consumeAttempt($argv[4]) ? 'admitted' : 'denied';
  exit();
}

$checks = 0;
function submissionCheck(bool $condition, string $message): void
{
  global $checks;
  if (!$condition) {
    throw new RuntimeException($message);
  }
  $checks++;
}
function submissionCleanup(string $directory): void
{
  foreach (array_diff(scandir($directory) ?: [], ['.', '..']) as $name) {
    $path = $directory . '/' . $name;
    if (is_dir($path) && !is_link($path)) {
      submissionCleanup($path);
    } else {
      unlink($path);
    }
  }
  rmdir($directory);
}
/** @param list<string> $identifiers */
function submissionRace(string $directory, array $identifiers): array
{
  $workers = [];
  $admitted = 0;
  $denied = 0;
  try {
    foreach ($identifiers as $index => $identifier) {
      $pipes = [];
      $process = proc_open(
        [PHP_BINARY, __FILE__, '--worker', $directory, (string) $index, $identifier],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
      );
      submissionCheck(is_resource($process), 'Cannot start submission worker.');
      fclose($pipes[0]);
      $workers[] = [$process, $pipes];
    }
    $deadline = microtime(true) + 15;
    while (count(glob($directory . '/ready-*') ?: []) !== count($workers)) {
      if (microtime(true) > $deadline) {
        throw new RuntimeException('Submission race did not reach its barrier.');
      }
      usleep(10000);
      clearstatcache();
    }
    file_put_contents($directory . '/go', 'go');
    foreach ($workers as [$process, $pipes]) {
      $result = stream_get_contents($pipes[1]);
      $errors = stream_get_contents($pipes[2]);
      submissionCheck($errors === '', 'Submission worker emitted diagnostics: ' . $errors);
      submissionCheck(in_array($result, ['admitted', 'denied'], true), 'Invalid worker result.');
      $admitted += (int) ($result === 'admitted');
      $denied += (int) ($result === 'denied');
    }
    return [$admitted, $denied];
  } finally {
    file_put_contents($directory . '/go', 'go');
    foreach ($workers as [$process, $pipes]) {
      fclose($pipes[1]);
      fclose($pipes[2]);
      if (proc_get_status($process)['running']) {
        proc_terminate($process);
      }
      proc_close($process);
    }
  }
}

$temporaryRoot = realpath(getenv('VONCMS_QA_TEMP_ROOT') ?: sys_get_temp_dir());
if (!is_string($temporaryRoot)) {
  throw new RuntimeException('QA temporary root is unavailable.');
}
$temporary = $temporaryRoot . '/voncms-submission-quotas-' . bin2hex(random_bytes(6));
mkdir($temporary);
$storage = new ReflectionProperty(RateLimiter::class, 'storageDir');
$oldErrorLog = ini_get('error_log');
ini_set('error_log', $temporary . '/expected-storage-errors.log');
$fixture = static function (string $name) use ($temporary, $storage): string {
  $directory = $temporary . '/' . $name;
  mkdir($directory);
  $storage->setValue(null, $directory . '/');
  return $directory;
};
$legacy = static fn(string $directory, string $identifier): string => $directory .
  '/' .
  md5($identifier) .
  '.json';
$ledger = static fn(string $directory, string $purpose): string => $directory .
  '/' .
  md5('submission-' . $purpose . '-ledger:v1') .
  '.json';

try {
  foreach (
    ['contact:' => 'contact', 'comment:ip:' => 'comment', 'newsletter:' => 'newsletter']
    as $prefix => $purpose
  ) {
    $directory = $fixture($purpose);
    for ($i = 1; $i <= 32; $i++) {
      submissionCheck(
        RateLimiter::consumeAttempt($prefix . '2001:db8:11:22::' . dechex($i)) === $i <= 5,
        $purpose . ': IPv6 /64 rotation bypassed the five-attempt budget.',
      );
    }
    submissionCheck(count(glob($directory . '/*.json') ?: []) === 1, 'Per-address files grew.');
    submissionCheck(filesize($ledger($directory, $purpose)) <= 1048576, 'Ledger exceeded 1 MiB.');
    submissionCheck(
      !RateLimiter::consumeAttempt($prefix . '2001:0db8:0011:0022:FFFF::1'),
      'Expanded IPv6 alias bypassed the public budget.',
    );
    for ($i = 1; $i <= 4; $i++) {
      submissionCheck(
        RateLimiter::consumeAttempt($prefix . '203.0.113.8'),
        'IPv4 control was incorrectly grouped with IPv6.',
      );
    }
    submissionCheck(
      RateLimiter::consumeAttempt($prefix . '::ffff:203.0.113.8'),
      'Mapped fifth attempt failed.',
    );
    submissionCheck(
      !RateLimiter::consumeAttempt($prefix . '203.0.113.8'),
      'Mapped IPv4 bypassed quota.',
    );
    for ($i = 1; $i <= 16; $i++) {
      submissionCheck(
        RateLimiter::consumeAttempt($prefix . '2001:db8:12:' . dechex($i) . '::1'),
        'A distinct network was denied before capacity.',
      );
    }
    submissionCheck(
      count(glob($directory . '/*.json') ?: []) === 1,
      'Many networks created files.',
    );
  }

  $directory = $fixture('isolation');
  foreach (['contact:', 'newsletter:', 'comment:ip:', 'comment:user:'] as $prefix) {
    $identity = $prefix === 'comment:user:' ? '7' : '198.51.100.20';
    for ($i = 0; $i < 6; $i++) {
      submissionCheck(
        RateLimiter::consumeAttempt($prefix . $identity) === $i < 5,
        'Submission purposes or user/IP identities share the wrong budget.',
      );
    }
  }
  submissionCheck(
    RateLimiter::consumeAttempt('comment:user:8'),
    'Another account lost its budget.',
  );
  submissionCheck(
    count(glob($directory . '/*.json') ?: []) === 3,
    'Purpose files are not bounded.',
  );

  $directory = $fixture('capacity');
  $identifier = 'contact:198.51.100.31';
  $currentKey = hash('sha256', 'contact:' . RateLimiter::normalizeLoginAddress('198.51.100.31'));
  $buckets = [];
  for ($i = 0; $i < 4096; $i++) {
    $key = $i === 0 ? $currentKey : hash('sha256', 'capacity:' . $i);
    $buckets[$key] = ['attempts' => 1, 'window_started_at' => time(), 'window_seconds' => 900];
  }
  $file = $ledger($directory, 'contact');
  file_put_contents($file, json_encode($buckets));
  submissionCheck(
    !RateLimiter::consumeAttempt('contact:198.51.100.32'),
    'Full ledger admitted a new key.',
  );
  submissionCheck(
    RateLimiter::consumeAttempt($identifier),
    'Capacity denied an existing key with allowance.',
  );
  submissionCheck(
    count(json_decode(file_get_contents($file), true)) === 4096,
    'Key cap was exceeded.',
  );
  foreach ($buckets as &$bucket) {
    $bucket['window_started_at'] = time() - 901;
  }
  unset($bucket);
  file_put_contents($file, json_encode($buckets));
  submissionCheck(
    RateLimiter::consumeAttempt('contact:198.51.100.32'),
    'Expired keys were not reclaimed.',
  );
  submissionCheck(
    count(json_decode(file_get_contents($file), true)) === 1,
    'Expired ledger retained keys.',
  );
  foreach (['{invalid', str_repeat('x', 1048577)] as $corrupt) {
    file_put_contents($file, $corrupt);
    submissionCheck(
      !RateLimiter::consumeAttempt($identifier),
      'Corrupt/oversized ledger failed open.',
    );
    submissionCheck(file_get_contents($file) === $corrupt, 'Invalid state was silently reset.');
  }

  $directory = $fixture('legacy');
  $identifier = 'contact:198.51.100.41';
  $file = $legacy($directory, $identifier);
  $state = ['attempts' => 5, 'lockout_until' => time() + 7200, 'penalty_level' => 2];
  file_put_contents($file, json_encode($state));
  $locked = file_get_contents($file);
  submissionCheck(!RateLimiter::consumeAttempt($identifier), 'Active legacy lockout was reset.');
  submissionCheck(file_get_contents($file) === $locked, 'Denied migration rewrote the lockout.');
  submissionCheck(
    count(glob($directory . '/*.json') ?: []) === 1,
    'Legacy denial allocated state.',
  );
  $state = ['attempts' => 4, 'lockout_until' => 0, 'penalty_level' => 0];
  file_put_contents($file, json_encode($state));
  submissionCheck(
    RateLimiter::consumeAttempt($identifier),
    'Last active legacy allowance was lost.',
  );
  $state = json_decode(file_get_contents($file), true);
  submissionCheck(
    $state['attempts'] === 5 && $state['lockout_until'] > time(),
    'Legacy reservation was not retained.',
  );
  submissionCheck(
    !RateLimiter::consumeAttempt($identifier),
    'Legacy final allowance was duplicated.',
  );
  $state['lockout_until'] = time() - 1;
  file_put_contents($file, json_encode($state));
  $loginFile = $legacy($directory, 'login:ip:untouched');
  file_put_contents($loginFile, $locked);
  submissionCheck(
    RateLimiter::consumeAttempt($identifier),
    'Expired public legacy quota blocked recovery.',
  );
  clearstatcache();
  submissionCheck(!is_file($file), 'Known expired public quota was not retired.');
  submissionCheck(
    file_get_contents($loginFile) === $locked,
    'Public retirement touched login quota.',
  );
  submissionCheck(
    RateLimiter::consumeFixedWindow('recovery-control', 1, 900),
    'Recovery isolation failed.',
  );
  submissionCheck(
    !RateLimiter::consumeFixedWindow('recovery-control', 1, 900),
    'Recovery limit changed.',
  );
  file_put_contents($file, '{invalid');
  submissionCheck(
    !RateLimiter::consumeAttempt($identifier),
    'Malformed active legacy quota failed open.',
  );
  submissionCheck(file_get_contents($file) === '{invalid', 'Unknown legacy quota was overwritten.');

  $directory = $fixture('legacy-path-failure');
  mkdir($legacy($directory, 'newsletter:198.51.100.50'));
  submissionCheck(
    !RateLimiter::consumeAttempt('newsletter:198.51.100.50'),
    'Invalid legacy path failed open.',
  );
  $blocked = $temporary . '/not-a-directory';
  file_put_contents($blocked, 'owned fixture');
  $storage->setValue(null, $blocked . '/');
  submissionCheck(
    !RateLimiter::consumeAttempt('contact:198.51.100.51'),
    'Unavailable storage admitted contact.',
  );
  submissionCheck(
    !RateLimiter::consumeAttempt('comment:user:9'),
    'Unavailable storage admitted a comment.',
  );
  submissionCheck(
    RateLimiter::consumeAttempt('login:ip:unchanged-failure-policy'),
    'Login storage policy changed.',
  );

  $directory = $fixture('ipv6-race');
  $identifiers = [];
  for ($i = 1; $i <= 8; $i++) {
    $identifiers[] = 'comment:ip:2001:db8:99:1::' . dechex($i);
  }
  submissionCheck(
    submissionRace($directory, $identifiers) === [5, 3],
    'Concurrent /64 requests exceeded quota.',
  );
  submissionCheck(
    count(glob($directory . '/*.json') ?: []) === 1,
    'Concurrent /64 requests created address files.',
  );
  $directory = $fixture('legacy-race');
  $identifier = 'newsletter:198.51.100.61';
  file_put_contents(
    $legacy($directory, $identifier),
    json_encode(['attempts' => 4, 'lockout_until' => 0, 'penalty_level' => 0]),
  );
  submissionCheck(
    submissionRace($directory, array_fill(0, 4, $identifier)) === [1, 3],
    'Concurrent legacy last allowance was duplicated.',
  );

  echo 'PASS Public submission quotas: ' .
    $checks .
    " checks; real limiter, IPv6 identity, bounded ledgers, legacy preservation and process races.\n";
} catch (Throwable $error) {
  fwrite(STDERR, 'FAIL Public submission quotas: ' . $error->getMessage() . "\n");
  $failed = true;
} finally {
  ini_set('error_log', is_string($oldErrorLog) ? $oldErrorLog : '');
  $resolved = realpath($temporary);
  if (
    !is_string($resolved) ||
    realpath(dirname($resolved)) !== $temporaryRoot ||
    !str_starts_with(basename($resolved), 'voncms-submission-quotas-')
  ) {
    throw new RuntimeException('Refusing unsafe QA cleanup.');
  }
  submissionCleanup($resolved);
}
if ($failed ?? false) {
  exit(1);
}
