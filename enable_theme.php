<?php
header('Content-Type: application/json');
// Enable a theme by id. This will mark the theme enabled in data/themes.json
// and optionally copy its folder to public/themes/<id> for serving.

$root = dirname(__DIR__);
$dataFile = $root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'themes.json';
$themesDir = $root . DIRECTORY_SEPARATOR . 'themes';
$publicThemes = $root . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'themes';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'POST required']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$id = $payload['id'] ?? null;
$enable = isset($payload['enable']) ? (bool)$payload['enable'] : true;

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing theme id']);
    exit;
}

if (!file_exists($dataFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'No themes data']);
    exit;
}

$list = json_decode(file_get_contents($dataFile), true);
if (!is_array($list)) $list = [];

$found = false;
foreach ($list as &$t) {
    if ($t['id'] === $id) {
        $t['enabled'] = $enable;
        $found = true;
        // If enabling, copy files to public/themes/<id>
        $src = $root . DIRECTORY_SEPARATOR . $t['folder'];
        $dst = $publicThemes . DIRECTORY_SEPARATOR . $id;
        if ($enable) {
            // ensure dest exists
            if (!is_dir($dst)) {
                mkdir($dst, 0755, true);
            }
            // recursive copy
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, RecursiveDirectoryIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
            foreach ($it as $item) {
                $destPath = $dst . DIRECTORY_SEPARATOR . $it->getSubPathName();
                if ($item->isDir()) {
                    if (!is_dir($destPath)) mkdir($destPath, 0755, true);
                } else {
                    copy($item->getRealPath(), $destPath);
                }
            }
        } else {
            // disabling: remove public copy
            if (is_dir($dst)) {
                $it2 = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dst, RecursiveDirectoryIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($it2 as $fileinfo) {
                    if ($fileinfo->isDir()) rmdir($fileinfo->getRealPath()); else unlink($fileinfo->getRealPath());
                }
                @rmdir($dst);
            }
        }
    }
}
unset($t);

if (!$found) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Theme not found']);
    exit;
}

file_put_contents($dataFile, json_encode($list, JSON_PRETTY_PRINT));
echo json_encode(['success' => true, 'message' => 'Theme updated', 'id' => $id, 'enabled' => $enable]);
exit;
