<?php
/**
 * VonCMS - Database Backup API
 * Generates SQL dump of all tables for download
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security
SessionManager::requireValidSession();

// 1.6 Backup DB CSRF leakage (Fix)
// Restrict to POST and use standard CSRF validation (Headers/Body)
// This prevents tokens from leaking into server/access logs via query string URL.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method Not Allowed. POST required for backups.', 405);
}
CSRFProtection::requireToken();

// Owner-only: database dumps can expose raw settings, credentials, and user data.
SessionManager::requirePrimaryAdmin();

/**
 * @param mixed $value
 * @return string
 */
function sanitizeBackupFilenamePart($value)
{
  $value = trim((string) $value);
  if ($value === '') {
    return 'voncms';
  }

  $value = preg_replace('/[^a-zA-Z0-9]+/', '-', $value);
  $value = trim(strtolower($value), '-');

  return $value !== '' ? $value : 'voncms';
}

function getBackupMysqlBufferedQueryAttribute(): ?int
{
  if (defined('Pdo\\Mysql::ATTR_USE_BUFFERED_QUERY')) {
    return constant('Pdo\\Mysql::ATTR_USE_BUFFERED_QUERY');
  }

  if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
    return constant('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY');
  }

  return null;
}

function setBackupMysqlBufferedQueryMode(PDO $pdo, bool $buffered): void
{
  $attribute = getBackupMysqlBufferedQueryAttribute();
  if ($attribute !== null) {
    $pdo->setAttribute($attribute, $buffered);
  }
}

/**
 * @param PDO $pdo
 * @return string
 */
function getBackupSiteLabel($pdo)
{
  $siteName = '';

  try {
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'general' AND setting_key = 'site_name' LIMIT 1",
    );
    $stmt->execute();
    $siteName = (string) $stmt->fetchColumn();
  } catch (Throwable $ignored) {
  }

  if ($siteName === '') {
    $siteName = (string) ($_SERVER['HTTP_HOST'] ?? 'voncms');
  }

  return sanitizeBackupFilenamePart($siteName);
}

/**
 * @param resource $stream
 */
function writeBackupStream($stream, string $content): void
{
  $length = strlen($content);
  $offset = 0;

  while ($offset < $length) {
    $written = fwrite($stream, substr($content, $offset));
    if ($written === false || $written === 0) {
      throw new RuntimeException('Failed to write complete database backup.');
    }
    $offset += $written;
  }
}

$backupStream = null;

try {
  // Get all tables
  $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);

  if (empty($tables)) {
    ResponseHelper::sendError('No tables found', 404);
  }

  // Generate backup filename
  $backupLabel = getBackupSiteLabel($pdo);
  $timestamp = date('Y-m-d_His');
  $filename = "backup_{$backupLabel}_{$timestamp}.sql";

  $backupStream = fopen('php://temp/maxmemory:5242880', 'w+b');
  if ($backupStream === false) {
    throw new RuntimeException('Unable to create database backup stream.');
  }

  // SQL header
  writeBackupStream($backupStream, "-- VonCMS Database Backup\n");
  writeBackupStream($backupStream, '-- Generated: ' . date('Y-m-d H:i:s') . "\n");
  writeBackupStream(
    $backupStream,
    '-- Server: ' .
      preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost')) .
      "\n",
  );
  writeBackupStream($backupStream, '-- Tables: ' . count($tables) . "\n");
  writeBackupStream(
    $backupStream,
    "-- --------------------------------------------------------\n\n",
  );
  writeBackupStream($backupStream, "SET FOREIGN_KEY_CHECKS=0;\n\n");

  // Unbuffered query - stream rows one-by-one instead of loading entire table into PHP memory
  setBackupMysqlBufferedQueryMode($pdo, false);

  foreach ($tables as $table) {
    // Get CREATE TABLE statement
    $createStmt = $pdo->query("SHOW CREATE TABLE `$table`")->fetch();

    writeBackupStream($backupStream, "-- \n");
    writeBackupStream($backupStream, "-- Table structure: `$table`\n");
    writeBackupStream($backupStream, "-- \n");
    writeBackupStream($backupStream, "DROP TABLE IF EXISTS `$table`;\n");
    writeBackupStream($backupStream, $createStmt['Create Table'] . ";\n\n");

    // Get data count for header
    $rowCount = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();

    if ($rowCount > 0) {
      writeBackupStream($backupStream, "-- \n");
      writeBackupStream($backupStream, "-- Data for table: `$table` ($rowCount rows)\n");
      writeBackupStream($backupStream, "-- \n");

      $stmt = $pdo->query("SELECT * FROM `$table`");
      while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns = array_keys($row);

        $values = [];
        foreach ($row as $key => $v) {
          if ($v === null) {
            $values[] = 'NULL';
          } else {
            $values[] = $pdo->quote($v);
          }
        }

        writeBackupStream(
          $backupStream,
          "INSERT INTO `$table` (`" .
            implode('`, `', $columns) .
            '`) VALUES (' .
            implode(', ', $values) .
            ");\n",
        );
      }
      writeBackupStream($backupStream, "\n");
    }
  }

  // Restore buffered query mode for any subsequent operations
  setBackupMysqlBufferedQueryMode($pdo, true);

  writeBackupStream($backupStream, "SET FOREIGN_KEY_CHECKS=1;\n");
  writeBackupStream($backupStream, "-- End of backup\n");

  if (!rewind($backupStream)) {
    throw new RuntimeException('Unable to finalize database backup stream.');
  }

  $backupStat = fstat($backupStream);
  if (!is_array($backupStat) || !isset($backupStat['size'])) {
    throw new RuntimeException('Unable to verify database backup size.');
  }

  header('Content-Type: application/sql');
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Content-Length: ' . (int) $backupStat['size']);
  header('Cache-Control: no-cache, no-store, must-revalidate');

  $sentBytes = fpassthru($backupStream);
  if ($sentBytes === false || $sentBytes !== (int) $backupStat['size']) {
    error_log('Database backup transfer ended before the complete stream was sent.');
  }
  fclose($backupStream);
  $backupStream = null;
} catch (Throwable $e) {
  // Ensure buffered query mode is restored on error
  if (isset($pdo)) {
    setBackupMysqlBufferedQueryMode($pdo, true);
  }
  if (is_resource($backupStream)) {
    fclose($backupStream);
  }
  ResponseHelper::sendError($e);
}
