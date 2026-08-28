import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Search,
  RefreshCw,
  X,
  AlertOctagon,
  Download,
  Settings,
  Trash2,
} from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import toast from 'react-hot-toast';

interface SecurityLog {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string;
  endpoint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  blocked: number;
  created_at: string;
}

interface SecurityStats {
  blocked_today: number;
  active_last_hour: number;
  high_severity_today: number;
  top_attacker: string;
  trends: { date: string; event_type: string; count: number }[];
  distribution: { event_type: string; count: number }[];
  top_ips: { ip_address: string; count: number }[];
}

interface SecurityDashboardProps {
  isPrimaryAdmin: boolean;
}

interface SecurityLogQueryOverrides {
  page?: number;
  filterType?: string;
  filterSeverity?: string;
  searchQuery?: string;
  includeStats?: boolean;
}

interface PendingSecurityFetch {
  isRefresh: boolean;
  overrides: SecurityLogQueryOverrides;
}

const COLORS: Record<string, string> = {
  login_failed: '#eab308', // Yellow
  honeypot_caught: '#ef4444', // Red
  rate_limited: '#f97316', // Orange
  csrf_failed: '#a855f7', // Purple
  suspicious: '#3b82f6', // Blue
  remember_rotation_conflict: '#06b6d4', // Cyan
};

const FALLBACK_EVENT_COLORS = ['#64748b', '#14b8a6', '#ec4899', '#8b5cf6', '#0ea5e9'];
const SECURITY_STATS_TTL_MS = 60000;

const formatEventType = (eventType: string) =>
  eventType
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const getEventColor = (eventType: string, index: number) => {
  if (COLORS[eventType]) return COLORS[eventType];
  const colorSeed = Array.from(eventType).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    index
  );
  return FALLBACK_EVENT_COLORS[colorSeed % FALLBACK_EVENT_COLORS.length];
};

const normalizeChartCount = (value: unknown) => {
  const numericCount = Number(value);
  return Number.isFinite(numericCount) ? Math.max(0, numericCount) : 0;
};

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ isPrimaryAdmin }) => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDangerZone, setShowDangerZone] = useState(false);
  const fetchInFlightRef = useRef(false);
  const pendingFetchRef = useRef<PendingSecurityFetch | null>(null);
  const statsFetchedAtRef = useRef(0);

  const fetchData = async (isRefresh = false, overrides: SecurityLogQueryOverrides = {}) => {
    if (fetchInFlightRef.current) {
      pendingFetchRef.current = { isRefresh, overrides };
      return;
    }
    fetchInFlightRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const requestedPage = overrides.page ?? page;
      const requestedType = overrides.filterType ?? filterType;
      const requestedSeverity = overrides.filterSeverity ?? filterSeverity;
      const requestedSearch = overrides.searchQuery ?? searchQuery;
      const shouldIncludeStats =
        overrides.includeStats === true ||
        (requestedPage === 1 &&
          (statsFetchedAtRef.current === 0 ||
            Date.now() - statsFetchedAtRef.current >= SECURITY_STATS_TTL_MS));
      const queryParams = new URLSearchParams({
        page: requestedPage.toString(),
        limit: '20',
        include_stats: shouldIncludeStats ? '1' : '0',
        ...(requestedType && { event_type: requestedType }),
        ...(requestedSeverity && { severity: requestedSeverity }),
        ...(requestedSearch && { search: requestedSearch }),
      });

      const res = await vonFetch(`${API.securityLogs}?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs);
        setTotalPages(data.pagination.total_pages);
        setTotalItems(data.pagination.total_items);
        if (data.stats && Object.keys(data.stats).length > 0) {
          statsFetchedAtRef.current = Date.now();
          setStats(data.stats);
        }
      } else {
        if (
          data.message &&
          (data.message.includes('no such table') || data.message.includes("doesn't exist"))
        ) {
          toast.error('Security storage requires Database Repair in Settings > Tools.');
          return;
        }
        toast.error(data.message || 'Failed to load security logs');
      }
    } catch (error) {
      console.error('Security fetch error:', error);
      toast.error('Failed to connect to security server');
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      const pendingFetch = pendingFetchRef.current;
      if (pendingFetch) {
        pendingFetchRef.current = null;
        void fetchData(pendingFetch.isRefresh, pendingFetch.overrides);
      }
    }
  };

  useEffect(() => {
    fetchData(false, { page, filterType, filterSeverity, searchQuery });
  }, [page, filterType, filterSeverity]); // Search triggered manually or debounced (manual for now)

  // Keep the monitor fresh without stacking requests or polling a hidden tab.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData(true, { page, filterType, filterSeverity, searchQuery });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [page, filterType, filterSeverity, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (page === 1) {
      fetchData(false, { page: 1, filterType, filterSeverity, searchQuery });
    }
  };

  const clearFilters = () => {
    const dependencyWillChange = page !== 1 || filterType !== '' || filterSeverity !== '';
    setFilterType('');
    setFilterSeverity('');
    setSearchQuery('');
    setPage(1);
    if (!dependencyWillChange) {
      fetchData(false, {
        page: 1,
        filterType: '',
        filterSeverity: '',
        searchQuery: '',
      });
    }
  };

  // Process Chart Data
  const { trendData, trendSeries, trendTotal } = useMemo(() => {
    const dateRange: string[] = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - dayOffset);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateRange.push(`${year}-${month}-${day}`);
    }

    const series = Array.from(
      new Set((stats?.trends || []).map((item) => String(item.event_type || '').trim()))
    ).filter(Boolean);
    const grouped = new Map<string, Record<string, string | number>>(
      dateRange.map((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        return [
          dateKey,
          {
            name: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          },
        ];
      })
    );

    let total = 0;
    (stats?.trends || []).forEach((item) => {
      const dateKey = String(item.date || '').slice(0, 10);
      const eventType = String(item.event_type || '').trim();
      const count = normalizeChartCount(item.count);
      const row = grouped.get(dateKey);
      if (!row || !eventType) return;
      row[eventType] = count;
      total += count;
    });

    const data = Array.from(grouped.values()).map((row) => {
      series.forEach((eventType) => {
        if (typeof row[eventType] !== 'number') row[eventType] = 0;
      });
      return row;
    });

    return { trendData: data, trendSeries: series, trendTotal: total };
  }, [stats]);

  const pieData = useMemo(() => {
    if (!stats?.distribution) return [];
    return stats.distribution
      .map((item, index) => ({
        name: formatEventType(item.event_type),
        value: normalizeChartCount(item.count),
        color: getEventColor(item.event_type, index),
      }))
      .filter((item) => item.value > 0);
  }, [stats]);

  const sourceData = useMemo(() => {
    if (!stats?.top_ips) return [];
    return stats.top_ips.slice(0, 10).map((item, index) => ({
      rank: index + 1,
      address: item.ip_address,
      attempts: normalizeChartCount(item.count),
      isLocalhost: item.ip_address === '::1' || item.ip_address === '127.0.0.1',
    }));
  }, [stats]);
  const highestSourceCount = Math.max(1, ...sourceData.map((item) => item.attempts));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <ShieldCheck className="text-green-500" /> Security Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Real-time threat monitoring and block logs
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {isPrimaryAdmin && (
            <div className="relative flex items-center gap-2">
              {/* MAINTENANCE BUTTON (PURGE OLD) */}
              <button
                onClick={async () => {
                  if (
                    window.confirm(
                      'Clean old logs? This will ONLY remove items older than 30 days to save space.'
                    )
                  ) {
                    try {
                      const res = await vonFetch(`${API.clearSecurityLogs}?mode=purge`, {
                        method: 'POST',
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast.success(data.message || 'Security log maintenance completed.');
                        fetchData(true, { includeStats: true });
                      } else {
                        toast.error(data.message || 'Failed to purge logs');
                      }
                    } catch (e) {
                      toast.error('Failed to purge logs');
                    }
                  }
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#1a1b26] dark:text-slate-300 dark:hover:bg-[#242633]"
                title="Purge logs older than 30 days"
              >
                <RefreshCw size={14} /> Maintenance
              </button>

              {/* DANGER ZONE DROPDOWN */}
              <button
                onClick={() => setShowDangerZone(!showDangerZone)}
                className={`flex size-11 items-center justify-center rounded-lg transition-colors ${showDangerZone ? 'bg-red-500 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1b26]'}`}
                aria-label="Toggle security danger zone"
              >
                <Settings size={18} />
              </button>

              {showDangerZone && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute top-full left-0 z-50 mt-2 w-52 rounded-xl border border-red-200 bg-white p-2 shadow-xl dark:border-red-900 dark:bg-[#16161e] sm:right-0 sm:left-auto">
                  <p className="text-[10px] font-bold text-red-500 px-2 py-1 uppercase tracking-wider">
                    Danger Zone
                  </p>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          'CRITICAL: Clear ALL logs and reset all statistics to zero? This cannot be undone.'
                        )
                      ) {
                        try {
                          const res = await vonFetch(`${API.clearSecurityLogs}?mode=full`, {
                            method: 'POST',
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast.success('Full reset complete!');
                            setShowDangerZone(false);
                            fetchData(true, { includeStats: true });
                          } else {
                            toast.error(data.message || 'Failed to reset logs');
                          }
                        } catch (e) {
                          toast.error('Failed to reset logs');
                        }
                      }
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} /> Reset All Data
                  </button>
                </div>
              )}

              <div className="h-6 w-px bg-slate-200 dark:bg-[#1a1b26] mx-1"></div>
            </div>
          )}
          <button
            onClick={() => {
              const queryParams = new URLSearchParams({
                format: 'csv',
                ...(filterType && { event_type: filterType }),
                ...(filterSeverity && { severity: filterSeverity }),
                ...(searchQuery && { search: searchQuery }),
              });
              window.open(`${API.securityLogs}?${queryParams}`, '_blank');
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#1a1b26] dark:text-slate-300 dark:hover:bg-[#242633]"
          >
            <Download size={14} /> Export CSV
          </button>
          <span className="flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-500 dark:bg-[#1a1b26]">
            <span
              className={`w-2 h-2 rounded-full ${refreshing ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}
            ></span>
            {refreshing ? 'LIVE' : 'AUTO-UPDATE'}
          </span>
          <button
            onClick={() => fetchData(true, { includeStats: true })}
            className="flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
            aria-label="Refresh security data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Threats Blocked Today"
          value={stats?.blocked_today || 0}
          icon={<ShieldAlert size={24} />}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Active (Last Hour)"
          value={stats?.active_last_hour || 0}
          icon={<Activity size={24} />}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          animate
        />
        <StatCard
          title="High Severity Events"
          value={stats?.high_severity_today || 0}
          icon={<AlertTriangle size={24} />}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          title="Most Active Source"
          value={stats?.top_attacker || 'None'}
          icon={<AlertOctagon size={24} />}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          isText
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Line Chart - Trends */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#16161e] sm:p-5 xl:col-span-2">
          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">
            Threat Trends (Last 7 Days)
          </h3>
          <div className="h-64 w-full">
            {trendTotal > 0 && trendSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                    fontSize={12}
                    stroke="#94a3b8"
                  />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Legend iconType="circle" />
                  {trendSeries.map((eventType, index) => (
                    <Line
                      key={eventType}
                      type="monotone"
                      dataKey={eventType}
                      name={formatEventType(eventType)}
                      stroke={getEventColor(eventType, index)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                No security events recorded in the last 7 days.
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart - Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#16161e] sm:p-5">
          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">
            Attack Distribution
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    layout="vertical"
                    verticalAlign="bottom"
                    align="center"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-center text-sm">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Top source ranking */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#16161e] sm:p-5">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white">Top Source IPs</h3>
          <span className="text-xs text-slate-400">By recorded security events</span>
        </div>
        {sourceData.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {sourceData.map((source) => (
              <div
                key={`${source.address}-${source.rank}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-3"
              >
                <span className="text-sm font-semibold text-slate-400 tabular-nums">
                  {source.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span
                      className="truncate font-mono text-sm font-semibold text-slate-700 dark:text-slate-200"
                      title={source.address}
                    >
                      {source.address}
                    </span>
                    {source.isLocalhost && (
                      <span className="shrink-0 text-xs text-slate-400">Localhost</span>
                    )}
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full max-w-3xl overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${Math.max(6, (source.attempts / highestSourceCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-16 text-right">
                  <span className="block text-sm font-bold tabular-nums text-slate-800 dark:text-white">
                    {source.attempts}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {source.attempts === 1 ? 'event' : 'events'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">No source data available</div>
        )}
      </div>

      {/* Live Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[#16161e]">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 dark:border-white/10 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-blue-500" /> Live Security Event Log
          </h3>

          <form
            onSubmit={handleSearch}
            className="grid w-full grid-cols-2 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] xl:w-auto"
          >
            <div className="relative col-span-2 min-w-0 sm:col-span-1 sm:w-64">
              <input
                aria-label="Search IP or endpoint..."
                id="search-ip-or-endpoint"
                name="searchIpOrEndpoint"
                type="text"
                placeholder="Search IP or endpoint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-[#2a2b36] dark:bg-[#1a1b26]"
              />
              <Search className="absolute left-2.5 top-1.5 text-slate-400" size={14} />
            </div>

            <select
              id="securitydashboard-470"
              name="securitydashboard470"
              aria-label="Selection"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 outline-hidden dark:border-[#2a2b36] dark:bg-[#1a1b26]"
            >
              <option value="">All Events</option>
              {Object.keys(COLORS).map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>

            <select
              id="security-severity"
              name="securitySeverity"
              aria-label="Severity"
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setPage(1);
              }}
              className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 outline-hidden dark:border-[#2a2b36] dark:bg-[#1a1b26]"
            >
              <option value="">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <button
              type="submit"
              className="min-h-11 rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="flex size-11 items-center justify-center rounded-lg px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5"
              aria-label="Clear security filters"
            >
              <X size={16} />
            </button>
          </form>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {loading && logs.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400">Loading security data...</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400">
              No security events found matching criteria.
            </div>
          ) : (
            logs.map((log) => (
              <article key={log.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: COLORS[log.event_type as keyof typeof COLORS] || '#888',
                      }}
                    />
                    {log.event_type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <SeverityBadge level={log.severity} />
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-slate-400">Time</dt>
                  <dd className="text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                    {new Date(log.created_at).toLocaleString()}
                  </dd>
                  <dt className="text-slate-400">IP</dt>
                  <dd className="break-all text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                    {log.ip_address}
                  </dd>
                  <dt className="text-slate-400">Endpoint</dt>
                  <dd className="break-all text-right text-slate-600 dark:text-slate-300">
                    {log.endpoint}
                  </dd>
                </dl>
                <span
                  className={`inline-flex rounded-sm border px-2 py-1 text-xs font-bold ${
                    log.blocked
                      ? 'border-red-100 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'border-yellow-100 bg-yellow-50 text-yellow-600 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}
                >
                  {log.blocked ? 'BLOCKED' : 'WARNING'}
                </span>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-220 w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#1a1b26]/50 text-slate-500 uppercase font-bold text-xs">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Event Type</th>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3">Endpoint</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading security data...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No security events found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              COLORS[log.event_type as keyof typeof COLORS] || '#888',
                          }}
                        ></span>
                        {log.event_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {log.ip_address}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                      {log.endpoint}
                    </td>
                    <td className="px-5 py-3">
                      <SeverityBadge level={log.severity} />
                    </td>
                    <td className="px-5 py-3">
                      {log.blocked ? (
                        <span className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded-sm text-xs font-bold border border-red-100 dark:border-red-800">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-0.5 rounded-sm text-xs font-bold border border-yellow-100 dark:border-yellow-800">
                          WARNING
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {/* Smart Pagination Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10">
          <SmartPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            itemsPerPage={20}
            totalItems={totalItems}
          />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  isText?: boolean;
  animate?: boolean;
}> = ({ title, value, icon, color, isText, animate }) => (
  <div className="bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 p-5 rounded-xl shadow-xs hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2.5 rounded-lg ${color} ${animate ? 'animate-pulse' : ''}`}>{icon}</div>
    </div>
    <div className="mt-2">
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
        {title}
      </p>
      <h3
        className={`font-extrabold mt-1 text-slate-800 dark:text-white ${isText ? 'text-lg font-mono' : 'text-3xl'}`}
      >
        {value}
      </h3>
    </div>
  </div>
);

const SeverityBadge: React.FC<{ level: string }> = ({ level }) => {
  const styles = {
    low: 'bg-blue-50 text-blue-600 border-blue-100',
    medium: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    high: 'bg-orange-50 text-orange-600 border-orange-100',
    critical: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${styles[level as keyof typeof styles] || styles.low}`}
    >
      {level}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1a1b26] p-4 border border-slate-200 dark:border-[#2a2b36] rounded-xl shadow-xl">
        <p className="font-bold text-slate-800 dark:text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-slate-600 dark:text-slate-300 capitalize">{entry.name}:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default SecurityDashboard;
