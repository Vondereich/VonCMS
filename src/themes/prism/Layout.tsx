import React, { useState, useMemo, useCallback, useRef } from 'react';
import Gravatar from 'react-gravatar';
import { Post } from '../../types';
import {
  X,
  Search,
  ChevronLeft,
  Zap,
  Heart,
  Share2,
  MessageSquare,
  Terminal,
  Menu,
  Cpu,
  FileQuestion,
  Loader2,
  ArrowLeft,
  Rss,
} from 'lucide-react';
import { ThemeLayoutProps } from '../types';
import { SafeImage } from '../../components/SafeImage';
import { getBasePathPrefix, getPermalink } from '../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import ThemeLogo from '../shared/components/ThemeLogo';
import {
  getOverflowNavigationItems,
  getVisibleNavigationItems,
  shouldUseTabletBurgerMenu,
} from '../../utils/navigation';

// Theme SDK
import {
  VonSEO,
  ContentRenderer,
  VpComments,
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
  decodeEntities,
  sanitizeHtml,
  hasEmbeddedVideoMarkup,
  ProseDarkModeStyles,
  AdBlock,
  VonPopupAd,
  getResponsiveImageAttributes,
} from '../shared';

import PrismProfile from './components/PrismProfile';
import { getSameSiteCategoryNavigation, normalizeSiteUrl } from '../../utils/siteUtils';

// Utility for rendering ads safely (Raw HTML)

// Prism Specific Components
const GlitchText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span className="relative inline-block group">
      <span className="relative z-10">{text}</span>
      <span className="absolute top-0 left-0 -z-10 text-red-500 opacity-0 group-hover:opacity-100 group-hover:animate-glitch-1">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:animate-glitch-2">
        {text}
      </span>
    </span>
  );
};

const CyberAvatar: React.FC<{ url?: string; name: string; email?: string; size?: string }> = ({
  url,
  name,
  email,
  size = 'w-10 h-10',
}) => {
  return (
    <div className={`${size} relative group`}>
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] rounded-lg rotate-45 opacity-20 group-hover:rotate-90 transition-transform duration-500"></div>
      <div className="absolute inset-0.5 bg-[#050510] rounded-lg overflow-hidden flex items-center justify-center border border-white/10">
        <SafeImage
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          fallback={
            <Gravatar email={email || name} size={100} className="w-full h-full object-cover" />
          }
        />
      </div>
    </div>
  );
};

const PrismLayout: React.FC<ThemeLayoutProps> = ({
  posts,
  pages = [],
  user,
  comments,
  allUsers,
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
  currentView,
  selectedPost,
  selectedPage,
  selectedProfile,
  onPostClick,
  onPageClick,
  onViewProfile,
  onBackToHome,
  onCategoryClick,
  onClearSearch,
  selectedCategory,
  onUpdateUser,
}) => {
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const postsPerPage = settings.postsPerPage || 6;
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigationItems = settings.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationClassName = `${
    useTabletBurgerMenu ? 'hidden lg:flex' : 'hidden md:flex'
  } items-center gap-1`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  const handleClearSearch = () => {
    setActiveSearchQuery('');
    if (onClearSearch) onClearSearch();
  };

  const handleReturnHome = () => {
    onBackToHome();
  };

  const publishedPosts = useMemo(() => posts.filter((p) => p.status === 'published'), [posts]);
  const categoryFilteredPosts = useMemo(
    () =>
      selectedCategory
        ? publishedPosts.filter((p) => p.category === selectedCategory)
        : publishedPosts,
    [selectedCategory, publishedPosts]
  );

  const publicPosts = usePublicPostsQuery({
    initialPosts: categoryFilteredPosts,
    category: selectedCategory,
    search: activeSearchQuery,
    limit: postsPerPage,
  });

  const currentPosts = publicPosts.posts;
  const hasMorePosts = publicPosts.hasMore;
  const loadingMore = publicPosts.loadingMore;
  const handleLoadMore = publicPosts.loadMore;
  const isInitialDiscoveryLoading = publicPosts.isLoading && currentPosts.length === 0;

  const prismConfig = settings.theme.prism || {
    neonEffects: true,
    colorScheme: 'cyan',
    fontSize: 'md',
  };

  // Dynamic Styles based on Config
  const colorMap = {
    cyan: { primary: '#06b6d4', secondary: '#ec4899' },
    purple: { primary: '#a855f7', secondary: '#22d3ee' },
    green: { primary: '#22c55e', secondary: '#a855f7' },
  };

  const colors = colorMap[prismConfig.colorScheme] || colorMap.cyan;
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');

  const dynamicStyle = {
    '--color-primary': colors.primary,
    '--color-secondary': colors.secondary,
    '--neon-shadow': prismConfig.neonEffects
      ? `0 0 10px ${colors.primary}, 0 0 20px ${colors.secondary}`
      : 'none',
    '--glass-border': prismConfig.neonEffects
      ? '1px solid rgba(255,255,255,0.1)'
      : '1px solid rgba(255,255,255,0.05)',
    fontSize:
      prismConfig.fontSize === 'lg' ? '18px' : prismConfig.fontSize === 'sm' ? '14px' : '16px',
  } as React.CSSProperties;

  // Shared Hooks (v1.9.5)
  // Plugin Hooks (v1.9.9)
  const { component: aiSummary, position: aiSummaryPos } = useAISummary(
    settings,
    selectedPost?.content || ''
  ) || { component: null, position: 'top' };

  const relatedPosts = useRelatedPosts(
    settings,
    selectedPost,
    posts,
    (p: Post) => onPostClick(p.id),
    {
      primary: colors.primary,
      secondary: colors.secondary,
      surface: '#0a0a1f',
      surfaceAlt: '#050510',
      border: 'rgba(255,255,255,0.1)',
      text: '#cbd5e1',
      textSecondary: '#94a3b8',
    }
  );

  const { showPopup, closePopup } = useAdsPopup(settings.ads); // No currentView = show popup on any view
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);
  useClickOutside(
    dropdownRef,
    useCallback(() => setShowUserDropdown(false), []),
    showUserDropdown
  );

  // Prism Specific Global Styles
  const prismGlobalStyles = `
        .prose a {
            color: var(--color-primary) !important;
        }
        .prose blockquote {
            border-left-color: var(--color-primary) !important;
            background: rgba(255,255,255,0.05) !important;
        }
        .prose code {
            color: var(--color-secondary) !important;
        }
        .prism-card-hover:hover {
            box-shadow: 0 0 25px -5px var(--color-primary);
            border-color: var(--color-primary);
        }
        .prose ul, .prose ol {
            color: #e2e8f0 !important; /* brighter text for points */
        }
        .prose li::marker {
            color: var(--color-primary) !important; /* neon marker */
        }
    `;

  const rssPath = `${getBasePathPrefix()}/rss`;

  return (
    <div
      className="min-h-screen bg-[#050510] text-slate-300 font-mono selection:bg-[var(--color-primary)] selection:text-black dark"
      style={dynamicStyle}
    >
      <ProseDarkModeStyles />
      <style>{prismGlobalStyles}</style>
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

      {/* Background Grid Effect */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none opacity-20 ${prismConfig.neonEffects ? 'animate-pulse' : ''}`}
        style={{
          backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      ></div>

      {/* Glowing Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-primary)] opacity-10 blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-secondary)] opacity-10 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* PRISM HEADER: Glassmorphism, Neon Borders */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#050510]/80 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={handleReturnHome}
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
                <VonLogo
                  variant="default"
                  className="!w-10 !h-10 shadow-[0_0_15px_rgba(245,158,11,0.5)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.8)] transition-all"
                />
              )}
              {!settings.useLogoAsTitle && (
                <div className="max-w-[200px] lg:max-w-[280px]">
                  <span
                    className="text-2xl font-bold tracking-tighter text-white block truncate"
                    title={settings.siteName}
                  >
                    <GlitchText text={settings.siteName} />
                  </span>
                  {settings.siteDescription && (
                    <span className="text-xs text-slate-400 font-light block truncate">
                      {settings.siteDescription}
                    </span>
                  )}
                </div>
              )}
            </div>

            <nav className={desktopNavigationClassName}>
              {visibleNavigationItems.map((nav: any) => (
                <button
                  key={nav.id}
                  onClick={() => {
                    if (nav.url === 'home') return handleReturnHome();
                    if (nav.url.startsWith('page:')) {
                      const pageId = nav.url.split(':')[1];
                      const pg = pages.find((p) => p.id === pageId);
                      if (onPageClick) return onPageClick(pg?.slug || pageId);
                      return;
                    }
                    if (nav.url.startsWith('post:')) return onPostClick(nav.url.split(':')[1]);
                    const categoryTarget = getSameSiteCategoryNavigation(nav.url);
                    if (categoryTarget !== null && onCategoryClick)
                      return onCategoryClick(categoryTarget);
                    window.location.href = normalizeSiteUrl(nav.url);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all relative overflow-hidden group ${currentView === 'home' && nav.url === 'home' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-white'}`}
                >
                  <span className="relative z-10">{nav.label || nav.url}</span>
                  <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              ))}
              {/* More Dropdown for excess items */}
              {overflowNavigationItems.length > 0 && (
                <div className="relative group">
                  <button
                    className="px-4 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white transition-all flex items-center gap-1"
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
                  <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-[#0a0a1f] border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    {overflowNavigationItems.map((nav: any) => (
                      <button
                        key={nav.id}
                        onClick={() => {
                          if (nav.url === 'home') return handleReturnHome();
                          if (nav.url.startsWith('page:')) {
                            const pageId = nav.url.split(':')[1];
                            const pg = pages.find((p) => p.id === pageId);
                            if (onPageClick) return onPageClick(pg?.slug || pageId);
                            return;
                          }
                          if (nav.url.startsWith('post:'))
                            return onPostClick(nav.url.split(':')[1]);
                          const categoryTarget = getSameSiteCategoryNavigation(nav.url);
                          if (categoryTarget !== null && onCategoryClick)
                            return onCategoryClick(categoryTarget);
                          window.location.href = normalizeSiteUrl(nav.url);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {nav.label || nav.url}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </nav>

            {/* Mobile Menu Toggle */}
            <div className={`${compactNavigationClassName} flex items-center gap-4`}>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-[var(--color-primary)] hover:text-white transition-colors"
                aria-label={isMobileMenuOpen ? 'Close Mobile Menu' : 'Open Mobile Menu'}
              >
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>

            <div className="flex items-center gap-6">
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  {/* User Avatar Button */}
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/5 border border-white/10"
                    aria-label="User Menu"
                  >
                    <CyberAvatar
                      url={user.avatar}
                      name={user.username}
                      email={user.email}
                      size="w-8 h-8"
                    />
                    <span className="text-sm font-medium hidden sm:block text-white">
                      {user.username}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform text-slate-400 ${showUserDropdown ? 'rotate-180' : ''}`}
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
                    <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-2xl border border-white/10 overflow-hidden z-50 bg-[#0a0a1f] backdrop-blur-xl animate-fade-in">
                      {/* User Info Header */}
                      <div className="p-4 border-b border-white/10 bg-white/5">
                        <div className="flex items-center gap-3">
                          <CyberAvatar
                            url={user.avatar}
                            name={user.username}
                            email={user.email}
                            size="w-10 h-10"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-white">{user.username}</p>
                            <p className="text-xs truncate text-[var(--color-secondary)]">
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
                            onViewProfile(user.username);
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-slate-300 hover:bg-white/5 hover:text-white"
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
                            className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-slate-300 hover:bg-white/5 hover:text-[var(--color-primary)]"
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
                        <div className="my-2 border-t border-white/10"></div>

                        {/* Logout */}
                        <button
                          onClick={() => {
                            onLogout();
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-red-400 hover:bg-red-500/10"
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
                  className="relative px-3 md:px-6 py-2 group overflow-hidden rounded bg-transparent border border-[var(--color-primary)] text-[var(--color-primary)] font-mono text-xs font-bold tracking-widest hover:text-black hover:shadow-[0_0_20px_rgba(79,151,255,0.5)] transition-all duration-300"
                >
                  <span className="absolute inset-0 w-full h-full bg-[var(--color-primary)] -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></span>
                  <span className="relative flex items-center gap-2">
                    <Terminal size={14} />
                    <span className="hidden md:inline">INITIALIZE_SESSION</span>
                    <span className="md:hidden">INIT</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className={`${compactNavigationClassName} absolute top-20 left-0 w-full bg-[#0a0a1f]/95 backdrop-blur-xl border-b border-white/10 z-40 animate-slide-down`}
          >
            <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4">
              {navigationItems.map((nav: any) => (
                <button
                  key={nav.id}
                  onClick={() => {
                    if (nav.url === 'home') handleReturnHome();
                    else if (nav.url.startsWith('page:')) {
                      const pageId = nav.url.split(':')[1];
                      const pg = pages.find((p) => p.id === pageId);
                      if (onPageClick) onPageClick(pg?.slug || pageId);
                    } else if (nav.url.startsWith('post:')) onPostClick(nav.url.split(':')[1]);
                    else {
                      const categoryTarget = getSameSiteCategoryNavigation(nav.url);
                      if (categoryTarget !== null && onCategoryClick)
                        onCategoryClick(categoryTarget);
                      else window.location.href = normalizeSiteUrl(nav.url);
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left px-4 py-3 rounded border border-white/5 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/10 text-slate-300 hover:text-white transition-all font-mono"
                >
                  &gt; {nav.label || nav.url}
                </button>
              ))}

              {/* Mobile Search */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  aria-label="Search"
                  id="prism-mobile-search"
                  name="search"
                  type="text"
                  placeholder="SEARCH..."
                  value={activeSearchQuery}
                  maxLength={PUBLIC_SEARCH_MAX_LENGTH}
                  onChange={(e) => setActiveSearchQuery(normalizePublicSearchInput(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--color-primary)] text-slate-300 font-mono"
                />
                {activeSearchQuery.length >= PUBLIC_SEARCH_MAX_LENGTH && (
                  <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header Ad Zone */}
        {settings.ads.adsEnabled && settings.ads.headerAd && (
          <div className="py-6 border-b border-white/5 bg-[#050510]/50">
            <div className="max-w-7xl mx-auto px-6 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}

        <main className="flex-grow w-full max-w-7xl mx-auto px-6 py-12">
          {currentView === 'home' || currentView === 'category' ? (
            <>
              {/* Search Bar */}
              <div className="max-w-md mx-auto relative mb-12">
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                  <input
                    aria-label="Search Database"
                    id="prism-search"
                    name="search"
                    type="text"
                    placeholder="SEARCH_DATABASE..."
                    value={activeSearchQuery}
                    maxLength={PUBLIC_SEARCH_MAX_LENGTH}
                    onChange={(e) =>
                      setActiveSearchQuery(normalizePublicSearchInput(e.target.value))
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full py-4 pl-14 pr-12 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all text-slate-300 placeholder:text-slate-600 font-mono"
                  />
                  {activeSearchQuery.length >= PUBLIC_SEARCH_MAX_LENGTH && (
                    <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
                    </p>
                  )}
                  {activeSearchQuery && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[var(--color-primary)] transition-colors bg-slate-800/50 rounded-full p-1"
                      title="CLEAR_PROTOCOL"
                      aria-label="Clear Search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              {selectedCategory && (
                <div className="mb-12 text-center relative z-10">
                  <div className="inline-block relative">
                    <div className="absolute inset-0 bg-[var(--color-primary)] blur-3xl opacity-20 rounded-full"></div>
                    <h2 className="relative text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 tracking-tight">
                      <span className="text-[var(--color-primary)] text-lg block mb-2 font-mono uppercase tracking-widest">
                        CATEGORY_VIEW
                      </span>
                      {selectedCategory}
                    </h2>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() =>
                        onCategoryClick ? onCategoryClick('') : (window.location.href = '/')
                      }
                      className="px-4 py-2 border border-white/10 rounded-full text-slate-400 hover:text-white hover:border-white/30 transition-all text-sm font-mono flex items-center gap-2 mx-auto w-fit"
                    >
                      <X size={14} /> CLEAR_FILTER
                    </button>
                  </div>
                </div>
              )}
              {isInitialDiscoveryLoading ? (
                <PublicDiscoverySkeleton className="mb-12" />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                    {currentPosts.map((post, idx) => (
                      <React.Fragment key={post.id}>
                        <article
                          className="group relative bg-[#0a0a1f]/80 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-300 prism-card-hover"
                          onClick={() => onPostClick(post.id)}
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          {/* Neon Border on Hover - handled by CSS now but keeping gradient overlay */}
                          <div className="absolute inset-0 rounded-2xl border-2 border-transparent transition-colors pointer-events-none z-20"></div>

                          <div className="h-48 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1f] to-transparent z-10 opacity-60"></div>
                            {post.image ? (
                              <img
                                {...getResponsiveImageAttributes(post, 'card')}
                                alt={decodeEntities(post.title)}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                <Cpu className="text-white/10 w-16 h-16" />
                              </div>
                            )}
                            <div className="absolute top-4 left-4 z-20">
                              <span
                                className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-xs font-mono text-[var(--color-secondary)] uppercase tracking-wider hover:bg-[var(--color-secondary)]/10 hover:border-[var(--color-secondary)]/50 transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onCategoryClick) onCategoryClick(post.category);
                                }}
                              >
                                {post.category}
                              </span>
                            </div>
                          </div>

                          <div className="p-6 relative z-10">
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-3">
                              <span>{post.readTime || '5 min read'}</span>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-3 leading-tight line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                              <a
                                href={getPermalink(post, settings)}
                                onClick={(event) =>
                                  handleCrawlableLinkClick(event, () => {
                                    onPostClick(post.id);
                                  })
                                }
                              >
                                {decodeEntities(post.title)}
                              </a>
                            </h2>
                            <p className="text-slate-400 text-sm line-clamp-3 mb-6">
                              {decodeEntities(post.excerpt)}
                            </p>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                              <div className="flex items-center gap-2">
                                <CyberAvatar
                                  name={post.author}
                                  email={
                                    allUsers.find(
                                      (u) =>
                                        u.username === (post.author_data?.username || post.author)
                                    )?.email
                                  }
                                  url={
                                    post.author_data?.avatar ||
                                    allUsers.find(
                                      (u) =>
                                        u.username === (post.author_data?.username || post.author)
                                    )?.avatar
                                  }
                                  size="w-6 h-6"
                                />
                                <span className="text-xs text-slate-300">{post.author}</span>
                              </div>
                              <ArrowLeft className="text-[var(--color-primary)] rotate-180 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </article>

                        {/* IN-FEED AD INJECTION - Every 6 posts */}
                        {(idx + 1) % (settings.ads.inFeedFrequency || 6) === 0 &&
                          settings.ads.adsEnabled &&
                          settings.ads.inFeedAd && (
                            <div className="col-span-1 md:col-span-2 lg:col-span-3 py-6 ad-slot-flex border-y border-white/5 bg-transparent relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-30"></div>
                              <AdBlock content={settings.ads.inFeedAd} slotId="infeed" />
                            </div>
                          )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* LOAD MORE */}
                  <LoadMoreButton
                    loading={loadingMore}
                    hasMore={hasMorePosts}
                    onLoadMore={handleLoadMore}
                    label="LOAD_MORE_DATA"
                    className="font-mono"
                  />
                </>
              )}
            </>
          ) : currentView === 'page' && selectedPage ? (
            <div className="max-w-4xl mx-auto">
              <button
                onClick={handleReturnHome}
                className="mb-8 flex items-center gap-2 text-slate-400 hover:text-[var(--color-primary)] transition-colors font-mono text-sm"
              >
                <ChevronLeft size={16} /> SYSTEM.RETURN_HOME()
              </button>
              <article className="bg-[#0a0a1f]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden p-8 md:p-12 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 blur-3xl rounded-full pointer-events-none"></div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8 leading-tight tracking-tight">
                  <GlitchText text={selectedPage.title} />
                </h1>
                <ContentRenderer
                  html={sanitizeHtml(selectedPage.content)}
                  className="prose prose-invert prose-lg max-w-none"
                />
              </article>
            </div>
          ) : currentView === 'single-post' ? (
            selectedPost ? (
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={handleReturnHome}
                  className="mb-8 flex items-center gap-2 text-slate-400 hover:text-[var(--color-primary)] transition-colors font-mono text-sm"
                >
                  <ChevronLeft size={16} /> SYSTEM.RETURN_HOME()
                </button>

                <article className="bg-[#0a0a1f]/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden p-8 md:p-12 relative">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 blur-3xl rounded-full pointer-events-none"></div>

                  <header className="mb-12 relative z-10">
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                      <span
                        onClick={() => onCategoryClick && onCategoryClick(selectedPost.category)}
                        className="px-3 py-1 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] rounded text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-[var(--color-primary)]/20 transition-colors"
                      >
                        {selectedPost.category}
                      </span>
                      <span className="text-slate-500 text-sm font-mono flex items-center gap-2">
                        <span>{selectedPost.createdAt || ''}</span>
                        <span>•</span>
                        <span>{selectedPost.readTime || '5 min read'}</span>
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8 leading-tight tracking-tight">
                      <GlitchText text={decodeEntities(selectedPost.title)} />
                    </h1>
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 w-fit">
                      <CyberAvatar
                        name={selectedPost.author}
                        email={
                          allUsers.find(
                            (u) =>
                              u.username ===
                              (selectedPost.author_data?.username || selectedPost.author)
                          )?.email
                        }
                        url={
                          selectedPost.author_data?.avatar ||
                          allUsers.find(
                            (u) =>
                              u.username ===
                              (selectedPost.author_data?.username || selectedPost.author)
                          )?.avatar
                        }
                        size="w-10 h-10"
                      />
                      <div>
                        <div className="text-white font-bold text-sm">{selectedPost.author}</div>
                        <div className="text-[var(--color-secondary)] text-xs">Author / Admin</div>
                      </div>
                    </div>
                  </header>

                  {/* Only show featured image if it's not already in the content AND content doesn't start with a video */}
                  {(() => {
                    if (!selectedPost.image) return null;
                    // Check if content contains video embeds at the start
                    if (hasEmbeddedVideoMarkup(selectedPost.content)) return null;
                    // Extract filename from featured image for more reliable duplicate detection
                    const imageFilename = selectedPost.image.split('/').pop()?.split('?')[0] || '';
                    // Check if the exact URL or filename exists in content
                    const contentHasImage =
                      selectedPost.content?.includes(selectedPost.image) ||
                      (imageFilename && selectedPost.content?.includes(imageFilename));
                    if (contentHasImage) return null;
                    return (
                      <div className="w-full h-[400px] rounded-2xl overflow-hidden mb-12 border border-white/10 relative group">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1f] via-transparent to-transparent opacity-50"></div>
                        <img
                          {...getResponsiveImageAttributes(selectedPost, 'hero')}
                          alt={decodeEntities(selectedPost.title)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  })()}

                  {/* AI Summary Plugin */}
                  {aiSummaryPos === 'top' && aiSummary}

                  {/* Share Buttons (TOP) - if sharePlacement is 'top' */}
                  {settings.sharePlacement === 'top' && (
                    <div className="mb-8 pt-4 border-t border-white/10">
                      <ShareButtons
                        url={typeof window !== 'undefined' ? window.location.href : ''}
                        title={decodeEntities(selectedPost.title)}
                      />
                    </div>
                  )}

                  <ContentRenderer
                    html={sanitizeHtml(selectedPost.content)}
                    className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-slate-300 prose-a:text-[var(--color-primary)] prose-code:text-[var(--color-secondary)] prose-code:bg-black/50 prose-code:px-1 prose-code:rounded prose-pre:bg-black/80 prose-pre:border prose-pre:border-white/10"
                  />
                  {aiSummaryPos === 'bottom' && aiSummary}

                  {/* Tags */}
                  {selectedPost.keywords && (
                    <div className="mt-12 pt-8 border-t border-white/10">
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.keywords.split(',').map((tag: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 text-sm rounded-full bg-white/5 text-slate-400 hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)] transition-colors"
                          >
                            #{tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share Buttons (BOTTOM) - if sharePlacement is 'bottom' */}
                  {settings.sharePlacement === 'bottom' && (
                    <div className="mt-12 pt-8 border-t border-white/10">
                      <ShareButtons
                        url={typeof window !== 'undefined' ? window.location.href : ''}
                        title={decodeEntities(selectedPost.title)}
                      />
                    </div>
                  )}

                  {/* Related Posts Plugin */}
                  {relatedPosts}

                  <div className="mt-16 pt-8 border-t border-white/10">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <MessageSquare className="text-[var(--color-primary)]" />
                        COMMENTS_SECTION
                      </h3>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <Heart size={18} />
                        </button>
                        <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <Share2 size={18} />
                        </button>
                      </div>
                    </div>
                    <VpComments
                      comments={comments.filter(
                        (c) => String(c.postId) === String(selectedPost.id)
                      )}
                      user={user}
                      onAddComment={(content) => onAddComment(selectedPost.id, content)}
                      onLikeComment={onLikeComment}
                      onReplyComment={onReplyComment}
                      onLoadMoreComments={onLoadMoreComments}
                      hasMoreComments={hasMoreComments}
                      commentsLoading={commentsLoading}
                      commentsError={commentsError}
                      onLogin={onLogin}
                      settings={settings}
                      onViewProfile={onViewProfile}
                      themeColors={{
                        primary: colors.primary,
                      }}
                      id="prism-comments"
                    />
                  </div>
                </article>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Loader2
                  size={48}
                  className="mb-4 opacity-50 animate-spin text-[var(--color-primary)]"
                />
                <p className="font-mono animate-pulse">ACCESSING_DATABASE...</p>
              </div>
            )
          ) : currentView === 'profile' && targetProfile ? (
            <PrismProfile
              key={targetProfile.id}
              targetUser={targetProfile}
              currentUser={user}
              posts={posts}
              comments={comments}
              onBack={handleReturnHome}
              onViewPost={onPostClick}
              onNavigateAdmin={onNavigateAdmin}
              onUpdateUser={onUpdateUser}
              postsPerPage={settings.postsPerPage || 6}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <FileQuestion size={48} className="mb-4 opacity-50" />
              <p className="font-mono">ERROR_404: CONTENT_NOT_FOUND</p>
            </div>
          )}
        </main>

        <footer className="border-t border-white/10 bg-[#020205] py-12 mt-auto relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-50"></div>
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            {/* Newsletter Widget - Prism Style (Inherits theme colors) */}
            {settings.newsletter?.enabled &&
              (settings.newsletter?.position === 'footer' ||
                settings.newsletter?.position === 'both') && (
                <VonNewsletter
                  settings={settings.newsletter}
                  variant="footer"
                  accentColor={colors.primary}
                  themeColors={{
                    surface: '#0a0a1f',
                    surfaceAlt: '#050510',
                    border: 'rgba(255,255,255,0.1)',
                    text: '#cbd5e1',
                    textSecondary: '#94a3b8',
                  }}
                />
              )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <Zap className="text-[var(--color-primary)] w-5 h-5" />
                <span className="font-bold text-white tracking-wider">{settings.siteName}</span>
              </div>
              <div className="flex items-center gap-6">
                <a
                  href={rssPath}
                  className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
                  title="RSS Feed"
                >
                  <Rss size={14} />
                  <span className="text-sm font-mono">RSS</span>
                </a>
                <div className="text-slate-500 text-sm font-mono">
                  &copy; {new Date().getFullYear()} {settings.siteName} // Powered by VonCMS
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* Popup Ad */}
        <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />
      </div>
    </div>
  );
};

export default PrismLayout;
