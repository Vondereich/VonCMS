<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

require_once __DIR__ . '/../core/CredentialStore.php';

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
    'gemini-3.8-flash',
    // Retain previously saved model names; the settings menu offers current models only.
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
 * Read only the provider fields used by both editor actions; malformed text stays empty.
 * @param array<array-key,mixed> $data
 * @return array{text: string, blocked: bool, finishReason: string}
 */
function voncms_ai_response_fields(array $data): array
{
  $candidates = is_array($data['candidates'] ?? null) ? $data['candidates'] : [];
  $candidate = is_array($candidates[0] ?? null) ? $candidates[0] : [];
  $content = is_array($candidate['content'] ?? null) ? $candidate['content'] : [];
  $parts = is_array($content['parts'] ?? null) ? $content['parts'] : [];
  $part = is_array($parts[0] ?? null) ? $parts[0] : [];
  $feedback = is_array($data['promptFeedback'] ?? null) ? $data['promptFeedback'] : [];
  return [
    'text' => is_string($part['text'] ?? null) ? trim($part['text']) : '',
    'blocked' => !empty($feedback['blockReason']),
    'finishReason' => is_string($candidate['finishReason'] ?? null)
      ? strtoupper($candidate['finishReason'])
      : '',
  ];
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

/** @param array<array-key,mixed> $config */
function voncms_ai_read_stored_key(array $config): string
{
  $stored = $config['aiApiKey'] ?? '';
  if (!is_string($stored)) {
    throw new RuntimeException('Stored AI credential is invalid.');
  }
  $key = VonCmsCredentialStore::isEncrypted($stored)
    ? VonCmsCredentialStore::decrypt($stored, 'voncms:global-gemini:v1')
    : trim($stored);
  if ($key === '' || strlen($key) > 512 || str_contains($key, '*')) {
    return '';
  }
  return $key;
}

/** Owner responses expose status, never plaintext or ciphertext. Reads do not migrate.
 * @param array<array-key,mixed> $config
 * @return array<array-key,mixed>
 */
function voncms_ai_owner_projection(array $config): array
{
  $stored = $config['aiApiKey'] ?? '';
  $hasKey = $stored !== '';
  $state = $hasKey ? (is_string($stored) ? 'legacy' : 'unavailable') : 'empty';
  if ($hasKey && is_string($stored) && VonCmsCredentialStore::isEncrypted($stored)) {
    try {
      $state = voncms_ai_read_stored_key($config) !== '' ? 'encrypted' : 'unavailable';
    } catch (Throwable $e) {
      $state = 'unavailable';
    }
  }
  $config['aiApiKey'] = $hasKey ? '******** (PROTECTED)' : '';
  $config['aiKeyStorage'] = $state;
  $config['aiKeyRevision'] = $state === 'encrypted' ? hash('sha256', $stored) : '';
  $config['aiKeyCanRotate'] = $state === 'encrypted' && VonCmsCredentialStore::canRotate();
  $config['aiKeyRotatedAt'] = is_string($config['aiKeyRotatedAt'] ?? null)
    ? $config['aiKeyRotatedAt']
    : '';
  $config['aiKeySavedAt'] = is_string($config['aiKeySavedAt'] ?? null)
    ? $config['aiKeySavedAt']
    : '';
  $config['aiKeyExpiresAt'] = is_string($config['aiKeyExpiresAt'] ?? null)
    ? $config['aiKeyExpiresAt']
    : '';
  return $config;
}

/** Minimal acknowledgement, with no unrelated API configuration.
 * @param array<array-key,mixed> $config
 * @return array<array-key,mixed>
 */
function voncms_ai_credential_status(array $config): array
{
  return array_intersect_key(
    voncms_ai_owner_projection($config),
    array_flip([
      'aiApiKey',
      'aiKeyStorage',
      'aiKeyRevision',
      'aiKeyCanRotate',
      'aiKeyRotatedAt',
      'expireAiKeyAfter30Days',
      'aiKeySavedAt',
      'aiKeyExpiresAt',
    ]),
  );
}

/** Only explicit owner saves migrate or replace keys; a mask is not an empty key.
 * @param array<array-key,mixed> $incoming
 * @param array<array-key,mixed> $existing
 * @return array<array-key,mixed>
 */
function voncms_ai_prepare_stored_config(array $incoming, array $existing): array
{
  $result = array_replace($existing, $incoming);
  unset(
    $result['aiKeyStorage'],
    $result['encryptStoredAiKey'],
    $result['replaceAiKey'],
    $result['aiKeyRevision'],
    $result['aiKeyCanRotate'],
    $result['aiKeyRotatedAt'],
  );
  if (is_string($existing['aiKeyRotatedAt'] ?? null)) {
    $result['aiKeyRotatedAt'] = $existing['aiKeyRotatedAt'];
  }
  $submitted = $incoming['aiApiKey'] ?? null;
  $hasInput = array_key_exists('aiApiKey', $incoming);
  if ($hasInput && !is_string($submitted)) {
    throw new InvalidArgumentException('AI API key must be text.');
  }
  $submitted = is_string($submitted) ? trim($submitted) : '';
  $placeholder =
    str_contains($submitted, '*') || str_starts_with(strtolower($submitted), 'protected:');
  $replace = $hasInput && $submitted !== '' && !$placeholder;
  if ($hasInput && $submitted === '') {
    unset($result['aiApiKey'], $result['aiKeySavedAt'], $result['aiKeyExpiresAt']);
    return $result;
  }
  if (
    $replace &&
    (strlen($submitted) > 512 ||
      preg_match('/[\x00-\x20\x7f]/', $submitted) ||
      VonCmsCredentialStore::isEncrypted($submitted))
  ) {
    throw new InvalidArgumentException(
      'Enter a valid plaintext Gemini API key, not a stored encrypted value.',
    );
  }
  $stored = $existing['aiApiKey'] ?? '';
  if (!is_string($stored)) {
    throw new RuntimeException('Existing AI credential could not be read.');
  }
  if ($replace) {
    // Explicit re-entry may restart local expiry, even for the same valid provider key.
    $result['aiApiKey'] = VonCmsCredentialStore::encrypt(
      $submitted,
      'voncms:global-gemini:v1',
      true,
    );
  } elseif ($stored !== '') {
    $result['aiApiKey'] = VonCmsCredentialStore::isEncrypted($stored)
      ? $stored
      : VonCmsCredentialStore::encrypt($stored, 'voncms:global-gemini:v1', true);
  } else {
    unset($result['aiApiKey'], $result['aiKeySavedAt'], $result['aiKeyExpiresAt']);
    return $result;
  }
  $rotationEnabled = filter_var(
    $result['expireAiKeyAfter30Days'] ?? false,
    FILTER_VALIDATE_BOOLEAN,
  );
  $rotationWasEnabled = filter_var(
    $existing['expireAiKeyAfter30Days'] ?? false,
    FILTER_VALIDATE_BOOLEAN,
  );
  $result['expireAiKeyAfter30Days'] = $rotationEnabled;
  $savedAt = is_string($existing['aiKeySavedAt'] ?? null) ? $existing['aiKeySavedAt'] : '';
  $sameLegacyKey =
    $stored !== '' &&
    !VonCmsCredentialStore::isEncrypted($stored) &&
    hash_equals(trim($stored), $submitted);
  $refresh =
    ($replace && (!$sameLegacyKey || ($incoming['replaceAiKey'] ?? false) === true)) ||
    $savedAt === '' ||
    ($rotationEnabled && !$rotationWasEnabled);
  $result['aiKeySavedAt'] = $refresh ? gmdate('c') : $savedAt;
  if (!$rotationEnabled) {
    unset($result['aiKeyExpiresAt']);
  } elseif (!$refresh && $rotationWasEnabled && array_key_exists('aiKeyExpiresAt', $existing)) {
    $result['aiKeyExpiresAt'] = $existing['aiKeyExpiresAt'];
  } else {
    try {
      $result['aiKeyExpiresAt'] = (new DateTimeImmutable($result['aiKeySavedAt']))
        ->modify('+30 days')
        ->format(DateTimeInterface::ATOM);
    } catch (Throwable $e) {
      throw new RuntimeException('Existing AI expiry state is invalid. Re-enter the API key.');
    }
  }
  return $result;
}

/** Single global credential only; new stored providers/users must join this coordinator. */
/** @return array<array-key,mixed> */
function voncms_ai_rotate_global_key(PDO $pdo, string $expectedRevision, ?int $userId): array
{
  if (preg_match('/^[a-f0-9]{64}$/D', $expectedRevision) !== 1) {
    throw new InvalidArgumentException('Reload Settings before rotating the encryption key.');
  }
  if ($pdo->inTransaction()) {
    throw new RuntimeException('Encryption key rotation requires a separate settings action.', 409);
  }
  try {
    $pdo->beginTransaction();
    $statement = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'api' AND setting_key = 'config' LIMIT 1 FOR UPDATE",
    );
    $statement->execute();
    $raw = $statement->fetchColumn();
    $config = is_string($raw) ? json_decode($raw, true) : null;
    $stored = is_array($config) ? $config['aiApiKey'] ?? null : null;
    if (
      !is_string($stored) ||
      !VonCmsCredentialStore::isEncrypted($stored) ||
      !hash_equals(hash('sha256', $stored), $expectedRevision)
    ) {
      throw new RuntimeException('The saved key changed. Reload Settings before rotating.', 409);
    }
    VonCmsCredentialStore::rotateSecret($stored, 'voncms:global-gemini:v1', static function (
      string $ciphertext,
    ) use ($pdo, &$config, $userId): void {
      $config['aiApiKey'] = $ciphertext;
      $config['aiKeyRotatedAt'] = gmdate('c');
      $update = $pdo->prepare(
        "UPDATE settings SET setting_value = ?, is_public = 0, updated_by = ?, version = version + 1, updated_at = NOW() WHERE setting_group = 'api' AND setting_key = 'config'",
      );
      $update->execute([json_encode($config, JSON_THROW_ON_ERROR), $userId]);
      if ($update->rowCount() !== 1 || !$pdo->commit()) {
        throw new RuntimeException('Encryption key rotation could not be committed.');
      }
    });
    return voncms_ai_credential_status($config);
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    if ($e instanceof InvalidArgumentException || $e->getCode() === 409) {
      throw $e;
    }
    throw new RuntimeException(
      'Encryption key rotation could not be confirmed. Reload Settings before retrying; do not delete the private key file.',
      503,
    );
  }
}

/** @param array<array-key,mixed> $config */
function voncms_ai_configured_key(array $config): string
{
  try {
    $key = voncms_ai_read_stored_key($config);
  } catch (Throwable $e) {
    return '';
  }
  if ($key === '') {
    return '';
  }

  $rotationEnabled = filter_var(
    $config['expireAiKeyAfter30Days'] ?? false,
    FILTER_VALIDATE_BOOLEAN,
  );
  if (!$rotationEnabled) {
    return $key;
  }

  $rawExpiresAt = $config['aiKeyExpiresAt'] ?? '';
  $expiresAt = is_string($rawExpiresAt) ? trim($rawExpiresAt) : '';
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

/**
 * @param array<array-key,mixed> $config
 * @return array{sharedAvailable: bool, model: string}
 */
function voncms_ai_safe_config_projection(array $config): array
{
  return [
    'sharedAvailable' => voncms_ai_configured_key($config) !== '',
    'model' => voncms_ai_normalize_model($config['aiModel'] ?? null),
  ];
}

/** @return array{sharedAvailable: bool, model: string} */
function voncms_ai_staff_projection(PDO $pdo): array
{
  return voncms_ai_safe_config_projection(voncms_ai_load_config($pdo));
}

/**
 * @return array{api_key: string, model: string, shared: bool}|null
 */
function voncms_ai_resolve_request(PDO $pdo, mixed $requestedModel, mixed $headerKey): ?array
{
  $ownKey = is_scalar($headerKey) ? trim((string) $headerKey) : '';
  if ($ownKey !== '') {
    if (
      strlen($ownKey) > 512 ||
      str_contains($ownKey, '*') ||
      VonCmsCredentialStore::isEncrypted($ownKey)
    ) {
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
    $startedAtValue = is_array($decoded) ? $decoded['window_started_at'] ?? 0 : 0;
    $attemptsValue = is_array($decoded) ? $decoded['attempts'] ?? 0 : 0;
    $startedAt = is_numeric($startedAtValue) ? (int) $startedAtValue : 0;
    $attempts = is_numeric($attemptsValue) ? (int) $attemptsValue : 0;
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
 * @param array<array-key,mixed> $payload
 * @return array{ok: bool, http_code: int, data: array<array-key, mixed>, model: string, fallback_used: bool, error_code: string}
 */
function voncms_ai_generate_with_fallback(
  string $apiKey,
  string $model,
  array $payload,
  int $timeoutSeconds,
): array {
  if ($apiKey === '' || preg_match('/[\x00-\x20\x7f]/', $apiKey)) {
    return [
      'ok' => false,
      'http_code' => 400,
      'data' => [],
      'model' => $model,
      'fallback_used' => false,
      'error_code' => 'AI_AUTH_FAILED',
    ];
  }
  $fallbackModel = 'gemini-flash-latest';
  $models = array_values(array_unique([$model, $fallbackModel]));
  // Opt out of optional Generate Content request storage, including fallback calls.
  // Provider-required safety/abuse retention remains governed by Google's terms.
  $payload['store'] = false;
  $encodedPayload = json_encode($payload);
  if ($encodedPayload === false) {
    return [
      'ok' => false,
      'http_code' => 400,
      'data' => [],
      'model' => $model,
      'fallback_used' => false,
      'error_code' => 'AI_INVALID_REQUEST',
    ];
  }

  foreach ($models as $index => $candidateModel) {
    $url =
      'https://generativelanguage.googleapis.com/v1beta/models/' .
      rawurlencode($candidateModel) .
      ':generateContent';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $apiKey],
      CURLOPT_POSTFIELDS => $encodedPayload,
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

    $providerError = is_array($data['error'] ?? null) ? $data['error'] : [];
    $providerStatus = is_string($providerError['status'] ?? null)
      ? strtoupper($providerError['status'])
      : '';
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
