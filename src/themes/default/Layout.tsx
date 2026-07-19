import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Gravatar from 'react-gravatar';
import { Post, User, Comment, SiteSettings, NavItem } from '../../types';
import {
  ArrowLeft,
  User as UserIcon,
  Search,
  Menu,
  X,
  FileQuestion,
  Moon,
  Sun,
  Rss,
} from 'lucide-react';
import { ThemeLayoutProps } from '../types';
import {
  getOverflowNavigationItems,
  getVisibleNavigationItems,
  shouldUseTabletBurgerMenu,
} from '../../utils/navigation';
import { SafeImage } from '../../components/SafeImage';
import { getBasePathPrefix, getPermalink } from '../../utils/siteUtils';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import ThemeLogo from '../shared/components/ThemeLogo';

// Theme SDK
import {
  VonSEO,
  ContentRenderer,
  VpComments,
  VpSidebarWidget,
  VonNewsletter,
  ShareButtons,
  LoadMoreButton,
  VonLogo,
  usePublicProfile,
  useAdsPopup,
  useClickOutside,
  PUBLIC_SEARCH_MAX_LENGTH,
  normalizePublicSearchInput,
  usePublicPostsQuery,
  PublicDiscoverySkeleton,
  useAISummary,
  useRelatedPosts,
  formatDate,
  decodeEntities,
  ProseDarkModeStyles,
  UserProfile,
  AdBlock,
  VonPopupAd,
  sanitizeHtml,
  hasEmbeddedVideoMarkup,
  getResponsiveImageAttributes,
} from '../shared';
import { getSameSiteCategoryNavigation, normalizeSiteUrl } from '../../utils/siteUtils';

// Utility to render User Avatar
const UserAvatar: React.FC<{
  url?: string;
  name: string;
  email?: string;
  size?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ url, name, email, size = 'w-10 h-10', className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`${size} rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 flex-shrink-0 ${className} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      <SafeImage
        src={url}
        alt={name}
        className="w-full h-full object-cover"
        fallback={
          <Gravatar
            email={email || name}
            size={100}
            className="w-full h-full object-cover"
            default="identicon"
          />
        }
      />
    </div>
  );
};

// Utility for rendering ads safely (Raw HTML) using sanitizeHtml

const NavLink: React.FC<{ label: string; onClick: () => void; isActive?: boolean }> = ({
  label,
  onClick,
  isActive,
}) => (
  <button
    onClick={onClick}
    className={`relative group text-sm font-semibold tracking-wide transition-opacity py-2 uppercase ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
    style={{ color: 'inherit' }}
  >
    {label}
    <span
      className={`absolute bottom-0 left-0 h-0.5 transition-all duration-300 group-hover:w-full ${isActive ? 'w-full' : 'w-0'}`}
      style={{ backgroundColor: 'var(--color-primary)' }}
    ></span>
  </button>
);

// ===== TRENDING TICKER (Feature Parity) =====
const TrendingTicker: React.FC<{
  posts: Post[];
  onPostClick: (id: string) => void;
  isDarkMode: boolean;
  accentColor: string;
  enableMarquee?: boolean;
}> = ({ posts, onPostClick, isDarkMode, accentColor, enableMarquee = true }) => {
  if (!posts || posts.length === 0) return null;

  // Helper for contrast text (matches Digest implementation)
  const getContrastColor = (hex: string) => {
    if (!hex || hex.length < 7) return '#ffffff';
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const contrastText = getContrastColor(accentColor);

  return (
    <div
      className="py-2.5 border-b overflow-hidden relative transition-colors duration-300"
      style={{
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
        borderColor: 'rgba(128,128,128,0.1)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex items-center gap-4">
        <span
          className="font-black text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded flex-shrink-0 animate-pulse shadow-sm"
          style={{ background: accentColor, color: contrastText }}
        >
          Latest Stories
        </span>
        <div className="flex-1 overflow-hidden">
          <div
            className={`flex gap-10 whitespace-nowrap ${enableMarquee ? 'animate-marquee hover:[animation-play-state:paused]' : 'overflow-x-auto no-scrollbar'}`}
          >
            {posts.map((post) => (
              <span
                key={post.id}
                onClick={() => onPostClick(post.id)}
                className="text-sm font-bold cursor-pointer hover:opacity-70 transition-opacity flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="opacity-40" style={{ color: accentColor }}>
                  #
                </span>
                {decodeEntities(post.title)}
              </span>
            ))}
            {/* Duplicate for infinite marquee effect - only if enabled */}
            {enableMarquee &&
              posts.map((post) => (
                <span
                  key={`${post.id}-clone`}
                  onClick={() => onPostClick(post.id)}
                  className="text-sm font-bold cursor-pointer hover:opacity-70 transition-opacity flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span className="opacity-40" style={{ color: accentColor }}>
                    #
                  </span>
                  {decodeEntities(post.title)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DefaultLayout: React.FC<
  ThemeLayoutProps & {
    selectedCategory?: string | null;
    onCategoryClick?: (category: string) => void;
  }
> = ({
  posts,
  pages = [],
  user,
  comments,
  settings,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onLoadMoreComments,
  hasMoreComments,
  commentsLoading,
  commentsError,
  onNavigateAdmin,
  onLogin,
  onLogout,
  isDarkMode,
  toggleDarkMode,
  allUsers,
  onUpdateUser,
  currentView,
  selectedPost,
  selectedPage,
  selectedProfile,
  selectedCategory,
  onPostClick,
  onPageClick,
  onViewProfile,
  onBackToHome,
  onCategoryClick,
}) => {
  // Internal state for mobile menu only
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [resetKey, setResetKey] = useState(0); // Add reset key for pagination

  // Shared Hooks
  const { showPopup, closePopup } = useAdsPopup(settings.ads); // No currentView = show popup on any view
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');
  useClickOutside(
    dropdownRef,
    useCallback(() => setShowUserDropdown(false), []),
    showUserDropdown
  );

  const publishedPosts = posts.filter((p) => p.status === 'published');

  // Helpers
  const goHome = () => {
    if (onBackToHome) onBackToHome();
    setResetKey((prev) => prev + 1); // Trigger reset
  };
  const viewPost = (id: string) => onPostClick && onPostClick(id);
  const viewProfile = (username: string) => onViewProfile && onViewProfile(username);

  // Derived state for legacy support
  const isProfileRoute = currentView === 'profile';

  const handleSearch = (query: string) => setActiveSearchQuery(query);

  // Nav color: use custom color in light mode, original neutral in dark mode
  const customNavColor = settings.theme?.default?.navColor || '#171717'; // Default to Neutral 900 (Dark Header)
  const navColor = isDarkMode ? '#0a0a0a' : customNavColor; // Neutral 950 for Dark Mode

  // Auto-detect text contrast based on actual nav color being used
  const navTextColor = useMemo(() => {
    const hex = navColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#1e293b' : '#ffffff';
  }, [navColor]);

  const navigationItems = settings.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationClassName = `${
    useTabletBurgerMenu ? 'hidden lg:flex' : 'hidden md:flex'
  } items-center space-x-10`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  const rssPath = `${getBasePathPrefix()}/rss`;

  const resolveNavigationLabel = (nav: NavItem): string => {
    if (nav.label) return nav.label;
    if (nav.url.startsWith('page:')) {
      const pageId = nav.url.split(':')[1];
      const page = pages.find((item) => item.id === pageId);
      return page ? page.title || 'Untitled Page' : nav.url;
    }
    if (nav.url.startsWith('post:')) {
      const postId = nav.url.split(':')[1];
      const post = posts.find((item) => item.id === postId);
      return post ? post.title || 'Untitled' : nav.url;
    }
    return nav.url;
  };

  const handleNavigationItem = (nav: NavItem, closeMobileMenu = false) => {
    if (closeMobileMenu) setIsMobileMenuOpen(false);
    if (nav.url === 'home') return goHome();
    if (nav.url.startsWith('page:')) {
      const pageId = nav.url.split(':')[1];
      const page = pages.find((item) => item.id === pageId);
      if (onPageClick) return onPageClick(page?.slug || pageId);
      return;
    }
    if (nav.url.startsWith('post:')) {
      return viewPost(nav.url.split(':')[1]);
    }
    const categoryTarget = getSameSiteCategoryNavigation(nav.url);
    if (categoryTarget !== null && onCategoryClick) {
      return onCategoryClick(categoryTarget);
    }
    window.location.href = normalizeSiteUrl(nav.url);
  };

  return (
    <div
      className={`min-h-screen flex justify-center transition-colors duration-300 ${isDarkMode ? 'dark' : ''} bg-[var(--bg-body)] text-[var(--text-primary)]`}
      style={
        {
          '--color-primary': settings.theme.primaryColor || '#0ea5ff',
          '--bg-nav': navColor,
          '--text-nav': navTextColor,
          '--bg-body': isDarkMode ? '#0a0a0a' : '#f8fafc',
          '--bg-card': isDarkMode ? '#171717' : '#ffffff',
          '--text-primary': isDarkMode ? '#fafafa' : '#0f172a',
          '--border-color': isDarkMode ? '#262626' : '#e2e8f0',
          '--card-shadow': isDarkMode ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          fontFamily: settings.theme.fontFamily || 'Inter, sans-serif',
        } as React.CSSProperties
      }
    >
      {/* SEO Injector updates title/meta/JSON-LD for crawlers and social previews */}

      {shouldRenderVonSEO && (
        <VonSEO
          settings={settings}
          currentView={currentView}
          selectedPost={selectedPost}
          selectedPage={selectedPage}
          selectedProfile={targetProfile}
          selectedCategory={selectedCategory}
        />
      )}

      {/* Dark Mode Text Contrast Fix */}
      <ProseDarkModeStyles />
      <style>{`
                /* Dynamic Primary/Accent Color */
                .text-primary-600, .text-primary-500, .text-primary-400 { color: var(--color-primary) !important; }
                .bg-primary-600, .bg-primary-500 { background-color: var(--color-primary) !important; }
                .bg-primary-50, .bg-primary-100 { background-color: color-mix(in srgb, var(--color-primary) 10%, transparent) !important; }
                .hover\\:text-primary-600:hover, .hover\\:text-primary-400:hover { color: var(--color-primary) !important; }
                .hover\\:bg-primary-100:hover { background-color: color-mix(in srgb, var(--color-primary) 15%, transparent) !important; }
                .ring-primary-500, .focus\\:ring-primary-500:focus { --tw-ring-color: var(--color-primary) !important; }
                .shadow-primary-500\\/30 { --tw-shadow-color: var(--color-primary) !important; }
                .border-primary-400 { border-color: var(--color-primary) !important; }
            `}</style>

      <div
        className="w-full max-w-[1440px] min-h-screen flex flex-col relative bg-[var(--bg-card)] border-x border-[var(--border-color)]"
        style={{ boxShadow: 'var(--card-shadow)' }}
      >
        {/* Navbar */}
        <nav className="sticky top-0 z-50 w-full bg-[var(--bg-nav)] text-[var(--text-nav)] border-b border-[var(--border-color)] shadow-md transition-colors duration-300">
          <div className="w-full px-6 lg:px-12">
            <div className="flex justify-between items-center h-20">
              <div
                className="flex-shrink-0 flex items-center cursor-pointer group gap-3"
                onClick={goHome}
              >
                {settings.logoUrl ? (
                  <ThemeLogo
                    src={settings.logoUrl}
                    alt={settings.siteName}
                    useLogoAsTitle={settings.useLogoAsTitle}
                    invertLogoInDarkMode={settings.invertLogoInDarkMode}
                    className="transition-all"
                  />
                ) : (
                  <VonLogo variant="default" />
                )}
                {!settings.useLogoAsTitle && (
                  <div className="max-w-[200px] lg:max-w-[260px]">
                    <span
                      className="font-extrabold text-2xl tracking-tight block leading-none truncate"
                      style={{ color: 'var(--text-nav)' }}
                      title={settings.siteName}
                    >
                      {settings.siteName}
                    </span>
                    {settings.siteDescription && (
                      <span className="text-[10px] font-medium opacity-70 tracking-wide mt-1 hidden sm:block truncate">
                        {settings.siteDescription}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className={desktopNavigationClassName}>
                {visibleNavigationItems.map((nav: NavItem) => (
                  <NavLink
                    key={nav.id}
                    label={resolveNavigationLabel(nav)}
                    onClick={() => handleNavigationItem(nav)}
                    isActive={currentView === 'home' && nav.url === 'home'}
                  />
                ))}
                {/* More Dropdown */}
                {overflowNavigationItems.length > 0 && (
                  <div className="relative group">
                    <button
                      className="relative group text-sm font-semibold tracking-wide transition-opacity py-2 uppercase flex items-center gap-1 opacity-70 hover:opacity-100"
                      style={{ color: 'inherit' }}
                      aria-label="More Navigation"
                    >
                      More
                      <svg
                        className="w-3 h-3 transition-transform group-hover:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className="absolute top-full right-0 mt-2 w-48 py-2 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
                      style={{
                        backgroundColor: 'var(--bg-nav)',
                        border: '1px solid rgba(128,128,128,0.3)',
                      }}
                    >
                      {overflowNavigationItems.map((nav: NavItem) => (
                        <button
                          key={nav.id}
                          onClick={() => handleNavigationItem(nav)}
                          className="w-full px-4 py-2 text-left text-sm transition-opacity opacity-70 hover:opacity-100"
                          style={{ color: 'var(--text-nav)' }}
                        >
                          {resolveNavigationLabel(nav)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden md:flex items-center gap-6">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  aria-label="Toggle Dark Mode"
                >
                  {isDarkMode ? (
                    <Sun size={20} className="text-amber-500" />
                  ) : (
                    <Moon size={20} className="text-blue-400" />
                  )}
                </button>
                <div className="h-6 w-px bg-neutral-700"></div>
                {user ? (
                  <div className="relative" ref={dropdownRef}>
                    {/* User Avatar Button */}
                    <button
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="User Menu"
                    >
                      <div className="text-right hidden lg:block">
                        <p
                          className="text-sm font-bold leading-none"
                          style={{ color: 'var(--text-nav)' }}
                        >
                          {user.username}
                        </p>
                        <p
                          className="text-[10px] uppercase tracking-wide mt-1"
                          style={{ color: 'var(--text-nav)', opacity: 0.7 }}
                        >
                          {user.role}
                        </p>
                      </div>
                      <UserAvatar
                        url={user.avatar}
                        name={user.username}
                        email={user.email}
                        className="border border-neutral-200 dark:border-neutral-700"
                      />
                      <svg
                        className={`w-4 h-4 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--text-nav)', opacity: 0.7 }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showUserDropdown && (
                      <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden z-50 bg-white dark:bg-neutral-800 backdrop-blur-xl animate-fade-in">
                        {/* User Info Header */}
                        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
                          <div className="flex items-center gap-3">
                            <UserAvatar url={user.avatar} name={user.username} email={user.email} />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate text-neutral-900 dark:text-white">
                                {user.username}
                              </p>
                              <p className="text-xs truncate text-primary-600 dark:text-primary-400">
                                {user.role}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          {/* View Profile */}
                          <button
                            onClick={() => {
                              viewProfile(user.username);
                              setShowUserDropdown(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            View Profile
                          </button>

                          {/* Dashboard (Admin/Moderator/Writer only) */}
                          {['Admin', 'Moderator', 'Writer'].includes(user.role) && (
                            <button
                              onClick={() => {
                                onNavigateAdmin();
                                setShowUserDropdown(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-primary-600 dark:hover:text-primary-400"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                              </svg>
                              Dashboard
                            </button>
                          )}

                          {/* Divider */}
                          <div className="my-2 border-t border-neutral-200 dark:border-neutral-700"></div>

                          {/* Logout */}
                          <button
                            onClick={() => {
                              onLogout();
                              setShowUserDropdown(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={onLogin}
                    className="px-6 py-2.5 text-white text-sm font-bold hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: 'var(--border-radius)',
                    }}
                  >
                    Log In
                  </button>
                )}
              </div>
              <div className={`${compactNavigationClassName} flex items-center gap-4`}>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 transition-colors"
                  style={{ color: 'var(--text-nav)', opacity: 0.7 }}
                  aria-label="Toggle Dark Mode"
                >
                  {isDarkMode ? (
                    <Sun size={20} className="text-amber-500" />
                  ) : (
                    <Moon size={20} className="text-blue-400" />
                  )}
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  style={{ color: 'var(--text-nav)' }}
                  aria-label={isMobileMenuOpen ? 'Close Mobile Menu' : 'Open Mobile Menu'}
                >
                  {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
              </div>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div
              className={`${compactNavigationClassName} absolute top-full left-0 w-full shadow-2xl animate-slide-down`}
              style={{
                backgroundColor: 'var(--bg-nav)',
                borderTop: '1px solid rgba(128,128,128,0.2)',
              }}
            >
              <div className="px-6 py-8 space-y-6">
                {navigationItems.map((nav: NavItem) => (
                  <button
                    key={nav.id}
                    onClick={() => handleNavigationItem(nav, true)}
                    className="block w-full text-left text-lg font-bold"
                    style={{ color: 'var(--text-nav)' }}
                  >
                    {resolveNavigationLabel(nav)}
                  </button>
                ))}
                <hr style={{ borderColor: 'rgba(128,128,128,0.3)' }} />
                {user ? (
                  <>
                    <div
                      className="flex items-center gap-4"
                      onClick={() => {
                        viewProfile(user.username);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <UserAvatar url={user.avatar} name={user.username} email={user.email} />
                      <div>
                        <p className="font-bold" style={{ color: 'var(--text-nav)' }}>
                          {user.username}
                        </p>
                        <p
                          className="text-xs uppercase"
                          style={{ color: 'var(--text-nav)', opacity: 0.6 }}
                        >
                          {user.role}
                        </p>
                      </div>
                    </div>
                    {user.role !== 'Member' && (
                      <button
                        onClick={onNavigateAdmin}
                        className="block w-full text-center py-4 mt-4 font-bold rounded-xl"
                        style={{ backgroundColor: 'var(--text-nav)', color: 'var(--bg-nav)' }}
                      >
                        To Dashboard
                      </button>
                    )}
                    <button
                      onClick={onLogout}
                      className="block w-full text-center py-4 bg-red-900/20 border border-red-900/50 text-red-500 rounded-xl mt-2 font-bold"
                    >
                      Log Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onLogin}
                    className="block w-full text-center py-4 text-white mt-4 font-bold rounded-xl shadow-lg"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Login / Register
                  </button>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Trending Ticker - Feature Parity */}
        {currentView === 'home' &&
          !activeSearchQuery &&
          settings.theme.default?.showTrending !== false && (
            <TrendingTicker
              posts={publishedPosts.slice(0, 5)}
              onPostClick={onPostClick || viewPost}
              isDarkMode={isDarkMode}
              accentColor={settings.theme?.primaryColor || '#0ea5ff'}
              enableMarquee={settings.theme.default?.enableMarquee !== false}
            />
          )}

        {/* Header Ad Slot */}
        {settings.ads.adsEnabled && settings.ads.headerAd && (
          <div className="py-8 bg-neutral-50 dark:bg-black/50 border-b border-neutral-100 dark:border-neutral-800">
            <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}

        <main className="flex-grow w-full px-6 lg:px-12 py-8 bg-white dark:bg-neutral-950">
          {currentView === 'home' || currentView === 'category' ? (
            <HomeView
              posts={publishedPosts}
              onViewPost={onPostClick || viewPost}
              settings={settings}
              activeSearchQuery={activeSearchQuery}
              onSearch={handleSearch}
              onClearSearch={() => setActiveSearchQuery('')}
              onViewProfile={viewProfile}
              allUsers={allUsers}
              selectedCategory={currentView === 'category' ? selectedCategory : null}
              onCategoryClick={onCategoryClick}
              resetKey={resetKey}
            />
          ) : currentView === 'page' && selectedPage ? (
            <div className="w-full max-w-5xl mx-auto py-12 animate-fade-in">
              <button
                onClick={onBackToHome}
                className="flex items-center gap-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-8 transition-colors group font-medium"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                Back Home
              </button>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-neutral-900 dark:text-white mb-8">
                {selectedPage.title}
              </h1>
              <ContentRenderer
                html={sanitizeHtml(selectedPage.content)}
                className="prose prose-lg md:prose-xl dark:prose-invert max-w-none"
              />
            </div>
          ) : currentView === 'single-post' && selectedPost ? (
            <SinglePostView
              post={selectedPost}
              onBack={onBackToHome || goHome}
              user={user}
              comments={comments.filter((c) => c.postId === selectedPost.id)}
              onAddComment={onAddComment}
              onLikeComment={onLikeComment}
              onReplyComment={onReplyComment}
              onLoadMoreComments={onLoadMoreComments}
              hasMoreComments={hasMoreComments}
              commentsLoading={commentsLoading}
              commentsError={commentsError}
              onLogin={onLogin}
              settings={settings}
              onViewProfile={viewProfile}
              allUsers={allUsers}
              posts={posts}
              onPostClick={onPostClick || viewPost}
              onCategoryClick={onCategoryClick}
              isDarkMode={isDarkMode}
            />
          ) : isProfileRoute ? (
            targetProfile ? (
              <UserProfile
                key={targetProfile.id}
                targetUser={targetProfile}
                currentUser={user}
                posts={posts}
                comments={comments}
                onBack={onBackToHome || goHome}
                onViewPost={onPostClick || viewPost}
                postsPerPage={settings.postsPerPage || 6}
                onNavigateAdmin={onNavigateAdmin}
                onUpdateUser={onUpdateUser}
              />
            ) : (
              <div className="text-center py-32">
                <UserIcon size={64} className="text-neutral-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-neutral-800 dark:text-white">
                  User not found.
                </h2>
                <button
                  onClick={onBackToHome || goHome}
                  className="mt-6 text-primary-600 hover:underline font-bold"
                >
                  Return Home
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-32">
              <FileQuestion size={64} className="text-neutral-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-neutral-800 dark:text-white">
                Article not found.
              </h2>
              <button
                onClick={onBackToHome || goHome}
                className="mt-6 text-primary-600 hover:underline font-bold"
              >
                Return Home
              </button>
            </div>
          )}
        </main>

        <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />

        <footer
          className="py-16 mt-auto"
          style={{
            backgroundColor: 'var(--bg-nav)',
            color: 'var(--text-nav)',
            borderTop: '1px solid rgba(128,128,128,0.2)',
          }}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-12">
            {/* Newsletter Widget */}
            {settings.newsletter?.enabled &&
              (settings.newsletter?.position === 'footer' ||
                settings.newsletter?.position === 'both') && (
                <VonNewsletter
                  settings={settings.newsletter}
                  variant="footer"
                  accentColor={settings.theme?.primaryColor || '#0ea5ff'}
                  themeColors={{
                    surface: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    surfaceAlt: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    text: navTextColor,
                    textSecondary: navTextColor,
                  }}
                />
              )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
              {/* Column 1: Brand (Spans 2 columns like TechPress) */}
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center mb-6">
                  <span
                    className="font-bold text-2xl tracking-tight"
                    style={{ color: 'var(--text-nav)' }}
                  >
                    {settings.siteName}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed mb-6 font-light max-w-lg"
                  style={{ opacity: 0.7 }}
                >
                  {settings.siteDescription}
                </p>
                {settings.siteTagline && (
                  <p className="text-xs italic" style={{ opacity: 0.5 }}>
                    {settings.siteTagline}
                  </p>
                )}
              </div>

              {/* Column 2: Useful Links */}
              <div className="col-span-1">
                <h4
                  className="font-bold mb-6 text-sm uppercase tracking-widest"
                  style={{ color: 'var(--text-nav)' }}
                >
                  Explore
                </h4>
                <ul className="space-y-3 text-sm">
                  {settings.theme?.default?.footerLinks &&
                  settings.theme.default.footerLinks.length > 0 ? (
                    settings.theme.default.footerLinks.map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={normalizeSiteUrl(link.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:opacity-100 transition-opacity flex items-center gap-2"
                          style={{ opacity: 0.7 }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: 'var(--text-nav)', opacity: 0.4 }}
                          ></span>
                          {link.label}
                        </a>
                      </li>
                    ))
                  ) : (
                    <>
                      <li>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="hover:opacity-100 transition-opacity cursor-pointer"
                          style={{ opacity: 0.7 }}
                        >
                          Home
                        </a>
                      </li>
                      <li>
                        <a
                          href="#"
                          className="hover:opacity-100 transition-opacity"
                          style={{ opacity: 0.7 }}
                        >
                          About
                        </a>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div
              className="pt-8 flex flex-col md:flex-row justify-between items-center text-sm font-light gap-4"
              style={{ borderTop: '1px solid rgba(128,128,128,0.2)', opacity: 0.6 }}
            >
              <p>
                {settings.footerCopyright ||
                  `Powered by VonCMS @ ${new Date().getFullYear()}. All rights reserved.`}
              </p>
              <div className="flex items-center gap-6" style={{ opacity: 0.5 }}>
                <a
                  href={rssPath}
                  className="hover:opacity-100 transition-opacity flex items-center gap-1.5"
                  title="RSS Feed"
                >
                  <Rss size={14} />
                  <span>RSS</span>
                </a>
                <p>Designed for performance.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// --- Sub-components for PublicSite ---

const HomeView: React.FC<{
  posts: Post[];
  onViewPost: (id: string) => void;
  settings: SiteSettings;
  activeSearchQuery: string;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onViewProfile: (username: string) => void;
  allUsers?: User[];
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
  resetKey?: number;
}> = ({
  posts,
  onViewPost,
  settings,
  activeSearchQuery,
  onSearch,
  onClearSearch,
  onViewProfile,
  allUsers = [],
  selectedCategory,
  onCategoryClick,
}) => {
  const postsPerPage = settings.postsPerPage || 6;
  const [localSearchTerm, setLocalSearchTerm] = useState(activeSearchQuery);

  // Filter by Category
  const categoryFilteredPosts = useMemo(
    () => (selectedCategory ? posts.filter((p) => p.category === selectedCategory) : posts),
    [selectedCategory, posts]
  );

  const publicPosts = usePublicPostsQuery({
    initialPosts: categoryFilteredPosts,
    category: selectedCategory,
    search: activeSearchQuery,
    limit: postsPerPage,
  });

  const finalPosts = publicPosts.posts;

  // Sync from parent
  useEffect(() => {
    setLocalSearchTerm(activeSearchQuery);
  }, [activeSearchQuery]);

  const handleClearSearch = () => {
    setLocalSearchTerm('');
    onClearSearch();
  };
  const searchLimitExceeded = localSearchTerm.length >= PUBLIC_SEARCH_MAX_LENGTH;

  const currentPosts = publicPosts.posts;
  const hasMorePosts = publicPosts.hasMore;
  const searchResultsAreExact = publicPosts.meta?.totalIsExact !== false;
  const visibleSearchCount = publicPosts.posts.length;
  const searchResultsCount = searchResultsAreExact ? publicPosts.total : visibleSearchCount;
  const visibleSearchLabel = visibleSearchCount === 1 ? 'result' : 'results';
  const searchResultsLabel = searchResultsCount === 1 ? 'result' : 'results';
  const searchResultsCopy = searchResultsAreExact
    ? `${searchResultsCount} ${searchResultsLabel} found`
    : publicPosts.hasMore
      ? `Showing first ${visibleSearchCount} results`
      : `Showing ${visibleSearchCount} ${visibleSearchLabel}`;
  const isSearching = publicPosts.isLoading;

  const handleLoadMore = publicPosts.loadMore;
  const loadingMore = publicPosts.loadingMore;

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto">
      <div className="max-w-md mx-auto relative mb-8 mt-8">
        <div className="relative group">
          <input
            aria-label="Search articles"
            id="default-search"
            name="search"
            type="text"
            placeholder="Search articles..."
            value={localSearchTerm}
            maxLength={PUBLIC_SEARCH_MAX_LENGTH}
            onChange={(e) => {
              const nextSearch = normalizePublicSearchInput(e.target.value);
              setLocalSearchTerm(nextSearch);
              onSearch(nextSearch);
            }}
            className="w-full px-6 py-4 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl shadow-neutral-200/40 dark:shadow-none focus:ring-2 focus:ring-primary-500 focus:outline-none text-neutral-800 dark:text-white pl-14 transition-all"
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400">
            <Search size={20} />
          </div>
          {localSearchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white bg-neutral-100 dark:bg-neutral-700 rounded-full p-1"
              title="Clear Search"
              aria-label="Clear Search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchLimitExceeded && (
          <p className="mt-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
            Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="w-full">
        <div>
          {selectedCategory && (
            <div className="mb-8 text-center animate-fade-in">
              <h3 className="text-2xl font-bold text-neutral-800 dark:text-white">
                Category: <span className="text-primary-600">"{selectedCategory}"</span>
              </h3>
              <button
                className="text-sm text-neutral-500 hover:text-primary-600 mt-2 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  if (onCategoryClick) onCategoryClick('');
                  else window.location.href = '/';
                }}
              >
                View All Categories
              </button>
            </div>
          )}
          {localSearchTerm && searchResultsCount > 0 && !selectedCategory && (
            <div className="mb-8 text-center animate-fade-in">
              <h3 className="text-2xl font-bold text-neutral-800 dark:text-white">
                Results for: <span className="text-primary-600">"{localSearchTerm}"</span>
              </h3>
              <p className="text-neutral-500">{searchResultsCopy}</p>
            </div>
          )}
          {finalPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 opacity-100 transition-opacity duration-300">
              {currentPosts.map((post, index) => (
                <React.Fragment key={post.id}>
                  <article
                    className="group flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-2xl hover:shadow-neutral-200/50 dark:hover:shadow-none transition-all duration-300 cursor-pointer overflow-hidden"
                    style={{ borderRadius: settings.theme.borderRadius }}
                    onClick={() => onViewPost(post.id)}
                  >
                    <a
                      href={getPermalink(post, settings)}
                      onClick={(e) =>
                        handleCrawlableLinkClick(e, () => {
                          onViewPost(post.id);
                        })
                      }
                      className="h-64 bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative block"
                      aria-label={decodeEntities(post.title)}
                    >
                      {post.image && (
                        <img
                          {...getResponsiveImageAttributes(post, 'card')}
                          alt={decodeEntities(post.title)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                    </a>
                    <div className="p-8 flex flex-col flex-grow">
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/40 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onCategoryClick) onCategoryClick(post.category);
                          }}
                        >
                          {post.category}
                        </span>
                        <span className="text-xs font-medium text-neutral-400">
                          {post.readTime || '5 min read'}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 leading-tight line-clamp-2 group-hover:text-primary-600 transition-colors">
                        <a
                          href={getPermalink(post, settings)}
                          onClick={(e) =>
                            handleCrawlableLinkClick(e, () => {
                              onViewPost(post.id);
                            })
                          }
                          className="hover:text-primary-600"
                        >
                          {decodeEntities(post.title)}
                        </a>
                      </h3>
                      <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed mb-6 line-clamp-3 font-light">
                        {decodeEntities(post.excerpt)}
                      </p>
                      <div className="mt-auto pt-6 border-t border-neutral-50 dark:border-neutral-800 flex items-center gap-3">
                        <UserAvatar
                          name={post.author}
                          email={
                            allUsers.find(
                              (u) => u.username === (post.author_data?.username || post.author)
                            )?.email
                          }
                          url={
                            post.author_data?.avatar ||
                            allUsers.find(
                              (u) => u.username === (post.author_data?.username || post.author)
                            )?.avatar
                          }
                          size="w-8 h-8"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfile(post.author_data?.username || post.author);
                          }}
                        />
                        <div className="text-xs">
                          <span
                            className="font-bold text-neutral-900 dark:text-white block hover:text-primary-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewProfile(post.author_data?.username || post.author);
                            }}
                          >
                            {post.author}
                          </span>
                          <span className="text-neutral-400">
                            {formatDate(post.createdAt || '', settings.timeZone)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                  {(index + 1) % (settings.ads.inFeedFrequency || 6) === 0 &&
                    settings.ads.adsEnabled &&
                    settings.ads.inFeedAd && (
                      <div className="col-span-1 md:col-span-2 lg:col-span-3 py-8 ad-slot-flex">
                        <AdBlock content={settings.ads.inFeedAd} slotId="infeed" />
                      </div>
                    )}
                </React.Fragment>
              ))}
            </div>
          ) : isSearching ? (
            <PublicDiscoverySkeleton />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 animate-fade-in text-center px-4">
              <div className="bg-white dark:bg-neutral-800 p-4 rounded-full shadow-sm mb-6">
                <FileQuestion size={48} className="text-neutral-300 dark:text-neutral-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800 dark:text-white mb-2">
                No results found for "{activeSearchQuery}"
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={onClearSearch}
                  className="px-6 py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                >
                  Clear Search & Show All
                </button>
              </div>
            </div>
          )}
          {/* Load More Button */}
          <LoadMoreButton
            loading={loadingMore}
            hasMore={hasMorePosts}
            onLoadMore={handleLoadMore}
            label="Load More Articles"
          />
        </div>
      </div>
    </div>
  );
};

const SinglePostView: React.FC<{
  post: Post;
  onBack: () => void;
  user: User | null;
  comments: Comment[];
  onAddComment: (postId: string, content: string) => void;
  onLikeComment: (commentId: string) => boolean | Promise<boolean>;
  onReplyComment: (commentId: string, content: string) => void;
  onLoadMoreComments?: () => Promise<void>;
  hasMoreComments?: boolean;
  commentsLoading?: boolean;
  commentsError?: string | null;
  onLogin: () => void;
  settings: SiteSettings;
  onViewProfile: (username: string) => void;
  allUsers?: User[];
  posts: Post[];
  onPostClick: (id: string) => void;
  onCategoryClick?: (category: string) => void;
  isDarkMode: boolean;
}> = ({
  post,
  onBack,
  user,
  comments,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onLoadMoreComments,
  hasMoreComments,
  commentsLoading,
  commentsError,
  onLogin,
  settings,
  onViewProfile,
  allUsers = [],
  posts,
  onPostClick,
  onCategoryClick,
  isDarkMode,
}) => {
  // Plugin Hooks (v1.9.9)
  const { component: aiSummary, position: aiSummaryPos } = useAISummary(
    settings,
    post.content || ''
  ) || {
    component: null,
    position: 'top',
  };
  const relatedPosts = useRelatedPosts(settings, post, posts, (p) => onPostClick(p.id), {
    primary: settings.theme.primaryColor || '#0ea5ff',
    surface: isDarkMode ? '#1a1a1a' : '#ffffff',
    surfaceAlt: isDarkMode ? '#121212' : '#f8fafc',
    border: isDarkMode ? '#2a2a2a' : '#e2e8f0',
    text: isDarkMode ? '#E5E7EB' : '#1e293b',
    textSecondary: isDarkMode ? '#9CA3AF' : '#64748b',
  });

  const authorUsername = post.author_data?.username || post.author;
  const authorEmail = allUsers.find((u) => u.username === authorUsername)?.email;
  const authorAvatar =
    post.author_data?.avatar || allUsers.find((u) => u.username === authorUsername)?.avatar;

  return (
    <div className="w-full max-w-7xl mx-auto py-12 animate-fade-in flex flex-col lg:flex-row gap-12">
      <article className="flex-grow lg:max-w-[calc(100%-420px)]">
        <button
          onClick={onBack}
          className="flex items-center gap-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-12 transition-colors group font-medium"
        >
          <div className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          </div>
          Back
        </button>

        <header className="mb-12 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-4 text-sm font-bold mb-8 uppercase tracking-widest">
            <span
              className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-primary-600 dark:text-primary-400 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
              onClick={() => onCategoryClick && onCategoryClick(post.category)}
            >
              {post.category}
            </span>
            <span className="text-neutral-300">•</span>
            <span>{post.readTime || '5 min read'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-neutral-900 dark:text-white mb-10 leading-[1.15]">
            {decodeEntities(post.title)}
          </h1>
          <div className="flex flex-col sm:flex-row items:center justify-center lg:justify-start gap-6 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={post.author}
                url={authorAvatar}
                email={authorEmail}
                size="w-12 h-12"
                className="cursor-pointer hover:opacity-80 shadow-md border-2 border-white dark:border-neutral-800"
                onClick={() => onViewProfile(authorUsername)}
              />
              <div className="text-left">
                <p
                  className="font-bold text-neutral-900 dark:text-white cursor-pointer hover:text-primary-600 transition-colors"
                  onClick={() => onViewProfile(authorUsername)}
                >
                  {post.author}
                </p>
                <p className="text-xs text-neutral-500 uppercase tracking-wide">Main Author</p>
              </div>
            </div>
            <div className="hidden sm:block h-10 w-px bg-neutral-200 dark:bg-neutral-800"></div>
            <div className="text-left">
              <p className="font-bold text-neutral-900 dark:text-white">
                {formatDate(post.createdAt || '', settings.timeZone)}
              </p>
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Post Date</p>
            </div>
          </div>
        </header>

        {/* Share buttons (top) — rendered if admin selected top placement */}
        {settings.sharePlacement === 'top' && (
          <div className="mb-8">
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={decodeEntities(post.title)}
            />
          </div>
        )}

        {/* Smart Featured Image: Only show if NOT in content */}
        {(() => {
          if (!post.image) return null;
          // Check if content contains video embeds at the start
          if (hasEmbeddedVideoMarkup(post.content)) return null;

          // Extract filename to check for matches (e.g. "image.jpg")
          const imageFilename = post.image.split('/').pop()?.split('?')[0] || '';

          // Check if exact URL or filename exists in content
          const contentHasImage =
            post.content?.includes(post.image) ||
            (imageFilename && post.content?.includes(imageFilename));

          if (contentHasImage) return null;

          return (
            <div className="w-full mb-10 rounded-2xl overflow-hidden shadow-lg">
              <img
                {...getResponsiveImageAttributes(post, 'hero')}
                alt={decodeEntities(post.title)}
                className="w-full h-auto max-h-[600px] object-cover"
              />
            </div>
          );
        })()}

        {/* AI Summary Plugin */}
        {aiSummaryPos === 'top' && aiSummary}

        <ContentRenderer
          html={sanitizeHtml(post.content)}
          className="prose prose-lg md:prose-xl dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-neutral-900 dark:prose-headings:text-white prose-p:text-neutral-600 dark:prose-p:text-neutral-200 prose-p:leading-loose prose-p:font-light prose-img:rounded-2xl prose-img:shadow-lg"
          style={
            {
              '--tw-prose-links': 'var(--color-primary)',
            } as React.CSSProperties & { '--tw-prose-links': string }
          }
        />
        {aiSummaryPos === 'bottom' && aiSummary}

        {/* Share buttons (bottom) — rendered if placement is not 'none' */}
        {settings.sharePlacement !== 'none' && settings.sharePlacement !== 'top' && (
          <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={decodeEntities(post.title)}
            />
          </div>
        )}

        {/* Keywords/Tags Section */}
        {post.keywords && (
          <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-4">
              Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {post.keywords.split(',').map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-colors cursor-pointer"
                >
                  {keyword.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Posts Plugin */}
        {relatedPosts}

        {/* USING NEW VpComments COMPONENT */}
        <VpComments
          comments={comments.filter((c) => String(c.postId) === String(post.id))}
          user={user}
          onAddComment={(content) => onAddComment(post.id, content)}
          onLikeComment={onLikeComment}
          onReplyComment={onReplyComment}
          onLoadMoreComments={onLoadMoreComments}
          hasMoreComments={hasMoreComments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          onLogin={onLogin}
          settings={settings}
          onViewProfile={onViewProfile}
          id="default-comments"
          themeColors={{
            primary: settings.theme.primaryColor || '#0ea5ff',
            surface: isDarkMode ? '#171717' : '#ffffff',
            surfaceAlt: isDarkMode ? '#0a0a0a' : '#f8fafc',
            border: isDarkMode ? '#262626' : '#e2e8f0',
            text: isDarkMode ? '#fafafa' : '#0f172a',
            textSecondary: isDarkMode ? '#a3a3a3' : '#64748b',
          }}
        />
      </article>

      <aside className="w-full lg:w-[400px] flex-shrink-0 space-y-8">
        {/* Newsletter Widget (Sidebar) */}
        {settings.newsletter?.enabled &&
          (settings.newsletter?.position === 'sidebar' ||
            settings.newsletter?.position === 'both') && (
            <VonNewsletter
              settings={settings.newsletter}
              variant="sidebar"
              accentColor={settings.theme.primaryColor || '#0ea5ff'}
              themeColors={{
                surface: isDarkMode ? '#171717' : '#ffffff',
                surfaceAlt: isDarkMode ? '#0a0a0a' : '#f8fafc',
                border: isDarkMode ? '#262626' : '#e2e8f0',
                text: isDarkMode ? '#fafafa' : '#0f172a',
                textSecondary: isDarkMode ? '#a3a3a3' : '#64748b',
              }}
            />
          )}

        {settings.sidebarLayout
          .filter((widget) => widget.isVisible !== false)
          .map((widget) => (
            <VpSidebarWidget
              key={widget.id}
              widget={widget}
              settings={settings}
              posts={posts}
              onPostClick={onPostClick}
              currentPostId={post.id}
              themeColors={{
                surface: isDarkMode ? '#121212' : '#ffffff',
                border: isDarkMode ? '#1a1a1a' : '#f1f5f9',
              }}
            />
          ))}
      </aside>
    </div>
  );
};

export default DefaultLayout;
