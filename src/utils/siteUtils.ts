import type { CSSProperties } from 'react';
import type { SiteSettings, Post, Comment, Page, NavItem } from '../types';
import { BASE_PATH } from '../config/site.config';
import { extractYouTubeVideo } from '../components/editor/editorVideoUtils';
import { decodeEntities } from './textUtils';

export {
  DEFAULT_SITE_DATE_FORMAT,
  SITE_DATE_FORMAT_OPTIONS,
  formatDate,
  formatDateTime,
  getPostPublishTimestamp,
  normalizeSchemaDateTime,
  normalizeSiteDateFormat,
} from './dateFormat';

export {
  getHeaderIdentityState,
  HEADER_IDENTITY_MODES,
  resolveHeaderIdentityMode,
} from './headerIdentity';

export const getBasePathPrefix = (): string =>
  BASE_PATH === '/' || !BASE_PATH ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;

export const getCategorySlug = (category: string | null | undefined): string => {
  const raw = decodeEntities(String(category || '').trim());
  if (!raw) return 'uncategorized';

  const slug = raw
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .replace(/_/g, ' ')
    .replace(/\s+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'uncategorized';
};

// Advisory only: these public folders can collide with Category & Name permalinks.
const CATEGORY_FOLDER_PATHS = new Set([
  'api',
  'assets',
  'backups',
  'core',
  'data',
  'docs',
  'fonts',
  'themes',
  'uploads',
]);

export const getCategoryFolderConflict = (category: string | null | undefined): string | null => {
  const slug = getCategorySlug(category);
  return CATEGORY_FOLDER_PATHS.has(slug) ? slug : null;
};

export const getPermalink = (
  post: Post,
  settings: SiteSettings,
  absolute: boolean = false,
  noBase: boolean = false
): string => {
  const domain = settings.domainUrl ? settings.domainUrl.replace(/\/$/, '') : '';
  const basePath = getBasePathPrefix();
  const slug = post.slug || post.id;

  let path = '';
  switch (settings.permalinkStructure) {
    case 'date':
    case 'day_name': {
      const d = new Date(
        post.createdAt || post.created_at || post.updatedAt || post.updated_at || ''
      );
      if (isNaN(d.getTime())) {
        path = `/${slug}`;
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        path = `/${y}/${m}/${day}/${slug}`;
      }
      break;
    }
    case 'month_name': {
      const d = new Date(
        post.createdAt || post.created_at || post.updatedAt || post.updated_at || ''
      );
      if (isNaN(d.getTime())) {
        path = `/${slug}`;
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        path = `/${y}/${m}/${slug}`;
      }
      break;
    }
    case 'category':
      // Keep client links aligned with PHP canonical, sitemap, RSS, and llms category slugs.
      const category = getCategorySlug(post.category);
      path = `/${category}/${slug}`;
      break;
    case 'post_name':
    case 'slug': // Alias used by UI
      path = `/${slug}`;
      break;
    case 'plain':
      path = `/post/${post.id}`;
      break;
    default:
      path = `/${slug}`; // Fallback to slug (safer than /post/{id})
      break;
  }

  // Path Agnosticism: Add basePath unless explicitly skipped (e.g., for navigation)
  // Or if domain already includes the basePath (avoid duplication)
  const isOverlap = absolute && domain && basePath && domain.endsWith(basePath);
  const finalPath = noBase || isOverlap ? path : `${basePath}${path}`;

  if (absolute) {
    if (domain) {
      return `${domain}${finalPath}`;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${finalPath}`;
    }
  }

  return finalPath;
};

export const normalizeSiteUrl = (url?: string): string => {
  if (!url) return '#';

  const trimmed = url.trim();
  if (!trimmed) return '#';

  if (trimmed.includes('\\')) return '#';

  if (trimmed.startsWith('//')) return '#';

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? trimmed : '#';
    } catch {
      return '#';
    }
  }

  if (trimmed.startsWith('#') || trimmed.startsWith('.')) return trimmed;

  const basePath = getBasePathPrefix();
  const hasBasePath =
    !!basePath &&
    (trimmed === basePath ||
      trimmed.startsWith(`${basePath}/`) ||
      trimmed.startsWith(`${basePath}?`) ||
      trimmed.startsWith(`${basePath}#`));

  if (trimmed.startsWith('/')) {
    return hasBasePath ? trimmed : `${basePath}${trimmed}`;
  }

  if (trimmed.startsWith('?')) {
    return `${basePath || ''}/${trimmed}`;
  }

  return `${basePath}/${trimmed.replace(/^\/+/, '')}`;
};

export const getSameSiteCategoryNavigation = (url?: string): string | null => {
  if (!url || typeof window === 'undefined') return null;

  const normalizedUrl = normalizeSiteUrl(url);
  if (normalizedUrl === '#') return null;

  try {
    const parsedUrl = new URL(normalizedUrl, window.location.origin);
    if (parsedUrl.origin !== window.location.origin) return null;

    const basePath = getBasePathPrefix();
    const homePath = (basePath || '/').replace(/\/+$/, '') || '/';
    const targetPath = parsedUrl.pathname.replace(/\/+$/, '') || '/';
    if (targetPath !== homePath || !parsedUrl.searchParams.has('category')) return null;

    return (parsedUrl.searchParams.get('category') || '').trim().slice(0, 100);
  } catch {
    return null;
  }
};

export const getPublicHomeHref = (): string => normalizeSiteUrl('/');

export const getPublicCategoryHref = (category: string): string =>
  normalizeSiteUrl(`/?category=${encodeURIComponent(category.trim())}`);

export const getPublicProfileHref = (username: string): string =>
  normalizeSiteUrl(`/profile/${encodeURIComponent(username.trim())}`);

export const getPublicNavigationHref = (
  nav: NavItem,
  settings: SiteSettings,
  posts: Post[] = [],
  pages: Page[] = []
): string | null => {
  const target = String(nav.url || '').trim();
  const projectedHref = String(nav.resolvedHref || '').trim();
  if (projectedHref !== '') {
    const normalizedProjectedHref = normalizeSiteUrl(projectedHref);
    if (normalizedProjectedHref !== '#') return normalizedProjectedHref;
  }
  if (target === 'home' || target === '/') return getPublicHomeHref();

  if (target.startsWith('page:')) {
    const pageRef = target.slice(5).trim();
    const page = pages.find((candidate) => candidate.id === pageRef || candidate.slug === pageRef);
    return page?.status === 'published' && page.slug ? normalizeSiteUrl(`/${page.slug}`) : null;
  }

  if (target.startsWith('post:')) {
    const postRef = target.slice(5).trim();
    if (!postRef) return null;
    const post = posts.find((candidate) => candidate.id === postRef || candidate.slug === postRef);
    const scheduledAt = String(post?.scheduledAt || post?.scheduled_at || '').trim();
    return post?.status === 'published' && scheduledAt === '' ? getPermalink(post, settings) : null;
  }

  const href = normalizeSiteUrl(target);
  return href === '#' ? null : href;
};

export const normalizeImageSource = (url?: string, fallback: string = ''): string => {
  if (!url) return fallback;

  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//')) return fallback;

  if (trimmed.startsWith('data:image/')) return trimmed;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : fallback;
    } catch {
      return fallback;
    }
  }

  const basePath = getBasePathPrefix();
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `${basePath}/${trimmed.replace(/^\/+/, '')}`;
};

/**
 * Extracts a thumbnail URL from the first video embed found in the HTML content.
 * Uses the editor's YouTube URL parser. Vimeo has no synchronous thumbnail URL.
 */
export const extractVideoThumbnail = (content: string): string | null => {
  if (!content) return null;

  const doc = new DOMParser().parseFromString(content, 'text/html');
  doc.querySelectorAll('script,style,template').forEach((node) => node.remove());
  const urls = Array.from(doc.querySelectorAll('iframe[src],a[href]')).map(
    (node) => node.getAttribute(node.tagName === 'IFRAME' ? 'src' : 'href') || ''
  );
  urls.push(...((doc.body.textContent || '').match(/https?:\/\/[^\s<>"']+/g) || []));
  for (const url of urls) {
    const video = extractYouTubeVideo(url);
    if (video) return `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
  }

  return null;
};

/**
 * Recursively flattens a tree of comments into a flat array.
 */

const RESPONSIVE_IMAGE_SIZES = {
  card: '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 480px',
  hero: '100vw',
  portalHero:
    '(max-width: 1023px) calc(100vw - 40px), (max-width: 1280px) calc(60vw - 24px), 744px',
  splitHero: '(max-width: 767px) 100vw, 50vw',
  articleHero: '(max-width: 1023px) calc(100vw - 40px), 960px',
  wideArticleHero: '(max-width: 1199px) calc(100vw - 48px), 1152px',
  gridTwoMd: '(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(50vw - 32px), 600px',
  gridThreeMd:
    '(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 32px), (max-width: 1279px) calc(33.333vw - 32px), 400px',
  gridThreeFromMd:
    '(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc(33.333vw - 32px), 400px',
  gridFourMd:
    '(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 32px), (max-width: 1279px) calc(25vw - 30px), 300px',
  gridTwoSm: '(max-width: 639px) calc(100vw - 40px), (max-width: 1279px) calc(50vw - 32px), 600px',
  gridThreeSm:
    '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 32px), (max-width: 1279px) calc(33.333vw - 32px), 400px',
  gridThreeSmMd:
    '(max-width: 639px) calc(100vw - 40px), (max-width: 767px) calc(50vw - 32px), (max-width: 1279px) calc(33.333vw - 32px), 400px',
  gridFourSm:
    '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 32px), (max-width: 1279px) calc(25vw - 30px), 300px',
  listCard: '(max-width: 639px) calc(100vw - 40px), 320px',
  thumbnail96: '96px',
  thumbnail128: '128px',
  content: '(max-width: 768px) 100vw, 960px',
} as const;

export type ResponsiveImageMode = keyof typeof RESPONSIVE_IMAGE_SIZES;

const RESPONSIVE_IMAGE_OBJECT_POSITION: Record<
  ResponsiveImageMode,
  CSSProperties['objectPosition']
> = {
  card: 'center 38%',
  hero: 'center center',
  portalHero: 'center center',
  splitHero: 'center center',
  articleHero: 'center center',
  wideArticleHero: 'center center',
  gridTwoMd: 'center 38%',
  gridThreeMd: 'center 38%',
  gridThreeFromMd: 'center 38%',
  gridFourMd: 'center 38%',
  gridTwoSm: 'center 38%',
  gridThreeSm: 'center 38%',
  gridThreeSmMd: 'center 38%',
  gridFourSm: 'center 38%',
  listCard: 'center 38%',
  thumbnail96: 'center 38%',
  thumbnail128: 'center 38%',
  content: 'center center',
};

export const getResponsiveImageAttributes = (
  item: { image?: string; imageSrcSet?: string } | null | undefined,
  mode: ResponsiveImageMode = 'card',
  fallbackSrc?: string
): { src?: string; srcSet?: string; sizes?: string; style?: CSSProperties } => {
  const src = item?.image || fallbackSrc;
  const srcSet = item?.imageSrcSet || undefined;

  if (!src) {
    return {};
  }

  return {
    src,
    srcSet,
    sizes: srcSet ? RESPONSIVE_IMAGE_SIZES[mode] : undefined,
    style: { objectPosition: RESPONSIVE_IMAGE_OBJECT_POSITION[mode] },
  };
};
export const flattenComments = (
  items: Comment[],
  isReply = false
): (Comment & { isReply?: boolean })[] => {
  return items.reduce<(Comment & { isReply?: boolean })[]>((acc, item) => {
    acc.push({ ...item, isReply });
    if (item.replies && item.replies.length > 0) {
      acc.push(...flattenComments(item.replies, true));
    }
    return acc;
  }, []);
};
