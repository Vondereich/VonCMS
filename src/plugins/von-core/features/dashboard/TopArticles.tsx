import { useEffect, useState } from 'react';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

interface ArticleViews {
  id: string;
  title: string;
  category: string;
  views: number;
  url: string;
}

interface ArticleReport {
  articles: ArticleViews[];
  since: string | null;
  timeZone: string;
}

export default function TopArticles({ days }: { days: number }) {
  const [report, setReport] = useState<ArticleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError('');
    setReport(null);
    vonFetch(`${API.trackVisit}?report=articles&days=${days}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.articleViews?.articles)) {
          const message = data.error ?? data.message;
          throw new Error(
            typeof message === 'string' && message
              ? message
              : 'Article views could not be loaded. Please try again.'
          );
        }
        const result = data.articleViews as ArticleReport;
        if (cancelled) return;
        setReport({
          ...result,
          articles: result.articles.filter(
            (article) =>
              typeof article.url === 'string' &&
              article.url.startsWith('/') &&
              !article.url.startsWith('//') &&
              !/[\\\r\n]/.test(article.url)
          ),
        });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Article views could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [days, retry]);

  return (
    <div aria-busy={loading} aria-live="polite">
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Most-viewed published articles in the last {days} days. Views are not unique readers.
      </p>
      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading article views...
        </p>
      ) : error ? (
        <div className="rounded-lg border border-slate-200 p-5 text-sm dark:border-admin-border">
          <p className="text-slate-600 dark:text-slate-300">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-3 font-semibold text-primary-600 hover:underline dark:text-primary-400"
          >
            Try again
          </button>
        </div>
      ) : report?.articles.length ? (
        <ol className="divide-y divide-slate-100 dark:divide-admin-border">
          {report.articles.map((article, index) => (
            <li key={article.id} className="flex items-center gap-3 py-3">
              <span className="w-6 shrink-0 text-sm tabular-nums text-slate-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 text-sm font-semibold text-slate-800 hover:text-primary-600 focus-visible:outline-primary-500 dark:text-slate-100 dark:hover:text-primary-400"
                >
                  {article.title}
                </a>
                {article.category && (
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {article.category}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-white">
                  {Number(article.views).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">views</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          No article views recorded for this period yet.
        </p>
      )}
      {!loading && !error && report && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-admin-border dark:text-slate-400">
          {report.since
            ? `Daily tracking enabled on ${report.since}.`
            : 'Daily tracking is enabled.'}{' '}
          Earlier lifetime views are not included. Dates use {report.timeZone}.
        </p>
      )}
    </div>
  );
}
