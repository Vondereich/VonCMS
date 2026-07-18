<?php
/**
 * VonCMS - Save Contact Form
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

CSRFProtection::requireToken();
RateLimiter::requireNotLimited();

$requestBody = CSRFProtection::getRequestBody();
if (!is_string($requestBody) || strlen($requestBody) > 131072) {
  ResponseHelper::sendError('Contact form payload is too large.', 413);
}

$input = json_decode($requestBody, true);
if (!is_array($input) || !isset($input['id'])) {
  ResponseHelper::sendError('Invalid data', 400);
}

$mail = is_array($input['mail'] ?? null) ? $input['mail'] : [];
$messages = is_array($input['messages'] ?? null) ? $input['messages'] : [];
$formValues = [
  'id' => $input['id'],
  'title' => $input['title'] ?? 'Untitled Form',
  'template' => $input['template'] ?? '',
  'mail_to' => $mail['to'] ?? '',
  'mail_from' => $mail['from'] ?? '',
  'mail_subject' => $mail['subject'] ?? '',
  'mail_body' => $mail['body'] ?? '',
  'msg_success' => $messages['success'] ?? '',
  'msg_error' => $messages['error'] ?? '',
  'msg_validation' => $messages['validationError'] ?? '',
];

foreach ($formValues as $value) {
  if (!is_scalar($value) && $value !== null) {
    ResponseHelper::sendError('Invalid contact form fields.', 400);
  }
}

$formValues = array_map(static fn($value) => (string) $value, $formValues);
if (!preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $formValues['id'])) {
  ResponseHelper::sendError('Invalid contact form ID.', 400);
}

$lengthLimits = [
  'title' => 255,
  'template' => 65535,
  'mail_to' => 255,
  'mail_from' => 255,
  'mail_subject' => 255,
  'mail_body' => 65535,
  'msg_success' => 1000,
  'msg_error' => 1000,
  'msg_validation' => 1000,
];
foreach ($lengthLimits as $field => $maxLength) {
  if (strlen($formValues[$field]) > $maxLength) {
    ResponseHelper::sendError('Contact form field is too long: ' . $field, 400);
  }
}

try {
  $stmt = $pdo->prepare("
        INSERT INTO contact_forms (
            id, title, template, mail_to, mail_from, mail_subject, mail_body, 
            msg_success, msg_error, msg_validation
        ) VALUES (
            :id, :title, :template, :mail_to, :mail_from, :mail_subject, :mail_body, 
            :msg_success, :msg_error, :msg_validation
        ) ON DUPLICATE KEY UPDATE 
            title = VALUES(title),
            template = VALUES(template),
            mail_to = VALUES(mail_to),
            mail_from = VALUES(mail_from),
            mail_subject = VALUES(mail_subject),
            mail_body = VALUES(mail_body),
            msg_success = VALUES(msg_success),
            msg_error = VALUES(msg_error),
            msg_validation = VALUES(msg_validation)
    ");

  $stmt->execute([
    'id' => sanitize_input($formValues['id']),
    'title' => sanitize_input($formValues['title'] ?: 'Untitled Form'),
    'template' => $formValues['template'],
    'mail_to' => sanitize_input($formValues['mail_to']),
    'mail_from' => sanitize_input($formValues['mail_from']),
    'mail_subject' => sanitize_input($formValues['mail_subject']),
    'mail_body' => $formValues['mail_body'],
    'msg_success' => sanitize_input($formValues['msg_success']),
    'msg_error' => sanitize_input($formValues['msg_error']),
    'msg_validation' => sanitize_input($formValues['msg_validation']),
  ]);

  echo json_encode(['success' => true]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
