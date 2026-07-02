<?php
/**
 * VonCMS - Category Management API
 * Admin-only helper for listing, adding, renaming, and removing post categories.
 */

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/settings_audit_helper.php';
require_once __DIR__ . '/public_cache_helper.php';
sendApiHeaders('GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

require_once __DIR__ . '/../von_config.php';

SessionManager::requireAdmin();
$userId = $_SESSION['user']['id'] ?? null;

/**
 * @param mixed $value
 * @return string
 */
function normalizeCategoryLabel($value)
{
  $label = trim((string) $value);
  $label = preg_replace('/\s+/', ' ', $label ?? '');
  return $label ?? '';
}

/**
 * @param array<int, mixed> $categories
 * @return array<int, string>
 */
function categories_case_insensitive_unique($categories)
{
  $unique = [];
  foreach ($categories as $rawCategory) {
    $category = normalizeCategoryLabel($rawCategory);
    if ($category === '') {
      continue;
    }

    $exists = false;
    foreach ($unique as $existing) {
      if (strcasecmp($existing, $category) === 0) {
        $exists = true;
        break;
      }
    }

    if (!$exists) {
      $unique[] = $category;
    }
  }

  return $unique;
}

/**
 * @param PDO $pdo
 * @return array<int, string>
 */
function loadStoredCategories($pdo)
{
  $stmt = $pdo->prepare(
    "SELECT setting_value FROM settings WHERE setting_group = 'content' AND setting_key = 'categories' LIMIT 1",
  );
  $stmt->execute();
  $rawValue = $stmt->fetchColumn();

  if (!$rawValue) {
    return ['Uncategorized'];
  }

  $decoded = json_decode($rawValue, true);
  if (!is_array($decoded)) {
    return ['Uncategorized'];
  }

  $categories = categories_case_insensitive_unique($decoded);
  if (empty($categories)) {
    $categories = ['Uncategorized'];
  }

  return $categories;
}

/**
 * @param PDO $pdo
 * @param array<int, mixed> $categories
 * @param int|null $actorUserId
 * @return array<int, string>
 */
function saveStoredCategories($pdo, $categories, $actorUserId = null)
{
  $normalized = categories_case_insensitive_unique($categories);
  if (empty($normalized)) {
    $normalized = ['Uncategorized'];
  }

  $encodedValue = json_encode(
    array_values($normalized),
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  $auditBefore = voncms_get_setting_audit_snapshot($pdo, 'content', 'categories');

  $stmt = $pdo->prepare(
    "INSERT INTO settings (setting_group, setting_key, setting_value, setting_type, is_public)
     VALUES ('content', 'categories', :value, 'json', 1)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = 'json', is_public = 1",
  );
  $stmt->execute(['value' => $encodedValue]);
  voncms_record_setting_audit(
    $pdo,
    'content',
    'categories',
    $auditBefore,
    $encodedValue,
    $actorUserId !== null ? (int) $actorUserId : null,
  );

  return $normalized;
}

/**
 * @param PDO $pdo
 * @return array<int, array{name: string, postCount: int}>
 */
function buildCategorySummary($pdo)
{
  $storedCategories = loadStoredCategories($pdo);
  $summary = [];

  foreach ($storedCategories as $category) {
    $summary[] = ['name' => $category, 'postCount' => 0];
  }

  $stmt = $pdo->query(
    "SELECT TRIM(category) AS category_name, COUNT(*) AS post_count
     FROM posts
     WHERE category IS NOT NULL AND TRIM(category) <> ''
     GROUP BY category_name
     ORDER BY category_name ASC",
  );
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($rows as $row) {
    $category = normalizeCategoryLabel($row['category_name'] ?? '');
    if ($category === '') {
      continue;
    }

    $matchedIndex = null;
    foreach ($summary as $index => $item) {
      if (strcasecmp($item['name'], $category) === 0) {
        $matchedIndex = $index;
        break;
      }
    }

    if ($matchedIndex === null) {
      $summary[] = [
        'name' => $category,
        'postCount' => (int) ($row['post_count'] ?? 0),
      ];
    } else {
      $summary[$matchedIndex]['postCount'] = (int) ($row['post_count'] ?? 0);
    }
  }

  if (empty($summary)) {
    $summary[] = ['name' => 'Uncategorized', 'postCount' => 0];
  }

  usort($summary, function ($a, $b) {
    if ($a['name'] === 'Uncategorized') {
      return -1;
    }
    if ($b['name'] === 'Uncategorized') {
      return 1;
    }
    return strcasecmp($a['name'], $b['name']);
  });

  return $summary;
}

try {
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
      'success' => true,
      'categories' => buildCategorySummary($pdo),
    ]);
    exit();
  }

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ResponseHelper::sendError('Method not allowed', 405);
  }

  CSRFProtection::requireToken();

  $input = json_decode(file_get_contents('php://input'), true) ?: [];
  $action = strtolower(trim((string) ($input['action'] ?? '')));

  if ($action === '') {
    ResponseHelper::sendError('Missing category action.', 400);
  }

  $pdo->beginTransaction();
  $storedCategories = loadStoredCategories($pdo);

  if ($action === 'add') {
    $category = normalizeCategoryLabel($input['category'] ?? '');
    if ($category === '') {
      ResponseHelper::sendError('Category name is required.', 400);
    }

    $storedCategories[] = $category;
    saveStoredCategories($pdo, $storedCategories, $userId);
    $pdo->commit();
    voncms_public_cache_clear();

    echo json_encode([
      'success' => true,
      'message' => 'Category added.',
      'categories' => buildCategorySummary($pdo),
    ]);
    exit();
  }

  if ($action === 'rename') {
    $oldCategory = normalizeCategoryLabel($input['old_category'] ?? '');
    $newCategory = normalizeCategoryLabel($input['new_category'] ?? '');

    if ($oldCategory === '' || $newCategory === '') {
      ResponseHelper::sendError('Old and new category names are required.', 400);
    }

    $updatePosts = $pdo->prepare(
      "UPDATE posts
       SET category = :new_category
       WHERE category IS NOT NULL
         AND TRIM(category) <> ''
         AND LOWER(TRIM(category)) = LOWER(:old_category)",
    );
    $updatePosts->execute([
      'new_category' => $newCategory,
      'old_category' => $oldCategory,
    ]);

    $updatedSettings = [];
    foreach ($storedCategories as $category) {
      if (strcasecmp($category, $oldCategory) === 0) {
        $updatedSettings[] = $newCategory;
      } else {
        $updatedSettings[] = $category;
      }
    }
    if (!in_array($newCategory, $updatedSettings, true)) {
      $updatedSettings[] = $newCategory;
    }
    saveStoredCategories($pdo, $updatedSettings, $userId);
    $pdo->commit();
    voncms_public_cache_clear();

    echo json_encode([
      'success' => true,
      'message' => 'Category renamed across posts.',
      'updated_posts' => $updatePosts->rowCount(),
      'categories' => buildCategorySummary($pdo),
    ]);
    exit();
  }

  if ($action === 'delete') {
    $category = normalizeCategoryLabel($input['category'] ?? '');
    $replacement = normalizeCategoryLabel($input['replacement_category'] ?? 'Uncategorized');
    if ($category === '') {
      ResponseHelper::sendError('Category name is required.', 400);
    }
    if (strcasecmp($category, 'Uncategorized') === 0) {
      ResponseHelper::sendError('Uncategorized cannot be deleted.', 400);
    }
    if ($replacement === '') {
      $replacement = 'Uncategorized';
    }

    $updatePosts = $pdo->prepare(
      "UPDATE posts
       SET category = :replacement_category
       WHERE category IS NOT NULL
         AND TRIM(category) <> ''
         AND LOWER(TRIM(category)) = LOWER(:category)",
    );
    $updatePosts->execute([
      'replacement_category' => $replacement,
      'category' => $category,
    ]);

    $updatedSettings = array_values(
      array_filter($storedCategories, function ($existing) use ($category) {
        return strcasecmp($existing, $category) !== 0;
      }),
    );
    $updatedSettings[] = $replacement;
    saveStoredCategories($pdo, $updatedSettings, $userId);
    $pdo->commit();
    voncms_public_cache_clear();

    echo json_encode([
      'success' => true,
      'message' => 'Category deleted and affected posts moved to ' . $replacement . '.',
      'updated_posts' => $updatePosts->rowCount(),
      'categories' => buildCategorySummary($pdo),
    ]);
    exit();
  }

  $pdo->rollBack();
  ResponseHelper::sendError('Unsupported category action.', 400);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  ResponseHelper::sendError($e);
}
