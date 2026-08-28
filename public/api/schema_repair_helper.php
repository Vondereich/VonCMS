<?php

function voncms_schema_identifier(string $identifier): string
{
  if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
    throw new InvalidArgumentException('Invalid schema identifier');
  }

  return $identifier;
}

function voncms_schema_error_requires_repair(Throwable $error): bool
{
  if (!($error instanceof PDOException)) {
    return false;
  }

  $sqlState = strtoupper((string) $error->getCode());
  $driverCode = isset($error->errorInfo[1]) ? (int) $error->errorInfo[1] : 0;

  return in_array($sqlState, ['42S02', '42S22'], true) ||
    in_array($driverCode, [1054, 1146, 1932], true);
}

function voncms_schema_mutation_error_requires_repair(Throwable $error): bool
{
  if (voncms_schema_error_requires_repair($error)) {
    return true;
  }
  if (!($error instanceof PDOException)) {
    return false;
  }

  $driverCode = (int) ($error->errorInfo[1] ?? $error->getCode());

  return in_array($driverCode, [1048, 1265, 1364, 1406], true);
}

function voncms_schema_table_exists(PDO $pdo, string $table): bool
{
  $safeTable = voncms_schema_identifier($table);
  $stmt = $pdo->prepare(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
  );
  $stmt->execute([$safeTable]);

  return $stmt->fetchColumn() !== false;
}

function voncms_schema_table_storage(PDO $pdo, string $table): array
{
  $safeTable = voncms_schema_identifier($table);
  $stmt = $pdo->prepare(
    'SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
  );
  $stmt->execute([$safeTable]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!is_array($row)) {
    return [];
  }

  $columnStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CHARACTER_SET_NAME IS NOT NULL AND LOWER(CHARACTER_SET_NAME) <> 'utf8mb4'",
  );
  $columnStmt->execute([$safeTable]);
  $nonUtf8mb4Columns = (int) $columnStmt->fetchColumn();

  $collation = strtolower((string) ($row['TABLE_COLLATION'] ?? ''));

  return [
    'engine' => strtoupper((string) ($row['ENGINE'] ?? '')),
    'collation' => $collation,
    'charset' => $collation !== '' ? strtolower((string) strtok($collation, '_')) : '',
    'non_utf8mb4_columns' => $nonUtf8mb4Columns,
  ];
}

function voncms_schema_table_storage_matches(array $storage): bool
{
  return strtoupper((string) ($storage['engine'] ?? '')) === 'INNODB' &&
    strtolower((string) ($storage['charset'] ?? '')) === 'utf8mb4' &&
    (int) ($storage['non_utf8mb4_columns'] ?? -1) === 0;
}

function voncms_schema_storage_has_charset_drift(array $storage): bool
{
  return strtolower((string) ($storage['charset'] ?? '')) !== 'utf8mb4' ||
    (int) ($storage['non_utf8mb4_columns'] ?? -1) > 0;
}

function voncms_schema_repair_table_storage(
  PDO $pdo,
  array $tables,
  array $storageForeignKeySpecs = [],
): array {
  $fixes = [];
  $storageByTable = [];
  $driftedTables = [];
  foreach (array_values(array_unique($tables)) as $table) {
    $safeTable = voncms_schema_identifier((string) $table);
    $storage = voncms_schema_table_storage($pdo, $safeTable);
    if ($storage === []) {
      throw new RuntimeException("Schema repair could not inspect table storage: {$safeTable}");
    }
    if (voncms_schema_table_storage_matches($storage)) {
      continue;
    }

    $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$safeTable}`");
    $rowCount = (int) ($countStmt ? $countStmt->fetchColumn() : 0);
    if ($rowCount > 0) {
      throw new RuntimeException(
        "Schema repair stopped at populated table storage drift: {$safeTable}",
      );
    }

    $storageByTable[$safeTable] = $storage;
    $driftedTables[$safeTable] = true;
  }

  $foreignKeysToRestore = [];
  foreach ($storageForeignKeySpecs as $table => $foreignKeySpecs) {
    $safeTable = voncms_schema_identifier((string) $table);
    if (!voncms_schema_table_exists($pdo, $safeTable)) {
      continue;
    }
    foreach ($foreignKeySpecs as $spec) {
      $referencedTable = voncms_schema_identifier((string) ($spec['referenced_table'] ?? ''));
      $tableCharsetDrift =
        isset($driftedTables[$safeTable]) &&
        voncms_schema_storage_has_charset_drift($storageByTable[$safeTable]);
      $referencedCharsetDrift =
        isset($driftedTables[$referencedTable]) &&
        voncms_schema_storage_has_charset_drift($storageByTable[$referencedTable]);
      if (!$tableCharsetDrift && !$referencedCharsetDrift) {
        continue;
      }

      $foreignKeys = voncms_schema_foreign_key_map($pdo, $safeTable);
      foreach ($foreignKeys as $foreignKey) {
        if (
          !voncms_schema_foreign_key_matches($foreignKey, $spec) &&
          !voncms_schema_foreign_key_conflicts($foreignKey, $spec)
        ) {
          continue;
        }
        $safeConstraint = voncms_schema_identifier((string) $foreignKey['name']);
        $pdo->exec("ALTER TABLE `{$safeTable}` DROP FOREIGN KEY `{$safeConstraint}`");
        $fixes[] = "Schema: Released {$safeTable}.{$safeConstraint} for character-set repair.";
        $foreignKeysToRestore[$safeTable][strtolower((string) $spec['name'])] = $spec;
      }
    }
  }

  foreach ($storageByTable as $safeTable => $storage) {
    if (($storage['engine'] ?? '') !== 'INNODB') {
      $pdo->exec("ALTER TABLE `{$safeTable}` ENGINE=InnoDB");
      $fixes[] = "Schema: Reconciled {$safeTable} storage engine.";
      $storage = voncms_schema_table_storage($pdo, $safeTable);
    }
    if (voncms_schema_storage_has_charset_drift($storage)) {
      $pdo->exec("ALTER TABLE `{$safeTable}` CONVERT TO CHARACTER SET utf8mb4");
      $fixes[] = "Schema: Reconciled {$safeTable} character set.";
    }

    $verifiedStorage = voncms_schema_table_storage($pdo, $safeTable);
    if (!voncms_schema_table_storage_matches($verifiedStorage)) {
      throw new RuntimeException("Schema repair could not reconcile table storage: {$safeTable}");
    }
  }

  if ($foreignKeysToRestore !== []) {
    $foreignKeysToRestore = array_map('array_values', $foreignKeysToRestore);
    $fixes = array_merge(
      $fixes,
      voncms_schema_repair_foreign_keys($pdo, $foreignKeysToRestore, []),
    );
  }

  return $fixes;
}

function voncms_schema_column_map(PDO $pdo, string $table): array
{
  $safeTable = voncms_schema_identifier($table);
  $stmt = $pdo->query("SHOW COLUMNS FROM `{$safeTable}`");
  $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
  $columns = [];

  foreach ($rows as $row) {
    $name = strtolower((string) ($row['Field'] ?? ''));
    if ($name !== '') {
      $columns[$name] = $row;
    }
  }

  return $columns;
}

function voncms_schema_index_map(PDO $pdo, string $table): array
{
  $safeTable = voncms_schema_identifier($table);
  $stmt = $pdo->query("SHOW INDEX FROM `{$safeTable}`");
  $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
  $indexes = [];

  foreach ($rows as $row) {
    $name = strtolower((string) ($row['Key_name'] ?? ''));
    $column = strtolower((string) ($row['Column_name'] ?? ''));
    $sequence = max(1, (int) ($row['Seq_in_index'] ?? 1));
    if ($name === '' || $column === '') {
      continue;
    }

    if (!isset($indexes[$name])) {
      $indexes[$name] = [
        'name' => (string) $row['Key_name'],
        'unique' => (int) ($row['Non_unique'] ?? 1) === 0,
        'type' => strtoupper((string) ($row['Index_type'] ?? 'BTREE')),
        'columns' => [],
        'sub_parts' => [],
      ];
    }
    $indexes[$name]['columns'][$sequence] = $column;
    $indexes[$name]['sub_parts'][$sequence] = isset($row['Sub_part'])
      ? (int) $row['Sub_part']
      : null;
  }

  foreach ($indexes as &$index) {
    ksort($index['columns']);
    ksort($index['sub_parts']);
    $index['columns'] = array_values($index['columns']);
    $index['sub_parts'] = array_values($index['sub_parts']);
  }
  unset($index);

  return $indexes;
}

function voncms_schema_foreign_key_map(PDO $pdo, string $table): array
{
  $safeTable = voncms_schema_identifier($table);
  $stmt = $pdo->prepare(
    'SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.ORDINAL_POSITION, r.DELETE_RULE
     FROM information_schema.KEY_COLUMN_USAGE k
     INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
      AND r.TABLE_NAME = k.TABLE_NAME
      AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.CONSTRAINT_SCHEMA = DATABASE()
       AND k.TABLE_NAME = ?
       AND k.REFERENCED_TABLE_NAME IS NOT NULL',
  );
  $stmt->execute([$safeTable]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  $groupedForeignKeys = [];

  foreach ($rows as $row) {
    $name = (string) ($row['CONSTRAINT_NAME'] ?? '');
    if ($name === '') {
      continue;
    }
    $key = strtolower($name);
    $position = max(1, (int) ($row['ORDINAL_POSITION'] ?? 1));
    if (!isset($groupedForeignKeys[$key])) {
      $groupedForeignKeys[$key] = [
        'name' => $name,
        'columns' => [],
        'referenced_table' => strtolower((string) ($row['REFERENCED_TABLE_NAME'] ?? '')),
        'referenced_columns' => [],
        'delete_rule' => strtoupper((string) ($row['DELETE_RULE'] ?? '')),
      ];
    }
    $groupedForeignKeys[$key]['columns'][$position] = strtolower(
      (string) ($row['COLUMN_NAME'] ?? ''),
    );
    $groupedForeignKeys[$key]['referenced_columns'][$position] = strtolower(
      (string) ($row['REFERENCED_COLUMN_NAME'] ?? ''),
    );
  }

  $foreignKeys = [];
  foreach ($groupedForeignKeys as $foreignKey) {
    ksort($foreignKey['columns']);
    ksort($foreignKey['referenced_columns']);
    $foreignKey['columns'] = array_values($foreignKey['columns']);
    $foreignKey['referenced_columns'] = array_values($foreignKey['referenced_columns']);
    $foreignKey['column'] = count($foreignKey['columns']) === 1 ? $foreignKey['columns'][0] : '';
    $foreignKey['referenced_column'] =
      count($foreignKey['referenced_columns']) === 1 ? $foreignKey['referenced_columns'][0] : '';
    $foreignKeys[] = $foreignKey;
  }

  return $foreignKeys;
}

function voncms_schema_runtime_index_specs(): array
{
  return [
    'remember_tokens' => [
      ['name' => 'selector', 'columns' => ['selector'], 'unique' => true],
      ['name' => 'idx_remember_user', 'columns' => ['user_id'], 'unique' => false],
      ['name' => 'idx_remember_expires', 'columns' => ['expires_at'], 'unique' => false],
    ],
    'analytics' => [
      ['name' => 'idx_date', 'columns' => ['visit_date'], 'unique' => false],
      ['name' => 'idx_ip_date', 'columns' => ['ip_hash', 'visit_date'], 'unique' => false],
    ],
    'comment_likes' => [
      ['name' => 'unique_comment_like', 'columns' => ['comment_id', 'user_id'], 'unique' => true],
      ['name' => 'idx_comment_likes_comment', 'columns' => ['comment_id'], 'unique' => false],
      ['name' => 'idx_comment_likes_user', 'columns' => ['user_id'], 'unique' => false],
    ],
    'content_audit_logs' => [
      [
        'name' => 'idx_content_lookup',
        'columns' => ['content_type', 'content_id', 'created_at'],
        'unique' => false,
      ],
      ['name' => 'idx_actor_user', 'columns' => ['actor_user_id'], 'unique' => false],
      ['name' => 'idx_action', 'columns' => ['action'], 'unique' => false],
    ],
    'security_logs' => [
      ['name' => 'idx_security_timestamp', 'columns' => ['created_at'], 'unique' => false],
      ['name' => 'idx_security_ip', 'columns' => ['ip_address'], 'unique' => false],
      ['name' => 'idx_security_event', 'columns' => ['event_type'], 'unique' => false],
    ],
  ];
}

function voncms_schema_runtime_foreign_key_specs(): array
{
  return [
    'remember_tokens' => [
      [
        'name' => 'fk_remember_tokens_user',
        'column' => 'user_id',
        'referenced_table' => 'users',
        'referenced_column' => 'id',
        'delete_rule' => 'CASCADE',
      ],
    ],
    'comment_likes' => [
      [
        'name' => 'fk_comment_likes_comment',
        'column' => 'comment_id',
        'referenced_table' => 'comments',
        'referenced_column' => 'id',
        'delete_rule' => 'CASCADE',
      ],
      [
        'name' => 'fk_comment_likes_user',
        'column' => 'user_id',
        'referenced_table' => 'users',
        'referenced_column' => 'id',
        'delete_rule' => 'CASCADE',
      ],
    ],
  ];
}

function voncms_schema_runtime_identity_specs(): array
{
  return [
    'remember_tokens' => ['column' => 'id', 'type' => 'bigint unsigned'],
    'analytics' => ['column' => 'id', 'type' => 'int'],
    'comment_likes' => ['column' => 'id', 'type' => 'int'],
    'content_audit_logs' => ['column' => 'id', 'type' => 'bigint unsigned'],
    'security_logs' => ['column' => 'id', 'type' => 'int'],
  ];
}

function voncms_schema_normalize_column_type(string $type): string
{
  $normalized = strtolower(preg_replace('/\s+/', ' ', trim($type)));

  return preg_replace('/\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)/', '$1', $normalized);
}

function voncms_schema_normalize_default(mixed $value): ?string
{
  if ($value === null) {
    return null;
  }

  $normalized = strtolower(trim((string) $value));
  if ($normalized === 'current_timestamp()') {
    return 'current_timestamp';
  }

  return $normalized;
}

function voncms_schema_column_spec_matches(array $column, array $expected): bool
{
  if (
    voncms_schema_normalize_column_type((string) ($column['Type'] ?? '')) !==
    voncms_schema_normalize_column_type((string) ($expected['type'] ?? ''))
  ) {
    return false;
  }

  if (array_key_exists('nullable', $expected)) {
    $nullable = strtoupper((string) ($column['Null'] ?? 'YES')) === 'YES';
    if ($nullable !== (bool) $expected['nullable']) {
      return false;
    }
  }

  if (array_key_exists('default', $expected)) {
    return voncms_schema_normalize_default($column['Default'] ?? null) ===
      voncms_schema_normalize_default($expected['default']);
  }

  return true;
}

function voncms_schema_auth_column_specs(): array
{
  return [
    'email_verified' => [
      'definition' => 'TINYINT(1) DEFAULT 0',
      'type' => 'tinyint',
      'nullable' => true,
      'default' => '0',
    ],
    'display_name' => [
      'definition' => 'VARCHAR(100) DEFAULT NULL',
      'type' => 'varchar(100)',
      'nullable' => true,
      'default' => null,
    ],
    'verification_token' => [
      'definition' => 'VARCHAR(64) DEFAULT NULL',
      'type' => 'varchar(64)',
      'nullable' => true,
      'default' => null,
    ],
    'verification_token_expires' => [
      'definition' => 'DATETIME DEFAULT NULL',
      'type' => 'datetime',
      'nullable' => true,
      'default' => null,
    ],
    'reset_token' => [
      'definition' => 'VARCHAR(64) DEFAULT NULL',
      'type' => 'varchar(64)',
      'nullable' => true,
      'default' => null,
    ],
    'reset_token_expires' => [
      'definition' => 'DATETIME DEFAULT NULL',
      'type' => 'datetime',
      'nullable' => true,
      'default' => null,
    ],
  ];
}

function voncms_schema_identity_matches(array $column, array $expected): bool
{
  $type = voncms_schema_normalize_column_type((string) ($column['Type'] ?? ''));
  $expectedType = voncms_schema_normalize_column_type((string) ($expected['type'] ?? ''));
  $nullable = strtoupper((string) ($column['Null'] ?? 'YES')) === 'YES';
  $isPrimary = strtoupper((string) ($column['Key'] ?? '')) === 'PRI';
  $isAutoIncrement = stripos((string) ($column['Extra'] ?? ''), 'auto_increment') !== false;

  return $type === $expectedType && !$nullable && $isPrimary && $isAutoIncrement;
}

function voncms_schema_index_matches(array $index, array $expected): bool
{
  $typeMatches =
    strtoupper((string) ($index['type'] ?? 'BTREE')) ===
    strtoupper((string) ($expected['type'] ?? 'BTREE'));

  return $typeMatches &&
    (bool) ($index['unique'] ?? false) === (bool) ($expected['unique'] ?? false) &&
    array_values($index['columns'] ?? []) === array_values($expected['columns'] ?? []) &&
    count(array_filter($index['sub_parts'] ?? [], static fn($part): bool => $part !== null)) === 0;
}

function voncms_schema_index_conflicts(array $index, array $expected): bool
{
  $indexName = strtolower((string) ($index['name'] ?? ''));
  $expectedName = strtolower((string) ($expected['name'] ?? ''));
  if ($indexName === $expectedName && !voncms_schema_index_matches($index, $expected)) {
    return true;
  }

  return empty($expected['unique']) &&
    !empty($index['unique']) &&
    array_values($index['columns'] ?? []) === array_values($expected['columns'] ?? []);
}

function voncms_schema_foreign_key_matches(array $foreignKey, array $expected): bool
{
  return count($foreignKey['columns'] ?? []) === 1 &&
    count($foreignKey['referenced_columns'] ?? []) === 1 &&
    strtolower((string) ($foreignKey['column'] ?? '')) ===
      strtolower((string) ($expected['column'] ?? '')) &&
    strtolower((string) ($foreignKey['referenced_table'] ?? '')) ===
      strtolower((string) ($expected['referenced_table'] ?? '')) &&
    strtolower((string) ($foreignKey['referenced_column'] ?? '')) ===
      strtolower((string) ($expected['referenced_column'] ?? '')) &&
    strtoupper((string) ($foreignKey['delete_rule'] ?? '')) ===
      strtoupper((string) ($expected['delete_rule'] ?? ''));
}

function voncms_schema_foreign_key_conflicts(array $foreignKey, array $expected): bool
{
  if (voncms_schema_foreign_key_matches($foreignKey, $expected)) {
    return false;
  }

  return strtolower((string) ($foreignKey['name'] ?? '')) ===
    strtolower((string) ($expected['name'] ?? '')) ||
    in_array(
      strtolower((string) ($expected['column'] ?? '')),
      array_map('strtolower', $foreignKey['columns'] ?? []),
      true,
    );
}

function voncms_schema_missing_columns(PDO $pdo, string $table, array $requiredColumns): array
{
  if (!voncms_schema_table_exists($pdo, $table)) {
    return array_values($requiredColumns);
  }

  $columns = voncms_schema_column_map($pdo, $table);

  return array_values(
    array_filter(
      $requiredColumns,
      static fn(string $column): bool => !isset($columns[strtolower($column)]),
    ),
  );
}

function voncms_schema_capability_manifest(): array
{
  return [
    'registration' => [
      'table' => 'users',
      'columns' => [
        'email_verified',
        'display_name',
        'verification_token',
        'verification_token_expires',
      ],
    ],
    'password_reset' => [
      'table' => 'users',
      'columns' => ['reset_token', 'reset_token_expires'],
    ],
    'profile_display_name' => [
      'table' => 'users',
      'columns' => ['display_name'],
    ],
    'remember_tokens' => [
      'table' => 'remember_tokens',
      'columns' => [
        'id',
        'user_id',
        'selector',
        'token_hash',
        'expires_at',
        'last_used_at',
        'created_at',
      ],
    ],
    'analytics' => [
      'table' => 'analytics',
      'columns' => [
        'id',
        'page_url',
        'referrer',
        'user_agent',
        'ip_hash',
        'visit_date',
        'visit_time',
        'created_at',
      ],
    ],
    'comment_likes' => [
      'table' => 'comment_likes',
      'columns' => ['id', 'comment_id', 'user_id', 'created_at'],
    ],
    'content_audit' => [
      'table' => 'content_audit_logs',
      'columns' => [
        'id',
        'content_type',
        'content_id',
        'action',
        'actor_user_id',
        'actor_username',
        'actor_role',
        'summary',
        'context_json',
        'created_at',
      ],
    ],
    'security_logs' => [
      'table' => 'security_logs',
      'columns' => [
        'id',
        'event_type',
        'ip_address',
        'user_agent',
        'endpoint',
        'severity',
        'details',
        'blocked',
        'created_at',
      ],
    ],
  ];
}

function voncms_schema_core_repair_tables(): array
{
  return [
    'users',
    'posts',
    'pages',
    'media',
    'comments',
    'contact_forms',
    'contact_submissions',
    'newsletter_subscribers',
    'settings',
    'settings_audit_log',
    'redirects',
  ];
}

function voncms_schema_core_column_specs(): array
{
  return [
    'media' => [
      'filetype' => [
        'definition' => 'VARCHAR(100) DEFAULT NULL',
        'type' => 'varchar(100)',
        'nullable' => true,
        'default' => null,
      ],
      'filesize' => [
        'definition' => 'BIGINT DEFAULT 0',
        'type' => 'bigint',
        'nullable' => true,
        'default' => '0',
        'allow_populated_modify' => 'integer-widen',
      ],
      'alt_text' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
      ],
      'caption' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'default' => null,
      ],
      'description' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'default' => null,
      ],
      'created_at' => [
        'definition' => 'DATETIME DEFAULT CURRENT_TIMESTAMP',
        'type' => 'datetime',
        'nullable' => true,
        'default' => 'current_timestamp',
      ],
    ],
    'users' => [
      'bio' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'default' => null,
      ],
      'avatar' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
      ],
    ],
    'posts' => [
      'scheduled_at' => [
        'definition' => 'DATETIME DEFAULT NULL',
        'type' => 'datetime',
        'nullable' => true,
        'default' => null,
      ],
      'published_at' => [
        'definition' => 'DATETIME DEFAULT NULL',
        'type' => 'datetime',
        'nullable' => true,
        'default' => null,
      ],
      'excerpt' => ['definition' => 'TEXT NULL', 'type' => 'text', 'nullable' => true],
      'views' => [
        'definition' => 'INT DEFAULT 0',
        'type' => 'int',
        'nullable' => true,
        'default' => '0',
      ],
    ],
    'settings' => [
      'is_public' => [
        'definition' => 'BOOLEAN DEFAULT TRUE',
        'type' => 'tinyint',
        'nullable' => true,
        'default' => '1',
      ],
      'description' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
      ],
      'default_value' => [
        'definition' => 'LONGTEXT NULL',
        'type' => 'longtext',
        'nullable' => true,
        'default' => null,
      ],
      'created_by' => [
        'definition' => 'INT DEFAULT NULL',
        'type' => 'int',
        'nullable' => true,
        'default' => null,
      ],
      'updated_by' => [
        'definition' => 'INT DEFAULT NULL',
        'type' => 'int',
        'nullable' => true,
        'default' => null,
      ],
    ],
    'pages' => [
      'published_at' => [
        'definition' => 'DATETIME DEFAULT NULL',
        'type' => 'datetime',
        'nullable' => true,
        'default' => null,
      ],
      'views' => [
        'definition' => 'INT DEFAULT 0',
        'type' => 'int',
        'nullable' => true,
        'default' => '0',
      ],
      'featured_image' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
      ],
    ],
    'comments' => [
      'parent_id' => [
        'definition' => 'INT DEFAULT NULL',
        'type' => 'int',
        'nullable' => true,
        'default' => null,
      ],
      'likes' => [
        'definition' => 'INT DEFAULT 0',
        'type' => 'int',
        'nullable' => true,
        'default' => '0',
      ],
      'user_avatar' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
      ],
    ],
    'newsletter_subscribers' => [
      'unsubscribed_at' => [
        'definition' => 'DATETIME NULL',
        'type' => 'datetime',
        'nullable' => true,
      ],
      'source' => [
        'definition' => "VARCHAR(50) DEFAULT 'widget'",
        'type' => 'varchar(50)',
        'nullable' => true,
        'default' => 'widget',
      ],
    ],
  ];
}

function voncms_schema_core_index_specs(): array
{
  return [
    'settings' => [
      ['name' => 'idx_key', 'columns' => ['setting_key'], 'unique' => false, 'type' => 'BTREE'],
      ['name' => 'idx_public', 'columns' => ['is_public'], 'unique' => false, 'type' => 'BTREE'],
      ['name' => 'idx_updated', 'columns' => ['updated_at'], 'unique' => false, 'type' => 'BTREE'],
      ['name' => 'idx_version', 'columns' => ['version'], 'unique' => false, 'type' => 'BTREE'],
    ],
    'posts' => [
      [
        'name' => 'idx_scheduled',
        'columns' => ['status', 'scheduled_at'],
        'unique' => false,
        'type' => 'BTREE',
      ],
      ['name' => 'idx_category', 'columns' => ['category'], 'unique' => false, 'type' => 'BTREE'],
    ],
    'comments' => [
      ['name' => 'idx_post_id', 'columns' => ['post_id'], 'unique' => false, 'type' => 'BTREE'],
      ['name' => 'idx_status', 'columns' => ['status'], 'unique' => false, 'type' => 'BTREE'],
      [
        'name' => 'idx_created_at',
        'columns' => ['created_at'],
        'unique' => false,
        'type' => 'BTREE',
      ],
    ],
    'pages' => [
      ['name' => 'idx_status', 'columns' => ['status'], 'unique' => false, 'type' => 'BTREE'],
    ],
    'media' => [
      ['name' => 'idx_filename', 'columns' => ['filename'], 'unique' => false, 'type' => 'BTREE'],
      [
        'name' => 'idx_uploaded_at',
        'columns' => ['uploaded_at'],
        'unique' => false,
        'type' => 'BTREE',
      ],
    ],
  ];
}

function voncms_schema_core_foreign_key_specs(): array
{
  return [
    'settings' => [
      [
        'name' => 'fk_settings_created_by',
        'column' => 'created_by',
        'referenced_table' => 'users',
        'referenced_column' => 'id',
        'delete_rule' => 'SET NULL',
      ],
      [
        'name' => 'fk_settings_updated_by',
        'column' => 'updated_by',
        'referenced_table' => 'users',
        'referenced_column' => 'id',
        'delete_rule' => 'SET NULL',
      ],
    ],
    'contact_submissions' => [
      [
        'name' => 'fk_contact_submissions_form',
        'column' => 'form_id',
        'referenced_table' => 'contact_forms',
        'referenced_column' => 'id',
        'delete_rule' => 'SET NULL',
      ],
    ],
  ];
}

function voncms_schema_missing_core_repair_items(PDO $pdo): array
{
  $missing = [];
  foreach (voncms_schema_core_repair_tables() as $table) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      $missing[] = "table:{$table}";
      continue;
    }
    if (!voncms_schema_table_storage_matches(voncms_schema_table_storage($pdo, $table))) {
      $missing[] = "storage:{$table}";
    }
  }

  foreach (voncms_schema_core_column_specs() as $table => $columnSpecs) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      continue;
    }
    $columns = voncms_schema_column_map($pdo, $table);
    foreach ($columnSpecs as $column => $spec) {
      if (!voncms_schema_column_spec_matches($columns[$column] ?? [], $spec)) {
        $missing[] = "column:{$table}.{$column}";
      }
    }
  }

  foreach (voncms_schema_core_index_specs() as $table => $indexSpecs) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      continue;
    }
    $indexes = voncms_schema_index_map($pdo, $table);
    foreach ($indexSpecs as $spec) {
      $matches = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_matches($index, $spec),
      );
      $conflicts = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_conflicts($index, $spec),
      );
      if ($matches === [] || $conflicts !== []) {
        $missing[] = "index:{$table}.{$spec['name']}";
      }
    }
  }

  foreach (voncms_schema_core_foreign_key_specs() as $table => $foreignKeySpecs) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      continue;
    }
    $foreignKeys = voncms_schema_foreign_key_map($pdo, $table);
    foreach ($foreignKeySpecs as $spec) {
      $matches = array_filter(
        $foreignKeys,
        static fn(array $foreignKey): bool => voncms_schema_foreign_key_matches($foreignKey, $spec),
      );
      $conflicts = array_filter(
        $foreignKeys,
        static fn(array $foreignKey): bool => voncms_schema_foreign_key_conflicts(
          $foreignKey,
          $spec,
        ),
      );
      if ($matches === [] || $conflicts !== []) {
        $missing[] = "foreign-key:{$table}.{$spec['name']}";
      }
    }
  }

  return $missing;
}

function voncms_schema_missing_capability(PDO $pdo, string $capability): array
{
  $manifest = voncms_schema_capability_manifest();
  if (!isset($manifest[$capability])) {
    throw new InvalidArgumentException('Unknown schema capability');
  }

  $definition = $manifest[$capability];
  $table = (string) $definition['table'];
  if (!voncms_schema_table_exists($pdo, $table)) {
    return ["table:{$table}"];
  }

  $missing = array_map(
    static fn(string $column): string => "column:{$table}.{$column}",
    voncms_schema_missing_columns($pdo, $table, $definition['columns'] ?? []),
  );
  if (!voncms_schema_table_storage_matches(voncms_schema_table_storage($pdo, $table))) {
    $missing[] = "storage:{$table}";
  }

  if ($missing !== []) {
    return $missing;
  }

  $columnSpecs = voncms_schema_runtime_column_specs()[$table] ?? [];
  if ($table === 'users') {
    $requestedColumns = array_fill_keys(
      array_map('strtolower', $definition['columns'] ?? []),
      true,
    );
    $columnSpecs = array_intersect_key(voncms_schema_auth_column_specs(), $requestedColumns);
  }
  if ($columnSpecs !== []) {
    $columns = voncms_schema_column_map($pdo, $table);
    foreach ($columnSpecs as $columnName => $columnSpec) {
      if (
        $columnName !== 'id' &&
        !voncms_schema_column_spec_matches($columns[$columnName] ?? [], $columnSpec)
      ) {
        $missing[] = "column-drift:{$table}.{$columnName}";
      }
    }
  }

  $identitySpec = voncms_schema_runtime_identity_specs()[$table] ?? null;
  if ($identitySpec !== null) {
    $columns = voncms_schema_column_map($pdo, $table);
    $indexes = voncms_schema_index_map($pdo, $table);
    $identityColumn = strtolower((string) $identitySpec['column']);
    $primaryColumns = array_values($indexes['primary']['columns'] ?? []);
    if (
      !voncms_schema_identity_matches($columns[$identityColumn] ?? [], $identitySpec) ||
      $primaryColumns !== [$identityColumn]
    ) {
      $missing[] = "identity:{$table}.{$identityColumn}";
    }
  }

  $indexSpecs = voncms_schema_runtime_index_specs()[$table] ?? [];
  if ($indexSpecs !== []) {
    $indexes = voncms_schema_index_map($pdo, $table);
    foreach ($indexSpecs as $expectedIndex) {
      $matches = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_matches($index, $expectedIndex),
      );
      $conflicts = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_conflicts($index, $expectedIndex),
      );
      if ($matches === [] || $conflicts !== []) {
        $missing[] = "index:{$table}.{$expectedIndex['name']}";
      }
    }
  }

  $foreignKeySpecs = voncms_schema_runtime_foreign_key_specs()[$table] ?? [];
  if ($foreignKeySpecs !== []) {
    $foreignKeys = voncms_schema_foreign_key_map($pdo, $table);
    foreach ($foreignKeySpecs as $expectedForeignKey) {
      $matches = array_filter(
        $foreignKeys,
        static fn(array $foreignKey): bool => voncms_schema_foreign_key_matches(
          $foreignKey,
          $expectedForeignKey,
        ),
      );
      $conflicts = array_filter(
        $foreignKeys,
        static fn(array $foreignKey): bool => voncms_schema_foreign_key_conflicts(
          $foreignKey,
          $expectedForeignKey,
        ),
      );
      if ($matches === [] || $conflicts !== []) {
        $missing[] = "foreign-key:{$table}.{$expectedForeignKey['name']}";
      }
    }
  }

  return $missing;
}

function voncms_schema_has_capability(PDO $pdo, string $capability): bool
{
  try {
    return voncms_schema_missing_capability($pdo, $capability) === [];
  } catch (Throwable $e) {
    return false;
  }
}

function voncms_schema_runtime_table_sql(): array
{
  return [
    'remember_tokens' => "CREATE TABLE IF NOT EXISTS remember_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      selector CHAR(24) NOT NULL UNIQUE,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      last_used_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_remember_user (user_id),
      INDEX idx_remember_expires (expires_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'analytics' => "CREATE TABLE IF NOT EXISTS analytics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_url VARCHAR(500),
      referrer VARCHAR(500),
      user_agent TEXT,
      ip_hash VARCHAR(64) COMMENT 'SHA256 hashed IP for privacy',
      visit_date DATE,
      visit_time TIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_date (visit_date),
      INDEX idx_ip_date (ip_hash, visit_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'comment_likes' => "CREATE TABLE IF NOT EXISTS comment_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_comment_like (comment_id, user_id),
      INDEX idx_comment_likes_comment (comment_id),
      INDEX idx_comment_likes_user (user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'content_audit_logs' => "CREATE TABLE IF NOT EXISTS content_audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      content_type ENUM('post', 'page') NOT NULL,
      content_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(32) NOT NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_username VARCHAR(255) NOT NULL DEFAULT '',
      actor_role VARCHAR(64) NOT NULL DEFAULT '',
      summary VARCHAR(255) NOT NULL DEFAULT '',
      context_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_content_lookup (content_type, content_id, created_at),
      INDEX idx_actor_user (actor_user_id),
      INDEX idx_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    'security_logs' => "CREATE TABLE IF NOT EXISTS security_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      user_agent TEXT,
      endpoint VARCHAR(255),
      severity VARCHAR(20) NOT NULL,
      details TEXT,
      blocked TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_security_timestamp (created_at),
      INDEX idx_security_ip (ip_address),
      INDEX idx_security_event (event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  ];
}

function voncms_schema_runtime_column_specs(): array
{
  return [
    'remember_tokens' => [
      'id' => [
        'definition' => 'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY',
        'type' => 'bigint unsigned',
        'safe' => false,
      ],
      'user_id' => [
        'definition' => 'INT NOT NULL',
        'type' => 'int',
        'nullable' => false,
        'safe' => false,
      ],
      'selector' => [
        'definition' => 'CHAR(24) NOT NULL',
        'type' => 'char(24)',
        'nullable' => false,
        'safe' => false,
      ],
      'token_hash' => [
        'definition' => 'CHAR(64) NOT NULL',
        'type' => 'char(64)',
        'nullable' => false,
        'safe' => false,
      ],
      'expires_at' => [
        'definition' => 'DATETIME NOT NULL',
        'type' => 'datetime',
        'nullable' => false,
        'safe' => false,
      ],
      'last_used_at' => [
        'definition' => 'DATETIME DEFAULT NULL',
        'type' => 'datetime',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'created_at' => [
        'definition' => 'DATETIME DEFAULT CURRENT_TIMESTAMP',
        'type' => 'datetime',
        'default' => 'current_timestamp',
        'safe' => true,
      ],
    ],
    'analytics' => [
      'id' => [
        'definition' => 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY',
        'type' => 'int',
        'safe' => false,
      ],
      'page_url' => [
        'definition' => 'VARCHAR(500) DEFAULT NULL',
        'type' => 'varchar(500)',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'referrer' => [
        'definition' => 'VARCHAR(500) DEFAULT NULL',
        'type' => 'varchar(500)',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'user_agent' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'safe' => true,
      ],
      'ip_hash' => [
        'definition' => "VARCHAR(64) DEFAULT NULL COMMENT 'SHA256 hashed IP for privacy'",
        'type' => 'varchar(64)',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'visit_date' => [
        'definition' => 'DATE DEFAULT NULL',
        'type' => 'date',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'visit_time' => [
        'definition' => 'TIME DEFAULT NULL',
        'type' => 'time',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'created_at' => [
        'definition' => 'DATETIME DEFAULT CURRENT_TIMESTAMP',
        'type' => 'datetime',
        'default' => 'current_timestamp',
        'safe' => true,
      ],
    ],
    'comment_likes' => [
      'id' => [
        'definition' => 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY',
        'type' => 'int',
        'safe' => false,
      ],
      'comment_id' => [
        'definition' => 'INT NOT NULL',
        'type' => 'int',
        'nullable' => false,
        'safe' => false,
      ],
      'user_id' => [
        'definition' => 'INT NOT NULL',
        'type' => 'int',
        'nullable' => false,
        'safe' => false,
      ],
      'created_at' => [
        'definition' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'type' => 'timestamp',
        'default' => 'current_timestamp',
        'safe' => true,
      ],
    ],
    'content_audit_logs' => [
      'id' => [
        'definition' => 'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY',
        'type' => 'bigint unsigned',
        'safe' => false,
      ],
      'content_type' => [
        'definition' => "ENUM('post', 'page') NOT NULL",
        'type' => "enum('post','page')",
        'nullable' => false,
        'safe' => false,
      ],
      'content_id' => [
        'definition' => 'BIGINT UNSIGNED NOT NULL',
        'type' => 'bigint unsigned',
        'nullable' => false,
        'safe' => false,
      ],
      'action' => [
        'definition' => 'VARCHAR(32) NOT NULL',
        'type' => 'varchar(32)',
        'nullable' => false,
        'safe' => false,
      ],
      'actor_user_id' => [
        'definition' => 'BIGINT UNSIGNED DEFAULT NULL',
        'type' => 'bigint unsigned',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'actor_username' => [
        'definition' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'type' => 'varchar(255)',
        'nullable' => false,
        'default' => '',
        'safe' => true,
      ],
      'actor_role' => [
        'definition' => "VARCHAR(64) NOT NULL DEFAULT ''",
        'type' => 'varchar(64)',
        'nullable' => false,
        'default' => '',
        'safe' => true,
      ],
      'summary' => [
        'definition' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'type' => 'varchar(255)',
        'nullable' => false,
        'default' => '',
        'safe' => true,
      ],
      'context_json' => [
        'definition' => 'LONGTEXT NULL',
        'type' => 'longtext',
        'nullable' => true,
        'safe' => true,
      ],
      'created_at' => [
        'definition' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'type' => 'datetime',
        'nullable' => false,
        'default' => 'current_timestamp',
        'safe' => true,
      ],
    ],
    'security_logs' => [
      'id' => [
        'definition' => 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY',
        'type' => 'int',
        'safe' => false,
      ],
      'event_type' => [
        'definition' => 'VARCHAR(50) NOT NULL',
        'type' => 'varchar(50)',
        'nullable' => false,
        'safe' => false,
      ],
      'ip_address' => [
        'definition' => 'VARCHAR(45) NOT NULL',
        'type' => 'varchar(45)',
        'nullable' => false,
        'safe' => false,
      ],
      'user_agent' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'safe' => true,
      ],
      'endpoint' => [
        'definition' => 'VARCHAR(255) DEFAULT NULL',
        'type' => 'varchar(255)',
        'nullable' => true,
        'default' => null,
        'safe' => true,
      ],
      'severity' => [
        'definition' => 'VARCHAR(20) NOT NULL',
        'type' => 'varchar(20)',
        'nullable' => false,
        'safe' => false,
      ],
      'details' => [
        'definition' => 'TEXT NULL',
        'type' => 'text',
        'nullable' => true,
        'safe' => true,
      ],
      'blocked' => [
        'definition' => 'TINYINT(1) DEFAULT 1',
        'type' => 'tinyint',
        'default' => '1',
        'safe' => true,
      ],
      'created_at' => [
        'definition' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'type' => 'timestamp',
        'default' => 'current_timestamp',
        'safe' => true,
      ],
    ],
  ];
}

function voncms_schema_repair_runtime_columns(PDO $pdo): array
{
  $fixes = [];

  foreach (voncms_schema_runtime_column_specs() as $table => $columnSpecs) {
    $columns = voncms_schema_column_map($pdo, $table);
    $rowCount = null;
    foreach ($columnSpecs as $column => $columnSpec) {
      if (isset($columns[$column])) {
        if (
          $column !== 'id' &&
          !voncms_schema_column_spec_matches($columns[$column], $columnSpec)
        ) {
          if ($rowCount === null) {
            $countStmt = $pdo->query(
              'SELECT COUNT(*) FROM `' . voncms_schema_identifier($table) . '`',
            );
            $rowCount = (int) ($countStmt ? $countStmt->fetchColumn() : 0);
          }
          if ($rowCount > 0) {
            throw new RuntimeException(
              "Schema repair stopped at an unsafe column drift: {$table}.{$column}",
            );
          }

          $safeTable = voncms_schema_identifier($table);
          $safeColumn = voncms_schema_identifier($column);
          $definition = (string) $columnSpec['definition'];
          $pdo->exec("ALTER TABLE `{$safeTable}` MODIFY COLUMN `{$safeColumn}` {$definition}");
          $fixes[] = "Schema: Reconciled {$table}.{$column}.";
          $columns = voncms_schema_column_map($pdo, $table);
        }
        continue;
      }

      if (!($columnSpec['safe'] ?? false)) {
        if ($rowCount === null) {
          $countStmt = $pdo->query(
            'SELECT COUNT(*) FROM `' . voncms_schema_identifier($table) . '`',
          );
          $rowCount = (int) ($countStmt ? $countStmt->fetchColumn() : 0);
        }
        if ($rowCount > 0) {
          throw new RuntimeException(
            "Schema repair stopped at an incomplete populated table: {$table}.{$column}",
          );
        }
      }

      $safeTable = voncms_schema_identifier($table);
      $safeColumn = voncms_schema_identifier($column);
      $definition = (string) $columnSpec['definition'];
      $pdo->exec("ALTER TABLE `{$safeTable}` ADD COLUMN `{$safeColumn}` {$definition}");
      $fixes[] = "Schema: Added {$table}.{$column}.";
      $columns = voncms_schema_column_map($pdo, $table);
    }
  }

  return $fixes;
}

function voncms_schema_repair_runtime_identities(PDO $pdo): array
{
  $fixes = [];

  foreach (voncms_schema_runtime_identity_specs() as $table => $expected) {
    $columns = voncms_schema_column_map($pdo, $table);
    $indexes = voncms_schema_index_map($pdo, $table);
    $columnName = (string) $expected['column'];
    $column = $columns[$columnName] ?? [];
    $primary = $indexes['primary'] ?? null;
    if (
      $column !== [] &&
      voncms_schema_identity_matches($column, $expected) &&
      array_values($primary['columns'] ?? []) === [$columnName]
    ) {
      continue;
    }

    $safeTable = voncms_schema_identifier($table);
    $safeColumn = voncms_schema_identifier($columnName);
    $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$safeTable}`");
    $rowCount = (int) ($countStmt ? $countStmt->fetchColumn() : 0);
    if ($rowCount > 0) {
      throw new RuntimeException("Schema repair stopped at an unsafe identity drift: {$table}.id");
    }

    if ($primary !== null && ($primary['columns'] ?? []) !== [$columnName]) {
      throw new RuntimeException("Schema repair stopped at an unexpected primary key: {$table}");
    }

    $safeType = (string) $expected['type'];
    if ($primary === null) {
      $pdo->exec("ALTER TABLE `{$safeTable}` MODIFY COLUMN `{$safeColumn}` {$safeType} NOT NULL");
      $pdo->exec("ALTER TABLE `{$safeTable}` ADD PRIMARY KEY (`{$safeColumn}`)");
    }
    $pdo->exec(
      "ALTER TABLE `{$safeTable}` MODIFY COLUMN `{$safeColumn}` {$safeType} NOT NULL AUTO_INCREMENT",
    );

    $columns = voncms_schema_column_map($pdo, $table);
    if (!voncms_schema_identity_matches($columns[$columnName] ?? [], $expected)) {
      throw new RuntimeException("Schema repair could not reconcile identity: {$table}.id");
    }
    $fixes[] = "Schema: Reconciled identity {$table}.id.";
  }

  return $fixes;
}

function voncms_schema_repair_indexes(PDO $pdo, array $allIndexSpecs): array
{
  $fixes = [];

  foreach ($allIndexSpecs as $table => $expectedIndexes) {
    foreach ($expectedIndexes as $expected) {
      $indexes = voncms_schema_index_map($pdo, $table);
      $expectedName = strtolower((string) $expected['name']);
      $matchingIndex = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_matches($index, $expected),
      );
      $conflictingIndexes = array_filter(
        $indexes,
        static fn(array $index): bool => voncms_schema_index_conflicts($index, $expected),
      );
      $conflictingCanonical = $indexes[$expectedName] ?? null;
      if ($matchingIndex !== []) {
        foreach ($conflictingIndexes as $conflictingIndex) {
          $safeTable = voncms_schema_identifier($table);
          $safeConflictingName = voncms_schema_identifier((string) $conflictingIndex['name']);
          $pdo->exec("DROP INDEX `{$safeConflictingName}` ON `{$safeTable}`");
          $fixes[] = "Schema: Removed mismatched index {$table}.{$safeConflictingName}.";
        }
        continue;
      }

      if (!empty($expected['unique'])) {
        $safeTable = voncms_schema_identifier($table);
        $nonnullChecks = [];
        $groupColumns = [];
        foreach ($expected['columns'] as $column) {
          $safeColumn = voncms_schema_identifier((string) $column);
          $nonnullChecks[] = "`{$safeColumn}` IS NOT NULL";
          $groupColumns[] = "`{$safeColumn}`";
        }
        $duplicateStmt = $pdo->query(
          "SELECT 1 FROM `{$safeTable}` WHERE " .
            implode(' AND ', $nonnullChecks) .
            ' GROUP BY ' .
            implode(', ', $groupColumns) .
            ' HAVING COUNT(*) > 1 LIMIT 1',
        );
        if ($duplicateStmt && $duplicateStmt->fetchColumn() !== false) {
          throw new RuntimeException(
            "Schema repair stopped because {$table}.{$expected['name']} contains duplicate data",
          );
        }
      }

      $safeTable = voncms_schema_identifier($table);
      $indexName = (string) $expected['name'];
      if ($conflictingCanonical !== null) {
        $indexName = 'voncms_fix_' . substr(hash('sha256', $table . ':' . $indexName), 0, 20);
        if (isset($indexes[strtolower($indexName)])) {
          throw new RuntimeException("Schema repair index name conflict: {$table}.{$indexName}");
        }
      }
      $safeIndex = voncms_schema_identifier($indexName);
      $safeColumns = array_map(
        static fn(string $column): string => '`' . voncms_schema_identifier($column) . '`',
        $expected['columns'],
      );
      $unique = !empty($expected['unique']) ? 'UNIQUE ' : '';
      $pdo->exec(
        "CREATE {$unique}INDEX `{$safeIndex}` ON `{$safeTable}` (" .
          implode(', ', $safeColumns) .
          ')',
      );
      $fixes[] = "Schema: Reconciled index {$table}.{$safeIndex}.";

      foreach ($conflictingIndexes as $conflictingIndex) {
        $safeConflictingName = voncms_schema_identifier((string) $conflictingIndex['name']);
        $pdo->exec("DROP INDEX `{$safeConflictingName}` ON `{$safeTable}`");
        $fixes[] = "Schema: Removed mismatched index {$table}.{$safeConflictingName}.";
      }

      $verifiedIndexes = voncms_schema_index_map($pdo, $table);
      $verifiedMatch = array_filter(
        $verifiedIndexes,
        static fn(array $index): bool => voncms_schema_index_matches($index, $expected),
      );
      $verifiedConflicts = array_filter(
        $verifiedIndexes,
        static fn(array $index): bool => voncms_schema_index_conflicts($index, $expected),
      );
      if ($verifiedMatch === [] || $verifiedConflicts !== []) {
        throw new RuntimeException(
          "Schema repair could not reconcile index: {$table}.{$expectedName}",
        );
      }
    }
  }

  return $fixes;
}

function voncms_schema_repair_foreign_keys(
  PDO $pdo,
  array $allForeignKeySpecs,
  array $orphanChecks,
): array {
  $fixes = [];

  foreach ($orphanChecks as $orphanCheck) {
    $label = (string) ($orphanCheck['label'] ?? 'table');
    $orphanStmt = $pdo->query((string) ($orphanCheck['sql'] ?? ''));
    if ($orphanStmt && $orphanStmt->fetchColumn() !== false) {
      throw new RuntimeException(
        "Schema repair stopped because {$label} contains orphaned references",
      );
    }
  }

  foreach ($allForeignKeySpecs as $table => $expectedForeignKeys) {
    foreach ($expectedForeignKeys as $expected) {
      $foreignKeys = voncms_schema_foreign_key_map($pdo, $table);
      $matchingForeignKey = array_filter(
        $foreignKeys,
        static fn(array $foreignKey): bool => voncms_schema_foreign_key_matches(
          $foreignKey,
          $expected,
        ),
      );

      if ($matchingForeignKey === []) {
        $existingNames = [];
        foreach ($foreignKeys as $foreignKey) {
          $existingNames[strtolower((string) $foreignKey['name'])] = true;
        }

        $constraintName = (string) $expected['name'];
        if (isset($existingNames[strtolower($constraintName)])) {
          $constraintName =
            'voncms_fix_' . substr(hash('sha256', $table . ':' . $constraintName), 0, 20);
          if (isset($existingNames[strtolower($constraintName)])) {
            throw new RuntimeException(
              "Schema repair foreign-key name conflict: {$table}.{$constraintName}",
            );
          }
        }

        $safeTable = voncms_schema_identifier($table);
        $safeConstraint = voncms_schema_identifier($constraintName);
        $safeColumn = voncms_schema_identifier((string) $expected['column']);
        $safeReferencedTable = voncms_schema_identifier((string) $expected['referenced_table']);
        $safeReferencedColumn = voncms_schema_identifier((string) $expected['referenced_column']);
        $deleteRule = strtoupper((string) $expected['delete_rule']);
        if (!in_array($deleteRule, ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'], true)) {
          throw new InvalidArgumentException('Invalid schema delete rule');
        }
        $pdo->exec(
          "ALTER TABLE `{$safeTable}` ADD CONSTRAINT `{$safeConstraint}` FOREIGN KEY (`{$safeColumn}`) REFERENCES `{$safeReferencedTable}` (`{$safeReferencedColumn}`) ON DELETE {$deleteRule}",
        );
        $fixes[] = "Schema: Reconciled foreign key {$table}.{$safeConstraint}.";
        $foreignKeys = voncms_schema_foreign_key_map($pdo, $table);
      }

      foreach ($foreignKeys as $foreignKey) {
        if (voncms_schema_foreign_key_conflicts($foreignKey, $expected)) {
          $safeTable = voncms_schema_identifier($table);
          $safeConstraint = voncms_schema_identifier((string) $foreignKey['name']);
          $pdo->exec("ALTER TABLE `{$safeTable}` DROP FOREIGN KEY `{$safeConstraint}`");
          $fixes[] = "Schema: Removed mismatched foreign key {$table}.{$safeConstraint}.";
        }
      }
    }
  }

  return $fixes;
}

function voncms_schema_repair_core_columns(PDO $pdo): array
{
  $fixes = [];
  foreach (voncms_schema_core_column_specs() as $table => $columnSpecs) {
    $safeTable = voncms_schema_identifier($table);
    $columns = voncms_schema_column_map($pdo, $table);
    $rowCount = null;
    foreach ($columnSpecs as $column => $spec) {
      $safeColumn = voncms_schema_identifier($column);
      $definition = (string) $spec['definition'];
      if (!isset($columns[$column])) {
        $pdo->exec("ALTER TABLE `{$safeTable}` ADD COLUMN `{$safeColumn}` {$definition}");
        $fixes[] = "Schema: Added {$table}.{$column}.";
        $columns = voncms_schema_column_map($pdo, $table);
        continue;
      }

      if (voncms_schema_column_spec_matches($columns[$column], $spec)) {
        continue;
      }

      if ($rowCount === null) {
        $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$safeTable}`");
        $rowCount = (int) ($countStmt ? $countStmt->fetchColumn() : 0);
      }
      $allowPopulatedModify = false;
      if (($spec['allow_populated_modify'] ?? '') === 'integer-widen') {
        $currentType = voncms_schema_normalize_column_type(
          (string) ($columns[$column]['Type'] ?? ''),
        );
        $integerBaseType = preg_replace('/\s+unsigned$/', '', $currentType);
        $allowPopulatedModify =
          $currentType === 'bigint' ||
          in_array($integerBaseType, ['tinyint', 'smallint', 'mediumint', 'int'], true);
      }
      if ($rowCount > 0 && !$allowPopulatedModify) {
        throw new RuntimeException(
          "Schema repair stopped at an unsafe core column drift: {$table}.{$column}",
        );
      }

      $pdo->exec("ALTER TABLE `{$safeTable}` MODIFY COLUMN `{$safeColumn}` {$definition}");
      $fixes[] = "Schema: Reconciled {$table}.{$column}.";
      $columns = voncms_schema_column_map($pdo, $table);
    }
  }

  return $fixes;
}

function voncms_schema_backfill_publication_timestamps(PDO $pdo): array
{
  $fixes = [];
  $postStmt = $pdo->prepare(
    "UPDATE posts
     SET published_at = COALESCE(scheduled_at, created_at)
     WHERE published_at IS NULL AND (status = 'published' OR status IS NULL)",
  );
  $postStmt->execute();
  $postCount = (int) $postStmt->rowCount();
  if ($postCount > 0) {
    $fixes[] = "Schema: Backfilled first publication time for {$postCount} posts.";
  }

  $pageStmt = $pdo->prepare(
    "UPDATE pages
     SET published_at = created_at
     WHERE published_at IS NULL AND status = 'published'",
  );
  $pageStmt->execute();
  $pageCount = (int) $pageStmt->rowCount();
  if ($pageCount > 0) {
    $fixes[] = "Schema: Backfilled first publication time for {$pageCount} pages.";
  }

  return $fixes;
}

function voncms_schema_repair_optional_search_indexes(PDO $pdo): array
{
  $fixes = [];
  $warnings = [];
  $optionalSpecs = [
    'posts' => [
      [
        'name' => 'ft_title_content',
        'columns' => ['title', 'content'],
        'unique' => false,
        'type' => 'FULLTEXT',
      ],
    ],
    'pages' => [
      [
        'name' => 'ft_title_content',
        'columns' => ['title', 'content'],
        'unique' => false,
        'type' => 'FULLTEXT',
      ],
    ],
  ];

  foreach ($optionalSpecs as $table => $specs) {
    foreach ($specs as $spec) {
      try {
        $indexes = voncms_schema_index_map($pdo, $table);
        $matches = array_filter(
          $indexes,
          static fn(array $index): bool => voncms_schema_index_matches($index, $spec),
        );
        if ($matches !== []) {
          continue;
        }
        $safeTable = voncms_schema_identifier($table);
        $safeIndex = voncms_schema_identifier((string) $spec['name']);
        if (isset($indexes[strtolower((string) $spec['name'])])) {
          $warnings[] = "{$table}: Optional FULLTEXT index has a conflicting definition.";
          continue;
        }
        $safeColumns = array_map(
          static fn(string $column): string => '`' . voncms_schema_identifier($column) . '`',
          $spec['columns'],
        );
        $pdo->exec(
          "ALTER TABLE `{$safeTable}` ADD FULLTEXT INDEX `{$safeIndex}` (" .
            implode(', ', $safeColumns) .
            ')',
        );
        $fixes[] = "Schema: Added optional FULLTEXT index {$table}.{$safeIndex}.";
      } catch (Throwable $e) {
        $warnings[] = "{$table}: Optional FULLTEXT index is unavailable.";
      }
    }
  }

  return ['fixes' => $fixes, 'warnings' => $warnings];
}

function voncms_schema_repair_core_structures(PDO $pdo): array
{
  $fixes = voncms_schema_repair_table_storage(
    $pdo,
    voncms_schema_core_repair_tables(),
    voncms_schema_core_foreign_key_specs(),
  );
  $fixes = array_merge($fixes, voncms_schema_repair_core_columns($pdo));
  $fixes = array_merge($fixes, voncms_schema_backfill_publication_timestamps($pdo));
  $warnings = [];
  $fixes = array_merge(
    $fixes,
    voncms_schema_repair_indexes($pdo, voncms_schema_core_index_specs()),
  );
  $fixes = array_merge(
    $fixes,
    voncms_schema_repair_foreign_keys($pdo, voncms_schema_core_foreign_key_specs(), [
      [
        'label' => 'settings.created_by',
        'sql' =>
          'SELECT 1 FROM settings s LEFT JOIN users u ON s.created_by = u.id WHERE s.created_by IS NOT NULL AND u.id IS NULL LIMIT 1',
      ],
      [
        'label' => 'settings.updated_by',
        'sql' =>
          'SELECT 1 FROM settings s LEFT JOIN users u ON s.updated_by = u.id WHERE s.updated_by IS NOT NULL AND u.id IS NULL LIMIT 1',
      ],
      [
        'label' => 'contact_submissions.form_id',
        'sql' =>
          'SELECT 1 FROM contact_submissions s LEFT JOIN contact_forms f ON s.form_id = f.id WHERE s.form_id IS NOT NULL AND f.id IS NULL LIMIT 1',
      ],
    ]),
  );
  $optionalResult = voncms_schema_repair_optional_search_indexes($pdo);
  $fixes = array_merge($fixes, $optionalResult['fixes']);
  $warnings = array_merge($warnings, $optionalResult['warnings']);

  $missing = voncms_schema_missing_core_repair_items($pdo);
  if ($missing !== []) {
    throw new RuntimeException('Core schema verification failed: ' . implode(', ', $missing));
  }

  return ['fixes' => $fixes, 'warnings' => $warnings];
}

function voncms_schema_repair_auth_columns(PDO $pdo): array
{
  $fixes = [];
  $warnings = [];
  $columns = voncms_schema_column_map($pdo, 'users');
  $columnSpecs = voncms_schema_auth_column_specs();

  foreach ($columnSpecs as $column => $columnSpec) {
    $definition = (string) $columnSpec['definition'];
    if (!isset($columns[$column])) {
      $pdo->exec("ALTER TABLE users ADD COLUMN `{$column}` {$definition}");
      $fixes[] = "Users: Added {$column}.";
    }
  }

  $columns = voncms_schema_column_map($pdo, 'users');
  foreach ($columnSpecs as $column => $columnSpec) {
    if (voncms_schema_column_spec_matches($columns[$column] ?? [], $columnSpec)) {
      continue;
    }

    if (in_array($column, ['verification_token', 'reset_token'], true)) {
      $maxLengthStmt = $pdo->query("SELECT COALESCE(MAX(CHAR_LENGTH(`{$column}`)), 0) FROM users");
      $maxLength = (int) ($maxLengthStmt ? $maxLengthStmt->fetchColumn() : 0);
      if ($maxLength > 64) {
        throw new RuntimeException(
          "Schema repair stopped because users.{$column} contains a value longer than 64 characters",
        );
      }
    } elseif ($column === 'display_name') {
      $maxLengthStmt = $pdo->query(
        'SELECT COALESCE(MAX(CHAR_LENGTH(`display_name`)), 0) FROM users',
      );
      $maxLength = (int) ($maxLengthStmt ? $maxLengthStmt->fetchColumn() : 0);
      if ($maxLength > 100) {
        throw new RuntimeException(
          'Schema repair stopped because users.display_name contains a value longer than 100 characters',
        );
      }
    } elseif ($column === 'email_verified') {
      $invalidValueStmt = $pdo->query(
        "SELECT 1 FROM users WHERE email_verified IS NOT NULL AND TRIM(CAST(email_verified AS CHAR)) NOT IN ('0', '1') LIMIT 1",
      );
      if ($invalidValueStmt && $invalidValueStmt->fetchColumn() !== false) {
        throw new RuntimeException(
          'Schema repair stopped because users.email_verified contains an unsupported value',
        );
      }
    } else {
      $valueStmt = $pdo->query("SELECT 1 FROM users WHERE `{$column}` IS NOT NULL LIMIT 1");
      if ($valueStmt && $valueStmt->fetchColumn() !== false) {
        throw new RuntimeException(
          "Schema repair stopped at an unsafe auth column drift: users.{$column}",
        );
      }
    }

    $definition = (string) $columnSpec['definition'];
    $pdo->exec("ALTER TABLE users MODIFY COLUMN `{$column}` {$definition}");
    $fixes[] = "Users: Reconciled {$column}.";
    $columns = voncms_schema_column_map($pdo, 'users');
  }

  return ['fixes' => $fixes, 'warnings' => $warnings];
}

function voncms_schema_repair_runtime_capabilities(PDO $pdo): array
{
  $fixes = [];
  $warnings = [];

  foreach (voncms_schema_runtime_table_sql() as $table => $sql) {
    $wasMissing = !voncms_schema_table_exists($pdo, $table);
    if ($wasMissing) {
      $pdo->exec($sql);
    }
    if (!voncms_schema_table_exists($pdo, $table)) {
      throw new RuntimeException("Schema repair could not create {$table}");
    }
    if ($wasMissing) {
      $fixes[] = "Schema: Created {$table}.";
    }
  }

  $fixes = array_merge(
    $fixes,
    voncms_schema_repair_table_storage($pdo, array_keys(voncms_schema_runtime_table_sql())),
  );
  $fixes = array_merge($fixes, voncms_schema_repair_runtime_columns($pdo));
  $fixes = array_merge($fixes, voncms_schema_repair_runtime_identities($pdo));

  $authResult = voncms_schema_repair_auth_columns($pdo);
  $fixes = array_merge($fixes, $authResult['fixes']);
  $warnings = array_merge($warnings, $authResult['warnings']);

  $fixes = array_merge(
    $fixes,
    voncms_schema_repair_indexes($pdo, voncms_schema_runtime_index_specs()),
  );
  $fixes = array_merge(
    $fixes,
    voncms_schema_repair_foreign_keys($pdo, voncms_schema_runtime_foreign_key_specs(), [
      [
        'label' => 'remember_tokens',
        'sql' =>
          'SELECT 1 FROM remember_tokens rt LEFT JOIN users u ON rt.user_id = u.id WHERE u.id IS NULL LIMIT 1',
      ],
      [
        'label' => 'comment_likes',
        'sql' =>
          'SELECT 1 FROM comment_likes cl LEFT JOIN comments c ON cl.comment_id = c.id LEFT JOIN users u ON cl.user_id = u.id WHERE c.id IS NULL OR u.id IS NULL LIMIT 1',
      ],
    ]),
  );

  foreach (array_keys(voncms_schema_capability_manifest()) as $capability) {
    $missing = voncms_schema_missing_capability($pdo, $capability);
    if ($missing !== []) {
      throw new RuntimeException("Schema capability verification failed: {$capability}");
    }
  }

  return ['fixes' => $fixes, 'warnings' => $warnings];
}

function voncms_schema_repair_lock_name(PDO $pdo): string
{
  $databaseName = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();

  return 'voncms:schema:' . substr(hash('sha256', $databaseName), 0, 32);
}

function voncms_schema_acquire_repair_lock(PDO $pdo, int $timeoutSeconds = 3): ?string
{
  $lockName = voncms_schema_repair_lock_name($pdo);
  $stmt = $pdo->prepare('SELECT GET_LOCK(?, ?)');
  $stmt->execute([$lockName, max(0, min(10, $timeoutSeconds))]);

  return (int) $stmt->fetchColumn() === 1 ? $lockName : null;
}

function voncms_schema_release_repair_lock(PDO $pdo, ?string $lockName): void
{
  if ($lockName === null || $lockName === '') {
    return;
  }

  try {
    $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
    $stmt->execute([$lockName]);
  } catch (Throwable $e) {
    error_log('VonCMS schema repair lock release failed');
  }
}
