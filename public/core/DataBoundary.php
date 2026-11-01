<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}

/**
 * Runtime checks for the CMS's plain SQL rows and scalar request fields.
 * No SQL, authentication, escaping, storage or implicit authority lives here.
 *
 * @phpstan-type SqlRow array<array-key, bool|float|int|string|null>
 */
final class DataBoundary
{
  public static function optionalDatabase(mixed $value): ?PDO
  {
    return $value instanceof PDO ? $value : null;
  }

  /** Preserve a successful query; turn a failed query into a catchable failure. */
  public static function statement(PDOStatement|false $value): PDOStatement
  {
    if ($value === false) {
      throw new UnexpectedValueException('Database query failed.');
    }
    return $value;
  }

  public static function database(mixed $value): PDO
  {
    if (!($value instanceof PDO)) {
      ResponseHelper::sendError('Database not configured', 503);
    }
    return $value;
  }

  public static function serverString(string $key, string $fallback = ''): string
  {
    $value = $_SERVER[$key] ?? $fallback;
    return is_string($value) ? $value : $fallback;
  }

  /** Read a presentation/identity field; this does not authenticate a session. */
  public static function userText(string $key): string
  {
    $user = $_SESSION['user'] ?? null;
    $value = is_array($user) ? $user[$key] ?? '' : '';
    return is_scalar($value) ? (string) $value : '';
  }

  /**
   * Minimal actor fields for callers that have already checked authorization.
   * @return array{id: string, username: string, role: string}
   */
  public static function actor(): array
  {
    return [
      'id' => self::userText('id'),
      'username' => self::userText('username'),
      'role' => self::userText('role'),
    ];
  }

  /** @return bool|float|int|string|null */
  public static function scalar(mixed $value): bool|float|int|string|null
  {
    if (!is_scalar($value) && $value !== null) {
      throw new UnexpectedValueException('Expected a scalar data value.');
    }
    return $value;
  }

  /** Request scalars retain legacy conversion; compound fields fail before use. */
  public static function inputText(mixed $value): string
  {
    if (!is_scalar($value) && $value !== null) {
      ResponseHelper::sendError('Invalid request field type.', 400);
    }
    return (string) $value;
  }

  /** For bounded filters/counters, not record-identity validation. */
  public static function inputInt(mixed $value): int
  {
    if (!is_scalar($value) && $value !== null) {
      ResponseHelper::sendError('Invalid request field type.', 400);
    }
    return (int) $value;
  }

  /** @return SqlRow|false */
  public static function row(mixed $value): array|false
  {
    if ($value === false) {
      return false;
    }
    if (!is_array($value)) {
      throw new UnexpectedValueException('Expected an associative database row.');
    }
    $row = [];
    foreach ($value as $key => $field) {
      $row[$key] = self::scalar($field);
    }
    return $row;
  }

  /** @return list<SqlRow> */
  public static function rows(mixed $value): array
  {
    if (!is_array($value)) {
      throw new UnexpectedValueException('Expected database rows.');
    }
    $rows = [];
    foreach ($value as $item) {
      $row = self::row($item);
      if ($row === false) {
        throw new UnexpectedValueException('Invalid database row.');
      }
      $rows[] = $row;
    }
    return $rows;
  }

  /** @return list<bool|float|int|string|null> */
  public static function column(mixed $value): array
  {
    if (!is_array($value)) {
      throw new UnexpectedValueException('Expected database column values.');
    }
    return array_values(array_map(self::scalar(...), $value));
  }
}
