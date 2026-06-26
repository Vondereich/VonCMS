<?php
/**
 * VonCMS - Newsletter Subscribe API
 * SECURITY: Rate limiting, email validation, sanitization
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// 0. Enforce CSRF
CSRFProtection::requireToken();

$newsletterEnabled = false;
try {
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'newsletter' AND setting_key IN ('newsletter_config', 'configuration') ORDER BY CASE WHEN setting_key = 'newsletter_config' THEN 0 ELSE 1 END LIMIT 1",
  );
  $stmt->execute();
  $newsletterRaw = $stmt->fetchColumn();
  $newsletterConfig = is_string($newsletterRaw) ? json_decode($newsletterRaw, true) : null;
  $newsletterEnabled =
    is_array($newsletterConfig) &&
    filter_var($newsletterConfig['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
} catch (PDOException $e) {
  $newsletterEnabled = false;
}

if (!$newsletterEnabled) {
  ResponseHelper::sendError('Newsletter subscriptions are currently disabled.', 403);
}

// Rate Limiting: Max 5 subscriptions per IP per hour
$clientIP = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

try {
  // Check rate limit
  $stmt = $pdo->prepare(
    'SELECT COUNT(*) as count FROM newsletter_subscribers WHERE ip_address = ? AND subscribed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
  );
  $stmt->execute([$clientIP]);
  $rateCheck = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($rateCheck && $rateCheck['count'] >= 5) {
    ResponseHelper::sendError('Too many requests. Please try again later.', 429);
  }
} catch (PDOException $e) {
  // Table might not exist yet, continue
}

// Get and validate input
$input = json_decode(CSRFProtection::getRequestBody(), true);
$email = trim($input['email'] ?? '');
$honeypot = $input['hp_field'] ?? '';

// Honeypot check
if (!empty($honeypot)) {
  error_log(
    'Honeypot triggered during newsletter subscription from IP: ' .
      ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
  );
  ResponseHelper::sendError('Subscription failed', 400);
}

// Validate email
if (empty($email)) {
  ResponseHelper::sendError('Email is required', 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  ResponseHelper::sendError('Invalid email address', 400);
}

// Sanitize email
$email = filter_var($email, FILTER_SANITIZE_EMAIL);

// Check email length
if (strlen($email) > 255) {
  ResponseHelper::sendError('Email too long', 400);
}

try {
  // Check if already subscribed
  $stmt = $pdo->prepare('SELECT id, status FROM newsletter_subscribers WHERE email = ?');
  $stmt->execute([$email]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existing) {
    if ($existing['status'] === 'active') {
      echo json_encode(['success' => true, 'message' => 'You are already subscribed!']);
      exit();
    } else {
      // Resubscribe
      $stmt = $pdo->prepare(
        "UPDATE newsletter_subscribers SET status = 'active', subscribed_at = NOW(), unsubscribed_at = NULL WHERE id = ?",
      );
      $stmt->execute([$existing['id']]);
      echo json_encode([
        'success' => true,
        'message' => 'Welcome back! You have been resubscribed.',
      ]);
      exit();
    }
  }

  // Insert new subscriber
  $stmt = $pdo->prepare(
    "INSERT INTO newsletter_subscribers (email, ip_address, source) VALUES (?, ?, 'widget')",
  );
  $stmt->execute([$email, $clientIP]);

  echo json_encode([
    'success' => true,
    'message' => 'Thank you for subscribing!',
  ]);
} catch (PDOException $e) {
  // Check if table doesn't exist
  if (strpos($e->getMessage(), "doesn't exist") !== false) {
    ResponseHelper::sendError('Newsletter not configured. Please contact admin.', 500);
  } else {
    ResponseHelper::sendError($e);
  }
}
