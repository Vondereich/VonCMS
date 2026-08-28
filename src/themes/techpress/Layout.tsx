import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  PublicDiscoverySkeleton,
  PublicDiscoveryRefreshStatus,
  hasActiveSidebarContent,
  getResponsiveImageAttributes,
  formatDate,
  formatDateTime,
  getPostPublishTimestamp,
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
import {
  getHeaderIdentityState,
  getPermalink,
  getPublicCategoryHref,
  getPublicHomeHref,
  getPublicProfileHref,
  getSameSiteCategoryNavigation,
  normalizeSiteUrl,
} from '../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import PublicNavigationLink from '../shared/components/PublicNavigationLink';
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
    <div className={`${size} rounded-full overflow-hidden ${className} shrink-0`}>
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

const getReadableForeground = (color: string): string => {
  const compactHex = color.trim().replace(/^#/, '');
  const normalizedHex =
    compactHex.length === 3
      ? compactHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : compactHex;

  if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
    return '#ffffff';
  }

  const channels = [0, 2, 4].map((offset) => parseInt(normalizedHex.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.055;

  return whiteContrast >= darkContrast ? '#ffffff' : '#111827';
};

// ===== COMPONENTS =====

function LatestTickerBanner({
  colors,
  latestTickerItems,
  settings,
  onClick,
  enableMarquee = true,
}: {
  colors: any;
  latestTickerItems: Post[];
  settings: SiteSettings;
  onClick: (id: string) => void;
  enableMarquee?: boolean;
}) {
  if (!latestTickerItems || latestTickerItems.length === 0) return null;
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
          className="bg-black text-white px-4 py-3 font-black text-xs uppercase italic tracking-tighter shrink-0 z-10"
          style={{ background: colors.primary }}
        >
          LATEST
        </span>
        <div className="flex-1 overflow-hidden">
          <div
            className={`flex gap-10 ${enableMarquee ? 'animate-marquee hover:[animation-play-state:paused]' : 'overflow-x-auto no-scrollbar'}`}
          >
            {latestTickerItems.map((news: Post) => (
              <a
                key={news.id}
                href={getPermalink(news, settings)}
                onClick={(event) => handleCrawlableLinkClick(event, () => onClick(news.id))}
                className="text-white text-sm font-bold cursor-pointer hover:underline flex items-center gap-2"
              >
                <span className="opacity-50">#</span>
                {decodeEntities(news.title)}
              </a>
            ))}
            {/* Duplicate for infinite marquee effect - only if enabled */}
            {enableMarquee &&
              latestTickerItems.map((news: Post) => (
                <a
                  key={`${news.id}-clone`}
                  href={getPermalink(news, settings)}
                  onClick={(event) => handleCrawlableLinkClick(event, () => onClick(news.id))}
                  className="text-white text-sm font-bold cursor-pointer hover:underline flex items-center gap-2"
                >
                  <span className="opacity-50">#</span>
                  {decodeEntities(news.title)}
                </a>
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
              {...getResponsiveImageAttributes(article, 'portalHero')}
              alt={decodeEntities(article.title)}
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-linear-to-br from-neutral-700 to-neutral-900" />
          )}
          {/* Gradient overlay for mobile */}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent lg:hidden" />
        </a>

        {/* Content Side - Fixed 2/5 width */}
        <div className="lg:w-2/5 p-6 lg:p-8 flex flex-col justify-center relative">
          {/* Accent bar - similar to Digest */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-20 rounded-r hidden lg:block"
            style={{ backgroundColor: colors.primary }}
          />

          <div className="flex gap-2 mb-4">
            <a
              href={getPublicCategoryHref(article.category || 'News')}
              onClick={(e) => {
                e.stopPropagation();
                handleCrawlableLinkClick(e, () => onCategoryClick?.(article.category));
              }}
              className="px-3 py-1 text-xs font-bold uppercase rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: colors.primary, color: 'white' }}
            >
              {article.category || 'News'}
            </a>
            <span
              className="px-3 py-1 text-xs font-bold uppercase rounded-sm"
              style={{ background: colors.accent, color: 'white' }}
            >
              FEATURED
            </span>
          </div>

          <h1
            className="text-lg sm:text-2xl lg:text-4xl font-black mb-4 leading-tight tracking-tight line-clamp-3 group-hover:opacity-80 transition-opacity"
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
                {formatDate(
                  getPostPublishTimestamp(article),
                  settings.timeZone,
                  settings.dateFormat
                )}{' '}
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
  expandedHorizontalImage = false,
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
  expandedHorizontalImage?: boolean;
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
              {...getResponsiveImageAttributes(article, 'gridFourMd')}
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
            <a
              href={getPublicCategoryHref(article.category || 'Tech')}
              onClick={(e) => {
                e.stopPropagation();
                handleCrawlableLinkClick(e, () => onCategoryClick?.(article.category));
              }}
              className="px-2 py-1 text-xs font-bold uppercase rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: colors.primary, color: 'white' }}
            >
              {article.category || 'Tech'}
            </a>
          </div>
          <h3
            className="text-xl font-bold mb-3 leading-tight group-hover:opacity-70 transition line-clamp-2 cursor-pointer"
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
            <span>
              {formatDate(getPostPublishTimestamp(article), settings.timeZone, settings.dateFormat)}
            </span>
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
        className={`w-full ${expandedHorizontalImage ? 'sm:w-72 lg:w-80' : 'sm:w-64'} aspect-video rounded-lg shrink-0 transition-opacity duration-300 group-hover:opacity-90 bg-gray-200 overflow-hidden relative cursor-pointer`}
        aria-label={decodeEntities(article.title)}
      >
        {article.image && (
          <img
            {...getResponsiveImageAttributes(article, 'listCard')}
            alt={decodeEntities(article.title)}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </a>

      <div className="flex-1">
        <div className="flex gap-2 mb-2">
          <a
            href={getPublicCategoryHref(article.category || 'News')}
            onClick={(e) => {
              e.stopPropagation();
              handleCrawlableLinkClick(e, () => onCategoryClick?.(article.category));
            }}
            className="px-2 py-1 text-xs font-bold uppercase rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: colors.primary, color: 'white' }}
          >
            {article.category || 'News'}
          </a>
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
          <span>
            {formatDate(getPostPublishTimestamp(article), settings.timeZone, settings.dateFormat)}
          </span>
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
  onLoadMoreComments,
  hasMoreComments,
  commentsLoading,
  commentsError,
  selectedCategory,
  onCategoryClick,
  onClearSearch,
  publicSearchQuery = '',
  onPublicSearchChange,
}) => {
  const config = getThemeConfig(settings);
  // Use global dark mode unless theme forces something else (but we sync with global for better UX)
  const isDark = globalDarkMode;
  const colors = getColors(isDark, config.primaryColor);
  const footerColors = getColors(true, config.primaryColor); // Premium Dark Footer
  const techPressRootStyle = {
    background: colors.background,
    color: colors.text,
    '--color-primary': colors.primary,
    '--techpress-focus-outline': colors.text,
  } as React.CSSProperties & {
    '--color-primary': string;
    '--techpress-focus-outline': string;
  };
  const searchControlForeground = getReadableForeground(colors.primary);

  // Search State
  const activeSearchQuery = publicSearchQuery;
  // Load More State (replaces numbered pagination)
  const postsPerPage = settings.postsPerPage || 6;

  const handleClearSearch = useCallback(() => {
    onPublicSearchChange?.('');
    if (onClearSearch) onClearSearch();
  }, [onClearSearch, onPublicSearchChange]);

  const handleReturnHome = useCallback(() => {
    onBackToHome();
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
    onPublicSearchChange?.(query);
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

  const paginatedPosts = publicPosts.posts;
  const hasMorePosts = publicPosts.hasMore;
  const handleLoadMore = publicPosts.loadMore;
  const loadingMore = publicPosts.loadingMore;
  const isInitialDiscoveryLoading = publicPosts.isLoading && paginatedPosts.length === 0;
  const isCategoryRefreshing =
    Boolean(selectedCategory) && publicPosts.isLoading && paginatedPosts.length > 0;
  const hasSinglePostSidebar = hasActiveSidebarContent(settings);
  const hasHomepageSidebar = hasActiveSidebarContent(settings, { includeNewsletter: false });
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
  // 2. Latest ticker: first published items, controlled by the legacy ticker setting keys.
  const latestTickerItems = config.enableBreaking
    ? displayedPosts.slice(0, config.breakingNewsCount || 3)
    : [];
  const storyPosts = heroArticle ? paginatedPosts.slice(1) : paginatedPosts;
  // 3. Latest highlights: Items after hero (first 4) -> Full Width Row
  const latestHighlightPosts = storyPosts.slice(0, 4);
  // 4. Latest updates: Remaining items after hero and highlights
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
      const categoryTarget = getSameSiteCategoryNavigation(nav.url);
      if (categoryTarget !== null && onCategoryClick) {
        onCategoryClick(categoryTarget);
        return;
      }
      window.location.href = normalizeSiteUrl(nav.url);
    }
  };

  // Header Logic (wrapped in useMemo to prevent re-creation and input focus loss)
  const headerIdentity = useMemo(
    () => getHeaderIdentityState(settings),
    [settings.headerIdentityMode, settings.logoUrl, settings.useLogoAsTitle]
  );

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
            <a
              href={getPublicHomeHref()}
              className="min-w-0 max-w-[58%] md:max-w-[320px] flex items-center gap-3 cursor-pointer"
              onClick={(event) => handleCrawlableLinkClick(event, handleReturnHome)}
            >
              {headerIdentity.showUploadedLogo ? (
                <ThemeLogo
                  src={settings.logoUrl || ''}
                  alt={settings.siteName}
                  useLogoAsTitle={headerIdentity.logoUsesTitleSlot}
                  invertLogoInDarkMode={settings.invertLogoInDarkMode}
                  className="transition-all"
                />
              ) : headerIdentity.showFallbackMark ? (
                <VonLogo
                  variant="default"
                  className="w-10! h-10! md:w-12! md:h-12! mr-0! shrink-0"
                />
              ) : null}
              {headerIdentity.showTitle && (
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
            </a>

            <nav className={desktopNavigationClassName}>
              {visibleNavigationItems.map((nav: NavItem) => (
                <PublicNavigationLink
                  key={nav.id}
                  nav={nav}
                  settings={settings}
                  posts={posts}
                  pages={pages}
                  onNavigate={() => handleNavClick(nav)}
                  className="hover:opacity-70 transition bg-transparent border-0 cursor-pointer"
                  style={{ color: colors.text }}
                >
                  {nav.label}
                </PublicNavigationLink>
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
                    className="absolute top-full right-0 mt-2 w-48 py-2 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-50 before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:content-['']"
                    style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                  >
                    {overflowNavigationItems.map((nav: NavItem) => (
                      <PublicNavigationLink
                        key={nav.id}
                        nav={nav}
                        settings={settings}
                        posts={posts}
                        pages={pages}
                        onNavigate={() => handleNavClick(nav)}
                        className="block w-full px-4 py-2 text-left text-sm hover:opacity-70 transition"
                        style={{ color: colors.text }}
                      >
                        {nav.label}
                      </PublicNavigationLink>
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
                        <a
                          href={getPublicProfileHref(user.username)}
                          onClick={(event) =>
                            handleCrawlableLinkClick(event, () => {
                              onViewProfile(user.username);
                              setShowUserDropdown(false);
                            })
                          }
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
                        </a>

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
                  className="px-5 py-2 rounded-sm text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: colors.primary, color: 'white' }}
                >
                  Login
                </button>
              )}

              {config.enableDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="w-10 h-10 rounded-sm flex items-center justify-center transition-all hover:opacity-70 border"
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
                className={`${compactNavigationClassName} w-10 h-10 rounded-sm flex items-center justify-center transition-all hover:opacity-70 border`}
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
                  <PublicNavigationLink
                    key={nav.id}
                    nav={nav}
                    settings={settings}
                    posts={posts}
                    pages={pages}
                    onNavigate={() => {
                      handleNavClick(nav);
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-left px-4 py-3 rounded-sm hover:opacity-70 transition font-semibold"
                    style={{ color: colors.text, background: colors.surface }}
                  >
                    {nav.label}
                  </PublicNavigationLink>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
    ),
    [
      colors,
      headerIdentity,
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
    selectedPost,
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
  const targetProfileForSEO = selectedProfile ? targetProfile : null;
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');

  if (currentView === 'single-post' && selectedPost) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={techPressRootStyle}
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
          <div
            className={`flex flex-col gap-8 items-start ${hasSinglePostSidebar ? 'lg:flex-row' : ''}`}
          >
            <main
              className={`flex-1 w-full min-w-0 ${hasSinglePostSidebar ? 'lg:max-w-[calc(100%-370px)]' : 'max-w-4xl mx-auto'}`}
            >
              <a
                href={getPublicHomeHref()}
                onClick={(event) => handleCrawlableLinkClick(event, handleReturnHome)}
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
              </a>

              <article className="mb-16">
                <header className="mb-8">
                  <a
                    href={getPublicCategoryHref(selectedPost.category)}
                    onClick={(event) =>
                      handleCrawlableLinkClick(event, () =>
                        onCategoryClick?.(selectedPost.category)
                      )
                    }
                    className="inline-block px-3 py-1 mb-6 text-xs font-black uppercase tracking-widest rounded-sm"
                    style={{ background: colors.primary, color: 'white' }}
                  >
                    {selectedPost.category || 'Lifestyle'}
                  </a>
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
                    <a
                      href={getPublicProfileHref(
                        selectedPost.author_data?.username || selectedPost.author
                      )}
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(event) =>
                        handleCrawlableLinkClick(event, () =>
                          onViewProfile(selectedPost.author_data?.username || selectedPost.author)
                        )
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
                      <div className="flex min-w-0 flex-col">
                        <span className="font-black text-base" style={{ color: colors.text }}>
                          {selectedPost.author}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            {formatDateTime(
                              getPostPublishTimestamp(selectedPost),
                              settings.timeZone,
                              settings.dateFormat
                            )}
                          </span>
                          <span className="inline-flex items-center gap-2 text-[10px] opacity-60">
                            <span aria-hidden="true">•</span>
                            <span className="uppercase tracking-wider">
                              {selectedPost.readTime || '5 min read'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </a>
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
                        {...getResponsiveImageAttributes(selectedPost, 'articleHero')}
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
                    } as React.CSSProperties & {
                      '--tw-prose-headings': string;
                      '--tw-prose-body': string;
                    }
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
                          className="px-4 py-2 text-sm font-bold border rounded-lg cursor-pointer transition-colors hover:bg-gray-500/10"
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
                  className="not-prose p-6 md:p-10 rounded-2xl border-2 shadow-xs"
                  style={{ borderColor: colors.border, background: colors.surface }}
                >
                  <VpComments
                    comments={comments.filter((c) => c.postId === selectedPost.id)}
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
            {hasSinglePostSidebar && (
              <aside className="w-full lg:w-[350px] shrink-0 space-y-8">
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
                      onCategoryClick={onCategoryClick}
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
            )}
          </div>
        </div>

        {/* Footer */}
        <TechPressFooter
          settings={settings}
          colors={isDark ? colors : footerColors}
          onBackToHome={handleReturnHome}
        />
      </div>
    );
  }

  // Page View
  if (currentView === 'page' && selectedPage) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={techPressRootStyle}
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
              <a
                href={getPublicHomeHref()}
                onClick={(event) => handleCrawlableLinkClick(event, handleReturnHome)}
                className="mb-8 font-bold text-sm hover:underline flex items-center gap-1"
                style={{ color: colors.textSecondary }}
              >
                <ChevronLeft size={16} /> Back to Home
              </a>
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
        <TechPressFooter
          settings={settings}
          colors={isDark ? colors : footerColors}
          onBackToHome={handleReturnHome}
        />
      </div>
    );
  }

  // Profile View
  if (currentView === 'profile' && targetProfile) {
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
        style={techPressRootStyle}
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
          <a
            href={getPublicHomeHref()}
            onClick={(event) => handleCrawlableLinkClick(event, handleReturnHome)}
            className="mb-8 font-bold text-sm hover:underline flex items-center gap-1"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} /> Back to Home
          </a>
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
            settings={settings}
          />
        </main>
        {/* Footer */}
        <TechPressFooter
          settings={settings}
          colors={isDark ? colors : footerColors}
          onBackToHome={handleReturnHome}
        />
      </div>
    );
  }

  // Home View OR Category View
  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark' : ''}`}
      style={techPressRootStyle}
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
        <LatestTickerBanner
          colors={colors}
          latestTickerItems={latestTickerItems}
          settings={settings}
          onClick={onPostClick}
          enableMarquee={config.enableMarquee}
        />
      )}

      <Header />

      {selectedCategory && (
        <div
          className="max-w-7xl mx-auto w-full px-5 py-8 border-b text-center relative"
          style={{ borderColor: colors.border }}
        >
          <h2 className="text-3xl font-black mb-2" style={{ color: colors.text }}>
            Category: <span style={{ color: colors.primary }}>{selectedCategory}</span>
          </h2>
          <PublicDiscoveryRefreshStatus
            active={isCategoryRefreshing}
            className="mx-auto mb-2 font-bold uppercase tracking-wider"
            style={{ color: colors.primary }}
          />
          <a
            href={getPublicHomeHref()}
            onClick={(event) =>
              handleCrawlableLinkClick(event, () => {
                if (onCategoryClick) onCategoryClick('');
                else window.location.href = getPublicHomeHref();
              })
            }
            className="text-sm font-bold hover:underline"
            style={{ color: colors.textSecondary }}
          >
            View All Stories
          </a>
        </div>
      )}

      {/* Search Bar Section - Standalone for better performance */}
      <div
        className="max-w-7xl mx-auto w-full px-5 py-4 border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <input
              aria-label="Search articles"
              id="techpress-search"
              name="search"
              type="text"
              placeholder="Search articles by title, content, or category..."
              value={activeSearchQuery}
              maxLength={PUBLIC_SEARCH_MAX_LENGTH}
              onChange={(e) => handleSearch(normalizePublicSearchInput(e.target.value))}
              className="w-full rounded-full border py-3.5 pr-16 pl-5 text-sm shadow-xs outline-hidden transition-all focus-visible:border-(--color-primary) focus-visible:ring-2 focus-visible:ring-(--color-primary)/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--techpress-focus-outline)"
              style={{
                background: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              }}
            />
            {activeSearchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
                style={{ background: colors.primary, color: searchControlForeground }}
                title="Clear Search"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            ) : (
              <span
                className="pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-full"
                style={{ background: colors.primary, color: searchControlForeground }}
                aria-hidden="true"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
            )}
          </div>
          {activeSearchQuery.length >= PUBLIC_SEARCH_MAX_LENGTH && (
            <p className="mt-2 text-center text-xs font-semibold" style={{ color: colors.accent }}>
              Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
            </p>
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

      <main
        className="max-w-7xl mx-auto px-5 py-8 flex-1 w-full"
        aria-busy={isCategoryRefreshing || undefined}
      >
        {isInitialDiscoveryLoading ? (
          <PublicDiscoverySkeleton />
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
                authorEmail={
                  allUsers.find(
                    (u) =>
                      u.username === (heroArticle?.author_data?.username || heroArticle?.author)
                  )?.email
                }
                authorAvatar={
                  heroArticle?.author_data?.avatar ||
                  allUsers.find(
                    (u) =>
                      u.username === (heroArticle?.author_data?.username || heroArticle?.author)
                  )?.avatar
                }
              />
            </div>

            {/* Latest Highlights - latest posts after hero, presented without analytics-ranking claims. */}
            <div className="mb-12">
              <div
                className="flex items-center justify-between mb-6 pb-3 border-b"
                style={{ borderColor: colors.border }}
              >
                <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                  Latest Highlights
                </h2>
              </div>
              {/* Changed grid-cols-3 to grid-cols-4 for better tablet/desktop balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {latestHighlightPosts.map((article: Post, index: number) => (
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

            <div className={`flex flex-col gap-8 ${hasHomepageSidebar ? 'lg:flex-row' : ''}`}>
              <div className={`flex-1 min-w-0 ${hasHomepageSidebar ? '' : 'w-full'}`}>
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
                        expandedHorizontalImage={!hasHomepageSidebar}
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
                            className="w-full max-w-full overflow-hidden py-8 my-4 border-y ad-slot-flex"
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

              {hasHomepageSidebar && (
                <aside className="w-full lg:w-[350px] shrink-0 space-y-6">
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
                        onCategoryClick={onCategoryClick}
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
              )}
            </div>
          </>
        )}
      </main>

      <TechPressFooter
        settings={settings}
        colors={isDark ? colors : footerColors}
        onBackToHome={handleReturnHome}
      />

      {/* Popup Ad */}
      <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />
    </div>
  );
};

export default TechPressLayout;
