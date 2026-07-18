<?php
/**
 * VonCMS - Get Public Contact Form (By ID)
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

// Public access allowed (Read-only)
$id = $_GET['id'] ?? '';

if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $id)) {
  ResponseHelper::sendError('Invalid form ID', 400);
}

try {
  $stmt = $pdo->prepare(
    'SELECT id, title, template, msg_success, msg_error, msg_validation FROM contact_forms WHERE id = ?',
  );
  $stmt->execute([$id]);
  $f = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$f) {
    // Fallback to settings (for transition)
    $stmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group = 'contact' AND setting_key = 'forms' LIMIT 1",
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $forms = $row ? json_decode($row['setting_value'], true) : [];
    $found = null;
    if (is_array($forms)) {
      foreach ($forms as $item) {
        if ($item['id'] === $id) {
          $found = [
            'id' => $item['id'],
            'title' => $item['title'],
            'template' => $item['template'],
            'messages' => $item['messages'],
          ];
          break;
        }
      }
    }

    if (!$found) {
      ResponseHelper::sendError('Form not found', 404);
    }
    echo json_encode(['success' => true, 'form' => $found]);
    exit();
  }

  $form = [
    'id' => $f['id'],
    'title' => $f['title'],
    'template' => $f['template'],
    'messages' => [
      'success' => $f['msg_success'],
      'error' => $f['msg_error'],
      'validationError' => $f['msg_validation'],
    ],
  ];

  echo json_encode(['success' => true, 'form' => $form]);
} catch (Exception $e) {
  ResponseHelper::sendError('Database error', 500);
}
