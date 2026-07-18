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
  $livePath = $basePath . '/live';
  $tempPath = $livePath . '/temp_update';
  $sourcePath = $tempPath . '/extracted/VonCMS';

  updaterRollbackWrite($livePath . '/api/runtime.txt', 'old-api');
  updaterRollbackWrite($livePath . '/assets/runtime.txt', 'old-assets');
  updaterRollbackWrite($livePath . '/docs/runtime.txt', 'old-docs');
  updaterRollbackWrite($livePath . '/data/runtime.txt', 'live-data');
  updaterRollbackWrite($livePath . '/index.html', 'old-index');

  updaterRollbackWrite($sourcePath . '/api/runtime.txt', 'new-api');
  updaterRollbackWrite($sourcePath . '/assets/runtime.txt', 'new-assets');
  updaterRollbackWrite($sourcePath . '/docs/runtime.txt', 'new-docs');
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
      'testFailureAfterActivations' => 2,
    ]
    as $propertyName => $value
  ) {
    $property = $reflection->getProperty($propertyName);
    $property->setValue($updater, $value);
  }

  $swap = $reflection->getMethod('performSwap');
  $failureInjected = false;
  try {
    $swap->invoke($updater, '9.9.9');
  } catch (Throwable $error) {
    $failureInjected = str_contains($error->getMessage(), 'Test failure injection');
  }

  updaterRollbackAssert($failureInjected, 'Rollback test did not inject an activation failure.');
  updaterRollbackAssert(
    file_get_contents($livePath . '/api/runtime.txt') === 'old-api',
    'API file was not restored after activation failure.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/assets/runtime.txt') === 'old-assets',
    'Asset file was not restored after activation failure.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/docs/runtime.txt') === 'old-docs',
    'Untouched release directory changed after activation failure.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/index.html') === 'old-index',
    'Untouched release file changed after activation failure.',
  );

  $failureProperty = $reflection->getProperty('testFailureAfterActivations');
  $failureProperty->setValue($updater, null);
  $swap->invoke($updater, '9.9.9');

  updaterRollbackAssert(
    file_get_contents($livePath . '/api/runtime.txt') === 'new-api',
    'API file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/assets/runtime.txt') === 'new-assets',
    'Asset file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/docs/runtime.txt') === 'new-docs',
    'Release directory did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/index.html') === 'new-index',
    'Release file did not activate after a normal staged update.',
  );
  updaterRollbackAssert(
    file_get_contents($livePath . '/data/runtime.txt') === 'live-data',
    'Protected runtime data changed during a staged update.',
  );

  echo 'ok';
} finally {
  updaterRollbackRemove($basePath);
}
