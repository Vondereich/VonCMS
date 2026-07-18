import React, { useState, useEffect, useMemo } from 'react';
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
  BarChart,
  Bar,
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
}

const COLORS = {
  login_failed: '#eab308', // Yellow
  honeypot_caught: '#ef4444', // Red
  rate_limited: '#f97316', // Orange
  csrf_failed: '#a855f7', // Purple
  suspicious: '#3b82f6', // Blue
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

  const fetchData = async (isRefresh = false, overrides: SecurityLogQueryOverrides = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const requestedPage = overrides.page ?? page;
      const requestedType = overrides.filterType ?? filterType;
      const requestedSeverity = overrides.filterSeverity ?? filterSeverity;
      const requestedSearch = overrides.searchQuery ?? searchQuery;
      const queryParams = new URLSearchParams({
        page: requestedPage.toString(),
        limit: '20',
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
          setStats(data.stats);
        }
      } else {
        // SECTION I: Auto-Create Table Logic
        if (
          data.message &&
          (data.message.includes('no such table') || data.message.includes("doesn't exist"))
        ) {
          try {
            const createRes = await vonFetch(API.createSecurityTable, {
              method: 'POST',
            });
            const createData = await createRes.json();
            if (createData.success) {
              toast.success('Security database initialized! Refreshing...');
              // Retry fetch with refresh mode (smoother UX)
              setTimeout(() => fetchData(true, overrides), 1500);
              return;
            } else {
              toast.error('Failed to initialize security database');
            }
          } catch (e) {
            console.error('Failed to auto-create table', e);
            toast.error('Failed to connect to security setup');
          }
        }
        toast.error(data.message || 'Failed to load security logs');
      }
    } catch (error) {
      console.error('Security fetch error:', error);
      toast.error('Failed to connect to security server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, filterType, filterSeverity]); // Search triggered manually or debounced (manual for now)

  // Auto-refresh live logs every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [page, filterType, filterSeverity, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (page === 1) {
      fetchData(false, { page: 1, searchQuery });
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
  const trendData = useMemo(() => {
    if (!stats?.trends) return [];

    // Group by date
    const grouped: any = {};
    stats.trends.forEach((item) => {
      const date = new Date(item.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      if (!grouped[date]) grouped[date] = { name: date };
      grouped[date][item.event_type] = item.count;
    });

    return Object.values(grouped);
  }, [stats]);

  const pieData = useMemo(() => {
    if (!stats?.distribution) return [];
    return stats.distribution.map((item) => ({
      name: item.event_type.replace('_', ' ').toUpperCase(),
      value: item.count,
      color: COLORS[item.event_type as keyof typeof COLORS] || '#888',
    }));
  }, [stats]);

  const barData = useMemo(() => {
    if (!stats?.top_ips) return [];
    return stats.top_ips.map((item) => ({
      name: item.ip_address,
      attempts: item.count,
    }));
  }, [stats]);

  return (
    <div className="space-y-6 animate-fade-in p-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <ShieldCheck className="text-green-500" /> Security Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Real-time threat monitoring and block logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPrimaryAdmin && (
            <div className="flex items-center gap-2 relative">
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
                        toast.success('Old logs purged!');
                        fetchData(true);
                      } else {
                        toast.error(data.message || 'Failed to purge logs');
                      }
                    } catch (e) {
                      toast.error('Failed to purge logs');
                    }
                  }
                }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1b26] dark:hover:bg-[#242633] text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                title="Purge logs older than 30 days"
              >
                <RefreshCw size={14} /> Maintenance
              </button>

              {/* DANGER ZONE DROPDOWN */}
              <button
                onClick={() => setShowDangerZone(!showDangerZone)}
                className={`p-1.5 rounded-lg transition-colors ${showDangerZone ? 'bg-red-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1a1b26] text-slate-400'}`}
              >
                <Settings size={18} />
              </button>

              {showDangerZone && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#16161e] border border-red-200 dark:border-red-900 shadow-xl rounded-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
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
                            fetchData(true);
                          } else {
                            toast.error(data.message || 'Failed to reset logs');
                          }
                        } catch (e) {
                          toast.error('Failed to reset logs');
                        }
                      }
                    }}
                    className="w-full flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 px-2 py-2 rounded-lg text-xs font-bold transition-colors"
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
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1b26] dark:hover:bg-[#242633] text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
          <span className="flex items-center gap-2 text-xs font-mono bg-slate-100 dark:bg-[#1a1b26] px-3 py-1.5 rounded-full text-slate-500">
            <span
              className={`w-2 h-2 rounded-full ${refreshing ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}
            ></span>
            {refreshing ? 'LIVE' : 'AUTO-UPDATE'}
          </span>
          <button
            onClick={() => fetchData(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#1a1b26] rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Top Attacker IP"
          value={stats?.top_attacker || 'None'}
          icon={<AlertOctagon size={24} />}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          isText
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart - Trends */}
        <div className="lg:col-span-2 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">
            Threat Trends (Last 7 Days)
          </h3>
          <div className="h-64 w-full">
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
                <Line
                  type="monotone"
                  dataKey="login_failed"
                  stroke={COLORS.login_failed}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="honeypot_caught"
                  stroke={COLORS.honeypot_caught}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rate_limited"
                  stroke={COLORS.rate_limited}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Distribution */}
        <div className="bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
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

      {/* Charts Row 2 - Top Attackers */}
      <div className="bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Top 10 Source IPs</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                strokeOpacity={0.1}
              />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={110}
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="attempts" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Logs Table */}
      <div className="bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row justify-between gap-4">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-blue-500" /> Live Security Event Log
          </h3>

          <form onSubmit={handleSearch} className="flex gap-2 text-sm">
            <div className="relative">
              <input
                aria-label="Search IP or endpoint..."
                id="search-ip-or-endpoint"
                name="searchIpOrEndpoint"
                type="text"
                placeholder="Search IP or endpoint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
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
              className="bg-slate-50 dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg px-3 py-1.5 outline-none"
            >
              <option value="">All Events</option>
              {Object.keys(COLORS).map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-700 px-2"
            >
              <X size={16} />
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
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
                        <span className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded text-xs font-bold border border-red-100 dark:border-red-800">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-0.5 rounded text-xs font-bold border border-yellow-100 dark:border-yellow-800">
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
  <div className="bg-white dark:bg-[#16161e] border border-slate-200 dark:border-white/10 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
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
