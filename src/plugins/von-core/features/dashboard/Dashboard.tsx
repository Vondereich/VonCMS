import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import pkg from '../../../../../package.json';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  FileText,
  MessageSquare,
  Users,
  Activity,
  HardDrive,
  Clock,
  CheckCircle2,
  Server,
  X,
  RefreshCw,
  Download,
  FileStack,
} from 'lucide-react';
import { UpdateModal } from '../settings/UpdateModal';
import { Post, User, Comment, Page, SiteSettings } from '../../../../types';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { flattenComments } from '../../../../utils/siteUtils';
import AdminModal from '../../../../components/admin/AdminModal';

interface DashboardProps {
  posts: Post[];
  users: User[];
  comments: Comment[];
  pages: Page[];
  currentUser?: User | null;
  serverInfo?: SiteSettings['_serverInfo'];
  timeZone?: string;
}

interface DashboardActivity {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  color: string;
}

interface TrafficChartPoint {
  name: string;
  visits: number;
  uniqueVisitors: number;
}

interface TrafficSummary {
  totalVisits: number;
  uniqueVisitors: number;
}

const parseTrafficCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}> = ({
  title,
  value,
  icon,
  trend,
  color = 'bg-primary-50 text-primary-600 dark:bg-primary-900/20',
}) => (
  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md dark:border-white/10 dark:bg-[#16161e]/50 sm:p-5">
    <div className={`shrink-0 rounded-lg p-2.5 ${color}`}>{icon}</div>
    <div className="min-w-0 grow">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <p className="mt-1 truncate text-2xl font-extrabold text-slate-800 dark:text-white">
        {value}
      </p>
    </div>
    <div className="shrink-0">
      {trend && (
        <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-800">
          {trend}
        </span>
      )}
    </div>
  </div>
);

const formatActivityTime = (value?: string) => {
  if (!value) return 'Recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
};

const DashboardClock: React.FC<{ timeZone: string; canChangeTimeZone: boolean }> = React.memo(
  ({ timeZone, canChangeTimeZone }) => {
    const [clockNow, setClockNow] = useState(() => new Date());
    const navigate = useNavigate();
    const effectiveTimeZone = useMemo(() => {
      const requestedTimeZone = timeZone.trim() || 'UTC';

      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: requestedTimeZone }).format(new Date(0));
        return requestedTimeZone;
      } catch {
        return 'UTC';
      }
    }, [timeZone]);
    const clockFormatter = useMemo(
      () =>
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
          timeZone: effectiveTimeZone,
        }),
      [effectiveTimeZone]
    );
    const formattedClockTime = clockFormatter.format(clockNow);

    useEffect(() => {
      let alignmentTimeout: number | undefined;
      let clockInterval: number | undefined;

      const clearClockTimers = () => {
        if (alignmentTimeout !== undefined) window.clearTimeout(alignmentTimeout);
        if (clockInterval !== undefined) window.clearInterval(clockInterval);
        alignmentTimeout = undefined;
        clockInterval = undefined;
      };
      const updateClock = () => setClockNow(new Date());
      const startClock = () => {
        clearClockTimers();
        if (document.hidden) return;

        updateClock();
        const delayUntilNextSecond = 1000 - (Date.now() % 1000);
        alignmentTimeout = window.setTimeout(() => {
          updateClock();
          clockInterval = window.setInterval(updateClock, 1000);
        }, delayUntilNextSecond);
      };

      startClock();
      document.addEventListener('visibilitychange', startClock);
      return () => {
        document.removeEventListener('visibilitychange', startClock);
        clearClockTimers();
      };
    }, []);

    return (
      <div className="w-full pl-[52px] text-left sm:w-auto sm:pl-0 sm:text-right">
        <time
          dateTime={clockNow.toISOString()}
          className="block font-mono text-lg font-bold tabular-nums text-slate-800 dark:text-white"
          aria-label={`Current time in ${effectiveTimeZone}: ${formattedClockTime}`}
        >
          {formattedClockTime}
        </time>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400 sm:justify-end">
          <span>{effectiveTimeZone}</span>
          {canChangeTimeZone && (
            <button
              type="button"
              onClick={() => navigate('/admin/settings')}
              className="font-semibold text-primary-600 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:text-primary-400"
            >
              Change timezone
            </button>
          )}
        </div>
      </div>
    );
  }
);

DashboardClock.displayName = 'DashboardClock';

const VpDashboard: React.FC<DashboardProps> = ({
  posts = [],
  users = [],
  comments = [],
  pages = [],
  currentUser,
  serverInfo,
  timeZone = 'UTC',
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [storageData, setStorageData] = useState({ used: '0 MB' });
  const [contentTotals, setContentTotals] = useState({
    articles: 0,
    pages: 0,
  });
  const [contentTotalsLoading, setContentTotalsLoading] = useState({
    articles: true,
    pages: true,
  });
  const [days, setDays] = useState(7);
  const [chartData, setChartData] = useState<TrafficChartPoint[]>([]);
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary>({
    totalVisits: 0,
    uniqueVisitors: 0,
  });
  const canManageSystem =
    currentUser?.role?.toLowerCase() === 'root' || String(currentUser?.id || '') === '1';
  const currentUserRole = currentUser?.role?.toLowerCase();
  const canChangeTimeZone = currentUserRole === 'admin' || currentUserRole === 'root';

  // Auto-Update State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    latestVersion: string;
    downloadUrl: string;
    releaseNotes: string;
    expectedHash?: string;
  } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Compare semantic versions (returns true if remote > local)
  const isNewerVersion = (local: string, remote: string): boolean => {
    const localParts = local.replace(/^v/, '').split('.').map(Number);
    const remoteParts = remote.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
      const l = localParts[i] || 0;
      const r = remoteParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  };

  // Check for updates from GitHub
  const checkForUpdates = async () => {
    if (!canManageSystem) return;

    setCheckingUpdate(true);
    try {
      const res = await window.fetch(
        'https://api.github.com/repos/Vondereich/VonCMS/releases/latest',
        {
          headers: { Accept: 'application/vnd.github.v3+json' },
        }
      );

      if (!res.ok) throw new Error('GitHub API error');

      const data = await res.json();
      const latestVersion = (data.tag_name || '').replace(/^v\.?/, ''); // Handle both "v1.x" and "v.1.x" formats
      const currentVersion = pkg.version;

      if (isNewerVersion(currentVersion, latestVersion)) {
        // Find the Deploy.zip asset
        const deployAsset = data.assets?.find(
          (a: any) => a.name && a.name.includes('Deploy') && a.name.endsWith('.zip')
        );

        setUpdateInfo({
          available: true,
          latestVersion: latestVersion, // Already cleaned at parse time
          downloadUrl: deployAsset?.browser_download_url || '',
          releaseNotes: data.body || 'No release notes available.',
          expectedHash: deployAsset?.digest || deployAsset?.sha256 || '',
        });
      } else {
        setUpdateInfo({
          available: false,
          latestVersion: '',
          downloadUrl: '',
          releaseNotes: '',
          expectedHash: '',
        });
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setUpdateInfo(null);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Check for updates on mount (primary owner only)
  useEffect(() => {
    if (canManageSystem) {
      checkForUpdates();
    }
  }, [canManageSystem]);

  // Calculate Real Stats
  const [activeUsers, setActiveUsers] = useState(users.length);
  const [activeUsersLoading, setActiveUsersLoading] = useState(true);
  const fallbackCommentTotal = useMemo(() => flattenComments(comments).length, [comments]);
  const [totalComments, setTotalComments] = useState(fallbackCommentTotal);
  const [totalCommentsLoading, setTotalCommentsLoading] = useState(true);

  useEffect(() => {
    setActiveUsers((prev) => Math.max(prev, users.length));
  }, [users.length]);

  useEffect(() => {
    setTotalComments((prev) => Math.max(prev, fallbackCommentTotal));
  }, [fallbackCommentTotal]);

  useEffect(() => {
    const role = currentUser?.role?.toLowerCase();
    const fallbackArticleTotal = posts.length;
    const fallbackPageTotal = pages.length;

    if (!['admin', 'root', 'moderator', 'writer'].includes(role || '')) {
      setContentTotals({
        articles: fallbackArticleTotal,
        pages: fallbackPageTotal,
      });
      setContentTotalsLoading({
        articles: false,
        pages: false,
      });
      return;
    }

    let cancelled = false;
    setContentTotalsLoading({
      articles: true,
      pages: true,
    });

    const postCountParams = new URLSearchParams();
    postCountParams.set('limit', '1');
    postCountParams.set('countOnly', 'true');
    postCountParams.set('scope', 'all');

    Promise.all([
      vonFetch(`${API.getPosts}?${postCountParams.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) =>
          Number.isFinite(Number(data?.meta?.total))
            ? Number(data?.meta?.total)
            : fallbackArticleTotal
        )
        .catch(() => fallbackArticleTotal),
      vonFetch(`${API.getPages}?limit=1`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) =>
          Number.isFinite(Number(data?.meta?.total)) ? Number(data?.meta?.total) : fallbackPageTotal
        )
        .catch(() => fallbackPageTotal),
    ]).then(([articles, totalPages]) => {
      if (cancelled) return;
      setContentTotals({
        articles: Math.max(fallbackArticleTotal, articles),
        pages: Math.max(fallbackPageTotal, totalPages),
      });
      setContentTotalsLoading({
        articles: false,
        pages: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, posts.length, pages.length]);

  useEffect(() => {
    const role = currentUser?.role?.toLowerCase();
    if (!['admin', 'root', 'moderator', 'writer'].includes(role || '')) {
      setActiveUsers(users.length);
      setActiveUsersLoading(false);
      return;
    }

    let cancelled = false;
    setActiveUsersLoading(true);

    vonFetch(API.getUserStats)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const resolvedTotal = Number(data?.meta?.total);
        if (Number.isFinite(resolvedTotal)) {
          setActiveUsers(Math.max(users.length, resolvedTotal));
        }
      })
      .catch(() => setActiveUsers(users.length))
      .finally(() => {
        if (!cancelled) {
          setActiveUsersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, users.length]);

  useEffect(() => {
    const role = currentUser?.role?.toLowerCase();
    if (!['admin', 'root', 'moderator', 'writer'].includes(role || '')) {
      setTotalComments(fallbackCommentTotal);
      setTotalCommentsLoading(false);
      return;
    }

    let cancelled = false;
    setTotalCommentsLoading(true);
    const params = new URLSearchParams({
      flat: 'true',
      page: '1',
      limit: '1',
    });

    vonFetch(`${API.getComments}?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const resolvedTotal = Number(data?.meta?.total);
        if (Number.isFinite(resolvedTotal)) {
          setTotalComments(Math.max(fallbackCommentTotal, resolvedTotal));
        }
      })
      .catch(() => setTotalComments(fallbackCommentTotal))
      .finally(() => {
        if (!cancelled) {
          setTotalCommentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, fallbackCommentTotal]);

  // Storage scans the upload tree, so keep it independent from analytics period changes.
  useEffect(() => {
    const role = currentUser?.role?.toLowerCase();
    if (['admin', 'root', 'moderator', 'writer'].includes(role || '')) {
      vonFetch(API.getStorage)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStorageData({
              used: data.storage.used,
            });
          }
        })
        .catch(() => setStorageData({ used: '0 MB' }));
    }
  }, [currentUser?.role]);

  // Fetch analytics when the selected reporting period changes.
  useEffect(() => {
    vonFetch(`${API.trackVisit}?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.analytics?.daily)) {
          const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

          // Generate a full range of dates to ensure zero-padding
          const dateRange = [];
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);

            // Local date string YYYY-MM-DD
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateRange.push(`${year}-${month}-${day}`);
          }

          const dailyMap = new Map<string, Record<string, unknown>>(
            data.analytics.daily
              .filter((entry: unknown): entry is Record<string, unknown> => {
                return typeof entry === 'object' && entry !== null;
              })
              .map((entry: Record<string, unknown>) => [String(entry['visit_date'] || ''), entry])
          );

          const formatted = dateRange.map((dateStr) => {
            const d = new Date(`${dateStr}T00:00:00`);
            const dailyEntry = dailyMap.get(dateStr);
            const label =
              days === 7
                ? daysShort[d.getDay()]
                : `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

            return {
              name: label,
              visits: parseTrafficCount(dailyEntry?.['visits']),
              uniqueVisitors: parseTrafficCount(dailyEntry?.['unique_visitors']),
            };
          });

          setChartData(formatted);

          const totals =
            typeof data.analytics.totals === 'object' && data.analytics.totals !== null
              ? (data.analytics.totals as Record<string, unknown>)
              : {};
          setTrafficSummary({
            totalVisits: parseTrafficCount(totals['total_views']),
            uniqueVisitors: parseTrafficCount(totals['unique_visitors']),
          });
        } else {
          setChartData(getDefaultChart(days));
          setTrafficSummary({ totalVisits: 0, uniqueVisitors: 0 });
        }
      })
      .catch(() => {
        setChartData(getDefaultChart(days));
        setTrafficSummary({ totalVisits: 0, uniqueVisitors: 0 });
      });
  }, [days]);

  const getDefaultChart = (range: number): TrafficChartPoint[] => {
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return Array.from({ length: range }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (range - index - 1));

      return {
        name:
          range === 7
            ? daysShort[date.getDay()]
            : `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`,
        visits: 0,
        uniqueVisitors: 0,
      };
    });
  };

  const trafficPeriodSummary = useMemo(() => {
    const activeDays = chartData.filter((entry) => entry.visits > 0).length;
    const peakDay = chartData.reduce<TrafficChartPoint | null>((highest, entry) => {
      if (!highest || entry.visits > highest.visits) return entry;
      return highest;
    }, null);
    const dailyAverage = chartData.length > 0 ? trafficSummary.totalVisits / chartData.length : 0;

    return {
      activeDays,
      dailyAverage,
      peakDay: peakDay && peakDay.visits > 0 ? peakDay.name : 'No visits',
      peakVisits: peakDay?.visits || 0,
    };
  }, [chartData, trafficSummary.totalVisits]);

  // Calculate Recent Activity from Posts
  const recentActivity = useMemo(() => {
    const activity: DashboardActivity[] = [];

    // Add recent posts
    posts.slice(0, 5).forEach((post) => {
      activity.push({
        title: post.title,
        description: 'Article activity',
        time: formatActivityTime(
          post.updatedAt || post.updated_at || post.createdAt || post.created_at
        ),
        icon: <FileText size={14} />,
        color: 'text-blue-500 bg-blue-100 dark:bg-blue-500/10',
      });
    });

    // Add system update (static for now)
    activity.push({
      title: `VonCMS v${pkg.version}`,
      description: 'Current installed release',
      time: 'System ready',
      icon: <Server size={14} />,
      color: 'text-green-500 bg-green-100 dark:bg-green-500/10',
    });

    return activity;
  }, [posts]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
            <Server size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-x-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-200">VonCMS</span>
                <span className="font-mono font-semibold text-primary-600 dark:text-primary-400">
                  v{pkg.version}
                </span>
                {serverInfo?.phpVersion && (
                  <>
                    <span aria-hidden="true">&bull;</span>
                    <span>PHP {serverInfo.phpVersion}</span>
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                <span className="size-2 rounded-full bg-green-500" aria-hidden="true" />
                System ready
              </span>
            </div>
          </div>
        </div>
        <DashboardClock timeZone={timeZone} canChangeTimeZone={canChangeTimeZone} />
      </div>

      {/* Update Available Banner - Shows when new version detected */}
      {updateInfo?.available && (
        <div className="bg-orange-600 rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <Download size={24} />
            </div>
            <div>
              <h4 className="font-bold text-lg flex items-center gap-2">
                Update Available!
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  v{updateInfo.latestVersion}
                </span>
              </h4>
              <p className="text-amber-100 text-sm">A new version of VonCMS is ready to install.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpdateModal(true)}
              className="px-5 py-2.5 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors shadow-md flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Update Now
            </button>
          </div>
        </div>
      )}

      {/* Checking Update Indicator */}
      {checkingUpdate && (
        <div className="bg-slate-100 dark:bg-[#1a1b26] rounded-xl p-3 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <RefreshCw size={16} className="animate-spin" />
          Checking for updates...
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && updateInfo?.available && (
        <UpdateModal
          currentVersion={pkg.version}
          latestVersion={updateInfo.latestVersion}
          downloadUrl={updateInfo.downloadUrl}
          releaseNotes={updateInfo.releaseNotes}
          expectedHash={updateInfo.expectedHash}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          title="Articles"
          value={contentTotalsLoading.articles ? '...' : contentTotals.articles.toString()}
          icon={<FileText size={24} />}
          color="bg-sky-50 text-sky-600 dark:bg-sky-900/20"
        />
        <StatCard
          title="Pages"
          value={contentTotalsLoading.pages ? '...' : contentTotals.pages.toString()}
          icon={<FileStack size={24} />}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
        />
        <StatCard
          title="Comments"
          value={totalCommentsLoading ? '...' : totalComments.toString()}
          icon={<MessageSquare size={24} />}
          color="bg-purple-50 text-purple-600 dark:bg-purple-900/20"
        />
        <StatCard
          title="Active Users"
          value={activeUsersLoading ? '...' : activeUsers.toString()}
          icon={<Users size={24} />}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900/20"
        />
        <StatCard
          title="Media Usage"
          value={storageData.used}
          icon={<HardDrive size={24} />}
          color="bg-amber-50 text-amber-600 dark:bg-amber-900/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#16161e]/50 backdrop-blur-xs p-5 rounded-xl shadow-xs border border-slate-200 dark:border-white/10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Visitor Traffic</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Visits and unique visitors recorded by the existing analytics log.
              </p>
            </div>
            <label htmlFor="dashboard-traffic-range" className="sr-only">
              Visitor traffic date range
            </label>
            <select
              id="dashboard-traffic-range"
              name="dashboardTrafficRange"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="text-xs border-none bg-slate-100 dark:bg-[#1a1b26] rounded-lg px-3 py-1 text-slate-600 dark:text-slate-300 focus:ring-0 cursor-pointer"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          <div className="mb-4 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 px-2 py-3 dark:divide-white/10 dark:bg-[#1a1b26]/70">
            <div className="min-w-0 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total visits
              </p>
              <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
                {trafficSummary.totalVisits.toLocaleString()}
              </p>
            </div>
            <div className="min-w-0 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Unique visitors
              </p>
              <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
                {trafficSummary.uniqueVisitors.toLocaleString()}
              </p>
            </div>
            <div className="min-w-0 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Active days
              </p>
              <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
                {trafficPeriodSummary.activeDays}/{chartData.length || days}
              </p>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-sm bg-sky-500" aria-hidden="true" />
              Visits
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-violet-500" aria-hidden="true" />
              Unique visitors
            </span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  }}
                  cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }}
                />
                <Bar
                  dataKey="visits"
                  name="Visits"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="Unique visitors"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Period Summary
              </h4>
              <span className="text-xs text-slate-400">{days} days</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#1a1b26]/70">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Daily average
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                  {trafficPeriodSummary.dailyAverage.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  visits
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#1a1b26]/70">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Peak day
                </p>
                <p className="mt-1 truncate text-sm font-bold text-slate-800 dark:text-white">
                  {trafficPeriodSummary.peakDay}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#1a1b26]/70">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Peak visits
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                  {trafficPeriodSummary.peakVisits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white dark:bg-[#16161e]/50 backdrop-blur-xs p-5 rounded-xl shadow-xs border border-slate-200 dark:border-white/10 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-0 grow">
            {recentActivity.slice(0, 4).map((log, i) => (
              <div
                key={i}
                className="flex gap-3 items-start border-b border-slate-100 dark:border-white/10 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50 transition-colors px-2 rounded-lg -mx-2"
              >
                <div className={`mt-0.5 p-1.5 rounded-full ${log.color}`}>{log.icon}</div>
                <div className="min-w-0">
                  <p
                    className="line-clamp-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                    title={log.title}
                  >
                    {log.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400">
                    <span>{log.description}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {log.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAuditLog(true)}
            className="mt-4 w-full py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a2b36] rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors"
          >
            View Activity History
          </button>
        </div>
      </div>

      {/* Activity History Modal */}
      <AdminModal
        isOpen={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        ariaLabel="Activity history"
        className="w-full max-w-2xl"
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#16161e] sm:max-h-[80dvh]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/10 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="text-primary-500" /> Activity History
            </h2>
            <button
              type="button"
              onClick={() => setShowAuditLog(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
              aria-label="Close activity history"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-2 sm:px-6">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {recentActivity.map((log, i) => (
                  <div key={i} className="flex gap-4 py-4">
                    <div
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${log.color}`}
                    >
                      {log.icon}
                    </div>
                    <div className="min-w-0 grow">
                      <p
                        className="font-semibold text-slate-800 dark:text-slate-200"
                        title={log.title}
                      >
                        {log.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                        <span>{log.description}</span>
                        <span aria-hidden="true">&bull;</span>
                        <span className="flex items-center gap-1 font-mono text-xs">
                          <Clock size={11} /> {log.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                <p>No recent activity found.</p>
              </div>
            )}
          </div>
          <div className="admin-safe-bottom flex justify-end border-t border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#16161e]/50">
            <button
              onClick={() => setShowAuditLog(false)}
              className="min-h-11 w-full px-4 py-2 bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors sm:w-auto"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default VpDashboard;
