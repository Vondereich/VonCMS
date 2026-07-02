<?php
/**
 * VonCMS - Scheduler Helper
 * Centralized scheduled-post publishing helpers.
 */

require_once __DIR__ . '/api/public_cache_helper.php';

function voncms_publish_scheduled_posts(PDO $pdo): int
{
  $now = date('Y-m-d H:i:s');
  $stmt = $pdo->prepare(
    "UPDATE posts SET status = 'published', updated_at = scheduled_at WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?",
  );
  $stmt->execute([$now]);
  $publishedCount = (int) $stmt->rowCount();
  if ($publishedCount > 0) {
    voncms_public_cache_clear();
  }

  return $publishedCount;
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

  $fp = @fopen($lockFile, 'c+');
  if (!$fp) {
    return 0;
  }

  try {
    if (!flock($fp, LOCK_EX | LOCK_NB)) {
      return 0;
    }

    clearstatcache(true, $lockFile);
    if (file_exists($lockFile) && time() - filemtime($lockFile) <= $intervalSeconds) {
      return 0;
    }

    touch($lockFile);
    return voncms_publish_scheduled_posts($pdo);
  } finally {
    flock($fp, LOCK_UN);
    fclose($fp);
  }
}
