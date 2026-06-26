<?php
/**
 * VonCMS - Get Contact Forms (Dedicated Table)
 */
require_once __DIR__ . '/../../security.php';
sendApiHeaders('GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

try {
  try {
    $stmt = $pdo->query('SELECT * FROM contact_forms ORDER BY created_at DESC');
    $forms = $stmt->fetchAll(PDO::FETCH_ASSOC);
  } catch (Exception $e) {
    // Table might be missing in older versions, return empty array to allow migration
    $forms = [];
  }

  // Format for frontend (mapping DB columns to camelCase expected by ContactManager)
  $formattedForms = array_map(function ($f) {
    return [
      'id' => $f['id'],
      'title' => $f['title'],
      'template' => $f['template'],
      'mail' => [
        'to' => $f['mail_to'],
        'from' => $f['mail_from'],
        'subject' => $f['mail_subject'],
        'body' => $f['mail_body'],
      ],
      'messages' => [
        'success' => $f['msg_success'],
        'error' => $f['msg_error'],
        'validationError' => $f['msg_validation'],
      ],
      'createdAt' => $f['created_at'],
    ];
  }, $forms);

  echo json_encode(['success' => true, 'forms' => $formattedForms]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
