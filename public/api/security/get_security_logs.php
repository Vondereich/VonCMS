<?php
/**
 * Get Security Logs API
 * Fetch logs for Admin Dashboard
 */

// 1. Load Security Layer FIRST
require_once __DIR__ . '/../../security.php';

// 2. Send Headers immediately
sendApiHeaders('GET, OPTIONS');

// 3. Exit for Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
  exit();
}

// 4. Load Database Config LAST
if (file_exists(__DIR__ . '/../../von_config.php')) {
  require_once __DIR__ . '/../../von_config.php';
}

SessionManager::requireAdmin();

// Session already started in security.php (by SessionManager::requireValidSession() or security.php)

// Admin only access

function sanitizeSecurityCsvCell($value)
{
  $text = $value === null ? '' : (string) $value;
  if (preg_match('/^[\t\r\n]/', $text) || preg_match('/^[\x00-\x20]*[=+\-@]/', $text)) {
    return "'" . $text;
  }

  return $text;
}

try {
  // Pagination
  $page = max(1, isset($_GET['page']) ? (int) $_GET['page'] : 1);
  $limit = min(100, max(1, isset($_GET['limit']) ? (int) $_GET['limit'] : 20));
  $offset = ($page - 1) * $limit;

  // Filters
  $where = [];
  $params = [];

  if (isset($_GET['event_type']) && !empty($_GET['event_type'])) {
    $where[] = 'event_type = ?';
    $params[] = $_GET['event_type'];
  }

  if (isset($_GET['severity']) && !empty($_GET['severity'])) {
    $where[] = 'severity = ?';
    $params[] = $_GET['severity'];
  }

  // Date range (YYYY-MM-DD)
  // Date range (YYYY-MM-DD)
  if (isset($_GET['start_date']) && !empty($_GET['start_date'])) {
    $where[] = 'DATE(created_at) >= ?';
    $params[] = $_GET['start_date'];
  }

  if (isset($_GET['end_date']) && !empty($_GET['end_date'])) {
    $where[] = 'DATE(created_at) <= ?';
    $params[] = $_GET['end_date'];
  }

  if (isset($_GET['search']) && !empty($_GET['search'])) {
    $where[] = '(ip_address LIKE ? OR endpoint LIKE ?)';
    $searchTerm = '%' . $_GET['search'] . '%';
    $params[] = $searchTerm;
    $params[] = $searchTerm;
  }

  $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

  // CSV Export Handling
  if (isset($_GET['format']) && $_GET['format'] === 'csv') {
    $filename = 'security_logs_' . date('Y-m-d_H-i-s') . '.csv';
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // CSV Headers
    fputcsv($output, [
      'ID',
      'Event Type',
      'IP Address',
      'User Agent',
      'Endpoint',
      'Severity',
      'Details',
      'Blocked',
      'Time',
    ]);

    // Fetch ALL matching records (no limit for export, but maybe cap at 5000 for safety)
    $sql = "SELECT * FROM security_logs $whereClause ORDER BY created_at DESC LIMIT 5000";
    $stmt = $pdo->prepare($sql);

    // Bind params again
    $paramIndex = 1;
    foreach ($params as $param) {
      $stmt->bindValue($paramIndex++, $param);
    }

    $stmt->execute();

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
      fputcsv(
        $output,
        array_map('sanitizeSecurityCsvCell', [
          $row['id'],
          $row['event_type'],
          $row['ip_address'],
          $row['user_agent'],
          $row['endpoint'],
          $row['severity'],
          $row['details'],
          $row['blocked'] ? 'Yes' : 'No',
          $row['created_at'],
        ]),
      );
    }

    fclose($output);
    exit();
  }

  // Get Logs (Normal JSON)
  $sql = "SELECT * FROM security_logs $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
  $stmt = $pdo->prepare($sql);

  // Bind params
  $paramIndex = 1;
  foreach ($params as $param) {
    $stmt->bindValue($paramIndex++, $param);
  }
  $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
  $stmt->bindValue($paramIndex++, $offset, PDO::PARAM_INT);

  $stmt->execute();
  $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Get Total Count
  $countSql = "SELECT COUNT(*) as total FROM security_logs $whereClause";
  $countStmt = $pdo->prepare($countSql);
  $countStmt->execute($params);
  $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

  // Get Aggregates (if requesting page 1)
  $stats = [];
  if (!isset($_GET['page']) || $_GET['page'] == 1) {
    // Today's blocked threats
    $todaySql =
      'SELECT COUNT(*) as count FROM security_logs WHERE DATE(created_at) = CURDATE() AND blocked = 1';
    $stmt = $pdo->query($todaySql);
    $stats['blocked_today'] = $stmt->fetch()['count'];

    // Active threats (last hour)
    $hourSql =
      'SELECT COUNT(*) as count FROM security_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
    $stmt = $pdo->query($hourSql);
    $stats['active_last_hour'] = $stmt->fetch()['count'];

    // High severity today
    $highSql =
      "SELECT COUNT(*) as count FROM security_logs WHERE (severity = 'high' OR severity = 'critical') AND DATE(created_at) = CURDATE()";
    $stmt = $pdo->query($highSql);
    $stats['high_severity_today'] = $stmt->fetch()['count'];

    // Top attacker today
    $topSql =
      'SELECT ip_address, COUNT(*) as count FROM security_logs WHERE DATE(created_at) = CURDATE() GROUP BY ip_address ORDER BY count DESC LIMIT 1';
    $stmt = $pdo->query($topSql);
    $topAttacker = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['top_attacker'] = $topAttacker ? $topAttacker['ip_address'] : 'None';

    // Daily Trends (Last 7 days) - For Line Chart
    $trendSql = "
            SELECT 
                DATE(created_at) as date,
                event_type,
                COUNT(*) as count
            FROM security_logs 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(created_at), event_type
            ORDER BY date ASC
        ";
    $stmt = $pdo->query($trendSql);
    $stats['trends'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Event Distribution - For Pie Chart
    $distSql = 'SELECT event_type, COUNT(*) as count FROM security_logs GROUP BY event_type';
    $stmt = $pdo->query($distSql);
    $stats['distribution'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Top IPs - For Bar Chart
    $topIpsSql =
      'SELECT ip_address, COUNT(*) as count FROM security_logs GROUP BY ip_address ORDER BY count DESC LIMIT 10';
    $stmt = $pdo->query($topIpsSql);
    $stats['top_ips'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
  }

  echo json_encode([
    'success' => true,
    'logs' => $logs,
    'pagination' => [
      'current_page' => $page,
      'total_pages' => ceil($total / $limit),
      'total_items' => $total,
      'limit' => $limit,
    ],
    'stats' => $stats,
  ]);
} catch (Exception $e) {
  ResponseHelper::sendError($e);
}
