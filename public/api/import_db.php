<?php
/**
 * VonCMS - Database Import API
 * Imports SQL file to database
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  ResponseHelper::sendError('Database not configured', 503);
}

// Enforce Security
SessionManager::requireValidSession();
CSRFProtection::requireToken();

// Owner-only: database imports can overwrite the whole CMS state.
SessionManager::requirePrimaryAdmin();

// Check for uploaded file
if (!isset($_FILES['sqlfile']) || $_FILES['sqlfile']['error'] !== UPLOAD_ERR_OK) {
  ResponseHelper::sendError('No SQL file uploaded', 400);
}

$file = $_FILES['sqlfile'];

// Validate file type
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if ($ext !== 'sql') {
  ResponseHelper::sendError('Only .sql files allowed', 400);
}

// Max 50MB
if ($file['size'] > 50 * 1024 * 1024) {
  ResponseHelper::sendError('File too large (max 50MB)', 400);
}

// Increase limits for large imports without leaving the request unbounded forever.
set_time_limit(300);
ini_set('memory_limit', '512M'); // Increase memory

function getImportMysqlBufferedQueryAttribute(): ?int
{
  if (defined('Pdo\\Mysql::ATTR_USE_BUFFERED_QUERY')) {
    return constant('Pdo\\Mysql::ATTR_USE_BUFFERED_QUERY');
  }

  if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
    return constant('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY');
  }

  return null;
}

/**
 * @param string $statement
 * @return string
 */
function stripLeadingSqlComments($statement)
{
  $statement = trim($statement);

  while ($statement !== '') {
    if (strpos($statement, '--') === 0 || strpos($statement, '#') === 0) {
      $lineBreak = strpos($statement, "\n");
      if ($lineBreak === false) {
        return '';
      }
      $statement = ltrim(substr($statement, $lineBreak + 1));
      continue;
    }

    if (strpos($statement, '/*') === 0) {
      $commentEnd = strpos($statement, '*/');
      if ($commentEnd === false) {
        return '';
      }
      $statement = ltrim(substr($statement, $commentEnd + 2));
      continue;
    }

    break;
  }

  return $statement;
}

/**
 * @param string $line
 * @param int $index
 * @return bool
 */
function isSqlQuoteEscaped($line, $index)
{
  $slashes = 0;
  for ($i = $index - 1; $i >= 0; $i--) {
    if ($line[$i] !== '\\') {
      break;
    }
    $slashes++;
  }

  return $slashes % 2 === 1;
}

/**
 * @param string $path
 * @return Generator<int, string, void, void>
 */
function iterateSqlStatementsFromFile($path)
{
  $handle = fopen($path, 'rb');
  if (!$handle) {
    throw new Exception('Could not read uploaded SQL file.');
  }

  $buffer = '';
  $inSingleQuote = false;
  $inDoubleQuote = false;
  $inBacktick = false;
  $inLineComment = false;
  $inBlockComment = false;

  try {
    while (($line = fgets($handle)) !== false) {
      $length = strlen($line);
      for ($i = 0; $i < $length; $i++) {
        $char = $line[$i];
        $next = $i + 1 < $length ? $line[$i + 1] : null;
        $third = $i + 2 < $length ? $line[$i + 2] : null;

        if ($inLineComment) {
          $buffer .= $char;
          if ($char === "\n") {
            $inLineComment = false;
          }
          continue;
        }

        if ($inBlockComment) {
          $buffer .= $char;
          if ($char === '*' && $next === '/') {
            $buffer .= $next;
            $i++;
            $inBlockComment = false;
          }
          continue;
        }

        if (!$inSingleQuote && !$inDoubleQuote && !$inBacktick) {
          if ($char === '-' && $next === '-' && ($third === null || ctype_space($third))) {
            $buffer .= $char . $next;
            $i++;
            $inLineComment = true;
            continue;
          }

          if ($char === '#') {
            $buffer .= $char;
            $inLineComment = true;
            continue;
          }

          if ($char === '/' && $next === '*') {
            $buffer .= $char . $next;
            $i++;
            $inBlockComment = true;
            continue;
          }
        }

        if ($char === "'" && !$inDoubleQuote && !$inBacktick) {
          $buffer .= $char;
          if ($inSingleQuote) {
            if ($next === "'") {
              $buffer .= $next;
              $i++;
              continue;
            }
            if (!isSqlQuoteEscaped($line, $i)) {
              $inSingleQuote = false;
            }
          } else {
            $inSingleQuote = true;
          }
          continue;
        }

        if ($char === '"' && !$inSingleQuote && !$inBacktick) {
          $buffer .= $char;
          if ($inDoubleQuote) {
            if ($next === '"') {
              $buffer .= $next;
              $i++;
              continue;
            }
            if (!isSqlQuoteEscaped($line, $i)) {
              $inDoubleQuote = false;
            }
          } else {
            $inDoubleQuote = true;
          }
          continue;
        }

        if ($char === '`' && !$inSingleQuote && !$inDoubleQuote) {
          $buffer .= $char;
          $inBacktick = !$inBacktick;
          continue;
        }

        if ($char === ';' && !$inSingleQuote && !$inDoubleQuote && !$inBacktick) {
          $statement = trim($buffer);
          if ($statement !== '') {
            yield $statement;
          }
          $buffer = '';
          continue;
        }

        $buffer .= $char;
      }

      if ($inLineComment) {
        $inLineComment = false;
      }
    }

    if (!feof($handle)) {
      throw new Exception('Failed while reading the uploaded SQL file.');
    }

    $statement = trim($buffer);
    if ($statement !== '') {
      yield $statement;
    }
  } finally {
    fclose($handle);
  }
}

/**
 * @param string $statement
 * @return string
 */
function getAllowedImportStatementType($statement)
{
  $statement = trim($statement);

  $identifier = '(?:`(?:``|[^`])+`|[a-zA-Z0-9_$]+)';
  $columnList = $identifier . '(?:\s*,\s*' . $identifier . ')*';

  if (preg_match('/^DROP\s+TABLE\s+IF\s+EXISTS\s+' . $identifier . '\s*$/is', $statement)) {
    return 'drop_table';
  }

  if (
    preg_match(
      '/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?' . $identifier . '\s*\(/is',
      $statement,
    ) &&
    !preg_match('/\b(?:AS\s+SELECT|DATA\s+DIRECTORY|INDEX\s+DIRECTORY|TABLESPACE)\b/i', $statement)
  ) {
    return 'create_table';
  }

  if (
    preg_match(
      '/^INSERT\s+INTO\s+' . $identifier . '\s*\(\s*' . $columnList . '\s*\)\s+VALUES\s*\(/is',
      $statement,
    )
  ) {
    return 'insert';
  }

  if (preg_match('/^SET\s+(?:SESSION\s+)?FOREIGN_KEY_CHECKS\s*=\s*[01]\s*$/i', $statement)) {
    return 'set_foreign_keys';
  }

  return '';
}

/**
 * @param string $statement
 * @return string
 */
function getImportTableName($statement)
{
  if (
    preg_match(
      '/^(?:DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?|CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(`[^`]+`|[^\s(]+)/i',
      trim($statement),
      $matches,
    )
  ) {
    return trim($matches[1], "` \t\n\r\0\x0B");
  }

  return '';
}

/**
 * @param iterable<string> $statements
 * @return array{count: int, statements: array<int, string>, tables: array<int, string>}
 */
function detectDestructiveImportStatements($statements)
{
  $summary = [
    'count' => 0,
    'statements' => [],
    'tables' => [],
  ];

  foreach ($statements as $rawStatement) {
    $statement = stripLeadingSqlComments($rawStatement);
    if (empty($statement)) {
      continue;
    }

    $statementType = getAllowedImportStatementType($statement);
    if ($statementType !== 'drop_table' && $statementType !== 'create_table') {
      continue;
    }

    $verb = $statementType === 'drop_table' ? 'DROP' : 'CREATE';
    $table = getImportTableName($statement);
    $summary['count']++;
    $summary['statements'][] = $verb . ($table !== '' ? ' ' . $table : '');
    if ($table !== '') {
      $summary['tables'][] = $table;
    }
  }

  $summary['tables'] = array_values(array_unique($summary['tables']));
  $summary['statements'] = array_slice($summary['statements'], 0, 20);

  return $summary;
}

/**
 * @param string $backupDir
 * @param string $currentPath
 * @param int $maxFiles
 * @param int $maxAgeDays
 * @return void
 */
function prunePreImportSafetyBackups($backupDir, $currentPath, $maxFiles = 5, $maxAgeDays = 30)
{
  $files = glob($backupDir . '/pre_import_*.sql');
  if (!is_array($files)) {
    return;
  }

  usort($files, function ($left, $right) use ($currentPath) {
    if ($left === $currentPath) {
      return -1;
    }
    if ($right === $currentPath) {
      return 1;
    }
    return (filemtime($right) ?: 0) <=> (filemtime($left) ?: 0);
  });

  $cutoff = time() - $maxAgeDays * 86400;
  foreach ($files as $index => $backupPath) {
    if ($backupPath === $currentPath) {
      continue;
    }

    $modifiedAt = filemtime($backupPath) ?: 0;
    if ($index >= $maxFiles || $modifiedAt < $cutoff) {
      @unlink($backupPath);
    }
  }
}

/**
 * @param resource $handle
 * @param string $data
 * @param callable|null $writer
 * @return int
 */
function writePreImportSafetyBackupData($handle, $data, $writer = null)
{
  $length = strlen($data);
  $offset = 0;

  while ($offset < $length) {
    $chunk = substr($data, $offset);
    $written = $writer ? $writer($handle, $chunk) : fwrite($handle, $chunk);
    if (!is_int($written) || $written < 1 || $written > strlen($chunk)) {
      throw new RuntimeException('Could not complete the pre-import safety backup write.');
    }
    $offset += $written;
  }

  return $offset;
}

/**
 * @param PDO $pdo
 * @return array{filename: string, relativePath: string}
 */
function createPreImportSafetyBackup($pdo)
{
  $backupDir = __DIR__ . '/../data/backups';
  if (!is_dir($backupDir) && !mkdir($backupDir, 0755, true) && !is_dir($backupDir)) {
    throw new Exception('Could not create pre-import safety backup directory.');
  }

  $htaccessPath = $backupDir . '/.htaccess';
  if (!file_exists($htaccessPath)) {
    $protectionWritten = file_put_contents(
      $htaccessPath,
      "<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\nOptions -Indexes\n",
    );
    if ($protectionWritten === false) {
      throw new Exception('Could not protect the pre-import safety backup directory.');
    }
  }

  $filename = 'pre_import_' . date('Y-m-d_His') . '_' . bin2hex(random_bytes(4)) . '.sql';
  $path = $backupDir . '/' . $filename;
  $handle = fopen($path, 'wb');

  if (!$handle) {
    throw new Exception('Could not create pre-import safety backup file.');
  }

  try {
    writePreImportSafetyBackupData($handle, "-- VonCMS Pre-Import Safety Backup\n");
    writePreImportSafetyBackupData($handle, '-- Generated: ' . date('Y-m-d H:i:s') . "\n");
    writePreImportSafetyBackupData(
      $handle,
      "-- Reason: destructive Database Manager import confirmation\n",
    );
    writePreImportSafetyBackupData(
      $handle,
      "-- --------------------------------------------------------\n\n",
    );
    writePreImportSafetyBackupData($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

    $bufferedQueryAttribute = getImportMysqlBufferedQueryAttribute();
    $restoreBufferedQueries = $bufferedQueryAttribute !== null;
    $previousBufferedQueryMode = true;

    if ($restoreBufferedQueries) {
      $previousBufferedQueryMode = $pdo->getAttribute($bufferedQueryAttribute);
      $pdo->setAttribute($bufferedQueryAttribute, false);
    }

    try {
      $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
      foreach ($tables as $table) {
        $createStmt = $pdo->query("SHOW CREATE TABLE `$table`");
        $createRow = $createStmt->fetch(PDO::FETCH_ASSOC);
        $createStmt->closeCursor();

        writePreImportSafetyBackupData($handle, "-- \n");
        writePreImportSafetyBackupData($handle, "-- Table structure: `$table`\n");
        writePreImportSafetyBackupData($handle, "-- \n");
        writePreImportSafetyBackupData($handle, "DROP TABLE IF EXISTS `$table`;\n");
        writePreImportSafetyBackupData($handle, $createRow['Create Table'] . ";\n\n");

        $stmt = $pdo->query("SELECT * FROM `$table`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
          $columns = array_keys($row);
          $values = [];
          foreach ($row as $value) {
            $values[] = $value === null ? 'NULL' : $pdo->quote($value);
          }

          writePreImportSafetyBackupData(
            $handle,
            "INSERT INTO `$table` (`" .
              implode('`, `', $columns) .
              '`) VALUES (' .
              implode(', ', $values) .
              ");\n",
          );
        }
        $stmt->closeCursor();
        writePreImportSafetyBackupData($handle, "\n");
      }
    } finally {
      if ($restoreBufferedQueries) {
        $pdo->setAttribute($bufferedQueryAttribute, $previousBufferedQueryMode);
      }
    }

    writePreImportSafetyBackupData($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
    writePreImportSafetyBackupData($handle, "-- End of pre-import safety backup\n");

    if (!fflush($handle)) {
      throw new RuntimeException('Could not flush the pre-import safety backup file.');
    }

    $expectedFileSize = ftell($handle);
    if (!is_int($expectedFileSize) || $expectedFileSize < 1) {
      throw new RuntimeException('Could not verify the pre-import safety backup size.');
    }

    $closed = fclose($handle);
    $handle = null;
    if (!$closed) {
      throw new RuntimeException('Could not close the pre-import safety backup file.');
    }

    clearstatcache(true, $path);
    $savedFileSize = filesize($path);
    if (!is_int($savedFileSize) || $savedFileSize !== $expectedFileSize) {
      throw new RuntimeException('Pre-import safety backup size verification failed.');
    }
  } catch (Throwable $e) {
    if (is_resource($handle)) {
      @fclose($handle);
    }
    @unlink($path);
    throw $e;
  }

  @chmod($path, 0600);
  prunePreImportSafetyBackups($backupDir, $path);

  return [
    'filename' => $filename,
    'relativePath' => 'public/data/backups/' . $filename,
  ];
}

/**
 * @param PDO $pdo
 * @return void
 */
function safeRollbackImport($pdo)
{
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
}

try {
  if (($file['size'] ?? 0) <= 0) {
    ResponseHelper::sendError('Empty SQL file', 400);
    exit();
  }

  $executed = 0;
  $safetyBackup = null;
  $hasExecutableStatements = false;

  foreach (iterateSqlStatementsFromFile($file['tmp_name']) as $rawStatement) {
    $statement = stripLeadingSqlComments($rawStatement);
    if (empty($statement)) {
      continue;
    }

    $hasExecutableStatements = true;
    if (getAllowedImportStatementType($statement) === '') {
      ResponseHelper::sendError(
        'Only unqualified DROP TABLE IF EXISTS, CREATE TABLE, INSERT INTO, and SET FOREIGN_KEY_CHECKS statements from a VonCMS backup are allowed.',
        403,
      );
      exit();
    }
  }

  if (!$hasExecutableStatements) {
    ResponseHelper::sendError('Empty SQL file', 400);
    exit();
  }

  $destructiveSummary = detectDestructiveImportStatements(
    iterateSqlStatementsFromFile($file['tmp_name']),
  );
  $confirmedDestructiveImport =
    isset($_POST['confirm_destructive_import']) && $_POST['confirm_destructive_import'] === 'yes';

  if ($destructiveSummary['count'] > 0 && !$confirmedDestructiveImport) {
    echo json_encode([
      'success' => false,
      'requiresConfirmation' => true,
      'message' =>
        'This SQL contains DROP/CREATE statements and may overwrite the current database.',
      'destructiveStatements' => $destructiveSummary['statements'],
      'destructiveTables' => $destructiveSummary['tables'],
    ]);
    exit();
  }

  if ($destructiveSummary['count'] > 0) {
    $safetyBackup = createPreImportSafetyBackup($pdo);
  }

  // Transaction protects against partial imports for DML statements (INSERT, SET).
  // Note: MySQL/MariaDB DDL statements (DROP, CREATE) cause implicit commits,
  // so a truncated or interrupted import may still leave the database partially restored.
  $pdo->beginTransaction();

  // Disable foreign key checks during import
  $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

  foreach (iterateSqlStatementsFromFile($file['tmp_name']) as $rawStatement) {
    $statement = stripLeadingSqlComments($rawStatement);

    if (empty($statement)) {
      continue;
    }

    if (getAllowedImportStatementType($statement) === '') {
      safeRollbackImport($pdo);
      $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
      ResponseHelper::sendError(
        'Only unqualified DROP TABLE IF EXISTS, CREATE TABLE, INSERT INTO, and SET FOREIGN_KEY_CHECKS statements from a VonCMS backup are allowed.',
        403,
      );
      exit();
    }

    try {
      $pdo->exec($statement);
      $executed++;
    } catch (Exception $e) {
      safeRollbackImport($pdo);
      $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
      ResponseHelper::sendError($e);
    }
  }

  // Re-enable foreign key checks and commit
  $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
  if ($pdo->inTransaction()) {
    $pdo->commit();
  }
  voncms_public_cache_clear();

  echo json_encode([
    'success' => true,
    'message' => "Import complete. Executed $executed statements.",
    'executed' => $executed,
    'safetyBackup' => $safetyBackup,
  ]);
} catch (Exception $e) {
  // Always re-enable FK checks even if something unexpected fails
  try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
  } catch (Throwable $ignored) {
  }
  ResponseHelper::sendError($e);
}
