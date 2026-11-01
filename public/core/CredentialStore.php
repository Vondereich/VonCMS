<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

/**
 * Installation-owned authenticated encryption; never a database or browser key store.
 * @phpstan-type KeyMaterial array{format: 1|2, active: string, legacy: string|null, keys: array<string, string>}
 */
final class VonCmsCredentialStore
{
  private const PREFIX = 'voncms:secret:v1:';
  private const PREFIX_V2 = 'voncms:secret:v2:';
  private const FAMILY = 'voncms:secret:';
  private const KEY_HEADER = "<?php http_response_code(403); exit; ?>\nVONCMS_CREDENTIAL_KEY_V1\n";
  private const KEY_HEADER_V2 = "<?php http_response_code(403); exit; ?>\nVONCMS_CREDENTIAL_KEY_V2\n";
  private const MAX_SECRET_BYTES = 8192;

  public static function isEncrypted(string $value): bool
  {
    return str_starts_with($value, self::FAMILY);
  }

  private static function keyPath(): string
  {
    $path = defined('VONCMS_CREDENTIAL_KEY_FILE')
      ? constant('VONCMS_CREDENTIAL_KEY_FILE')
      : __DIR__ . '/../data/credential_master.key.php';
    if (!is_string($path) || $path === '' || str_contains($path, "\0")) {
      throw new RuntimeException('Credential encryption storage is unavailable.');
    }
    if (!preg_match('~^(?:[A-Za-z]:[/\\\\]|/)~', $path) || str_contains($path, '://')) {
      throw new RuntimeException('Credential encryption storage must be a local absolute path.');
    }
    if (strtolower(basename($path)) !== 'credential_master.key.php') {
      throw new RuntimeException(
        'Use the protected credential_master.key.php filename for private key storage.',
      );
    }
    return $path;
  }

  private static function requireCipher(): void
  {
    if (
      !function_exists('openssl_encrypt') ||
      !function_exists('openssl_decrypt') ||
      !function_exists('openssl_get_cipher_methods') ||
      !in_array('aes-256-gcm', openssl_get_cipher_methods(), true)
    ) {
      throw new RuntimeException('Credential encryption requires PHP OpenSSL with AES-256-GCM.');
    }
  }

  /**
   * Read never creates or replaces a missing, corrupt or inaccessible master key.
   * @return KeyMaterial
   */
  private static function masterMaterial(bool $createIfMissing): array
  {
    $path = self::keyPath();
    $directory = dirname($path);
    $configuredPath = defined('VONCMS_CREDENTIAL_KEY_FILE');
    if (is_link($path) && !$configuredPath) {
      throw new RuntimeException('Credential encryption key storage is invalid.');
    }
    if (file_exists($path) && !is_file($path)) {
      throw new RuntimeException('Credential encryption key must be a private regular file.');
    }
    if (!is_file($path) && !$createIfMissing) {
      throw new RuntimeException(
        'Credential encryption key is missing. Restore its private backup.',
      );
    }
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
      throw new RuntimeException('Credential encryption key storage is not writable.');
    }

    $created = false;
    $complete = false;
    $handle = false;
    if ($createIfMissing && !file_exists($path)) {
      $previousUmask = umask(0077);
      try {
        $handle = @fopen($path, 'x+b');
      } finally {
        umask($previousUmask);
      }
      $created = is_resource($handle);
    }
    if ($handle === false) {
      $handle = @fopen($path, 'rb');
    }
    if ($handle === false) {
      throw new RuntimeException('Credential encryption key storage is unavailable.');
    }
    $identity = fstat($handle);
    try {
      if (
        !is_array($identity) ||
        ($identity['mode'] & 0170000) !== 0100000 ||
        (DIRECTORY_SEPARATOR !== '\\' && !$configuredPath && ($identity['mode'] & 0077) !== 0)
      ) {
        throw new RuntimeException(
          'Credential encryption key requires private regular-file permissions.',
        );
      }
      if ((is_link($path) && !$configuredPath) || !flock($handle, $created ? LOCK_EX : LOCK_SH)) {
        throw new RuntimeException('Credential encryption key storage could not be locked.');
      }
      if ($created) {
        if (!@chmod($path, 0600)) {
          throw new RuntimeException(
            'Credential encryption key permissions could not be protected.',
          );
        }
        $key = random_bytes(32);
        $contents = self::KEY_HEADER . bin2hex($key) . "\n";
        $offset = 0;
        while ($offset < strlen($contents)) {
          $written = fwrite($handle, substr($contents, $offset));
          if ($written === false || $written === 0) {
            throw new RuntimeException(
              'Credential encryption key could not be written completely.',
            );
          }
          $offset += $written;
        }
        if (!fflush($handle)) {
          throw new RuntimeException('Credential encryption key could not be flushed.');
        }
        $complete = true;
        return self::singleKeyMaterial($key);
      }

      $contents = stream_get_contents($handle, 4096);
      // A concurrent first writer may have published the empty file before taking its lock.
      for ($retry = 0; $contents === '' && $createIfMissing && $retry < 10; $retry++) {
        flock($handle, LOCK_UN);
        usleep(5000);
        if (!flock($handle, LOCK_SH) || !rewind($handle)) {
          throw new RuntimeException('Credential encryption key storage could not be read.');
        }
        $contents = stream_get_contents($handle, 4096);
      }
      if (is_string($contents) && str_starts_with($contents, self::KEY_HEADER_V2)) {
        $material = self::parseKeyRing(substr($contents, strlen(self::KEY_HEADER_V2)));
        $complete = true;
        return $material;
      }
      $expectedLength = strlen(self::KEY_HEADER) + 65;
      if (
        !is_string($contents) ||
        strlen($contents) !== $expectedLength ||
        !str_starts_with($contents, self::KEY_HEADER) ||
        preg_match('/^[a-f0-9]{64}\n$/D', substr($contents, strlen(self::KEY_HEADER))) !== 1
      ) {
        throw new RuntimeException(
          'Credential encryption key is invalid. Restore its private backup.',
        );
      }
      $key = hex2bin(substr($contents, strlen(self::KEY_HEADER), 64));
      if ($key === false || strlen($key) !== 32) {
        throw new RuntimeException('Credential encryption key is invalid.');
      }
      $complete = true;
      return self::singleKeyMaterial($key);
    } finally {
      flock($handle, LOCK_UN);
      fclose($handle);
      // Only remove our own incomplete creation; never replace an existing key.
      if ($created && !$complete && !is_link($path)) {
        $current = @lstat($path);
        if (
          is_array($identity) &&
          is_array($current) &&
          $identity['ino'] === $current['ino'] &&
          $identity['dev'] === $current['dev']
        ) {
          @unlink($path);
        }
      }
    }
  }

  private static function keyId(#[\SensitiveParameter] string $key): string
  {
    return substr(hash('sha256', $key), 0, 32);
  }

  /** @return KeyMaterial */
  private static function singleKeyMaterial(#[\SensitiveParameter] string $key): array
  {
    $id = self::keyId($key);
    return ['format' => 1, 'active' => $id, 'legacy' => $id, 'keys' => [$id => $key]];
  }

  /** @return KeyMaterial */
  private static function parseKeyRing(#[\SensitiveParameter] string $json): array
  {
    $ring = json_decode($json, true);
    if (
      !is_array($ring) ||
      !is_string($ring['active'] ?? null) ||
      !is_array($ring['keys'] ?? null) ||
      count($ring['keys']) < 1 ||
      count($ring['keys']) > 3
    ) {
      throw new RuntimeException('Credential encryption key ring is invalid.');
    }
    $keys = [];
    foreach ($ring['keys'] as $id => $hex) {
      if (
        !is_string($id) ||
        preg_match('/^[a-f0-9]{32}$/D', $id) !== 1 ||
        !is_string($hex) ||
        preg_match('/^[a-f0-9]{64}$/D', $hex) !== 1
      ) {
        throw new RuntimeException('Credential encryption key ring is invalid.');
      }
      $key = hex2bin($hex);
      if ($key === false || !hash_equals(self::keyId($key), $id)) {
        throw new RuntimeException('Credential encryption key ring is invalid.');
      }
      $keys[$id] = $key;
    }
    $legacy = $ring['legacy'] ?? null;
    if (
      !isset($keys[$ring['active']]) ||
      ($legacy !== null && (!is_string($legacy) || !isset($keys[$legacy])))
    ) {
      throw new RuntimeException('Credential encryption key ring is invalid.');
    }
    return ['format' => 2, 'active' => $ring['active'], 'legacy' => $legacy, 'keys' => $keys];
  }

  /** Availability hint only; replacement still validates permissions and performs real I/O. */
  public static function canRotate(): bool
  {
    try {
      $path = self::keyPath();
      return !is_link($path) &&
        is_file($path) &&
        is_writable($path) &&
        (PHP_OS_FAMILY === 'Windows' || is_writable(dirname($path)));
    } catch (Throwable $e) {
      return false;
    }
  }

  /** @param KeyMaterial $material */
  private static function writeKeyRing(#[\SensitiveParameter] array $material): void
  {
    $path = self::keyPath();
    if (!self::canRotate()) {
      throw new RuntimeException('Private encryption key storage cannot be rotated.');
    }
    $ring = ['active' => $material['active'], 'legacy' => $material['legacy'], 'keys' => []];
    foreach ($material['keys'] as $id => $key) {
      $ring['keys'][$id] = bin2hex($key);
    }
    $contents =
      self::KEY_HEADER_V2 . json_encode($ring, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
    $temporary = $path . '.tmp.' . bin2hex(random_bytes(8)) . '.php';
    $previousUmask = umask(0077);
    try {
      $handle = @fopen($temporary, 'x+b');
    } finally {
      umask($previousUmask);
    }
    if ($handle === false) {
      throw new RuntimeException('Private encryption key staging is unavailable.');
    }
    try {
      if (!@chmod($temporary, 0600)) {
        throw new RuntimeException('Private encryption key permissions could not be protected.');
      }
      $offset = 0;
      while ($offset < strlen($contents)) {
        $written = fwrite($handle, substr($contents, $offset));
        if ($written === false || $written === 0) {
          throw new RuntimeException('Private encryption key staging failed.');
        }
        $offset += $written;
      }
      if (!fflush($handle) || (function_exists('fsync') && !fsync($handle))) {
        throw new RuntimeException('Private encryption key staging could not be flushed.');
      }
      fclose($handle);
      $handle = false;
      if (is_link($path) || !@rename($temporary, $path)) {
        throw new RuntimeException('Private encryption key replacement failed.');
      }
    } finally {
      if (is_resource($handle)) {
        fclose($handle);
      }
      if (is_file($temporary) && !is_link($temporary)) {
        @unlink($temporary);
      }
    }
  }

  /**
   * Rotate the current single global credential. The caller must hold its database row lock
   * until $persist commits. Before adding other stored credentials, extend this coordinator
   * to re-encrypt every record sharing the installation key.
   *
   * Both old and new keys are published before the database change. They remain usable even
   * after process termination, rollback or an uncertain commit; never restore an old-only file.
   */
  public static function rotateSecret(
    #[\SensitiveParameter] string $stored,
    string $context,
    callable $persist,
  ): void {
    self::requireCipher();
    if (!self::canRotate()) {
      throw new RuntimeException('Private encryption key storage cannot be rotated.');
    }
    $lockPath = self::keyPath() . '.rotate.lock';
    if (is_link($lockPath)) {
      throw new RuntimeException('Private encryption key lock is invalid.');
    }
    $previousUmask = umask(0077);
    try {
      $lock = @fopen($lockPath, 'c+b');
    } finally {
      umask($previousUmask);
    }
    if ($lock === false) {
      throw new RuntimeException('Private encryption key lock is unavailable.');
    }
    try {
      $identity = fstat($lock);
      if (
        !is_array($identity) ||
        ($identity['mode'] & 0170000) !== 0100000 ||
        !@chmod($lockPath, 0600)
      ) {
        throw new RuntimeException('Private encryption key lock is invalid.');
      }
      if (!flock($lock, LOCK_EX | LOCK_NB)) {
        throw new RuntimeException('Another encryption key rotation is in progress.', 409);
      }
      $material = self::masterMaterial(false);
      $plaintext = self::decrypt($stored, $context);
      $used = str_starts_with($stored, self::PREFIX_V2)
        ? bin2hex(
          substr((string) base64_decode(substr($stored, strlen(self::PREFIX_V2)), true), 0, 16),
        )
        : $material['legacy'];
      if (!is_string($used) || !isset($material['keys'][$used])) {
        throw new RuntimeException('Stored credential key is unavailable.');
      }
      $newKey = random_bytes(32);
      $newId = self::keyId($newKey);
      $keys = [
        $newId => $newKey,
        $used => $material['keys'][$used],
        $material['active'] => $material['keys'][$material['active']],
      ];
      $next = [
        'format' => 2,
        'active' => $newId,
        'legacy' => isset($keys[$material['legacy'] ?? '']) ? $material['legacy'] : null,
        'keys' => $keys,
      ];
      $ciphertext = self::encryptWithMaterial($plaintext, $context, $next);
      self::writeKeyRing($next);
      $persist($ciphertext);
    } finally {
      flock($lock, LOCK_UN);
      fclose($lock);
    }
  }

  public static function encrypt(
    #[\SensitiveParameter] string $plaintext,
    string $context,
    bool $createMasterIfMissing = false,
  ): string {
    self::requireCipher();
    if ($plaintext === '' || strlen($plaintext) > self::MAX_SECRET_BYTES || $context === '') {
      throw new InvalidArgumentException('Invalid credential encryption input.');
    }
    return self::encryptWithMaterial(
      $plaintext,
      $context,
      self::masterMaterial($createMasterIfMissing),
    );
  }

  /** @param KeyMaterial $material */
  private static function encryptWithMaterial(
    #[\SensitiveParameter] string $plaintext,
    string $context,
    #[\SensitiveParameter] array $material,
  ): string {
    $key = $material['keys'][$material['active']];
    $nonce = random_bytes(12);
    $tag = '';
    $encrypted = openssl_encrypt(
      $plaintext,
      'aes-256-gcm',
      $key,
      OPENSSL_RAW_DATA,
      $nonce,
      $tag,
      $context,
      16,
    );
    if ($encrypted === false || strlen($tag) !== 16) {
      throw new RuntimeException('Credential encryption failed.');
    }
    return $material['format'] === 1
      ? self::PREFIX . base64_encode($nonce . $tag . $encrypted)
      : self::PREFIX_V2 . base64_encode(hex2bin($material['active']) . $nonce . $tag . $encrypted);
  }

  public static function decrypt(#[\SensitiveParameter] string $stored, string $context): string
  {
    self::requireCipher();
    $isV2 = str_starts_with($stored, self::PREFIX_V2);
    if (
      (!$isV2 && !str_starts_with($stored, self::PREFIX)) ||
      strlen($stored) > 11200 ||
      $context === ''
    ) {
      throw new RuntimeException('Stored credential format is invalid.');
    }
    $encoded = substr($stored, strlen($isV2 ? self::PREFIX_V2 : self::PREFIX));
    $payload = base64_decode($encoded, true);
    if (
      $payload === false ||
      base64_encode($payload) !== $encoded ||
      strlen($payload) < ($isV2 ? 45 : 29) ||
      strlen($payload) > self::MAX_SECRET_BYTES + ($isV2 ? 44 : 28)
    ) {
      throw new RuntimeException('Stored credential format is invalid.');
    }
    $material = self::masterMaterial(false);
    $id = $isV2 ? bin2hex(substr($payload, 0, 16)) : $material['legacy'];
    if (!is_string($id) || !isset($material['keys'][$id])) {
      throw new RuntimeException('Stored credential key is unavailable.');
    }
    if ($isV2) {
      $payload = substr($payload, 16);
    }
    $plaintext = openssl_decrypt(
      substr($payload, 28),
      'aes-256-gcm',
      $material['keys'][$id],
      OPENSSL_RAW_DATA,
      substr($payload, 0, 12),
      substr($payload, 12, 16),
      $context,
    );
    if ($plaintext === false || $plaintext === '') {
      throw new RuntimeException(
        'Stored credential could not be authenticated. Restore the matching private key backup.',
      );
    }
    return $plaintext;
  }
}
