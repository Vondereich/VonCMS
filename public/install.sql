-- Database Schema for VonCMS
-- NOTE: Replace 'example_db' with your preferred database name during installation
CREATE DATABASE IF NOT EXISTS example_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE example_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
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
);

-- Settings Table (Enhanced with Security & Audit Trail)
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_group VARCHAR(50) NOT NULL COMMENT 'Group: general, seo, theme, media, plugins, ads, navigation, sidebar, content',
    setting_key VARCHAR(100) NOT NULL COMMENT 'Unique key within group',
    setting_value LONGTEXT COMMENT 'Can be simple value or large JSON object/array',
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT 'Data type for validation',
    is_sensitive BOOLEAN DEFAULT FALSE COMMENT 'Flag for sensitive data (API keys, passwords)',
    is_public BOOLEAN DEFAULT TRUE COMMENT 'Can be exposed to frontend (false = admin-only)',
    description VARCHAR(255) DEFAULT NULL COMMENT 'Human-readable description',
    default_value LONGTEXT DEFAULT NULL COMMENT 'Default value for reset',
    version INT DEFAULT 1 COMMENT 'Version number for this setting',
    created_by INT DEFAULT NULL COMMENT 'User who created this setting',
    updated_by INT DEFAULT NULL COMMENT 'User who last updated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_key (setting_group, setting_key),
    INDEX idx_group (setting_group),
    INDEX idx_key (setting_key),
    INDEX idx_public (is_public),
    INDEX idx_updated (updated_at),
    INDEX idx_version (version),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Site configuration settings with security and versioning';

-- Settings Audit Log Table
CREATE TABLE IF NOT EXISTS settings_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_id INT NOT NULL COMMENT 'Reference to settings.id',
    setting_group VARCHAR(50) NOT NULL COMMENT 'Snapshot of group',
    setting_key VARCHAR(100) NOT NULL COMMENT 'Snapshot of key',
    old_value LONGTEXT COMMENT 'Previous value',
    new_value LONGTEXT COMMENT 'New value',
    changed_by INT DEFAULT NULL COMMENT 'User who made the change',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When change occurred',
    change_type ENUM('INSERT', 'UPDATE', 'DELETE') DEFAULT 'UPDATE' COMMENT 'Type of change',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP address of user',
    user_agent TEXT DEFAULT NULL COMMENT 'Browser/client info',
    INDEX idx_setting_id (setting_id),
    INDEX idx_changed_at (changed_at),
    INDEX idx_changed_by (changed_by),
    INDEX idx_group_key (setting_group, setting_key),
    FOREIGN KEY (setting_id) REFERENCES settings(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit trail for all settings changes';

-- Content Audit Log Table
CREATE TABLE IF NOT EXISTS content_audit_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Settings
INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public, description, version) VALUES
('general', 'domain_url', '', 'string', TRUE, 'Domain URL', 1),
('general', 'site_name', 'VonCMS', 'string', TRUE, 'Site name', 1),
('general', 'site_description', 'A modern content management system', 'string', TRUE, 'Site description', 1),
('general', 'site_tagline', 'Modern Content Management', 'string', TRUE, 'Site tagline', 1),
('general', 'posts_per_page', '6', 'number', TRUE, 'Posts per page', 1),
('general', 'maintenance_mode', 'false', 'boolean', TRUE, 'Maintenance mode', 1),
('general', 'email_smtp', '', 'string', FALSE, 'SMTP config', 1),
('general', 'logo_url', '', 'string', TRUE, 'Logo URL', 1),
('general', 'invert_logo_in_dark_mode', 'false', 'boolean', TRUE, 'Invert logo in dark mode', 1),
('general', 'favicon_url', '', 'string', TRUE, 'Favicon URL', 1),
('general', 'discussion_enabled', 'true', 'boolean', TRUE, 'Enable comments', 1),
('general', 'permalink_structure', 'slug', 'string', TRUE, 'Permalink structure', 1),
('ads', 'ads_config', '{"adsEnabled":false,"headerAd":"","sidebarAd":"","inFeedAd":"","popupAd":""}', 'json', TRUE, 'Ads config', 1),
('theme', 'active_theme_id', 'theme-default', 'string', TRUE, 'Active theme', 1),
('theme', 'customization', '{"primaryColor":"#0ea5ff","fontFamily":"Inter, sans-serif","borderRadius":"0.5rem"}', 'json', TRUE, 'Theme settings', 1),
('media', 'optimization', '{"enabled":false,"compressionLevel":"medium","convertToWebP":false,"maxWidth":1920,"maxHeight":1080}', 'json', TRUE, 'Media optimization', 1),
('media', 'storage', '{"location":"local","folderStructure":"year_month","cdnUrl":""}', 'json', FALSE, 'Storage config', 1),
('media', 'performance', '{"lazyLoadImages":true,"lazyLoadIframes":true}', 'json', TRUE, 'Performance', 1),
('navigation', 'menu_items', '[{"id":"nav1","label":"Home","url":"home","type":"internal"}]', 'json', TRUE, 'Menu items', 1),
('sidebar', 'layout', '[{"id":"w1","type":"trending","title":"Trending Now","isVisible":true}]', 'json', TRUE, 'Sidebar widgets', 1),
('content', 'categories', '["Uncategorized","News","Updates"]', 'json', TRUE, 'Categories', 1),
('plugins', 'active_plugins', '[]', 'json', TRUE, 'Active plugins', 1),
('plugins', 'custom_plugins', '[]', 'json', TRUE, 'Custom plugins', 1),
('plugins', 'plugin_config', '{"vp_promo_bar":{"text":"","linkUrl":"#","linkText":"Learn More"},"vp_gift_widget":{"targetUrl":"","tooltipText":""}}', 'json', TRUE, 'Plugin config', 1),
('share', 'share_placement', 'none', 'string', TRUE, 'Share placement', 1);

-- Settings audit rows are written by the application runtime to keep install, repair,
-- and admin save paths aligned without duplicate trigger-based entries.

-- Create Public Settings View
CREATE OR REPLACE VIEW public_settings AS SELECT setting_group, setting_key, setting_value, setting_type FROM settings WHERE is_public = TRUE;

-- Media Table
CREATE TABLE IF NOT EXISTS media (
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
);

-- Posts Table
CREATE TABLE IF NOT EXISTS posts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pages Table
CREATE TABLE IF NOT EXISTS pages (
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
);

-- Comments Table (renamed from discussions)
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT,
    parent_id INT DEFAULT NULL,
    user_name VARCHAR(100) DEFAULT 'Anonymous',
    user_avatar VARCHAR(255) DEFAULT NULL,
    content TEXT NOT NULL,
    likes INT DEFAULT 0,
    status ENUM('approved', 'pending', 'spam') DEFAULT 'approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Table (Smart Session)
-- Tracks page visits with throttling and auto-purge
CREATE TABLE IF NOT EXISTS analytics (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact Forms Table
CREATE TABLE IF NOT EXISTS contact_forms (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact Submissions Table
CREATE TABLE IF NOT EXISTS contact_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    form_id VARCHAR(50),
    data LONGTEXT COMMENT 'JSON data submitted',
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_form_id (form_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (form_id) REFERENCES contact_forms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Security Logs Table
CREATE TABLE IF NOT EXISTS security_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Redirects Table
CREATE TABLE IF NOT EXISTS redirects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_url VARCHAR(500) NOT NULL,
    target_url VARCHAR(500) NOT NULL,
    redirect_type INT DEFAULT 301,
    hit_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_source (source_url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Admin User (REMOVED for security - create admin securely during setup)
-- Admin user should be created via the installer wizard (public/api/install.php)
-- which generates secure passwords and proper user credentials.

-- Sample data removed for production deployments.
-- The installer wizard will create necessary default settings.
-- Site administrators can create content after installation.
