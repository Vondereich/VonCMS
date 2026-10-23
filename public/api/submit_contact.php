<?php
/**
 * VonCMS - Submit Contact Form API (Dynamic CF7 Style)
 * Handles contact form submissions using templates
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/contact_honeypot_helper.php';

// 2. Send Headers immediately
sendApiHeaders('POST, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// 4. Load Database Config LAST (below)
require_once __DIR__ . '/mail_helper.php';

// 1. Rate Limiting
// Session already started in security.php
$lastSubmit = $_SESSION['last_contact_submit'] ?? 0;
if (time() - $lastSubmit < 30) {
  ResponseHelper::sendError('Please wait a moment before sending another message.', 429);
}

$contactRateIdentifier = 'contact:' . ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

$requestBody = CSRFProtection::getRequestBody();
if (!is_string($requestBody) || strlen($requestBody) > 32768) {
  RateLimiter::requireAttempt($contactRateIdentifier);
  ResponseHelper::sendError('Contact form payload is too large.', 413);
}

CSRFProtection::requireToken();
// Reserve once across guest sessions before validation, lead storage or mail delivery.
RateLimiter::requireAttempt($contactRateIdentifier);

// 2. Parse Input
$input = json_decode($requestBody, true);
$input = is_array($input) ? $input : [];
$formId = $input['formId'] ?? '';
$formData = $input['data'] ?? [];
$antiBot = $input['antiBot'] ?? null;
$hasLegacyHoneypot = array_key_exists('hp_field', $input);
$legacyHoneypot = $hasLegacyHoneypot ? $input['hp_field'] : null;

if (!is_string($formId) || !preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $formId)) {
  ResponseHelper::sendError('Invalid form data.', 400);
}

// A blank legacy trap means the visitor loaded the form before an OTA update.
// Ask for a refresh instead of silently discarding a legitimate message.
if (!is_array($antiBot) && $hasLegacyHoneypot) {
  if ((is_scalar($legacyHoneypot) || $legacyHoneypot === null) && (string) $legacyHoneypot === '') {
    ResponseHelper::sendError(
      'This contact form has expired. Please refresh the page and try again.',
      409,
    );
  }

  $antiBot = [
    'field' => 'hp_field',
    'token' => '',
    'value' => $legacyHoneypot,
  ];
}

$antiBot = is_array($antiBot) ? $antiBot : [];
$honeypotField = $antiBot['field'] ?? '';
$honeypotToken = $antiBot['token'] ?? '';
$honeypotValue = $antiBot['value'] ?? '';
$honeypotField = is_string($honeypotField) ? $honeypotField : '';
$honeypotToken = is_string($honeypotToken) ? $honeypotToken : '';
$honeypotValueLength =
  is_scalar($honeypotValue) || $honeypotValue === null ? strlen((string) $honeypotValue) : 0;
$honeypotValue =
  is_scalar($honeypotValue) || $honeypotValue === null ? (string) $honeypotValue : '__invalid__';
$honeypotValidation = voncms_contact_honeypot_validate($formId, $honeypotField, $honeypotToken);

// 3. Dynamic honeypot check - suspicious requests receive the established fake success.
if (!$honeypotValidation['valid'] || $honeypotValue !== '') {
  require_once __DIR__ . '/security/SecurityLogger.php';
  SecurityLogger::log('honeypot_caught', 'medium', [
    'form_id' => $formId,
    'field' => $honeypotField !== '' ? $honeypotField : 'missing',
    'reason' => $honeypotValue !== '' ? 'filled' : $honeypotValidation['reason'],
    'value_length' => $honeypotValueLength,
    'context' => 'contact_form',
  ]);
  // Return fake success to not alert the bot
  echo json_encode(['success' => true, 'message' => 'Thank you for your message.']);
  exit();
}

if (!is_array($formData) || empty($formData)) {
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

$declaredFields = [];
if (
  preg_match_all(
    '/\[(text|email|textarea|tel|url|date|number)(\*)?\s+([a-zA-Z0-9_-]+)/',
    (string) $formTemplate,
    $fieldMatches,
    PREG_SET_ORDER,
  )
) {
  foreach ($fieldMatches as $fieldMatch) {
    $declaredFields[$fieldMatch[3]] = [
      'type' => $fieldMatch[1],
      'required' => ($fieldMatch[2] ?? '') === '*',
    ];
  }
}

$normalizedFormData = [];
$invalidFields = [];
foreach ($declaredFields as $fieldName => $fieldDefinition) {
  $hasValue = array_key_exists($fieldName, $formData);
  $fieldValue = $hasValue ? $formData[$fieldName] : '';
  if (!is_scalar($fieldValue) && $fieldValue !== null) {
    $invalidFields[] = $fieldName;
    continue;
  }

  $fieldValue = trim((string) $fieldValue);
  if ($fieldDefinition['required'] && $fieldValue === '') {
    $invalidFields[] = $fieldName;
    continue;
  }

  if ($fieldValue === '') {
    if ($hasValue) {
      $normalizedFormData[$fieldName] = '';
    }
    continue;
  }

  $maxLength = $fieldDefinition['type'] === 'textarea' ? 5000 : 500;
  if (strlen($fieldValue) > $maxLength) {
    $invalidFields[] = $fieldName;
    continue;
  }

  $isValid = true;
  if ($fieldDefinition['type'] === 'email') {
    $isValid = filter_var($fieldValue, FILTER_VALIDATE_EMAIL) !== false;
  } elseif ($fieldDefinition['type'] === 'url') {
    $scheme = strtolower((string) parse_url($fieldValue, PHP_URL_SCHEME));
    $isValid =
      filter_var($fieldValue, FILTER_VALIDATE_URL) !== false &&
      in_array($scheme, ['http', 'https'], true);
  } elseif ($fieldDefinition['type'] === 'number') {
    $isValid = is_numeric($fieldValue);
  } elseif ($fieldDefinition['type'] === 'date') {
    $dateValue = DateTime::createFromFormat('Y-m-d', $fieldValue);
    $isValid = $dateValue !== false && $dateValue->format('Y-m-d') === $fieldValue;
  } elseif ($fieldDefinition['type'] === 'tel') {
    $isValid = preg_match('/^[0-9+().\-\s]{3,50}$/', $fieldValue) === 1;
  }

  if (!$isValid) {
    $invalidFields[] = $fieldName;
    continue;
  }

  $normalizedFormData[$fieldName] = $fieldValue;
}

if (empty($declaredFields) || empty($normalizedFormData) || !empty($invalidFields)) {
  ResponseHelper::sendError($messages['validationError'] ?: 'Invalid form data.', 400);
}

$formData = $normalizedFormData;

// 4. Process Template Tags
/**
 * @param string $template
 * @param array<string, mixed> $data
 * @param PDO|null $pdo
 * @param bool $escapeHtml
 * @return string
 */
function replaceTags($template, $data, $pdo = null, bool $escapeHtml = true)
{
  $tags = [];
  // Replace standard tags [name]
  foreach ($data as $key => $value) {
    $tags["[$key]"] = (string) $value;
  }

  // Replace special tags
  $tags['[_date]'] = date('Y-m-d');
  $tags['[_time]'] = date('H:i:s');
  $tags['[_remote_ip]'] = $_SERVER['REMOTE_ADDR'] ?? '';

  // Global Tags
  if ($pdo) {
    try {
      // Fetch site name
      $stName = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_key = 'site_name' LIMIT 1",
      );
      $stName->execute();
      $siteName = $stName->fetchColumn() ?: 'VonCMS Site';
      $tags['[_site_name]'] = $siteName;

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

      $tags['[_site_email]'] = $siteEmail;
    } catch (Exception $e) {
      // Silent fail for global tags
    }
  }

  if ($escapeHtml) {
    $tags = array_map(
      static fn($value) => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
      $tags,
    );
  }
  // One pass: submitted text containing another tag must remain literal text.
  return strtr($template, $tags);
}

// Prepare Mail Data
// Table-backed header templates have historically been HTML-encoded on save.
// Decode the template once, never the visitor values inserted afterwards.
$headerTemplate = static fn($value) => $f
  ? html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8')
  : (string) $value;
$to = replaceTags($headerTemplate($mailConfig['to']), $formData, $pdo, false);
$from = replaceTags($headerTemplate($mailConfig['from']), $formData, $pdo, false);
$subject = replaceTags($headerTemplate($mailConfig['subject']), $formData, $pdo, false);
$bodyTemplate = (string) $mailConfig['body'];
// In particular, the default <[your-email]> is text, not a configured HTML tag.
if (preg_match('/<\/?[a-z][a-z0-9]*(?:\s[^<>]*?)?\/?>/i', $bodyTemplate) !== 1) {
  $bodyTemplate = htmlspecialchars($bodyTemplate, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
$body =
  '<div style="white-space: pre-wrap;">' . replaceTags($bodyTemplate, $formData, $pdo) . '</div>';

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

// Claim while the session is locked, then persist before any slow external work.
// A second request cannot reuse this challenge or bypass the session cooldown.
$submissionNonce = $honeypotValidation['nonce'];
voncms_contact_honeypot_mark_used($submissionNonce);
$_SESSION['last_contact_submit'] = time();
$_SESSION['contact_submit_nonce'] = $submissionNonce;
session_write_close();

// 5. Save to Database (Leads). Retention failure must not prevent a new receipt.
try {
  $pdo->exec('DELETE FROM contact_submissions WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)');
} catch (Exception $e) {
  error_log('Contact lead retention cleanup failed.');
}
$submissionSaved = false;
try {
  $stmt = $pdo->prepare("
        INSERT INTO contact_submissions (form_id, data, ip_address, user_agent, referrer) 
        VALUES (?, ?, ?, ?, ?)
    ");
  $stmt->execute([
    $formId,
    json_encode($formData),
    substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
    substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
    substr((string) ($_SERVER['HTTP_REFERER'] ?? ''), 0, 2048),
  ]);
  $submissionSaved = true;
} catch (Exception $e) {
  // Don't block email if DB fails to save submission
  error_log('Contact lead storage failed.');
}

try {
  $result = vonSendMail($to, $subject, $body, $fromEmail, $fromName);
} catch (Throwable $e) {
  $result = ['success' => false, 'message' => 'Unexpected mail delivery failure.'];
}

if (empty($result['success'])) {
  error_log('Contact mail delivery failed: ' . ($result['message'] ?? 'Unknown mail error'));
}

if (!empty($result['success']) || $submissionSaved) {
  echo json_encode([
    'success' => true,
    'message' => !empty($result['success'])
      ? $messages['success']
      : 'Your message has been received. Please do not send it again.',
  ]);
} else {
  // Neither destination accepted it. Refund only this request's session claim;
  // retain the IP attempt and any newer request/session state.
  if (@session_start()) {
    unset($_SESSION['contact_honeypot_used'][$submissionNonce]);
    if (($_SESSION['contact_submit_nonce'] ?? null) === $submissionNonce) {
      unset($_SESSION['last_contact_submit'], $_SESSION['contact_submit_nonce']);
    }
    session_write_close();
  } else {
    error_log('Contact retry reservation could not be released.');
  }
  http_response_code(502);
  echo json_encode([
    'success' => false,
    'message' => $messages['error'] ?: 'Unable to send your message right now.',
  ]);
}
