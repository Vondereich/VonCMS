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
 * Lightweight replay protection for public content view counters.
 *
 * The current PHP session is already required for CSRF validation. Keeping a
 * small, expiring map in that session avoids extra database or shared-cache
 * writes and does not collapse visitors behind the same CDN or proxy IP.
 */
class ContentViewDeduplicator
{
  private const SESSION_KEY = 'voncms_content_view_claims';

  public static function claim(
    string $contentType,
    int $contentId,
    ?int $now = null,
    int $windowSeconds = 300,
    int $maxEntries = 64,
  ): bool {
    if (!in_array($contentType, ['post', 'page'], true) || $contentId < 1) {
      return false;
    }

    $now = $now ?? time();
    $windowSeconds = max(30, min(3600, $windowSeconds));
    $maxEntries = max(8, min(256, $maxEntries));
    $storedClaims = $_SESSION[self::SESSION_KEY] ?? [];
    $claims = is_array($storedClaims) ? $storedClaims : [];
    $minimumTimestamp = $now - $windowSeconds;

    foreach ($claims as $key => $timestamp) {
      if (!is_string($key) || !is_numeric($timestamp) || (int) $timestamp <= $minimumTimestamp) {
        unset($claims[$key]);
      } else {
        $claims[$key] = (int) $timestamp;
      }
    }

    $claimKey = $contentType . ':' . $contentId;
    if (isset($claims[$claimKey])) {
      $_SESSION[self::SESSION_KEY] = $claims;
      return false;
    }

    arsort($claims, SORT_NUMERIC);
    $claims = array_slice($claims, 0, $maxEntries - 1, true);
    $claims[$claimKey] = $now;
    $_SESSION[self::SESSION_KEY] = $claims;
    return true;
  }

  /**
   * Release a claim when the underlying view update did not complete.
   *
   * This keeps a missing/draft row or transient database error from suppressing
   * a later legitimate view for the remainder of the deduplication window.
   */
  public static function release(string $contentType, int $contentId): void
  {
    if (!in_array($contentType, ['post', 'page'], true) || $contentId < 1) {
      return;
    }

    $storedClaims = $_SESSION[self::SESSION_KEY] ?? [];
    if (!is_array($storedClaims)) {
      return;
    }

    unset($storedClaims[$contentType . ':' . $contentId]);
    $_SESSION[self::SESSION_KEY] = $storedClaims;
  }
}
