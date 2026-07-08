import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Gravatar from 'react-gravatar';
import { Post, SiteSettings, NavItem } from '../../types';
import { Menu, X, Moon, Sun, ChevronLeft } from 'lucide-react';
import { ThemeLayoutProps } from '../types';

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

import TechPressProfile from './Profile';
import TechPressFooter from './TechPressFooter';
import { SafeImage } from '../../components/SafeImage';
import ThemeLogo from '../shared/components/ThemeLogo';
import {
  getOverflowNavigationItems,
  getVisibleNavigationItems,
  shouldUseTabletBurgerMenu,
} from '../../utils/navigation';
import { getPermalink, normalizeSiteUrl } from '../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import { isSystemPluginActive } from '../../utils/pluginRuntime';

// TechPress Avatar Component with Gravatar Support
const TechPressAvatar: React.FC<{
  url?: string;
  name: string;
  email?: string;
  size?: string;
  className?: string;
}> = ({ url, name, email, size = 'w-8 h-8', className = '' }) => {
  return (
    <div className={`${size} rounded-full overflow-hidden ${className} flex-shrink-0`}>
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

// Utility for rendering ads safely (Raw HTML) - Ads scripts might need exemptions or careful handling
// Ideally, Ads should be handled via dedicated components, but if raw HTML, we sanitize but allow scripts if needed (risk vs reward).
// For now, let's sanitize strictly for general content. Ads might break if they rely on dangerous scripts.

// ==========================================
// VON TECHPRESS THEME v1.2
// Adapted for VonCMS
// ==========================================

// ===== CONFIG HELPER =====
const getThemeConfig = (settings: SiteSettings) => {
  const defaults = {
    footerText: `Powered by VonCMS @ ${new Date().getFullYear()}. All rights reserved.`,
    enableBreaking: true,
    enableDarkMode: true,
    enableMarquee: true,
    primaryColor: settings.theme.primaryColor || '#0066cc',
    breakingNewsCount: 3,
  };
  return { ...defaults, ...settings.theme.techpress };
};

// ===== COLOR SYSTEM =====
// We use the CMS Mode (isDarkMode prop) instead of local state
const getColors = (isDark: boolean, primaryColor: string) => {
  const TECHPRESS_THEME = {
    colors: {
      primary: primaryColor,
      secondary: '#2d3748',
      accent: '#d97706',
      success: '#059669',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a202c',
      textSecondary: '#4a5568',
      border: '#e2e8f0',
    },
    darkMode: {
      background: '#121214',
      surface: '#1a1a1c',
      text: '#e4e7eb',
      textSecondary: '#9ca3af',
      border: '#2a2a2c',
    },
  };

  return {
    background: isDark ? TECHPRESS_THEME.darkMode.background : TECHPRESS_THEME.colors.background,
    surface: isDark ? TECHPRESS_THEME.darkMode.surface : TECHPRESS_THEME.colors.surface,
    surfaceAlt: isDark ? '#2a2a2c' : '#f1f4f7',
    text: isDark ? TECHPRESS_THEME.darkMode.text : TECHPRESS_THEME.colors.text,
    textSecondary: isDark
      ? TECHPRESS_THEME.darkMode.textSecondary
      : TECHPRESS_THEME.colors.textSecondary,
    border: isDark ? TECHPRESS_THEME.darkMode.border : TECHPRESS_THEME.colors.border,
    primary: TECHPRESS_THEME.colors.primary,
    secondary: TECHPRESS_THEME.colors.secondary,
    accent: TECHPRESS_THEME.colors.accent,
    success: TECHPRESS_THEME.colors.success,
  };
};

// ===== COMPONENTS =====

function BreakingNewsBanner({
  colors,
  breakingNews,
  onClick,
  enableMarquee = true,
}: {
  colors: any;
  breakingNews: Post[];
  onClick: (id: string) => void;
  enableMarquee?: boolean;
}) {
  if (!breakingNews || breakingNews.length === 0) return null;
  return (
    <div
      className="py-2.5 px-5"
      style={{
        background: colors.primary,
        borderBottom: `1px solid ${colors.isDark ? colors.border : colors.primary}`,
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-4 overflow-hidden whitespace-nowrap">
        <span
          className="bg-black text-white px-4 py-3 font-black text-xs uppercase italic tracking-tighter flex-shrink-0 z-10"
          style={{ background: colors.primary }}
        >
          BREAKING
        </span>
        <div className="flex-1 overflow-hidden">
          <div
            className={`flex gap-10 ${enableMarquee ? 'animate-marquee hover:[animation-play-state:paused]' : 'overflow-x-auto no-scrollbar'}`}
          >
            {breakingNews.map((news: Post) => (
              <span
                key={news.id}
                onClick={() => onClick(news.id)}
                className="text-white text-sm font-bold cursor-pointer hover:underline flex items-center gap-2"
              >
                <span className="opacity-50">#</span>
                {decodeEntities(news.title)}
              </span>
            ))}
            {/* Duplicate for infinite marquee effect - only if enabled */}
            {enableMarquee &&
              breakingNews.map((news: Post) => (
                <span
                  key={`${news.id}-clone`}
                  onClick={() => onClick(news.id)}
                  className="text-white text-sm font-bold cursor-pointer hover:underline flex items-center gap-2"
                >
                  <span className="opacity-50">#</span>
                  {decodeEntities(news.title)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroArticle({
  article,
  colors,
  settings,
  onClick,
  onCategoryClick,
  authorEmail,
  authorAvatar,
}: {
  article: Post;
  colors: any;
  settings: SiteSettings;
  onClick: (id: string) => void;
  onCategoryClick?: (category: string) => void;
  authorEmail?: string;
  authorAvatar?: string;
}) {
  if (!article) return null;
  return (
    <div
      className="relative overflow-hidden rounded-xl group cursor-pointer border"
      style={{ background: colors.surface, borderColor: colors.border }}
      onClick={() => onClick(article.id)}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Image Side - Standardized 16:9 Aspect Ratio for Premium Look */}
        <a
          href={getPermalink(article, settings)}
          onClick={(event) =>
            handleCrawlableLinkClick(event, () => {
              onClick(article.id);
            })
          }
          className="lg:w-3/5 aspect-video overflow-hidden relative block"
          aria-label={decodeEntities(article.title)}
        >
          {article.image ? (
            <img
              {...getResponsiveImageAttributes(article, 'hero')}
              alt={decodeEntities(article.title)}
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900" />
          )}
          {/* Gradient overlay for mobile */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden" />
        </a>

        {/* Content Side - Fixed 2/5 width */}
        <div className="lg:w-2/5 p-6 lg:p-8 flex flex-col justify-center relative">
          {/* Accent bar - similar to Digest */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-20 rounded-r hidden lg:block"
            style={{ backgroundColor: colors.primary }}
          />

          <div className="flex gap-2 mb-4">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onCategoryClick && onCategoryClick(article.category);
              }}
              className="px-3 py-1 text-xs font-bold uppercase rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: colors.primary, color: 'white' }}
            >
              {article.category || 'News'}
            </span>
            <span
              className="px-3 py-1 text-xs font-bold uppercase rounded"
              style={{ background: colors.accent, color: 'white' }}
            >
              FEATURED
            </span>
          </div>

          <h1
            className="text-lg sm:text-2xl lg:text-4xl font-black mb-4 leading-tight tracking-tight group-hover:opacity-80 transition-opacity"
            style={{ color: colors.text }}
          >
            <a
              href={getPermalink(article, settings)}
              onClick={(event) =>
                handleCrawlableLinkClick(event, () => {
                  onClick(article.id);
                })
              }
            >
              {decodeEntities(article.title)}
            </a>
          </h1>

          <p
            className="text-base lg:text-lg mb-6 line-clamp-3 leading-relaxed"
            style={{ color: colors.textSecondary }}
          >
            {decodeEntities(article.excerpt)}
          </p>

          <div className="flex items-center gap-3">
            <TechPressAvatar
              name={article.author}
              email={authorEmail}
              url={authorAvatar}
              size="w-10 h-10"
            />
            <div>
              <p className="font-semibold text-sm" style={{ color: colors.text }}>
                {article.author}
              </p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                {new Date(article.createdAt || '').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                · {article.readTime || '5 min read'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsCard({
  article,
  colors,
  layout = 'horizontal',
  settings,
  onClick,
  onCategoryClick,
  authorEmail,
  authorAvatar,
  rankLabel,
}: {
  article: Post;
  colors: any;
  layout?: 'horizontal' | 'vertical' | 'minimal';
  settings: SiteSettings;
  onClick: (id: string) => void;
  onCategoryClick?: (category: string) => void;
  authorEmail?: string;
  authorAvatar?: string;
  rankLabel?: string;
}) {
  if (layout === 'vertical') {
    return (
      <div
        className="overflow-hidden rounded-lg group transition-all duration-200 border hover:shadow-lg flex flex-col h-full"
        style={{ background: colors.background, borderColor: colors.border }}
      >
        <a
          href={getPermalink(article, settings)}
          onClick={(event) =>
            handleCrawlableLinkClick(event, () => {
              onClick(article.id);
            })
          }
          className="aspect-video transition-opacity duration-300 group-hover:opacity-90 bg-gray-200 overflow-hidden relative cursor-pointer"
          aria-label={decodeEntities(article.title)}
        >
          {article.image && (
            <img
              {...getResponsiveImageAttributes(article, 'card')}
              alt={decodeEntities(article.title)}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {rankLabel && (
            <span
              className="absolute left-3 top-3 rounded-md px-2.5 py-1 text-sm font-black tracking-tight text-white shadow-lg"
              style={{ background: colors.primary }}
            >
              {rankLabel}
            </span>
          )}
        </a>

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex gap-2 mb-3">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onCategoryClick && onCategoryClick(article.category);
              }}
              className="px-2 py-1 text-xs font-bold uppercase rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: colors.primary, color: 'white' }}
            >
              {article.category || 'Tech'}
            </span>
          </div>
          <h3
            className="text-xl font-bold mb-3 leading-tight group-hover:opacity-70 transition line-clamp-3 cursor-pointer min-h-[4.5rem]"
            style={{ color: colors.text }}
          >
            <a
              href={getPermalink(article, settings)}
              onClick={(event) =>
                handleCrawlableLinkClick(event, () => {
                  onClick(article.id);
                })
              }
            >
              {decodeEntities(article.title)}
            </a>
          </h3>

          <p
            onClick={() => onClick(article.id)}
            className="mb-4 flex-1 line-clamp-3 cursor-pointer"
            style={{ color: colors.textSecondary, fontSize: '1rem', lineHeight: 1.7 }}
          >
            {decodeEntities(article.excerpt)}
          </p>
          <div
            className="flex items-center gap-3 text-sm font-medium mt-auto"
            style={{ color: colors.textSecondary }}
          >
            <TechPressAvatar
              name={article.author}
              email={authorEmail}
              url={authorAvatar}
              size="w-6 h-6"
            />
            <span className="font-semibold">{article.author}</span>
            <span>•</span>
            <span>{new Date(article.createdAt || article.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex flex-col sm:flex-row gap-5 p-4 rounded-lg group transition-all duration-200 border hover:shadow-md"
      style={{ background: colors.background, borderColor: colors.border }}
    >
      <a
        href={getPermalink(article, settings)}
        onClick={(event) =>
          handleCrawlableLinkClick(event, () => {
            onClick(article.id);
          })
        }
        className="w-full sm:w-64 aspect-video rounded-lg flex-shrink-0 transition-opacity duration-300 group-hover:opacity-90 bg-gray-200 overflow-hidden relative cursor-pointer"
        aria-label={decodeEntities(article.title)}
      >
        {article.image && (
          <img
            {...getResponsiveImageAttributes(article, 'card')}
            alt={decodeEntities(article.title)}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </a>

      <div className="flex-1">
        <div className="flex gap-2 mb-2">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick && onCategoryClick(article.category);
            }}
            className="px-2 py-1 text-xs font-bold uppercase rounded cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: colors.primary, color: 'white' }}
          >
            {article.category || 'News'}
          </span>
        </div>
        <h3
          className="text-lg font-bold mb-2 leading-tight group-hover:opacity-70 transition line-clamp-2 cursor-pointer"
          style={{ color: colors.text }}
        >
          <a
            href={getPermalink(article, settings)}
            onClick={(event) =>
              handleCrawlableLinkClick(event, () => {
                onClick(article.id);
              })
            }
          >
            {decodeEntities(article.title)}
          </a>
        </h3>
        <div className="flex items-center gap-3 text-sm" style={{ color: colors.textSecondary }}>
          <TechPressAvatar
            name={article.author}
            email={authorEmail}
            url={authorAvatar}
            size="w-5 h-5"
          />
          <span>{article.author}</span>
          <span>•</span>
          <span>{new Date(article.createdAt || '').toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN LAYOUT =====

const TechPressLayout: React.FC<ThemeLayoutProps> = ({
  posts,
  pages = [],
  settings,
  isDarkMode: globalDarkMode,
  toggleDarkMode,
  onPostClick,
  currentView,
  selectedPost,
  selectedPage,
  user,
  onLogin,
  onLogout,
  onNavigateAdmin,
  onBackToHome,
  onPageClick,
  selectedProfile,
  onViewProfile,
  allUsers,
  onUpdateUser,
  comments,
  onAddComment,
  onLikeComment,
  onReplyComment,
  selectedCategory,
  onCategoryClick,
  onClearSearch,
}) => {
  const config = getThemeConfig(settings);
  // Use global dark mode unless theme forces something else (but we sync with global for better UX)
  const isDark = globalDarkMode;
  const colors = getColors(isDark, config.primaryColor);
  const footerColors = getColors(true, config.primaryColor); // Premium Dark Footer

  // Search State
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  // Load More State (replaces numbered pagination)
  const postsPerPage = settings.postsPerPage || 6;

  const handleClearSearch = useCallback(() => {
    setActiveSearchQuery('');
    if (onClearSearch) onClearSearch();
  }, [onClearSearch]);

  const handleReturnHome = useCallback(() => {
    onBackToHome();
    setActiveSearchQuery('');
  }, [onBackToHome]);

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigationItems = settings.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationClassName = `${
    useTabletBurgerMenu ? 'hidden lg:flex' : 'hidden md:flex'
  } items-center gap-6 text-sm font-semibold`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  // Shared Hooks (v1.9.5)
  const { showPopup, closePopup } = useAdsPopup(settings.ads);
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);
  useClickOutside(
    dropdownRef,
    useCallback(() => setShowUserDropdown(false), []),
    showUserDropdown
  );

  const handleSearch = (query: string) => {
    setActiveSearchQuery(query);
  };

  // Filter published posts
  const publishedPosts = useMemo(() => posts.filter((p) => p.status === 'published'), [posts]);

  const publicPosts = usePublicPostsQuery({
    initialPosts: publishedPosts,
    category: selectedCategory,
    search: activeSearchQuery,
    limit: postsPerPage,
  });

  const displayedPosts = publicPosts.posts;

  // Reset visible count when filters change
  useEffect(() => {
    setActiveSearchQuery((currentQuery) =>
      currentView === 'home' && currentQuery ? '' : currentQuery
    );
  }, [currentView, postsPerPage]);

  const paginatedPosts = publicPosts.posts;
  const hasMorePosts = publicPosts.hasMore;
  const handleLoadMore = publicPosts.loadMore;
  const loadingMore = publicPosts.loadingMore;
  const isInitialDiscoveryLoading = publicPosts.isLoading && paginatedPosts.length === 0;
  const hasNoDiscoveryPosts = !isInitialDiscoveryLoading && paginatedPosts.length === 0;
  const noDiscoveryTitle = selectedCategory
    ? 'No stories found in this category'
    : activeSearchQuery
      ? `No stories found for "${activeSearchQuery}"`
      : 'No stories found';

  const handleResetDiscovery = useCallback(() => {
    if (selectedCategory) {
      handleReturnHome();
      return;
    }
    handleClearSearch();
  }, [handleClearSearch, handleReturnHome, selectedCategory]);

  // 1. Hero: Latest Featured or just latest
  const heroArticle = displayedPosts[0];
  // 2. Breaking: Top N items based on config
  const breakingNews = config.enableBreaking
    ? publishedPosts.slice(0, config.breakingNewsCount || 3)
    : [];
  const storyPosts = heroArticle ? paginatedPosts.slice(1) : paginatedPosts;
  // 3. Trending: Items after hero (first 4) -> Full Width Row
  const trendingNews = storyPosts.slice(0, 4);
  // 4. Latest: Remaining items after hero and trending
  const latestNews = storyPosts.slice(4);

  const handleNavClick = (nav: NavItem) => {
    if (nav.url === 'home' || nav.url === '/') {
      handleReturnHome();
    } else if (nav.url.startsWith('page:') && onPageClick) {
      const pageId = nav.url.split(':')[1];
      const pg = pages.find((p) => p.id === pageId);
      onPageClick(pg?.slug || pageId);
    } else if (nav.url.startsWith('post:') && onPostClick) {
      onPostClick(nav.url.split(':')[1]);
    } else {
      window.location.href = normalizeSiteUrl(nav.url);
    }
  };

  // Header Logic (wrapped in useMemo to prevent re-creation and input focus loss)
  const Header = useMemo(
    () => () => (
      <header
        className="sticky top-0 z-50 backdrop-blur-md transition-all duration-300 border-b"
        style={{
          background: isDark ? 'rgba(18, 18, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: colors.border,
        }}
      >
        <ProseDarkModeStyles />
        <div className="max-w-7xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div
              className="min-w-0 max-w-[58%] md:max-w-[320px] flex items-center gap-3 cursor-pointer"
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
                  className="!w-10 !h-10 md:!w-12 md:!h-12 !mr-0 flex-shrink-0"
                />
              )}
              {!settings.useLogoAsTitle && (
                <div className="min-w-0 flex-1">
                  <h1
                    className="text-base sm:text-lg md:text-xl lg:text-2xl font-black leading-none tracking-tight truncate"
                    style={{ color: colors.text }}
                    title={settings.siteName}
                  >
                    {settings.siteName}
                  </h1>
                  {settings.siteDescription && (
                    <p
                      className="text-xs mt-1 font-medium hidden md:block truncate opacity-80"
                      style={{ color: colors.textSecondary }}
                      title={settings.siteDescription}
                    >
                      {settings.siteDescription}
                    </p>
                  )}
                </div>
              )}
            </div>

            <nav className={desktopNavigationClassName}>
              {visibleNavigationItems.map((nav: NavItem) => (
                <button
                  key={nav.id}
                  onClick={() => handleNavClick(nav)}
                  className="hover:opacity-70 transition bg-transparent border-0 cursor-pointer"
                  style={{ color: colors.text }}
                >
                  {nav.label}
                </button>
              ))}
              {/* More Dropdown */}
              {overflowNavigationItems.length > 0 && (
                <div className="relative group">
                  <button
                    className="hover:opacity-70 transition bg-transparent border-0 cursor-pointer flex items-center gap-1"
                    style={{ color: colors.text }}
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
                    style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                  >
                    {overflowNavigationItems.map((nav: NavItem) => (
                      <button
                        key={nav.id}
                        onClick={() => handleNavClick(nav)}
                        className="w-full px-4 py-2 text-left text-sm hover:opacity-70 transition"
                        style={{ color: colors.text }}
                      >
                        {nav.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  {/* User Avatar Button */}
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:opacity-80"
                    style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                    aria-label="User Menu"
                  >
                    <TechPressAvatar
                      url={user.avatar}
                      name={user.username}
                      email={user.email}
                      size="w-8 h-8"
                    />
                    <span
                      className="text-sm font-medium hidden sm:block"
                      style={{ color: colors.text }}
                    >
                      {user.username}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
                      style={{ color: colors.textSecondary }}
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
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-lg shadow-2xl border overflow-hidden z-50 animate-fade-in"
                      style={{ background: colors.surface, borderColor: colors.border }}
                    >
                      {/* User Info Header */}
                      <div className="p-4 border-b" style={{ borderColor: colors.border }}>
                        <div className="flex items-center gap-3">
                          <TechPressAvatar
                            url={user.avatar}
                            name={user.username}
                            email={user.email}
                            size="w-10 h-10"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-bold text-sm truncate"
                              style={{ color: colors.text }}
                            >
                              {user.username}
                            </p>
                            <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
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
                          className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3"
                          style={{ color: colors.text }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                            className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3"
                            style={{ color: colors.text }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = colors.border)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                        <div className="my-2 border-t" style={{ borderColor: colors.border }}></div>

                        {/* Logout */}
                        <button
                          onClick={() => {
                            onLogout();
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 text-red-600 dark:text-red-400"
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                  className="px-5 py-2 rounded text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: colors.primary, color: 'white' }}
                >
                  Login
                </button>
              )}

              {config.enableDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="w-10 h-10 rounded flex items-center justify-center transition-all hover:opacity-70 border"
                  style={{ background: colors.surface, borderColor: colors.border }}
                  aria-label="Toggle Dark Mode"
                >
                  {isDark ? (
                    <Moon size={18} className="text-blue-400" />
                  ) : (
                    <Sun size={18} className="text-amber-500" />
                  )}
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`${compactNavigationClassName} w-10 h-10 rounded flex items-center justify-center transition-all hover:opacity-70 border`}
                style={{
                  background: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div
              className={`${compactNavigationClassName} border-t mt-4 py-4 animate-fade-in`}
              style={{ borderColor: colors.border }}
            >
              <nav className="flex flex-col gap-2">
                {navigationItems.map((nav: NavItem) => (
                  <button
                    key={nav.id}
                    onClick={() => {
                      handleNavClick(nav);
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-left px-4 py-3 rounded hover:opacity-70 transition font-semibold"
                    style={{ color: colors.text, background: colors.surface }}
                  >
                    {nav.label}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
    ),
    [
      colors,
      settings,
      user,
      isDark,
      config,
      handleReturnHome,
      onNavigateAdmin,
      onLogin,
      toggleDarkMode,
      onViewProfile,
      activeSearchQuery,
      handleClearSearch,
      currentView,
    ]
  );

  // Plugin Hooks (v1.9.9) - Hooks must be at top level
  // Note: We use selectedPost.content if available, but hooks need consistent calls
  const { component: aiSummary, position: aiSummaryPos } = useAISummary(
    settings,
    selectedPost?.content || ''
  ) || { component: null, position: 'top' };
  const relatedPosts = useRelatedPosts(
    settings,
    selectedPost as any,
    posts,
    (p) => onPostClick && onPostClick(p.id),
    {
      primary: colors.primary,
      secondary: colors.textSecondary,
      surface: colors.surface,
      surfaceAlt: colors.surfaceAlt,
      border: colors.border,
      text: colors.text,
      textSecondary: colors.textSecondary,
    }
  );

  // Single Post View
  // Derive targetProfile for VonSEO (same logic as used for profile view)
  const targetProfileForSEO = selectedProfile
    ? allUsers.find((u) => u.username === selectedProfile) ||
      (user && user.username === selectedProfile ? user : null)
    : null;
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');

  if (currentView === 'single-post' && selectedPost) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={{ background: colors.background, color: colors.text }}
      >
        {shouldRenderVonSEO && (
          <VonSEO
            settings={settings}
            currentView={currentView}
            selectedPost={selectedPost}
            selectedPage={selectedPage}
            selectedProfile={targetProfileForSEO}
          />
        )}
        <Header />
        {/* HEADER AD SLOT */}
        {settings.ads.adsEnabled && settings.ads.headerAd && (
          <div
            className="py-8 border-b"
            style={{
              background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              borderColor: colors.border,
            }}
          >
            <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-5 py-12 flex-1 w-full">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <main className="flex-1 w-full lg:max-w-[calc(100%-370px)] min-w-0">
              <button
                onClick={handleReturnHome}
                className="mb-10 font-bold text-sm hover:underline flex items-center gap-2 transition-opacity hover:opacity-70"
                style={{ color: colors.textSecondary }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Home
              </button>

              <article className="mb-16">
                <header className="mb-8">
                  <span
                    onClick={() => onCategoryClick && onCategoryClick(selectedPost.category)}
                    className="inline-block px-3 py-1 mb-6 text-xs font-black uppercase tracking-widest rounded"
                    style={{ background: colors.primary, color: 'white' }}
                  >
                    {selectedPost.category || 'Lifestyle'}
                  </span>
                  <h1
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-8 leading-tight tracking-tight"
                    style={{ color: colors.text }}
                  >
                    {decodeEntities(selectedPost.title)}
                  </h1>

                  <div
                    className="flex items-center gap-6 text-sm font-bold pb-8 border-b"
                    style={{ color: colors.textSecondary, borderColor: colors.border }}
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        onViewProfile(selectedPost.author_data?.username || selectedPost.author)
                      }
                    >
                      <TechPressAvatar
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
                        size="w-12 h-12"
                      />
                      <div className="flex flex-col">
                        <span className="font-black text-base" style={{ color: colors.text }}>
                          {selectedPost.author}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            {new Date(
                              selectedPost.createdAt || selectedPost.updatedAt
                            ).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] opacity-60">•</span>
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            {selectedPost.readTime || '5 min read'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                {/* Featured Image - News Portal Style (Now placed BELOW title) */}
                {(() => {
                  if (!selectedPost.image) return null;
                  const imageFilename = selectedPost.image.split('/').pop()?.split('?')[0] || '';
                  const contentHasImage =
                    selectedPost.content?.includes(selectedPost.image) ||
                    (imageFilename && selectedPost.content?.includes(imageFilename));
                  // Fix: Hide featured image if content likely has a video (iframe or video tag)
                  // This prevents double visuals (thumbnail + video player)
                  const contentHasVideo = hasEmbeddedVideoMarkup(selectedPost.content);

                  if (contentHasImage || contentHasVideo) return null;
                  return (
                    <div
                      className="w-full h-[300px] md:h-[550px] overflow-hidden rounded-xl mb-8 shadow-md border"
                      style={{ borderColor: colors.border }}
                    >
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

                {/* Share Buttons (TOP) */}
                {settings.sharePlacement === 'top' && (
                  <div className="mb-8">
                    <ShareButtons
                      url={typeof window !== 'undefined' ? window.location.href : ''}
                      title={decodeEntities(selectedPost.title)}
                    />
                  </div>
                )}

                <ContentRenderer
                  html={sanitizeHtml(selectedPost.content)}
                  className="prose prose-lg md:prose-xl dark:prose-invert max-w-none prose-img:rounded-xl [&_img]:w-full [&_img]:h-auto [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-xl prose-p:leading-relaxed dark:prose-p:text-neutral-200 dark:prose-headings:text-white dark:prose-strong:text-white dark:prose-li:text-neutral-200"
                  style={
                    {
                      color: colors.text,
                      '--tw-prose-headings': colors.text,
                      '--tw-prose-body': colors.text,
                    } as any
                  }
                />
                {aiSummaryPos === 'bottom' && aiSummary}

                {/* Related Posts Plugin */}

                {/* Share Buttons (BOTTOM) */}
                {settings.sharePlacement === 'bottom' && (
                  <div className="mt-16 pt-8 border-t" style={{ borderColor: colors.border }}>
                    <ShareButtons
                      url={typeof window !== 'undefined' ? window.location.href : ''}
                      title={decodeEntities(selectedPost.title)}
                    />
                  </div>
                )}

                {/* Keywords/Tags Section */}
                {selectedPost.keywords && (
                  <div className="mt-12 pt-8 border-t" style={{ borderColor: colors.border }}>
                    <h4
                      className="text-xs font-black uppercase tracking-widest mb-4 opacity-50"
                      style={{ color: colors.textSecondary }}
                    >
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPost.keywords.split(',').map((keyword: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-4 py-2 text-sm font-bold border rounded-lg cursor-pointer transition-colors hover:bg-opacity-10 hover:bg-gray-500"
                          style={{ borderColor: colors.border, color: colors.text }}
                        >
                          #{keyword.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Posts Plugin */}
                {relatedPosts}
              </article>

              {/* Comments Section - Integrated Cleanly */}
              <div className="mt-20 pt-12 border-t" style={{ borderColor: colors.border }}>
                <h3 className="text-3xl font-black mb-10 tracking-tight">Discussion</h3>
                <div
                  className="not-prose p-6 md:p-10 rounded-2xl border-2 shadow-sm"
                  style={{ borderColor: colors.border, background: colors.surface }}
                >
                  <VpComments
                    comments={comments.filter((c) => c.postId === selectedPost.id)}
                    user={user}
                    onAddComment={(content) => onAddComment(selectedPost.id, content)}
                    onLikeComment={onLikeComment}
                    onReplyComment={onReplyComment}
                    onLogin={onLogin}
                    settings={settings}
                    onViewProfile={onViewProfile}
                    themeColors={{
                      surface: isDark ? 'rgba(0,0,0,0.2)' : colors.surfaceAlt,
                      surfaceAlt: isDark ? 'rgba(0,0,0,0.3)' : colors.background,
                      border: colors.border,
                      text: colors.text,
                      textSecondary: colors.textSecondary,
                      primary: colors.primary,
                    }}
                    id="techpress-comments"
                  />
                </div>
              </div>
            </main>

            {/* Sidebar */}
            <aside className="w-full lg:w-[350px] flex-shrink-0 space-y-8 lg:sticky lg:top-32 h-fit">
              {/* Newsletter Widget */}
              {settings.newsletter?.enabled &&
                (settings.newsletter?.position === 'sidebar' ||
                  settings.newsletter?.position === 'both') && (
                  <VonNewsletter
                    settings={settings.newsletter}
                    variant="sidebar"
                    accentColor={colors.primary}
                    themeColors={{
                      surface: colors.surface,
                      surfaceAlt: colors.surfaceAlt,
                      border: colors.border,
                      text: colors.text,
                      textSecondary: colors.textSecondary,
                    }}
                  />
                )}
              {settings.sidebarLayout
                .filter((widget: any) => widget.isVisible !== false && widget.type !== 'search')
                .map((widget: any) => (
                  <VpSidebarWidget
                    key={widget.id}
                    widget={widget}
                    settings={settings}
                    posts={posts}
                    onPostClick={onPostClick}
                    currentPostId={selectedPost?.id}
                    themeColors={{
                      surface: colors.surface,
                      border: colors.border,
                      text: colors.text,
                      textSecondary: colors.textSecondary,
                    }}
                  />
                ))}
            </aside>
          </div>
        </div>

        {/* Footer */}
        <TechPressFooter settings={settings} colors={isDark ? colors : footerColors} />
      </div>
    );
  }

  // Page View
  if (currentView === 'page' && selectedPage) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={{ background: colors.background, color: colors.text }}
      >
        {shouldRenderVonSEO && (
          <VonSEO
            settings={settings}
            currentView={currentView}
            selectedPost={selectedPost}
            selectedPage={selectedPage}
            selectedProfile={targetProfileForSEO}
          />
        )}
        <Header />
        {/* HEADER AD SLOT */}
        {settings.ads.adsEnabled && settings.ads.headerAd && (
          <div
            className="py-8 border-b"
            style={{
              background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              borderColor: colors.border,
            }}
          >
            <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-5 py-12 flex-1 w-full">
          <div className="flex flex-col lg:flex-row gap-8 justify-center">
            <main className="w-full max-w-4xl">
              <button
                onClick={handleReturnHome}
                className="mb-8 font-bold text-sm hover:underline flex items-center gap-1"
                style={{ color: colors.textSecondary }}
              >
                <ChevronLeft size={16} /> Back to Home
              </button>
              <h1
                className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
                style={{ color: colors.text }}
              >
                {selectedPage.title}
              </h1>
              <ContentRenderer
                html={sanitizeHtml(selectedPage.content)}
                className="prose prose-lg dark:prose-invert max-w-none"
                style={{ color: colors.text }}
              />
            </main>
          </div>
        </div>

        {/* Footer */}
        <TechPressFooter settings={settings} colors={isDark ? colors : footerColors} />
      </div>
    );
  }

  // Profile View
  if (currentView === 'profile' && targetProfile) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={{ background: colors.background, color: colors.text }}
      >
        {shouldRenderVonSEO && (
          <VonSEO
            settings={settings}
            currentView={currentView}
            selectedPost={selectedPost}
            selectedPage={selectedPage}
            selectedProfile={targetProfileForSEO}
          />
        )}
        <Header />
        <main className="max-w-5xl mx-auto px-5 py-12 flex-1 w-full">
          <button
            onClick={handleReturnHome}
            className="mb-8 font-bold text-sm hover:underline flex items-center gap-1"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} /> Back to Home
          </button>
          <TechPressProfile
            key={targetProfile.id}
            targetUser={targetProfile}
            currentUser={user}
            onBack={handleReturnHome}
            onViewPost={onPostClick}
            posts={posts} // TechPressProfile does the filtering itself based on author name
            comments={comments}
            onNavigateAdmin={onNavigateAdmin}
            onUpdateUser={onUpdateUser}
            colors={colors}
            postsPerPage={settings.postsPerPage || 6}
          />
        </main>
        {/* Footer */}
        <TechPressFooter settings={settings} colors={isDark ? colors : footerColors} />
      </div>
    );
  }

  // Home View OR Category View
  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark' : ''}`}
      style={{ background: colors.background, color: colors.text }}
    >
      {/* SEO Injector */}
      {shouldRenderVonSEO && (
        <VonSEO
          settings={settings}
          currentView={currentView}
          selectedPost={selectedPost}
          selectedPage={selectedPage}
          selectedProfile={targetProfileForSEO}
          selectedCategory={selectedCategory}
        />
      )}
      {config.enableBreaking && !selectedCategory && !activeSearchQuery && (
        <BreakingNewsBanner
          colors={colors}
          breakingNews={breakingNews}
          onClick={onPostClick}
          enableMarquee={config.enableMarquee}
        />
      )}

      <Header />

      {selectedCategory && (
        <div
          className="max-w-7xl mx-auto px-5 py-8 border-b text-center relative"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-3xl font-black mb-2" style={{ color: colors.text }}>
            Category: <span style={{ color: colors.primary }}>{selectedCategory}</span>
          </h2>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (onCategoryClick) onCategoryClick('');
              else window.location.href = '/';
            }}
            className="text-sm font-bold hover:underline"
            style={{ color: colors.textSecondary }}
          >
            View All Stories
          </button>
        </div>
      )}

      {/* Search Bar Section - Standalone for better performance */}
      <div className="max-w-7xl mx-auto px-5 py-4 border-b" style={{ borderColor: colors.border }}>
        <div className="max-w-2xl mx-auto relative">
          <input
            aria-label="Search articles"
            id="techpress-search"
            name="search"
            type="text"
            placeholder="Search articles by title, content, or category..."
            value={activeSearchQuery}
            maxLength={PUBLIC_SEARCH_MAX_LENGTH}
            onChange={(e) => handleSearch(normalizePublicSearchInput(e.target.value))}
            className="w-full px-5 py-3 rounded-full text-sm outline-none transition-all border shadow-sm"
            style={{
              background: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            }}
          />
          {activeSearchQuery.length >= PUBLIC_SEARCH_MAX_LENGTH && (
            <p className="mt-2 text-center text-xs font-semibold" style={{ color: colors.accent }}>
              Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
            </p>
          )}
          {activeSearchQuery ? (
            <button
              onClick={handleClearSearch}
              className="absolute right-5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
              style={{ color: colors.text }}
              title="Clear Search"
            >
              <X size={20} />
            </button>
          ) : (
            <svg
              className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
              style={{ color: colors.textSecondary }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* HEADER AD SLOT */}
      {settings.ads.adsEnabled && settings.ads.headerAd && (
        <div
          className="py-8 border-b"
          style={{
            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderColor: colors.border,
          }}
        >
          <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
            <AdBlock content={settings.ads.headerAd} slotId="header" />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-5 py-8">
        {isInitialDiscoveryLoading ? (
          <div
            className="py-20 text-center border rounded-2xl"
            style={{ borderColor: colors.border, color: colors.textSecondary }}
          >
            <p className="text-sm font-black uppercase tracking-[0.3em]">Loading stories...</p>
          </div>
        ) : hasNoDiscoveryPosts ? (
          <div
            className="py-20 px-6 text-center border rounded-2xl"
            style={{ borderColor: colors.border, color: colors.textSecondary }}
          >
            <p className="text-xl font-black mb-3" style={{ color: colors.text }}>
              {noDiscoveryTitle}
            </p>
            <p className="text-sm mb-6">Try another category or return to all stories.</p>
            {(selectedCategory || activeSearchQuery) && (
              <button
                type="button"
                onClick={handleResetDiscovery}
                className="inline-flex items-center justify-center px-5 py-2 text-sm font-black text-white transition-opacity hover:opacity-90"
                style={{ background: colors.primary }}
              >
                View All Stories
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-12">
              <HeroArticle
                article={heroArticle}
                colors={colors}
                settings={settings}
                onClick={onPostClick}
                onCategoryClick={onCategoryClick}
                authorEmail={allUsers.find((u) => u.username === heroArticle?.author)?.email}
                authorAvatar={
                  heroArticle?.author_data?.avatar ||
                  allUsers.find((u) => u.username === heroArticle?.author)?.avatar
                }
              />
            </div>

            {/* Top Stories - latest posts after hero, presented as a ranked editorial row. */}
            <div className="mb-12">
              <div
                className="flex items-center justify-between mb-6 pb-3 border-b"
                style={{ borderColor: colors.border }}
              >
                <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                  Top Stories
                </h2>
              </div>
              {/* Changed grid-cols-3 to grid-cols-4 for better tablet/desktop balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {trendingNews.map((article: Post, index: number) => (
                  <NewsCard
                    key={article.id}
                    article={article}
                    colors={colors}
                    settings={settings}
                    layout="vertical"
                    rankLabel={String(index + 1).padStart(2, '0')}
                    onClick={onPostClick}
                    onCategoryClick={onCategoryClick}
                    authorEmail={
                      allUsers.find(
                        (u) => u.username === (article.author_data?.username || article.author)
                      )?.email
                    }
                    authorAvatar={
                      article.author_data?.avatar ||
                      allUsers.find(
                        (u) => u.username === (article.author_data?.username || article.author)
                      )?.avatar
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1">
                <div className="mb-6 pb-3 border-b" style={{ borderColor: colors.border }}>
                  <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                    Latest Updates
                  </h2>
                </div>
                <div className="space-y-4">
                  {latestNews.map((article: Post, idx: number) => (
                    <React.Fragment key={article.id}>
                      <NewsCard
                        article={article}
                        colors={colors}
                        settings={settings}
                        layout="horizontal"
                        onClick={onPostClick}
                        onCategoryClick={onCategoryClick}
                        authorEmail={
                          allUsers.find(
                            (u) => u.username === (article.author_data?.username || article.author)
                          )?.email
                        }
                        authorAvatar={
                          article.author_data?.avatar ||
                          allUsers.find(
                            (u) => u.username === (article.author_data?.username || article.author)
                          )?.avatar
                        }
                      />
                      {/* IN-FEED AD INJECTION - Every 6 posts */}
                      {(idx + 1) % (settings.ads.inFeedFrequency || 6) === 0 &&
                        settings.ads.adsEnabled &&
                        settings.ads.inFeedAd && (
                          <div
                            className="w-full py-8 my-4 border-y ad-slot-flex"
                            style={{ borderColor: colors.border, background: 'transparent' }}
                          >
                            <AdBlock content={settings.ads.inFeedAd} slotId="infeed" />
                          </div>
                        )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Load More Button - Integrated here to stay above sidebar on mobile */}
                <div className="mt-12">
                  <LoadMoreButton
                    loading={loadingMore}
                    hasMore={hasMorePosts}
                    onLoadMore={handleLoadMore}
                    label="Load More Articles"
                    style={{ background: colors.primary }}
                  />
                </div>
              </div>

              <aside className="w-full lg:w-[350px] flex-shrink-0 space-y-6">
                {/* Dynamic Widgets */}
                {settings.sidebarLayout
                  .filter((widget: any) => widget.isVisible !== false)
                  .map((widget: any) => (
                    <VpSidebarWidget
                      key={widget.id}
                      widget={widget}
                      settings={settings}
                      posts={posts}
                      onPostClick={onPostClick}
                      currentPostId={selectedPost?.id}
                      themeColors={{
                        surface: colors.surface,
                        border: colors.border,
                        text: colors.text,
                        textSecondary: colors.textSecondary,
                      }}
                    />
                  ))}
              </aside>
            </div>
          </>
        )}
      </main>

      <TechPressFooter settings={settings} colors={isDark ? colors : footerColors} />

      {/* Popup Ad */}
      <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />
    </div>
  );
};

export default TechPressLayout;
