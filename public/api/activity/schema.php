<?php

if (
  is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
  realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__
) {
  http_response_code(403);
  exit('Forbidden');
}

function voncms_activity_schema_sql(): string
{
  return "CREATE TABLE IF NOT EXISTS staff_activity_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(32) NOT NULL,
    actor_user_id BIGINT UNSIGNED DEFAULT NULL,
    actor_username VARCHAR(255) NOT NULL DEFAULT '',
    actor_role VARCHAR(64) NOT NULL DEFAULT '',
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(255) NOT NULL DEFAULT '',
    target_label VARCHAR(255) NOT NULL DEFAULT '',
    outcome VARCHAR(16) NOT NULL,
    details_json TEXT NULL,
    request_key CHAR(64) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_activity_request (request_key),
    INDEX idx_activity_date (created_at, id),
    INDEX idx_activity_actor (actor_user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
}

/** @return array<string,array{definition:string,type:string,nullable?:bool,default?:string|null,safe?:bool}> */
function voncms_activity_column_specs(): array
{
  return [
    'id' => [
      'definition' => 'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY',
      'type' => 'bigint unsigned',
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
    'target_type' => [
      'definition' => 'VARCHAR(32) NOT NULL',
      'type' => 'varchar(32)',
      'nullable' => false,
      'safe' => false,
    ],
    'target_id' => [
      'definition' => "VARCHAR(255) NOT NULL DEFAULT ''",
      'type' => 'varchar(255)',
      'nullable' => false,
      'default' => '',
      'safe' => true,
    ],
    'target_label' => [
      'definition' => "VARCHAR(255) NOT NULL DEFAULT ''",
      'type' => 'varchar(255)',
      'nullable' => false,
      'default' => '',
      'safe' => true,
    ],
    'outcome' => [
      'definition' => 'VARCHAR(16) NOT NULL',
      'type' => 'varchar(16)',
      'nullable' => false,
      'safe' => false,
    ],
    'details_json' => [
      'definition' => 'TEXT NULL',
      'type' => 'text',
      'nullable' => true,
      'safe' => true,
    ],
    'request_key' => [
      'definition' => 'CHAR(64) DEFAULT NULL',
      'type' => 'char(64)',
      'nullable' => true,
      'default' => null,
      'safe' => true,
    ],
    'created_at' => [
      'definition' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'type' => 'datetime',
      'nullable' => false,
      'default' => 'current_timestamp',
      'safe' => true,
    ],
  ];
}
