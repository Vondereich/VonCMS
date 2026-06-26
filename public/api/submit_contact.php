<?php
/**
 * VonCMS - Submit Contact Form API (Dynamic CF7 Style)
 * Handles contact form submissions using templates
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// 4. Load Database Config LAST (below)
require_once __DIR__ . '/mail_helper.php';

// 1. Rate Limiting
// Session already started in security.php
$lastSubmit = $_SESSION['last_contact_submit'] ?? 0;
if (time() - $lastSubmit < 30) {
  ResponseHelper::sendError('Please wait a moment before sending another message.', 429);
}

RateLimiter::requireNotLimited();
CSRFProtection::requireToken();

// 2. Parse Input
$input = json_decode(CSRFProtection::getRequestBody(), true);
$formId = $input['formId'] ?? '';
$formData = $input['data'] ?? [];
$honeypot = $input['hp_field'] ?? '';

// 3. Honeypot Check - bots will fill this hidden field
if (!empty($honeypot)) {
  RateLimiter::recordAttempt();
  require_once __DIR__ . '/security/SecurityLogger.php';
  SecurityLogger::log('honeypot_caught', 'medium', [
    'form_id' => $formId,
    'field' => 'hp_field',
    'value' => $honeypot,
    'context' => 'contact_form',
  ]);
  // Return fake success to not alert the bot
  echo json_encode(['success' => true, 'message' => 'Thank you for your message.']);
  exit();
}

if (empty($formId) || !is_array($formData) || empty($formData)) {
  RateLimiter::recordAttempt();
  ResponseHelper::sendError('Invalid form data.', 400);
}

// 3. Load Settings from Database
if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

try {
  // 3a. Fetch contact form from dedicated table
  $stmt = $pdo->prepare('SELECT * FROM contact_forms WHERE id = ? LIMIT 1');
  $stmt->execute([$formId]);
  $f = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$f) {
    // Fallback for transition phase (read from settings)
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'contact' AND setting_key = 'forms' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $contactForms = $row ? json_decode($row['setting_value'], true) : [];
    $form = null;
    if (is_array($contactForms)) {
      foreach ($contactForms as $item) {
        if ($item['id'] === $formId) {
          $form = $item;
          break;
        }
      }
    }

    if (!$form) {
      ResponseHelper::sendError('Form not found or deleted.', 404);
    }

    // Map old structure to internal variables
    $formTemplate = $form['template'] ?? '';
    $mailConfig = $form['mail'];
    $messages = $form['messages'];
  } else {
    // Use new table structure
    $formTemplate = $f['template'] ?? '';
    $mailConfig = [
      'to' => $f['mail_to'],
      'from' => $f['mail_from'],
      'subject' => $f['mail_subject'],
      'body' => $f['mail_body'],
    ];
    $messages = [
      'success' => $f['msg_success'],
      'error' => $f['msg_error'],
      'validationError' => $f['msg_validation'],
    ];
  }
} catch (PDOException $e) {
  ResponseHelper::sendError($e);
}

$requiredFields = [];
if (
  preg_match_all(
    '/\[(?:text|email|textarea|tel|url|date|number)\*\s+([a-zA-Z0-9_-]+)/',
    (string) $formTemplate,
    $requiredMatches,
  )
) {
  $requiredFields = array_values(array_unique($requiredMatches[1]));
}

$missingRequiredFields = [];
foreach ($requiredFields as $requiredField) {
  $fieldValue = $formData[$requiredField] ?? '';
  if (is_array($fieldValue) || trim((string) $fieldValue) === '') {
    $missingRequiredFields[] = $requiredField;
  }
}

if (!empty($missingRequiredFields)) {
  RateLimiter::recordAttempt();
  ResponseHelper::sendError($messages['validationError'] ?: 'Required fields are missing.', 400);
}

// 4. Process Template Tags
/**
 * @param string $template
 * @param array<string, mixed> $data
 * @param PDO|null $pdo
 * @return string
 */
function replaceTags($template, $data, $pdo = null)
{
  $result = $template;
  // Replace standard tags [name]
  foreach ($data as $key => $value) {
    $cleanValue = htmlspecialchars($value);
    $result = str_replace("[$key]", $cleanValue, $result);
  }

  // Replace special tags
  $result = str_replace('[_date]', date('Y-m-d'), $result);
  $result = str_replace('[_time]', date('H:i:s'), $result);
  $result = str_replace('[_remote_ip]', $_SERVER['REMOTE_ADDR'], $result);

  // Global Tags
  if ($pdo) {
    try {
      // Fetch site name
      $stName = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_key = 'site_name' LIMIT 1",
      );
      $stName->execute();
      $siteName = $stName->fetchColumn() ?: 'VonCMS Site';
      $result = str_replace('[_site_name]', $siteName, $result);

      // Fetch site email (SMTP User or Admin Email fallback)
      $stSmtp = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_key IN ('smtpUser', 'email_smtp') AND setting_value != '' LIMIT 1",
      );
      $stSmtp->execute();
      $siteEmail = $stSmtp->fetchColumn();

      if (!$siteEmail) {
        $stAdmin = $pdo->prepare(
          "SELECT setting_value FROM settings WHERE setting_key = 'admin_profile' LIMIT 1",
        );
        $stAdmin->execute();
        $profile = json_decode($stAdmin->fetchColumn() ?: '', true);
        $safeHost = preg_replace(
          '/[^a-zA-Z0-9.\-:]/',
          '',
          (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'),
        );
        $siteEmail = $profile['email'] ?? 'admin@' . $safeHost;
      }

      $result = str_replace('[_site_email]', $siteEmail, $result);
    } catch (Exception $e) {
      // Silent fail for global tags
    }
  }

  return $result;
}

// Prepare Mail Data
$to = replaceTags($mailConfig['to'], $formData, $pdo);
$from = replaceTags($mailConfig['from'], $formData, $pdo);
$subject = replaceTags($mailConfig['subject'], $formData, $pdo);
$body = replaceTags($mailConfig['body'], $formData, $pdo);

// 5. Send Email
// Try to parse "Name <email@domain.com>" or just "email@domain.com"
$fromEmail = '';
$fromName = '';

if (preg_match('/^(.*?)<(.*?)>$/', $from, $matches)) {
  $fromName = trim($matches[1]);
  $fromEmail = trim($matches[2]);
} else {
  $fromEmail = $from;
}

// 5. Save to Database (Leads)
try {
  $stmt = $pdo->prepare("
        INSERT INTO contact_submissions (form_id, data, ip_address, user_agent, referrer) 
        VALUES (?, ?, ?, ?, ?)
    ");
  $stmt->execute([
    $formId,
    json_encode($formData),
    $_SERVER['REMOTE_ADDR'] ?? '',
    $_SERVER['HTTP_USER_AGENT'] ?? '',
    $_SERVER['HTTP_REFERER'] ?? '',
  ]);
} catch (Exception $e) {
  // Don't block email if DB fails to save submission
}

$result = vonSendMail($to, $subject, $body, $fromEmail, $fromName);

if ($result['success']) {
  $_SESSION['last_contact_submit'] = time();
  echo json_encode(['success' => true, 'message' => $messages['success']]);
} else {
  echo json_encode([
    'success' => false,
    'message' => $messages['error'] . ' (' . $result['message'] . ')',
  ]);
}
