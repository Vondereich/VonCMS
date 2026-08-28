<?php
/**
 * VonCMS - Scheduler Helper
 * Centralized scheduled-post publishing and periodic maintenance helpers.
 */

$schedulerHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($schedulerHelperPath !== false && $requestedScriptPath === $schedulerHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($schedulerHelperPath, $requestedScriptPath);

require_once __DIR__ . '/api/public_cache_helper.php';
require_once __DIR__ . '/api/publication_time_helper.php';

function voncms_publish_scheduled_posts(PDO $pdo): int
{
  $now = date('Y-m-d H:i:s');
  $publicationAssignment = voncms_has_publication_column($pdo, 'posts')
    ? 'published_at = COALESCE(published_at, scheduled_at), '
    : '';
  $stmt = $pdo->prepare(
    "UPDATE posts SET status = 'published', {$publicationAssignment}updated_at = scheduled_at WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?",
  );
  $stmt->execute([$now]);
  $publishedCount = (int) $stmt->rowCount();
  if ($publishedCount > 0) {
    voncms_public_cache_clear();
  }

  return $publishedCount;
}

function voncms_purge_expired_security_logs(PDO $pdo, int $retentionDays = 30): int
{
  if ($retentionDays < 1) {
    return 0;
  }
  $retentionDays = min($retentionDays, 3650);

  $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'mysql') {
    // Keep TIMESTAMP comparisons in the database session timezone.
    $stmt = $pdo->prepare(
      sprintf(
        'DELETE FROM security_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)',
        $retentionDays,
      ),
    );
    $stmt->execute();
  } else {
    // Portable path used by the SQLite runtime regression probe.
    $cutoffDate = new DateTimeImmutable('now');
    $cutoff = $cutoffDate->modify(sprintf('-%d days', $retentionDays))->format('Y-m-d H:i:s');
    $stmt = $pdo->prepare('DELETE FROM security_logs WHERE created_at < ?');
    $stmt->execute([$cutoff]);
  }

  return (int) $stmt->rowCount();
}

function voncms_run_security_retention_if_due(
  $pdo,
  string $lockFile,
  int $intervalSeconds = 86400,
  int $retentionDays = 30,
): int {
  if (!($pdo instanceof PDO) || $intervalSeconds < 1 || $retentionDays < 1) {
    return 0;
  }

  clearstatcache(true, $lockFile);
  if (file_exists($lockFile) && time() - filemtime($lockFile) <= $intervalSeconds) {
    return 0;
  }

  $lockCreated = false;
  $fp = @fopen($lockFile, 'x+');
  if ($fp !== false) {
    $lockCreated = true;
  } else {
    $fp = @fopen($lockFile, 'c+');
  }
  if (!$fp) {
    return 0;
  }

  try {
    if (!flock($fp, LOCK_EX | LOCK_NB)) {
      return 0;
    }

    if (!$lockCreated) {
      clearstatcache(true, $lockFile);
      if (file_exists($lockFile) && time() - filemtime($lockFile) <= $intervalSeconds) {
        return 0;
      }
    }

    try {
      $purgedCount = voncms_purge_expired_security_logs($pdo, $retentionDays);
      touch($lockFile);
      return $purgedCount;
    } catch (Throwable $e) {
      // Keep the marker stale so a transient database failure can retry on later traffic.
      @touch($lockFile, time() - $intervalSeconds - 1);
      error_log('VonCMS security retention failed: ' . $e->getMessage());
      return 0;
    }
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}

/**
 * @param PDO $pdo
 * @param string $lockFile
 * @param int $intervalSeconds
 * @return int
 */
function voncms_run_scheduler_if_due($pdo, string $lockFile, int $intervalSeconds = 60): int
{
  if (!($pdo instanceof PDO) || $intervalSeconds < 1) {
    return 0;
  }

  clearstatcache(true, $lockFile);
  if (file_exists($lockFile) && time() - filemtime($lockFile) <= $intervalSeconds) {
    return 0;
  }

  $lockCreated = false;
  $fp = @fopen($lockFile, 'x+');
  if ($fp !== false) {
    $lockCreated = true;
  } else {
    $fp = @fopen($lockFile, 'c+');
  }
  if (!$fp) {
    return 0;
  }

  try {
    if (!flock($fp, LOCK_EX | LOCK_NB)) {
      return 0;
    }

    if (!$lockCreated) {
      clearstatcache(true, $lockFile);
      if (file_exists($lockFile) && time() - filemtime($lockFile) <= $intervalSeconds) {
        return 0;
      }
    }

    try {
      $publishedCount = voncms_publish_scheduled_posts($pdo);
      touch($lockFile);
      voncms_run_security_retention_if_due($pdo, $lockFile . '.security-retention');
      return $publishedCount;
    } catch (Throwable $e) {
      // Publishing is traffic-driven maintenance; a database error must not break the public page.
      @touch($lockFile, time() - $intervalSeconds - 1);
      error_log('VonCMS scheduled publishing failed: ' . $e->getMessage());
      return 0;
    }
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}
