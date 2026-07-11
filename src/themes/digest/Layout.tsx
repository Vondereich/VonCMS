import React, { useState, useMemo, useEffect } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { Post, User, SiteSettings, NavItem } from '../../types';
import {
  Menu,
  X,
  ChevronLeft,
  Search,
  ChevronDown,
  Edit2,
  Save,
  Moon,
  Sun,
  MessageSquare,
  ThumbsUp,
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
  PUBLIC_SEARCH_MAX_LENGTH,
  normalizePublicSearchInput,
  usePublicPostsQuery,
  useProfileActivity,
  useAISummary,
  useRelatedPosts,
  decodeEntities,
  sanitizeHtml,
  hasEmbeddedVideoMarkup,
  AdBlock,
  VonPopupAd,
  getResponsiveImageAttributes,
} from '../shared';

import { vonFetch } from '../../utils/api';
import { API } from '../../config/site.config';
import { DarkModeStyles } from '../../styles/DarkModeStyles';
import { normalizeSiteUrl } from '../../utils/siteUtils';
import { isSystemPluginActive } from '../../utils/pluginRuntime';
import { getProfileDisplayRole, isOwnUserProfile } from '../../utils/profileUtils';

// ==========================================
// DIGEST THEME v1.0
// Modern Magazine Theme
// ==========================================

// ===== DIGEST GLOBAL STYLES =====
// Unique Digest visual styling - vibrant and distinct from TechPress
const DigestThemeStyles: React.FC = () => (
  <>
    <DarkModeStyles prefix="digest" accentColor="var(--digest-accent, #00D1D1)" />
    <style>{`
        /* Additional theme-specific overrides */
        .dark .digest-content h1,
        .dark .digest-content h2,
        .dark .digest-content h3,
        .dark .digest-content h4,
        .dark .digest-content h5,
        .dark .digest-content h6 {
            color: #ffffff !important;
        }

        /* ===== DIGEST UNIQUE STYLING ===== */
        .dark .digest-category-pill {
            box-shadow: 0 0 12px var(--pill-color, rgba(0, 209, 209, 0.4));
            transition: all 0.3s ease;
        }
        .dark .digest-category-pill:hover {
            box-shadow: 0 0 20px var(--pill-color, rgba(0, 209, 209, 0.6));
            transform: translateY(-1px);
        }

        .digest-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        .digest-card::before {
            content: '';
            position: absolute;
            inset: 0;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        .dark .digest-card::before {
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
        }
        .digest-card:hover::before {
            opacity: 1;
        }
        .dark .digest-card:hover {
            border-color: rgba(0, 209, 209, 0.3) !important;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 209, 209, 0.1);
        }
        .digest-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
        }

        .dark .digest-hero-accent {
            box-shadow: 0 0 30px var(--digest-accent, rgba(0, 209, 209, 0.5));
            animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes pulse-glow {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 1; }
        }

        .digest-nav {
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
        }

        .digest-warm-shadow {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }
    `}</style>
  </>
);

const TrendingTicker: React.FC<{
  posts: Post[];
  colors: ReturnType<typeof getColors>;
  onPostClick: (id: string) => void;
  enableMarquee?: boolean;
}> = ({ posts, colors, onPostClick, enableMarquee = true }) => {
  if (!posts || posts.length === 0) return null;
  return (
    <div
      className="py-2.5 border-b overflow-hidden relative"
      style={{ background: colors.surfaceAlt, borderColor: colors.border }}
    >
      <div className="max-w-7xl mx-auto px-5 flex items-center gap-4">
        <span
          className="font-black text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded flex-shrink-0 animate-pulse shadow-sm"
          style={{ background: colors.safeAccent, color: colors.accentContrast }}
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
                style={{ color: colors.text }}
              >
                <span className="opacity-60" style={{ color: colors.accentText }}>
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
                  style={{ color: colors.text }}
                >
                  <span className="opacity-60" style={{ color: colors.accentText }}>
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

// ===== AD BLOCK COMPONENT =====

// ===== DIGEST SETTINGS TYPE =====
interface DigestSettings {
  accentColor: string;
  showCategoryPills: boolean;
  showHero: boolean;
  gridColumns: 2 | 3 | 4;
  heroStyle: 'split' | 'overlay' | 'minimal';
  showSidebar: boolean;
  showTrending: boolean;
  enableMarquee: boolean;
}

const defaultDigestSettings: DigestSettings = {
  accentColor: '#00D1D1',
  showCategoryPills: true,
  showHero: true,
  gridColumns: 4,
  heroStyle: 'split',
  showSidebar: true,
  showTrending: true,
  enableMarquee: true,
};

// ===== CATEGORY COLORS =====
const categoryColors: Record<string, string> = {
  Tech: '#22c55e',
  Technology: '#22c55e',
  Science: '#8b5cf6',
  Culture: '#3b82f6',
  Business: '#f43f5e',
  Gear: '#f59e0b',
  Sports: '#ef4444',
  Entertainment: '#ec4899',
  Health: '#14b8a6',
  Politics: '#6366f1',
  default: '#00D1D1',
};

const getCategoryColor = (category: string): string => {
  return categoryColors[category] || categoryColors['default'];
};

// ===== COLOR SYSTEM =====
// Digest has a unique vibrant palette - distinct from TechPress
const getColors = (isDark: boolean, accentColor: string) => {
  // Helper to determine text contrast (YIQ)
  const getContrastColor = (hex: string) => {
    if (!hex || hex.length < 7) return '#ffffff';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  // Detect if color is "Orange/Yellow-ish" to apply deeper tones in light mode
  const r = parseInt(accentColor.substring(1, 3), 16);
  const g = parseInt(accentColor.substring(3, 5), 16);
  const b = parseInt(accentColor.substring(5, 7), 16);
  const isOrange = !isDark && r > 200 && g > 140 && b < 100;

  const safeAccent = isOrange ? '#e67300' : accentColor; // Deeper orange for better visibility on white

  return {
    // Backgrounds - Digest uses warmer tones
    background: isDark ? '#0d0d12' : '#faf9f7',
    surface: isDark ? '#16161d' : '#ffffff',
    surfaceHover: isDark ? '#1e1e28' : '#f5f3f0',
    surfaceAlt: isDark ? '#121217' : '#f0eeeb',

    // Text
    text: isDark ? '#f5f5f7' : '#1a1a1a',
    textSecondary: isDark ? '#a8a8b3' : '#555555',
    textMuted: isDark ? '#6b6b78' : '#888888',

    // Borders
    border: isDark ? '#2a2a35' : '#e8e5e0',
    borderLight: isDark ? '#333340' : '#f0ede8',

    // Accent
    accent: accentColor,
    safeAccent: safeAccent,
    accentHover: isDark ? `${accentColor}cc` : safeAccent,
    accentGlow: `0 0 20px ${accentColor}40`,
    accentText: isDark ? accentColor : isOrange ? '#c2410c' : accentColor,
    accentContrast: getContrastColor(accentColor),

    // Nav
    nav: isDark ? 'rgba(13, 13, 18, 0.92)' : 'rgba(250, 249, 247, 0.95)',
    navText: isDark ? '#f5f5f7' : '#1a1a1a',

    // Card gradient overlay
    cardGradient: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 50%)'
      : 'linear-gradient(145deg, rgba(0,0,0,0.01) 0%, transparent 50%)',
  };
};

// ===== AVATAR COMPONENT =====
const DigestAvatar: React.FC<{
  url?: string;
  name: string;
  email?: string;
  size?: string;
  className?: string;
}> = ({ url, name, email, size = 'w-8 h-8', className = '' }) => (
  <div
    className={`${size} rounded-full overflow-hidden ${className} flex-shrink-0 ring-2 ring-white/10`}
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

// ===== CATEGORY BADGE =====
const CategoryBadge: React.FC<{
  category: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
  colors: ReturnType<typeof getColors>;
}> = ({ category, onClick, size = 'sm', colors }) => {
  const label = category || 'General';

  return (
    <span
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
inline-flex max-w-[10rem] sm:max-w-[12rem] items-center overflow-hidden rounded font-bold uppercase tracking-wider cursor-pointer
transition-all hover:scale-105 hover:shadow-lg whitespace-nowrap digest-category-pill
                ${size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}
`}
      style={{
        backgroundColor: colors.safeAccent,
        color: colors.accentContrast,
        ['--pill-color' as any]: `${colors.accent}66`,
      }}
    >
      <span className="truncate">{label}</span>
    </span>
  );
};
// ===== CATEGORY PILLS =====
const CategoryPills: React.FC<{
  categories: string[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  colors: ReturnType<typeof getColors>;
}> = ({ categories, selectedCategory, onSelect, colors }) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
    <button
      onClick={() => onSelect(null)}
      className={`
min-w-0 shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                ${
                  !selectedCategory
                    ? 'shadow-lg'
                    : 'bg-transparent border border-current opacity-70 hover:opacity-100'
                }
`}
      style={{
        backgroundColor: !selectedCategory ? colors.safeAccent : 'transparent',
        color: !selectedCategory ? colors.accentContrast : colors.text,
        borderColor: !selectedCategory ? colors.safeAccent : colors.border,
      }}
    >
      All
    </button>
    {categories.map((cat) => (
      <button
        key={cat}
        title={cat}
        onClick={() => onSelect(cat)}
        className={`
min-w-0 max-w-[10rem] sm:max-w-[12rem] shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                    ${
                      selectedCategory === cat
                        ? 'digest-category-pill shadow-lg'
                        : 'bg-transparent border opacity-70 hover:opacity-100'
                    }
`}
        style={{
          backgroundColor: selectedCategory === cat ? colors.safeAccent : 'transparent',
          color: selectedCategory === cat ? colors.accentContrast : colors.text,
          borderColor: selectedCategory === cat ? colors.safeAccent : colors.border,
          ['--pill-color' as any]: `${colors.accent}66`,
        }}
      >
        <span className="block truncate">{cat}</span>
      </button>
    ))}
  </div>
);

// ===== HERO SECTION =====
const DigestHero: React.FC<{
  article: Post;
  colors: ReturnType<typeof getColors>;
  settings: SiteSettings;
  onClick: (id: string) => void;
  onCategoryClick?: (category: string) => void;
  authorEmail?: string;
  authorAvatar?: string;
}> = ({ article, colors, settings, onClick, onCategoryClick, authorEmail, authorAvatar }) => {
  if (!article) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl group cursor-pointer mb-8 border shadow-sm"
      onClick={() => onClick(article.id)}
      style={{ background: colors.surface, borderColor: colors.border }}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Image Side */}
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
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
          )}
          {/* Gradient overlay for mobile */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden" />
        </a>

        {/* Content Side */}
        <div className="lg:w-2/5 p-6 lg:p-8 flex flex-col justify-center relative">
          {/* Accent bar */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-20 rounded-l hidden lg:block"
            style={{ backgroundColor: colors.accent }}
          />

          <div className="mb-4">
            <CategoryBadge
              category={article.category}
              onClick={() => onCategoryClick?.(article.category)}
              size="md"
              colors={colors}
            />
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
            className="text-sm sm:text-base lg:text-lg mb-6 line-clamp-2 lg:line-clamp-3 leading-relaxed"
            style={{ color: colors.textSecondary }}
          >
            {decodeEntities(article.excerpt)}
          </p>

          <div className="flex items-center gap-3">
            <DigestAvatar
              name={article.author}
              email={authorEmail}
              url={authorAvatar}
              size="w-10 h-10"
            />
            <div>
              <p className="font-semibold text-sm" style={{ color: colors.text }}>
                {article.author}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {new Date(article.createdAt || '').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <span className="text-xs" style={{ color: colors.textMuted }}>
                  &bull;
                </span>
                <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
                  {article.readTime || '5 min read'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== ARTICLE CARD =====
const DigestCard: React.FC<{
  article: Post;
  colors: ReturnType<typeof getColors>;
  settings: SiteSettings;
  onClick: (id: string) => void;
  onCategoryClick?: (category: string) => void;
  authorEmail?: string;
  authorAvatar?: string;
}> = ({ article, colors, settings, onClick, onCategoryClick, authorEmail, authorAvatar }) => (
  <div
    className="digest-card group cursor-pointer rounded-xl overflow-hidden border"
    onClick={() => onClick(article.id)}
    style={{ background: colors.surface, borderColor: colors.border }}
  >
    {/* Image */}
    <div className="aspect-[4/3] overflow-hidden relative">
      {article.image ? (
        <img
          {...getResponsiveImageAttributes(article, 'card')}
          alt={decodeEntities(article.title)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(135deg, ${getCategoryColor(article.category)}40, ${colors.surface})`,
          }}
        />
      )}

      {/* Category Badge */}
      <div className="absolute top-3 left-3">
        <CategoryBadge
          category={article.category}
          onClick={() => onCategoryClick?.(article.category)}
          colors={colors}
        />
      </div>
    </div>

    {/* Content */}
    <div className="p-4">
      <h3
        className="font-bold text-lg mb-2 line-clamp-2 leading-snug group-hover:opacity-70 transition-opacity"
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

      <div className="flex items-center gap-2 text-xs" style={{ color: colors.textMuted }}>
        <DigestAvatar name={article.author} email={authorEmail} url={authorAvatar} size="w-6 h-6" />
        <span className="font-medium">{article.author}</span>
        <span>&bull;</span>
        <span>{new Date(article.createdAt || '').toLocaleDateString()}</span>
      </div>
    </div>
  </div>
);

// ===== FOOTER =====
const DigestFooter: React.FC<{ settings: SiteSettings; colors: ReturnType<typeof getColors> }> = ({
  settings,
  colors,
}) => {
  const rssPath = `${getBasePathPrefix()}/rss`;
  return (
    <footer
      className="mt-auto border-t py-8"
      style={{ background: colors.surface, borderColor: colors.border }}
    >
      <div className="max-w-7xl mx-auto px-5 space-y-8">
        {/* Newsletter Widget */}
        {settings.newsletter?.enabled &&
          (settings.newsletter?.position === 'footer' ||
            settings.newsletter?.position === 'both') && (
            <VonNewsletter
              settings={settings.newsletter}
              variant="footer"
              accentColor={settings.theme?.digest?.accentColor || '#00D1D1'}
              themeColors={{
                surface: colors.surface,
                surfaceAlt: colors.surfaceHover,
                border: colors.border,
                text: colors.text,
                textSecondary: colors.textSecondary,
              }}
            />
          )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="max-w-xl text-center md:text-left">
            <span className="font-bold" style={{ color: colors.text }}>
              {settings.siteName}
            </span>
            {settings.siteDescription && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.textMuted }}>
                {settings.siteDescription}
              </p>
            )}
            {settings.siteTagline && (
              <p className="mt-1 text-xs italic" style={{ color: colors.textMuted }}>
                {settings.siteTagline}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <a
              href={rssPath}
              className="hover:opacity-100 transition-opacity flex items-center gap-1.5"
              style={{ color: colors.textMuted }}
              title="RSS Feed"
            >
              <Rss size={14} />
              <span className="text-sm">RSS</span>
            </a>
            <p className="text-sm" style={{ color: colors.textMuted }}>
              &copy; {new Date().getFullYear()} {settings.siteName}. Powered by VonCMS.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ===== PROFILE COMPONENT =====
const DigestProfile: React.FC<{
  targetUser: User;
  currentUser?: User | null;
  posts: Post[];
  comments: any[];
  colors: ReturnType<typeof getColors>;
  settings: SiteSettings;
  onViewPost: (id: string) => void;
  onBack: () => void;
  onNavigateAdmin?: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  postsPerPage?: number;
}> = ({
  targetUser,
  currentUser,
  posts: _posts,
  comments: _comments,
  colors,
  settings,
  onViewPost,
  targetUser: displayUserProp,
  onUpdateUser,
  postsPerPage = 6,
}) => {
  // State for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(displayUserProp.display_name || '');
  const [editBio, setEditBio] = useState(displayUserProp.bio || '');
  const [editAvatar, setEditAvatar] = useState(displayUserProp.avatar || '');
  const [localDisplayUser, setLocalDisplayUser] = useState(displayUserProp);

  // Password Change State
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Sync state when prop changes
  useEffect(() => {
    setLocalDisplayUser(displayUserProp);
    setEditDisplayName(displayUserProp.display_name || '');
    setEditBio(displayUserProp.bio || '');
    setEditAvatar(displayUserProp.avatar || '');
  }, [displayUserProp]);

  const handleSaveProfile = async () => {
    try {
      // Validate Password Change
      if (showPasswordFields) {
        if (!currentPassword) {
          toast.error('Current password is required to set a new one');
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
          toast.error('New passwords do not match');
          return;
        }
      }

      const updatedUser = {
        ...localDisplayUser,
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
        setLocalDisplayUser(updatedUser);
        setIsEditing(false);
        if (onUpdateUser) {
          onUpdateUser({ display_name: editDisplayName, bio: editBio, avatar: editAvatar });
        }
        toast.success(data.message || 'Profile updated!');

        // Clear passwords
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      } else {
        toast.error(data.error || 'Failed to save profile');
        setLocalDisplayUser(displayUserProp);
      }
    } catch (e) {
      toast.error('Failed to save profile');
      setLocalDisplayUser(displayUserProp);
    }
  };

  const [activeTab, setActiveTab] = useState<'articles' | 'comments'>('articles');
  const {
    articlePosts,
    articleTotal,
    articleHasMore,
    articlesLoading,
    articlesError,
    commentItems,
    commentTotal,
    commentHasMore,
    commentsLoading,
    commentsError,
    loadMoreArticles,
    loadMoreComments,
  } = useProfileActivity(targetUser, postsPerPage);

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border rounded-xl shadow-2xl overflow-hidden"
            style={{ borderColor: colors.border }}
          >
            <div className="p-6 border-b" style={{ borderColor: colors.border }}>
              <h3
                className="text-xl font-bold flex items-center gap-2"
                style={{ color: colors.text }}
              >
                <Edit2 size={20} /> Edit Profile
              </h3>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <span
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  Display name / Pen name
                </span>
                <input
                  aria-label="Display name / Pen name"
                  id="layout-display-name"
                  name="layoutDisplayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all"
                  style={{
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                  placeholder="Public author name"
                />
              </div>
              <div>
                <span
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  Avatar URL
                </span>
                <input
                  aria-label="Avatar URL"
                  id="layout-783"
                  name="layout783"
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all"
                  style={{
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                  placeholder="https://..."
                />
              </div>
              <div>
                <span
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  Bio
                </span>
                <textarea
                  id="layout-804"
                  name="layout804"
                  aria-label="Bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all resize-none"
                  style={{
                    background: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                  placeholder="Tell us about yourself..."
                />
              </div>

              {/* Password Change Section */}
              <div className="pt-4 border-t" style={{ borderColor: colors.border }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:opacity-80"
                  style={{ color: colors.accent }}
                >
                  {showPasswordFields ? 'Cancel Password Change' : 'Change Password'}
                </button>

                {showPasswordFields && (
                  <div className="mt-4 space-y-4 animate-fade-in p-4 rounded-lg bg-gray-50 dark:bg-slate-950/50">
                    <div>
                      <span
                        className="block text-xs font-bold uppercase tracking-wider mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        Current Password
                      </span>
                      <input
                        aria-label="Current Password"
                        id="layout-839"
                        name="layout839"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded border focus:ring-1 outline-none"
                        style={{
                          background: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        }}
                      />
                    </div>
                    <div>
                      <span
                        className="block text-xs font-bold uppercase tracking-wider mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        New Password
                      </span>
                      <input
                        id="layout-858"
                        name="layout858"
                        aria-label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="8+ chars, Upper, Number, Symbol"
                        className="w-full px-3 py-2 rounded border focus:ring-1 outline-none"
                        style={{
                          background: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        }}
                      />
                    </div>
                    <div>
                      <span
                        className="block text-xs font-bold uppercase tracking-wider mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        Confirm Password
                      </span>
                      <input
                        aria-label="Confirm Password"
                        id="layout-878"
                        name="layout878"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded border focus:ring-1 outline-none"
                        style={{
                          background: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div
              className="p-4 bg-gray-50 dark:bg-slate-950/50 flex justify-end gap-3 border-t"
              style={{ borderColor: colors.border }}
            >
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors"
                style={{ color: colors.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-6 py-2 rounded-lg font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: colors.accent }}
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="text-center mb-12 relative group">
        <div className="relative inline-block">
          <DigestAvatar
            url={localDisplayUser.avatar}
            name={localDisplayUser.display_name || localDisplayUser.username}
            email={localDisplayUser.email}
            size="w-24 h-24"
            className="mx-auto mb-4 relative z-10"
          />
          {isOwnUserProfile(currentUser, targetUser) && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute bottom-4 -right-2 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border hover:scale-110 transition-transform z-20"
              style={{ borderColor: colors.border }}
              title="Edit Profile"
            >
              <Edit2 size={14} style={{ color: colors.text }} />
            </button>
          )}
        </div>
        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
          style={{ color: colors.text }}
        >
          {localDisplayUser.display_name || localDisplayUser.username}
        </h1>
        {localDisplayUser.display_name && (
          <p className="text-sm mb-2" style={{ color: colors.textMuted }}>
            @{localDisplayUser.username}
          </p>
        )}
        <p
          className="text-sm font-medium uppercase tracking-wider mb-4"
          style={{ color: colors.accent }}
        >
          {getProfileDisplayRole(currentUser, localDisplayUser)}
        </p>
        {localDisplayUser.bio && (
          <p className="max-w-xl mx-auto" style={{ color: colors.textSecondary }}>
            {localDisplayUser.bio}
          </p>
        )}

        {/* User Stats */}
        <div
          className="flex justify-center items-center gap-8 mt-8 pt-8 border-t max-w-lg mx-auto"
          style={{ borderColor: colors.border }}
        >
          <div className="text-center">
            <span className="block text-xl font-bold" style={{ color: colors.text }}>
              {articleTotal}
            </span>
            <span className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>
              Articles
            </span>
          </div>
          <div className="w-px h-8" style={{ background: colors.border }}></div>
          <div className="text-center">
            <span className="block text-xl font-bold" style={{ color: colors.text }}>
              {commentTotal}
            </span>
            <span className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>
              Comments
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-8" style={{ borderColor: colors.border }}>
        <button
          onClick={() => setActiveTab('articles')}
          className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'articles' ? '' : 'opacity-60 hover:opacity-100'}`}
          style={{ color: activeTab === 'articles' ? colors.accent : colors.textSecondary }}
        >
          Articles ({articleTotal})
          {activeTab === 'articles' && (
            <span
              className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
              style={{ background: colors.accent }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'comments' ? '' : 'opacity-60 hover:opacity-100'}`}
          style={{ color: activeTab === 'comments' ? colors.accent : colors.textSecondary }}
        >
          Discussion ({commentTotal})
          {activeTab === 'comments' && (
            <span
              className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
              style={{ background: colors.accent }}
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[360px]">
        {activeTab === 'articles' ? (
          <>
            {articlesLoading && articlePosts.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[360px]">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`digest-article-skeleton-${index}`}
                    className="animate-pulse rounded-xl border p-5"
                    style={{ background: colors.surface, borderColor: colors.border }}
                  >
                    <div
                      className="mb-4 h-40 rounded-lg"
                      style={{ background: colors.surfaceAlt }}
                    />
                    <div className="space-y-3">
                      <div
                        className="h-4 w-3/4 rounded"
                        style={{ background: colors.surfaceAlt }}
                      />
                      <div
                        className="h-4 w-1/2 rounded"
                        style={{ background: colors.surfaceAlt }}
                      />
                      <div
                        className="h-3 w-1/3 rounded"
                        style={{ background: colors.surfaceAlt }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : articlePosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[360px]">
                {articlePosts.map((post) => (
                  <DigestCard
                    key={post.id}
                    article={post}
                    colors={colors}
                    settings={settings}
                    onClick={onViewPost}
                    authorEmail={targetUser.email}
                    authorAvatar={targetUser.avatar}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-12 min-h-[360px]" style={{ color: colors.textMuted }}>
                No articles yet.
              </p>
            )}
          </>
        ) : (
          <>
            {commentsLoading && commentItems.length === 0 ? (
              <div className="space-y-4 min-h-[360px]">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`digest-comment-skeleton-${index}`}
                    className="animate-pulse rounded-xl border p-5"
                    style={{ background: colors.surface, borderColor: colors.border }}
                  >
                    <div
                      className="mb-3 h-4 w-4/5 rounded"
                      style={{ background: colors.surfaceAlt }}
                    />
                    <div
                      className="mb-5 h-4 w-2/3 rounded"
                      style={{ background: colors.surfaceAlt }}
                    />
                    <div className="h-3 w-1/3 rounded" style={{ background: colors.surfaceAlt }} />
                  </div>
                ))}
              </div>
            ) : commentItems.length > 0 ? (
              <div className="space-y-4 min-h-[360px]">
                {commentItems.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="p-5 rounded-xl border transition-all hover:shadow-lg"
                    style={{ background: colors.surface, borderColor: colors.border }}
                  >
                    <p className="mb-3 italic" style={{ color: colors.text }}>
                      "{comment.content}"
                    </p>
                    <div
                      className="flex items-center gap-3 text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} /> {comment.createdAt}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1" style={{ color: colors.accent }}>
                        <ThumbsUp size={12} /> {comment.likes || 0} likes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-12 min-h-[360px]" style={{ color: colors.textMuted }}>
                No discussion activity yet.
              </p>
            )}
          </>
        )}

        {/* Load More */}
        <LoadMoreButton
          loading={activeTab === 'articles' ? articlesLoading : commentsLoading}
          hasMore={activeTab === 'articles' ? articleHasMore : commentHasMore}
          error={activeTab === 'articles' ? articlesError : commentsError}
          onLoadMore={activeTab === 'articles' ? loadMoreArticles : loadMoreComments}
          label="Load More"
          style={{ background: colors.accent }}
        />
      </div>
    </div>
  );
};

// ==========================================
// MAIN LAYOUT COMPONENT
// ==========================================

const DigestLayout: React.FC<ThemeLayoutProps> = ({
  posts,
  pages = [],
  settings,
  isDarkMode,
  toggleDarkMode,
  onPostClick,
  currentView,
  selectedPost,
  selectedPage,
  onBackToHome,
  onPageClick,
  user,
  onLogin,
  onLogout,
  onNavigateAdmin,
  onViewProfile,
  comments,
  onAddComment,
  onLikeComment,
  onReplyComment,
  selectedProfile,
  selectedCategory,
  onCategoryClick,
  allUsers,
  onUpdateUser,
}) => {
  // Theme settings
  const digestSettings: DigestSettings = { ...defaultDigestSettings, ...settings.theme?.digest };
  const colors = getColors(isDarkMode, digestSettings.accentColor);
  const shouldRenderVonSEO = isSystemPluginActive(settings, 'vp_von_seo');

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const postsPerPage = settings.postsPerPage || 6;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  const navigationItems = settings.navigation || [];
  const visibleNavigationItems = getVisibleNavigationItems(navigationItems);
  const overflowNavigationItems = getOverflowNavigationItems(navigationItems);
  const useTabletBurgerMenu = shouldUseTabletBurgerMenu(navigationItems);
  const desktopNavigationClassName = `${
    useTabletBurgerMenu ? 'hidden lg:flex' : 'hidden md:flex'
  } items-center gap-6`;
  const compactNavigationClassName = useTabletBurgerMenu ? 'lg:hidden' : 'md:hidden';

  const handleReturnHome = () => {
    onBackToHome();
    setSearchQuery('');
  };

  // Shared Hooks (v1.9.5)
  const { showPopup, closePopup } = useAdsPopup(settings.ads, currentView, 5000);
  const { targetProfile } = usePublicProfile(selectedProfile, allUsers, settings.adminProfile);

  // Published posts
  const publishedPosts = useMemo(() => posts.filter((p) => p.status === 'published'), [posts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(publishedPosts.map((p) => p.category).filter(Boolean));
    return Array.from(cats);
  }, [publishedPosts]);

  // Filter by category
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
    search: searchQuery,
    limit: postsPerPage,
  });

  const displayedPosts = publicPosts.posts;

  const hasActiveSearch = searchQuery.trim().length > 0;
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
  const categoryArticlesLabel = displayedPosts.length === 1 ? 'article' : 'articles';

  // Load More Logic
  const paginatedPosts = publicPosts.posts;
  const hasMorePosts = publicPosts.hasMore;
  const handleLoadMore = publicPosts.loadMore;
  const loadingMore = publicPosts.loadingMore;
  const isSearching = publicPosts.isLoading;

  // Hero article (first post when not searching)
  const heroArticle = !searchQuery && !selectedCategory && displayedPosts[0];
  const gridPosts = heroArticle ? paginatedPosts.slice(1) : paginatedPosts;

  // Navigation handler
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

  // ===== HEADER =====
  const Header = () => (
    <header
      className="sticky top-0 z-50 backdrop-blur-lg border-b transition-colors"
      style={{
        background: isDarkMode ? 'rgba(13, 13, 18, 0.85)' : 'rgba(250, 249, 247, 0.85)',
        borderColor: colors.border,
      }}
    >
      <div className="max-w-7xl mx-auto px-5 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Site Info */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleReturnHome}>
            {settings.logoUrl ? (
              <ThemeLogo
                src={settings.logoUrl}
                alt={settings.siteName}
                useLogoAsTitle={settings.useLogoAsTitle}
                invertLogoInDarkMode={settings.invertLogoInDarkMode}
              />
            ) : (
              <VonLogo variant="default" className="!w-10 !h-10 !mr-0" />
            )}
            {!settings.useLogoAsTitle && (
              <div className="hidden sm:block max-w-[200px] lg:max-w-[260px]">
                <span
                  className="text-xl font-black tracking-tight block truncate"
                  style={{ color: colors.text }}
                >
                  {settings.siteName}
                </span>
                {settings.siteDescription && (
                  <span
                    className="text-xs font-medium block truncate opacity-80"
                    style={{ color: colors.textMuted }}
                  >
                    {settings.siteDescription}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className={desktopNavigationClassName}>
            {visibleNavigationItems.map((nav) => (
              <button
                key={nav.id}
                onClick={() => handleNavClick(nav)}
                className="text-sm font-semibold hover:opacity-70 transition-opacity"
                style={{ color: colors.text }}
              >
                {nav.label}
              </button>
            ))}

            {/* More Dropdown */}
            {overflowNavigationItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  className="flex items-center gap-1 text-sm font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: colors.text }}
                >
                  More{' '}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showMoreDropdown ? 'rotate-180' : ''}`}
                  />
                </button>

                {showMoreDropdown && (
                  <div
                    className="absolute top-full right-0 mt-2 w-48 rounded-xl shadow-2xl border overflow-hidden z-50"
                    style={{ background: colors.surface, borderColor: colors.border }}
                  >
                    {overflowNavigationItems.map((nav) => (
                      <button
                        key={nav.id}
                        onClick={() => {
                          handleNavClick(nav);
                          setShowMoreDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium hover:opacity-70 transition-opacity"
                        style={{ color: colors.text }}
                      >
                        {nav.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ background: colors.surface, color: colors.text }}
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <Moon size={20} className="text-blue-400" />
              ) : (
                <Sun size={20} className="text-amber-500" />
              )}
            </button>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full transition-all hover:opacity-80"
                  style={{ background: colors.surface }}
                  aria-label="User Menu"
                >
                  <DigestAvatar
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
                </button>

                {showUserDropdown && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl border overflow-hidden z-50"
                    style={{ background: colors.surface, borderColor: colors.border }}
                  >
                    <button
                      onClick={() => {
                        onViewProfile(user.username);
                        setShowUserDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:opacity-70"
                      style={{ color: colors.text }}
                    >
                      View Profile
                    </button>
                    {['Admin', 'Moderator', 'Writer'].includes(user.role) && (
                      <button
                        onClick={() => {
                          onNavigateAdmin();
                          setShowUserDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium hover:opacity-70"
                        style={{ color: colors.text }}
                      >
                        Dashboard
                      </button>
                    )}
                    <div className="border-t" style={{ borderColor: colors.border }} />
                    <button
                      onClick={() => {
                        onLogout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-500"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 shadow-md"
                style={{ background: colors.safeAccent, color: colors.accentContrast }}
              >
                Sign In
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`${compactNavigationClassName} w-10 h-10 rounded-full flex items-center justify-center`}
              style={{ background: colors.surface, color: colors.text }}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className={`${compactNavigationClassName} border-t mt-4 pt-4`}
          style={{ borderColor: colors.border }}
        >
          <nav className="flex flex-col gap-2">
            {navigationItems.map((nav) => (
              <button
                key={nav.id}
                onClick={() => {
                  handleNavClick(nav);
                  setIsMobileMenuOpen(false);
                }}
                className="text-left px-4 py-3 rounded-lg font-semibold"
                style={{ color: colors.text, background: colors.surfaceHover }}
              >
                {nav.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
  // Plugin Hooks (v1.9.9) - Must be at top level
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
      primary: colors.accent,
      secondary: colors.textSecondary,
      surface: colors.surface,
      surfaceAlt: colors.nav,
      border: colors.border,
      text: colors.text,
      textSecondary: colors.textMuted,
    }
  );

  // ===== SINGLE POST VIEW =====
  if (currentView === 'single-post' && selectedPost) {
    const authorUsername = selectedPost.author_data?.username || selectedPost.author;
    const authorUser = allUsers.find((u) => u.username === authorUsername);
    const authorAvatar = selectedPost.author_data?.avatar || authorUser?.avatar;
    const authorEmail = authorUser?.email;
    return (
      <div
        className={`min-h-screen flex flex-col transition-colors ${isDarkMode ? 'dark' : ''}`}
        style={{ background: colors.background }}
      >
        <DigestThemeStyles />
        {shouldRenderVonSEO && (
          <VonSEO settings={settings} currentView={currentView} selectedPost={selectedPost} />
        )}
        <Header />

        {/* Header Ad */}
        {settings.ads?.adsEnabled && settings.ads?.headerAd && (
          <div className="py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
            <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}

        <div className="flex-1 max-w-7xl mx-auto px-5 py-12 w-full">
          <button
            onClick={handleReturnHome}
            className="mb-8 text-sm font-semibold hover:opacity-70 flex items-center gap-2"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} /> Back to Home
          </button>

          <div className={`flex flex-col ${digestSettings.showSidebar ? 'lg:flex-row' : ''} gap-8`}>
            {/* Main Content */}
            <main
              className={`flex-1 ${digestSettings.showSidebar ? 'w-full' : 'max-w-4xl mx-auto'} min-w-0`}
            >
              <article>
                {/* Header */}
                <header className="mb-8">
                  <CategoryBadge
                    category={selectedPost.category}
                    onClick={() => onCategoryClick?.(selectedPost.category)}
                    size="md"
                    colors={colors}
                  />
                  <h1
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mt-4 mb-6 leading-tight"
                    style={{ color: colors.text }}
                  >
                    {decodeEntities(selectedPost.title)}
                  </h1>

                  <div
                    className="flex items-center gap-4 pb-6 border-b"
                    style={{ borderColor: colors.border }}
                  >
                    {/* Author & Date */}
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                      onClick={() => onViewProfile(authorUsername)}
                    >
                      <DigestAvatar
                        name={selectedPost.author}
                        email={authorEmail}
                        url={authorAvatar}
                        size="w-12 h-12"
                      />
                      <div>
                        <p className="font-bold" style={{ color: colors.text }}>
                          {selectedPost.author}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm" style={{ color: colors.textMuted }}>
                            {new Date(selectedPost.createdAt || '').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <span className="text-sm" style={{ color: colors.textMuted }}>
                            &bull;
                          </span>
                          <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
                            {selectedPost.readTime || '5 min read'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                {/* Featured Image - Hide if image in content OR if content has video embed */}
                {(() => {
                  if (!selectedPost.image) return null;
                  // Check if content contains video embeds (iframe, youtube, vimeo, tiktok)
                  if (hasEmbeddedVideoMarkup(selectedPost.content)) return null;

                  // Extract filename from featured image for more reliable duplicate detection
                  const imageFilename = selectedPost.image.split('/').pop()?.split('?')[0] || '';

                  // Check if the exact URL or filename exists in content
                  const contentHasImage =
                    selectedPost.content?.includes(selectedPost.image) ||
                    (imageFilename && selectedPost.content?.includes(imageFilename));

                  if (contentHasImage) return null;
                  return (
                    <div className="aspect-video rounded-2xl overflow-hidden mb-8">
                      <img
                        {...getResponsiveImageAttributes(selectedPost, 'hero')}
                        alt={decodeEntities(selectedPost.title)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })()}

                {/* Share Buttons (Top) */}
                {settings.sharePlacement === 'top' && (
                  <div className="mb-8">
                    <ShareButtons
                      url={window.location.href}
                      title={decodeEntities(selectedPost.title)}
                    />
                  </div>
                )}

                {/* AI Summary Plugin */}
                {aiSummaryPos === 'top' && aiSummary}

                {/* Content */}
                <ContentRenderer
                  html={sanitizeHtml(selectedPost.content)}
                  className="prose prose-lg max-w-none dark:prose-invert digest-content"
                  style={{ color: colors.text }}
                />
                {aiSummaryPos === 'bottom' && aiSummary}

                {/* Related Posts Plugin */}

                {/* Share Buttons (Bottom) */}
                {settings.sharePlacement === 'bottom' && (
                  <div className="mt-12 pt-8 border-t" style={{ borderColor: colors.border }}>
                    <ShareButtons
                      url={window.location.href}
                      title={decodeEntities(selectedPost.title)}
                    />
                  </div>
                )}

                {/* Tags */}
                {selectedPost.keywords && (
                  <div className="mt-8 pt-8 border-t" style={{ borderColor: colors.border }}>
                    <div className="flex flex-wrap gap-2">
                      {selectedPost.keywords.split(',').map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 text-sm rounded-full"
                          style={{ background: colors.surface, color: colors.textSecondary }}
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Posts Plugin */}
                {relatedPosts}
              </article>

              {/* Comments */}
              <div className="mt-16 pt-8 border-t" style={{ borderColor: colors.border }}>
                <h3 className="text-2xl font-bold mb-8" style={{ color: colors.text }}>
                  Discussion
                </h3>
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
                    surface: colors.surface,
                    surfaceAlt: colors.surfaceHover,
                    border: colors.border,
                    text: colors.text,
                    textSecondary: colors.textSecondary,
                    primary: colors.accent,
                  }}
                  id="digest-comments"
                />
              </div>
            </main>

            {/* Sidebar */}
            {digestSettings.showSidebar && (
              <aside className="w-full lg:w-[380px] flex-shrink-0 space-y-6 lg:sticky lg:top-24 h-fit">
                {/* Newsletter Widget (Sidebar) */}
                {settings.newsletter?.enabled &&
                  (settings.newsletter?.position === 'sidebar' ||
                    settings.newsletter?.position === 'both') && (
                    <VonNewsletter
                      settings={settings.newsletter}
                      variant="sidebar"
                      accentColor={colors.accent}
                      themeColors={{
                        surface: colors.surface,
                        surfaceAlt: colors.surfaceHover,
                        border: colors.border,
                        text: colors.text,
                        textSecondary: colors.textSecondary,
                      }}
                    />
                  )}

                {/* Widgets */}
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
            )}
          </div>
        </div>

        <DigestFooter settings={settings} colors={colors} />
      </div>
    );
  }

  // ===== PAGE VIEW =====
  if (currentView === 'page' && selectedPage) {
    return (
      <div
        className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}
        style={{ background: colors.background }}
      >
        <DigestThemeStyles />
        {shouldRenderVonSEO && (
          <VonSEO settings={settings} currentView={currentView} selectedPage={selectedPage} />
        )}
        <Header />

        {/* Header Ad */}
        {settings.ads?.adsEnabled && settings.ads?.headerAd && (
          <div className="py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
            <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
              <AdBlock content={settings.ads.headerAd} slotId="header" />
            </div>
          </div>
        )}

        <main className="flex-1 max-w-4xl mx-auto px-5 py-12 w-full">
          <button
            onClick={handleReturnHome}
            className="mb-8 text-sm font-semibold hover:opacity-70 flex items-center gap-2"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-8"
            style={{ color: colors.text }}
          >
            {selectedPage.title}
          </h1>

          <ContentRenderer
            html={sanitizeHtml(selectedPage.content)}
            className="prose prose-lg max-w-none dark:prose-invert digest-content"
            style={{ color: colors.text }}
          />
        </main>

        <DigestFooter settings={settings} colors={colors} />
      </div>
    );
  }

  // ===== PROFILE VIEW =====
  if (currentView === 'profile' && targetProfile) {
    return (
      <div
        className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}
        style={{ background: colors.background }}
      >
        <DigestThemeStyles />
        {shouldRenderVonSEO && (
          <VonSEO settings={settings} currentView={currentView} selectedProfile={targetProfile} />
        )}
        <Header />

        <main className="flex-1 max-w-6xl mx-auto px-5 py-12 w-full">
          <button
            onClick={handleReturnHome}
            className="mb-8 text-sm font-semibold hover:opacity-70 flex items-center gap-2"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <DigestProfile
            key={targetProfile.id}
            targetUser={targetProfile}
            currentUser={user}
            posts={posts}
            comments={comments}
            colors={colors}
            settings={settings}
            onViewPost={onPostClick}
            onBack={handleReturnHome}
            onNavigateAdmin={onNavigateAdmin}
            onUpdateUser={onUpdateUser}
            postsPerPage={settings.postsPerPage || 6}
          />
        </main>

        <DigestFooter settings={settings} colors={colors} />
      </div>
    );
  }

  // ===== HOME / CATEGORY VIEW =====
  return (
    <div
      className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}
      style={{ background: colors.background, '--digest-accent': colors.accent } as any}
    >
      <DigestThemeStyles />
      {shouldRenderVonSEO && (
        <VonSEO settings={settings} currentView={currentView} selectedCategory={selectedCategory} />
      )}

      {/* Trending Ticker - Improvise */}
      {!selectedCategory && !searchQuery && digestSettings.showTrending !== false && (
        <TrendingTicker
          posts={publishedPosts.slice(0, 5)}
          colors={colors}
          onPostClick={onPostClick}
          enableMarquee={digestSettings.enableMarquee !== false}
        />
      )}

      <Header />

      <div className="max-w-7xl mx-auto px-5 py-8 border-b" style={{ borderColor: colors.border }}>
        <div className="relative group mx-auto w-full max-w-full md:w-[42rem] lg:w-[52rem] xl:w-[58rem]">
          <input
            aria-label="Search"
            id="digest-search"
            name="search"
            type="text"
            placeholder={isSearching ? 'Searching...' : 'Search articles...'}
            value={searchQuery}
            maxLength={PUBLIC_SEARCH_MAX_LENGTH}
            onChange={(e) => setSearchQuery(normalizePublicSearchInput(e.target.value))}
            className="w-full pl-8 pr-14 py-4 text-lg rounded-full outline-none transition-all shadow-sm focus:shadow-md"
            style={{
              background: colors.surface,
              color: colors.text,
              border: `2px solid ${colors.border}`,
            }}
          />
          {searchQuery.length >= PUBLIC_SEARCH_MAX_LENGTH && (
            <p className="mt-2 text-center text-xs font-semibold" style={{ color: colors.accent }}>
              Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
            </p>
          )}
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full cursor-pointer hover:scale-110 transition-transform"
            onClick={() => setSearchQuery(searchQuery.trim())}
            style={{ color: colors.accent, background: 'transparent', border: 'none' }}
          >
            <Search size={22} />
          </button>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 transition-colors"
              style={{ color: colors.textMuted }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Header Ad */}
      {settings.ads?.adsEnabled && settings.ads?.headerAd && (
        <div className="py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
          <div className="max-w-7xl mx-auto px-5 ad-slot-flex">
            <AdBlock content={settings.ads.headerAd} slotId="header" />
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-5 py-8 w-full">
        {/* Category Pills */}
        {digestSettings.showCategoryPills && categories.length > 0 && (
          <div className="mb-8">
            <CategoryPills
              categories={categories}
              selectedCategory={selectedCategory || null}
              onSelect={(cat) => onCategoryClick?.(cat || '')}
              colors={colors}
            />
          </div>
        )}

        {/* Search / Category Header */}
        {hasActiveSearch ? (
          <div className="mb-8 pb-6 border-b" style={{ borderColor: colors.border }}>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-black"
              style={{ color: colors.text }}
            >
              Results for <span style={{ color: colors.accent }}>"{searchQuery.trim()}"</span>
            </h2>
            <p className="mt-2" style={{ color: colors.textSecondary }}>
              {searchResultsCopy}
            </p>
          </div>
        ) : (
          selectedCategory && (
            <div className="mb-8 pb-6 border-b" style={{ borderColor: colors.border }}>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-black"
                style={{ color: colors.text }}
              >
                <span style={{ color: colors.accent }}>{selectedCategory}</span>
              </h2>
              <p className="mt-2" style={{ color: colors.textSecondary }}>
                {displayedPosts.length} {categoryArticlesLabel}
              </p>
            </div>
          )
        )}

        {/* Hero Section */}
        {digestSettings.showHero && heroArticle && !selectedCategory && (
          <DigestHero
            article={heroArticle}
            colors={colors}
            settings={settings}
            onClick={onPostClick}
            onCategoryClick={onCategoryClick}
            authorEmail={
              allUsers.find(
                (u) => u.username === (heroArticle.author_data?.username || heroArticle.author)
              )?.email
            }
            authorAvatar={
              heroArticle.author_data?.avatar ||
              allUsers.find(
                (u) => u.username === (heroArticle.author_data?.username || heroArticle.author)
              )?.avatar
            }
          />
        )}

        {/* Articles Grid */}
        {gridPosts.length > 0 ? (
          <div
            className={`grid gap-6 ${
              digestSettings.gridColumns === 4
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
                : digestSettings.gridColumns === 3
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2'
            }`}
          >
            {gridPosts.map((post, idx) => (
              <React.Fragment key={post.id}>
                <DigestCard
                  article={post}
                  colors={colors}
                  settings={settings}
                  onClick={onPostClick}
                  onCategoryClick={onCategoryClick}
                  authorEmail={
                    allUsers.find((u) => u.username === (post.author_data?.username || post.author))
                      ?.email
                  }
                  authorAvatar={
                    post.author_data?.avatar ||
                    allUsers.find((u) => u.username === (post.author_data?.username || post.author))
                      ?.avatar
                  }
                />
                {/* In-Feed Ad - Dynamic: Grid 2/3 -> every 6, Grid 4 -> every 8 */}
                {settings.ads?.adsEnabled &&
                  settings.ads?.inFeedAd &&
                  (() => {
                    const adInterval =
                      settings.ads.inFeedFrequency || (digestSettings.gridColumns === 4 ? 8 : 6);
                    return (idx + 1) % adInterval === 0;
                  })() && (
                    <div
                      className={`${
                        digestSettings.gridColumns === 4
                          ? 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-4'
                          : digestSettings.gridColumns === 3
                            ? 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-3'
                            : 'col-span-1 sm:col-span-2 md:col-span-2'
                      } py-4 ad-slot-flex`}
                    >
                      <AdBlock content={settings.ads.inFeedAd} slotId="infeed" />
                    </div>
                  )}
              </React.Fragment>
            ))}
          </div>
        ) : isSearching ? (
          <div className="text-center py-20">
            <p className="text-lg" style={{ color: colors.textMuted }}>
              Searching articles...
            </p>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-lg" style={{ color: colors.textMuted }}>
              No articles found.
            </p>
          </div>
        )}

        {/* Load More Button */}
        <LoadMoreButton
          loading={loadingMore}
          hasMore={hasMorePosts}
          onLoadMore={handleLoadMore}
          label="Load More Articles"
          style={{ background: colors.accent }}
        />
      </main>

      <DigestFooter settings={settings} colors={colors} />

      {/* Popup Ad */}
      <VonPopupAd show={showPopup} onClose={closePopup} content={settings.ads.popupAd} />
    </div>
  );
};

export default DigestLayout;
