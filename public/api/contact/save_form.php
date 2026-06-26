<?php
/**
 * VonCMS - Save Contact Form
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

CSRFProtection::requireToken();
RateLimiter::requireNotLimited();

$input = json_decode(CSRFProtection::getRequestBody(), true);
if (!$input || !isset($input['id'])) {
  ResponseHelper::sendError('Invalid data', 400);
  exit();
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
    'id' => sanitize_input($input['id']),
    'title' => sanitize_input($input['title'] ?? 'Untitled Form'),
    'template' => $input['template'] ?? '', // Don't sanitize template completely as it contains [tags] and HTML
    'mail_to' => sanitize_input($input['mail']['to'] ?? ''),
    'mail_from' => sanitize_input($input['mail']['from'] ?? ''),
    'mail_subject' => sanitize_input($input['mail']['subject'] ?? ''),
    'mail_body' => $input['mail']['body'] ?? '',
    'msg_success' => sanitize_input($input['messages']['success'] ?? ''),
    'msg_error' => sanitize_input($input['messages']['error'] ?? ''),
    'msg_validation' => sanitize_input($input['messages']['validationError'] ?? ''),
  ]);

  echo json_encode(['success' => true]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
