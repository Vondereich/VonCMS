import React, { useState, useCallback, useRef } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { Post, Page, User, Comment, SiteSettings } from '../../types';
import {
  Menu,
  X,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Rss,
  Target,
  Cpu,
  BarChart,
  Sun,
  Moon,
  HelpCircle,
  Briefcase,
  Users,
  Shield,
  Globe,
  Award,
  Zap,
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { getBasePathPrefix, getPermalink } from '../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../utils/linkEvents';
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
} from '../shared';

import { API } from '../../config/site.config';
import { vonFetch } from '../../utils/api';
import { normalizeSiteUrl } from '../../utils/siteUtils';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { getProfileDisplayRole, isOwnUserProfile } from '../../utils/profileUtils';

interface ThemeLayoutProps {
  posts: Post[];
  pages?: Page[];
  user: User | null;
  comments: Comment[];
  allUsers: User[];
  settings: SiteSettings;
  onAddComment: (postId: string, content: string) => void;
  onLikeComment: (commentId: string) => boolean | Promise<boolean>;
  onReplyComment: (commentId: string, content: string) => void;
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
  onUpdateUser?: (user: Partial<User>) => void;
  onPostClick: (id: string) => void;
}> = ({ targetUser, currentUser, posts: _posts, onUpdateUser, onPostClick }) => {
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
        <div className="max-w-4xl mx-auto px-5 py-12 text-center md:text-left md:flex items-start gap-8">
          <div className="relative group mx-auto md:mx-0 w-32 h-32 flex-shrink-0">
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
                className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-md"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          <div className="mt-4 md:mt-2 flex-grow">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              {displayUser.display_name || displayUser.username}
            </h1>
            {displayUser.display_name && (
              <p className="text-sm text-slate-500 dark:text-neutral-400 mb-2">
                @{displayUser.username}
              </p>
            )}
            <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
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
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-800 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Your bio..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800">
                <button
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
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
                        className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                        className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                        className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="px-4 py-2 text-slate-600 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-lg transition-colors font-bold"
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
                <div className="w-24 h-24 bg-slate-200 dark:bg-neutral-800 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-4 rounded bg-slate-200 dark:bg-neutral-800" />
                  <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-neutral-800" />
                  <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-neutral-800" />
                </div>
              </div>
            ))
          ) : articlePosts.length > 0 ? (
            articlePosts.map((post) => (
              <div
                key={post.id}
                onClick={() => onPostClick(post.id)}
                className="cursor-pointer group flex gap-4"
              >
                <div className="w-24 h-24 bg-slate-200 dark:bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    {...getResponsiveImageAttributes(
                      post,
                      'card',
                      'https://via.placeholder.com/150'
                    )}
                    alt={decodeEntities(post.title)}
                    className="w-full h-full object-cover group-hover:scale-110 transition"
                  />
                </div>
                <div>
                  <h4 className="font-bold group-hover:text-blue-600 transition line-clamp-2 text-slate-900 dark:text-white">
                    {decodeEntities(post.title)}
                  </h4>
                  <span className="text-xs text-slate-500">{post.createdAt || ''}</span>
                </div>
              </div>
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

  const relatedPosts = useRelatedPosts(
    settings,
    selectedPost as any,
    posts,
    (p) => onPostClick(p.id),
    {
      primary: settings.theme.primaryColor || '#2563eb',
      secondary: '#64748b',
      surface: isDarkMode ? '#1a1a1a' : '#ffffff',
      surfaceAlt: isDarkMode ? '#121212' : '#f8fafc',
      border: isDarkMode ? '#2a2a2a' : '#e2e8f0',
      text: isDarkMode ? '#E5E7EB' : '#0f172a',
      textSecondary: isDarkMode ? '#9CA3AF' : '#475569',
    }
  );

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
  const hasMore = publicPosts.hasMore;
  const loadingMore = publicPosts.loadingMore;
  const handleLoadMore = publicPosts.loadMore;
  const isInitialDiscoveryLoading = publicPosts.isLoading && visiblePosts.length === 0;

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
  const LucideIconMap: Record<string, React.FC<any>> = {
    Menu,
    X,
    ChevronRight,
    Mail,
    Phone,
    MapPin,
    Edit2,
    Rss,
    Target,
    Cpu,
    BarChart,
    Sun,
    Moon,
    HelpCircle,
    Briefcase,
    Users,
    Shield,
    Globe,
    Award,
    Zap,
    Activity,
    ArrowRight,
    CheckCircle,
    Clock,
  };

  const IconComponent = ({ name, size = 20 }: { name: string; size?: number }) => {
    const Icon = LucideIconMap[name] || HelpCircle;
    return <Icon size={size} />;
  };

  const safeLink = (url: string | undefined) => {
    if (!url) return '#';
    const trimmed = url.trim();
    if (trimmed === 'home' || trimmed.startsWith('page:') || trimmed.startsWith('post:'))
      return '#';
    return normalizeSiteUrl(trimmed);
  };

  const handleLinkClick = (url: string | undefined, e?: React.MouseEvent) => {
    if (!url) return;
    const trimmed = url.trim();

    if (trimmed === 'home') {
      e?.preventDefault();
      onBackToHome();
      setMobileMenuOpen(false);
      return;
    }

    if (trimmed.startsWith('page:')) {
      e?.preventDefault();
      const pageId = trimmed.split(':')[1];
      const pg = pages.find((p: any) => p.id === pageId);
      onPageClick(pg?.slug || pageId);
      setMobileMenuOpen(false);
      return;
    }

    if (trimmed.startsWith('post:')) {
      e?.preventDefault();
      const postId = trimmed.split(':')[1];
      onPostClick(postId);
      setMobileMenuOpen(false);
      return;
    }
  };

  // SECURE AD BLOCK: Uses sanitizeHtml

  // --- Components ---

  const Header = () => (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-md py-2 dark:bg-neutral-900/90' : 'bg-transparent py-4'}`}
    >
      <div className="max-w-7xl mx-auto px-5 flex justify-between items-center">
        {/* Logo */}
        {/* Logo */}
        <button onClick={onBackToHome} className="flex items-center gap-2 group">
          {settings.logoUrl ? (
            <ThemeLogo
              src={settings.logoUrl}
              alt={settings.siteName}
              useLogoAsTitle={settings.useLogoAsTitle}
              invertLogoInDarkMode={settings.invertLogoInDarkMode}
              className="transition-all duration-300"
            />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:bg-blue-700 transition-colors">
              {settings.siteName.charAt(0)}
            </div>
          )}

          {(!settings.logoUrl || !settings.useLogoAsTitle) && (
            <span
              className={`text-xl font-bold tracking-tight transition-colors group-hover:text-blue-600 ${
                currentView === 'home' && !scrolled && !isDarkMode
                  ? 'text-slate-900'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {settings.siteName}
            </span>
          )}
        </button>

        {/* Desktop Nav */}
        <nav className={desktopNavigationClassName}>
          {visibleNavigationItems.map((item: any) => (
            <a
              key={item.id}
              href={safeLink(item.url)}
              onClick={(e) => handleLinkClick(item.url, e)}
              className={`font-medium transition-colors hover:text-blue-600 ${
                currentView === 'home' && !scrolled && !isDarkMode
                  ? 'text-slate-700'
                  : 'text-slate-700 dark:text-neutral-300'
              }`}
            >
              {item.label}
            </a>
          ))}
          {overflowNavigationItems.length > 0 && (
            <div className="relative group">
              <button
                className={`font-medium transition-colors hover:text-blue-600 flex items-center gap-1 ${
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
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-slate-100 dark:border-neutral-800 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {overflowNavigationItems.map((item: any) => (
                  <a
                    key={item.id}
                    href={safeLink(item.url)}
                    onClick={(e) => handleLinkClick(item.url, e)}
                    className="block px-4 py-2 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-sm font-medium"
                  >
                    {item.label}
                  </a>
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
              <Moon size={20} className="text-blue-400" />
            )}
          </button>
          {user ? (
            <>
              <button
                onClick={onNavigateAdmin}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400"
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
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
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
            <a
              key={item.id}
              href={safeLink(item.url)}
              className="font-bold text-slate-800 dark:text-neutral-200 hover:text-blue-600"
              onClick={(e) => handleLinkClick(item.url, e)}
            >
              {item.label}
            </a>
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
                  <Moon size={18} className="text-blue-400" /> Dark Mode
                </>
              )}
            </button>
            {user ? (
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
              <button onClick={onLogin} className="text-left font-medium text-blue-600">
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

  const Hero = () => (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50 dark:bg-neutral-900">
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute right-0 top-0 w-1/2 h-full bg-blue-600 transform skew-x-12 translate-x-32"></div>
      </div>

      {settings.theme?.corporatePro?.heroImage && (
        <img
          src={settings.theme.corporatePro.heroImage}
          className="absolute inset-0 w-full h-full object-cover opacity-10 dark:opacity-20 mix-blend-overlay pointer-events-none"
          alt="Hero Background"
        />
      )}
      <div className="max-w-7xl mx-auto px-5 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="lg:w-1/2 animate-slide-up">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold tracking-wide mb-6">
              CORPORATE SOLUTIONS
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight mb-8">
              {settings.theme?.corporatePro?.heroTitle || (
                <>
                  Elevate Your Business to <span className="text-blue-600">Next Level</span>
                </>
              )}
            </h1>
            <p className="text-xl text-slate-600 dark:text-neutral-300 mb-10 leading-relaxed max-w-2xl">
              {settings.theme?.corporatePro?.heroText ||
                'We provide cutting-edge solutions to help your business grow. Professional, reliable, and scalable strategies for modern enterprises.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-5 pt-4">
              <button
                onClick={() =>
                  (window.location.href = safeLink(settings.theme?.corporatePro?.heroPrimaryLink))
                }
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
              >
                Get a Quote
              </button>
              <button
                onClick={() =>
                  (window.location.href = safeLink(settings.theme?.corporatePro?.heroSecondaryLink))
                }
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-slate-700 dark:text-white font-bold rounded-lg backdrop-blur-md border border-slate-200 dark:border-white/20 transition-all hover:scale-105"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Hero Featured Image */}
          <div className="lg:w-1/2 relative hidden lg:block animate-slide-in-right">
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-8 border-white dark:border-neutral-800 rotate-2 hover:rotate-0 transition-transform duration-500">
              <img
                src={
                  settings.theme?.corporatePro?.heroImage ||
                  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1000'
                }
                className="w-full h-[500px] object-cover"
                alt="Hero Featured"
              />
            </div>
            {/* Decorative Elements */}
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-600 rounded-2xl -z-10 opacity-20 animate-pulse"></div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-400 rounded-full -z-10 opacity-20"></div>
          </div>
        </div>
      </div>
    </section>
  );

  const Services = () => (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-5">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {settings.theme?.corporatePro?.servicesTitle || 'Our Premium Services'}
          </h2>
          <p className="text-slate-600 dark:text-neutral-400">
            {settings.theme?.corporatePro?.servicesSubtitle ||
              'Comprehensive layouts and features designed for your success.'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: settings.theme?.corporatePro?.service1Title || 'Strategic Planning',
              icon: settings.theme?.corporatePro?.service1Icon || 'Target',
              desc:
                settings.theme?.corporatePro?.service1Desc ||
                'Expert guidance to define your business roadmap and achieve long-term goals.',
              link: safeLink(settings.theme?.corporatePro?.service1Link),
            },
            {
              title: settings.theme?.corporatePro?.service2Title || 'Digital Transformation',
              icon: settings.theme?.corporatePro?.service2Icon || 'Cpu',
              desc:
                settings.theme?.corporatePro?.service2Desc ||
                'Modernize your operations with cutting-edge technology solutions.',
              link: safeLink(settings.theme?.corporatePro?.service2Link),
            },
            {
              title: settings.theme?.corporatePro?.service3Title || 'Market Analysis',
              icon: settings.theme?.corporatePro?.service3Icon || 'BarChart',
              desc:
                settings.theme?.corporatePro?.service3Desc ||
                'In-depth insights into market trends to keep you ahead of the competition.',
              link: safeLink(settings.theme?.corporatePro?.service3Link),
            },
          ].map((service, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 hover:shadow-xl transition-all hover:-translate-y-1 group"
            >
              <div className="w-14 h-14 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-100 dark:border-neutral-700 flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <IconComponent name={service.icon} size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                {service.title}
              </h3>
              <p className="text-slate-600 dark:text-neutral-400 leading-relaxed">{service.desc}</p>
              <a
                href={service.link}
                className="inline-flex items-center gap-2 text-blue-600 font-bold mt-6 hover:gap-3 transition-all"
              >
                Learn More <ChevronRight size={16} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const About = () => {
    // Try to find an "About" page, otherwise show static
    const aboutPage = pages?.find((p) => p.title?.toLowerCase().includes('about'));

    return (
      <section className="py-20 bg-slate-50 dark:bg-neutral-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 relative">
            <div className="aspect-square bg-blue-600 rounded-2xl absolute -top-4 -left-4 w-full h-full opacity-10"></div>
            <img
              src={
                settings.theme?.corporatePro?.aboutImage ||
                'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000'
              }
              alt="About Us"
              className="rounded-2xl shadow-2xl relative z-10 w-full object-cover aspect-[4/3]"
            />
          </div>
          <div className="md:w-1/2">
            <span className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-2 block">
              Who We Are
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">
              {settings.theme?.corporatePro?.aboutTitle ||
                'Leading the Way in Corporate Excellence'}
            </h2>
            <div className="text-slate-600 dark:text-neutral-300 space-y-4 mb-8 text-lg font-light">
              {settings.theme?.corporatePro?.aboutSubtitle ? (
                <p>{settings.theme.corporatePro.aboutSubtitle}</p>
              ) : aboutPage ? (
                <ContentRenderer
                  html={aboutPage.content.substring(0, 300) + '...'}
                  className="prose dark:prose-invert"
                />
              ) : (
                <p>
                  With over a decade of experience, we help businesses navigate the complex
                  landscape of modern commerce. Our team of dedicated professionals is committed to
                  delivering results that exceed expectations.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col">
                <span className="text-4xl font-bold text-blue-600">
                  {settings.theme?.corporatePro?.aboutStat1Number || '500+'}
                </span>
                <span className="text-slate-600 dark:text-neutral-400 font-medium">
                  {settings.theme?.corporatePro?.aboutStat1Label || 'Clients Served'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-4xl font-bold text-blue-600">
                  {settings.theme?.corporatePro?.aboutStat2Number || '98%'}
                </span>
                <span className="text-slate-600 dark:text-neutral-400 font-medium">
                  {settings.theme?.corporatePro?.aboutStat2Label || 'Satisfaction Rate'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const CTA = () => (
    <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-600/20 mix-blend-overlay"></div>
      <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
          {settings.theme?.corporatePro?.ctaTitle || 'Ready to Transform Your Business?'}
        </h2>
        <p className="text-xl text-slate-300 mb-10 font-light">
          {settings.theme?.corporatePro?.ctaSubtitle ||
            'Join hundreds of successful companies that trust us with their corporate strategy.'}
        </p>
        <button
          onClick={() =>
            (window.location.href = safeLink(settings.theme?.corporatePro?.ctaButtonLink))
          }
          className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-xl shadow-blue-600/30 transition-all hover:scale-105"
        >
          {settings.theme?.corporatePro?.ctaButtonText || 'Start Your Project Today'}
        </button>
      </div>
    </section>
  );

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

          <div className="grid md:grid-cols-4 gap-12 mb-16">
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
                    <a
                      href={safeLink(item.url)}
                      onClick={(e) => handleLinkClick(item.url, e)}
                      className="text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                {(!settings.navigation || settings.navigation.length === 0) && (
                  <li>
                    <button
                      onClick={onBackToHome}
                      className="text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      Home
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Resources</h4>
              <ul className="space-y-4">
                <li>
                  <a
                    href="#"
                    className="text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-6">Contact</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                  <Mail size={18} className="text-blue-600" />
                  {settings.theme?.corporatePro?.contactEmail || 'info@corporatepro.com'}
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                  <Phone size={18} className="text-blue-600" />
                  {settings.theme?.corporatePro?.contactPhone || '+1 (555) 123-4567'}
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-neutral-400">
                  <MapPin size={18} className="text-blue-600" />
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
              <a
                href="#"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
  };

  // --- Main Render Logic ---

  // Main Render with persistence
  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="font-sans antialiased text-slate-900 dark:text-neutral-300 bg-white dark:bg-neutral-950 selection:bg-blue-100 selection:text-blue-900 min-h-screen">
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
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6 font-medium">
                        <span>{new Date(selectedPost.createdAt || '').toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{selectedPost.readTime || '5 min read'}</span>
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
                          {...getResponsiveImageAttributes(selectedPost, 'hero')}
                          alt={decodeEntities(selectedPost.title)}
                          className="w-full h-auto rounded-2xl shadow-lg mt-8 mb-8"
                        />
                      );
                    })()}

                    {/* AI Summary Plugin */}
                    {aiSummaryPos === 'top' && aiSummary}

                    <div className="prose prose-lg prose-slate dark:prose-invert mx-auto prose-a:text-blue-600 hover:prose-a:underline prose-img:rounded-xl dark:prose-blockquote:text-neutral-300 dark:prose-blockquote:border-l-neutral-700 dark:prose-strong:text-white dark:prose-headings:text-white dark:prose-code:text-neutral-200">
                      <ContentRenderer html={selectedPost.content} />
                    </div>

                    {aiSummaryPos === 'bottom' && aiSummary}

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
              {shouldRenderVonSEO && <VonSEO settings={settings} currentView={currentView} />}
              <ProseDarkModeStyles />
              <Header />
              <HeaderAd />
              <main>
                <Hero />
                <Services />
                <About />

                {/* Latest News */}
                {settings.theme?.corporatePro?.showPosts !== false && (
                  <section className="py-20 bg-white dark:bg-neutral-950">
                    <div className="max-w-7xl mx-auto px-5">
                      <div className="flex justify-between items-end mb-12">
                        <div>
                          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                            Latest Insights
                          </h2>
                          <p className="text-slate-600 dark:text-neutral-400">
                            News and updates from our experts.
                          </p>
                        </div>
                      </div>
                      {selectedCategory && (
                        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Category: <span className="text-blue-600">{selectedCategory}</span>
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-neutral-400">
                                Showing server-backed results beyond the homepage preload.
                              </p>
                            </div>
                            {onCategoryClick && (
                              <button
                                type="button"
                                onClick={() => onCategoryClick('')}
                                className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-500"
                              >
                                View All Articles
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {isInitialDiscoveryLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                          <p className="text-sm font-bold uppercase tracking-[0.25em]">
                            Loading articles...
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid md:grid-cols-3 gap-8">
                            {visiblePosts.map((post, index) => (
                              <React.Fragment key={post.id}>
                                {/* In-Feed Ad Every 6 Posts */}
                                {(index + 1) % (settings.ads.inFeedFrequency || 6) === 0 &&
                                  settings.ads.adsEnabled &&
                                  settings.ads.inFeedAd && (
                                    <div className="col-span-full py-12 border-y border-slate-100 dark:border-neutral-800 bg-transparent">
                                      <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
                                        <AdBlock
                                          content={settings.ads.inFeedAd}
                                          slotId={`infeed-${index}`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                <article
                                  className="group cursor-pointer"
                                  onClick={() => onPostClick(post.id)}
                                >
                                  <div className="aspect-[16/10] overflow-hidden rounded-xl mb-6 bg-slate-100 dark:bg-neutral-800 relative">
                                    <img
                                      {...getResponsiveImageAttributes(
                                        post,
                                        'card',
                                        'https://via.placeholder.com/800x600'
                                      )}
                                      alt={decodeEntities(post.title)}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onCategoryClick?.(post.category);
                                      }}
                                      className="absolute top-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-3 py-1 rounded text-xs font-bold uppercase tracking-wider text-slate-800 transition-colors hover:text-blue-600 dark:text-neutral-200 dark:hover:text-blue-400"
                                    >
                                      {post.category}
                                    </button>
                                  </div>
                                  <h3 className="text-xl font-bold mb-3 group-hover:text-blue-600 transition-colors line-clamp-2 text-slate-900 dark:text-white">
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
                                  </h3>
                                  <p className="text-slate-600 dark:text-neutral-400 mb-4 line-clamp-3 text-sm">
                                    {post.excerpt}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-400 dark:text-neutral-500 group-hover:text-blue-600 transition-colors uppercase tracking-wide">
                                      Read Article
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                                      {post.readTime || '5 min read'}
                                    </span>
                                  </div>
                                </article>
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="mt-12">
                            <LoadMoreButton
                              loading={loadingMore}
                              hasMore={hasMore}
                              onLoadMore={handleLoadMore}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                )}
                <CTA />
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
