<?php

/**
 * Shared Gemini credential, quota, and provider boundary.
 *
 * Stored API keys never leave PHP. Callers using their own explicit key keep
 * the legacy flow, while shared-key calls use the server-owned model and quota.
 */

/** @return list<string> */
function voncms_ai_supported_models(): array
{
  return [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
  ];
}

function voncms_ai_normalize_model(mixed $model, string $fallback = 'gemini-3.6-flash'): string
{
  $normalized = is_scalar($model) ? trim((string) $model) : '';
  $safeFallback = in_array($fallback, voncms_ai_supported_models(), true)
    ? $fallback
    : 'gemini-3.6-flash';
  return in_array($normalized, voncms_ai_supported_models(), true) ? $normalized : $safeFallback;
}

function voncms_ai_send_error(string $message, int $statusCode, string $code): never
{
  sendApiHeaders();
  if (ob_get_length()) {
    ob_clean();
  }
  http_response_code($statusCode);
  error_log('VonCMS AI Error: ' . $code);
  echo json_encode([
    'success' => false,
    'error' => $message,
    'code' => $code,
  ]);
  exit();
}

/**
 * Return the exact HTML tag sequence without interpreting or normalizing it.
 *
 * AI Check may rewrite readable text, but its response must preserve every
 * existing tag, attribute, URL, embed, and their order byte-for-byte. A small
 * linear scanner is used instead of DOM normalization so equivalent-looking
 * markup cannot silently change editor data.
 *
 * @return list<string>|null Null means the fragment contains an unclosed tag.
 */
function voncms_ai_html_tag_fingerprint(string $html): ?array
{
  $fingerprint = [];
  $length = strlen($html);

  for ($index = 0; $index < $length; $index++) {
    if ($html[$index] !== '<') {
      continue;
    }

    if (substr($html, $index, 4) === '<!--') {
      $commentEnd = strpos($html, '-->', $index + 4);
      if ($commentEnd === false) {
        return null;
      }
      $tokenEnd = $commentEnd + 3;
      $fingerprint[] = substr($html, $index, $tokenEnd - $index);
      $index = $tokenEnd - 1;
      continue;
    }

    $next = $html[$index + 1] ?? '';
    $isAsciiLetter = ($next >= 'A' && $next <= 'Z') || ($next >= 'a' && $next <= 'z');
    if (!$isAsciiLetter && $next !== '/' && $next !== '!' && $next !== '?') {
      continue;
    }

    $quote = '';
    $tokenEnd = null;
    for ($cursor = $index + 1; $cursor < $length; $cursor++) {
      $character = $html[$cursor];
      if ($quote !== '') {
        if ($character === $quote) {
          $quote = '';
        }
        continue;
      }
      if ($character === '"' || $character === "'") {
        $quote = $character;
        continue;
      }
      if ($character === '>') {
        $tokenEnd = $cursor + 1;
        break;
      }
    }

    if ($tokenEnd === null) {
      return null;
    }
    $fingerprint[] = substr($html, $index, $tokenEnd - $index);
    $index = $tokenEnd - 1;
  }

  return $fingerprint;
}

function voncms_ai_html_structure_matches(string $original, string $candidate): bool
{
  $originalFingerprint = voncms_ai_html_tag_fingerprint($original);
  $candidateFingerprint = voncms_ai_html_tag_fingerprint($candidate);
  return $originalFingerprint !== null &&
    $candidateFingerprint !== null &&
    $originalFingerprint === $candidateFingerprint;
}

/** @return array<string, mixed> */
function voncms_ai_load_config(PDO $pdo): array
{
  try {
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'api' AND setting_key = 'config' LIMIT 1",
    );
    $stmt->execute();
    $decoded = json_decode((string) ($stmt->fetchColumn() ?: ''), true);
    return is_array($decoded) ? $decoded : [];
  } catch (Throwable $e) {
    return [];
  }
}

function voncms_ai_configured_key(array $config): string
{
  $key = trim((string) ($config['aiApiKey'] ?? ''));
  if ($key === '' || strlen($key) > 512 || str_contains($key, '*')) {
    return '';
  }

  $rotationEnabled = filter_var(
    $config['expireAiKeyAfter30Days'] ?? false,
    FILTER_VALIDATE_BOOLEAN,
  );
  if (!$rotationEnabled) {
    return $key;
  }

  $expiresAt = trim((string) ($config['aiKeyExpiresAt'] ?? ''));
  if ($expiresAt === '') {
    return '';
  }

  try {
    return new DateTimeImmutable($expiresAt) > new DateTimeImmutable('now', new DateTimeZone('UTC'))
      ? $key
      : '';
  } catch (Throwable $e) {
    return '';
  }
}

/** @return array{sharedAvailable: bool, model: string} */
function voncms_ai_staff_projection(PDO $pdo): array
{
  $config = voncms_ai_load_config($pdo);
  return [
    'sharedAvailable' => voncms_ai_configured_key($config) !== '',
    'model' => voncms_ai_normalize_model($config['aiModel'] ?? null),
  ];
}

/**
 * @return array{api_key: string, model: string, shared: bool}|null
 */
function voncms_ai_resolve_request(PDO $pdo, mixed $requestedModel, mixed $headerKey): ?array
{
  $ownKey = is_scalar($headerKey) ? trim((string) $headerKey) : '';
  if ($ownKey !== '') {
    if (strlen($ownKey) > 512 || str_contains($ownKey, '*')) {
      return null;
    }
    return [
      'api_key' => $ownKey,
      'model' => voncms_ai_normalize_model($requestedModel),
      'shared' => false,
    ];
  }

  $config = voncms_ai_load_config($pdo);
  $sharedKey = voncms_ai_configured_key($config);
  if ($sharedKey === '') {
    return null;
  }

  return [
    'api_key' => $sharedKey,
    'model' => voncms_ai_normalize_model($config['aiModel'] ?? null),
    'shared' => true,
  ];
}

function voncms_ai_consume_quota(string $scope, int $maxAttempts, int $windowSeconds): bool
{
  $directory = dirname(__DIR__) . '/data/ai-limits';
  if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
    return false;
  }

  $path = $directory . '/' . hash('sha256', $scope) . '.json';
  $handle = @fopen($path, 'c+');
  if ($handle === false || !@flock($handle, LOCK_EX)) {
    if (is_resource($handle)) {
      @fclose($handle);
    }
    return false;
  }

  $accepted = false;
  try {
    rewind($handle);
    $decoded = json_decode((string) stream_get_contents($handle), true);
    $now = time();
    $startedAt = is_array($decoded) ? (int) ($decoded['window_started_at'] ?? 0) : 0;
    $attempts = is_array($decoded) ? (int) ($decoded['attempts'] ?? 0) : 0;
    if ($startedAt <= 0 || $startedAt + $windowSeconds <= $now) {
      $startedAt = $now;
      $attempts = 0;
    }

    if ($attempts < $maxAttempts) {
      $payload = json_encode([
        'attempts' => $attempts + 1,
        'window_started_at' => $startedAt,
      ]);
      rewind($handle);
      $accepted =
        is_string($payload) &&
        @ftruncate($handle, 0) &&
        @fwrite($handle, $payload) === strlen($payload) &&
        @fflush($handle);
    }
  } finally {
    @flock($handle, LOCK_UN);
    @fclose($handle);
  }

  return $accepted;
}

function voncms_ai_authorize_quota(string $userId, bool $shared): bool
{
  $userLimit = $shared ? 30 : 60;
  if (!voncms_ai_consume_quota('user:' . $userId, $userLimit, 3600)) {
    return false;
  }

  return !$shared || voncms_ai_consume_quota('shared-site', 300, 3600);
}

/**
 * @return array{ok: bool, http_code: int, data: array<string, mixed>, model: string, fallback_used: bool, error_code: string}
 */
function voncms_ai_generate_with_fallback(
  string $apiKey,
  string $model,
  array $payload,
  int $timeoutSeconds,
): array {
  $fallbackModel = 'gemini-flash-latest';
  $models = array_values(array_unique([$model, $fallbackModel]));

  foreach ($models as $index => $candidateModel) {
    $url =
      'https://generativelanguage.googleapis.com/v1beta/models/' .
      rawurlencode($candidateModel) .
      ':generateContent?key=' .
      rawurlencode($apiKey);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_TIMEOUT => $timeoutSeconds,
      CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlFailed = $response === false || curl_errno($ch) !== 0;
    curl_close($ch);

    if ($curlFailed) {
      return [
        'ok' => false,
        'http_code' => 502,
        'data' => [],
        'model' => $candidateModel,
        'fallback_used' => $index > 0,
        'error_code' => 'AI_NETWORK_ERROR',
      ];
    }

    $data = json_decode((string) $response, true);
    if (!is_array($data)) {
      return [
        'ok' => false,
        'http_code' => 502,
        'data' => [],
        'model' => $candidateModel,
        'fallback_used' => $index > 0,
        'error_code' => 'AI_INVALID_RESPONSE',
      ];
    }

    if ($httpCode === 200) {
      return [
        'ok' => true,
        'http_code' => 200,
        'data' => $data,
        'model' => $candidateModel,
        'fallback_used' => $index > 0,
        'error_code' => '',
      ];
    }

    $providerStatus = strtoupper((string) ($data['error']['status'] ?? ''));
    $canFallback =
      $index === 0 && count($models) > 1 && $httpCode === 404 && $providerStatus === 'NOT_FOUND';
    if ($canFallback) {
      continue;
    }

    return [
      'ok' => false,
      'http_code' => in_array($httpCode, [400, 401, 403, 404, 429], true) ? $httpCode : 502,
      'data' => [],
      'model' => $candidateModel,
      'fallback_used' => $index > 0,
      'error_code' => match ($httpCode) {
        401, 403 => 'AI_AUTH_FAILED',
        429 => 'AI_QUOTA_EXCEEDED',
        404 => 'AI_MODEL_UNAVAILABLE',
        default => 'AI_PROVIDER_ERROR',
      },
    ];
  }

  return [
    'ok' => false,
    'http_code' => 502,
    'data' => [],
    'model' => $model,
    'fallback_used' => false,
    'error_code' => 'AI_PROVIDER_ERROR',
  ];
}
