<?php
/**
 * VonCMS - SEO Schema Helpers
 * Shared text, schema type, and language normalization for public SSR.
 */

$seoSchemaHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($seoSchemaHelperPath !== false && $requestedScriptPath === $seoSchemaHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($seoSchemaHelperPath, $requestedScriptPath);

require_once __DIR__ . '/seo_route_helper.php';

if (!function_exists('voncms_truncate_word_safe')) {
  /**
   * @param mixed $value
   * @param int $maxLength
   * @param string $suffix
   * @return string
   */
  function voncms_truncate_word_safe($value, $maxLength, $suffix = '...'): string
  {
    $text = trim((string) preg_replace('/\s+/u', ' ', (string) $value));
    $maxLength = max(0, (int) $maxLength);
    if ($text === '' || $maxLength === 0) {
      return '';
    }
    if (mb_strlen($text) <= $maxLength) {
      return $text;
    }

    $safeSuffix = mb_substr((string) $suffix, 0, $maxLength);
    $contentLimit = max(0, $maxLength - mb_strlen($safeSuffix));
    if ($contentLimit === 0) {
      return $safeSuffix;
    }

    $truncated = rtrim(mb_substr($text, 0, $contentLimit));
    $nextCharacter = mb_substr($text, $contentLimit, 1);
    if ($nextCharacter !== '' && !preg_match('/\s/u', $nextCharacter)) {
      $lastSpace = mb_strrpos($truncated, ' ');
      if ($lastSpace !== false && $lastSpace > 0) {
        $truncated = rtrim(mb_substr($truncated, 0, $lastSpace));
      }
    }

    return $truncated . $safeSuffix;
  }
}

if (!function_exists('voncms_clean_seo_description')) {
  /**
   * @param mixed $description
   * @return string
   */
  function voncms_clean_seo_description($description): string
  {
    $description = (string) $description;
    if ($description === '') {
      return '';
    }

    $description =
      preg_replace(
        '#<(script|style|noscript|template)\b[^>]*>.*?(?:</\1\s*>|$)#is',
        '',
        $description,
      ) ?? $description;

    if (
      preg_match(
        '/^\s*<meta\b[^>]*\bcontent=["\']([^"\']+)["\'][^>]*>\s*$/i',
        $description,
        $matches,
      )
    ) {
      $description = $matches[1];
    }

    $description = strip_tags($description);
    $description = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return voncms_truncate_word_safe($description, 160);
  }
}

if (!function_exists('voncms_normalize_article_schema_type')) {
  /**
   * @param mixed $value
   * @return string
   */
  function voncms_normalize_article_schema_type($value): string
  {
    return is_string($value) && in_array($value, ['Article', 'NewsArticle', 'BlogPosting'], true)
      ? $value
      : 'Article';
  }
}

if (!function_exists('voncms_normalize_schema_language')) {
  /**
   * @param mixed $value
   * @return string
   */
  function voncms_normalize_schema_language($value): string
  {
    $primaryLanguage = trim(explode(',', (string) $value, 2)[0] ?? '');
    if (
      $primaryLanguage === '' ||
      !preg_match('/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $primaryLanguage)
    ) {
      return '';
    }

    $parts = explode('-', $primaryLanguage);
    foreach ($parts as $index => &$part) {
      if ($index === 0) {
        $part = strtolower($part);
      } elseif (preg_match('/^[A-Za-z]{4}$/', $part)) {
        $part = ucfirst(strtolower($part));
      } elseif (preg_match('/^[A-Za-z]{2}$/', $part)) {
        $part = strtoupper($part);
      } else {
        $part = strtolower($part);
      }
    }
    unset($part);

    return implode('-', $parts);
  }
}

if (!function_exists('voncms_extract_plaintext_for_noscript')) {
  /**
   * @param mixed $content
   * @return string
   */
  function voncms_extract_plaintext_for_noscript($content)
  {
    $content = (string) $content;
    if ($content === '') {
      return '';
    }

    $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $content = preg_replace('/<(br|hr)\s*\/?>/i', "\n", $content);
    $content = preg_replace(
      '/<\/(p|div|section|article|blockquote|figure|figcaption|h[1-6]|li)>/i',
      "\n",
      $content,
    );
    $content = strip_tags($content);
    $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $content = str_replace("\xC2\xA0", ' ', $content);
    $content = preg_replace('/[ \t\r\f\v]+/', ' ', $content);
    $content = preg_replace("/\n[ \t]+/", "\n", $content);
    $content = preg_replace("/\n{3,}/", "\n\n", $content);

    return trim($content);
  }
}

if (!function_exists('voncms_absolute_public_url')) {
  /**
   * @param mixed $url
   * @param string $domainUrl
   * @return string
   */
  function voncms_absolute_public_url($url, $domainUrl)
  {
    $url = trim((string) $url);
    if ($url === '' || preg_match('/^https?:\/\//i', $url)) {
      return $url;
    }

    $relativeUrl = ltrim($url, '/');
    $domainPath = trim((string) (parse_url($domainUrl, PHP_URL_PATH) ?: ''), '/');
    if ($domainPath !== '') {
      $domainPrefix = $domainPath . '/';
      if (stripos($relativeUrl, $domainPrefix) === 0) {
        $relativeUrl = substr($relativeUrl, strlen($domainPrefix));
      } elseif (strcasecmp($relativeUrl, $domainPath) === 0) {
        $relativeUrl = '';
      }
    }

    return rtrim($domainUrl, '/') . ($relativeUrl === '' ? '' : '/' . $relativeUrl);
  }
}

if (!function_exists('voncms_schema_entity_id')) {
  /**
   * @param string $domainUrl
   * @param string $entity
   * @return string
   */
  function voncms_schema_entity_id($domainUrl, $entity): string
  {
    $entity = $entity === 'website' ? 'website' : 'organization';

    return rtrim((string) $domainUrl, '/') . '/#' . $entity;
  }
}

if (!function_exists('voncms_build_schema_organization')) {
  /**
   * @param string $siteName
   * @param string $domainUrl
   * @param string $logoUrl
   * @return array<string, mixed>
   */
  function voncms_build_schema_organization($siteName, $domainUrl, $logoUrl): array
  {
    $organization = [
      '@type' => 'Organization',
      '@id' => voncms_schema_entity_id($domainUrl, 'organization'),
      'name' => trim((string) $siteName) !== '' ? trim((string) $siteName) : 'My Website',
      'url' => rtrim((string) $domainUrl, '/'),
    ];

    $absoluteLogoUrl = voncms_absolute_public_url($logoUrl, $domainUrl);
    if ($absoluteLogoUrl !== '') {
      $organization['logo'] = [
        '@type' => 'ImageObject',
        'url' => $absoluteLogoUrl,
      ];
    }

    return $organization;
  }
}

if (!function_exists('voncms_build_site_identity_schema_graph')) {
  /**
   * @param array<string, mixed> $schemaData
   * @param string $siteName
   * @param string $siteDescription
   * @param string $domainUrl
   * @param string $logoUrl
   * @param array<int, array<string, mixed>> $additionalNodes
   * @return array<string, mixed>
   */
  function voncms_build_site_identity_schema_graph(
    array $schemaData,
    $siteName,
    $siteDescription,
    $domainUrl,
    $logoUrl,
    array $additionalNodes = [],
  ): array {
    $normalizedDomainUrl = rtrim((string) $domainUrl, '/');
    $organizationId = voncms_schema_entity_id($normalizedDomainUrl, 'organization');
    $websiteNode = [
      '@type' => 'WebSite',
      '@id' => voncms_schema_entity_id($normalizedDomainUrl, 'website'),
      'url' => $normalizedDomainUrl . '/',
      'name' => trim((string) $siteName) !== '' ? trim((string) $siteName) : 'My Website',
      'publisher' => ['@id' => $organizationId],
    ];
    $normalizedDescription = trim((string) $siteDescription);
    if ($normalizedDescription !== '') {
      $websiteNode['description'] = $normalizedDescription;
    }

    unset($schemaData['@context']);
    $primaryType = (string) ($schemaData['@type'] ?? '');
    if ($primaryType === 'WebSite') {
      $websiteNode = array_merge($schemaData, $websiteNode);
    } elseif (in_array($primaryType, ['Article', 'NewsArticle', 'BlogPosting'], true)) {
      $schemaData['publisher'] = ['@id' => $organizationId];
    }

    $graph = [
      voncms_build_schema_organization($siteName, $normalizedDomainUrl, $logoUrl),
      $websiteNode,
    ];
    if ($primaryType !== '' && !in_array($primaryType, ['Organization', 'WebSite'], true)) {
      $graph[] = $schemaData;
    }
    foreach ($additionalNodes as $node) {
      unset($node['@context']);
      $nodeType = (string) ($node['@type'] ?? '');
      if ($nodeType !== '' && !in_array($nodeType, ['Organization', 'WebSite'], true)) {
        $graph[] = $node;
      }
    }

    return [
      '@context' => 'https://schema.org',
      '@graph' => $graph,
    ];
  }
}

if (!function_exists('voncms_apply_content_schema')) {
  /**
   * @param mixed $schemaData
   * @param array<string, mixed> $content
   * @param string $contentType
   * @param string $seoDescription
   * @param string $seoImage
   * @param string $seoUrl
   * @param string $domainUrl
   * @return void
   */
  function voncms_apply_content_schema(
    &$schemaData,
    $content,
    $contentType,
    $seoDescription,
    $seoImage,
    $seoUrl,
    $domainUrl,
    $articleSchemaType = 'Article',
    $schemaLanguage = '',
  ) {
    if (!is_array($schemaData)) {
      $schemaData = ['@context' => 'https://schema.org'];
    }

    $schemaTitle = html_entity_decode(
      (string) ($content['title'] ?? ''),
      ENT_QUOTES | ENT_HTML5,
      'UTF-8',
    );
    $schemaData['@type'] =
      $contentType === 'page'
        ? 'WebPage'
        : voncms_normalize_article_schema_type($articleSchemaType);
    $schemaData['name'] = $schemaTitle;
    $schemaData['headline'] = $schemaTitle;
    $schemaData['description'] = $seoDescription;
    $schemaData['url'] = $seoUrl;
    if ($seoImage !== '') {
      $schemaData['image'] = [
        [
          '@type' => 'ImageObject',
          'url' => $seoImage,
        ],
      ];
    }
    $schemaData['datePublished'] = !empty($content['created_at'])
      ? date('c', strtotime((string) $content['created_at']))
      : date('c');

    if (!empty($content['author_name']) || !empty($content['author'])) {
      $schemaAuthor = (string) ($content['author_name'] ?? $content['author']);
      $schemaAuthorUsername =
        (string) ($content['author_username'] ?? ($content['author'] ?? $schemaAuthor));
      $schemaData['author'] = [
        '@type' => 'Person',
        'name' => html_entity_decode($schemaAuthor, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'url' => $domainUrl . '/profile/' . rawurlencode($schemaAuthorUsername),
      ];
    }

    if ($contentType === 'post') {
      $schemaData['publisher'] = [
        '@id' => voncms_schema_entity_id($domainUrl, 'organization'),
      ];
      $schemaData['mainEntityOfPage'] = [
        '@type' => 'WebPage',
        '@id' => $seoUrl,
      ];
      $articleSection = trim((string) ($content['category'] ?? ''));
      if ($articleSection !== '') {
        $schemaData['articleSection'] = $articleSection;
      }
      if ($schemaLanguage !== '') {
        $schemaData['inLanguage'] = $schemaLanguage;
      }
    }
    $schemaData['dateModified'] = !empty($content['updated_at'])
      ? date('c', strtotime((string) $content['updated_at']))
      : $schemaData['datePublished'];
  }
}

if (!function_exists('voncms_apply_category_collection_items')) {
  /**
   * @param array<string, mixed> $schemaData
   * @param array<int, array<string, mixed>> $posts
   * @param int $totalPosts
   * @param string $articleSchemaType
   * @param string $domainUrl
   * @return void
   */
  function voncms_apply_category_collection_items(
    array &$schemaData,
    array $posts,
    int $totalPosts,
    string $articleSchemaType,
    string $domainUrl,
  ): void {
    $itemList = [];
    foreach ($posts as $index => $post) {
      $item = [
        '@type' => voncms_normalize_article_schema_type($articleSchemaType),
        'name' => html_entity_decode(
          (string) ($post['title'] ?? ''),
          ENT_QUOTES | ENT_HTML5,
          'UTF-8',
        ),
        'url' => rtrim($domainUrl, '/') . (string) ($post['url'] ?? ''),
        'description' => voncms_truncate_word_safe(
          voncms_extract_plaintext_for_noscript($post['excerpt'] ?? ''),
          200,
        ),
      ];
      if (!empty($post['image_url'])) {
        $item['image'] = voncms_absolute_public_url($post['image_url'], $domainUrl);
      }
      $itemList[] = [
        '@type' => 'ListItem',
        'position' => $index + 1,
        'item' => $item,
      ];
    }

    $schemaData['mainEntity'] = [
      '@type' => 'ItemList',
      'numberOfItems' => max(0, $totalPosts),
      'itemListElement' => $itemList,
    ];
  }
}
