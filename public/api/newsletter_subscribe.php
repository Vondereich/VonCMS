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

$requestBody = CSRFProtection::getRequestBody();
if (!is_string($requestBody) || strlen($requestBody) > 8192) {
  ResponseHelper::sendError('Subscription payload is too large.', 413);
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

$clientIP = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateIdentifier = 'newsletter:' . $clientIP;
RateLimiter::requireNotLimited($rateIdentifier);

// Get and validate input
$input = json_decode($requestBody, true);
$input = is_array($input) ? $input : [];
$email = $input['email'] ?? '';
$honeypot = $input['hp_field'] ?? '';

if ((!is_scalar($email) && $email !== null) || (!is_scalar($honeypot) && $honeypot !== null)) {
  RateLimiter::recordAttempt($rateIdentifier);
  ResponseHelper::sendError('Invalid subscription data', 400);
}

$email = trim((string) $email);
$honeypot = (string) $honeypot;
RateLimiter::recordAttempt($rateIdentifier);

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
  $publicMessage = 'If this address is eligible, your subscription request has been received.';

  // Check if already subscribed
  $stmt = $pdo->prepare('SELECT id, status FROM newsletter_subscribers WHERE email = ?');
  $stmt->execute([$email]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existing) {
    echo json_encode(['success' => true, 'message' => $publicMessage]);
    exit();
  }

  // Insert new subscriber
  $stmt = $pdo->prepare(
    "INSERT INTO newsletter_subscribers (email, ip_address, source) VALUES (?, ?, 'widget')",
  );
  $stmt->execute([$email, $clientIP]);

  echo json_encode([
    'success' => true,
    'message' => $publicMessage,
  ]);
} catch (PDOException $e) {
  // Check if table doesn't exist
  if (strpos($e->getMessage(), "doesn't exist") !== false) {
    ResponseHelper::sendError('Newsletter not configured. Please contact admin.', 500);
  } elseif ($e->getCode() === '23000') {
    echo json_encode(['success' => true, 'message' => $publicMessage]);
  } else {
    ResponseHelper::sendError($e);
  }
}
