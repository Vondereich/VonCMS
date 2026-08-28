<?php
/**
 * VonCMS - Publication Time Helper
 * Keeps first-publication timestamps compatible across upgraded and unrepaired installs.
 */

$publicationTimeHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($publicationTimeHelperPath !== false && $requestedScriptPath === $publicationTimeHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($publicationTimeHelperPath, $requestedScriptPath);

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
    return ($capabilities['published_at'][$table] ?? false) === true;
  }

  function voncms_mark_publication_columns_ready(): void
  {
    $path = voncms_publication_capability_path();
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
      throw new RuntimeException('Could not create the protected schema capability directory.');
    }

    $payload = json_encode(
      [
        'version' => 1,
        'published_at' => ['posts' => true, 'pages' => true],
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
