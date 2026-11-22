<?php

// Internal backup metadata only; direct HTTP execution never exposes a table projection.
if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
    realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  exit('Forbidden');
}

require_once __DIR__ . '/DataBoundary.php';

final class VonCMSDatabaseBackup
{
  /** @return list<string> Ordinary stored columns in their original database order. */
  public static function writableColumns(PDO $pdo, string $table): array
  {
    $statement = $pdo->prepare(
      'SELECT COLUMN_NAME AS column_name, GENERATION_EXPRESSION AS generation_expression
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION',
    );
    if (!$statement || !$statement->execute([$table])) {
      throw new RuntimeException('Could not verify writable database backup columns.');
    }

    $columns = [];
    try {
      while ($row = DataBoundary::row($statement->fetch(PDO::FETCH_ASSOC))) {
        $name = $row['column_name'] ?? null;
        if (
          !is_string($name) ||
          $name === '' ||
          !array_key_exists('generation_expression', $row) ||
          ($row['generation_expression'] !== null && !is_string($row['generation_expression']))
        ) {
          throw new RuntimeException('Invalid database backup column metadata.');
        }
        // DEFAULT_GENERATED timestamps are ordinary stored values, not generated columns.
        // An expression of "0" is still generated; never use PHP truthiness here.
        if ((string) $row['generation_expression'] === '') {
          $columns[] = $name;
        }
      }
    } finally {
      $statement->closeCursor();
    }

    if ($columns === []) {
      throw new RuntimeException('The database table has no verified writable backup columns.');
    }

    return $columns;
  }
}
