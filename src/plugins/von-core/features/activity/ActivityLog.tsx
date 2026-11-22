import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, History, Trash2, X } from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch, getErrorMessage } from '../../../../utils/api';
import { formatDateTime } from '../../../../utils/dateFormat';
import AdminModal from '../../../../components/admin/AdminModal';

interface LogRow {
  key: string;
  source: string;
  at: string;
  actorId: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  outcome: string;
  details: Record<string, boolean | number | string | null>;
}
interface LogPage {
  success: boolean;
  message?: string;
  error?: string;
  logs: LogRow[];
  nextCursor: string | null;
  unavailableSources: string[];
}
interface Preview {
  success: boolean;
  message?: string;
  before: string;
  eligible: number;
  token: string;
  batchSize: number;
}
const initialFilters = { actor: '', role: '', event: '', type: '', from: '', to: '' };
const control =
  'min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-admin-border dark:bg-admin-panel';
const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-admin-border dark:hover:bg-admin-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';
const panel =
  'rounded-xl border border-slate-200 bg-white p-4 dark:border-admin-border dark:bg-admin-panel';

export default function ActivityLog({ timeZone }: { timeZone?: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [request, setRequest] = useState({
    filters: initialFilters,
    cursors: [''],
    page: 0,
    revision: 0,
  });
  const [result, setResult] = useState<{
    request: typeof request;
    page?: LogPage;
    error?: string;
  }>();
  const [detail, setDetail] = useState<LogRow | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [purgeError, setPurgeError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const loading = result?.request !== request;
  const page = !loading ? result?.page : undefined;
  const reset = () =>
    setRequest((previous) => ({
      ...previous,
      cursors: [''],
      page: 0,
      revision: previous.revision + 1,
    }));

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      ...request.filters,
      cursor: request.cursors[request.page] || '',
    });
    void (async () => {
      try {
        const response = await vonFetch(`${API.activityLogs}?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data: LogPage = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.error || data.message || 'Activity Log unavailable.');
        if (!controller.signal.aborted) setResult({ request, page: data });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ request, error: getErrorMessage(error, 'Activity Log unavailable.') });
      }
    })();
    return () => controller.abort();
  }, [request]);
  useEffect(() => () => mutation.current?.abort(), []);

  const purge = async (confirm: boolean) => {
    if (pending.current || (confirm && !preview)) return;
    pending.current = true;
    setBusy(true);
    setPurgeError('');
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const response = await vonFetch(API.activityLogs, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          confirm ? { action: 'purge', token: preview?.token } : { action: 'preview' }
        ),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || data.message || 'Activity purge unavailable.');
      if (controller.signal.aborted) return;
      if (confirm) {
        setPreview(null);
        setNotice(
          `${data.removed} activity records purged. Original content and shared histories were not touched.`
        );
        reset();
      } else setPreview(data as Preview);
    } catch (error) {
      if (!controller.signal.aborted)
        setPurgeError(getErrorMessage(error, 'Activity purge unavailable.'));
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History aria-hidden size={24} />
            Activity Log
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Recorded staff operations, separate from Security incidents. Primary Admin only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={reset} disabled={loading}>
            <RefreshCw aria-hidden size={16} />
            Refresh
          </button>
          <button
            className={`${button} admin-action-delete text-red-600 dark:text-red-400`}
            onClick={() => void purge(false)}
            disabled={busy}
          >
            <Trash2 aria-hidden size={16} />
            Preview purge
          </button>
        </div>
      </header>
      <div className={`${panel} text-sm text-slate-600 dark:text-slate-300`}>
        Reads existing Post/Page, Settings and Calendar history without copying it. Media deletion
        is recorded from this update onward. Missing historical names or roles show as not recorded,
        never inferred. This is not a complete immutable audit or Restore tool.
        <p className="mt-2">
          New media/purge records: 90-day retention, up to 500 per purge. Authorized cron also runs
          bounded cleanup. Original histories keep their own retention rules.
        </p>
      </div>
      <form
        className={`${panel} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}
        onSubmit={(event) => {
          event.preventDefault();
          setRequest({
            filters: { ...filters },
            cursors: [''],
            page: 0,
            revision: request.revision + 1,
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Actor ID
          <input
            id="activity-filter-actor"
            name="actor"
            className={control}
            value={filters.actor}
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            maxLength={18}
            onChange={(event) => setFilters({ ...filters, actor: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Recorded role
          <select
            id="activity-filter-role"
            name="role"
            className={control}
            value={filters.role}
            onChange={(event) => setFilters({ ...filters, role: event.target.value })}
          >
            <option value="">All roles</option>
            <option value="root">Primary Admin (root)</option>
            <option value="admin">Admin (recorded role)</option>
            <option value="moderator">Moderator</option>
            <option value="writer">Writer</option>
            <option value="system">System</option>
            <option value="unrecorded">Not recorded</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Action
          <input
            id="activity-filter-event"
            name="event"
            className={control}
            placeholder="e.g. delete"
            value={filters.event}
            maxLength={32}
            pattern="[a-z][a-z0-9_]*"
            onChange={(event) => setFilters({ ...filters, event: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Target type
          <select
            id="activity-filter-type"
            name="type"
            className={control}
            value={filters.type}
            onChange={(event) => setFilters({ ...filters, type: event.target.value })}
          >
            {['', 'post', 'page', 'settings', 'calendar', 'media', 'activity'].map((type) => (
              <option key={type} value={type}>
                {type || 'All types'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          From
          <input
            id="activity-filter-from"
            name="from"
            type="date"
            className={control}
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Through
          <input
            id="activity-filter-to"
            name="to"
            type="date"
            className={control}
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={button}>
            Apply filters
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              setFilters(initialFilters);
              setRequest({
                filters: initialFilters,
                cursors: [''],
                page: 0,
                revision: request.revision + 1,
              });
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {notice && (
        <p role="status" className={panel}>
          {notice}
        </p>
      )}
      {purgeError && !preview && (
        <p role="alert" className={panel}>
          {purgeError}
        </p>
      )}
      <section className={panel} aria-label="Recorded activity" aria-busy={loading}>
        {loading ? (
          <p role="status">Loading activity...</p>
        ) : result?.error ? (
          <p role="alert">{result.error}</p>
        ) : (
          <>
            {page?.unavailableSources.length ? (
              <p role="alert" className="mb-3 text-sm">
                Some original histories are unavailable ({page.unavailableSources.join(', ')}). Run
                Database Repair; missing records are not fabricated.
              </p>
            ) : null}
            {!page?.logs.length ? (
              <p>No recorded activity matches these filters.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-admin-border">
                {page.logs.map((row) => (
                  <li
                    key={row.key}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="break-words font-medium">
                        {row.action}{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          / {row.targetType}
                        </span>{' '}
                        - {row.targetLabel || `#${row.targetId}`}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                        {row.actorUsername ||
                          (row.actorId
                            ? `User #${row.actorId} (name not recorded)`
                            : 'Actor not recorded')}{' '}
                        · {row.actorRole || 'Role not recorded'} ·{' '}
                        {formatDateTime(row.at, timeZone)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.outcome === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}
                    >
                      {row.outcome}
                    </span>
                    <button
                      className={button}
                      onClick={() => setDetail(row)}
                      aria-label={`Details for ${row.targetLabel || row.targetId}`}
                    >
                      Details
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <nav
          aria-label="Activity pagination"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-admin-border"
        >
          <p className="text-sm">Page {request.page + 1} · Up to 20 records per page</p>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={loading || request.page === 0}
              onClick={() => setRequest({ ...request, page: request.page - 1 })}
            >
              Previous
            </button>
            <button
              className={button}
              disabled={loading || !page?.nextCursor}
              onClick={() => {
                if (page?.nextCursor)
                  setRequest({
                    ...request,
                    cursors: [...request.cursors.slice(0, request.page + 1), page.nextCursor],
                    page: request.page + 1,
                  });
              }}
            >
              Next
            </button>
          </div>
        </nav>
      </section>
      <AdminModal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        ariaLabel="Activity details"
        className={`${panel} w-full max-w-xl text-slate-800 dark:text-slate-100`}
      >
        {detail && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Activity details</h2>
              <button className={button} onClick={() => setDetail(null)} aria-label="Close details">
                <X size={18} />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 break-all text-sm">
              {Object.entries({
                Source: detail.source,
                'Record ID': detail.key,
                'Target ID': detail.targetId,
                'Actor ID': detail.actorId || 'Not recorded',
                Outcome: detail.outcome,
                ...detail.details,
              }).map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt className="text-slate-500 dark:text-slate-400">{key}</dt>
                  <dd>{String(value)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </>
        )}
      </AdminModal>
      <AdminModal
        isOpen={preview !== null}
        onClose={() => {
          if (!busy) {
            setPreview(null);
            setPurgeError('');
          }
        }}
        closeOnEscape={!busy}
        closeOnBackdrop={!busy}
        ariaLabel="Confirm Activity purge"
        className={`${panel} w-full max-w-xl text-slate-800 dark:text-slate-100`}
      >
        {preview && (
          <>
            <h2 className="text-lg font-semibold">Purge old activity records?</h2>
            <p className="mt-3 text-sm">
              {preview.eligible} records older than {formatDateTime(preview.before, timeZone)} are
              eligible. This batch removes at most {preview.batchSize}. Only new media/purge history
              is affected; original histories and content are not deleted. Purged records cannot be
              restored here.
            </p>
            {purgeError && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {purgeError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setPurgeError('');
                }}
              >
                Cancel
              </button>
              <button
                className={`${button} admin-action-delete text-red-600 dark:text-red-400`}
                disabled={busy || preview.eligible === 0}
                onClick={() => void purge(true)}
              >
                {busy ? 'Purging...' : 'Confirm purge'}
              </button>
            </div>
          </>
        )}
      </AdminModal>
    </div>
  );
}
