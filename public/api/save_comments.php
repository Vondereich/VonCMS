<?php
/**
 * VonCMS - Save Comments API
 * Saves comments to database
 */
require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// Enforce Security
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

if (file_exists(__DIR__ . '/../von_config.php')) {
  require_once __DIR__ . '/../von_config.php';
}

// Get input data FIRST (before CSRF checks that use $input)
$input = json_decode(CSRFProtection::getRequestBody(), true);

if (!$input) {
  ResponseHelper::sendError('Invalid JSON input', 400);
}

// Enforce Security for Moderation Actions
// Normalize action early so only known routes stay public.
$action = isset($input['action']) ? (string) $input['action'] : null;

if ($action !== null) {
  $hasSession = isset($_SESSION['user']);

  // Moderation actions: Mandatory Session + CSRF
  if (in_array($action, ['delete', 'updateStatus', 'like'], true)) {
    SessionManager::requireValidSession();
    CSRFProtection::requireToken();
  }

  // Add Comment: require same-site CSRF for both logged-in and guest writers.
  if ($action === 'add') {
    CSRFProtection::requireToken();
    if (!$hasSession) {
      RateLimiter::requireNotLimited();
    }
  }
}

$allowedActions = ['add', 'like', 'delete', 'updateStatus'];
if ($action !== null && !in_array($action, $allowedActions, true)) {
  ResponseHelper::sendError('Unknown action or invalid input', 400);
}

$isLegacyBulkMigration = isset($input['comments']) && is_array($input['comments']);
if ($action === null && $isLegacyBulkMigration) {
  SessionManager::requireAdmin();
  CSRFProtection::requireToken();
}
// Check database connection
if (!isset($pdo) || $pdo === null) {
  // Fallback to JSON storage (Legacy)
  $dataDir = __DIR__ . '/../data';
  $commentsFile = $dataDir . '/comments.json';

  if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
  }

  if (!$isLegacyBulkMigration) {
    ResponseHelper::sendError('Comments JSON fallback only supports admin migration payloads', 400);
  }

  $comments = $input['comments'];
  $data = ['comments' => $comments];
  $result = file_put_contents($commentsFile, json_encode($data, JSON_PRETTY_PRINT));

  if ($result === false) {
    ResponseHelper::sendError('Failed to save comments', 500);
  }

  echo json_encode(['success' => true, 'message' => 'Comments saved to JSON', 'source' => 'json']);
  exit();
}

try {
  // Handle single comment add
  if ($action === 'add') {
    $postId = isset($input['postId']) ? intval(preg_replace('/[^0-9]/', '', $input['postId'])) : 0;

    $discussionEnabled = true;
    try {
      $stmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_key = 'discussion_enabled' LIMIT 1",
      );
      $stmt->execute();
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if ($row && array_key_exists('setting_value', $row)) {
        $discussionEnabled = filter_var($row['setting_value'], FILTER_VALIDATE_BOOLEAN);
      }
    } catch (Exception $e) {
      // Use enabled default on lookup error.
    }

    if (!$discussionEnabled) {
      ResponseHelper::sendError('Comments are disabled for this site.', 403);
    }

    // 1.3 Comment impersonation via client-supplied userId (Fix)
    // derive identity from session if logged in, otherwise force null/anonymous
    $currentUser = $_SESSION['user'] ?? null;
    if ($currentUser) {
      $userId = $currentUser['id'];
      $username = $currentUser['username'] ?? 'User-' . $userId;
      $userAvatar = ResponseHelper::scrubAvatarUrl($currentUser['avatar'] ?? '');
    } else {
      $userId = null;
      $username = isset($input['username'])
        ? htmlspecialchars($input['username'], ENT_QUOTES, 'UTF-8')
        : 'Anonymous';
      $userAvatar = ResponseHelper::scrubAvatarUrl($input['userAvatar'] ?? '');
    }

    // Flexible parentId handling (strips 'c-' or 'r-' prefixes)
    $parentIdRaw = isset($input['parentId']) ? $input['parentId'] : null;
    $parentId = $parentIdRaw ? intval(preg_replace('/[^0-9]/', '', $parentIdRaw)) : null;

    $content = isset($input['content'])
      ? htmlspecialchars($input['content'], ENT_QUOTES, 'UTF-8')
      : '';
    if (empty($content)) {
      ResponseHelper::sendError('Comment content is required', 400);
    }

    // Quality Check: Reject very short comments (Early Rejection)
    if (mb_strlen($content) < 10) {
      ResponseHelper::sendError('Comment is too short. Please write at least 10 characters.', 400);
    }

    // ============================================
    // AUTO SPAM DETECTION SYSTEM
    // ============================================
    $status = 'approved'; // Default: Auto-approve
    $spamReasons = [];
    $isLoggedIn = isset($_SESSION['user']);

    // 1. Honeypot Check (if field exists and is filled = bot)
    $honeypot = $input['hp_field'] ?? ($input['website'] ?? '');
    if (!empty($honeypot)) {
      $status = 'spam';
      $spamReasons[] = 'honeypot';
      require_once __DIR__ . '/security/SecurityLogger.php';
      SecurityLogger::log('honeypot_caught', 'high', [
        'post_id' => $postId,
        'username' => $username,
        'field' => !empty($input['hp_field']) ? 'hp_field' : 'website',
        'context' => 'comment_add',
      ]);
    }

    // 2. Spam Keywords Check (Blacklisted keywords always force moderation)
    $defaultKeywords =
      'viagra, cialis, casino, lottery, prize winner, click here, buy now, free money, make money fast, earn extra cash, work from home, crypto investment, bitcoin profit, forex trading, adult content, xxx, nigerian prince, wire transfer, western union';
    $keywordsString = $defaultKeywords;

    // Try to get from database settings
    try {
      $stmt = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_key = 'spam_keywords' LIMIT 1",
      );
      $stmt->execute();
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      if ($row && !empty($row['setting_value'])) {
        $keywordsString = $row['setting_value'];
      }
    } catch (Exception $e) {
      // Use default on error
    }

    $spamKeywords = array_map('trim', explode(',', strtolower($keywordsString)));
    $contentLower = strtolower($content);
    foreach ($spamKeywords as $keyword) {
      if (strpos($contentLower, $keyword) !== false) {
        $status = 'pending'; // Always needs review if keyword matches
        $spamReasons[] = "keyword:$keyword";
        break;
      }
    }

    // --- HEURISTICS: Only applies to GUESTS (Members are trusted) ---
    if (!$isLoggedIn) {
      // 3. Link Density Check
      $linkCount = preg_match_all('/(https?:\/\/|www\.)/i', $content);
      if ($linkCount > 5) {
        $status = 'spam'; // Excessive links = spam
        $spamReasons[] = "spam_links:$linkCount";
      } elseif ($linkCount > 2) {
        $status = 'pending'; // Moderate links = review
        $spamReasons[] = "links:$linkCount";
      }

      // 4. All Caps Check (more than 50% caps = suspicious for guests)
      $upperCount = preg_match_all('/[A-Z]/', $content);
      $letterCount = preg_match_all('/[a-zA-Z]/', $content);
      if ($letterCount > 10 && $upperCount / $letterCount > 0.5) {
        $status = 'pending';
        $spamReasons[] = 'allcaps';
      }
    }
    // ============================================

    // Log spam detection
    if (!empty($spamReasons)) {
      error_log("Comment flagged ($status): " . implode(', ', $spamReasons));
    }
    // ============================================

    $stmt = $pdo->prepare("INSERT INTO comments (post_id, user_id, parent_id, user_name, user_avatar, content, likes, status, created_at) 
                               VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW())");
    $stmt->execute([$postId, $userId, $parentId, $username, $userAvatar, $content, $status]);

    $newId = $pdo->lastInsertId();
    $prefix = $parentId ? 'r-' : 'c-';

    echo json_encode([
      'success' => true,
      'message' => $status === 'approved' ? 'Comment added' : 'Comment submitted for review',
      'id' => $prefix . $newId,
      'status' => $status,
      'source' => 'database',
    ]);
    exit();
  }

  // Handle like/unlike
  if ($action === 'like') {
    $commentId = isset($input['commentId'])
      ? intval(preg_replace('/[^0-9]/', '', $input['commentId']))
      : 0;
    $delta = isset($input['delta']) ? intval($input['delta']) : 1;
    if (!in_array($delta, [1, -1], true)) {
      ResponseHelper::sendError('Invalid like delta', 400);
    }

    $stmt = $pdo->prepare('UPDATE comments SET likes = GREATEST(0, likes + ?) WHERE id = ?');
    $stmt->execute([$delta, $commentId]);

    echo json_encode(['success' => true, 'message' => 'Like updated', 'source' => 'database']);
    exit();
  }

  // Handle delete
  if ($action === 'delete') {
    $commentId = isset($input['commentId'])
      ? intval(preg_replace('/[^0-9]/', '', $input['commentId']))
      : 0;

    // SECURITY: Check ownership or staff status before delete
    $checkOwner = $pdo->prepare('SELECT user_id FROM comments WHERE id = ?');
    $checkOwner->execute([$commentId]);
    $existingComment = $checkOwner->fetch(PDO::FETCH_ASSOC);

    if (!$existingComment) {
      ResponseHelper::sendError('Comment not found', 404);
    }

    $currentUser = $_SESSION['user'] ?? null;
    $isOwner = $currentUser && (string) $existingComment['user_id'] === (string) $currentUser['id'];
    $isStaff = SessionManager::isStaff();

    if (!$isOwner && !$isStaff) {
      ResponseHelper::sendError('Not authorized to delete this comment', 403);
    }

    // Delete replies first
    $pdo->prepare('DELETE FROM comments WHERE parent_id = ?')->execute([$commentId]);
    // Delete comment
    $pdo->prepare('DELETE FROM comments WHERE id = ?')->execute([$commentId]);

    echo json_encode(['success' => true, 'message' => 'Comment deleted', 'source' => 'database']);
    exit();
  }

  // Handle status update
  if ($action === 'updateStatus') {
    // Only staff can moderate comments
    SessionManager::requireStaff();

    $commentId = isset($input['commentId'])
      ? intval(preg_replace('/[^0-9]/', '', $input['commentId']))
      : 0;
    $status = isset($input['status']) ? $input['status'] : 'approved';

    if (!in_array($status, ['approved', 'pending', 'spam'])) {
      ResponseHelper::sendError('Invalid status', 400);
    }

    $stmt = $pdo->prepare('UPDATE comments SET status = ? WHERE id = ?');
    $stmt->execute([$status, $commentId]);

    echo json_encode([
      'success' => true,
      'message' => "Comment status set to $status",
      'source' => 'database',
    ]);
    exit();
  }

  // Legacy: Bulk save all comments (for migration from JSON)
  if (isset($input['comments']) && is_array($input['comments'])) {
    $count = 0;
    foreach ($input['comments'] as $comment) {
      $postId = isset($comment['postId'])
        ? intval(preg_replace('/[^0-9]/', '', $comment['postId']))
        : 0;
      $userId = isset($comment['userId']) ? $comment['userId'] : null;
      $username = isset($comment['username'])
        ? htmlspecialchars($comment['username'], ENT_QUOTES, 'UTF-8')
        : 'Anonymous';
      $userAvatar = ResponseHelper::scrubAvatarUrl($comment['userAvatar'] ?? '');
      $content = isset($comment['content'])
        ? htmlspecialchars($comment['content'], ENT_QUOTES, 'UTF-8')
        : '';
      $likes = isset($comment['likes']) ? intval($comment['likes']) : 0;
      $createdAt = isset($comment['createdAt']) ? $comment['createdAt'] : date('Y-m-d H:i:s');

      $stmt = $pdo->prepare("INSERT INTO comments (post_id, user_id, user_name, user_avatar, content, likes, status, created_at) 
                                   VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)");
      $stmt->execute([$postId, $userId, $username, $userAvatar, $content, $likes, $createdAt]);
      $count++;

      // Handle replies
      if (isset($comment['replies']) && is_array($comment['replies'])) {
        $parentId = $pdo->lastInsertId();
        foreach ($comment['replies'] as $reply) {
          $rPostId = isset($reply['postId'])
            ? intval(preg_replace('/[^0-9]/', '', $reply['postId']))
            : $postId;
          $rUserId = isset($reply['userId']) ? $reply['userId'] : null;
          $rUsername = isset($reply['username'])
            ? htmlspecialchars($reply['username'], ENT_QUOTES, 'UTF-8')
            : 'Anonymous';
          $rUserAvatar = ResponseHelper::scrubAvatarUrl($reply['userAvatar'] ?? '');
          $rContent = isset($reply['content'])
            ? htmlspecialchars($reply['content'], ENT_QUOTES, 'UTF-8')
            : '';
          $rLikes = isset($reply['likes']) ? intval($reply['likes']) : 0;
          $rCreatedAt = isset($reply['createdAt']) ? $reply['createdAt'] : date('Y-m-d H:i:s');

          $stmt = $pdo->prepare("INSERT INTO comments (post_id, user_id, parent_id, user_name, user_avatar, content, likes, status, created_at) 
                                           VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)");
          $stmt->execute([
            $rPostId,
            $rUserId,
            $parentId,
            $rUsername,
            $rUserAvatar,
            $rContent,
            $rLikes,
            $rCreatedAt,
          ]);
          $count++;
        }
      }
    }

    echo json_encode([
      'success' => true,
      'message' => "Migrated $count comments to database",
      'source' => 'database',
    ]);
    exit();
  }

  // Handle other actions? No.
  ResponseHelper::sendError('Unknown action or invalid input', 400);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
