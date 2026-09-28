<?php
/**
 * VonCMS - Search Query Helpers
 * Shared full-text normalization and SQL LIKE escaping for public discovery.
 */

$searchQueryHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($searchQueryHelperPath !== false && $requestedScriptPath === $searchQueryHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($searchQueryHelperPath, $requestedScriptPath);

if (!function_exists('voncms_normalize_fulltext_search')) {
  function voncms_normalize_fulltext_search(string $value): string
  {
    $text = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text);
    if (!is_string($normalized)) {
      $normalized = preg_replace('/[^a-zA-Z0-9\s]+/', ' ', $text);
    }
    $normalized = is_string($normalized)
      ? trim((string) preg_replace('/\s+/u', ' ', $normalized))
      : '';

    return $normalized;
  }
}

if (!function_exists('voncms_build_required_fulltext_search')) {
  /**
   * Build a safe Boolean FULLTEXT query where every normalized term is
   * required. The trailing wildcard preserves useful live-search behaviour
   * while a visitor is still typing a word and keeps short terms searchable.
   */
  function voncms_build_required_fulltext_search(string $value): string
  {
    $normalized = voncms_normalize_fulltext_search($value);
    if ($normalized === '') {
      return '';
    }

    $terms = preg_split('/\s+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY);
    if (!is_array($terms)) {
      $terms = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY);
    }
    if (!is_array($terms)) {
      return '';
    }

    $requiredTerms = [];
    foreach ($terms as $term) {
      $requiredTerms[] = '+' . $term . '*';
    }

    return implode(' ', array_values(array_unique($requiredTerms)));
  }
}

if (!function_exists('voncms_escape_like_search')) {
  function voncms_escape_like_search(string $value): string
  {
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
  }
}
