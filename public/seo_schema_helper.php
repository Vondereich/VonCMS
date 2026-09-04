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
      "\n\n",
      $content,
    );
    $content = strip_tags($content);
    $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $content = str_replace("\xC2\xA0", ' ', $content);
    $content = preg_replace('/[ \t\r\f]+/', ' ', $content);
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

if (!function_exists('voncms_normalize_public_media_url')) {
  /**
   * Validate a public media URL without fetching it. Local root/subfolder paths
   * and absolute HTTP(S) URLs are supported; active or ambiguous schemes fail closed.
   *
   * @param mixed $value
   * @param int $maxLength
   * @return string
   */
  function voncms_normalize_public_media_url($value, $maxLength = 2048): string
  {
    if (!is_string($value)) {
      return '';
    }

    $maxLength = max(1, (int) $maxLength);
    $url = trim($value);
    if (
      preg_match('/^\s*<meta\b[^>]*\bcontent=["\']([^"\']+)["\'][^>]*>\s*$/i', $url, $contentMatch)
    ) {
      $url = $contentMatch[1];
    }
    for ($decodePass = 0; $decodePass < 3; $decodePass++) {
      $decoded = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
      if ($decoded === $url) {
        break;
      }
      $url = $decoded;
    }
    $url = trim($url);

    if (preg_match('/%(?![0-9A-Fa-f]{2})/', $url)) {
      return '';
    }
    $decodedUrl = rawurldecode($url);
    if (!mb_check_encoding($decodedUrl, 'UTF-8')) {
      return '';
    }

    if (
      $url === '' ||
      mb_strlen($url) > $maxLength ||
      preg_match('/[\x00-\x20\x7F]/u', $url) ||
      strpbrk($url, "<>\"'`\\") !== false ||
      str_starts_with($url, '//')
    ) {
      return '';
    }

    if (preg_match('/^https?:\/\//i', $url)) {
      $parts = parse_url($url);
      if (
        !is_array($parts) ||
        !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) ||
        empty($parts['host']) ||
        isset($parts['user']) ||
        isset($parts['pass']) ||
        filter_var($url, FILTER_VALIDATE_URL) === false
      ) {
        return '';
      }

      return $url;
    }

    if (preg_match('/^[a-z][a-z0-9+.-]*:/i', $url)) {
      return '';
    }

    $path = explode('?', $url, 2)[0];
    $decodedPath = rawurldecode($path);
    if (
      $path === '' ||
      preg_match('/[\x00-\x20\x7F]/u', $decodedPath) ||
      str_contains($decodedPath, '\\')
    ) {
      return '';
    }
    foreach (explode('/', $decodedPath) as $segment) {
      if ($segment === '.' || $segment === '..') {
        return '';
      }
    }

    return $url;
  }
}

if (!function_exists('voncms_resolve_social_image')) {
  /**
   * @param array<int, array{url:mixed, kind:string}> $candidates
   * @param string $domainUrl
   * @return array{url:string, kind:string, card:string}
   */
  function voncms_resolve_social_image(array $candidates, $domainUrl): array
  {
    foreach ($candidates as $candidate) {
      $normalizedUrl = voncms_normalize_public_media_url($candidate['url'] ?? '');
      if ($normalizedUrl === '') {
        continue;
      }

      $kind = strtolower(trim((string) ($candidate['kind'] ?? '')));
      $card = in_array($kind, ['featured', 'large', 'default'], true)
        ? 'summary_large_image'
        : 'summary';

      return [
        'url' => voncms_absolute_public_url($normalizedUrl, $domainUrl),
        'kind' => $kind,
        'card' => $card,
      ];
    }

    return ['url' => '', 'kind' => '', 'card' => 'summary'];
  }
}

if (!function_exists('voncms_enrich_public_social_schema')) {
  /**
   * Resolve one authoritative social image and enrich supported schema nodes
   * with safe local dimensions when the image belongs to this installation.
   *
   * @param mixed $schemaData
   * @param array<int, array{url:mixed, kind:string}> $candidates
   * @return array{schemaData:mixed, seoImage:string, twitterCard:string, width:int, height:int}
   */
  function voncms_enrich_public_social_schema(
    $schemaData,
    array $candidates,
    string $domainUrl,
    string $publicRoot,
  ): array {
    $resolvedSocialImage = voncms_resolve_social_image($candidates, $domainUrl);
    $seoImage = $resolvedSocialImage['url'];

    if (is_array($schemaData)) {
      $schemaType = (string) ($schemaData['@type'] ?? '');
      if (in_array($schemaType, ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'], true)) {
        if ($seoImage !== '') {
          $schemaData['image'] = [
            [
              '@type' => 'ImageObject',
              'url' => $seoImage,
            ],
          ];
        } else {
          unset($schemaData['image']);
        }
      }
    }

    $width = 0;
    $height = 0;
    $seoImageParts = parse_url($seoImage);
    $domainUrlParts = parse_url($domainUrl);
    if (
      is_array($seoImageParts) &&
      is_array($domainUrlParts) &&
      !empty($seoImageParts['host']) &&
      !empty($domainUrlParts['host']) &&
      strcasecmp((string) $seoImageParts['host'], (string) $domainUrlParts['host']) === 0 &&
      (int) ($seoImageParts['port'] ?? 0) === (int) ($domainUrlParts['port'] ?? 0)
    ) {
      $seoImagePath = rawurldecode((string) ($seoImageParts['path'] ?? ''));
      $domainBasePath = rtrim((string) ($domainUrlParts['path'] ?? ''), '/');
      if ($domainBasePath !== '' && str_starts_with($seoImagePath, $domainBasePath . '/')) {
        $seoImagePath = substr($seoImagePath, strlen($domainBasePath));
      }

      $resolvedPublicRoot = realpath($publicRoot);
      $localImagePath = realpath(
        rtrim($publicRoot, '/\\') .
          DIRECTORY_SEPARATOR .
          ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $seoImagePath), DIRECTORY_SEPARATOR),
      );
      if (
        $resolvedPublicRoot !== false &&
        $localImagePath !== false &&
        str_starts_with($localImagePath, $resolvedPublicRoot . DIRECTORY_SEPARATOR) &&
        is_file($localImagePath)
      ) {
        $imageDimensions = @getimagesize($localImagePath);
        if (is_array($imageDimensions)) {
          $width = max(0, (int) ($imageDimensions[0] ?? 0));
          $height = max(0, (int) ($imageDimensions[1] ?? 0));
        }
      }
    }

    if (
      $width > 0 &&
      $height > 0 &&
      is_array($schemaData) &&
      isset($schemaData['image'][0]) &&
      is_array($schemaData['image'][0])
    ) {
      $schemaData['image'][0]['width'] = $width;
      $schemaData['image'][0]['height'] = $height;
    }

    return [
      'schemaData' => $schemaData,
      'seoImage' => $seoImage,
      'twitterCard' => $resolvedSocialImage['card'],
      'width' => $width,
      'height' => $height,
    ];
  }
}

if (!function_exists('voncms_resolve_featured_image_input')) {
  /**
   * Preserve an unchanged legacy value so unrelated edits remain saveable, but
   * reject malformed values for inserts and explicit image changes.
   *
   * @return array{accepted:bool, value:string, changed:bool}
   */
  function voncms_resolve_featured_image_input(
    string $incomingValue,
    string $storedValue,
    bool $isUpdate,
  ): array {
    $normalizedValue = voncms_normalize_public_media_url($incomingValue, 255);
    $changed = !$isUpdate || $incomingValue !== $storedValue;
    $accepted = $incomingValue === '' || $normalizedValue !== '' || !$changed;

    return [
      'accepted' => $accepted,
      'value' => $normalizedValue !== '' ? $normalizedValue : $incomingValue,
      'changed' => $changed,
    ];
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

    $normalizedLogoUrl = voncms_normalize_public_media_url($logoUrl);
    $absoluteLogoUrl = voncms_absolute_public_url($normalizedLogoUrl, $domainUrl);
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
    $normalizedSchemaImage = voncms_normalize_public_media_url($seoImage);
    if ($normalizedSchemaImage !== '') {
      $schemaData['image'] = [
        [
          '@type' => 'ImageObject',
          'url' => voncms_absolute_public_url($normalizedSchemaImage, $domainUrl),
        ],
      ];
    } else {
      unset($schemaData['image']);
    }
    $publishedAt = function_exists('voncms_publication_value')
      ? voncms_publication_value($content, $contentType)
      : $content['published_at'] ??
        ($contentType === 'post'
          ? $content['scheduled_at'] ?? ($content['created_at'] ?? null)
          : $content['created_at'] ?? null);
    $schemaData['datePublished'] = !empty($publishedAt)
      ? date('c', strtotime((string) $publishedAt))
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
   * @param int $positionOffset
   * @return void
   */
  function voncms_apply_category_collection_items(
    array &$schemaData,
    array $posts,
    int $totalPosts,
    string $articleSchemaType,
    string $domainUrl,
    int $positionOffset = 0,
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
      $normalizedItemImage = voncms_normalize_public_media_url($post['image_url'] ?? '');
      if ($normalizedItemImage !== '') {
        $item['image'] = voncms_absolute_public_url($normalizedItemImage, $domainUrl);
      }
      $itemList[] = [
        '@type' => 'ListItem',
        'position' => max(0, $positionOffset) + $index + 1,
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

if (!function_exists('voncms_build_public_schema_graph')) {
  /**
   * Assemble the final public schema graph from already-resolved route data.
   *
   * @param array<string, mixed> $schemaData
   * @param array<string, mixed> $context
   * @return array<string, mixed>
   */
  function voncms_build_public_schema_graph(array $schemaData, array $context): array
  {
    $path = (string) ($context['path'] ?? '');
    $domainUrl = rtrim((string) ($context['domainUrl'] ?? ''), '/');
    $articleSchemaType = voncms_normalize_article_schema_type(
      $context['articleSchemaType'] ?? null,
    );
    $listingOffset = max(0, (int) ($context['listingOffset'] ?? 0));
    $categoryPosts = is_array($context['categoryPosts'] ?? null) ? $context['categoryPosts'] : [];
    $homepagePosts = is_array($context['homepagePosts'] ?? null) ? $context['homepagePosts'] : [];
    $additionalSchemaNodes = [];

    if (
      !empty($context['isCategoryLanding']) &&
      voncms_is_homepage_path($path) &&
      $categoryPosts !== [] &&
      ($schemaData['@type'] ?? '') === 'CollectionPage'
    ) {
      voncms_apply_category_collection_items(
        $schemaData,
        $categoryPosts,
        max(0, (int) ($context['categoryPostCount'] ?? 0)),
        $articleSchemaType,
        $domainUrl,
        $listingOffset,
      );
    }

    if (
      voncms_is_homepage_path($path) &&
      empty($context['hasHomepageDiscoveryQuery']) &&
      $homepagePosts !== []
    ) {
      $homepageCollectionPage = [
        '@type' => 'CollectionPage',
        'name' => (string) ($context['siteName'] ?? ''),
        'url' => $domainUrl . '/',
        'description' => (string) ($context['siteDescription'] ?? ''),
      ];
      $itemList = [];
      foreach ($homepagePosts as $index => $post) {
        $item = [
          '@type' => $articleSchemaType,
          'name' => html_entity_decode(
            (string) ($post['title'] ?? ''),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
          ),
          'url' => $domainUrl . (string) ($post['url'] ?? ''),
          'description' => voncms_truncate_word_safe(
            html_entity_decode(
              strip_tags((string) ($post['excerpt'] ?? '')),
              ENT_QUOTES | ENT_HTML5,
              'UTF-8',
            ),
            200,
          ),
        ];
        $itemImage = voncms_normalize_public_media_url($post['image_url'] ?? '');
        if ($itemImage !== '') {
          $item['image'] = voncms_absolute_public_url($itemImage, $domainUrl);
        }
        $itemList[] = [
          '@type' => 'ListItem',
          'position' => $listingOffset + $index + 1,
          'item' => $item,
        ];
      }
      $homepageCollectionPage['mainEntity'] = [
        '@type' => 'ItemList',
        'itemListElement' => $itemList,
      ];
      $additionalSchemaNodes[] = $homepageCollectionPage;
    }

    $post = is_array($context['post'] ?? null) ? $context['post'] : null;
    if ($path !== '' && $post !== null && ($context['resolvedContentType'] ?? 'post') === 'post') {
      $categoryName = trim((string) ($post['category'] ?? ''));
      if ($categoryName === '') {
        $categoryName = 'Uncategorized';
      }
      $categorySlug = voncms_category_slug($categoryName);
      $postName = html_entity_decode(
        (string) ($post['title'] ?? ($context['seoTitle'] ?? '')),
        ENT_QUOTES | ENT_HTML5,
        'UTF-8',
      );
      $seoUrl = (string) ($context['seoUrl'] ?? '');
      $additionalSchemaNodes[] = [
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
          [
            '@type' => 'ListItem',
            'position' => 1,
            'name' => 'Home',
            'item' => $domainUrl,
          ],
          [
            '@type' => 'ListItem',
            'position' => 2,
            'name' => $categoryName,
            'item' => $domainUrl . '/?category=' . rawurlencode($categoryName),
          ],
          [
            '@type' => 'ListItem',
            'position' => 3,
            'name' => $postName,
            'item' =>
              $seoUrl !== ''
                ? $seoUrl
                : $domainUrl . '/' . $categorySlug . '/' . ($post['slug'] ?? ($post['id'] ?? '')),
          ],
        ],
      ];
    }

    foreach (['name', 'description', 'headline'] as $field) {
      if (!empty($schemaData[$field])) {
        $schemaData[$field] = html_entity_decode(
          (string) $schemaData[$field],
          ENT_QUOTES | ENT_HTML5,
          'UTF-8',
        );
      }
    }

    return voncms_build_site_identity_schema_graph(
      $schemaData,
      (string) ($context['siteName'] ?? ($context['seoTitle'] ?? '')),
      (string) ($context['siteDescription'] ?? ($context['seoDescription'] ?? '')),
      $domainUrl,
      (string) ($context['logoUrl'] ?? ''),
      $additionalSchemaNodes,
    );
  }
}
