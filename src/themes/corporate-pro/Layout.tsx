import React, { useState, useCallback, useRef } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { Post, Page, User, Comment, SiteSettings } from '../../types';
import { Menu, X, Mail, Phone, MapPin, Edit2, Rss, Sun, Moon } from 'lucide-react';
import { getBasePathPrefix, getPermalink, getPublicHomeHref } from '../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
import ThemeLogo from '../shared/components/ThemeLogo';
import PublicNavigationLink from '../shared/components/PublicNavigationLink';
import ThemeImage from '../shared/ThemeImage';
import { getCorporateHomeSections } from './config';
import { getReadableForeground } from '../shared/themeColors';
import HeroSection from './sections/HeroSection';
import ServicesSection from './sections/ServicesSection';
import AboutSection from './sections/AboutSection';
import LatestPostsSection from './sections/LatestPostsSection';
import CallToActionSection from './sections/CallToActionSection';
import {
  getOverflowNavigationItems,
  getVisibleNavigationItems,
  shouldUseTabletBurgerMenu,
} from '../../utils/navigation';

// Theme SDK
import {
  VonSEO,
  ContentRenderer,
  ShareButtons,
  VpComments,
  VonNewsletter,
  LoadMoreButton,
  usePublicProfile,
  useAdsPopup,
  useClickOutside,
  usePublicPostsQuery,
  useProfileActivity,
  useAISummary,
  useRelatedPosts,
  ProseDarkModeStyles,
  AdBlock,
  VonPopupAd,
  decodeEntities,
  getResponsiveImageAttributes,
  hasEmbeddedVideoMarkup,
  formatDate,
  formatDateTime,
  getPostPublishTimestamp,
} from '../shared';

import { API } from '../../config/site.config';
import { vonFetch } from '../../utils/api';
import {
  getHeaderIdentityState,
  getSameSiteCategoryNavigation,
  normalizeSiteUrl,
} from '../../utils/siteUtils';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { getProfileDisplayRole, isOwnUserProfile } from '../../utils/profileUtils';

interface ThemeLayoutProps {
  posts: Post[];
  pages?: Page[];
  user: User | null;
  isAuthLoading?: boolean;
  comments: Comment[];
  allUsers: User[];
  settings: SiteSettings;
  onAddComment: (postId: string, content: string) => void;
  onLikeComment: (commentId: string) => boolean | Promise<boolean>;
  onReplyComment: (commentId: string, content: string) => void;
  onLoadMoreComments?: () => Promise<void>;
  hasMoreComments?: boolean;
  commentsLoading?: boolean;
  commentsError?: string | null;
  onNavigateAdmin: () => void;
  onLogin: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category';
  selectedPost: Post | null;
  selectedPage?: Page | null;
  selectedProfile: string | null;
  onPostClick: (postId: string) => void;
  onPageClick: (slug: string) => void;
  onViewProfile: (username: string) => void;
  onBackToHome: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
}

// ===== CORPORATE PROFILE COMPONENT =====
const CorporateProfile: React.FC<{
  targetUser: User;
  currentUser: User | null;
  posts: Post[];
  settings: SiteSettings;
  onUpdateUser?: (user: Partial<User>) => void;
  onPostClick: (id: string) => void;
}> = ({ targetUser, currentUser, posts: _posts, settings, onUpdateUser, onPostClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(targetUser.display_name || '');
  const [editBio, setEditBio] = useState(targetUser.bio || '');
  const [editAvatar, setEditAvatar] = useState(targetUser.avatar || '');
  const [displayUser, setDisplayUser] = useState(targetUser);

  // Password Change State
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const isOwnProfile = isOwnUserProfile(currentUser, targetUser);

  // Sync state
  React.useEffect(() => {
    setDisplayUser(targetUser);
    setEditDisplayName(targetUser.display_name || '');
    setEditBio(targetUser.bio || '');
    setEditAvatar(targetUser.avatar || '');
  }, [targetUser]);

  const handleSaveProfile = async () => {
    try {
      // Validate Password
      if (showPasswordFields) {
        if (!currentPassword) {
          toast.error('Current password is required');
          return;
        }
        if (
          newPassword &&
          (newPassword.length < 8 ||
            !/[A-Z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword))
        ) {
          toast.error('Password too weak (8+ chars, Upper, Number, Symbol)');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          toast.error('Passwords do not match');
          return;
        }
      }

      const updatedUser = {
        ...displayUser,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };
      const payload: any = {
        id: currentUser?.id,
        display_name: editDisplayName,
        bio: editBio,
        avatar: editAvatar,
      };

      if (showPasswordFields && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await vonFetch(API.updateProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setDisplayUser(updatedUser);
        setIsEditing(false);
        if (onUpdateUser && isOwnProfile) {
          onUpdateUser({ display_name: editDisplayName, bio: editBio, avatar: editAvatar });
        }
        toast.success('Profile saved successfully');

        // Clear sensitive
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch (e) {
      toast.error('Connection error');
    }
  };

  const {
    articlePosts,
    articleTotal,
    articleHasMore,
    articlesLoading,
    articlesError,
    commentTotal,
    loadMoreArticles,
  } = useProfileActivity(targetUser, 6);

  return (
    <div className="bg-slate-50 dark:bg-neutral-900 min-h-screen">
      <div className="bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-5 pt-24 md:pt-28 pb-12 text-center md:text-left md:flex items-start gap-8">
          <div className="relative group mx-auto md:mx-0 w-32 h-32 shrink-0">
            {displayUser.avatar ? (
              <img
                src={displayUser.avatar}
                alt={displayUser.display_name || displayUser.username}
                className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-lg bg-slate-200"
              />
            ) : (
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-neutral-800 shadow-lg bg-slate-200">
                <Gravatar
                  email={displayUser.email || displayUser.username}
                  size={200}
                  className="w-full h-full object-cover"
                  default="identicon"
                />
              </div>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute bottom-0 right-0 p-2 bg-(--corporate-accent) text-(--corporate-on-accent) rounded-full hover:bg-(--corporate-accent-strong) transition shadow-md"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          <div className="mt-4 md:mt-2 grow min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2 wrap-anywhere">
              {displayUser.display_name || displayUser.username}
            </h1>
            {displayUser.display_name && (
              <p className="text-sm text-slate-500 dark:text-neutral-400 mb-2 wrap-anywhere">
                @{displayUser.username}
              </p>
            )}
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4 ${
                getProfileDisplayRole(currentUser, displayUser) === 'Super Admin'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {getProfileDisplayRole(currentUser, displayUser)}
            </span>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p>{displayUser.bio || 'No biography provided.'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Profile</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-white dark:bg-neutral-900">
              <div>
                <span className="block text-sm font-bold mb-1 text-slate-700 dark:text-neutral-300">
                  Display name / Pen name
                </span>
                <input
                  aria-label="Display name / Pen name"
                  id="layout-display-name"
                  name="layoutDisplayName"
                  className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-(--corporate-accent)"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Public author name"
                />
              </div>
              <div>
                <span className="block text-sm font-bold mb-1 text-slate-700 dark:text-neutral-300">
                  Avatar URL
                </span>
                <input
                  aria-label="Avatar URL"
                  id="layout-229"
                  name="layout229"
                  className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-(--corporate-accent)"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <span className="block text-sm font-bold mb-1 text-slate-700 dark:text-neutral-300">
                  Bio
                </span>
                <textarea
                  id="layout-240"
                  name="layout240"
                  aria-label="Bio"
                  className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-(--corporate-accent)"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Your bio..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800">
                <button
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-sm font-bold text-(--corporate-link) dark:text-(--corporate-accent-light) hover:underline flex items-center gap-2"
                >
                  <Edit2 size={14} />
                  {showPasswordFields ? 'Cancel Password Change' : 'Change Password'}
                </button>
                {showPasswordFields && (
                  <div className="mt-4 space-y-3 bg-slate-50 dark:bg-neutral-950 p-4 rounded-lg border border-slate-200 dark:border-neutral-800">
                    <div>
                      <span className="block text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                        Current Password
                      </span>
                      <input
                        aria-label="Current Password"
                        id="layout-263"
                        name="layout263"
                        type="password"
                        className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-(--corporate-accent) outline-hidden"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                        New Password
                      </span>
                      <input
                        id="8-chars-upper-number-symbol"
                        name="8CharsUpperNumberSymbol"
                        aria-label="8+ chars, Upper, Number, Symbol"
                        type="password"
                        placeholder="8+ chars, Upper, Number, Symbol"
                        className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-(--corporate-accent) outline-hidden"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                        Confirm Password
                      </span>
                      <input
                        id="layout-286"
                        name="layout286"
                        aria-label="Confirm Password"
                        type="password"
                        className="w-full px-3 py-2 border rounded-sm bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-(--corporate-accent) outline-hidden"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-neutral-800 flex justify-end gap-2 bg-slate-50 dark:bg-neutral-950">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-(--corporate-accent) hover:bg-(--corporate-accent-strong) text-(--corporate-on-accent) rounded-sm shadow-lg transition-colors font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-5 py-12">
        <h3 className="text-xl font-bold mb-8 pb-4 border-b border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white">
          Published Articles
        </h3>
        <div className="grid md:grid-cols-2 gap-6 min-h-[320px]">
          {articlesLoading && articlePosts.length === 0 ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`corporate-profile-skeleton-${index}`} className="animate-pulse flex gap-4">
                <div className="w-24 h-24 bg-slate-200 dark:bg-neutral-800 rounded-lg shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-4 rounded-sm bg-slate-200 dark:bg-neutral-800" />
                  <div className="h-4 w-2/3 rounded-sm bg-slate-200 dark:bg-neutral-800" />
                  <div className="h-3 w-1/3 rounded-sm bg-slate-200 dark:bg-neutral-800" />
                </div>
              </div>
            ))
          ) : articlePosts.length > 0 ? (
            articlePosts.map((post) => (
              <a
                key={post.id}
                href={getPermalink(post, settings)}
                onClick={(event) => handleCrawlableLinkClick(event, () => onPostClick(post.id))}
                className="cursor-pointer group flex gap-4"
              >
                <div className="relative w-24 h-24 bg-slate-200 dark:bg-neutral-800 rounded-lg overflow-hidden shrink-0">
                  <ThemeImage
                    {...getResponsiveImageAttributes(
                      post,
                      'thumbnail96',
                      'https://via.placeholder.com/150'
                    )}
                    alt={decodeEntities(post.title)}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition"
                  />
                </div>
                <div>
                  <h4 className="font-bold group-hover:text-(--corporate-link) transition line-clamp-2 text-slate-900 dark:text-white">
                    {decodeEntities(post.title)}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {formatDate(
                      getPostPublishTimestamp(post),
                      settings.timeZone,
                      settings.dateFormat
                    )}
                  </span>
                </div>
              </a>
            ))
          ) : (
            <p className="text-slate-500 dark:text-neutral-400 italic">No articles published.</p>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-neutral-400">
          Articles: {articleTotal} · Comments: {commentTotal}
        </p>

        {/* Load More for Profile */}
        <div className="mt-8">
          <LoadMoreButton
            loading={articlesLoading}
            hasMore={articleHasMore}
            error={articlesError}
            onLoadMore={loadMoreArticles}
            label="Load More Articles"
          />
        </div>
      </div>
    </div>
  );
};

const CorporateProLayout: React.FC<ThemeLayoutProps> = (props) => {
  const {
    settings,
    currentView,
    selectedPost,
    selectedPage,
    user,
    isAuthLoading = false,
    onNavigateAdmin,
    onLogin,
    onLogout,
    onBackToHome,
    onPostClick,
    onPageClick,
    onViewProfile,
    posts,
    pages = [],
    isDarkMode,
    allUsers,
    selectedProfile,
    selectedCategory,
    onCategoryClick,
    onUpdateUser,
  } = props;
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');

  // Plugin Hooks
  const { component: aiSummary, position: aiSummaryPos } = useAISummary(
    settings,
    selectedPost?.content || ''
  ) || { component: null, position: 'top' };

  const relatedPosts = useRelatedPosts(settings, selectedPost, posts, (p) => onPostClick(p.id), {
    primary: settings.theme.primaryColor || '#2563eb',
    secondary: '#64748b',
    surface: isDarkMode ? '#1a1a1a' : '#ffffff',
    surfaceAlt: isDarkMode ? '#121212' : '#f8fafc',
    border: isDarkMode ? '#2a2a2a' : '#e2e8f0',
    text: isDarkMode ? '#E5E7EB' : '#0f172a',
    textSecondary: isDarkMode ? '#9CA3AF' : '#475569',
  });

  // --- Hooks Integration ---
  const { showPopup, closePopup } = useAdsPopup(settings.ads);
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);

  // --- Local State ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigationItems = settings.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationClassName = `${
    useTabletBurgerMenu ? 'hidden lg:flex' : 'hidden md:flex'
  } items-center gap-8`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  // Load More State
  const postsPerPage = settings.postsPerPage || 6;
  const publicPosts = usePublicPostsQuery({
    initialPosts: posts,
    category: selectedCategory,
    limit: postsPerPage,
  });
  // --- Refs ---
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const visiblePosts = publicPosts.posts;
  const homeSectionIds = getCorporateHomeSections(settings.theme?.corporatePro);
  const isInitialDiscoveryLoading = publicPosts.isLoading && visiblePosts.length === 0;
  const isCategoryRefreshing =
    Boolean(selectedCategory) && publicPosts.isLoading && visiblePosts.length > 0;

  // Scroll effect for header
  React.useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on click outside
  useClickOutside(
    mobileMenuRef,
    useCallback(() => setMobileMenuOpen(false), []),
    mobileMenuOpen
  );

  // --- Helpers ---

  const handleNavigationItem = (url: string | undefined) => {
    if (!url) return;
    const trimmed = url.trim();
    if (trimmed === '' || trimmed === '#') return;

    if (trimmed === 'home') {
      onBackToHome();
      setMobileMenuOpen(false);
      return;
    }

    if (trimmed.startsWith('page:')) {
      const pageId = trimmed.split(':')[1];
      const pg = pages.find((p: any) => p.id === pageId);
      onPageClick(pg?.slug || pageId);
      setMobileMenuOpen(false);
      return;
    }

    if (trimmed.startsWith('post:')) {
      const postId = trimmed.split(':')[1];
      onPostClick(postId);
      setMobileMenuOpen(false);
      return;
    }

    const categoryTarget = getSameSiteCategoryNavigation(trimmed);
    if (categoryTarget !== null && onCategoryClick) {
      onCategoryClick(categoryTarget);
      setMobileMenuOpen(false);
      return;
    }

    window.location.href = normalizeSiteUrl(trimmed);
  };

  // SECURE AD BLOCK: Uses sanitizeHtml

  // --- Components ---

  const headerIdentity = getHeaderIdentityState(settings);

  const Header = () => (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-md py-2 dark:bg-neutral-900/90' : 'bg-transparent py-4'}`}
    >
      <div className="max-w-7xl mx-auto px-5 flex justify-between items-center">
        {/* Logo */}
        {/* Logo */}
        <a
          href={getPublicHomeHref()}
          onClick={(event) => handleCrawlableLinkClick(event, onBackToHome)}
          className="flex items-center gap-2 group"
        >
          {headerIdentity.showUploadedLogo ? (
            <ThemeLogo
              src={settings.logoUrl || ''}
              alt={settings.siteName}
              useLogoAsTitle={headerIdentity.logoUsesTitleSlot}
              invertLogoInDarkMode={settings.invertLogoInDarkMode}
              className="transition-all duration-300"
            />
          ) : headerIdentity.showFallbackMark ? (
            <div className="w-10 h-10 bg-(--corporate-accent) rounded-lg flex items-center justify-center text-(--corporate-on-accent) font-bold text-xl shadow-lg group-hover:bg-(--corporate-accent-strong) transition-colors">
              {settings.siteName.charAt(0)}
            </div>
          ) : null}

          {headerIdentity.showTitle && (
            <span
              className={`text-xl font-bold tracking-tight transition-colors group-hover:text-(--corporate-link) ${
                currentView === 'home' && !scrolled && !isDarkMode
                  ? 'text-slate-900'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {settings.siteName}
            </span>
          )}
        </a>

        {/* Desktop Nav */}
        <nav className={desktopNavigationClassName}>
          {visibleNavigationItems.map((item: any) => (
            <PublicNavigationLink
              key={item.id}
              nav={item}
              settings={settings}
              posts={posts}
              pages={pages}
              onNavigate={() => handleNavigationItem(item.url)}
              className={`font-medium transition-colors hover:text-(--corporate-link) ${
                currentView === 'home' && !scrolled && !isDarkMode
                  ? 'text-slate-700'
                  : 'text-slate-700 dark:text-neutral-300'
              }`}
            >
              {item.label}
            </PublicNavigationLink>
          ))}
          {overflowNavigationItems.length > 0 && (
            <div className="relative group">
              <button
                className={`font-medium transition-colors hover:text-(--corporate-link) flex items-center gap-1 ${
                  currentView === 'home' && !scrolled && !isDarkMode
                    ? 'text-slate-700'
                    : 'text-slate-700 dark:text-neutral-300'
                }`}
              >
                More
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-slate-100 dark:border-neutral-800 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:content-['']">
                {overflowNavigationItems.map((item: any) => (
                  <PublicNavigationLink
                    key={item.id}
                    nav={item}
                    settings={settings}
                    posts={posts}
                    pages={pages}
                    onNavigate={() => handleNavigationItem(item.url)}
                    className="block px-4 py-2 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-sm font-medium"
                  >
                    {item.label}
                  </PublicNavigationLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={props.toggleDarkMode}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'home' && !scrolled && !isDarkMode
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
            }`}
          >
            {isDarkMode ? (
              <Sun size={20} className="text-amber-500" />
            ) : (
              <Moon size={20} className="text-(--corporate-accent-light)" />
            )}
          </button>
          {isAuthLoading ? (
            <span
              className="block h-10 w-28 shrink-0 rounded-lg border pointer-events-none"
              style={{
                backgroundColor: isDarkMode ? '#1a1a1a' : '#f8fafc',
                borderColor: isDarkMode ? '#2a2a2a' : '#e2e8f0',
              }}
              data-auth-placeholder="true"
              aria-hidden="true"
            />
          ) : user ? (
            <>
              <button
                onClick={onNavigateAdmin}
                className="text-sm font-medium text-slate-600 hover:text-(--corporate-link) dark:text-neutral-300 dark:hover:text-(--corporate-accent-light)"
              >
                Dashboard
              </button>
              <button
                onClick={onLogout}
                className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors dark:bg-neutral-700 dark:hover:bg-neutral-600"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              className="px-5 py-2 bg-(--corporate-accent) text-(--corporate-on-accent) text-sm font-medium rounded-full hover:bg-(--corporate-accent-strong) transition-colors shadow-lg shadow-(color:--corporate-accent)/30"
            >
              Client Login
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className={`${compactNavigationClassName} ${currentView === 'home' && !scrolled && !isDarkMode ? 'text-slate-900' : 'text-slate-900 dark:text-white'}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className={`${compactNavigationClassName} absolute top-full left-0 w-full bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 shadow-xl p-5 flex flex-col gap-4 animate-slide-down`}
        >
          {navigationItems.map((item: any) => (
            <PublicNavigationLink
              key={item.id}
              nav={item}
              settings={settings}
              posts={posts}
              pages={pages}
              className="font-bold text-slate-800 dark:text-neutral-200 hover:text-(--corporate-link)"
              onNavigate={() => handleNavigationItem(item.url)}
            >
              {item.label}
            </PublicNavigationLink>
          ))}
          <div className="border-t border-slate-100 dark:border-neutral-800 pt-4 flex flex-col gap-3">
            <button
              onClick={() => {
                props.toggleDarkMode();
                setMobileMenuOpen(false);
              }}
              className="text-left font-medium text-slate-700 dark:text-neutral-300 flex items-center gap-2"
            >
              {isDarkMode ? (
                <>
                  <Sun size={18} className="text-amber-500" /> Light Mode
                </>
              ) : (
                <>
                  <Moon size={18} className="text-(--corporate-accent-light)" /> Dark Mode
                </>
              )}
            </button>
            {isAuthLoading ? (
              <span
                className="block h-6 w-full rounded-lg border pointer-events-none"
                style={{
                  backgroundColor: isDarkMode ? '#1a1a1a' : '#f8fafc',
                  borderColor: isDarkMode ? '#2a2a2a' : '#e2e8f0',
                }}
                data-auth-placeholder="true"
                aria-hidden="true"
              />
            ) : user ? (
              <>
                <button
                  onClick={onNavigateAdmin}
                  className="text-left font-medium text-slate-700 dark:text-neutral-300"
                >
                  Dashboard
                </button>
                <button onClick={onLogout} className="text-left font-medium text-red-600">
                  Logout
                </button>
              </>
            ) : (
              <button onClick={onLogin} className="text-left font-medium text-(--corporate-link)">
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );

  const HeaderAd = () =>
    settings.ads.adsEnabled && settings.ads.headerAd ? (
      <div className="pt-24 pb-4">
        <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
          <AdBlock content={settings.ads.headerAd} slotId="header" />
        </div>
      </div>
    ) : null;

  const Footer = () => {
    const rssPath = `${getBasePathPrefix()}/rss`;
    return (
      <footer className="bg-white dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-5">
          {/* Newsletter Integration */}
          {settings.newsletter?.enabled &&
            (settings.newsletter?.position === 'footer' ||
              settings.newsletter?.position === 'both') && (
              <div className="mb-16">
                <VonNewsletter
                  settings={settings.newsletter}
                  variant="footer"
                  accentColor={settings.theme.primaryColor || '#2563eb'}
                  themeColors={{
                    surface: isDarkMode ? '#1a1a1a' : '#f8fafc',
                    surfaceAlt: isDarkMode ? '#121212' : '#ffffff',
                    border: isDarkMode ? '#2a2a2a' : '#e2e8f0',
                    text: isDarkMode ? '#E5E7EB' : '#0f172a',
                    textSecondary: isDarkMode ? '#9CA3AF' : '#475569',
                  }}
                />
              </div>
            )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-1">
              <div className="mb-6">
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {settings.siteName}
                </span>
              </div>
              {settings.theme?.corporatePro?.footerAbout && (
                <p className="text-slate-500 dark:text-neutral-400 mb-6">
                  {settings.theme.corporatePro.footerAbout}
                </p>
              )}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Quick Links</h4>
              <ul className="space-y-4">
                {settings.navigation?.map((item: any) => (
                  <li key={item.id}>
                    <PublicNavigationLink
                      nav={item}
                      settings={settings}
                      posts={posts}
                      pages={pages}
                      onNavigate={() => handleNavigationItem(item.url)}
                      className="text-slate-600 dark:text-neutral-400 hover:text-(--corporate-link) dark:hover:text-(--corporate-accent-light)"
                    >
                      {item.label}
                    </PublicNavigationLink>
                  </li>
                ))}
                {(!settings.navigation || settings.navigation.length === 0) && (
                  <li>
                    <a
                      href={getPublicHomeHref()}
                      onClick={(event) => handleCrawlableLinkClick(event, onBackToHome)}
                      className="text-slate-600 dark:text-neutral-400 hover:text-(--corporate-link) dark:hover:text-(--corporate-accent-light)"
                    >
                      Home
                    </a>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Resources</h4>
              <ul className="space-y-4">
                <li>
                  <span className="text-slate-600 dark:text-neutral-400 hover:text-(--corporate-link) dark:hover:text-(--corporate-accent-light)">
                    Documentation
                  </span>
                </li>
                <li>
                  <span className="text-slate-600 dark:text-neutral-400 hover:text-(--corporate-link) dark:hover:text-(--corporate-accent-light)">
                    Support
                  </span>
                </li>
              </ul>
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Contact</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-600 dark:text-neutral-400">
                  <Mail size={18} className="shrink-0 text-(--corporate-link)" />
                  <span className="min-w-0 break-words">
                    {settings.theme?.corporatePro?.contactEmail || 'info@corporatepro.com'}
                  </span>
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                  <Phone size={18} className="text-(--corporate-link)" />
                  {settings.theme?.corporatePro?.contactPhone || '+1 (555) 123-4567'}
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                  <MapPin size={18} className="text-(--corporate-link)" />
                  {settings.theme?.corporatePro?.contactAddress || 'Business District, City'}
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-neutral-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 dark:text-neutral-500 text-sm">
              &copy; {new Date().getFullYear()} {settings.siteName}. Powered by VonCMS. All rights
              reserved.
            </p>
            <div className="flex gap-6 items-center">
              <a
                href={rssPath}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 flex items-center gap-1.5"
                title="RSS Feed"
              >
                <Rss size={14} />
                <span className="text-sm">RSS</span>
              </a>
              <span className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300">
                Privacy Policy
              </span>
              <span className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300">
                Terms of Service
              </span>
            </div>
          </div>
        </div>
      </footer>
    );
  };

  // --- Main Render Logic ---
  const accent = settings.theme.primaryColor || '#2563eb';
  const accentForeground = getReadableForeground(accent);
  const accentStyle = {
    '--corporate-accent': accent,
    '--corporate-on-accent': accentForeground,
    '--corporate-accent-hover': `color-mix(in srgb, ${accent} 90%, #000000)`,
    '--corporate-accent-strong': `color-mix(in srgb, ${accent} 75%, #000000)`,
    '--corporate-accent-light': `color-mix(in srgb, ${accent} 55%, #ffffff)`,
    '--corporate-accent-soft': `color-mix(in srgb, ${accent} 12%, #ffffff)`,
    '--corporate-link':
      accentForeground === '#ffffff' ? accent : `color-mix(in srgb, ${accent} 45%, #0f172a)`,
  } as React.CSSProperties;

  // Main Render with persistence
  return (
    <div className={isDarkMode ? 'dark' : ''} style={accentStyle} data-corporate-theme>
      <div className="font-sans antialiased text-slate-900 dark:text-neutral-300 bg-white dark:bg-neutral-950 selection:bg-(--corporate-accent-soft) selection:text-(--corporate-link) min-h-screen">
        <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />

        {(() => {
          // 1. Single Post View
          if (currentView === 'single-post' && selectedPost) {
            return (
              <>
                {shouldRenderVonSEO && (
                  <VonSEO
                    settings={settings}
                    currentView={currentView}
                    selectedPost={selectedPost}
                  />
                )}
                <ProseDarkModeStyles />
                <Header />
                <HeaderAd />
                <main className="pt-32 pb-20 max-w-4xl mx-auto px-5">
                  <article>
                    <header className="mb-10 text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 text-sm font-medium mb-6">
                        {selectedPost.category}
                      </div>
                      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-slate-500">
                        <span>
                          {formatDateTime(
                            getPostPublishTimestamp(selectedPost),
                            settings.timeZone,
                            settings.dateFormat
                          )}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{selectedPost.readTime || '5 min read'}</span>
                        </span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight text-slate-900 dark:text-white">
                        {decodeEntities(selectedPost.title)}
                      </h1>
                    </header>

                    {/* Smart Featured Image */}
                    {(() => {
                      if (!selectedPost.image) return null;
                      const hasVideo = hasEmbeddedVideoMarkup(selectedPost.content);
                      if (hasVideo) return null;
                      const imageFilename =
                        selectedPost.image.split('/').pop()?.split('?')[0] || '';
                      const contentHasImage =
                        selectedPost.content?.includes(selectedPost.image) ||
                        (imageFilename && selectedPost.content?.includes(imageFilename));
                      if (contentHasImage) return null;

                      return (
                        <img
                          {...getResponsiveImageAttributes(selectedPost, 'articleHero')}
                          alt={decodeEntities(selectedPost.title)}
                          className="w-full h-auto rounded-2xl shadow-lg mt-8 mb-8"
                        />
                      );
                    })()}

                    {/* AI Summary Plugin */}
                    {aiSummaryPos === 'top' && aiSummary}

                    {settings.sharePlacement === 'top' && (
                      <div className="mb-8">
                        <ShareButtons
                          url={typeof window !== 'undefined' ? window.location.href : ''}
                          title={decodeEntities(selectedPost.title)}
                        />
                      </div>
                    )}

                    <div className="prose prose-lg prose-slate dark:prose-invert mx-auto prose-a:text-(--corporate-link) prose-a:hover:underline prose-img:rounded-xl dark:prose-blockquote:text-neutral-300 dark:prose-blockquote:border-l-neutral-700 dark:prose-strong:text-white dark:prose-headings:text-white dark:prose-code:text-neutral-200">
                      <ContentRenderer html={selectedPost.content} />
                    </div>

                    {aiSummaryPos === 'bottom' && aiSummary}

                    {(settings.sharePlacement === 'bottom' || !settings.sharePlacement) && (
                      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-neutral-800">
                        <ShareButtons
                          url={typeof window !== 'undefined' ? window.location.href : ''}
                          title={decodeEntities(selectedPost.title)}
                        />
                      </div>
                    )}

                    {/* Tags */}
                    {selectedPost.keywords && (
                      <div className="mt-8 pt-8 border-t border-slate-100 dark:border-neutral-800">
                        <div className="flex flex-wrap gap-2">
                          {selectedPost.keywords.split(',').map((tag: string, i: number) => (
                            <span
                              key={i}
                              className="px-3 py-1.5 text-sm rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400"
                            >
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Posts */}
                    {relatedPosts}
                  </article>

                  <div className="mt-16 pt-10 border-t border-slate-100 dark:border-neutral-800">
                    <VpComments
                      comments={props.comments.filter((c) => c.postId === selectedPost.id)}
                      user={user}
                      onAddComment={(content: string) =>
                        props.onAddComment(selectedPost.id, content)
                      }
                      onLikeComment={props.onLikeComment}
                      onReplyComment={props.onReplyComment}
                      onLoadMoreComments={props.onLoadMoreComments}
                      hasMoreComments={props.hasMoreComments}
                      commentsLoading={props.commentsLoading}
                      commentsError={props.commentsError}
                      settings={settings}
                      onLogin={onLogin}
                      onViewProfile={onViewProfile}
                      themeColors={{
                        primary: settings.theme.primaryColor || '#2563eb',
                      }}
                      id="corporate-pro-comments"
                    />
                  </div>
                </main>
                <Footer />
              </>
            );
          }

          // 2. Single Page View
          if (currentView === 'page' && selectedPage) {
            return (
              <>
                {shouldRenderVonSEO && (
                  <VonSEO
                    settings={settings}
                    currentView={currentView}
                    selectedPage={selectedPage}
                  />
                )}
                <ProseDarkModeStyles />
                <Header />
                <HeaderAd />
                <div className="bg-slate-50 dark:bg-neutral-900 py-32 mt-0 text-center border-b border-slate-100 dark:border-neutral-800">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                    {selectedPage.title}
                  </h1>
                </div>
                <main className="py-20 max-w-5xl mx-auto px-5">
                  <div className="prose prose-lg prose-slate dark:prose-invert mx-auto">
                    <ContentRenderer html={selectedPage.content} />
                  </div>
                </main>
                <Footer />
              </>
            );
          }

          // 3. Profile View
          if (currentView === 'profile' && targetProfile) {
            return (
              <>
                {shouldRenderVonSEO && (
                  <VonSEO
                    settings={settings}
                    currentView={currentView}
                    selectedProfile={targetProfile}
                  />
                )}
                <ProseDarkModeStyles />
                <Header />
                <CorporateProfile
                  targetUser={targetProfile}
                  currentUser={user}
                  posts={posts}
                  settings={settings}
                  onUpdateUser={onUpdateUser}
                  onPostClick={onPostClick}
                />
                <Footer />
              </>
            );
          }

          // 4. Homepage (Default)
          return (
            <>
              {shouldRenderVonSEO && (
                <VonSEO
                  settings={settings}
                  currentView={currentView}
                  selectedCategory={selectedCategory}
                />
              )}
              <ProseDarkModeStyles />
              <Header />
              <HeaderAd />
              <main
                className={selectedCategory || homeSectionIds[0] !== 'hero' ? 'pt-24' : undefined}
              >
                {!selectedCategory && !homeSectionIds.includes('hero') && (
                  <h1 className="sr-only">{settings.siteName}</h1>
                )}
                {(selectedCategory ? (['posts'] as const) : homeSectionIds).map((sectionId) => {
                  const sectionProps = { settings, posts, pages, onNavigate: handleNavigationItem };
                  switch (sectionId) {
                    case 'hero':
                      return (
                        <HeroSection
                          key={sectionId}
                          {...sectionProps}
                          isFirst={homeSectionIds[0] === sectionId}
                        />
                      );
                    case 'services':
                      return <ServicesSection key={sectionId} {...sectionProps} />;
                    case 'about':
                      return <AboutSection key={sectionId} settings={settings} pages={pages} />;
                    case 'posts':
                      return (
                        <LatestPostsSection
                          key={sectionId}
                          {...sectionProps}
                          publicPosts={publicPosts}
                          selectedCategory={selectedCategory}
                          onCategoryClick={onCategoryClick}
                          onPostClick={onPostClick}
                          isInitialDiscoveryLoading={isInitialDiscoveryLoading}
                          isCategoryRefreshing={isCategoryRefreshing}
                        />
                      );
                    case 'cta':
                      return <CallToActionSection key={sectionId} {...sectionProps} />;
                  }
                })}
              </main>
              <Footer />
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default CorporateProLayout;
