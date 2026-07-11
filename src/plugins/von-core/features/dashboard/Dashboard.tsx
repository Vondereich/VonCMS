import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pkg from '../../../../../package.json';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
import { sanitizeHtml } from '../../../../utils/security';

interface DashboardProps {
  posts: Post[];
  users: User[];
  comments: Comment[];
  pages: Page[];
  currentUser?: User | null;
  serverInfo?: SiteSettings['_serverInfo'];
}

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
  <div className="bg-white dark:bg-[#16161e]/50 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      {trend && (
        <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-800">
          {trend}
        </span>
      )}
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
      {title}
    </h3>
    <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{value}</p>
  </div>
);

const VpDashboard: React.FC<DashboardProps> = ({
  posts = [],
  users = [],
  comments = [],
  pages = [],
  currentUser,
  serverInfo,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [storageData, setStorageData] = useState({ percentage: 0, used: '0 MB' });
  const [contentTotals, setContentTotals] = useState({
    articles: 0,
    pages: 0,
  });
  const [contentTotalsLoading, setContentTotalsLoading] = useState({
    articles: true,
    pages: true,
  });
  const [days, setDays] = useState(7);
  const [chartData, setChartData] = useState<{ name: string; views: number }[]>([]);
  const navigate = useNavigate();

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

  // Database Status
  const [dbStatus, setDbStatus] = useState<{ needs_repair: boolean; details: string[] } | null>(
    null
  );

  useEffect(() => {
    if (currentUser?.role?.toLowerCase() === 'admin') {
      vonFetch(API.checkDbStatus)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.needs_repair) {
            setDbStatus({ needs_repair: true, details: data.details || [] });
          }
        })
        .catch((err) => console.error('DB Status Check Failed', err));
    }
  }, [currentUser]);

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
    if (currentUser?.role?.toLowerCase() !== 'admin') return;

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

  // Check for updates on mount (Admin only)
  useEffect(() => {
    if (currentUser?.role?.toLowerCase() === 'admin') {
      checkForUpdates();
    }
  }, [currentUser]);

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

  // Fetch real storage and analytics data
  useEffect(() => {
    // Fetch storage (Staff only)
    const role = currentUser?.role?.toLowerCase();
    if (['admin', 'root', 'moderator', 'writer'].includes(role || '')) {
      vonFetch(API.getStorage)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStorageData({
              percentage: data.storage.percentage,
              used: data.storage.used,
            });
          }
        })
        .catch(() => setStorageData({ percentage: 0, used: '0 MB' }));
    }

    // Fetch analytics
    vonFetch(`${API.trackVisit}?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.analytics?.daily) {
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

          const dailyMap = new Map(data.analytics.daily.map((d: any) => [d.visit_date, d.visits]));

          const formatted = dateRange.map((dateStr) => {
            const d = new Date(dateStr);
            const label =
              days === 7
                ? daysShort[d.getDay()]
                : `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

            return {
              name: label,
              views: parseInt(dailyMap.get(dateStr) as string) || 0,
            };
          });

          setChartData(formatted);
        } else {
          setChartData(getDefaultChart());
        }
      })
      .catch(() => setChartData(getDefaultChart()));
  }, [days]);

  const getDefaultChart = () => [
    { name: 'Mon', views: 0 },
    { name: 'Tue', views: 0 },
    { name: 'Wed', views: 0 },
    { name: 'Thu', views: 0 },
    { name: 'Fri', views: 0 },
    { name: 'Sat', views: 0 },
    { name: 'Sun', views: 0 },
  ];

  // Calculate Recent Activity from Posts
  const recentActivity = useMemo(() => {
    const activity: { text: string; time: string; icon: React.ReactNode; color: string }[] = [];

    // Add recent posts
    posts.slice(0, 5).forEach((post) => {
      activity.push({
        text: `New Article: ${post.title.substring(0, 20)}...`,
        time: post.updatedAt || 'Recently',
        icon: <FileText size={14} />,
        color: 'text-blue-500 bg-blue-100',
      });
    });

    // Add system update (static for now)
    activity.push({
      text: `System Updated to v${pkg.version}`,
      time: 'System Stable',
      icon: <Server size={14} />,
      color: 'text-green-500 bg-green-100',
    });

    return activity;
  }, [posts]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* System Status Banner */}
      <div className="bg-[#1a1b26] rounded-2xl p-6 text-white shadow-sm border border-white/10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-bold mb-1">VonCMS Core System</h2>
            <p className="text-slate-400 text-sm">
              Platform Version {pkg.version}{' '}
              {serverInfo?.phpVersion && <>&bull; PHP {serverInfo.phpVersion} </>}
              &bull; Build Stable
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <span className="font-mono text-sm font-bold text-green-400">SYSTEM ONLINE</span>
          </div>
        </div>
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

      {/* Database Repair Warning Standardized */}
      {dbStatus?.needs_repair && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm animate-fade-in mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-full text-red-600 dark:text-red-400">
                <Server size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-300">
                  Database Schema Update Required
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 max-w-2xl mt-1">
                  Your database schema is outdated and missing critical tables for v{pkg.version}.
                  Features like <strong>Redirect Manager</strong> and <strong>Smart Slugs</strong>{' '}
                  are currently disabled.
                </p>
                {dbStatus.details && dbStatus.details.length > 0 && (
                  <ul className="mt-2 text-xs text-red-500 list-disc ml-4 opacity-80">
                    {dbStatus.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/settings?tab=tools')}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw size={18} />
              Open Schema Repair
            </button>
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
          title="Storage"
          value={`${storageData.percentage}%`}
          icon={<HardDrive size={24} />}
          color="bg-amber-50 text-amber-600 dark:bg-amber-900/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#16161e]/50 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Visitor Traffic</h3>
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
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  }}
                  cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }}
                />
                <Bar dataKey="views" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white dark:bg-[#16161e]/50 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-0 flex-grow">
            {recentActivity.slice(0, 4).map((log, i) => (
              <div
                key={i}
                className="flex gap-3 items-start border-b border-slate-100 dark:border-white/10 py-4 last:border-0 hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50 transition-colors px-2 rounded-lg -mx-2"
              >
                <div className={`mt-0.5 p-1.5 rounded-full ${log.color} dark:bg-opacity-10`}>
                  {log.icon}
                </div>
                <div>
                  <p
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.text) }}
                  />
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Clock size={10} /> {log.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAuditLog(true)}
            className="mt-4 w-full py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a2b36] rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a1b26] transition-colors"
          >
            View Full Audit Logs
          </button>
        </div>
      </div>

      {/* Audit Log Modal */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white dark:bg-[#16161e] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="text-primary-500" /> System Audit Logs
              </h2>
              <button
                onClick={() => setShowAuditLog(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-[#1a1b26] rounded-full transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((log, i) => (
                  <div
                    key={i}
                    className="flex gap-4 items-start p-4 bg-slate-50 dark:bg-[#1a1b26]/50 rounded-xl border border-slate-100 dark:border-white/10"
                  >
                    <div className={`p-2 rounded-lg ${log.color} bg-opacity-20`}>{log.icon}</div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <p
                          className="font-semibold text-slate-800 dark:text-slate-200"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.text) }}
                        />
                        <span className="text-xs font-mono text-slate-400 bg-slate-200 dark:bg-[#1a1b26] px-2 py-1 rounded">
                          {log.time}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Action performed by System/Admin.
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No audit logs found.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#16161e]/50 flex justify-end">
              <button
                onClick={() => setShowAuditLog(false)}
                className="px-4 py-2 bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VpDashboard;
