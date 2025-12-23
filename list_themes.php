<?php
header('Content-Type: application/json');
$root = dirname(__DIR__);
$dataFile = $root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'themes.json';
if (!file_exists($dataFile)) {
    echo json_encode([]);
    exit;
}
$list = json_decode(file_get_contents($dataFile), true);
if (!is_array($list)) $list = [];
echo json_encode($list);
exit;
