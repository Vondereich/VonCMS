<?php

if (!defined('VONCMS_CORE_LOADED')) {
  http_response_code(403);
  exit('Forbidden');
}

/** Preserve a SQL TIMESTAMP instant while displaying it in the configured CMS timezone.
 * @param array<string, scalar|null> $row
 * @return array<string, scalar|null>
 */
function voncms_project_timestamp_row(array $row, string $field = 'created_at'): array
{
  if (isset($row['_created_epoch']) && is_numeric($row['_created_epoch'])) {
    $row[$field] = date('Y-m-d H:i:s', (int) $row['_created_epoch']);
  }
  unset($row['_created_epoch']);
  return $row;
}
