<?php

/**
 * VonCMS - Multi-Stage Safe Installer
 * Version: 1.25 "OpenGate"
 */

// PHP Version Enforcement
if (version_compare(PHP_VERSION, '8.2.0', '<')) {
  header('Content-Type: application/json');
  echo json_encode([
    'success' => false,
    'error' => 'VonCMS requires PHP 8.2 or higher. Current version: ' . PHP_VERSION,
  ]);
  exit();
}

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/content_audit_helper.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// 4. CRITICAL SECURITY: Block reinstallation if configuration exists
$configFile = __DIR__ . '/../von_config.php';
$lockFile = __DIR__ . '/../install.lock';

// 1.4 Installer lockout (Fix)
// Check both config existence AND an immutable lock file
if (file_exists($configFile) || file_exists($lockFile)) {
  ResponseHelper::sendError(
    'Installation blocked: System already installed. To reinstall, manually delete von_config.php and install.lock.',
    403,
  );
}

// 1. Validate Input
$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!$input) {
  ResponseHelper::sendError('No data received.', 400);
}

$dbHost = $input['dbHost'] ?? 'localhost';
$dbName = $input['dbName'] ?? '';
$dbUser = $input['dbUser'] ?? '';
$dbPass = $input['dbPass'] ?? '';
$siteTitle = $input['siteTitle'] ?? 'My Website';
$adminUsername = $input['adminUsername'] ?? 'admin';
$adminEmail = $input['adminEmail'] ?? '';
$adminPass = $input['adminPass'] ?? '';

if (!$dbName || !$dbUser || !$adminUsername || !$adminEmail || !$adminPass) {
  ResponseHelper::sendError('Missing required fields.', 400);
}

// Password strength validation
if (
  strlen($adminPass) < 8 ||
  !preg_match('/[A-Z]/', $adminPass) ||
  !preg_match('/[0-9]/', $adminPass) ||
  !preg_match('/[!@#$%^&*(),.?":{}|<>]/', $adminPass)
) {
  ResponseHelper::sendError(
    'Password must be at least 8 characters with uppercase letter, number, and special character (!@#$%^&*(),.?":{}|<>).',
    400,
  );
}

// 2. Try DB Connection
try {
  $dsn = "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4";
  $pdo = new PDO($dsn, $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}

// 3. Create Tables (Complete Schema)
try {
  // Users Table
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

  // Posts Table
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
        INDEX idx_slug (slug),
        FULLTEXT INDEX ft_title_content (title, content)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // Pages Table
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
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        FULLTEXT INDEX ft_title_content (title, content)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // Comments/Discussions Table
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
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
        INDEX idx_post_id (post_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // Settings Table
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

  // Settings Audit Log Table (Rollback Support)
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

  // Media Table
  $pdo->exec("CREATE TABLE IF NOT EXISTS media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(255) NOT NULL,
        filetype VARCHAR(100) DEFAULT NULL,
        filesize BIGINT DEFAULT 0,
        alt_text VARCHAR(255) DEFAULT NULL,
        caption TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        uploaded_by INT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_filename (filename),
        INDEX idx_uploaded_at (uploaded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

  // Newsletter Subscribers Table
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

  // Analytics Table (Smart Session)
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

  // CONTACT FORMS Table
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

  // CONTACT SUBMISSIONS Table
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

  // Security Logs Table (Security Dashboard)
  // Security Logs Table
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

  // Redirects Table SEO Velocity
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

  // Content Audit Logs Table
  voncms_ensure_content_audit_logs_table($pdo);

  // 4. Create Admin User (auto-verified — no email verification needed for fresh install)
  $hashedPass = password_hash($adminPass, PASSWORD_DEFAULT);
  $stmt = $pdo->prepare(
    "INSERT INTO users (username, email, password, role, email_verified, verification_token, verification_token_expires) VALUES (:username, :email, :pass, 'Admin', 1, NULL, NULL)",
  );
  $stmt->execute(['username' => $adminUsername, 'email' => $adminEmail, 'pass' => $hashedPass]);

  // 5. Detect Base URL for domain_url setting
  $protocol = is_https() ? 'https://' : 'http://';
  $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
  // SCRIPT_NAME is like /voncms/api/install.php
  $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
  // Subdirectory detection (Path Agnostic Standard)
  $subDir = preg_replace('#/api(/.*)?$#i', '', (string) $scriptPath);
  $subDir = rtrim($subDir, '/');
  $detectedDomainUrl = $protocol . $host . ($subDir === '/' ? '' : $subDir);

  // 6. Insert Default Settings
  $defaultSettings = [
    ['general', 'domain_url', $detectedDomainUrl, 'string'],
    ['general', 'site_name', $siteTitle, 'string'],
    ['general', 'site_description', 'A modern content management system', 'string'],
    ['general', 'site_tagline', 'Modern Content Management', 'string'],
    ['general', 'posts_per_page', '6', 'number'],
    ['general', 'maintenance_mode', 'false', 'boolean'],
    ['general', 'email_smtp', '', 'string'],
    ['general', 'logo_url', '', 'string'],
    ['general', 'favicon_url', '', 'string'],
    ['general', 'discussion_enabled', 'true', 'boolean'],
    ['general', 'permalink_structure', 'slug', 'string'],
    [
      'ads',
      'ads_config',
      '{"adsEnabled":false,"headerAd":"","sidebarAd":"","inFeedAd":"","popupAd":""}',
      'json',
    ],
    ['theme', 'active_theme_id', 'theme-default', 'string'],
    [
      'theme',
      'customization',
      '{"primaryColor":"#0ea5ff","fontFamily":"Inter, sans-serif","borderRadius":"0.5rem"}',
      'json',
    ],
    [
      'media',
      'optimization',
      '{"enabled":false,"compressionLevel":"medium","convertToWebP":false,"maxWidth":1920,"maxHeight":1080}',
      'json',
    ],
    ['media', 'storage', '{"location":"local","folderStructure":"year_month","cdnUrl":""}', 'json'],
    ['media', 'performance', '{"lazyLoadImages":true,"lazyLoadIframes":true}', 'json'],
    [
      'navigation',
      'menu_items',
      '[{"id":"nav1","label":"Home","url":"home","type":"internal"}]',
      'json',
    ],
    [
      'sidebar',
      'layout',
      '[{"id":"w1","type":"trending","title":"Trending Now","isVisible":true}]',
      'json',
    ],
    ['content', 'categories', '["Uncategorized","News","Updates"]', 'json'],
    ['plugins', 'active_plugins', '[]', 'json'],
    ['plugins', 'custom_plugins', '[]', 'json'],
    [
      'plugins',
      'plugin_config',
      '{"vp_promo_bar":{"text":"","linkUrl":"#","linkText":"Learn More"},"vp_gift_widget":{"targetUrl":"","tooltipText":""}}',
      'json',
    ],
    ['share', 'share_placement', 'none', 'string'],
  ];

  $settingsStmt = $pdo->prepare(
    'INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public) VALUES (?, ?, ?, ?, ?)',
  );
  foreach ($defaultSettings as $setting) {
    // Determine public status dynamically
    $isPublic = SecurityHelper::isSensitiveKey($setting[1]) ? 0 : 1;
    $setting[] = $isPublic;
    $settingsStmt->execute($setting);
  }
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}

// 5. Write Config File
$configContent =
  "<?php
// VonCMS Configuration
// Generated by Installer on " .
  date('Y-m-d H:i:s') .
  "

// Production Error Reporting (Security Enhancement)
if (php_sapi_name() !== 'cli') {
    \$host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) (\$_SERVER['HTTP_HOST'] ?? ''));
    \$isProduction = !in_array(\$host, ['localhost', '127.0.0.1', 'localhost:8080']);
    if (\$isProduction) {
        // HIDE errors from user, but LOG them to file
        error_reporting(E_ALL);
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        
        // Ensure logs directory exists (Auto-Fix)
        \$logDir = __DIR__ . '/../logs';
        if (!file_exists(\$logDir)) {
            @mkdir(\$logDir, 0755, true);
        }

        \$logFile = \$logDir . '/php_error.log';
        ini_set('error_log', \$logFile);
        
        // Log Rotation: Check if log file > 5MB
        if (file_exists(\$logFile) && filesize(\$logFile) > 5 * 1024 * 1024) {
            rename(\$logFile, \$logFile . '.bak');
        }
    } else {
        error_reporting(E_ALL);
        // FORCE HIDE ERRORS ON API REQUESTS TO PREVENT JSON BREAKAGE
        if (strpos(\$_SERVER['REQUEST_URI'] ?? '', '/api/') !== false) {
             ini_set('display_errors', '0');
        } else {
             ini_set('display_errors', '1');
        }
        ini_set('log_errors', '1');
        ini_set('error_log', __DIR__ . '/../logs/php_error_dev.log');
    }
}

\$db_host = " .
  var_export($dbHost, true) .
  ";
\$db_name = " .
  var_export($dbName, true) .
  ";
\$db_user = " .
  var_export($dbUser, true) .
  ";
\$db_pass = " .
  var_export($dbPass, true) .
  ";

try {
    \$dsn = \"mysql:host=\$db_host;dbname=\$db_name;charset=utf8mb4\";
    \$pdo = new PDO(\$dsn, \$db_user, \$db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException \$e) {
    // Soft fail - let index.php handle the error page display
    \$pdo = null;
}

// Helper functions (Added to ensure compatibility)
if (!function_exists('check_auth')) {
    function check_auth() {
        // Managed by security.php series
        return isset(\$_SESSION['user_id']); 
    }
}

if (!function_exists('sanitize_input')) {
    function sanitize_input(\$data) {
        if (is_array(\$data)) {
            foreach (\$data as \$key => \$value) {
                \$data[\$key] = sanitize_input(\$value);
            }
        } else {
            \$data = trim(\$data);
            \$data = stripslashes(\$data);
            \$data = htmlspecialchars(\$data, ENT_QUOTES, 'UTF-8');
        }
        return \$data;
    }
}
";

/**
 * @param string $existingContent
 * @param string $newBlock
 * @return string
 */
function mergeManagedHtaccessContent($existingContent, $newBlock)
{
  $blockPattern = '/^[ \t]*# BEGIN VonCMS\r?$[\s\S]*?^[ \t]*# END VonCMS\r?\n?/im';
  $managedBlockCount = preg_match_all('/^[ \t]*# BEGIN VonCMS\r?$/m', $existingContent);

  if ($managedBlockCount > 0) {
    $remainingContent = trim((string) preg_replace($blockPattern, '', $existingContent));
    return $remainingContent === ''
      ? rtrim($newBlock) . "\n"
      : $remainingContent . "\n\n" . rtrim($newBlock) . "\n";
  }

  if (strpos($existingContent, '## VonCMS Universal .htaccess') !== false) {
    $parts = explode('## VonCMS Universal .htaccess', $existingContent, 2);
    $prefixContent = trim($parts[0]);
    return $prefixContent === ''
      ? rtrim($newBlock) . "\n"
      : $prefixContent . "\n\n" . rtrim($newBlock) . "\n";
  }

  $existingContent = trim($existingContent);
  return $existingContent === ''
    ? rtrim($newBlock) . "\n"
    : $existingContent . "\n\n" . rtrim($newBlock) . "\n";
}

/**
 * @param string $filePath
 * @param string $htaccessContent
 * @return int|false
 */
function writeManagedHtaccess($filePath, $htaccessContent)
{
  if (!file_exists($filePath)) {
    return file_put_contents($filePath, rtrim($htaccessContent) . "\n");
  }

  $existingContent = (string) file_get_contents($filePath);
  @copy($filePath, $filePath . '.bak');

  return file_put_contents(
    $filePath,
    mergeManagedHtaccessContent($existingContent, $htaccessContent),
  );
}

if (file_put_contents($configFile, $configContent)) {
  // Also update site_settings.json with the Site Title if possible,
  // but currently that's handled by Node/PHP API separate from this config.
  // We will return success.
  // 6. Generate Universal .htaccess (Dynamic Base)
  // Works on root OR any subfolder without editing!

  $htaccessContent = <<<EOT
  # BEGIN VonCMS
  # The directives (lines) between "# BEGIN VonCMS" and "# END VonCMS" are
  # dynamically generated, and should only be modified via VonCMS integrity tools.
  # Any changes to the directives between these markers will be overwritten.

  # Force PHP priority over static HTML when both exist in root
  DirectoryIndex index.php index.html

  <IfModule mod_rewrite.c>
    RewriteEngine On

    # =====================================================
    # PRIORITY 1 - VVIP LANE FOR SOCIAL CRAWLERS
    # =====================================================

    # Detect social bots (Mark them, don't stop processing)
    RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|Facebot|meta-externalagent|Twitterbot|Pinterest|LinkedInBot|WhatsApp|TelegramBot|Slackbot) [NC]
    RewriteRule ^ - [E=SOCIAL_BOT:1]

    # CRITICAL: Allow Facebook to fetch IMAGES immediately (Skip everything else)
    # Addresses: No cookie, No referer, Query string cache busting
    RewriteCond %{HTTP_USER_AGENT} ^(facebookexternalhit|Facebot|meta-externalagent) [NC]
    RewriteCond %{REQUEST_URI} \.(jpg|jpeg|png|webp|gif|ico|svg)$ [NC]
    RewriteRule ^ - [L]

    # =====================================================
    # NORMAL FLOW BELOW
    # =====================================================

    # FORCE HTTPS (skip on localhost for local dev)
    RewriteCond %{HTTP_HOST} !^(localhost|127\.0\.0\.1) [NC]
    RewriteCond %{HTTPS} off
    RewriteCond %{HTTP:X-Forwarded-Proto} !https
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # WWW CANONICALIZATION (Choose ONE option below)
    # Option A: Force non-www (DEFAULT - strip www)
    RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
    RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

    # Auto-detect base path (no manual RewriteBase needed!)
    RewriteCond %{REQUEST_URI}::$1 ^(/.+)/(.*)::\\2$
    RewriteRule ^(.*) - [E=BASE:%1]

    # SECURITY BLOCK
    RewriteRule \.(sql|md|json|log|bak|env|zip|lock)$ - [F,L]

    RewriteRule ^von_config\.php$ - [F,L]

    RewriteRule ^composer\.lock$ - [F,L]

    RewriteRule ^package\.json$ - [F,L]

    # Route direct index.html requests through PHP hydration
    RewriteRule ^index\.html$ index.php [L,QSA]

    # Serve real files
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^ - [L]

    # Serve existing directories directly
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # Keep PHP endpoints accessible
    RewriteRule ^(api\.php|index\.php)$ $1 [L]

    # Handle API requests
    RewriteRule ^api/(.*)$ api/$1 [L]

    # Dynamic robots.txt
    RewriteRule ^robots\.txt$ robots.php [L]

    # Dynamic llms.txt (AI/LLM-friendly site summary)
    RewriteRule ^llms\.txt$ llms.php [L]

    # Dynamic sitemap.xml
    RewriteRule ^sitemap\.xml$ sitemap.php [L]

    # RSS feed (clean URL)
    RewriteRule ^rss$ rss.php [L]
    RewriteRule ^rss\.xml$ rss.php [L]
    RewriteRule ^feed$ rss.php [L]
    RewriteRule ^feed\.xml$ rss.php [L]

    # Fallback to index.php for SPA routing
    RewriteRule ^ index.php [L,QSA]
  </IfModule>

  # Security Headers
  <IfModule mod_headers.c>
    Header set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
    Header set X-XSS-Protection "1; mode=block"
    Header set X-Content-Type-Options "nosniff"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set X-Frame-Options "SAMEORIGIN"
    Header unset Server
    Header unset X-Powered-By
  </IfModule>

  # Security - block hidden files
  <FilesMatch "^\.+">
    Require all denied
  </FilesMatch>

  <IfModule mod_mime.c>
    AddType application/javascript .js
    AddType text/css .css
    AddType image/webp .webp
    AddType font/woff2 .woff2
  </IfModule>

  # Prevent directory listing globally
  Options -Indexes

  # ENABLE GZIP COMPRESSION
  <IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
    AddOutputFilterByType DEFLATE application/javascript application/json
    AddOutputFilterByType DEFLATE application/xml image/svg+xml
  </IfModule>
  # END VonCMS
  EOT;

  // Write .htaccess to parent directory (root where index.php is)
  writeManagedHtaccess(__DIR__ . '/../.htaccess', $htaccessContent);

  // 7. Generate Uploads Shield
  $uploadsShieldPath = __DIR__ . '/../public/uploads';
  if (!is_dir($uploadsShieldPath)) {
    $uploadsShieldPath = __DIR__ . '/../uploads';
  }

  if (is_dir($uploadsShieldPath)) {
    $shieldRule =
      "<FilesMatch \"\.(php|phtml|php3|php4|php5|pl|py|jsp|asp|html|htm|js|sh|exe)$\">\n    Require all denied\n</FilesMatch>\nOptions -Indexes";
    file_put_contents($uploadsShieldPath . '/.htaccess', $shieldRule);
  }

  // 7. Create Installer Lock File (Security Patch)
  @file_put_contents(__DIR__ . '/../install.lock', 'VonCMS Installed: ' . date('Y-m-d H:i:s'));

  echo json_encode(['success' => true, 'message' => 'Installation successful! Config written.']);
} else {
  ResponseHelper::sendError('Failed to write von_config.php. Check permissions.', 500);
}
