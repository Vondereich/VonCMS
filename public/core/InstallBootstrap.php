<?php

// Internal module only; even a server without rewrite rules must refuse direct requests.
if (
  !defined('VONCMS_CORE_LOADED') ||
  (isset($_SERVER['SCRIPT_FILENAME']) &&
    realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  echo 'Forbidden';
  exit();
}

/**
 * First-run installer ownership proof.
 *
 * The key is generated on the server, stored below the protected data directory,
 * and removed after installation succeeds. A path override exists only for
 * isolated regression tests.
 */
class InstallBootstrap
{
  /** @var resource|null $claimHandle */
  private static $claimHandle = null;

  private static function keyPath(): string
  {
    if (defined('VONCMS_INSTALL_SETUP_KEY_PATH')) {
      return (string) constant('VONCMS_INSTALL_SETUP_KEY_PATH');
    }

    return dirname(__DIR__) . '/data/install_setup.key';
  }

  private static function readKey(): string
  {
    $path = self::keyPath();
    if (!is_file($path)) {
      return '';
    }

    $value = @file_get_contents($path);
    $key = is_string($value) ? strtolower(trim($value)) : '';
    return preg_match('/^[a-f0-9]{64}$/', $key) === 1 ? $key : '';
  }

  public static function ensureKey(): bool
  {
    if (self::readKey() !== '') {
      return true;
    }

    $path = self::keyPath();
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
      return false;
    }

    $handle = @fopen($path, 'x');
    if ($handle === false) {
      return self::readKey() !== '';
    }

    $key = bin2hex(random_bytes(32));
    $written = @fwrite($handle, $key . "\n");
    $flushed = $written === 65 && @fflush($handle);
    @fclose($handle);
    if (!$flushed) {
      @unlink($path);
      return false;
    }

    @chmod($path, 0600);
    return true;
  }

  public static function validate(string $candidate): bool
  {
    $expected = self::readKey();
    $candidate = strtolower(trim($candidate));
    return $expected !== '' &&
      preg_match('/^[a-f0-9]{64}$/', $candidate) === 1 &&
      hash_equals($expected, $candidate);
  }

  /**
   * Reserve the one-time setup key for the lifetime of this request.
   *
   * A non-blocking exclusive lock prevents two requests that know the same
   * valid key from both entering the installer before either can create the
   * configuration or install lock.
   */
  public static function claim(string $candidate): bool
  {
    if (is_resource(self::$claimHandle)) {
      return false;
    }

    $candidate = strtolower(trim($candidate));
    if (preg_match('/^[a-f0-9]{64}$/', $candidate) !== 1) {
      return false;
    }

    $handle = @fopen(self::keyPath(), 'r+');
    if ($handle === false) {
      return false;
    }

    if (!@flock($handle, LOCK_EX | LOCK_NB)) {
      @fclose($handle);
      return false;
    }

    @rewind($handle);
    $value = stream_get_contents($handle);
    $expected = is_string($value) ? strtolower(trim($value)) : '';
    if (preg_match('/^[a-f0-9]{64}$/', $expected) !== 1 || !hash_equals($expected, $candidate)) {
      @flock($handle, LOCK_UN);
      @fclose($handle);
      return false;
    }

    self::$claimHandle = $handle;
    return true;
  }

  public static function consume(): void
  {
    $path = self::keyPath();

    if (is_resource(self::$claimHandle)) {
      @ftruncate(self::$claimHandle, 0);
      @fflush(self::$claimHandle);
      @flock(self::$claimHandle, LOCK_UN);
      @fclose(self::$claimHandle);
      self::$claimHandle = null;
    }

    if (is_file($path) && !@unlink($path)) {
      error_log('VonCMS Installer: setup key could not be removed after installation.');
    }
  }
}
