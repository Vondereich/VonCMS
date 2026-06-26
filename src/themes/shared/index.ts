/**
 * VonCMS Theme SDK
 *
 * Unified entry point for hooks, components, and utilities
 * designed for VonCMS theme development.
 */

// 1. Core UI Components
export { default as ContentRenderer } from '../../components/ContentRenderer';
export { default as VonNewsletter } from '../../components/VonNewsletter';
export { default as ShareButtons } from '../../components/ShareButtons';
export { LoadMoreButton } from '../../components/LoadMoreButton';
export { VonLogo } from '../../components/VonLogo';
export { default as AdBlock } from './components/AdBlock';
export { default as VonPopupAd } from './components/VonPopupAd';

// 2. SEO & Security
export { default as VonSEO } from '../../plugins/von-core/features/seo/VonSEO';
export { sanitizeHtml } from '../../utils/security';
export { decodeEntities } from '../../utils/textUtils';
export { formatDate, getResponsiveImageAttributes } from '../../utils/siteUtils';

// 3. Plugin Components
export { VpComments } from '../../plugins/von-core/features/public/components/Comments';
export { VpSidebarWidget } from '../../plugins/von-core/features/public/components/Sidebar';
export { default as UserProfile } from '../../plugins/von-core/features/users/UserProfile';

// 4. Standard Theme Hooks
export {
  usePublicProfile,
  useAdsPopup,
  useClickOutside,
  useLoadMore,
  useSinglePost,
  useServerSearch,
  PUBLIC_SEARCH_MAX_LENGTH,
  normalizePublicSearchInput,
  usePublicPostsQuery,
  useProfileActivity,
} from '../../hooks';

// 5. Plugin Hooks (Built-in)
export { useAISummary, useRelatedPosts } from '../../hooks/usePlugins';

// 6. Styles
export { ProseDarkModeStyles } from '../../styles/DarkModeStyles';
