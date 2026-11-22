<?php

$activityScript = $_SERVER['SCRIPT_FILENAME'] ?? '';
if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($activityScript) && realpath($activityScript) === __FILE__)
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once dirname(__DIR__, 2) . '/core/DataBoundary.php';
require_once dirname(__DIR__) . '/settings_audit_helper.php';

/**
 * Bounded projection of existing history; only uncovered media/purge events own new rows.
 * @phpstan-type SqlRow array<array-key, bool|float|int|string|null>
 * @phpstan-type LogRow array{key:string, source:string, at:string, actorId:string, actorUsername:string, actorRole:string, action:string, targetType:string, targetId:string, targetLabel:string, outcome:string, details:array<string, bool|int|string|null>}
 */
final class VonCmsActivityLog
{
  public const PAGE_SIZE = 20;
  public const RETENTION_DAYS = 90;
  public const PURGE_BATCH = 500;

  public function __construct(private PDO $db) {}

  private function missingTable(PDOException $error): bool
  {
    return in_array((string) $error->getCode(), ['42S02', '42P01'], true) ||
      str_contains($error->getMessage(), 'no such table:');
  }

  public function assertReady(): void
  {
    $this->db->query(
      'SELECT id,action,actor_user_id,actor_username,actor_role,target_type,target_id,target_label,outcome,details_json,request_key,created_at FROM staff_activity_log WHERE 1=0',
    );
  }

  /** @return array<string, array{table:string, time:string, actor:string, role:string, type:string, action:string, fields:string}> */
  private function sources(): array
  {
    $settingsActor = voncms_settings_audit_has_actor_snapshot($this->db);
    $settingsActorFields = $settingsActor
      ? 'actor_username,actor_role'
      : "'' AS actor_username,'' AS actor_role";
    return [
      'content' => [
        'table' => 'content_audit_logs',
        'time' => 'created_at',
        'actor' => 'actor_user_id',
        'role' => 'actor_role',
        'type' => 'content_type',
        'action' => 'action',
        'fields' =>
          "actor_user_id,actor_username,actor_role,content_type AS target_type,content_id AS target_id,summary AS target_label,action,'success' AS outcome,SUBSTRING(context_json,1,8192) AS context_json",
      ],
      'settings' => [
        'table' => 'settings_audit_log',
        'time' => 'changed_at',
        'actor' => 'changed_by',
        'role' => $settingsActor ? 'actor_role' : "''",
        'type' => "'settings'",
        'action' =>
          "CASE change_type WHEN 'INSERT' THEN 'create' WHEN 'DELETE' THEN 'delete' ELSE 'update' END",
        // Never select old/new values, credentials, request headers or IP addresses.
        'fields' => "changed_by AS actor_user_id,{$settingsActorFields},'settings' AS target_type,setting_key AS target_id,setting_group AS target_label,CASE change_type WHEN 'INSERT' THEN 'create' WHEN 'DELETE' THEN 'delete' ELSE 'update' END AS action,'success' AS outcome,'{}' AS context_json",
      ],
      'calendar' => [
        'table' => 'calendar_event_audit',
        'time' => 'created_at',
        'actor' => 'actor_id',
        'role' => "''",
        'type' => "'calendar'",
        'action' => 'action',
        'fields' =>
          "actor_id AS actor_user_id,actor_name AS actor_username,'' AS actor_role,'calendar' AS target_type,event_id AS target_id,'Calendar event' AS target_label,action,'success' AS outcome,'{}' AS context_json",
      ],
      'activity' => [
        'table' => 'staff_activity_log',
        'time' => 'created_at',
        'actor' => 'actor_user_id',
        'role' => 'actor_role',
        'type' => 'target_type',
        'action' => 'action',
        'fields' =>
          'actor_user_id,actor_username,actor_role,target_type,target_id,target_label,action,outcome,SUBSTRING(details_json,1,8192) AS context_json',
      ],
    ];
  }

  private static function text(mixed $value, int $limit = 255): string
  {
    if (!is_string($value)) {
      throw new InvalidArgumentException('Invalid Activity filter type.');
    }
    if (str_contains($value, "\0")) {
      throw new InvalidArgumentException('Invalid Activity field.');
    }
    if (strlen($value) > $limit) {
      throw new InvalidArgumentException('Activity field is too long.');
    }
    return trim($value);
  }

  private static function day(string $value): string
  {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
      throw new InvalidArgumentException('Invalid Activity date.');
    }
    return $value;
  }

  private static function validTimestamp(string $value): bool
  {
    if (str_contains($value, "\0")) {
      return false;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value);
    return $date !== false && $date->format('Y-m-d H:i:s') === $value;
  }

  /** @param array<string,mixed> $input
   * @return array<string,string>
   */
  private static function filters(array $input): array
  {
    $filters = [];
    foreach (['actor', 'role', 'event', 'type', 'from', 'to'] as $name) {
      $filters[$name] = self::text($input[$name] ?? '');
    }
    if ($filters['actor'] !== '' && !preg_match('/^[1-9][0-9]{0,17}$/D', $filters['actor'])) {
      throw new InvalidArgumentException('Invalid Activity actor.');
    }
    if (
      !in_array(
        $filters['role'],
        ['', 'admin', 'root', 'moderator', 'writer', 'system', 'unrecorded'],
        true,
      )
    ) {
      throw new InvalidArgumentException('Invalid Activity role.');
    }
    if ($filters['event'] !== '' && !preg_match('/^[a-z][a-z0-9_]{0,31}$/D', $filters['event'])) {
      throw new InvalidArgumentException('Invalid Activity action.');
    }
    if (
      !in_array(
        $filters['type'],
        ['', 'post', 'page', 'settings', 'calendar', 'media', 'activity'],
        true,
      )
    ) {
      throw new InvalidArgumentException('Invalid Activity target.');
    }
    if ($filters['from'] !== '') {
      self::day($filters['from']);
    }
    if ($filters['to'] !== '') {
      self::day($filters['to']);
    }
    if ($filters['from'] !== '' && $filters['to'] !== '' && $filters['from'] > $filters['to']) {
      throw new InvalidArgumentException('Activity date range is reversed.');
    }
    return $filters;
  }

  /** @param array<string,mixed> $input
   * @return array{logs:list<LogRow>,hasMore:bool,nextCursor:?string,unavailableSources:list<string>,pageSize:int}
   */
  public function listing(array $input): array
  {
    $this->assertReady();
    $filters = self::filters($input);
    $filterHash = hash('sha256', (string) json_encode($filters));
    $cursorText = self::text($input['cursor'] ?? '', 4096);
    $cursor =
      $cursorText !== '' ? json_decode((string) base64_decode($cursorText, true), true) : null;
    if ($cursorText !== '' && (!is_array($cursor) || ($cursor['filters'] ?? '') !== $filterHash)) {
      throw new InvalidArgumentException('Invalid or stale Activity cursor.');
    }
    $after = is_array($cursor) ? $cursor['after'] ?? null : null;
    if (
      $cursor !== null &&
      (!is_array($after) ||
        count($after) !== 3 ||
        !is_string($after[0] ?? null) ||
        !self::validTimestamp($after[0]) ||
        !is_int($after[1] ?? null) ||
        $after[1] < 0 ||
        $after[1] > 3 ||
        !is_int($after[2] ?? null) ||
        $after[2] < 1)
    ) {
      throw new InvalidArgumentException('Invalid Activity position.');
    }
    $maxima = is_array($cursor) ? $cursor['max'] ?? null : null;
    if ($cursor !== null && !is_array($maxima)) {
      throw new InvalidArgumentException('Invalid Activity snapshot.');
    }
    $watermarks = [];
    $unavailable = [];
    $rows = [];
    $mysql = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $sources = $this->sources();
    foreach ($sources as $source => $spec) {
      try {
        $watermark = is_array($maxima) ? $maxima[$source] ?? null : null;
        if ($cursor !== null && (!is_int($watermark) || $watermark < 0)) {
          throw new InvalidArgumentException('Invalid Activity snapshot.');
        }
        if ($cursor === null) {
          $watermark = (int) DataBoundary::statement(
            $this->db->query('SELECT MAX(id) FROM ' . $spec['table']),
          )->fetchColumn();
        }
        $watermarks[$source] = $watermark;
        if ($watermark === 0) {
          continue;
        }
        $rank = array_search($source, array_keys($sources), true);
        if (!is_int($rank)) {
          throw new LogicException('Unknown Activity source.');
        }
        $where = ['id <= :max_id'];
        $params = [':max_id' => $watermark];
        // Content defaults and Settings TIMESTAMP use the DB session clock; Calendar/media use the CMS clock.
        $databaseClock = $mysql && in_array($source, ['content', 'settings'], true);
        if ($after !== null) {
          $at = $databaseClock ? 'FROM_UNIXTIME(:at)' : ':at';
          $equal = $databaseClock ? 'FROM_UNIXTIME(:at_equal)' : ':at_equal';
          $comparison =
            $rank === $after[1]
              ? "({$spec['time']} = {$equal} AND id < :after_id)"
              : ($rank < $after[1]
                ? "{$spec['time']} = {$equal}"
                : '1=0');
          $where[] = "({$spec['time']} < {$at} OR {$comparison})";
          $params[':at'] = $databaseClock ? strtotime($after[0]) : $after[0];
          if ($rank <= $after[1]) {
            $params[':at_equal'] = $params[':at'];
          }
          if ($rank === $after[1]) {
            $params[':after_id'] = $after[2];
          }
        }
        foreach (
          ['actor' => $spec['actor'], 'event' => $spec['action'], 'type' => $spec['type']]
          as $filter => $column
        ) {
          if ($filters[$filter] !== '') {
            $where[] = "{$column} = :{$filter}";
            $params[':' . $filter] = $filters[$filter];
          }
        }
        if ($filters['role'] !== '') {
          $where[] = "LOWER({$spec['role']}) = :role";
          $params[':role'] = $filters['role'] === 'unrecorded' ? '' : $filters['role'];
        }
        foreach (['from' => '>=', 'to' => '<='] as $filter => $operator) {
          if ($filters[$filter] !== '') {
            $bound = $databaseClock ? "FROM_UNIXTIME(:{$filter})" : ":{$filter}";
            $where[] = "{$spec['time']} {$operator} {$bound}";
            $value = $filters[$filter] . ($filter === 'from' ? ' 00:00:00' : ' 23:59:59');
            $params[':' . $filter] = $databaseClock ? strtotime($value) : $value;
          }
        }
        $epoch = $databaseClock ? ",UNIX_TIMESTAMP({$spec['time']}) AS occurred_epoch" : '';
        $sql =
          "SELECT id,{$spec['time']} AS occurred_at{$epoch},{$spec['fields']} FROM {$spec['table']} WHERE " .
          implode(' AND ', $where) .
          " ORDER BY {$spec['time']} DESC,id DESC LIMIT 21";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
          $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();
        foreach (DataBoundary::rows($stmt->fetchAll(PDO::FETCH_ASSOC)) as $row) {
          if ($databaseClock && $row['occurred_epoch'] !== null) {
            $row['occurred_at'] = date('Y-m-d H:i:s', (int) $row['occurred_epoch']);
          }
          $rows[] = ['row' => $row, 'source' => $source, 'rank' => $rank];
        }
      } catch (PDOException $error) {
        if ($source === 'activity' || !$this->missingTable($error)) {
          throw $error;
        }
        $unavailable[] = $source;
        $watermarks[$source] = 0;
      }
    }
    usort(
      $rows,
      static fn(array $a, array $b): int => strcmp(
        (string) $b['row']['occurred_at'],
        (string) $a['row']['occurred_at'],
      ) ?:
      $b['rank'] <=> $a['rank'] ?:
      (int) $b['row']['id'] <=> (int) $a['row']['id'],
    );
    $hasMore = count($rows) > self::PAGE_SIZE;
    $rows = array_slice($rows, 0, self::PAGE_SIZE);
    $next = null;
    if ($hasMore) {
      $last = $rows[count($rows) - 1];
      $next = base64_encode(
        (string) json_encode([
          'filters' => $filterHash,
          'max' => $watermarks,
          'after' => [
            (string) $last['row']['occurred_at'],
            $last['rank'],
            (int) $last['row']['id'],
          ],
        ]),
      );
    }
    return [
      'logs' => array_map(
        fn(array $item): array => $this->project($item['row'], $item['source']),
        $rows,
      ),
      'hasMore' => $hasMore,
      'nextCursor' => $next,
      'unavailableSources' => $unavailable,
      'pageSize' => self::PAGE_SIZE,
    ];
  }

  /**
   * @param SqlRow $row
   * @return LogRow
   */
  private function project(array $row, string $source): array
  {
    $context = json_decode((string) ($row['context_json'] ?? ''), true);
    $context = is_array($context) ? $context : [];
    $label = (string) ($row['target_label'] ?? '');
    if ($source === 'content' && is_string($context['title'] ?? null)) {
      $label = $context['title'];
    }
    if ($source === 'settings') {
      $label .= '.' . (string) ($row['target_id'] ?? '');
    }
    if ($source === 'calendar') {
      $label .= ' #' . (string) ($row['target_id'] ?? '');
    }
    $details = self::safeDetails($context);
    return [
      'key' => $source . ':' . (string) $row['id'],
      'source' => $source,
      'at' => (string) $row['occurred_at'],
      'actorId' => (string) ($row['actor_user_id'] ?? ''),
      'actorUsername' => (string) ($row['actor_username'] ?? ''),
      'actorRole' => strtolower((string) ($row['actor_role'] ?? '')),
      'action' => (string) $row['action'],
      'targetType' => (string) $row['target_type'],
      'targetId' => (string) $row['target_id'],
      'targetLabel' => mb_substr($label, 0, 255),
      'outcome' => (string) $row['outcome'],
      'details' => $details,
    ];
  }

  /**
   * @param array<array-key,mixed> $input
   * @return array<string,bool|int|string|null>
   */
  private static function safeDetails(array $input): array
  {
    $details = [];
    foreach (
      [
        'old_status',
        'new_status',
        'file_deleted',
        'database_deleted',
        'variants_deleted',
        'reason',
        'removed',
        'before',
        'origin',
      ]
      as $key
    ) {
      $value = $input[$key] ?? null;
      if (is_bool($value) || is_int($value) || is_string($value)) {
        $details[$key] = is_string($value) ? mb_substr($value, 0, 255) : $value;
      }
    }
    return $details;
  }

  /**
   * @param array<array-key,scalar|null> $actor
   * @param array<array-key,mixed> $details
   */
  public function recordMedia(array $actor, string $path, string $outcome, array $details): bool
  {
    if (!in_array($outcome, ['success', 'failed', 'partial'], true)) {
      throw new InvalidArgumentException('Invalid media outcome.');
    }
    try {
      $this->insert(
        $actor,
        'delete',
        'media',
        strlen($path) <= 255 ? $path : 'sha256:' . hash('sha256', $path),
        basename($path),
        $outcome,
        self::safeDetails($details),
      );
      return true;
    } catch (Throwable $error) {
      error_log(
        'VonCMS Activity: media event could not be recorded; check Activity storage/Database Repair.',
      );
      return false;
    }
  }

  /**
   * @param array<array-key,scalar|null> $actor
   * @param array<string,bool|int|string|null> $details
   */
  private function insert(
    array $actor,
    string $action,
    string $type,
    string $targetId,
    string $label,
    string $outcome,
    array $details,
    ?string $requestKey = null,
  ): void {
    $stmt = $this->db->prepare(
      'INSERT INTO staff_activity_log (action,actor_user_id,actor_username,actor_role,target_type,target_id,target_label,outcome,details_json,request_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    );
    $stmt->execute([
      $action,
      isset($actor['id']) ? (int) $actor['id'] : null,
      mb_substr((string) ($actor['username'] ?? ''), 0, 255),
      mb_substr(strtolower((string) ($actor['role'] ?? '')), 0, 64),
      $type,
      $targetId,
      mb_substr($label, 0, 255),
      $outcome,
      json_encode($details),
      $requestKey,
      date('Y-m-d H:i:s'),
    ]);
  }

  /** @return array{before:string,eligible:int,maxId:int} */
  public function preview(): array
  {
    $before = date('Y-m-d H:i:s', time() - self::RETENTION_DAYS * 86400);
    $stmt = $this->db->prepare(
      'SELECT COUNT(*) AS eligible,MAX(id) AS max_id FROM staff_activity_log WHERE created_at < ?',
    );
    $stmt->execute([$before]);
    $row = DataBoundary::row($stmt->fetch(PDO::FETCH_ASSOC));
    return [
      'before' => $before,
      'eligible' => (int) ($row['eligible'] ?? 0),
      'maxId' => (int) ($row['max_id'] ?? 0),
    ];
  }

  /**
   * @param array<array-key,scalar|null> $actor
   * @return array{removed:int,before:string}
   */
  public function purge(array $actor, string $before, int $maxId, string $requestKey): array
  {
    if (
      !self::validTimestamp($before) ||
      $before > date('Y-m-d H:i:s', time() - self::RETENTION_DAYS * 86400) ||
      $maxId < 0 ||
      !preg_match('/^[a-f0-9]{64}$/D', $requestKey)
    ) {
      throw new InvalidArgumentException('Invalid Activity purge.');
    }
    $existing = $this->receipt($requestKey);
    if ($existing !== null) {
      return $existing;
    }
    $this->db->beginTransaction();
    try {
      $lock = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
      $stmt = $this->db->prepare(
        'SELECT id FROM staff_activity_log WHERE created_at < ? AND id <= ? ORDER BY created_at,id LIMIT 500' .
          $lock,
      );
      $stmt->execute([$before, $maxId]);
      $ids = DataBoundary::column($stmt->fetchAll(PDO::FETCH_COLUMN));
      $removed = 0;
      if ($ids !== []) {
        $delete = $this->db->prepare(
          'DELETE FROM staff_activity_log WHERE id IN (' .
            implode(',', array_fill(0, count($ids), '?')) .
            ')',
        );
        $delete->execute($ids);
        $removed = $delete->rowCount();
      }
      $this->insert(
        $actor,
        'purge',
        'activity',
        '',
        'Activity retention purge',
        'success',
        [
          'removed' => $removed,
          'before' => $before,
          'origin' => ($actor['role'] ?? '') === 'system' ? 'system' : 'human',
        ],
        $requestKey,
      );
      $this->db->commit();
      return ['removed' => $removed, 'before' => $before];
    } catch (Throwable $error) {
      if ($this->db->inTransaction()) {
        $this->db->rollBack();
      }
      $existing = $this->receipt($requestKey);
      if ($existing !== null) {
        return $existing;
      }
      throw $error;
    }
  }

  /** @return array{removed:int,before:string}|null */
  private function receipt(string $requestKey): ?array
  {
    $stmt = $this->db->prepare(
      "SELECT details_json FROM staff_activity_log WHERE request_key = ? AND action = 'purge' LIMIT 1",
    );
    $stmt->execute([$requestKey]);
    $raw = $stmt->fetchColumn();
    if (!is_string($raw)) {
      return null;
    }
    $details = json_decode($raw, true);
    if (
      !is_array($details) ||
      !is_int($details['removed'] ?? null) ||
      !is_string($details['before'] ?? null)
    ) {
      throw new RuntimeException('Invalid Activity purge receipt.');
    }
    return ['removed' => $details['removed'], 'before' => $details['before']];
  }

  public function maintain(): void
  {
    try {
      $preview = $this->preview();
      if ($preview['eligible'] > 0) {
        $this->purge(
          ['username' => 'System', 'role' => 'system'],
          $preview['before'],
          $preview['maxId'],
          hash('sha256', random_bytes(32)),
        );
      }
    } catch (Throwable $error) {
      error_log(
        'VonCMS Activity: retention maintenance unavailable; original history was not purged.',
      );
    }
  }
}
