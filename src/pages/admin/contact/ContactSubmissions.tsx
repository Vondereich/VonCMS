import { useEffect, useState } from 'react';
import { API } from '../../../config/site.config';
import { getErrorMessage, vonFetch } from '../../../utils/api';

interface Submission {
  id: string | number;
  form_name?: string;
  created_at?: string;
  data: string | Record<string, unknown>;
}

const readFields = (data: Submission['data']): Record<string, unknown> | null => {
  try {
    const value = typeof data === 'string' ? JSON.parse(data) : data;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

/** Read-only inbox over the existing bounded, Admin-only leads endpoint. */
export default function ContactSubmissions({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [records, setRecords] = useState<Submission[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const response = await vonFetch(`${API.contactSubmissions}?page=${page}&limit=20`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result.success !== true || !Array.isArray(result.submissions)) {
          throw new Error(result.error || result.message || 'Submissions could not be loaded.');
        }
        const pageCount = Math.max(1, Number(result.pagination?.pages) || 1);
        if (controller.signal.aborted) return;
        setPages(pageCount);
        setTotal(Math.max(0, Number(result.pagination?.total) || 0));
        if (page > pageCount) {
          setPage(pageCount);
          return;
        }
        setRecords(result.submissions);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(failure, 'Submissions could not be loaded.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [page, refresh]);

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Contact Submissions</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Saved messages from the last 90 days, including messages received when email delivery
            failed. A saved receipt does not confirm email delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 px-4 py-2 dark:border-admin-border dark:text-gray-200"
          >
            Back to Forms
          </button>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {loading ? (
        <p role="status">Loading submissions...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 p-4 text-red-700 dark:border-red-900 dark:text-red-300"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="mt-2 underline"
          >
            Retry
          </button>
        </div>
      ) : records.length === 0 ? (
        <p>No submissions received yet.</p>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const fields = readFields(record.data);
            return (
              <article
                key={record.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-admin-border dark:bg-admin-panel sm:p-6"
              >
                <h2 className="font-semibold text-slate-800 dark:text-white">
                  {record.form_name || 'Contact form'}{' '}
                  <span className="font-normal text-slate-500 dark:text-gray-400">
                    #{record.id}
                  </span>
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                  Recorded: {record.created_at || 'Time not recorded'}
                </p>
                {fields ? (
                  <dl className="mt-4 space-y-3">
                    {Object.entries(fields).map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <dt className="break-words text-sm font-medium text-slate-700 dark:text-gray-300">
                          {key}
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap wrap-anywhere text-sm text-slate-600 dark:text-gray-400">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-slate-500 dark:text-gray-400">
                    The saved message format could not be read.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {!loading && !error && (
        <nav
          aria-label="Contact submissions pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-gray-300"
        >
          <span>
            {total} submissions · Page {page} of {pages}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((value) => value - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-40 dark:border-admin-border"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={page >= pages}
              className="rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-40 dark:border-admin-border"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
