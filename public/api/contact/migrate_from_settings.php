<?php

require_once __DIR__ . '/../../core/DataBoundary.php';
/**
 * VonCMS - Migrate Contact Forms from Settings to Dedicated Table
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

SessionManager::requireValidSession();
CSRFProtection::requireToken();

SessionManager::requireAdmin();
$pdo = DataBoundary::database($GLOBALS['pdo'] ?? null);

try {
  // 1. Get current forms from settings
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'contact' AND setting_key = 'forms' LIMIT 1",
  );
  $stmt->execute();
  $row = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));

  if (!$row || empty($row['setting_value'])) {
    echo json_encode(['success' => true, 'message' => 'No forms found in settings to migrate.']);
    exit();
  }

  $forms = json_decode((string) $row['setting_value'], true);
  if (!is_array($forms)) {
    ResponseHelper::sendError('Invalid form data in settings.', 500);
  }

  // 2. Insert into contact_forms table
  $stmt = $pdo->prepare("
        INSERT IGNORE INTO contact_forms (
            id, title, template, mail_to, mail_from, mail_subject, mail_body, 
            msg_success, msg_error, msg_validation, created_at
        ) VALUES (
            :id, :title, :template, :mail_to, :mail_from, :mail_subject, :mail_body, 
            :msg_success, :msg_error, :msg_validation, :created_at
        )
    ");

  $count = 0;
  foreach ($forms as $f) {
    if (!is_array($f)) {
      throw new RuntimeException('Invalid legacy contact form.');
    }
    $mail = is_array($f['mail'] ?? null) ? $f['mail'] : [];
    $messages = is_array($f['messages'] ?? null) ? $f['messages'] : [];
    $stmt->execute([
      'id' => $f['id'],
      'title' => $f['title'] ?? 'Untitled Form',
      'template' => $f['template'] ?? '',
      'mail_to' => $mail['to'] ?? '',
      'mail_from' => $mail['from'] ?? '',
      'mail_subject' => $mail['subject'] ?? '',
      'mail_body' => $mail['body'] ?? '',
      'msg_success' => $messages['success'] ?? '',
      'msg_error' => $messages['error'] ?? '',
      'msg_validation' => $messages['validationError'] ?? '',
      'created_at' => $f['createdAt'] ?? date('Y-m-d H:i:s'),
    ]);
    if ($stmt->rowCount() > 0) {
      $count++;
    }
  }

  echo json_encode([
    'success' => true,
    'message' => "Successfully migrated $count forms to dedicated table.",
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
