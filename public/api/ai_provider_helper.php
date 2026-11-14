<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

require_once __DIR__ . '/../core/CredentialStore.php';
require_once __DIR__ . '/../core/DataBoundary.php';
require_once __DIR__ . '/role_capability_helper.php';

/**
 * Shared Gemini credential, quota, and provider boundary.
 *
 * Stored API keys never leave PHP. A session-owned personal key takes priority;
 * only an absent personal record permits the legacy explicit/shared flow.
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

/** A short transaction holds this singleton through credential read/decrypt or write.
 * @return array<array-key,mixed>
 */
function voncms_ai_lock_config(PDO $pdo, bool $exclusive): array
{
  if (!$pdo->inTransaction()) {
    throw new RuntimeException('Credential transaction is required.', 503);
  }
  $lock =
    $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
      ? ''
      : ($exclusive
        ? ' FOR UPDATE'
        : ' LOCK IN SHARE MODE');
  $statement = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'api' AND setting_key = 'config' LIMIT 1" .
      $lock,
  );
  $statement->execute();
  $raw = $statement->fetchColumn();
  $config = is_string($raw) ? json_decode($raw, true) : null;
  if (!is_array($config)) {
    throw new RuntimeException('AI storage requires Database Repair before use.', 503);
  }
  return $config;
}

/** Fresh own-account eligibility, never a caller-selected target.
 * @return array<string,bool|float|int|string|null>
 */
function voncms_ai_own_account(PDO $pdo, string $userId, bool $lock = false): array
{
  if (!ctype_digit($userId) || $userId === '0') {
    throw new RuntimeException('Staff account required.', 403);
  }
  $suffix = $lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite' ? ' FOR UPDATE' : '';
  $statement = $pdo->prepare(
    'SELECT id, username, display_name, email, role, avatar, bio, created_at AS createdAt FROM users WHERE id = ? LIMIT 1' .
      $suffix,
  );
  $statement->execute([$userId]);
  $user = DataBoundary::row($statement->fetch(PDO::FETCH_ASSOC));
  if (!$user || !voncms_role_has_capability($user['role'] ?? null, 'posts.create')) {
    throw new RuntimeException('Staff account required.', 403);
  }
  $user['id'] = (string) $user['id'];
  return $user;
}

function voncms_ai_personal_context(string $userId): string
{
  return 'voncms:personal-gemini:v1:user:' . $userId;
}

/** @return array<string,bool|float|int|string|null>|false */
function voncms_ai_personal_row(PDO $pdo, string $userId, bool $lock = false): array|false
{
  $suffix = $lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite' ? ' FOR UPDATE' : '';
  $statement = $pdo->prepare(
    "SELECT encrypted_key, saved_at, expires_at FROM user_ai_keys WHERE user_id = ? AND provider = 'gemini' LIMIT 1" .
      $suffix,
  );
  $statement->execute([$userId]);
  return DataBoundary::row($statement->fetch(PDO::FETCH_ASSOC));
}

/** @param array<string,bool|float|int|string|null> $row */
function voncms_ai_personal_plaintext(array $row, string $userId): string
{
  $expires = $row['expires_at'] ?? null;
  if ($expires !== null) {
    $date = is_string($expires)
      ? DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $expires, new DateTimeZone('UTC'))
      : false;
    if ($date === false || $date->format('Y-m-d H:i:s') !== $expires) {
      throw new RuntimeException(
        'Your personal AI key expiry is invalid. Replace or remove it in User Manager.',
        503,
      );
    }
  }
  if (is_string($expires) && $expires <= gmdate('Y-m-d H:i:s')) {
    throw new RuntimeException(
      'Your personal AI key expired. Replace or remove it in User Manager.',
      400,
    );
  }
  $stored = $row['encrypted_key'] ?? null;
  if (!is_string($stored) || !VonCmsCredentialStore::isEncrypted($stored)) {
    throw new RuntimeException(
      'Your personal AI key is unavailable. Replace or remove it in User Manager.',
      503,
    );
  }
  $key = VonCmsCredentialStore::decrypt($stored, voncms_ai_personal_context($userId));
  if ($key === '' || strlen($key) > 512 || preg_match('/[\x00-\x20\x7f*]/', $key)) {
    throw new RuntimeException(
      'Your personal AI key is unavailable. Replace or remove it in User Manager.',
      503,
    );
  }
  return $key;
}

/** @param array<string,bool|float|int|string|null>|false $row
 * @return array{configured:bool,mask:string,state:string,revision:string,savedAt:string,expiresAt:string}
 */
function voncms_ai_personal_projection(array|false $row, string $userId): array
{
  $state = 'empty';
  if ($row !== false) {
    try {
      voncms_ai_personal_plaintext($row, $userId);
      $state = 'encrypted';
    } catch (Throwable $e) {
      $state = $e->getCode() === 400 ? 'expired' : 'unavailable';
    }
  }
  return [
    'configured' => $row !== false,
    'mask' => $row === false ? '' : '********',
    'state' => $state,
    'revision' => $row === false ? '' : hash('sha256', (string) ($row['encrypted_key'] ?? '')),
    'savedAt' => $row === false ? '' : (string) ($row['saved_at'] ?? ''),
    'expiresAt' => $row === false ? '' : (string) ($row['expires_at'] ?? ''),
  ];
}

/** Installation creation is allowed only if no existing encrypted record needs the old master.
 * Caller holds the exclusive configuration anchor.
 * @param array<array-key,mixed> $config
 */
function voncms_ai_can_create_master(PDO $pdo, array $config): bool
{
  $global = $config['aiApiKey'] ?? '';
  if (is_string($global) && VonCmsCredentialStore::isEncrypted($global)) {
    return false;
  }
  $statement = $pdo->query('SELECT 1 FROM user_ai_keys LIMIT 1');
  if ($statement === false) {
    throw new RuntimeException('AI credential storage is unavailable.', 503);
  }
  return $statement->fetchColumn() === false;
}

/** @return array{configured:bool,mask:string,state:string,revision:string,savedAt:string,expiresAt:string} */
function voncms_ai_save_personal(
  PDO $pdo,
  string $userId,
  string $action,
  string $key,
  string $revision,
  bool $expire,
): array {
  if ($pdo->inTransaction()) {
    throw new RuntimeException('Separate credential action required.', 409);
  }
  if (
    $action === 'save' &&
    ($key === '' ||
      strlen($key) > 512 ||
      preg_match('/[\x00-\x20\x7f*]/', $key) ||
      VonCmsCredentialStore::isEncrypted($key))
  ) {
    throw new InvalidArgumentException(
      'Enter a valid plaintext Gemini API key, not a mask or ciphertext.',
    );
  }
  try {
    $pdo->beginTransaction();
    $config = voncms_ai_lock_config($pdo, true);
    voncms_ai_own_account($pdo, $userId, true);
    $existing = voncms_ai_personal_row($pdo, $userId, true);
    $currentRevision =
      $existing === false ? '' : hash('sha256', (string) $existing['encrypted_key']);
    if (!hash_equals($currentRevision, $revision)) {
      throw new RuntimeException('Your saved key changed. Reload before trying again.', 409);
    }
    if ($action === 'remove') {
      $pdo
        ->prepare("DELETE FROM user_ai_keys WHERE user_id = ? AND provider = 'gemini'")
        ->execute([$userId]);
      $projection = voncms_ai_personal_projection(false, $userId);
    } elseif ($action === 'save') {
      $stored = VonCmsCredentialStore::encrypt(
        $key,
        voncms_ai_personal_context($userId),
        voncms_ai_can_create_master($pdo, $config),
      );
      $savedAt = gmdate('Y-m-d H:i:s');
      $expiresAt = $expire ? gmdate('Y-m-d H:i:s', time() + 30 * 86400) : null;
      if ($existing === false) {
        $pdo
          ->prepare(
            "INSERT INTO user_ai_keys(user_id, provider, encrypted_key, saved_at, expires_at) VALUES (?, 'gemini', ?, ?, ?)",
          )
          ->execute([$userId, $stored, $savedAt, $expiresAt]);
      } else {
        $pdo
          ->prepare(
            "UPDATE user_ai_keys SET encrypted_key = ?, saved_at = ?, expires_at = ? WHERE user_id = ? AND provider = 'gemini'",
          )
          ->execute([$stored, $savedAt, $expiresAt, $userId]);
      }
      $projection = voncms_ai_personal_projection(
        ['encrypted_key' => $stored, 'saved_at' => $savedAt, 'expires_at' => $expiresAt],
        $userId,
      );
    } else {
      throw new InvalidArgumentException('Unknown credential action.');
    }
    if (!$pdo->commit()) {
      throw new RuntimeException('Credential save could not be confirmed.', 503);
    }
    return $projection;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
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
function voncms_ai_prepare_stored_config(
  array $incoming,
  array $existing,
  bool $createMasterIfMissing = false,
): array {
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
      $createMasterIfMissing,
    );
  } elseif ($stored !== '') {
    $result['aiApiKey'] = VonCmsCredentialStore::isEncrypted($stored)
      ? $stored
      : VonCmsCredentialStore::encrypt($stored, 'voncms:global-gemini:v1', $createMasterIfMissing);
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

/** Rotate every persisted record sharing the installation master, including inactive accounts. */
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
    $config = voncms_ai_lock_config($pdo, true);
    $stored = $config['aiApiKey'] ?? null;
    if (
      !is_string($stored) ||
      !VonCmsCredentialStore::isEncrypted($stored) ||
      !hash_equals(hash('sha256', $stored), $expectedRevision)
    ) {
      throw new RuntimeException('The saved key changed. Reload Settings before rotating.', 409);
    }
    $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ' FOR UPDATE';
    $personalStatement = $pdo->query(
      'SELECT id, user_id, provider, encrypted_key FROM user_ai_keys ORDER BY id' . $lock,
    );
    if ($personalStatement === false) {
      throw new RuntimeException('Personal credential storage is unavailable.', 503);
    }
    $personalRows = DataBoundary::rows($personalStatement->fetchAll(PDO::FETCH_ASSOC));
    $records = ['global' => ['stored' => $stored, 'context' => 'voncms:global-gemini:v1']];
    foreach ($personalRows as $row) {
      if ($row['provider'] !== 'gemini') {
        throw new RuntimeException('Unsupported stored credential provider.', 503);
      }
      $records['personal:' . $row['id']] = [
        'stored' => (string) $row['encrypted_key'],
        'context' => voncms_ai_personal_context((string) $row['user_id']),
      ];
    }
    $projection = [];
    VonCmsCredentialStore::rotateSecrets($records, static function (array $ciphertexts) use (
      $pdo,
      &$config,
      $userId,
      $personalRows,
      &$projection,
    ): void {
      $config['aiApiKey'] = $ciphertexts['global'];
      $config['aiKeyRotatedAt'] = gmdate('c');
      $update = $pdo->prepare(
        "UPDATE settings SET setting_value = ?, is_public = 0, updated_by = ?, version = version + 1, updated_at = NOW() WHERE setting_group = 'api' AND setting_key = 'config'",
      );
      $update->execute([json_encode($config, JSON_THROW_ON_ERROR), $userId]);
      if ($update->rowCount() !== 1) {
        throw new RuntimeException('Shared credential rotation failed.');
      }
      $personalUpdate = $pdo->prepare(
        "UPDATE user_ai_keys SET encrypted_key = ? WHERE id = ? AND user_id = ? AND provider = 'gemini'",
      );
      foreach ($personalRows as $row) {
        $personalUpdate->execute([
          $ciphertexts['personal:' . $row['id']],
          $row['id'],
          $row['user_id'],
        ]);
        if ($personalUpdate->rowCount() !== 1) {
          throw new RuntimeException('Personal credential rotation failed.');
        }
      }
      $projection = voncms_ai_credential_status($config);
      if (!$pdo->commit()) {
        throw new RuntimeException('Encryption key rotation could not be committed.');
      }
    });
    return $projection;
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
function voncms_ai_resolve_request(
  PDO $pdo,
  mixed $requestedModel,
  mixed $headerKey,
  string $userId,
): ?array {
  if ($pdo->inTransaction()) {
    throw new RuntimeException('Separate AI request required.', 503);
  }
  try {
    $pdo->beginTransaction();
    $config = voncms_ai_lock_config($pdo, false);
    voncms_ai_own_account($pdo, $userId);
    $personal = voncms_ai_personal_row($pdo, $userId);
    if ($personal !== false) {
      $result = [
        'api_key' => voncms_ai_personal_plaintext($personal, $userId),
        'model' => voncms_ai_normalize_model($requestedModel),
        'shared' => false,
      ];
      $pdo->commit();
      return $result;
    }
    $ownKey = is_scalar($headerKey) ? trim((string) $headerKey) : '';
    if ($ownKey !== '') {
      if (
        strlen($ownKey) > 512 ||
        str_contains($ownKey, '*') ||
        VonCmsCredentialStore::isEncrypted($ownKey)
      ) {
        $pdo->commit();
        return null;
      }
      $pdo->commit();
      return [
        'api_key' => $ownKey,
        'model' => voncms_ai_normalize_model($requestedModel),
        'shared' => false,
      ];
    }

    $sharedKey = voncms_ai_configured_key($config);
    $pdo->commit();
    if ($sharedKey === '') {
      return null;
    }

    return [
      'api_key' => $sharedKey,
      'model' => voncms_ai_normalize_model($config['aiModel'] ?? null),
      'shared' => true,
    ];
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
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
