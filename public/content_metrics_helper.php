<?php

/**
 * Return the character count used by VonCMS read-time estimates.
 *
 * List queries use MySQL CHAR_LENGTH(content) to avoid transferring full article
 * bodies. Runtime callers mirror that character-based contract with mb_strlen.
 */
$contentMetricsHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($contentMetricsHelperPath !== false && $requestedScriptPath === $contentMetricsHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($contentMetricsHelperPath, $requestedScriptPath);

function voncms_content_character_count(string $content): int
{
  if (function_exists('mb_strlen')) {
    return mb_strlen($content, 'UTF-8');
  }

  return strlen($content);
}

function voncms_format_read_time(int $characterCount): string
{
  $minutes = max(1, (int) ceil(max(0, $characterCount) / 1000));
  return $minutes . ' min read';
}

function voncms_calculate_read_time(string $content): string
{
  return voncms_format_read_time(voncms_content_character_count($content));
}
