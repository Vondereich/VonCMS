<?php

function voncms_normalize_redirect_loop_authority(
  string $host = '',
  ?int $port = null,
  ?string $scheme = null,
): string {
  $normalizedHost = strtolower(trim($host));
  if ($normalizedHost === '') {
    return '';
  }

  $normalizedScheme = strtolower(trim((string) $scheme));
  $normalizedPort = $port;

  if (
    ($normalizedScheme === 'http' && $normalizedPort === 80) ||
    ($normalizedScheme === 'https' && $normalizedPort === 443) ||
    ($normalizedScheme === '' && in_array($normalizedPort, [80, 443], true))
  ) {
    $normalizedPort = null;
  }

  return $normalizedPort ? $normalizedHost . ':' . $normalizedPort : $normalizedHost;
}

function voncms_get_redirect_loop_request_scheme(): string
{
  $forwardedProto = strtolower(trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
  if ($forwardedProto === 'https' || $forwardedProto === 'http') {
    return $forwardedProto;
  }

  $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
  return $https !== '' && $https !== 'off' ? 'https' : 'http';
}

function voncms_get_redirect_loop_base_path(?PDO $pdo = null): string
{
  if ($pdo !== null) {
    try {
      $stmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'domain_url' LIMIT 1",
      );
      $stmt->execute();
      $domainUrl = (string) ($stmt->fetchColumn() ?: '');
      $domainPath = (string) (parse_url($domainUrl, PHP_URL_PATH) ?? '');

      if ($domainPath !== '') {
        $normalizedDomainPath = '/' . trim(str_replace('\\', '/', $domainPath), '/');
        return $normalizedDomainPath === '/' ? '/' : $normalizedDomainPath . '/';
      }
    } catch (Throwable $e) {
      // Fall through to request-derived base path.
    }
  }

  $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
  if (
    preg_match('#^(.*?)(?:/public)?/api(?:/[^/]*)?$#i', $scriptName, $matches) &&
    isset($matches[1])
  ) {
    $derivedBase = '/' . trim((string) $matches[1], '/');
    return $derivedBase === '/' ? '/' : $derivedBase . '/';
  }

  return '/';
}

function voncms_normalize_redirect_loop_path(
  string $url,
  string $currentHost = '',
  string $basePath = '/',
): string {
  $trimmed = trim($url);
  if ($trimmed === '') {
    return '';
  }

  $currentScheme = voncms_get_redirect_loop_request_scheme();
  $currentAuthority = voncms_normalize_redirect_loop_authority(
    (string) parse_url('http://' . ltrim($currentHost, '/'), PHP_URL_HOST),
    ($currentPort = parse_url('http://' . ltrim($currentHost, '/'), PHP_URL_PORT)) !== false
      ? (int) $currentPort
      : null,
    $currentScheme,
  );
  $host = (string) (parse_url($trimmed, PHP_URL_HOST) ?? '');
  $port = ($parsedPort = parse_url($trimmed, PHP_URL_PORT)) !== false ? (int) $parsedPort : null;
  $scheme = (string) (parse_url($trimmed, PHP_URL_SCHEME) ?? '');
  $targetAuthority = voncms_normalize_redirect_loop_authority($host, $port, $scheme);
  $path = (string) (parse_url($trimmed, PHP_URL_PATH) ?? '');
  $isAbsoluteUrl = preg_match('#^https?://#i', $trimmed) === 1 || strpos($trimmed, '//') === 0;

  if (
    $isAbsoluteUrl &&
    $currentAuthority !== '' &&
    $targetAuthority !== '' &&
    strcasecmp($targetAuthority, $currentAuthority) !== 0
  ) {
    return '';
  }

  if ($path === '') {
    if ($isAbsoluteUrl) {
      $path = '/';
    } else {
      $path = $trimmed;
    }
  }

  if ($basePath !== '/' && $basePath !== '' && stripos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
  }

  if ($path === '') {
    $path = '/';
  }

  if ($path[0] !== '/') {
    $path = '/' . ltrim($path, '/');
  }

  if ($path !== '/') {
    $path = rtrim($path, '/');
  }

  return $path;
}

function voncms_scan_redirect_loops(
  PDO $pdo,
  string $currentHost = '',
  string $basePath = '/',
): array {
  $tableCheck = $pdo->query("SHOW TABLES LIKE 'redirects'");
  if (!$tableCheck || $tableCheck->rowCount() === 0) {
    return [
      'summary' => [
        'totalRules' => 0,
        'localRules' => 0,
        'issueCount' => 0,
        'selfLoopCount' => 0,
        'cycleCount' => 0,
      ],
      'issues' => [],
    ];
  }

  $stmt = $pdo->query(
    'SELECT id, source_url, target_url, redirect_type, hit_count, created_at FROM redirects ORDER BY id ASC',
  );
  $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

  $graph = [];
  $issues = [];
  $issueKeys = [];
  $selfLoopCount = 0;
  $cycleCount = 0;

  foreach ($rows as $row) {
    $sourcePath = voncms_normalize_redirect_loop_path(
      (string) ($row['source_url'] ?? ''),
      '',
      $basePath,
    );
    $targetPath = voncms_normalize_redirect_loop_path(
      (string) ($row['target_url'] ?? ''),
      $currentHost,
      $basePath,
    );

    if ($sourcePath === '') {
      continue;
    }

    $graph[$sourcePath] = [
      'id' => (int) ($row['id'] ?? 0),
      'source_url' => (string) ($row['source_url'] ?? ''),
      'target_url' => (string) ($row['target_url'] ?? ''),
      'normalized_target' => $targetPath,
      'redirect_type' => (int) ($row['redirect_type'] ?? 301),
    ];

    if ($targetPath !== '' && $sourcePath === $targetPath) {
      $selfLoopCount++;
      $issueKey = 'self:' . $sourcePath . ':' . (string) ($row['id'] ?? 0);
      $issueKeys[$issueKey] = true;
      $issues[] = [
        'type' => 'self_loop',
        'message' => 'Redirect points back to the same local path.',
        'paths' => [$sourcePath],
        'ruleIds' => [(int) ($row['id'] ?? 0)],
      ];
    }
  }

  $visited = [];

  foreach (array_keys($graph) as $startPath) {
    if (isset($visited[$startPath])) {
      continue;
    }

    $pathOrder = [];
    $pathIndex = [];
    $currentPath = $startPath;

    while (isset($graph[$currentPath])) {
      if (isset($pathIndex[$currentPath])) {
        $cyclePaths = array_slice($pathOrder, $pathIndex[$currentPath]);
        if (count($cyclePaths) > 1) {
          $cycleRuleIds = array_map(fn($path) => (int) ($graph[$path]['id'] ?? 0), $cyclePaths);
          sort($cycleRuleIds);
          $issueKey = 'cycle:' . implode(',', $cycleRuleIds);

          if (!isset($issueKeys[$issueKey])) {
            $issueKeys[$issueKey] = true;
            $cycleCount++;
            $issues[] = [
              'type' => 'cycle',
              'message' => 'Redirect chain loops back to an earlier local path.',
              'paths' => $cyclePaths,
              'ruleIds' => $cycleRuleIds,
            ];
          }
        }
        break;
      }

      if (isset($visited[$currentPath])) {
        break;
      }

      $pathIndex[$currentPath] = count($pathOrder);
      $pathOrder[] = $currentPath;
      $visited[$currentPath] = true;

      $nextPath = (string) ($graph[$currentPath]['normalized_target'] ?? '');
      if ($nextPath === '' || !isset($graph[$nextPath])) {
        break;
      }

      $currentPath = $nextPath;
    }
  }

  return [
    'summary' => [
      'totalRules' => count($rows),
      'localRules' => count($graph),
      'issueCount' => count($issues),
      'selfLoopCount' => $selfLoopCount,
      'cycleCount' => $cycleCount,
    ],
    'issues' => $issues,
  ];
}
