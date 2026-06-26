<?php
/**
 * VonCMS - Database Schema Repair API
 * Checks for missing tables, columns, and indexes and fixes them automatically.
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';

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

// Enforce Security (Admin Only)
SessionManager::requirePrimaryAdmin();
CSRFProtection::requireToken();

// 5. Check if database connection exists
if (!isset($pdo) || $pdo === null) {
  echo json_encode([
    'success' => false,
    'error' => 'Database not configured. Cannot repair without credentials.',
  ]);
  exit();
}

try {
  $fixes = [];

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
        default_value LONGTEXT DEFAULT NULL,
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

  // ANALYTICS Table (Visitor Tracking)
  $pdo->exec("CREATE TABLE IF NOT EXISTS analytics (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // SECURITY LOGS (Firewall)
  $pdo->exec("CREATE TABLE IF NOT EXISTS security_logs (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

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
        user_agent TEXT DEFAULT NULL,
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

  $contentAuditTableCheck = $pdo->query("SHOW TABLES LIKE 'content_audit_logs'");
  $contentAuditTableMissing = !$contentAuditTableCheck || $contentAuditTableCheck->rowCount() === 0;
  voncms_ensure_content_audit_logs_table($pdo);
  if ($contentAuditTableMissing) {
    $fixes[] = 'Content audit logs: Created content_audit_logs table.';
  }

  // --- 2. COLUMN REPAIRS (Alter if missing) ---

  // 2.1 Media Table Migrations
  $mediaColsFull = $pdo->query('SHOW COLUMNS FROM media')->fetchAll(PDO::FETCH_ASSOC);
  $mediaColNames = array_column($mediaColsFull, 'Field');

  // Basic File Info
  if (!in_array('filetype', $mediaColNames)) {
    $pdo->exec('ALTER TABLE media ADD COLUMN filetype VARCHAR(100) DEFAULT NULL AFTER filepath');
    $fixes[] = 'Media: Added filetype.';
  }

  if (!in_array('filesize', $mediaColNames)) {
    $pdo->exec('ALTER TABLE media ADD COLUMN filesize BIGINT DEFAULT 0 AFTER filetype');
    $fixes[] = 'Media: Added filesize.';
  } else {
    // Check for BIGINT upgrade
    foreach ($mediaColsFull as $col) {
      if ($col['Field'] === 'filesize' && strpos(strtolower($col['Type']), 'bigint') === false) {
        $pdo->exec('ALTER TABLE media MODIFY filesize BIGINT DEFAULT 0');
        $fixes[] = 'Media: Upgraded filesize to BIGINT.';
        break;
      }
    }
  }

  // Metadata (Alt, Caption, Desc)
  $metaCols = ['alt_text', 'caption', 'description'];
  $prevCol = 'filesize';

  foreach ($metaCols as $col) {
    if (!in_array($col, $mediaColNames)) {
      $type = $col === 'alt_text' ? 'VARCHAR(255)' : 'TEXT';
      $pdo->exec("ALTER TABLE media ADD COLUMN $col $type DEFAULT NULL AFTER $prevCol");
      $fixes[] = "Media: Added $col.";
    }
    $prevCol = $col;
  }

  // Media created_at (list_media.php fallback)
  if (!in_array('created_at', $mediaColNames)) {
    $pdo->exec('ALTER TABLE media ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    $fixes[] = 'Media: Added created_at.';
  }

  // Fix Users Columns
  $userCols = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('reset_token', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL');
    $fixes[] = 'Fixed users table (Added reset_token).';
  }
  if (!in_array('reset_token_expires', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL');
    $fixes[] = 'Fixed users table (Added reset_token_expires).';
  }
  if (!in_array('email_verified', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0');
    $fixes[] = 'Fixed users table (Added email_verified).';
  }
  if (!in_array('display_name', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL');
    $fixes[] = 'Fixed users table (Added display_name).';
  }
  if (!in_array('bio', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL');
    $fixes[] = 'Fixed users table (Added bio).';
  }
  if (!in_array('avatar', $userCols)) {
    $pdo->exec('ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL');
    $fixes[] = 'Fixed users table (Added avatar).';
  }

  // Fix Posts Columns
  $postCols = $pdo->query('SHOW COLUMNS FROM posts')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('scheduled_at', $postCols)) {
    $pdo->exec('ALTER TABLE posts ADD COLUMN scheduled_at DATETIME DEFAULT NULL');
    $fixes[] = 'Fixed posts table (Added scheduled_at).';
  }
  if (!in_array('excerpt', $postCols)) {
    $pdo->exec('ALTER TABLE posts ADD COLUMN excerpt TEXT');
    $fixes[] = 'Fixed posts table (Added excerpt).';
  }
  if (!in_array('views', $postCols)) {
    $pdo->exec('ALTER TABLE posts ADD COLUMN views INT DEFAULT 0');
    $fixes[] = 'Fixed posts table (Added views).';
  }

  // 2.3 Settings Table Migrations
  $settingCols = $pdo->query('SHOW COLUMNS FROM settings')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('is_public', $settingCols)) {
    $pdo->exec('ALTER TABLE settings ADD COLUMN is_public BOOLEAN DEFAULT TRUE AFTER is_sensitive');
    $fixes[] = 'Settings: Added is_public column.';
  }
  if (!in_array('description', $settingCols)) {
    $pdo->exec(
      'ALTER TABLE settings ADD COLUMN description VARCHAR(255) DEFAULT NULL AFTER is_public',
    );
    $fixes[] = 'Settings: Added description column.';
  }
  if (!in_array('default_value', $settingCols)) {
    $pdo->exec(
      'ALTER TABLE settings ADD COLUMN default_value LONGTEXT DEFAULT NULL AFTER description',
    );
    $fixes[] = 'Settings: Added default_value column.';
  }
  if (!in_array('created_by', $settingCols)) {
    $pdo->exec('ALTER TABLE settings ADD COLUMN created_by INT DEFAULT NULL AFTER version');
    $fixes[] = 'Settings: Added created_by column.';
  }
  if (!in_array('updated_by', $settingCols)) {
    $pdo->exec('ALTER TABLE settings ADD COLUMN updated_by INT DEFAULT NULL AFTER created_by');
    $fixes[] = 'Settings: Added updated_by column.';
  }

  $settingIndexes = $pdo->query('SHOW INDEX FROM settings')->fetchAll(PDO::FETCH_ASSOC);
  $settingIndexNames = [];
  foreach ($settingIndexes as $idx) {
    $settingIndexNames[$idx['Key_name']] = true;
  }
  if (!isset($settingIndexNames['idx_key'])) {
    $pdo->exec('CREATE INDEX idx_key ON settings (setting_key)');
    $fixes[] = 'Settings: Added idx_key.';
  }
  if (!isset($settingIndexNames['idx_public'])) {
    $pdo->exec('CREATE INDEX idx_public ON settings (is_public)');
    $fixes[] = 'Settings: Added idx_public.';
  }
  if (!isset($settingIndexNames['idx_updated'])) {
    $pdo->exec('CREATE INDEX idx_updated ON settings (updated_at)');
    $fixes[] = 'Settings: Added idx_updated.';
  }
  if (!isset($settingIndexNames['idx_version'])) {
    $pdo->exec('CREATE INDEX idx_version ON settings (version)');
    $fixes[] = 'Settings: Added idx_version.';
  }

  $settingFkCols = $pdo
    ->query(
      "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND REFERENCED_TABLE_NAME = 'users'",
    )
    ->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('created_by', $settingFkCols)) {
    $pdo->exec(
      'UPDATE settings s LEFT JOIN users u ON s.created_by = u.id SET s.created_by = NULL WHERE s.created_by IS NOT NULL AND u.id IS NULL',
    );
    $pdo->exec(
      'ALTER TABLE settings ADD CONSTRAINT fk_settings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
    );
    $fixes[] = 'Settings: Added created_by foreign key.';
  }
  if (!in_array('updated_by', $settingFkCols)) {
    $pdo->exec(
      'UPDATE settings s LEFT JOIN users u ON s.updated_by = u.id SET s.updated_by = NULL WHERE s.updated_by IS NOT NULL AND u.id IS NULL',
    );
    $pdo->exec(
      'ALTER TABLE settings ADD CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL',
    );
    $fixes[] = 'Settings: Added updated_by foreign key.';
  }

  try {
    $apiPrivacyFix = $pdo->exec(
      "UPDATE settings SET is_public = 0 WHERE setting_group = 'api' AND setting_key = 'config'",
    );
    if ($apiPrivacyFix > 0) {
      $fixes[] = 'Settings: Forced API config blob to admin-only.';
    }
  } catch (Exception $e) {
    /* Ignore until settings metadata columns are available */
  }

  // Fix Pages Columns
  $pageCols = $pdo->query('SHOW COLUMNS FROM pages')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('views', $pageCols)) {
    $pdo->exec('ALTER TABLE pages ADD COLUMN views INT DEFAULT 0');
    $fixes[] = 'Fixed pages table (Added views).';
  }
  if (!in_array('featured_image', $pageCols)) {
    $pdo->exec('ALTER TABLE pages ADD COLUMN featured_image VARCHAR(255) DEFAULT NULL');
    $fixes[] = 'Fixed pages table (Added featured_image).';
  }

  // Fix Comments Columns
  $commentCols = $pdo->query('SHOW COLUMNS FROM comments')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('parent_id', $commentCols)) {
    $pdo->exec('ALTER TABLE comments ADD COLUMN parent_id INT DEFAULT NULL');
    $fixes[] = 'Fixed comments table (Added parent_id).';
  }
  if (!in_array('likes', $commentCols)) {
    $pdo->exec('ALTER TABLE comments ADD COLUMN likes INT DEFAULT 0');
    $fixes[] = 'Fixed comments table (Added likes).';
  }
  if (!in_array('user_avatar', $commentCols)) {
    $pdo->exec('ALTER TABLE comments ADD COLUMN user_avatar VARCHAR(255) DEFAULT NULL');
    $fixes[] = 'Fixed comments table (Added user_avatar).';
  }

  // Fix Newsletter Subscribers Columns
  $nlCols = $pdo->query('SHOW COLUMNS FROM newsletter_subscribers')->fetchAll(PDO::FETCH_COLUMN);
  if (!in_array('unsubscribed_at', $nlCols)) {
    $pdo->exec('ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribed_at DATETIME NULL');
    $fixes[] = 'Fixed newsletter_subscribers table (Added unsubscribed_at).';
  }
  // Fix Newsletter Subscribers Columns
  // ... (previous code)
  if (!in_array('source', $nlCols)) {
    $pdo->exec("ALTER TABLE newsletter_subscribers ADD COLUMN source VARCHAR(50) DEFAULT 'widget'");
    $fixes[] = 'Fixed newsletter_subscribers table (Added source).';
  }

  // --- 3. INDEX REPAIRS (Scalability) ---

  // Check Posts Indexes
  // Note: SHOW INDEX returns multiple rows per index (one per column)
  $postIndexesObj = $pdo->query('SHOW INDEX FROM posts');
  $existingContextIndexes = [];
  while ($row = $postIndexesObj->fetch(PDO::FETCH_ASSOC)) {
    $existingContextIndexes[] = $row['Key_name'];
  }

  if (!in_array('idx_scheduled', $existingContextIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_scheduled ON posts (status, scheduled_at)');
      $fixes[] = 'Added missing index: idx_scheduled (Auto-Publish Optimization).';
    } catch (Exception $e) {
      /* Ignore if race condition */
    }
  }

  if (!in_array('idx_category', $existingContextIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_category ON posts (category)');
      $fixes[] = 'Added missing index: idx_category (Category Filter Optimization).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  // FULLTEXT index on posts (replaces slow LIKE '%keyword%' search)
  if (!in_array('ft_title_content', $existingContextIndexes)) {
    try {
      $pdo->exec('ALTER TABLE posts ADD FULLTEXT INDEX ft_title_content (title, content)');
      $fixes[] = 'Added FULLTEXT index: ft_title_content (Search Performance Upgrade).';
    } catch (Exception $e) {
      /* Ignore if FULLTEXT not supported (e.g. very old MySQL) */
    }
  }

  // Check Comments Indexes
  $commentIndexesObj = $pdo->query('SHOW INDEX FROM comments');
  $existingCommentIndexes = [];
  while ($row = $commentIndexesObj->fetch(PDO::FETCH_ASSOC)) {
    $existingCommentIndexes[] = $row['Key_name'];
  }

  if (!in_array('idx_post_id', $existingCommentIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_post_id ON comments (post_id)');
      $fixes[] = 'Added missing index: comments.idx_post_id (Comment Lookup).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  if (!in_array('idx_status', $existingCommentIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_status ON comments (status)');
      $fixes[] = 'Added missing index: comments.idx_status (Status Filter).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  if (!in_array('idx_created_at', $existingCommentIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_created_at ON comments (created_at)');
      $fixes[] = 'Added missing index: comments.idx_created_at (Date Sort).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  // Check Pages Indexes
  $pageIndexesObj = $pdo->query('SHOW INDEX FROM pages');
  $existingPageIndexes = [];
  while ($row = $pageIndexesObj->fetch(PDO::FETCH_ASSOC)) {
    $existingPageIndexes[] = $row['Key_name'];
  }

  if (!in_array('idx_slug', $existingPageIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_slug ON pages (slug)');
      $fixes[] = 'Added missing index: pages.idx_slug (Page Lookup).';
    } catch (Exception $e) {
      /* Ignore — UNIQUE(slug) may already cover this */
    }
  }

  if (!in_array('idx_status', $existingPageIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_status ON pages (status)');
      $fixes[] = 'Added missing index: pages.idx_status (Page Status Filter).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  if (!in_array('ft_title_content', $existingPageIndexes)) {
    try {
      $pdo->exec('ALTER TABLE pages ADD FULLTEXT INDEX ft_title_content (title, content)');
      $fixes[] = 'Added FULLTEXT index: pages.ft_title_content (Page Search).';
    } catch (Exception $e) {
      /* Ignore if FULLTEXT is unavailable */
    }
  }

  // Check Media Indexes
  $mediaIndexesObj = $pdo->query('SHOW INDEX FROM media');
  $existingMediaIndexes = [];
  while ($row = $mediaIndexesObj->fetch(PDO::FETCH_ASSOC)) {
    $existingMediaIndexes[] = $row['Key_name'];
  }

  if (!in_array('idx_filename', $existingMediaIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_filename ON media (filename)');
      $fixes[] = 'Added missing index: media.idx_filename (Media Search).';
    } catch (Exception $e) {
      /* Ignore */
    }
  }

  if (!in_array('idx_uploaded_at', $existingMediaIndexes)) {
    try {
      $pdo->exec('CREATE INDEX idx_uploaded_at ON media (uploaded_at)');
      $fixes[] = 'Added missing index: media.idx_uploaded_at (Media Date Sort).';
    } catch (Exception $e) {
      /* Ignore */
    }
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
    /* Ignore non-critical migration errors */
  }

  // Hardening Settings Privacy
  $pdo->exec(
    "UPDATE settings SET is_public = 0 WHERE (setting_key LIKE '%Key%' OR setting_key LIKE '%Pass%' OR setting_key LIKE '%Secret%' OR setting_key LIKE '%Token%') AND is_public = 1",
  );
  $fixes[] = 'Security: Hardened settings privacy (Auto-Hidden sensitive keys).';

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
    /* Ignore non-critical data fix errors */
  }

  if (empty($fixes)) {
    echo json_encode([
      'success' => true,
      'repaired' => false,
      'message' => 'Database schema is healthy. No schema repairs needed.',
    ]);
  } else {
    echo json_encode([
      'success' => true,
      'repaired' => true,
      'message' => 'Schema repairs completed: ' . implode(' ', $fixes),
    ]);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
