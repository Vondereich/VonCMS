<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  echo 'Forbidden';
  exit();
}

/**
 * @param string $host
 * @param string $domain
 */
function voncms_embed_host_matches($host, $domain): bool
{
  $host = strtolower(rtrim(trim((string) $host), '.'));
  $domain = strtolower(trim((string) $domain));

  if (str_starts_with($host, 'www.')) {
    $host = substr($host, 4);
  }

  return $host === $domain || str_ends_with($host, '.' . $domain);
}

/**
 * Keep the PHP storage boundary aligned with the editor's supported video providers.
 */
function voncms_is_allowed_iframe_src(mixed $value): bool
{
  if (!is_scalar($value)) {
    return false;
  }

  $url = trim(html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
  if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x20\\\\]/', $url)) {
    return false;
  }

  $parts = parse_url($url);
  if (!is_array($parts)) {
    return false;
  }

  $scheme = strtolower((string) ($parts['scheme'] ?? ''));
  $host = (string) ($parts['host'] ?? '');
  $path = (string) ($parts['path'] ?? '');
  if (
    !in_array($scheme, ['http', 'https'], true) ||
    $host === '' ||
    isset($parts['user']) ||
    isset($parts['pass']) ||
    isset($parts['port'])
  ) {
    return false;
  }

  if (
    voncms_embed_host_matches($host, 'youtube.com') ||
    voncms_embed_host_matches($host, 'youtube-nocookie.com')
  ) {
    return str_starts_with($path, '/embed/');
  }

  $normalizedHost = strtolower(rtrim($host, '.'));
  if ($normalizedHost === 'player.vimeo.com') {
    return str_starts_with($path, '/video/');
  }

  if (voncms_embed_host_matches($host, 'facebook.com')) {
    return $path === '/plugins/video.php';
  }

  if (voncms_embed_host_matches($host, 'tiktok.com')) {
    return str_starts_with($path, '/player/v1/');
  }

  if (voncms_embed_host_matches($host, 'instagram.com')) {
    return str_starts_with($path, '/reel/') && str_ends_with($path, '/embed');
  }

  return false;
}

/**
 * @param string $value
 */
function voncms_sanitize_iframe_allow_attribute($value): string
{
  $supported = [
    'accelerometer',
    'autoplay',
    'clipboard-write',
    'encrypted-media',
    'fullscreen',
    'gyroscope',
    'picture-in-picture',
    'web-share',
  ];
  $accepted = [];

  foreach (explode(';', strtolower((string) $value)) as $capability) {
    $capability = trim($capability);
    if ($capability !== '' && in_array($capability, $supported, true)) {
      $accepted[$capability] = true;
    }
  }

  return implode('; ', array_keys($accepted));
}

/**
 * Preserve only the layout declarations emitted by VonCMS's supported embed builders.
 */
function voncms_sanitize_iframe_style(mixed $value): string
{
  if (!is_scalar($value)) {
    return '';
  }

  $accepted = [];
  foreach (explode(';', (string) $value) as $declaration) {
    $parts = explode(':', $declaration, 2);
    if (count($parts) !== 2) {
      continue;
    }

    $property = strtolower(trim($parts[0]));
    $propertyValue = strtolower(trim($parts[1]));
    $valid = match ($property) {
      'width', 'max-width', 'height' => preg_match(
        '/^(?:auto|100%|[1-9]\d{0,3}px)$/',
        $propertyValue,
      ) === 1,
      'margin-left', 'margin-right' => preg_match(
        '/^(?:auto|0|[1-9]\d{0,3}px)$/',
        $propertyValue,
      ) === 1,
      'aspect-ratio' => in_array($propertyValue, ['9 / 16', '16 / 9'], true),
      'border' => in_array($propertyValue, ['0', 'none'], true),
      'overflow' => $propertyValue === 'hidden',
      default => false,
    };

    if ($valid) {
      $accepted[$property] = $propertyValue;
    }
  }

  $style = '';
  foreach ($accepted as $property => $propertyValue) {
    $style .= $property . ':' . $propertyValue . ';';
  }
  return $style;
}

/** Parsed-attribute URL policy, shared with responsive image candidates. */
function voncms_content_url_is_safe(string $url, bool $isLink = false): bool
{
  // Validate encoded aliases too, without decoding the surrounding rich-text fragment.
  for ($depth = 0; $depth < 4; $depth++) {
    $decoded = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($decoded === $url) {
      break;
    }
    $url = $decoded;
  }
  if (html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8') !== $url) {
    return false;
  }
  $parts = parse_url($url);
  if (!is_array($parts) || preg_match('/[\x00-\x1f\x7f\\\\]/', $url)) {
    return false;
  }
  if (str_starts_with($url, '//')) {
    return voncms_noscript_safe_link_href('https:' . $url) !== '';
  }
  if (isset($parts['scheme'])) {
    return ($isLink || in_array(strtolower($parts['scheme']), ['http', 'https'], true)) &&
      voncms_noscript_safe_link_href($url) !== '';
  }
  $pathParts = preg_split('~[/#?]~', $url, 2);
  return $pathParts !== false && !str_contains($pathParts[0], ':');
}

/** Preserve ordinary responsive images; reject a list with any unsafe candidate. */
function voncms_sanitize_content_srcset(string $value): string
{
  $accepted = [];
  foreach (explode(',', $value) as $candidate) {
    $parts = preg_split('/\s+/', trim($candidate));
    if ($parts === false) {
      return '';
    }
    $url = $parts[0] ?? '';
    if ($url === '' || count($parts) > 2 || !voncms_content_url_is_safe($url)) {
      return '';
    }
    $descriptor = $parts[1] ?? '';
    if (
      $descriptor !== '' &&
      preg_match('/^(?:[1-9][0-9]*w|(?:[0-9]*\.)?[0-9]+x)$/D', $descriptor) !== 1
    ) {
      return '';
    }
    $accepted[] = $url . ($descriptor !== '' ? ' ' . $descriptor : '');
  }
  return implode(', ', $accepted);
}

/** Keep supported editor layout/typography, never CSS fetches or escaped CSS syntax. */
function voncms_sanitize_content_style(string $style): string
{
  $properties = [
    'text-align',
    'display',
    'margin-left',
    'margin-right',
    'margin',
    'max-width',
    'width',
    'height',
    'aspect-ratio',
    'float',
    'border-left',
    'border',
    'border-radius',
    'padding',
    'padding-left',
    'padding-right',
    'padding-top',
    'padding-bottom',
    'font-style',
    'min-width',
    'overflow',
    'color',
    'background-color',
    'font-size',
    'font-family',
    'font-weight',
    'line-height',
    'letter-spacing',
  ];
  $accepted = [];
  foreach (explode(';', $style) as $declaration) {
    $pair = explode(':', $declaration, 2);
    if (count($pair) !== 2) {
      continue;
    }
    $property = strtolower(trim($pair[0]));
    $value = trim($pair[1]);
    if (
      !in_array($property, $properties, true) ||
      $value === '' ||
      preg_match('~[\\\\\x00-\x1f\x7f{}<>@]|/\*~', $value)
    ) {
      continue;
    }
    // CSS comments and escapes are rejected above before recognising function names.
    preg_match_all('/([a-zA-Z_-][a-zA-Z0-9_-]*)\s*\(/', $value, $functions);
    foreach ($functions[1] as $function) {
      if (
        !in_array(
          strtolower($function),
          ['rgb', 'rgba', 'hsl', 'hsla', 'calc', 'min', 'max', 'clamp'],
          true,
        )
      ) {
        continue 2;
      }
    }
    $accepted[] = $property . ':' . $value;
  }
  return implode(';', $accepted);
}

/** Parsed storage hardening shared by Post, Page and import. Output stays separately sanitized. */
function voncms_sanitize_content_attributes(string $html, bool $normalizeImportUrls = false): string
{
  if ($html === '' || !str_contains($html, '<')) {
    return $html;
  }
  if (!class_exists('DOMDocument') || !class_exists('DOMXPath')) {
    throw new RuntimeException('Saving HTML content requires the PHP DOM extension.');
  }

  require_once __DIR__ . '/../seo_schema_helper.php';
  $previousErrors = libxml_use_internal_errors(true);
  $document = new DOMDocument('1.0', 'UTF-8');
  try {
    $loaded = $document->loadHTML(
      '<?xml encoding="UTF-8"><html><body>' . $html . '</body></html>',
      LIBXML_HTML_NODEFDTD | LIBXML_NONET,
    );
  } finally {
    libxml_clear_errors();
    libxml_use_internal_errors($previousErrors);
  }
  $root = $document->getElementsByTagName('body')->item(0);
  if (!$loaded || !($root instanceof DOMElement)) {
    throw new RuntimeException('HTML content could not be validated.');
  }

  $xpath = new DOMXPath($document);
  // Libxml can hide markup as raw text here that a browser reparses as active HTML
  // inside SVG/MathML. These nodes are already forbidden in public article output.
  $blocked =
    './/script|.//style|.//object|.//embed|.//link|.//meta|.//base|.//noscript|.//template|.//svg|.//math|.//form|.//input|.//button|.//select|.//option|.//textarea|.//frame|.//frameset|.//applet';
  $blockedNodes = $xpath->query($blocked, $root);
  if ($blockedNodes === false) {
    throw new RuntimeException('HTML content could not be validated.');
  }
  foreach (array_reverse(iterator_to_array($blockedNodes)) as $node) {
    if (!($node instanceof DOMNode)) {
      throw new RuntimeException('HTML content could not be validated.');
    }
    // Libxml's HTML4 parser can attach later siblings to HTML5 void elements.
    // Unwrap those nodes instead of discarding legitimate following content.
    if (in_array(strtolower($node->nodeName), ['embed', 'link', 'meta', 'base', 'input'], true)) {
      while ($node->firstChild && $node->parentNode) {
        $node->parentNode->insertBefore($node->firstChild, $node);
      }
    }
    $node->parentNode?->removeChild($node);
  }

  $urlAttributes = [
    'href',
    'src',
    'poster',
    'cite',
    'background',
    'longdesc',
    'xlink:href',
    'action',
    'formaction',
    'data',
    'codebase',
  ];
  foreach ($xpath->query('.//*', $root) ?: [] as $element) {
    if (!($element instanceof DOMElement)) {
      continue;
    }
    foreach (array_reverse(iterator_to_array($element->attributes)) as $attribute) {
      $name = strtolower($attribute->nodeName);
      if (str_starts_with($name, 'on') || in_array($name, ['srcdoc', 'ping', 'xlink:href'], true)) {
        $element->removeAttributeNode($attribute);
        continue;
      }
      if (
        in_array($name, ['style', 'srcset', 'imagesrcset', 'data-srcset', 'data-lazy-srcset'], true)
      ) {
        $clean =
          $name === 'style'
            ? voncms_sanitize_content_style($attribute->nodeValue ?? '')
            : voncms_sanitize_content_srcset($attribute->nodeValue ?? '');
        if ($clean === '') {
          $element->removeAttributeNode($attribute);
        } else {
          $element->setAttribute($attribute->nodeName, $clean);
        }
        continue;
      }
      if (!in_array($name, $urlAttributes, true)) {
        continue;
      }

      // DOM already decoded this attribute. Never decode the entire HTML fragment.
      $url = trim($attribute->nodeValue ?? '');
      if ($normalizeImportUrls) {
        if (str_starts_with($url, '//')) {
          $url = 'https:' . $url;
        }
        $normalized = $name === 'href' ? voncms_noscript_safe_link_href($url) : '';
        if ($normalized === '') {
          $normalized = voncms_normalize_public_media_url($url);
        }
        $url = $normalized;
      }
      if (
        $name === 'src' &&
        strtolower($element->tagName) === 'img' &&
        preg_match('~^data:image/~i', $url)
      ) {
        throw new InvalidArgumentException(
          'Inline data images are not supported. Upload the image through the Media Library before saving.',
        );
      }
      $safe =
        (!$normalizeImportUrls || $url !== '') &&
        voncms_content_url_is_safe($url, $name === 'href');

      if (!$safe) {
        $element->removeAttributeNode($attribute);
      } else {
        $element->setAttribute($attribute->nodeName, $url);
      }
    }
  }

  $result = '';
  foreach ($root->childNodes as $child) {
    $result .= $document->saveHTML($child);
  }
  return $result;
}

/**
 * Remove unsupported iframe providers and rebuild accepted iframe attributes from a strict list.
 */
function voncms_sanitize_content_iframes(mixed $value): string
{
  $html = is_scalar($value) ? (string) $value : '';
  if ($html === '' || stripos($html, '<iframe') === false) {
    return $html;
  }

  if (!class_exists('DOMDocument') || !class_exists('DOMXPath')) {
    return (string) preg_replace(
      '~<iframe\b[^>]*>(?:.*?)</iframe\s*>|<iframe\b[^>]*/?>~is',
      '',
      $html,
    );
  }

  $previousErrors = libxml_use_internal_errors(true);
  $document = new DOMDocument('1.0', 'UTF-8');
  $loaded = $document->loadHTML(
    '<?xml encoding="UTF-8"><html><body>' . $html . '</body></html>',
    LIBXML_HTML_NODEFDTD | LIBXML_NONET,
  );
  libxml_clear_errors();
  libxml_use_internal_errors($previousErrors);

  if (!$loaded) {
    return (string) preg_replace(
      '~<iframe\b[^>]*>(?:.*?)</iframe\s*>|<iframe\b[^>]*/?>~is',
      '',
      $html,
    );
  }

  $xpath = new DOMXPath($document);
  $rootNodes = $xpath->query('//body');
  $root = $rootNodes instanceof DOMNodeList ? $rootNodes->item(0) : null;
  if (!($root instanceof DOMElement)) {
    return '';
  }

  $iframeNodes = [];
  $nodes = $xpath->query('.//iframe', $root);
  if ($nodes instanceof DOMNodeList) {
    foreach ($nodes as $node) {
      if ($node instanceof DOMElement) {
        $iframeNodes[] = $node;
      }
    }
  }

  foreach ($iframeNodes as $iframe) {
    $src = html_entity_decode(trim($iframe->getAttribute('src')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (!voncms_is_allowed_iframe_src($src)) {
      $iframe->parentNode?->removeChild($iframe);
      continue;
    }

    $originalAttributes = [];
    foreach ($iframe->attributes as $attribute) {
      $originalAttributes[strtolower($attribute->name)] = $attribute->value;
    }
    while ($iframe->attributes->length > 0) {
      $attribute = $iframe->attributes->item(0);
      if (!($attribute instanceof DOMAttr)) {
        throw new RuntimeException('Iframe attributes could not be validated.');
      }
      $iframe->removeAttributeNode($attribute);
    }

    $iframe->setAttribute('src', $src);
    foreach (['width', 'height'] as $attributeName) {
      $attributeValue = trim((string) ($originalAttributes[$attributeName] ?? ''));
      if (preg_match('/^(?:100%|[1-9]\d{0,3})$/', $attributeValue)) {
        $iframe->setAttribute($attributeName, $attributeValue);
      }
    }

    $title = trim(strip_tags((string) ($originalAttributes['title'] ?? '')));
    if ($title !== '') {
      $iframe->setAttribute('title', mb_substr($title, 0, 255));
    }

    $allow = voncms_sanitize_iframe_allow_attribute($originalAttributes['allow'] ?? '');
    if ($allow !== '') {
      $iframe->setAttribute('allow', $allow);
    }

    $frameborder = trim((string) ($originalAttributes['frameborder'] ?? ''));
    if (in_array($frameborder, ['0', '1'], true)) {
      $iframe->setAttribute('frameborder', $frameborder);
    }

    $scrolling = strtolower(trim((string) ($originalAttributes['scrolling'] ?? '')));
    if (in_array($scrolling, ['yes', 'no', 'auto'], true)) {
      $iframe->setAttribute('scrolling', $scrolling);
    }

    $loading = strtolower(trim((string) ($originalAttributes['loading'] ?? '')));
    if (in_array($loading, ['lazy', 'eager'], true)) {
      $iframe->setAttribute('loading', $loading);
    }

    $aspect = strtolower(trim((string) ($originalAttributes['data-von-video-aspect'] ?? '')));
    if (in_array($aspect, ['portrait', 'landscape'], true)) {
      $iframe->setAttribute('data-von-video-aspect', $aspect);
    }

    $style = voncms_sanitize_iframe_style($originalAttributes['style'] ?? '');
    if ($style !== '') {
      $iframe->setAttribute('style', $style);
    }

    $iframe->setAttribute('allowfullscreen', '');
  }

  $result = '';
  foreach ($root->childNodes as $child) {
    $result .= $document->saveHTML($child);
  }
  return $result;
}
