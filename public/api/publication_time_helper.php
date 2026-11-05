<?php
/**
 * VonCMS - Publication Time Helper
 * Keeps first-publication timestamps compatible across upgraded and unrepaired installs.
 */

$publicationTimeHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath(
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) ? $_SERVER['SCRIPT_FILENAME'] : '',
);
if ($publicationTimeHelperPath !== false && $requestedScriptPath === $publicationTimeHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/../core/DataBoundary.php';

unset($publicationTimeHelperPath, $requestedScriptPath);

/** Optional presentation metadata only; never used to authorize a user or migration. */
if (!function_exists('voncms_has_display_name_column')) {
  function voncms_display_name_cache_path(): string
  {
    return dirname(__DIR__) . '/data/schema-capabilities.json.display-name-cache';
  }

  function voncms_display_name_cache_context(PDO $pdo): ?string
  {
    // Only cache the installation's configured connection, not an unrelated PDO passed by a tool.
    if (($GLOBALS['pdo'] ?? null) !== $pdo) {
      return null;
    }
    $configHash = @hash_file('sha256', dirname(__DIR__) . '/von_config.php');
    $helperHash = @hash_file('sha256', __FILE__);
    if (!is_string($configHash) || !is_string($helperHash)) {
      return null;
    }
    $markerPath = dirname(__DIR__) . '/data/schema-capabilities.json';
    $markerHash = is_file($markerPath) ? @hash_file('sha256', $markerPath) : 'missing';
    if (!is_string($markerHash)) {
      return null;
    }
    return hash('sha256', $configHash . ':' . $helperHash . ':' . $markerHash);
  }

  function voncms_read_display_name_cache(string $context): ?bool
  {
    $path = voncms_display_name_cache_path();
    clearstatcache(true, $path);
    if (!is_file($path) || is_link($path) || filesize($path) > 4096) {
      return null;
    }
    $json = @file_get_contents($path);
    $cached = is_string($json) ? json_decode($json, true) : null;
    $checkedAt = is_array($cached) ? $cached['checked_at'] ?? null : null;
    if (
      !is_array($cached) ||
      ($cached['version'] ?? null) !== 1 ||
      ($cached['context'] ?? null) !== $context ||
      !is_int($checkedAt) ||
      $checkedAt > time() ||
      time() - $checkedAt >= 300 ||
      !is_bool($cached['display_name'] ?? null)
    ) {
      return null;
    }
    return $cached['display_name'];
  }

  function voncms_clear_display_name_cache(?string $cachePath = null): void
  {
    $path = $cachePath ?? voncms_display_name_cache_path();
    if (!is_file($path) && !is_file($path . '.lock')) {
      return;
    }
    // Serialize with a cache miss so a completed invalidation cannot be overwritten by its probe.
    $gate = @fopen($path . '.lock', 'c');
    if (!is_resource($gate)) {
      throw new RuntimeException('Could not invalidate the optional schema read cache.');
    }
    try {
      if (!flock($gate, LOCK_EX) || (is_file($path) && !@unlink($path))) {
        throw new RuntimeException('Could not invalidate the optional schema read cache.');
      }
    } finally {
      flock($gate, LOCK_UN);
      fclose($gate);
    }
  }

  function voncms_has_display_name_column(PDO $pdo): bool
  {
    $context = voncms_display_name_cache_context($pdo);
    if ($context !== null) {
      $cached = voncms_read_display_name_cache($context);
      if ($cached !== null) {
        return $cached;
      }
    }

    $path = voncms_display_name_cache_path();
    $gate = $context !== null && is_dir(dirname($path)) ? @fopen($path . '.lock', 'c') : false;
    $canWrite = is_resource($gate) && @flock($gate, LOCK_EX | LOCK_NB);
    $exists = false;
    try {
      if ($canWrite) {
        $context = voncms_display_name_cache_context($pdo);
        $cached = $context !== null ? voncms_read_display_name_cache($context) : null;
        if ($cached !== null) {
          return $cached;
        }
      }

      $statement = $pdo->query("SHOW COLUMNS FROM users LIKE 'display_name'");
      if (!($statement instanceof PDOStatement)) {
        return false;
      }
      try {
        $exists = $statement->fetch(PDO::FETCH_ASSOC) !== false;
      } finally {
        $statement->closeCursor();
      }

      // Storage failure retains the original live-query behavior. Never cache a failed query.
      if ($canWrite && $context !== null) {
        $json = json_encode([
          'version' => 1,
          'context' => $context,
          'checked_at' => time(),
          'display_name' => $exists,
        ]);
        if (is_string($json)) {
          $temporaryPath = $path . '.' . bin2hex(random_bytes(8)) . '.tmp';
          if (@file_put_contents($temporaryPath, $json, LOCK_EX) === strlen($json)) {
            @chmod($temporaryPath, 0600);
            if (!@rename($temporaryPath, $path)) {
              @unlink($temporaryPath);
            }
          } else {
            @unlink($temporaryPath);
          }
        }
      }
      return $exists;
    } catch (Throwable $error) {
      return $exists;
    } finally {
      if (is_resource($gate)) {
        if ($canWrite) {
          @flock($gate, LOCK_UN);
        }
        fclose($gate);
      }
    }
  }
}

if (!function_exists('voncms_has_publication_column')) {
  function voncms_publication_capability_path(): string
  {
    return dirname(__DIR__) . '/data/schema-capabilities.json';
  }

  /** @return array<string, mixed> */
  function voncms_read_publication_capabilities(): array
  {
    if (isset($GLOBALS['voncms_publication_capability_cache'])) {
      $cached = $GLOBALS['voncms_publication_capability_cache'];
      return is_array($cached) ? $cached : [];
    }

    $path = voncms_publication_capability_path();
    $capabilities = [];
    if (is_file($path)) {
      $decoded = json_decode((string) @file_get_contents($path), true);
      if (is_array($decoded) && ($decoded['version'] ?? null) === 1) {
        $capabilities = $decoded;
      }
    }

    $GLOBALS['voncms_publication_capability_cache'] = $capabilities;
    return $capabilities;
  }

  function voncms_has_publication_column(PDO $pdo, string $table): bool
  {
    if (!in_array($table, ['posts', 'pages'], true)) {
      return false;
    }

    unset($pdo);
    $capabilities = voncms_read_publication_capabilities();
    $columns = $capabilities['published_at'] ?? null;
    return is_array($columns) && ($columns[$table] ?? false) === true;
  }

  /** @param array<string, array<string, bool>> $queryIndexes */
  function voncms_mark_publication_columns_ready(
    array $queryIndexes = [],
    bool $postDailyViews = false,
  ): void {
    voncms_clear_display_name_cache();
    $path = voncms_publication_capability_path();
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
      throw new RuntimeException('Could not create the protected schema capability directory.');
    }

    $previous = voncms_read_publication_capabilities();
    $dailyViewsSince = $previous['post_daily_views_since'] ?? time();
    $dailyViewsSince = is_numeric($dailyViewsSince) ? (int) $dailyViewsSince : time();
    $payload = json_encode(
      [
        'version' => 1,
        'published_at' => ['posts' => true, 'pages' => true],
        'query_indexes' => $queryIndexes,
        'post_daily_views' => $postDailyViews,
        'post_daily_views_since' => $postDailyViews ? $dailyViewsSince : null,
      ],
      JSON_UNESCAPED_SLASHES,
    );
    if (!is_string($payload)) {
      throw new RuntimeException('Could not encode the schema capability marker.');
    }

    try {
      $suffix = bin2hex(random_bytes(6));
    } catch (Throwable $e) {
      $suffix = str_replace('.', '', uniqid('', true));
    }
    $temporaryPath = $path . '.' . $suffix . '.tmp';
    if (@file_put_contents($temporaryPath, $payload, LOCK_EX) !== strlen($payload)) {
      @unlink($temporaryPath);
      throw new RuntimeException('Could not write the schema capability marker.');
    }
    if (is_file($path) && !@unlink($path)) {
      @unlink($temporaryPath);
      throw new RuntimeException('Could not replace the schema capability marker.');
    }
    if (!@rename($temporaryPath, $path)) {
      @unlink($temporaryPath);
      throw new RuntimeException('Could not activate the schema capability marker.');
    }

    $GLOBALS['voncms_publication_capability_cache'] = json_decode($payload, true);
  }

  function voncms_clear_publication_capability_marker(): void
  {
    voncms_clear_display_name_cache();
    $path = voncms_publication_capability_path();
    if (is_file($path) && !@unlink($path)) {
      throw new RuntimeException('Could not clear the schema capability marker.');
    }
    $GLOBALS['voncms_publication_capability_cache'] = [];
  }
}

if (!function_exists('voncms_publication_column_sql')) {
  function voncms_publication_column_sql(PDO $pdo, string $table, string $alias = ''): string
  {
    if (!in_array($table, ['posts', 'pages'], true)) {
      throw new InvalidArgumentException('Unsupported publication-time table.');
    }

    $prefix = '';
    if ($alias !== '') {
      if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $alias)) {
        throw new InvalidArgumentException('Invalid publication-time SQL alias.');
      }
      $prefix = $alias . '.';
    }

    return voncms_has_publication_column($pdo, $table)
      ? $prefix . 'published_at'
      : 'NULL AS published_at';
  }
}

if (!function_exists('voncms_publication_expression_sql')) {
  function voncms_publication_expression_sql(PDO $pdo, string $table, string $alias = ''): string
  {
    if (!in_array($table, ['posts', 'pages'], true)) {
      throw new InvalidArgumentException('Unsupported publication-time table.');
    }
    if ($alias !== '' && !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $alias)) {
      throw new InvalidArgumentException('Invalid publication-time SQL alias.');
    }

    $prefix = $alias === '' ? '' : $alias . '.';
    $parts = [];
    if (voncms_has_publication_column($pdo, $table)) {
      $parts[] = $prefix . 'published_at';
    }
    if ($table === 'posts') {
      $parts[] = $prefix . 'scheduled_at';
    }
    $parts[] = $prefix . 'created_at';

    return 'COALESCE(' . implode(', ', $parts) . ')';
  }
}

if (!function_exists('voncms_publication_value')) {
  /**
   * @param array<string, mixed> $content
   */
  function voncms_publication_value(array $content, string $contentType = 'post'): ?string
  {
    $candidates = [$content['published_at'] ?? ($content['publishedAt'] ?? null)];
    if ($contentType === 'post') {
      $candidates[] = $content['scheduled_at'] ?? ($content['scheduledAt'] ?? null);
    }
    $candidates[] = $content['created_at'] ?? ($content['createdAt'] ?? null);

    foreach ($candidates as $candidate) {
      if (!is_scalar($candidate)) {
        continue;
      }
      $value = trim((string) $candidate);
      if ($value !== '') {
        return $value;
      }
    }

    return null;
  }
}
