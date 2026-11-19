<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

/** Plain labels only. No HTML decoding, URL rewriting or cross-article uniqueness. */
final class ContentMetadata
{
  public static function category(string $value): string
  {
    return mb_substr(trim(preg_replace('/\s+/u', ' ', $value) ?? ''), 0, 100);
  }

  /** @param array<array-key, mixed> $known */
  public static function existingCategory(string $value, array $known): ?string
  {
    $identity = mb_strtolower(self::category($value), 'UTF-8');
    foreach ($known as $candidate) {
      if (!is_string($candidate)) {
        continue;
      }
      $label = self::category($candidate);
      if ($label !== '' && mb_strtolower($label, 'UTF-8') === $identity) {
        return $label;
      }
    }
    return null;
  }

  public static function keywords(string $value): string
  {
    $seen = [];
    $keywords = [];
    foreach (explode(',', $value) as $part) {
      $label = trim(preg_replace('/\s+/u', ' ', $part) ?? '');
      if ($label === '') {
        continue;
      }
      $identity = mb_strtolower($label, 'UTF-8');
      if (isset($seen[$identity])) {
        continue;
      }
      $seen[$identity] = true;
      $keywords[] = $label;
    }
    $formatted = implode(', ', $keywords);
    // Cosmetic separator spaces must not reject an otherwise valid 255-character field.
    return mb_strlen($formatted, 'UTF-8') <= 255 ? $formatted : implode(',', $keywords);
  }
}
