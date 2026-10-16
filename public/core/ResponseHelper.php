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
 * Helper class for standard JSON responses
 */
class ResponseHelper
{
  /**
   * Send Error Response (Secure)
   *
   * @param Throwable|string|scalar|null $e The throwable object or error message
   * @param int $statusCode HTTP Status code (default 500)
   * @return void
   */
  public static function sendError($e, $statusCode = 500)
  {
    // Ensure headers are sent
    sendApiHeaders();

    // Clear any previous output buffering
    if (ob_get_length()) {
      ob_clean();
    }

    http_response_code($statusCode);

    if ($e instanceof Throwable) {
      $message = $e->getMessage();
    } elseif (is_scalar($e) || $e === null) {
      $message = (string) ($e ?? '');
    } else {
      $message = 'Unexpected error';
    }

    $message = trim($message);
    if ($message === '') {
      $message = 'Unexpected error';
    }

    $encodedMessage = json_encode($message, JSON_INVALID_UTF8_SUBSTITUTE);
    if (is_string($encodedMessage)) {
      $decodedMessage = json_decode($encodedMessage, true);
      if (is_string($decodedMessage)) {
        $message = $decodedMessage;
      }
    }

    if (strlen($message) > 2000) {
      $message = function_exists('mb_strcut')
        ? mb_strcut($message, 0, 2000, 'UTF-8')
        : substr($message, 0, 2000);
    }

    $isAdmin = SessionManager::isAdmin();
    $debugEnabled = defined('VONCMS_DEBUG') && constant('VONCMS_DEBUG') === true;

    // Log the full error internally
    error_log('VonCMS API Error: ' . $message);

    if ($isAdmin || ($statusCode >= 400 && $statusCode < 500)) {
      // Admins or validation errors (4xx) see the actual message
      echo json_encode(
        [
          'success' => false,
          'error' => $message,
          'debug_trace' =>
            $isAdmin && $debugEnabled && $e instanceof Throwable ? $e->getTraceAsString() : null,
        ],
        JSON_INVALID_UTF8_SUBSTITUTE,
      );
    } else {
      // Public users see generic message for 5xx to prevent info disclosure
      echo json_encode(
        [
          'success' => false,
          'error' => 'An internal server error occurred. Please contact support.',
          'code' => 'INTERNAL_ERROR',
        ],
        JSON_INVALID_UTF8_SUBSTITUTE,
      );
    }
    exit();
  }

  /**
   * Automatically upgrades http:// to https:// for internal assets
   * to prevent Mixed Content warnings.
   *
   * @param string|null $url The URL to scrub
   * @return string|null
   */
  public static function scrubUrl($url)
  {
    if (empty($url) || !is_string($url)) {
      return $url;
    }

    // Only upgrade if we are on HTTPS
    if (is_https() && strpos($url, 'http://') === 0) {
      return 'https://' . substr($url, 7);
    }

    return $url;
  }

  /**
   * Scrub user/avatar URLs more strictly than normal content assets.
   * External avatars must be HTTPS; relative local upload paths remain allowed.
   *
   * @param string|null $url
   * @return string
   */
  public static function scrubAvatarUrl($url)
  {
    if (empty($url) || !is_string($url)) {
      return '';
    }

    $url = trim($url);
    if ($url === '' || preg_match('/^(javascript|data):/i', $url)) {
      return '';
    }

    if (preg_match('/^https:\/\//i', $url)) {
      return self::scrubUrl($url) ?: '';
    }

    if (strpos($url, '/') === 0 && strpos($url, '//') !== 0) {
      return self::scrubUrl($url) ?: '';
    }

    if (preg_match('/^(?:\.\.\/)?(?:public\/)?uploads\//i', $url)) {
      return self::scrubUrl($url) ?: '';
    }

    return '';
  }

  /**
   * Shape post/page payloads so public callers never receive internal author IDs.
   * The published status field is intentionally preserved because public themes use it.
   *
   * @param array<string, mixed> $payload
   * @param bool $isAdmin
   * @return array<string, mixed>
   */
  public static function shapeContentPayload($payload, $isAdmin)
  {
    if (!$isAdmin) {
      unset($payload['author_id']);
    }

    return $payload;
  }

  /**
   * Shape comment payloads consistently for public, staff, and primary-admin callers.
   *
   * @param array<string, mixed> $payload
   * @param bool $isStaff
   * @param bool $isPrimaryAdmin
   * @return array<string, mixed>
   */
  public static function shapeCommentPayload($payload, $isStaff, $isPrimaryAdmin)
  {
    if (!$isStaff) {
      unset($payload['dbId'], $payload['userId'], $payload['status'], $payload['emailHash']);
      return $payload;
    }

    if (!$isPrimaryAdmin) {
      $hasEmailHash = isset($payload['emailHash']) && trim((string) $payload['emailHash']) !== '';
      unset($payload['emailHash']);
      if ($hasEmailHash) {
        $payload['hasEmail'] = true;
      }
    }

    return $payload;
  }
}
