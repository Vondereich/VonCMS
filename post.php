<?php
header('Content-Type: application/json');

// public/post.php - simple fallback for PHP-only hosts to lookup posts by id or slug
// Usage: /post.php?id=123  or /post.php?slug=zombie-kampung-pisang

$dataFile = realpath(__DIR__ . '/../data/content.json');
if (!$dataFile || !file_exists($dataFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Content store not found']);
    exit;
}

$raw = file_get_contents($dataFile);
$items = json_decode($raw, true);
if ($items === null) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Invalid content.json']);
    exit;
}

$id = isset($_GET['id']) ? trim($_GET['id']) : null;
$slug = isset($_GET['slug']) ? trim($_GET['slug']) : null;

$found = null;
if ($id) {
    foreach ($items as $it) {
        if (!isset($it['id'])) continue;
        if ((string)$it['id'] === (string)$id) { $found = $it; break; }
    }
}

if (!$found && $slug) {
    foreach ($items as $it) {
        if (isset($it['slug']) && (string)$it['slug'] === (string)$slug) { $found = $it; break; }
    }
}

if (!$found) {
    // try id as numeric index or legacy numeric ids
    if ($id && is_numeric($id)) {
        foreach ($items as $it) {
            if (isset($it['id']) && (string)$it['id'] === (string)$id) { $found = $it; break; }
        }
    }
}

if ($found) {
    echo json_encode(['success' => true, 'post' => $found]);
} else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Not found']);
}

?>
