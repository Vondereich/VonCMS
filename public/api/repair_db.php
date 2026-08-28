<?php
/**
 * VonCMS - Database Schema Repair API
 * Checks for missing tables, columns, and indexes and fixes them automatically.
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/schema_repair_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
require_once __DIR__ . '/publication_time_helper.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Enforce Security (Admin Only)
SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

if (session_status() === PHP_SESSION_ACTIVE) {
  session_write_close();
}

// 5. Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  echo json_encode([
    'success' => false,
    'error' => 'Database not configured. Cannot repair without credentials.',
  ]);
  exit();
}

function voncms_run_database_schema_repair(PDO $pdo): array
{
  $fixes = [];
  $warnings = [];
  $missingCoreTables = [];
  foreach (voncms_schema_core_repair_tables() as $table) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      $missingCoreTables[] = $table;
    }
  }

  // --- 1. CORE TABLE CHECKS (Create if missing) ---

  // --- 1. CORE USER & AUTHENTICATION ---

  // USERS Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'Member',
        display_name VARCHAR(100) DEFAULT NULL,
        avatar VARCHAR(255),
        bio TEXT,
        email_verified TINYINT(1) DEFAULT 0,
        verification_token VARCHAR(64) DEFAULT NULL,
        verification_token_expires DATETIME DEFAULT NULL,
        reset_token VARCHAR(64) DEFAULT NULL,
        reset_token_expires DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // --- 2. CONTENT MANAGEMENT ---

  // POSTS Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        content LONGTEXT,
        excerpt TEXT,
        image_url VARCHAR(255),
        author VARCHAR(100),
        author_id INT,
        status VARCHAR(20) DEFAULT 'draft',
        scheduled_at DATETIME DEFAULT NULL,
        published_at DATETIME DEFAULT NULL,
        category VARCHAR(100) DEFAULT 'Uncategorized',
        keywords VARCHAR(255),
        meta_description TEXT,
        views INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        posts_status_idx VARCHAR(20) GENERATED ALWAYS AS (status) VIRTUAL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status_date (status, created_at),
        INDEX idx_scheduled (status, scheduled_at),
        INDEX idx_category (category),
        INDEX idx_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // PAGES Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        content LONGTEXT,
        excerpt TEXT,
        author VARCHAR(100),
        author_id INT,
        status VARCHAR(20) DEFAULT 'draft',
        published_at DATETIME DEFAULT NULL,
        featured_image VARCHAR(255) DEFAULT NULL,
        keywords VARCHAR(255),
        meta_description TEXT,
        views INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // MEDIA Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(255) NOT NULL,
        filetype VARCHAR(100) DEFAULT NULL,
        filesize BIGINT DEFAULT 0,
        uploaded_by INT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // --- 3. ENGAGEMENT & FEATURES ---

  // COMMENTS Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        parent_id INT DEFAULT NULL,
        user_id INT,
        user_name VARCHAR(100),
        user_avatar VARCHAR(255),
        content TEXT NOT NULL,
        likes INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'approved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // CONTACT FORMS
  $pdo->exec("CREATE TABLE IF NOT EXISTS contact_forms (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        template LONGTEXT,
        mail_to VARCHAR(255),
        mail_from VARCHAR(255),
        mail_subject VARCHAR(255),
        mail_body LONGTEXT,
        msg_success TEXT,
        msg_error TEXT,
        msg_validation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // CONTACT SUBMISSIONS
  $pdo->exec("CREATE TABLE IF NOT EXISTS contact_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        form_id VARCHAR(50),
        data LONGTEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_form_id (form_id),
        INDEX idx_created (created_at),
        FOREIGN KEY (form_id) REFERENCES contact_forms(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // NEWSLETTER & SUBSCRIBERS
  $pdo->exec("CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        status ENUM('active', 'unsubscribed') DEFAULT 'active',
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at DATETIME NULL,
        ip_address VARCHAR(45),
        source VARCHAR(50) DEFAULT 'widget',
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_subscribed_at (subscribed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // --- 4. SYSTEM & CONFIGURATION ---

  // SETTINGS Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_group VARCHAR(50) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value LONGTEXT,
        setting_type VARCHAR(20) DEFAULT 'string',
        is_sensitive BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT TRUE,
        description VARCHAR(255) DEFAULT NULL,
        default_value LONGTEXT NULL,
        version INT DEFAULT 1,
        created_by INT DEFAULT NULL,
        updated_by INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_group_key (setting_group, setting_key),
        INDEX idx_group (setting_group),
        INDEX idx_key (setting_key),
        INDEX idx_public (is_public),
        INDEX idx_updated (updated_at),
        INDEX idx_version (version),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // --- 5. LOGS & ANALYTICS ---

  // SETTINGS AUDIT LOG (Change History)
  $pdo->exec("CREATE TABLE IF NOT EXISTS settings_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_id INT NOT NULL,
        setting_group VARCHAR(50) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        old_value LONGTEXT,
        new_value LONGTEXT,
        changed_by INT DEFAULT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_type ENUM('INSERT', 'UPDATE', 'DELETE') DEFAULT 'UPDATE',
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent TEXT NULL,
        INDEX idx_setting_id (setting_id),
        INDEX idx_changed_at (changed_at),
        INDEX idx_changed_by (changed_by),
        INDEX idx_group_key (setting_group, setting_key),
        FOREIGN KEY (setting_id) REFERENCES settings(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // REDIRECTS Table SEO Velocity
  $pdo->exec("CREATE TABLE IF NOT EXISTS redirects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_url VARCHAR(500) NOT NULL,
        target_url VARCHAR(500) NOT NULL,
        redirect_type INT DEFAULT 301,
        hit_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_source (source_url(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  foreach ($missingCoreTables as $table) {
    if (!voncms_schema_table_exists($pdo, $table)) {
      throw new RuntimeException("Database repair could not create required table: {$table}");
    }
    $fixes[] = "Schema: Created required table {$table}.";
  }

  $runtimeCapabilityResult = voncms_schema_repair_runtime_capabilities($pdo);
  $fixes = array_merge($fixes, $runtimeCapabilityResult['fixes']);
  $warnings = array_merge($warnings, $runtimeCapabilityResult['warnings']);

  $coreStructureResult = voncms_schema_repair_core_structures($pdo);
  $fixes = array_merge($fixes, $coreStructureResult['fixes']);
  $warnings = array_merge($warnings, $coreStructureResult['warnings']);

  // Shared core column, index, foreign-key, and optional search-index repair is owned above.
  try {
    $apiPrivacyFix = $pdo->exec(
      "UPDATE settings SET is_public = 0 WHERE setting_group = 'api' AND setting_key = 'config'",
    );
    if ($apiPrivacyFix > 0) {
      $fixes[] = 'Settings: Forced API config blob to admin-only.';
    }
  } catch (Throwable $e) {
    $warnings[] = 'Settings: API privacy row could not be reconciled.';
  }

  // --- 4. DATA HYGIENE (Drift Fixes) ---

  // Fix: Force Newsletter & Ads to be PUBLIC (Fixes 'Invisible Widget' bug)
  $fixPublic = $pdo->prepare(
    "UPDATE settings SET is_public = 1 WHERE setting_group IN ('newsletter', 'ads') AND is_public = 0",
  );
  $fixPublic->execute();
  if ($fixPublic->rowCount() > 0) {
    $fixes[] = 'Fixed visibility for ' . $fixPublic->rowCount() . ' settings (Ads/Newsletter).';
  }

  // Fix: Auto-Migrate 'configuration' -> 'ads_config' if modern key is missing/empty
  // This standardizes the DB format over time
  try {
    // Check if we have legacy data but missing/empty modern data
    $legacy = $pdo
      ->query(
        "SELECT setting_value FROM settings WHERE setting_group = 'ads' AND setting_key = 'configuration'",
      )
      ->fetchColumn();
    if ($legacy) {
      $modern = $pdo
        ->query(
          "SELECT setting_value FROM settings WHERE setting_group = 'ads' AND setting_key = 'ads_config'",
        )
        ->fetchColumn();
      if (empty($modern)) {
        // Clone legacy to modern
        $insert = $pdo->prepare(
          "INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public) VALUES ('ads', 'ads_config', ?, 'json', 1) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_public = 1",
        );
        $insert->execute([$legacy]);
        $fixes[] = 'Migrated legacy Ads configuration to standard key.';
      }
    }
  } catch (Exception $e) {
    $warnings[] = 'Settings: Legacy ads configuration was not migrated.';
  }

  // Hardening Settings Privacy
  $privacyFix = $pdo->exec(
    "UPDATE settings SET is_public = 0 WHERE (setting_key LIKE '%Key%' OR setting_key LIKE '%Pass%' OR setting_key LIKE '%Secret%' OR setting_key LIKE '%Token%') AND is_public = 1",
  );
  if ($privacyFix > 0) {
    $fixes[] = 'Security: Hardened settings privacy (Auto-Hidden sensitive keys).';
  }

  // Fix: Auto-verify Admin 1 and any admin/moderator users stuck with email_verified = 0
  // This prevents fresh install admins from being locked out when SMTP is not configured
  try {
    $fixAdminVerify = $pdo->prepare(
      "UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE email_verified = 0 AND role IN ('Admin', 'Root', 'Moderator', 'Writer')",
    );
    $fixAdminVerify->execute();
    $affected = $fixAdminVerify->rowCount();
    if ($affected > 0) {
      $fixes[] = "Auto-verified {$affected} staff user(s) with email_verified = 0 (prevents SMTP lockout).";
    }
  } catch (Exception $e) {
    $warnings[] = 'Users: Staff email verification cleanup was not applied.';
  }

  if (empty($fixes) && empty($warnings)) {
    return [
      'success' => true,
      'repaired' => false,
      'message' => 'Database schema is healthy. No schema repairs needed.',
      'warnings' => $warnings,
    ];
  }

  if (empty($fixes)) {
    return [
      'success' => true,
      'repaired' => false,
      'message' => 'Database repair completed with compatibility warnings.',
      'warnings' => $warnings,
    ];
  }

  return [
    'success' => true,
    'repaired' => true,
    'message' => 'Schema repairs completed: ' . implode(' ', $fixes),
    'warnings' => $warnings,
  ];
}

$repairLockName = null;
try {
  $repairLockName = voncms_schema_acquire_repair_lock($pdo, 3);
} catch (Throwable $lockError) {
  error_log('VonCMS Database Repair: advisory lock unavailable');
  ResponseHelper::sendError('Database repair lock is unavailable. Please try again.', 503);
}

if ($repairLockName === null) {
  ResponseHelper::sendError(
    'Another database repair is already running. Please retry shortly.',
    409,
  );
}

$repairResult = null;
$repairFailure = null;
try {
  $repairResult = voncms_run_database_schema_repair($pdo);
  if (($repairResult['success'] ?? false) === true) {
    voncms_mark_publication_columns_ready();
    voncms_public_cache_clear();
  }
} catch (Throwable $repairError) {
  $repairFailure = $repairError;
} finally {
  voncms_schema_release_repair_lock($pdo, $repairLockName);
}

if ($repairFailure instanceof Throwable) {
  error_log('VonCMS Database Repair: ' . $repairFailure->getMessage());
  ResponseHelper::sendError(
    'Database repair stopped safely. No completed step was rolled back; resolve the database issue and run repair again.',
    500,
  );
}

echo json_encode($repairResult);
