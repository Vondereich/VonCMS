<?php

if (
  !defined('VONCMS_CORE_LOADED') ||
  (is_string($_SERVER['SCRIPT_FILENAME'] ?? null) &&
    realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
  http_response_code(403);
  exit('Forbidden');
}
require_once __DIR__ . '/DataBoundary.php';

final class CalendarProblem extends RuntimeException {}

/** Internal editorial records only. No scheduler, content writes or runtime DDL. */
final class EditorialCalendar
{
  /** @param array{id: int|string, username?: string, role?: string} $actor Authenticated by the endpoint. */
  public function __construct(private PDO $db, private array $actor) {}

  private static function text(mixed $value, int $maximum, string $label): string
  {
    if (
      !is_string($value) ||
      mb_strlen($value, 'UTF-8') > $maximum ||
      !mb_check_encoding($value, 'UTF-8') ||
      str_contains($value, "\0")
    ) {
      throw new CalendarProblem("Invalid {$label} (maximum {$maximum} characters).", 400);
    }
    return trim($value);
  }

  public static function date(mixed $value, bool $dateOnly = true): DateTimeImmutable
  {
    $format = $dateOnly ? 'Y-m-d' : 'Y-m-d\TH:i';
    $pattern = $dateOnly
      ? '/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D'
      : '/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/D';
    if (!is_string($value) || !preg_match($pattern, $value)) {
      throw new CalendarProblem('Invalid calendar date.', 400);
    }
    $date = DateTimeImmutable::createFromFormat('!' . $format, $value);
    if (
      !$date ||
      $date->format($format) !== $value ||
      $date->format('Y') < '1000' ||
      $date->format('Y') > '9998'
    ) {
      throw new CalendarProblem('Invalid calendar date.', 400);
    }
    return $date;
  }

  public static function positiveId(mixed $value): int
  {
    if (
      (!is_string($value) && !is_int($value)) ||
      !preg_match('/^[1-9][0-9]{0,9}$/D', (string) $value) ||
      (int) $value > 2147483647
    ) {
      throw new CalendarProblem('Invalid record ID or version.', 400);
    }
    return (int) $value;
  }

  /**
   * @param array<array-key, mixed> $input Raw fields are checked before use.
   * @return array{string, string, string, string, int}
   */
  public static function eventInput(array $input): array
  {
    $title = self::text($input['title'] ?? null, 200, 'event title');
    $notes = self::text($input['notes'] ?? '', 10000, 'event notes');
    if ($title === '' || !is_bool($input['allDay'] ?? null)) {
      throw new CalendarProblem('Title and all-day selection are required.', 400);
    }
    $allDay = $input['allDay'];
    $start = self::date($input['start'] ?? null, $allDay);
    $end = self::date($input['end'] ?? null, $allDay);
    if ($allDay) {
      $end = $end->modify('+1 day');
    } // UI end date is inclusive; storage end is exclusive.
    if ($end <= $start || $end > $start->modify('+366 days')) {
      throw new CalendarProblem('Event end must follow its start and be within 366 days.', 400);
    }
    return [
      $title,
      $notes,
      $start->format('Y-m-d H:i:s'),
      $end->format('Y-m-d H:i:s'),
      (int) $allDay,
    ];
  }

  public function assertStorage(): void
  {
    $this->db->query(
      'SELECT id,title,notes,starts_at,ends_at,all_day,created_by,version,request_key FROM calendar_events WHERE 1=0',
    );
    $this->db->query(
      'SELECT id,event_id,action,actor_id,actor_name,event_version,request_key,created_at FROM calendar_event_audit WHERE 1=0',
    );
  }

  private function audit(int $id, string $action, int $version, ?string $requestKey = null): void
  {
    $statement = $this->db->prepare(
      'INSERT INTO calendar_event_audit (event_id,action,actor_id,actor_name,event_version,request_key,created_at) VALUES (?,?,?,?,?,?,?)',
    );
    $statement->execute([
      $id,
      $action,
      (int) $this->actor['id'],
      mb_substr((string) ($this->actor['username'] ?? ''), 0, 100),
      $version,
      $requestKey,
      date('Y-m-d H:i:s'),
    ]);
    // Bounded maintenance; delete audit history only, never event/content records.
    $old = $this->db->prepare(
      'SELECT id FROM calendar_event_audit WHERE created_at < ? ORDER BY created_at,id LIMIT 500',
    );
    $old->execute([date('Y-m-d H:i:s', time() - 90 * 86400)]);
    $ids = DataBoundary::column($old->fetchAll(PDO::FETCH_COLUMN));
    if ($ids) {
      $this->db
        ->prepare(
          'DELETE FROM calendar_event_audit WHERE id IN (' .
            implode(',', array_fill(0, count($ids), '?')) .
            ')',
        )
        ->execute($ids);
    }
  }

  /** @param array<array-key, mixed> $input */
  public function save(array $input): string
  {
    [$title, $notes, $start, $end, $allDay] = self::eventInput($input);
    $id = isset($input['id']) ? self::positiveId($input['id']) : null;
    $version = $id !== null ? self::positiveId($input['version'] ?? null) : 1;
    $requestKey = $input['requestKey'] ?? '';
    if (
      $id === null &&
      (!is_string($requestKey) ||
        !preg_match(
          '/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',
          $requestKey,
        ))
    ) {
      throw new CalendarProblem('A valid event request key is required.', 400);
    }
    $this->db->beginTransaction();
    try {
      if ($id === null) {
        $existing = $this->db->prepare('SELECT * FROM calendar_events WHERE request_key = ?');
        $existing->execute([$requestKey]);
        $previous = DataBoundary::row($existing->fetch(PDO::FETCH_ASSOC));
        if ($previous) {
          if (
            (string) $previous['created_by'] !== (string) $this->actor['id'] ||
            [
              $previous['title'],
              $previous['notes'],
              $previous['starts_at'],
              $previous['ends_at'],
              (int) $previous['all_day'],
            ] !== [$title, $notes, $start, $end, $allDay]
          ) {
            throw new CalendarProblem(
              'This event request has already been used. Reload before creating another event.',
              409,
            );
          }
          $this->db->commit();
          return (string) $previous['id'];
        }
        $used = $this->db->prepare('SELECT event_id FROM calendar_event_audit WHERE request_key=?');
        $used->execute([$requestKey]);
        if ($used->fetchColumn() !== false) {
          throw new CalendarProblem(
            'This event was already created and removed. Start a new event instead of retrying the old request.',
            409,
          );
        }
        $statement = $this->db->prepare(
          'INSERT INTO calendar_events (title,notes,starts_at,ends_at,all_day,created_by,request_key,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
        );
        // Exact retries above still succeed after the event's date has passed.
        if (substr($start, 0, 10) < date('Y-m-d')) {
          throw new CalendarProblem('New events must start today or on a future date.', 400);
        }
        $now = date('Y-m-d H:i:s');
        $statement->execute([
          $title,
          $notes,
          $start,
          $end,
          $allDay,
          (int) $this->actor['id'],
          $requestKey,
          $now,
          $now,
        ]);
        $id = (int) $this->db->lastInsertId();
        $this->audit($id, 'create', 1, $requestKey);
      } else {
        if (substr($start, 0, 10) < date('Y-m-d')) {
          $previousStart = $this->db->prepare(
            'SELECT starts_at FROM calendar_events WHERE id=? AND version=?',
          );
          $previousStart->execute([$id, $version]);
          $storedStart = $previousStart->fetchColumn();
          if ($storedStart === false) {
            throw new CalendarProblem(
              'This event changed or was deleted. Reload the calendar before editing again.',
              409,
            );
          }
          // Existing historical notes remain editable, but an event cannot be backdated.
          if ($storedStart !== $start) {
            throw new CalendarProblem('Events cannot be moved to a past start date.', 400);
          }
        }
        $statement = $this->db->prepare(
          'UPDATE calendar_events SET title=?,notes=?,starts_at=?,ends_at=?,all_day=?,version=version+1,updated_at=? WHERE id=? AND version=?',
        );
        $statement->execute([
          $title,
          $notes,
          $start,
          $end,
          $allDay,
          date('Y-m-d H:i:s'),
          $id,
          $version,
        ]);
        if ($statement->rowCount() !== 1) {
          throw new CalendarProblem(
            'This event changed or was deleted. Reload the calendar before editing again.',
            409,
          );
        }
        $this->audit($id, 'update', $version + 1);
      }
      $this->db->commit();
      return (string) $id;
    } catch (Throwable $error) {
      if ($this->db->inTransaction()) {
        $this->db->rollBack();
      }
      if (
        $id === null &&
        $error instanceof PDOException &&
        in_array((string) $error->getCode(), ['23000', '23505'], true)
      ) {
        throw new CalendarProblem(
          'A matching event request completed concurrently. Retry Save without changing this form.',
          409,
        );
      }
      throw $error;
    }
  }

  /** @param array<array-key, mixed> $input */
  public function delete(array $input): void
  {
    $id = self::positiveId($input['id'] ?? null);
    $version = self::positiveId($input['version'] ?? null);
    $this->db->beginTransaction();
    try {
      $statement = $this->db->prepare('DELETE FROM calendar_events WHERE id=? AND version=?');
      $statement->execute([$id, $version]);
      if ($statement->rowCount() !== 1) {
        throw new CalendarProblem(
          'This event changed or was deleted. Reload before deleting again.',
          409,
        );
      }
      $this->audit($id, 'delete', $version);
      $this->db->commit();
    } catch (Throwable $error) {
      if ($this->db->inTransaction()) {
        $this->db->rollBack();
      }
      throw $error;
    }
  }

  /**
   * @param array<array-key, mixed> $input
   * @return array{items: list<array<array-key, scalar|null>>, authors: list<array<array-key, scalar|null>>, meta: array{page: int, hasMore: bool, authorsTruncated: bool}, timeZone: string, today: string, now: string}
   */
  public function read(array $input): array
  {
    $from = self::date($input['from'] ?? null);
    $to = self::date($input['to'] ?? null);
    if ($to <= $from || (int) $from->diff($to)->format('%a') > 62) {
      throw new CalendarProblem('Choose a date range of 1 to 62 days.', 400);
    }
    $type = $input['type'] ?? 'all';
    if (!is_string($type) || !in_array($type, ['all', 'event', 'post', 'page'], true)) {
      throw new CalendarProblem('Invalid calendar type filter.', 400);
    }
    $author = ($input['author'] ?? '') === '' ? null : self::positiveId($input['author']);
    $page = isset($input['page']) ? self::positiveId($input['page']) : 1;
    if ($page > 100) {
      throw new CalendarProblem(
        'Calendar page is too large. Narrow the date range or filters.',
        400,
      );
    }
    $sources = [];
    foreach (['post' => 'posts', 'page' => 'pages'] as $kind => $table) {
      $readCapability = $kind === 'post' ? 'posts.read_any_protected' : 'pages.read_protected';
      if (!voncms_role_has_capability($this->actor['role'] ?? '', $readCapability)) {
        continue;
      }
      $published = voncms_publication_expression_sql($this->db, $table, 'p');
      $when =
        $kind === 'post'
          ? "CASE WHEN p.status='scheduled' THEN p.scheduled_at ELSE {$published} END"
          : $published;
      $status =
        $kind === 'post'
          ? "CASE WHEN p.status='scheduled' THEN 'scheduled' ELSE 'published' END"
          : "'published'";
      $where =
        $kind === 'post'
          ? "(p.status='published' OR p.status IS NULL OR p.status='scheduled')"
          : "p.status='published'";
      $canEdit = voncms_role_has_capability($this->actor['role'] ?? '', $kind . 's.edit_any')
        ? 1
        : 0;
      $sources[] = "SELECT p.id,'{$kind}' AS kind,p.title,{$when} AS starts_at,{$when} AS ends_at,0 AS all_day,'' AS notes,0 AS version,p.author_id,COALESCE(NULLIF(u.username,''),NULLIF(p.author,''),'Unknown author') AS author_name,{$status} AS status,{$canEdit} AS can_edit FROM {$table} p LEFT JOIN users u ON p.author_id=u.id WHERE {$where}";
    }
    $sources[] =
      "SELECT e.id,'event' AS kind,e.title,e.starts_at,e.ends_at,e.all_day,e.notes,e.version,e.created_by AS author_id,COALESCE(u.username,'Former staff') AS author_name,'event' AS status,1 AS can_edit FROM calendar_events e LEFT JOIN users u ON e.created_by=u.id";
    $base = '(' . implode(' UNION ALL ', $sources) . ') calendar_items';
    $where =
      "((kind='event' AND starts_at < ? AND ends_at > ?) OR (kind<>'event' AND starts_at >= ? AND starts_at < ?))";
    $parameters = [
      $to->format('Y-m-d H:i:s'),
      $from->format('Y-m-d H:i:s'),
      $from->format('Y-m-d H:i:s'),
      $to->format('Y-m-d H:i:s'),
    ];
    $authors = $this->db->prepare(
      "SELECT DISTINCT author_id,author_name FROM {$base} WHERE {$where} AND kind<>'event' AND author_id IS NOT NULL ORDER BY author_name,author_id LIMIT 201",
    );
    $authors->execute($parameters);
    $authorRows = DataBoundary::rows($authors->fetchAll(PDO::FETCH_ASSOC));
    if ($type !== 'all') {
      $where .= ' AND kind=?';
      $parameters[] = $type;
    }
    if ($author !== null) {
      $where .= " AND (kind='event' OR author_id=?)";
      $parameters[] = $author;
    }
    $statement = $this->db->prepare(
      "SELECT * FROM {$base} WHERE {$where} ORDER BY starts_at,kind,id LIMIT 201 OFFSET " .
        ($page - 1) * 200,
    );
    $statement->execute($parameters);
    $rows = DataBoundary::rows($statement->fetchAll(PDO::FETCH_ASSOC));
    return [
      'items' => array_slice($rows, 0, 200),
      'authors' => array_slice($authorRows, 0, 200),
      'meta' => [
        'page' => $page,
        'hasMore' => count($rows) > 200,
        'authorsTruncated' => count($authorRows) > 200,
      ],
      'timeZone' => date_default_timezone_get(),
      'today' => date('Y-m-d'),
      'now' => date('Y-m-d H:i:s'),
    ];
  }
}
