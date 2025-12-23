-- Database Schema for VonCMS
-- NOTE: Replace 'example_db' with your preferred database name during installation
CREATE DATABASE IF NOT EXISTS example_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE example_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor', 'user') DEFAULT 'user',
    bio TEXT DEFAULT NULL,
    avatar VARCHAR(255) DEFAULT NULL,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_expires DATETIME DEFAULT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Insert Default Settings
INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public, description, version) VALUES
('general', 'site_name', 'VonCMS', 'string', TRUE, 'Site name', 1),
('general', 'site_description', 'A modern CMS', 'string', TRUE, 'Site description', 1),
('general', 'posts_per_page', '6', 'number', TRUE, 'Posts per page', 1),
('general', 'maintenance_mode', 'false', 'boolean', TRUE, 'Maintenance mode', 1),
('general', 'email_smtp', '', 'string', FALSE, 'SMTP config', 1),
('general', 'logo_url', '', 'string', TRUE, 'Logo URL', 1),
('general', 'favicon_url', '', 'string', TRUE, 'Favicon URL', 1),
('general', 'discussion_enabled', 'true', 'boolean', TRUE, 'Enable comments', 1),
('seo', 'analytics', '{"analyticsId":"","mapsApiKey":""}', 'json', FALSE, 'Analytics keys', 1),
('ads', 'configuration', '{"headerAd":"","sidebarAd":"","inFeedAd":"","popupAd":"","popupEnabled":false}', 'json', TRUE, 'Ads config', 1),
('theme', 'active_theme_id', 'theme-default', 'string', TRUE, 'Active theme', 1),
('theme', 'customization', '{"primaryColor":"#0ea5ff","fontFamily":"Inter, sans-serif","borderRadius":"0.5rem","customCss":""}', 'json', TRUE, 'Theme settings', 1),
('media', 'optimization', '{"enabled":false,"compressionLevel":"medium","convertToWebP":false,"maxWidth":1920,"maxHeight":1080}', 'json', TRUE, 'Media optimization', 1),
('media', 'sizes', '{"thumbnail":"150x150","medium":"300x300","large":"1024x1024","custom":[]}', 'json', TRUE, 'Image sizes', 1),
('media', 'storage', '{"location":"local","folderStructure":"year_month","cdnUrl":""}', 'json', FALSE, 'Storage config', 1),
('media', 'performance', '{"lazyLoadImages":true,"lazyLoadIframes":true}', 'json', TRUE, 'Performance', 1),
('navigation', 'menu_items', '[{"id":"nav1","label":"Home","url":"home","type":"internal"}]', 'json', TRUE, 'Menu items', 1),
('sidebar', 'layout', '[{"id":"w1","type":"trending","title":"Trending Now","isVisible":true}]', 'json', TRUE, 'Sidebar widgets', 1),
('content', 'categories', '["Uncategorized","News","Updates"]', 'json', TRUE, 'Categories', 1),
('plugins', 'active_plugins', '["vp_promo_bar","vp_gift_widget"]', 'json', TRUE, 'Active plugins', 1),
('plugins', 'custom_plugins', '[]', 'json', TRUE, 'Custom plugins', 1),
('plugins', 'plugin_config', '{"vp_promo_bar":{"text":"Welcome!","linkUrl":"#","linkText":"Click"},"vp_gift_widget":{"targetUrl":"https://example.com","tooltipText":"Gift"}}', 'json', TRUE, 'Plugin config', 1);

-- Create Audit Triggers (Note: Triggers may need to be created separately in some MySQL versions)
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS settings_audit_update AFTER UPDATE ON settings FOR EACH ROW BEGIN IF OLD.setting_value != NEW.setting_value THEN INSERT INTO settings_audit_log (setting_id, setting_group, setting_key, old_value, new_value, changed_by, change_type) VALUES (NEW.id, NEW.setting_group, NEW.setting_key, OLD.setting_value, NEW.setting_value, NEW.updated_by, 'UPDATE'); END IF; END$$
CREATE TRIGGER IF NOT EXISTS settings_audit_insert AFTER INSERT ON settings FOR EACH ROW BEGIN INSERT INTO settings_audit_log (setting_id, setting_group, setting_key, old_value, new_value, changed_by, change_type) VALUES (NEW.id, NEW.setting_group, NEW.setting_key, NULL, NEW.setting_value, NEW.created_by, 'INSERT'); END$$
CREATE TRIGGER IF NOT EXISTS settings_audit_delete BEFORE DELETE ON settings FOR EACH ROW BEGIN INSERT INTO settings_audit_log (setting_id, setting_group, setting_key, old_value, new_value, changed_by, change_type) VALUES (OLD.id, OLD.setting_group, OLD.setting_key, OLD.setting_value, NULL, OLD.updated_by, 'DELETE'); END$$
DELIMITER ;

-- Create Public Settings View
CREATE OR REPLACE VIEW public_settings AS SELECT setting_group, setting_key, setting_value, setting_type FROM settings WHERE is_public = TRUE;

-- Media Table
CREATE TABLE IF NOT EXISTS media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    uploaded_by INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Posts Table
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content LONGTEXT,
    excerpt TEXT,
    status ENUM('published', 'draft', 'archived') DEFAULT 'draft',
    author_id INT,
    category VARCHAR(100) DEFAULT 'Uncategorized',
    tags VARCHAR(255),
    featured_image VARCHAR(255),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Pages Table
CREATE TABLE IF NOT EXISTS pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content LONGTEXT,
    status ENUM('published', 'draft', 'archived') DEFAULT 'draft',
    author_id INT,
    featured_image VARCHAR(255),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
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
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Initial Admin User (REMOVED for security - create admin securely during setup)
-- Admin user should be created via the installer wizard (public/api/install.php)
-- which generates secure passwords and proper user credentials.

-- Sample data removed for production deployments.
-- The installer wizard will create necessary default settings.
-- Site administrators can create content after installation.
