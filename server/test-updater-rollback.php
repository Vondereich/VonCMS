<?php

define('VONCMS_UPDATER_TESTING', true);
define('IN_API', true);

require_once __DIR__ . '/../public/api/system/updater.php';

function updaterRollbackAssert(bool $condition, string $message): void
{
  if (!$condition) {
    throw new RuntimeException($message);
  }
}

function updaterRollbackRemove(string $path): void
{
  if (is_file($path) || is_link($path)) {
    @unlink($path);
    return;
  }
  if (!is_dir($path)) {
    return;
  }

  foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $item) {
    updaterRollbackRemove($path . DIRECTORY_SEPARATOR . $item);
  }
  @rmdir($path);
}

function updaterRollbackWrite(string $path, string $contents): void
{
  $directory = dirname($path);
  if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
    throw new RuntimeException('Could not prepare rollback test fixture.');
  }
  if (file_put_contents($path, $contents) !== strlen($contents)) {
    throw new RuntimeException('Could not write rollback test fixture.');
  }
}

$basePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'voncms-updater-' . bin2hex(random_bytes(6));

try {
  // Even an explicitly false test flag must not enable fault configuration.
  $guardProbe =
    "define('VONCMS_UPDATER_TESTING', false); define('IN_API', true); require " .
    var_export(__DIR__ . '/../public/api/system/updater.php', true) .
    "; try { (new SystemUpdater())->configureTestFailures(afterActivations: 1); exit(1); } catch (LogicException) { echo 'blocked'; }";
  $guardProcess = proc_open(
    [PHP_BINARY, '-r', $guardProbe],
    [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
    $guardPipes,
  );
  $guardOutput = stream_get_contents($guardPipes[1]);
  $guardError = stream_get_contents($guardPipes[2]);
  fclose($guardPipes[1]);
  fclose($guardPipes[2]);
  updaterRollbackAssert(
    proc_close($guardProcess) === 0 && $guardOutput === 'blocked' && $guardError === '',
    'Fault injection was configurable without the explicit true test flag.',
  );

  $livePath = $basePath . '/live';
  $tempPath = $livePath . '/temp_update';
  $sourcePath = $tempPath . '/extracted/VonCMS';

  updaterRollbackWrite($livePath . '/api/runtime.txt', 'old-api');
  updaterRollbackWrite($livePath . '/assets/runtime.txt', 'old-assets');
  updaterRollbackWrite($livePath . '/assets/index-retired.js', 'retired-asset');
  updaterRollbackWrite($livePath . '/docs/runtime.txt', 'old-docs');
  updaterRollbackWrite($livePath . '/docs/retired-guide.md', 'retired-doc');
  updaterRollbackWrite($livePath . '/data/runtime.txt', 'live-data');
  $schemaReadCache = $livePath . '/data/schema-capabilities.json.display-name-cache';
  updaterRollbackWrite($schemaReadCache, 'stale-schema-read-cache');
  updaterRollbackWrite($livePath . '/index.html', 'old-index');

  updaterRollbackWrite($sourcePath . '/api/runtime.txt', 'new-api');
  updaterRollbackWrite($sourcePath . '/assets/runtime.txt', 'new-assets');
  updaterRollbackWrite($sourcePath . '/assets/index-current.js', 'current-asset');
  updaterRollbackWrite($sourcePath . '/docs/runtime.txt', 'new-docs');
  updaterRollbackWrite($sourcePath . '/docs/current-guide.md', 'current-doc');
  updaterRollbackWrite($sourcePath . '/data/runtime.txt', 'package-data');
  updaterRollbackWrite($sourcePath . '/index.html', 'new-index');
  updaterRollbackWrite($sourcePath . '/metadata.json', '{"version":"9.9.9"}');

  $updater = new SystemUpdater();
  $reflection = new ReflectionObject($updater);
  foreach (
    [
      'rootPath' => $livePath,
      'tempPath' => $tempPath,
      'backupPath' => $livePath . '/backups',
      'logFile' => $basePath . '/updater.log',
    ]
    as $propertyName => $value
  ) {
    $property = $reflection->getProperty($propertyName);
    $property->setValue($updater, $value);
  }

  $updater->configureTestFailures(afterActivations: 3);
  $swap = $reflection->getMethod('performSwap');
  foreach (['99.0.0', '8.2', 'invalid', [], null] as $minimum) {
    updaterRollbackWrite(
      $sourcePath . '/metadata.json',
      json_encode(['version' => '9.9.9', 'minPhp' => $minimum], JSON_THROW_ON_ERROR),
    );
    $rejected = false;
    try {
      $swap->invoke($updater, '9.9.9');
    } catch (Throwable $error) {
      $rejected = str_contains($error->getMessage(), 'PHP');
    }
    updaterRollbackAssert($rejected, 'Incompatible or malformed minimum PHP was accepted.');
    updaterRollbackAssert(
      file_get_contents($livePath . '/api/runtime.txt') === 'old-api' &&
        !is_dir($tempPath . '/staged-release'),
      'PHP rejection staged or changed live files.',
    );
  }
  updaterRollbackWrite($sourcePath . '/metadata.json', '{"version":"9.9.9","minPhp":"8.2.0"}');
  $failureInjected = false;
  try {
    $swap->invoke($updater, '9.9.9');
  } catch (Throwable $error) {
    $failureInjected = str_contains($error->getMessage(), 'Test failure injection');
  }

  updaterRollbackAssert($failureInjected, 'Rollback test did not inject an activation failure.');
  updaterRollbackAssert(
    !is_file($schemaReadCache),
    'An activation failure retained stale schema-read metadata.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/api/runtime.txt') === 'old-api',
    'API file was not restored after activation failure.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/assets/runtime.txt') === 'old-assets',
    'Asset file was not restored after activation failure.',
  );
  updaterRollbackAssert(
    is_file($livePath . '/assets/index-retired.js') &&
      !file_exists($livePath . '/assets/index-current.js'),
    'Managed assets rollback did not restore the complete previous directory.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/docs/runtime.txt') === 'old-docs',
    'Managed docs directory was not restored after activation failure.',
  );
  updaterRollbackAssert(
    is_file($livePath . '/docs/retired-guide.md') &&
      !file_exists($livePath . '/docs/current-guide.md'),
    'Managed docs rollback did not restore the complete previous directory.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/index.html') === 'old-index',
    'Untouched release file changed after activation failure.',
  );

  updaterRollbackWrite($sourcePath . '/metadata.json', '{"version":"9.9.9"}');
  $updater->configureTestFailures();
  updaterRollbackWrite($schemaReadCache, 'stale-schema-read-cache');
  $swap->invoke($updater, '9.9.9');

  updaterRollbackAssert(
    !is_file($schemaReadCache),
    'Successful activation retained stale schema-read metadata.',
  );

  updaterRollbackAssert(
    file_get_contents($livePath . '/api/runtime.txt') === 'new-api',
    'API file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/assets/runtime.txt') === 'new-assets',
    'Asset file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    !file_exists($livePath . '/assets/index-retired.js') &&
      file_get_contents($livePath . '/assets/index-current.js') === 'current-asset',
    'Managed assets replacement retained an obsolete bundle or missed the current bundle.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/docs/runtime.txt') === 'new-docs',
    'Release directory did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    !file_exists($livePath . '/docs/retired-guide.md') &&
      file_get_contents($livePath . '/docs/current-guide.md') === 'current-doc',
    'Managed docs replacement retained an obsolete guide or missed the current guide.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/index.html') === 'new-index',
    'Release file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/data/runtime.txt') === 'live-data',
    'Protected runtime data changed during a staged update.',
  );

  $cleanup = $reflection->getMethod('cleanup');
  $prepare = $reflection->getMethod('prepareTemporaryDirectory');
  $tempProperty = $reflection->getProperty('tempPath');
  $cleanupPath = $basePath . '/cleanup-probe';

  $downloadProbe = $basePath . '/download-probe';
  $tempProperty->setValue($updater, $downloadProbe);
  $downloadRefused = false;
  try {
    // Rejected before network/file transfer, after the real downloader seals its root.
    $reflection
      ->getMethod('downloadFile')
      ->invoke($updater, 'http://untrusted.invalid/update.zip', str_repeat('a', 64));
  } catch (Throwable $error) {
    $downloadRefused = true;
  }
  updaterRollbackAssert(
    $downloadRefused &&
      is_file($downloadProbe . '/.htaccess') &&
      !file_exists($downloadProbe . '/update.zip'),
    'Downloader did not seal its directory before attempting transport.',
  );

  $extractProbe = $basePath . '/extract-probe';
  $archivePath = $basePath . '/fixture-release.zip';
  $archive = new ZipArchive();
  updaterRollbackAssert(
    $archive->open($archivePath, ZipArchive::CREATE) === true,
    'Could not create isolated release ZIP.',
  );
  $archive->addFromString('api/sentinel.php', 'ISOLATED-PAYLOAD');
  $archive->close();
  $tempProperty->setValue($updater, $extractProbe);
  $reflection->getMethod('extractUpdate')->invoke($updater, $archivePath);
  updaterRollbackAssert(
    is_file($extractProbe . '/.htaccess') &&
      file_get_contents($extractProbe . '/extracted/api/sentinel.php') === 'ISOLATED-PAYLOAD',
    'Extraction failed or wrote payload without a parent shield.',
  );

  $tempProperty->setValue($updater, $cleanupPath);
  $prepare->invoke($updater);
  $shieldBytes = file_get_contents($cleanupPath . '/.htaccess');
  updaterRollbackAssert(
    str_contains($shieldBytes, 'Require all denied'),
    'Temporary directory was not sealed before payload writes.',
  );
  $prepare->invoke($updater);
  updaterRollbackAssert(
    file_get_contents($cleanupPath . '/.htaccess') === $shieldBytes,
    'Repeated preparation changed the shield.',
  );

  // Invalid shield destinations must refuse preparation rather than writing payload.
  unlink($cleanupPath . '/.htaccess');
  mkdir($cleanupPath . '/.htaccess');
  $refused = false;
  try {
    $prepare->invoke($updater);
  } catch (Throwable $error) {
    $refused = str_contains($error->getMessage(), 'protection');
  }
  updaterRollbackAssert(
    $refused && !file_exists($cleanupPath . '/update.zip'),
    'Unprotectable staging was accepted.',
  );
  rmdir($cleanupPath . '/.htaccess');
  $prepare->invoke($updater);

  updaterRollbackWrite($cleanupPath . '/a-removed.txt', 'remove-before-failure');
  updaterRollbackWrite($cleanupPath . '/z-blocked.php', 'payload-that-must-remain-private');
  $updater->configureTestFailures(removalPath: $cleanupPath . '/z-blocked.php');
  updaterRollbackAssert(
    $cleanup->invoke($updater) === false,
    'Partial cleanup failure was not surfaced.',
  );
  updaterRollbackAssert(
    !file_exists($cleanupPath . '/a-removed.txt') &&
      file_exists($cleanupPath . '/z-blocked.php') &&
      file_get_contents($cleanupPath . '/.htaccess') === $shieldBytes,
    'Partial cleanup removed the shield before the remaining payload.',
  );
  $updater->configureTestFailures();
  updaterRollbackAssert(
    $cleanup->invoke($updater) === true && !file_exists($cleanupPath),
    'Cleanup could not recover after partial failure.',
  );

  updaterRollbackWrite($cleanupPath . '/nested/runtime.txt', 'temporary-data');
  $tempProperty->setValue($updater, $cleanupPath);
  ob_start();
  $cleanupSucceeded = $cleanup->invoke($updater);
  $cleanupOutput = ob_get_clean();
  updaterRollbackAssert(
    $cleanupSucceeded === true && $cleanupOutput === '' && !file_exists($cleanupPath),
    'Successful updater cleanup did not remove the temporary tree without stray output.',
  );

  updaterRollbackWrite($cleanupPath . '/nested/runtime.txt', 'locked-test-data');
  $updater->configureTestFailures(cleanupFailure: true);
  ob_start();
  $cleanupSucceeded = $cleanup->invoke($updater);
  $cleanupOutput = ob_get_clean();
  updaterRollbackAssert(
    $cleanupSucceeded === false && $cleanupOutput === '' && is_dir($cleanupPath),
    'Failed updater cleanup emitted output or reported a false success.',
  );

  $updater->configureTestFailures();
  updaterRollbackAssert(
    $cleanup->invoke($updater) === true && !file_exists($cleanupPath),
    'Updater cleanup did not recover after a deferred failure.',
  );

  echo 'ok';
} finally {
  updaterRollbackRemove($basePath);
}
