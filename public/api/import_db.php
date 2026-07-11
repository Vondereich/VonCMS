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
function getImportStatementVerb($statement)
{
  if (preg_match('/^([a-zA-Z]+)/', trim($statement), $matches)) {
    return strtoupper($matches[1]);
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

    $verb = getImportStatementVerb($statement);
    if ($verb !== 'DROP' && $verb !== 'CREATE') {
      continue;
    }

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
    file_put_contents(
      $htaccessPath,
      "<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\nOptions -Indexes\n",
    );
  }

  $filename = 'pre_import_' . date('Y-m-d_His') . '_' . bin2hex(random_bytes(4)) . '.sql';
  $path = $backupDir . '/' . $filename;
  $handle = fopen($path, 'wb');

  if (!$handle) {
    throw new Exception('Could not create pre-import safety backup file.');
  }

  fwrite($handle, "-- VonCMS Pre-Import Safety Backup\n");
  fwrite($handle, '-- Generated: ' . date('Y-m-d H:i:s') . "\n");
  fwrite($handle, "-- Reason: destructive Database Manager import confirmation\n");
  fwrite($handle, "-- --------------------------------------------------------\n\n");
  fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

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

      fwrite($handle, "-- \n");
      fwrite($handle, "-- Table structure: `$table`\n");
      fwrite($handle, "-- \n");
      fwrite($handle, "DROP TABLE IF EXISTS `$table`;\n");
      fwrite($handle, $createRow['Create Table'] . ";\n\n");

      $stmt = $pdo->query("SELECT * FROM `$table`");
      while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns = array_keys($row);
        $values = [];
        foreach ($row as $value) {
          $values[] = $value === null ? 'NULL' : $pdo->quote($value);
        }

        fwrite(
          $handle,
          "INSERT INTO `$table` (`" .
            implode('`, `', $columns) .
            '`) VALUES (' .
            implode(', ', $values) .
            ");\n",
        );
      }
      $stmt->closeCursor();
      fwrite($handle, "\n");
    }
  } finally {
    if ($restoreBufferedQueries) {
      $pdo->setAttribute($bufferedQueryAttribute, $previousBufferedQueryMode);
    }
  }

  fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
  fwrite($handle, "-- End of pre-import safety backup\n");
  fclose($handle);
  @chmod($path, 0600);

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
    if (preg_match('/^CREATE\s+(DATABASE|SCHEMA)\b/i', trim($statement))) {
      ResponseHelper::sendError(
        'CREATE DATABASE and CREATE SCHEMA are not supported in Database Manager imports. Connect VonCMS to the target database first, then import a VonCMS table backup.',
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

    if (preg_match('/^CREATE\s+(DATABASE|SCHEMA)\b/i', trim($statement))) {
      safeRollbackImport($pdo);
      $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
      ResponseHelper::sendError(
        'CREATE DATABASE and CREATE SCHEMA are not supported in Database Manager imports. Connect VonCMS to the target database first, then import a VonCMS table backup.',
        403,
      );
      exit();
    }

    // SECURITY: Allowlist - permit INSERT, CREATE, SET, and DROP statements
    // DROP is required to restore VonCMS-generated backups (DROP TABLE IF EXISTS)
    $stmtUpper = strtoupper(trim($statement));
    $allowed = ['INSERT ', 'CREATE ', 'SET ', 'DROP '];
    $isAllowed = false;
    foreach ($allowed as $a) {
      if (strpos($stmtUpper, $a) === 0) {
        $isAllowed = true;
        break;
      }
    }
    if (!$isAllowed) {
      safeRollbackImport($pdo);
      $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
      ResponseHelper::sendError(
        'Only INSERT, CREATE, SET, and DROP statements are allowed in imports.',
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
