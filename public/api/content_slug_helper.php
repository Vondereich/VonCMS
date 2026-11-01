<?php
/** Shared Post/Page slug reservation. Public routing priority is deliberately unchanged. */
if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/../core/DataBoundary.php';

final class VonCmsContentSlugLock
{
  private function __construct(private PDO $pdo, private ?string $name) {}

  public static function acquire(PDO $pdo): self
  {
    // SQLite is used only by isolated, single-connection endpoint fixtures.
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
      return new self($pdo, null);
    }

    $databaseStatement = $pdo->query('SELECT DATABASE()');
    if ($databaseStatement === false) {
      throw new RuntimeException('Content save could not identify the database.');
    }
    $database = $databaseStatement->fetchColumn();
    if (!is_string($database) || $database === '') {
      throw new RuntimeException('Content save could not identify the database.');
    }
    $name = 'voncms:content-slugs:' . substr(hash('sha256', $database), 0, 32);
    $statement = $pdo->prepare('SELECT GET_LOCK(?, ?)');
    $statement->execute([$name, 3]);
    if ((int) $statement->fetchColumn() !== 1) {
      throw new RuntimeException('Content save is busy. Please try again.');
    }
    return new self($pdo, $name);
  }

  public function release(): void
  {
    if ($this->name === null) {
      return;
    }
    $name = $this->name;
    $this->name = null;
    try {
      $statement = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
      $statement->execute([$name]);
    } catch (Throwable $error) {
      error_log('VonCMS content slug lock release failed');
    }
  }

  public function __destruct()
  {
    $this->release();
  }
}

function voncms_content_slug_conflicts(PDO $pdo, string $contentType, string $slug): bool
{
  if (!in_array($contentType, ['post', 'page'], true)) {
    throw new InvalidArgumentException('Invalid content type');
  }
  $otherTable = $contentType === 'post' ? 'pages' : 'posts';
  $statement = $pdo->prepare("SELECT 1 FROM {$otherTable} WHERE slug = ? LIMIT 1");
  $statement->bindValue(1, $slug, PDO::PARAM_STR);
  $statement->execute();
  return $statement->fetchColumn() !== false;
}

/**
 * Capture the inserted identity before MySQL's unlock SELECT resets PDO::lastInsertId().
 * @param array<array-key, mixed> $values PDO execution parameters.
 */
function voncms_insert_with_slug_reservation(
  PDO $pdo,
  string $contentType,
  string $slug,
  PDOStatement $statement,
  array $values,
): string {
  $lock = VonCmsContentSlugLock::acquire($pdo);
  try {
    if (voncms_content_slug_conflicts($pdo, $contentType, $slug)) {
      throw new RuntimeException(
        'Slug is reserved by another content type. Choose a different slug.',
        409,
      );
    }
    $table = $contentType === 'post' ? 'posts' : 'pages';
    $existing = $pdo->prepare("SELECT 1 FROM {$table} WHERE slug = ? LIMIT 1");
    $existing->bindValue(1, $slug, PDO::PARAM_STR);
    $existing->execute();
    if ($existing->fetchColumn() !== false) {
      throw new PDOException('Slug already exists.', 23000);
    }
    $statement->execute($values);
    return (string) $pdo->lastInsertId();
  } finally {
    $lock->release();
  }
}
