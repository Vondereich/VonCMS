import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  X,
  ArrowLeft,
  Pencil,
  Trash2,
  Clock3,
  RefreshCw,
} from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { formatDate, formatDateTime } from '../../../../utils/dateFormat';
import { decodeEntities } from '../../../../utils/textUtils';
import { SiteSettings } from '../../../../types';
import AdminModal from '../../../../components/admin/AdminModal';
import {
  CalendarData,
  CalendarItem,
  calendarKey,
  calendarRequestKey,
  calendarItemOnDay,
  calendarRange,
  calendarToday,
  shiftDay,
  shiftMonth,
} from './calendarUtils';

type EventDraft = {
  id?: string;
  version?: number;
  requestKey: string;
  title: string;
  notes: string;
  allDay: boolean;
  start: string;
  end: string;
};
const controlBase =
  'min-h-10 rounded-lg border px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';
const control = `${controlBase} border-zinc-300 bg-zinc-50 text-slate-700 dark:border-admin-border dark:bg-admin-canvas dark:text-slate-200`;
const primary = `${controlBase} border-blue-600 bg-blue-600 font-semibold text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white`;
const selectedControl = `${controlBase} border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300`;
const danger = `${controlBase} border-red-600 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white`;
const panel =
  'rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-admin-border dark:bg-admin-panel';
const stamp = (item: CalendarItem, now?: string) =>
  `${item.kind === 'event' ? 'Event' : item.kind === 'post' ? 'Post' : 'Page'}${item.kind === 'event' && now && item.ends_at <= now ? ' / Past' : item.status === 'scheduled' ? ' / Scheduled' : item.kind !== 'event' ? ' / Published' : ''}`;

const itemTitle = (item: CalendarItem) =>
  item.kind === 'event' ? item.title : decodeEntities(item.title);

export default function CalendarManager({ settings }: { settings: SiteSettings }) {
  const location = useLocation();
  const [search] = useSearchParams();
  const createEntry = useRef('');
  const [month, setMonth] = useState(() => calendarToday(settings.timeZone).slice(0, 7));
  const [day, setDay] = useState(() => calendarToday(settings.timeZone));
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [type, setType] = useState('all');
  const [author, setAuthor] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const routeEntry = useMemo(() => ({ active: false, key: location.key }), [location.key]);
  const mutating = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const initialDateApplied = useRef(false);
  const dateNavigated = useRef(false);
  const sequence = useRef(0);
  const range = useMemo(() => calendarRange(month), [month]);
  const dirty = busy || (draft !== null && JSON.stringify(draft) !== baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useLayoutEffect(() => {
    routeEntry.active = true;
    mutating.current = false;
    setBusy(false);
    setConfirmDelete(false);
    setError('');
    setMessage('');
    return () => {
      routeEntry.active = false;
    };
  }, [routeEntry]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const beforeLink = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return;
      const destination = new URL(link.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        link.dataset['adminCreate'] !== 'true'
      )
        return;
      if (!window.confirm('Leave this event with unsaved changes?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLink, true);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++sequence.current;
    setLoading(true);
    setReadError('');
    if (page === 1) setData(null);
    const query = new URLSearchParams({
      from: range.from,
      to: range.to,
      type,
      author,
      page: String(page),
    });
    void (async () => {
      try {
        const response = await vonFetch(`${API.calendar}?${query}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.error || result.message || 'Calendar could not be loaded.');
        if (!Array.isArray(result.items) || !Array.isArray(result.authors) || !result.meta)
          throw new Error('Invalid calendar response. Please retry.');
        if (request !== sequence.current || controller.signal.aborted) return;
        setData((previous) => ({
          ...result,
          items:
            page === 1
              ? result.items
              : [
                  ...new Map(
                    [...(previous?.items || []), ...result.items].map((item: CalendarItem) => [
                      calendarKey(item),
                      item,
                    ])
                  ).values(),
                ],
        }));
      } catch (failure) {
        if (request === sequence.current && !controller.signal.aborted)
          setReadError(
            failure instanceof Error ? failure.message : 'Calendar could not be loaded.'
          );
      } finally {
        if (request === sequence.current && !controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      sequence.current = request + 1;
    };
  }, [range.from, range.to, type, author, page, refresh]);

  const items = data?.items || [];
  const active = items.find((item) => calendarKey(item) === activeKey);
  const zone = data?.timeZone || settings.timeZone;
  const today = data?.today || calendarToday(zone);
  useEffect(() => {
    if (!data?.today || initialDateApplied.current) return;
    initialDateApplied.current = true;
    if (!dateNavigated.current) {
      setDay(data.today);
      setMonth(data.today.slice(0, 7));
    }
  }, [data?.today]);
  const hasDraft = draft !== null;
  useEffect(() => {
    if (!hasDraft || !panelOpen) return;
    const frame = requestAnimationFrame(() => {
      titleInput.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      titleInput.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hasDraft, draft?.id, draft?.requestKey, panelOpen, wide]);
  const dayItems = items.filter((item) => calendarItemOnDay(item, day));
  const canLeave = () =>
    !mutating.current && (!dirty || window.confirm('Discard unsaved event changes?'));
  const clearPanel = () => {
    setDraft(null);
    setActiveKey(null);
    setError('');
    setConfirmDelete(false);
  };
  const chooseDay = (next: string) => {
    if (!canLeave()) return;
    dateNavigated.current = true;
    clearPanel();
    setDay(next);
    setPanelOpen(true);
  };
  const changeMonth = (next: string) => {
    if (!canLeave()) return;
    dateNavigated.current = true;
    clearPanel();
    setMonth(next);
    setDay(`${next}-01`);
    setPage(1);
    setPanelOpen(false);
  };
  const chooseItem = (item: CalendarItem) => {
    if (!canLeave()) return;
    clearPanel();
    setActiveKey(calendarKey(item));
    setPanelOpen(true);
  };
  const startEvent = (item?: CalendarItem, navigationAccepted = false, selectedDay = day) => {
    if (!navigationAccepted && !canLeave()) return;
    const startDay = selectedDay < today ? today : selectedDay;
    const allDay = item ? Number(item.all_day) === 1 : false;
    const next: EventDraft = item
      ? {
          id: String(item.id),
          version: Number(item.version),
          requestKey: '',
          title: item.title,
          notes: item.notes,
          allDay,
          start: item.starts_at.slice(0, allDay ? 10 : 16).replace(' ', 'T'),
          end: allDay
            ? shiftDay(item.ends_at.slice(0, 10), -1)
            : item.ends_at.slice(0, 16).replace(' ', 'T'),
        }
      : {
          requestKey: calendarRequestKey(),
          title: '',
          notes: '',
          allDay: false,
          start: `${startDay}T09:00`,
          end: `${startDay}T10:00`,
        };
    if (!item) {
      setActiveKey(null);
      if (selectedDay < today) {
        dateNavigated.current = true;
        setDay(today);
        setMonth(today.slice(0, 7));
        setPage(1);
      }
    }
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setError('');
    setPanelOpen(true);
  };
  const startRouteEvent = useEffectEvent(() => {
    // Read the selected day at route-entry time, not after every draft keystroke.
    startEvent(undefined, true, dateNavigated.current ? day : today);
  });
  useEffect(() => {
    if (
      search.get('new') !== 'event' ||
      createEntry.current === location.key ||
      loading ||
      !data ||
      readError
    )
      return;
    createEntry.current = location.key;
    // The initial reconciliation effect may not have rendered its setDay yet.
    startRouteEvent();
  }, [location.key, search, loading, data, readError]);
  const write = async (remove = false) => {
    if (mutating.current || (remove ? active?.kind !== 'event' : !draft)) return;
    mutating.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = remove ? { id: active!.id, version: Number(active!.version) } : draft;
      const response = await vonFetch(API.calendar, {
        method: remove ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || result.message || 'The event was not saved.');
      if (!routeEntry.active) return;
      clearPanel();
      setPage(1);
      setRefresh((value) => value + 1);
      setMessage(remove ? 'Event deleted.' : 'Event saved.');
    } catch (failure) {
      if (routeEntry.active) {
        setError(failure instanceof Error ? failure.message : 'The event was not saved.');
        if (remove) setConfirmDelete(false);
      }
    } finally {
      if (routeEntry.active) {
        mutating.current = false;
        setBusy(false);
      }
    }
  };

  const itemButton = (item: CalendarItem) => (
    <button
      key={calendarKey(item)}
      type="button"
      onClick={() => chooseItem(item)}
      className="w-full rounded-xl border border-zinc-300 p-3 text-start hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-admin-border"
      aria-label={`Details: ${itemTitle(item)}`}
    >
      <span
        className={`text-xs font-semibold ${item.status === 'scheduled' ? 'text-amber-700 dark:text-amber-300' : item.kind === 'event' ? 'text-violet-700 dark:text-violet-300' : 'text-blue-700 dark:text-blue-300'}`}
      >
        {stamp(item, data?.now)}
      </span>
      <span className="mt-1 block wrap-break-word text-sm font-semibold">{itemTitle(item)}</span>
      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
        {item.author_name} /{' '}
        {Number(item.all_day)
          ? 'All day'
          : formatDateTime(item.starts_at, zone, settings.dateFormat)}
      </span>
    </button>
  );

  const contextPanel = (
    <div className="space-y-4 p-5 text-slate-800 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">
          {draft
            ? draft.id
              ? 'Edit event'
              : 'New event'
            : active
              ? 'Item details'
              : formatDate(`${day} 00:00:00`, zone, settings.dateFormat)}
        </h2>
        {!wide && (
          <button
            type="button"
            aria-label="Close calendar panel"
            className={control}
            disabled={busy}
            onClick={() => {
              if (canLeave()) setPanelOpen(false);
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm wrap-break-word text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void write();
          }}
          className="space-y-4"
        >
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-medium">
              Title
              <input
                id="calendar-event-title"
                ref={titleInput}
                required
                maxLength={200}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className={`${control} mt-1 w-full`}
              />
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                id="calendar-event-all-day"
                checked={draft.allDay}
                onChange={(event) => {
                  const allDay = event.target.checked;
                  setDraft({
                    ...draft,
                    allDay,
                    start: allDay ? draft.start.slice(0, 10) : `${draft.start}T09:00`,
                    end: allDay ? draft.end.slice(0, 10) : `${draft.end}T10:00`,
                  });
                }}
              />
              All day
            </label>
            <label className="block text-sm font-medium">
              Start
              <input
                aria-label="Event start"
                id="calendar-event-start"
                required
                type={draft.allDay ? 'date' : 'datetime-local'}
                min={!draft.id ? (draft.allDay ? today : `${today}T00:00`) : undefined}
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                className={`${control} mt-1 w-full min-w-0`}
              />
            </label>
            <label className="block text-sm font-medium">
              {draft.allDay ? 'Last day (included)' : 'End'}
              <input
                aria-label="Event end"
                id="calendar-event-end"
                required
                type={draft.allDay ? 'date' : 'datetime-local'}
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                className={`${control} mt-1 w-full min-w-0`}
              />
            </label>
            <label className="block text-sm font-medium">
              Agenda / notes
              <textarea
                id="calendar-event-notes"
                rows={5}
                maxLength={10000}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                className={`${control} mt-1 w-full resize-y`}
              />
            </label>
          </fieldset>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {zone}. Internal event only; it does not schedule or publish an article.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={busy} type="submit">
              {busy ? 'Saving...' : 'Save event'}
            </button>
            <button
              type="button"
              className={control}
              disabled={busy}
              onClick={() => {
                if (canLeave()) {
                  setDraft(null);
                  setError('');
                }
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : active ? (
        <div className="space-y-4">
          <button
            type="button"
            className={`${control} inline-flex items-center gap-2`}
            onClick={() => setActiveKey(null)}
          >
            <ArrowLeft size={15} />
            Day entries
          </button>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-300">
            {stamp(active, data?.now)}
          </p>
          <h3 className="text-lg font-semibold wrap-break-word">{itemTitle(active)}</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">
                {active.kind === 'event' ? 'Created by' : 'Author'}
              </dt>
              <dd>{active.author_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">
                {active.status === 'scheduled'
                  ? 'Scheduled for'
                  : active.kind === 'event'
                    ? 'Starts'
                    : 'Published at'}
              </dt>
              <dd>
                {formatDateTime(active.starts_at, zone, settings.dateFormat)}{' '}
                {Number(active.all_day) === 1 ? '(all day)' : ''}
              </dd>
            </div>
            {active.kind === 'event' && (
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  {Number(active.all_day) === 1 ? 'Last day (included)' : 'Ends'}
                </dt>
                <dd>
                  {Number(active.all_day) === 1
                    ? formatDate(
                        `${shiftDay(active.ends_at.slice(0, 10), -1)} 00:00:00`,
                        zone,
                        settings.dateFormat
                      )
                    : formatDateTime(active.ends_at, zone, settings.dateFormat)}
                </dd>
              </div>
            )}
          </dl>
          {active.notes && (
            <p className="max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word text-sm">
              {active.notes}
            </p>
          )}
          {active.kind === 'event' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${control} inline-flex items-center gap-2`}
                disabled={busy}
                onClick={() => startEvent(active)}
              >
                <Pencil size={15} />
                Edit event
              </button>
              <button
                type="button"
                className={`${controlBase} inline-flex items-center gap-2 border-zinc-300 bg-zinc-50 text-red-700 dark:border-admin-border dark:bg-admin-canvas dark:text-red-300`}
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
                Delete event
              </button>
            </div>
          ) : (
            Number(active.can_edit) === 1 && (
              <Link
                className={`${control} inline-flex items-center gap-2`}
                to={`/admin/editor?type=${active.kind}&id=${encodeURIComponent(String(active.id))}`}
              >
                <Pencil size={15} />
                Open editor
              </Link>
            )
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            className={`${primary} inline-flex items-center gap-2`}
            onClick={() => startEvent()}
            disabled={loading || !!readError || day < today}
          >
            <Plus size={16} />
            New event
          </button>
          {day < today && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Past dates are view-only. Use New event above to plan from today.
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dayItems.length} loaded entries
          </p>
          {dayItems.map(itemButton)}
          {!loading && !readError && data && dayItems.length === 0 && (
            <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
              {data?.meta.hasMore
                ? 'No entries loaded for this day yet. Load more records below the calendar.'
                : 'No entries for this day.'}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section className="mx-auto max-w-400 space-y-5" aria-labelledby="calendar-heading">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="calendar-heading"
            className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"
          >
            <CalendarDays className="text-blue-500" />
            Editorial Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Internal events and publication overview. <span>{zone}</span>
          </p>
        </div>
        <button
          type="button"
          className={`${primary} inline-flex items-center gap-2`}
          onClick={() => startEvent()}
          disabled={loading || !!readError || busy}
        >
          <Plus size={17} />
          New event
        </button>
      </header>
      <div className={`${panel} flex flex-wrap items-center gap-2 p-3`}>
        <button
          type="button"
          aria-label="Previous month"
          className={control}
          disabled={busy}
          onClick={() => changeMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="sr-only" htmlFor="calendar-month">
          Calendar month
        </label>
        <input
          id="calendar-month"
          type="month"
          min="1001-01"
          max="9997-12"
          value={month}
          onChange={(event) => {
            if (
              /^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(event.target.value) &&
              event.target.value >= '1001-01' &&
              event.target.value <= '9997-12'
            )
              changeMonth(event.target.value);
          }}
          className={`${control} min-w-0`}
          disabled={busy}
        />
        <button
          type="button"
          aria-label="Next month"
          className={control}
          disabled={busy}
          onClick={() => changeMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className={control}
          disabled={busy}
          onClick={() => {
            if (!canLeave()) return;
            clearPanel();
            setMonth(today.slice(0, 7));
            setDay(today);
            setPage(1);
          }}
        >
          Today
        </button>
        <div className="flex gap-1 ms-auto" role="group" aria-label="Calendar view">
          <button
            type="button"
            aria-label="Refresh calendar"
            className={control}
            disabled={loading || busy}
            onClick={() => {
              if (!canLeave()) return;
              clearPanel();
              setPage(1);
              setRefresh((value) => value + 1);
            }}
          >
            <RefreshCw size={16} />
          </button>
          {(['month', 'agenda'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              className={`${view === mode ? selectedControl : control} inline-flex items-center gap-2`}
              onClick={() => setView(mode)}
            >
              {mode === 'month' ? <CalendarDays size={16} /> : <List size={16} />}
              {mode === 'month' ? 'Month' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Calendar type" className="flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['event', 'Events / Agenda'],
            ['post', 'Posts'],
            ['page', 'Pages'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              className={type === value ? selectedControl : control}
              disabled={busy}
              onClick={() => {
                if (!canLeave()) return;
                clearPanel();
                setType(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 ms-auto">
          Content author
          <select
            aria-label="Content author"
            id="calendar-author"
            value={author}
            disabled={busy || type === 'event'}
            className={`${control} max-w-48`}
            onChange={(event) => {
              if (!canLeave()) return;
              clearPanel();
              setAuthor(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All authors</option>
            {author && !(data?.authors || []).some((row) => String(row.author_id) === author) && (
              <option value={author}>Selected author</option>
            )}
            {data?.authors.map((row) => (
              <option key={row.author_id} value={row.author_id}>
                {row.author_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      )}
      {readError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <span className="grow">{readError}</span>
          <button
            type="button"
            className={`${control} inline-flex items-center gap-2`}
            onClick={() => {
              setPage(1);
              setRefresh((value) => value + 1);
            }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]">
        <div className={`${panel} min-w-0 overflow-hidden`} aria-busy={loading}>
          {loading && (
            <p role="status" className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <Clock3 size={16} />
              Loading calendar...
            </p>
          )}
          {view === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-admin-border">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <span
                    key={label}
                    className="py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7" role="group" aria-label="Calendar days">
                {range.days.map((date) => {
                  const entries = items.filter((item) => calendarItemOnDay(item, date));
                  return (
                    <button
                      key={date}
                      type="button"
                      data-calendar-day={date}
                      aria-label={`${date}, ${entries.length} loaded entries`}
                      aria-pressed={date === day}
                      aria-current={date === today ? 'date' : undefined}
                      disabled={busy}
                      onClick={() => chooseDay(date)}
                      className={`flex min-h-24 min-w-0 flex-col items-stretch justify-start border-b border-e border-zinc-200 px-1 py-2 text-start outline-hidden hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:min-h-32 sm:px-2 dark:border-admin-border dark:hover:bg-admin-hover ${date === day ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${date.startsWith(month) ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      <span
                        className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${date === today ? 'bg-blue-600 font-bold text-white' : ''}`}
                      >
                        {Number(date.slice(8))}
                      </span>
                      <span className="mt-1 block space-y-1">
                        {entries.slice(0, 2).map((item) => (
                          <span
                            key={calendarKey(item)}
                            className={`block truncate rounded px-1 py-0.5 text-[10px] sm:text-xs ${item.kind === 'event' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : item.status === 'scheduled' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'}`}
                          >
                            {itemTitle(item)}
                          </span>
                        ))}
                        {entries.length > 2 && (
                          <span className="block text-[10px] text-slate-500">
                            +{entries.length - 2} more
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3 p-4">
              {items.map(itemButton)}
              {!loading && !readError && items.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No matching entries in this date range.
                </p>
              )}
            </div>
          )}
          <footer className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {range.from} to {shiftDay(range.to, -1)} / {items.length} loaded
              {data?.meta.hasMore ? ' / more available' : ''}
            </span>
            {data?.meta.hasMore && (
              <button
                type="button"
                className={control}
                disabled={loading || busy || page >= 100}
                onClick={() => {
                  setPage((data?.meta.page || 0) + 1);
                  setRefresh((value) => value + 1);
                }}
              >
                Load more
              </button>
            )}
            {!wide && (
              <button
                type="button"
                className={`${selectedControl} inline-flex items-center gap-2`}
                onClick={() => setPanelOpen(true)}
              >
                <CalendarDays size={16} />
                Day details
              </button>
            )}
          </footer>
          {data?.meta.authorsTruncated && (
            <p className="px-4 pb-4 text-xs text-amber-700 dark:text-amber-300">
              The first 200 content authors in this range are listed.
            </p>
          )}
        </div>
        {wide && <aside className={`${panel} min-w-0 self-start`}>{contextPanel}</aside>}
      </div>
      <AdminModal
        isOpen={!wide && panelOpen}
        onClose={() => {
          if (canLeave()) setPanelOpen(false);
        }}
        closeOnEscape={!busy}
        closeOnBackdrop={!busy}
        ariaLabel="Calendar details"
        className="fixed inset-y-0 end-0 w-full max-w-md overflow-y-auto bg-zinc-100 shadow-xl dark:bg-admin-panel"
      >
        {contextPanel}
      </AdminModal>
      <AdminModal
        isOpen={confirmDelete}
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
        closeOnBackdrop={!busy}
        closeOnEscape={!busy}
        ariaLabel="Delete calendar event"
        className="w-full max-w-md rounded-2xl bg-zinc-100 p-6 text-slate-800 shadow-xl dark:bg-admin-panel dark:text-slate-100"
      >
        <h2 className="text-lg font-semibold">Delete this event?</h2>
        <p className="my-4 text-sm">
          This permanently removes the internal event, not an article or page. Its audit record is
          retained.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className={control}
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
          <button type="button" className={danger} disabled={busy} onClick={() => void write(true)}>
            {busy ? 'Deleting...' : 'Delete event'}
          </button>
        </div>
      </AdminModal>
    </section>
  );
}
