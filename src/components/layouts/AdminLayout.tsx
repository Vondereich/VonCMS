import React, { useState, useEffect, useRef } from 'react';
import Gravatar from 'react-gravatar';
import { useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API } from '../../config/site.config';
import { vonFetch } from '../../utils/api';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Image,
  Package,
  Settings,
  Database,
  LogOut,
  Menu,
  Sun,
  Moon,
  Search,
  Bell,
  Globe,
  Mail,
  Newspaper,
  Layers,
  Shield,
  FileStack,
  PanelsTopLeft,
} from 'lucide-react';
import { VonLogo } from '../VonLogo';
import { SiteSettings, User } from '../../types';

interface AdminLayoutProps {
  children: React.ReactNode;
  settings: SiteSettings;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  user?: User | null;
}

interface AdminMenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  color: string;
  allowedRoles: string[];
  requiresPrimaryAdmin?: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  settings,
  onLogout,
  isDarkMode,
  toggleDarkMode,
  user,
}) => {
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { label: string; path: string; icon: React.ReactNode }[]
  >([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [dbAlert, setDbAlert] = useState<{ needsRepair: boolean; details: string[] } | null>(null);
  const [alertsCheckedAt, setAlertsCheckedAt] = useState<number | null>(null);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsRefreshTick, setAlertsRefreshTick] = useState(0);
  const alertsTrayRef = useRef<HTMLDivElement | null>(null);
  const integrityReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuItems: AdminMenuItem[] = [
    {
      icon: <LayoutDashboard size={20} />,
      label: 'Dashboard',
      path: '/admin/dashboard',
      color: '#818cf8', // Indigo 400
      allowedRoles: ['Admin', 'Moderator', 'Writer'],
    },
    {
      icon: <FileText size={20} />,
      label: 'Posts',
      path: '/admin/posts',
      color: '#38bdf8', // Sky 400
      allowedRoles: ['Admin', 'Moderator', 'Writer'],
    },
    {
      icon: <FileStack size={20} />,
      label: 'Pages',
      path: '/admin/pages',
      color: '#34d399', // Emerald 400
      allowedRoles: ['Admin', 'Moderator'],
    },
    {
      icon: <Image size={20} />,
      label: 'Gallery',
      path: '/admin/gallery',
      color: '#fb7185', // Rose 400
      allowedRoles: ['Admin', 'Moderator', 'Writer'],
      requiresPrimaryAdmin: true,
    },
    {
      icon: <Mail size={20} />,
      label: 'Contact',
      path: '/admin/contact',
      color: '#fb923c', // Orange 400
      allowedRoles: ['Admin'],
    },
    {
      icon: <Newspaper size={20} />,
      label: 'Newsletter',
      path: '/admin/newsletter',
      color: '#a78bfa', // Violet 400
      allowedRoles: ['Admin'],
    },
    {
      icon: <MessageSquare size={20} />,
      label: 'Comments',
      path: '/admin/discussion',
      color: '#c084fc', // Purple 400
      allowedRoles: ['Admin', 'Moderator'],
    },
    {
      icon: <Users size={20} />,
      label: 'Users',
      path: '/admin/users',
      color: '#22d3ee', // Cyan 400
      allowedRoles: ['Admin'],
    },
    {
      icon: <PanelsTopLeft size={20} />,
      label: 'Widgets',
      path: '/admin/widgets',
      color: '#60a5fa', // Blue 400
      allowedRoles: ['Admin'],
      requiresPrimaryAdmin: true,
    },
    {
      icon: <Package size={20} />,
      label: 'Extensions',
      path: '/admin/extensions',
      color: '#f43f5e', // Rose 500
      allowedRoles: ['Admin'],
    },
    {
      icon: <Shield size={20} />,
      label: 'Security',
      path: '/admin/security',
      color: '#f87171', // Red 400
      allowedRoles: ['Admin'],
    },
    {
      icon: <Settings size={20} />,
      label: 'Settings',
      path: '/admin/settings',
      color: '#94a3b8', // Slate 400
      allowedRoles: ['Admin'],
    },
    {
      icon: <Database size={20} />,
      label: 'Database',
      path: '/admin/database',
      color: '#4ade80', // Green 400
      allowedRoles: ['Admin'],
      requiresPrimaryAdmin: true,
    },
  ];

  // Inject Von Designer menu item if plugin is active
  if (settings?.activePlugins?.includes('von-designer')) {
    // Insert before "Users" or "Extensions" usually
    // Let's put it after "Comments" (index 6) or before "Users"
    menuItems.splice(7, 0, {
      icon: <Layers size={20} />,
      label: 'Designer',
      path: '/admin/designer', // Dashboard view for Designer
      color: '#2dd4bf', // Teal 400
      allowedRoles: ['Admin', 'Moderator'],
    });
  }

  // Filter menu items based on user role - Case Insensitive
  const rawUserRole = (user?.role || 'Writer').toLowerCase();
  const userRole = rawUserRole === 'root' ? 'admin' : rawUserRole;
  const isPrimaryAdmin = rawUserRole === 'root' || String(user?.id || '') === '1';
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.requiresPrimaryAdmin && !isPrimaryAdmin) return false;
    if (item.path === '/admin/database' && !isPrimaryAdmin) return false;
    return item.allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
  });
  const hasIntegrityAlert = !!settings?._serverInfo?.integrityNeeded;

  const alertItems = [
    ...(hasIntegrityAlert
      ? [
          {
            id: 'integrity',
            title: 'Integrity repair needed',
            body: 'Server integrity or rewrite rules need attention before admin tools are fully healthy.',
            actionLabel: 'Open repair tools',
            actionPath: '/admin/settings?tab=tools',
          },
        ]
      : []),
    ...(dbAlert?.needsRepair
      ? [
          {
            id: 'db-repair',
            title: 'Database schema update required',
            body: 'Your database schema is missing required structures for the current release.',
            actionLabel: 'Open repair tools',
            actionPath: '/admin/settings?tab=tools',
          },
        ]
      : []),
  ];
  const hasActiveAlerts = alertItems.length > 0;
  const alertsCheckedLabel =
    alertsCheckedAt === null
      ? userRole === 'admin'
        ? 'Checking system status...'
        : 'Current session status'
      : Date.now() - alertsCheckedAt < 60_000
        ? 'Checked just now'
        : 'Checked earlier this session';

  // Update document title based on current route
  useEffect(() => {
    const currentItem = menuItems.find((item) => pathname.startsWith(item.path));
    const pageName = currentItem?.label || 'Admin';
    const siteName = settings?.siteName || 'Admin';
    document.title = `${pageName} - ${siteName} Admin`;
  }, [pathname, settings?.siteName]);

  // Proactive Integrity Warning - Admin Layout Only
  useEffect(() => {
    // Role check is redundant (AdminLayout is protected), but good for safety
    if (settings?._serverInfo?.integrityNeeded) {
      toast(
        (t) => (
          <span className="flex flex-col gap-1">
            <span className="font-bold text-red-500">System Integrity Warning!</span>
            <span className="text-sm">Critical .htaccess protection files need attention.</span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  const loadingId = toast.loading('Repairing .htaccess...');
                  try {
                    const res = await vonFetch(API.repairHtaccess, { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      if (data.changesApplied) {
                        toast.success('Website routing repaired! Reloading...', { id: loadingId });
                        integrityReloadTimerRef.current = setTimeout(
                          () => window.location.reload(),
                          1500
                        );
                      } else {
                        toast.success(data.message || 'No .htaccess changes were needed.', {
                          id: loadingId,
                        });
                      }
                    } else {
                      toast.error(data.error || data.message || 'Failed to repair .htaccess.', {
                        id: loadingId,
                      });
                    }
                  } catch (err) {
                    toast.error('System error occurred.', { id: loadingId });
                  }
                }}
                className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Repair .htaccess Now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="mt-2 bg-slate-200 dark:bg-[#242633] text-slate-800 dark:text-slate-200 px-3 py-1 rounded text-xs font-semibold hover:bg-slate-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </span>
        ),
        {
          id: 'integrity-warning',
          duration: Infinity, // Persistent until fix
          icon: '⚠️',
          position: 'top-center',
          style: {
            border: '2px solid #ef4444',
            padding: '16px',
            color: '#333',
            background: '#fff',
          },
        }
      );
    }

    return () => {
      if (integrityReloadTimerRef.current) {
        clearTimeout(integrityReloadTimerRef.current);
        integrityReloadTimerRef.current = null;
      }
      toast.dismiss('integrity-warning');
    };
  }, [settings?._serverInfo?.integrityNeeded]);

  useEffect(() => {
    if (userRole !== 'admin') return;

    let active = true;
    setAlertsLoading(true);

    vonFetch(API.checkDbStatus)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;

        if (data.success && data.needs_repair) {
          setDbAlert({
            needsRepair: true,
            details: Array.isArray(data.details) ? data.details : [],
          });
        } else {
          setDbAlert({ needsRepair: false, details: [] });
        }

        setAlertsLoaded(true);
        setAlertsCheckedAt(Date.now());
      })
      .catch(() => {
        if (!active) return;
        setDbAlert({ needsRepair: false, details: [] });
        setAlertsLoaded(true);
        setAlertsCheckedAt(Date.now());
      })
      .finally(() => {
        if (active) setAlertsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userRole, alertsRefreshTick]);

  useEffect(() => {
    if (!isAlertsOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        alertsTrayRef.current &&
        event.target instanceof Node &&
        !alertsTrayRef.current.contains(event.target)
      ) {
        setIsAlertsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAlertsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAlertsOpen]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 0) {
      const results = filteredMenuItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleResultClick = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'dark bg-[#16161e] text-slate-300' : 'bg-slate-50 text-slate-900'}`}
    >
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} 
                relative z-20 transition-all duration-300 ease-in-out
                bg-[#1a1b26] border-r border-white/10 flex flex-col text-slate-300 shadow-2xl`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="text-blue-600 dark:text-blue-400">
                <VonLogo variant="simple" className="w-8 h-8" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-white">
                VonCMS Panel
              </span>
            </div>
          ) : (
            <VonLogo variant="simple" className="w-7 h-7 text-blue-400" />
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                                    ${
                                      isActive
                                        ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/20'
                                        : 'text-slate-400 hover:bg-[#1a1b26] hover:text-white'
                                    }
                                `}
                title={!isSidebarOpen ? item.label : ''}
              >
                <div
                  className={`${isActive ? 'animate-pulse-slow' : 'group-hover:scale-110 transition-transform'}`}
                  style={!isActive ? { color: item.color } : {}}
                >
                  {item.icon}
                </div>
                <span
                  className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}
                >
                  {item.label}
                </span>
                {isActive && isSidebarOpen && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Snippet (Bottom) */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-[#1a1b26] hover:text-white transition-colors text-sm ${!isSidebarOpen && 'justify-center'}`}
            title="Visit Site"
          >
            <Globe size={18} />
            <span className={`${!isSidebarOpen && 'hidden'}`}>Visit Site</span>
          </Link>
          <button
            onClick={onLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-400 hover:bg-[#1a1b26] hover:text-red-300 transition-colors text-sm ${!isSidebarOpen && 'justify-center'}`}
            title="Logout"
          >
            <LogOut size={18} />
            <span className={`${!isSidebarOpen && 'hidden'}`}>Logout</span>
          </button>

          <div
            className={`flex items-center gap-3 pt-2 mt-2 border-t border-white/10 ${!isSidebarOpen && 'justify-center'}`}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#1a1b26] shadow-md object-cover"
              />
            ) : (
              <Gravatar
                email={user?.email || user?.username}
                size={32}
                default="identicon"
                className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-[#1a1b26] shadow-md object-cover"
              />
            )}
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">
                  {user?.username || 'Admin'}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.role || 'Administrator'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Top Header */}
        <header
          className="h-16 px-6 flex items-center justify-between 
                    bg-white/90 dark:bg-[#1a1b26]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 sticky top-0 z-30 shadow-sm dark:shadow-slate-900/10"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] transition-colors"
            >
              {isSidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
            </button>

            {/* Search Bar - Glassy */}
            <div className="hidden md:flex items-center relative group">
              <label htmlFor="admin-global-search" className="sr-only">
                Search admin navigation
              </label>
              <Search
                size={16}
                className="absolute left-3 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              />
              <input
                id="admin-global-search"
                name="adminGlobalSearch"
                type="text"
                placeholder="Search admin..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36]/50 focus:border-blue-500 dark:focus:border-blue-500 rounded-full text-sm outline-none transition-all w-64 focus:w-80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
              />
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1b26] rounded-xl shadow-xl border border-slate-100 dark:border-[#2a2b36] overflow-hidden py-2 z-50">
                  <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Navigation
                  </div>
                  {searchResults.map((result) => (
                    <Link
                      key={result.path}
                      to={result.path}
                      onClick={() => handleResultClick()}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#242633]/50 transition-colors text-sm text-slate-700 dark:text-slate-200"
                    >
                      <div className="text-slate-400 dark:text-slate-500">{result.icon}</div>
                      {result.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] transition-colors"
            >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            </button>

            <div ref={alertsTrayRef} className="relative">
              <button
                onClick={() => setIsAlertsOpen((prev) => !prev)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26] transition-colors relative"
                aria-label="Open system alerts"
                aria-expanded={isAlertsOpen}
              >
                <Bell size={20} />
                {hasActiveAlerts && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#16161e]"></span>
                )}
              </button>

              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1a1b26] rounded-xl shadow-xl border border-slate-100 dark:border-[#2a2b36] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2a2b36] flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        System Alerts
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {alertsCheckedLabel}
                      </p>
                    </div>
                    {userRole === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setAlertsRefreshTick((prev) => prev + 1)}
                        disabled={alertsLoading}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-500 disabled:opacity-50 disabled:cursor-not-allowed dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                      >
                        Refresh
                      </button>
                    )}
                  </div>

                  <div className="p-3 space-y-3">
                    {alertsLoading && !alertsLoaded ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Checking system status...
                      </p>
                    ) : hasActiveAlerts ? (
                      alertItems.map((alert) => (
                        <Link
                          key={alert.id}
                          to={alert.actionPath}
                          onClick={() => setIsAlertsOpen(false)}
                          className="block rounded-lg border border-slate-200 dark:border-[#2a2b36] p-3 hover:bg-slate-50 dark:hover:bg-[#242633]/40 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {alert.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {alert.body}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                            {alert.actionLabel}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          No active system alerts
                        </p>
                        <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-300/80">
                          {alertsCheckedLabel}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-[#242633] mx-1"></div>
          </div>
        </header>

        {/* Content Scroller */}
        <div className="flex-1 overflow-auto p-6 relative">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
