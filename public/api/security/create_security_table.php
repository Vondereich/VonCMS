<?php
/**
 * Create Security Logs Table
 * Migration script for Security Dashboard
 */

require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

// Only Admin should be able to run this
SessionManager::requireAdmin();
CSRFProtection::requireToken();

if (!isset($pdo) || !$pdo) {
  ResponseHelper::sendError('Database configuration missing', 503);
}

try {
  // Create security_logs table
  // Create security_logs table (MySQL Compatible)
  $sql = "CREATE TABLE IF NOT EXISTS security_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        endpoint VARCHAR(255),
        severity VARCHAR(20) NOT NULL,
        details TEXT,
        blocked TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

  $pdo->exec($sql);

  // Create indexes for performance
  $indexes = [
    'CREATE INDEX IF NOT EXISTS idx_security_timestamp ON security_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_security_ip ON security_logs(ip_address)',
    'CREATE INDEX IF NOT EXISTS idx_security_event ON security_logs(event_type)',
  ];

  foreach ($indexes as $indexSql) {
    $pdo->exec($indexSql);
  }

  echo json_encode([
    'success' => true,
    'message' => 'Security logs table created successfully',
  ]);
} catch (PDOException $e) {
  ResponseHelper::sendError($e);
}
