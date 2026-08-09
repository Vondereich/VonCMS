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
      ($reader->name !== 'item' && $reader->name !== 'post')
    ) {
      continue;
    }

    $node = $reader->expand();
    if ($node instanceof DOMNode) {
      return $node;
    }
  }

  return null;
}
