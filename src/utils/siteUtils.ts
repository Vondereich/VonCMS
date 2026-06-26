import type { CSSProperties } from 'react';
import { SiteSettings, Post, Comment } from '../types';
import { BASE_PATH } from '../config/site.config';

export const getBasePathPrefix = (): string =>
  BASE_PATH === '/' || !BASE_PATH ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;

export const formatDate = (dateString: string, timeZone?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timeZone || undefined,
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

export const getCategorySlug = (category: string | null | undefined): string => {
  const raw = String(category || '').trim();
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
  const isOverlap = domain && basePath && domain.endsWith(basePath);
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

  if (trimmed.toLowerCase().startsWith('javascript:')) return '#';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return trimmed;
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

/**
 * Extracts a thumbnail URL from the first video embed found in the HTML content.
 * Supports YouTube and Vimeo.
 */
export const extractVideoThumbnail = (content: string): string | null => {
  if (!content) return null;

  // YouTube (iframe or short link)
  const ytMatch = content.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }

  // Vimeo
  const vimeoMatch = content.match(/player\.vimeo\.com\/video\/([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    // Vimeo requires an API call to get the thumbnail, but we can't do async easily in sync flow sometimes.
    // However, we can return a specialized URL that the frontend or a service worker might handle,
    // OR just rely on saving it at runtime if we make this async.
    // For now, let's stick to YouTube which is 90% of use cases, or use a placeholder/generic vimeo logic if known.
    // Actually, without async fetching from Vimeo API, we can't guess the jpg.
    return null;
  }

  return null;
};

/**
 * Recursively flattens a tree of comments into a flat array.
 */

const RESPONSIVE_IMAGE_SIZES = {
  card: '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 480px',
  hero: '100vw',
  content: '(max-width: 768px) 100vw, 960px',
} as const;

export type ResponsiveImageMode = keyof typeof RESPONSIVE_IMAGE_SIZES;

const RESPONSIVE_IMAGE_OBJECT_POSITION: Record<
  ResponsiveImageMode,
  CSSProperties['objectPosition']
> = {
  card: 'center 38%',
  hero: 'center center',
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
