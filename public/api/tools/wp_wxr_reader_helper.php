<?php
/**
 * VonCMS - WordPress WXR Reader Helper
 * Keeps XMLReader cursor advancement in one place so adjacent WXR items are not skipped.
 */

if (!defined('VONCMS_WP_IMPORT_CONTEXT')) {
  http_response_code(403);
  exit('Forbidden');
}

/**
 * Advance to and expand the next WXR item or generic post element.
 *
 * The caller must import or consume the returned node before calling this function again.
 */
function voncms_wp_read_next_item(XMLReader $reader): ?DOMNode
{
  while ($reader->read()) {
    if (
      $reader->nodeType !== XMLReader::ELEMENT ||
      ($reader->name !== 'item' && $reader->name !== 'post') ||
      $reader->depth > 2
    ) {
      continue;
    }

    $node = @$reader->expand();
    if ($node instanceof DOMNode) {
      return $node;
    }
    throw new RuntimeException('The import XML contains an unreadable item.');
  }

  foreach (libxml_get_errors() as $error) {
    if ($error->level >= LIBXML_ERR_ERROR) {
      throw new RuntimeException('The import XML is incomplete or malformed.');
    }
  }
  return null;
}

/** Namespace URIs, not caller-chosen prefixes, identify WordPress fields. */
function voncms_wp_fields(SimpleXMLElement $item): ?SimpleXMLElement
{
  foreach ($item->getNamespaces(true) as $namespace) {
    if (preg_match('~^https?://wordpress\.org/export/1\.[012]/$~', $namespace)) {
      return $item->children($namespace);
    }
  }
  return null;
}

/** A second nonempty password must not be hidden by an empty first field. */
function voncms_wp_item_is_protected(SimpleXMLElement $item): bool
{
  $sources = [$item];
  foreach ($item->getNamespaces(true) as $namespace) {
    if (preg_match('~^https?://wordpress\.org/export/1\.[012]/$~', $namespace)) {
      $sources[] = $item->children($namespace);
    }
  }
  foreach ($sources as $fields) {
    foreach ($fields->post_password as $password) {
      if ((string) $password !== '') {
        return true;
      }
    }
  }
  return false;
}

/** Validate the complete file before the first database write, retaining generic flat XML.
 * @return array{stats: array{posts: int, pages: int, media: int, authors: array{}}, source_site_url: string, source_blog_url: string, attachments: array<array-key,string>}
 */
function voncms_wp_inspect_document(string $path): array
{
  if (!class_exists('XMLReader') || !function_exists('simplexml_import_dom')) {
    throw new RuntimeException('WordPress Bridge requires PHP XMLReader and SimpleXML.');
  }
  $previousErrors = libxml_use_internal_errors(true);
  libxml_clear_errors();
  $reader = new XMLReader();
  $result = [
    'stats' => ['posts' => 0, 'pages' => 0, 'media' => 0, 'authors' => []],
    'source_site_url' => '',
    'source_blog_url' => '',
    'attachments' => [],
  ];
  try {
    if (!$reader->open($path, null, LIBXML_NONET | LIBXML_COMPACT)) {
      throw new RuntimeException('Unable to open the import XML.');
    }
    while ($reader->read()) {
      if ($reader->nodeType === XMLReader::DOC_TYPE) {
        throw new RuntimeException('Document type declarations are not supported in import XML.');
      }
      if ($reader->nodeType !== XMLReader::ELEMENT) {
        continue;
      }
      if (
        $reader->depth === 2 &&
        in_array($reader->localName, ['base_site_url', 'base_blog_url'], true)
      ) {
        $result['source_' . substr($reader->localName, 5)] = rtrim(
          trim($reader->readString()),
          '/',
        );
        continue;
      }
      if ($reader->localName === 'wxr_version' && $reader->depth === 2) {
        if (!in_array(trim($reader->readString()), ['1.0', '1.1', '1.2'], true)) {
          throw new RuntimeException('Unsupported WordPress export version.');
        }
        continue;
      }
      if (!in_array($reader->name, ['item', 'post'], true) || $reader->depth > 2) {
        continue;
      }
      $node = @$reader->expand();
      if (!($node instanceof DOMNode)) {
        throw new RuntimeException('The import XML contains an unreadable item.');
      }
      $document = new DOMDocument();
      $item = simplexml_import_dom($document->appendChild($document->importNode($node, true)));
      if (!($item instanceof SimpleXMLElement)) {
        throw new RuntimeException('Unable to read the import item.');
      }
      $wp = voncms_wp_fields($item);
      $type = (string) ($wp->post_type ?? ($item->post_type ?? ''));
      if ($type === '' && $reader->name === 'post') {
        $type = 'post';
      }
      $key = ['post' => 'posts', 'page' => 'pages', 'attachment' => 'media'][$type] ?? null;
      if ($key === null) {
        continue;
      }
      $result['stats'][$key]++;
      if ($type === 'attachment' && $wp !== null) {
        $id = (string) $wp->post_id;
        $url = (string) $wp->attachment_url;
        if ($id !== '' && $url !== '') {
          $result['attachments'][$id] = $url;
        }
      }
    }
    foreach (libxml_get_errors() as $error) {
      if ($error->level >= LIBXML_ERR_ERROR) {
        throw new RuntimeException('The import XML is incomplete or malformed.');
      }
    }
    if (
      array_sum(array_intersect_key($result['stats'], array_flip(['posts', 'pages', 'media']))) ===
      0
    ) {
      throw new RuntimeException(
        'No supported Post, Page or image attachment items were found. Use a WordPress WXR export or supported flat Post XML.',
      );
    }
    return $result;
  } finally {
    $reader->close();
    libxml_clear_errors();
    libxml_use_internal_errors($previousErrors);
  }
}

/**
 * Reject damaged saved bookkeeping before resuming any import writes.
 * @return array{version: 1, fingerprint: string, target: string, permalinks: string, inspection: array{source_site_url: string, source_blog_url: string, attachments: array<array-key,string>}, offset: int, imported: int, skipped: int, records: array<array-key,array{type: string, id: string, slug: string, source: string, path: string, hash: string, created: bool, public: bool}>, import_complete: bool, links_offset: int, warning_count: int, source_site_url: string, source_blog_url: string}
 */
function voncms_wp_validate_import_state(mixed $state): array
{
  $text = static function (mixed $value): string {
    if (!is_string($value)) {
      throw new RuntimeException('Import checkpoint text is invalid. Rescan before continuing.');
    }
    return $value;
  };
  $counter = static function (mixed $value): int {
    if (!is_int($value) || $value < 0) {
      throw new RuntimeException('Import checkpoint counter is invalid. Rescan before continuing.');
    }
    return $value;
  };
  if (
    !is_array($state) ||
    ($state['version'] ?? null) !== 1 ||
    !is_array($state['inspection'] ?? null) ||
    !is_array($state['records'] ?? null) ||
    !is_bool($state['import_complete'] ?? null)
  ) {
    throw new RuntimeException('Import checkpoint structure is invalid. Rescan before continuing.');
  }
  $inspection = $state['inspection'];
  if (!is_array($inspection['attachments'] ?? null)) {
    throw new RuntimeException('Import checkpoint attachments are invalid.');
  }
  $attachments = [];
  foreach ($inspection['attachments'] as $id => $url) {
    $attachments[$id] = $text($url);
  }
  $records = [];
  foreach ($state['records'] as $index => $record) {
    if (
      !is_array($record) ||
      !in_array($record['type'] ?? null, ['post', 'page'], true) ||
      !is_bool($record['created'] ?? null) ||
      !is_bool($record['public'] ?? null)
    ) {
      throw new RuntimeException('Import checkpoint record is invalid.');
    }
    $records[$index] = [
      'type' => $record['type'],
      'id' => $text($record['id'] ?? null),
      'slug' => $text($record['slug'] ?? null),
      'source' => $text($record['source'] ?? null),
      'path' => $text($record['path'] ?? null),
      'hash' => $text($record['hash'] ?? null),
      'created' => $record['created'],
      'public' => $record['public'],
    ];
  }
  $offset = $counter($state['offset'] ?? null);
  $linksOffset = $counter($state['links_offset'] ?? null);
  if ($linksOffset > count($records)) {
    throw new RuntimeException('Import checkpoint link cursor is invalid.');
  }
  // Inspection statistics are not used by resume, but retain them for checkpoint compatibility.
  $inspection['source_site_url'] = $text($inspection['source_site_url'] ?? null);
  $inspection['source_blog_url'] = $text($inspection['source_blog_url'] ?? null);
  $inspection['attachments'] = $attachments;
  return [
    'version' => 1,
    'fingerprint' => $text($state['fingerprint'] ?? null),
    'target' => $text($state['target'] ?? null),
    'permalinks' => $text($state['permalinks'] ?? null),
    'inspection' => $inspection,
    'offset' => $offset,
    'imported' => $counter($state['imported'] ?? null),
    'skipped' => $counter($state['skipped'] ?? null),
    'records' => $records,
    'import_complete' => $state['import_complete'],
    'links_offset' => $linksOffset,
    'warning_count' => $counter($state['warning_count'] ?? null),
    'source_site_url' => $text($state['source_site_url'] ?? ''),
    'source_blog_url' => $text($state['source_blog_url'] ?? ''),
  ];
}

/** Store only import bookkeeping, never source passwords or API credentials.
 * @param array<array-key,mixed> $state
 */
function voncms_wp_save_import_state(string $path, array $state): void
{
  $encoded = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
  if (strlen($encoded) > 16 * 1024 * 1024) {
    throw new RuntimeException(
      'Import checkpoint is too large. Split the WordPress export into smaller files.',
    );
  }
  $temporary = $path . '.tmp';
  if (@file_put_contents($temporary, $encoded, LOCK_EX) !== strlen($encoded)) {
    @unlink($temporary);
    throw new RuntimeException(
      'Unable to save the import checkpoint. Check temporary storage permissions.',
    );
  }
  if (!@rename($temporary, $path)) {
    @unlink($temporary);
    throw new RuntimeException('Unable to activate the import checkpoint.');
  }
}
