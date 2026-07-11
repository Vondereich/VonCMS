import React, { useEffect, useState } from 'react';
import { SidebarWidget, SiteSettings, Post } from '../../../../../types';
import { API } from '../../../../../config/site.config';
import { vonFetch } from '../../../../../utils/api';
import AdBlock from '../../../../../themes/shared/components/AdBlock';
import { sanitizeHtml } from '../../../../../utils/security';
import { getPermalink } from '../../../../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../../../../utils/linkEvents';

// Theme colors for custom theme overrides (e.g., Digest theme)
interface ThemeColors {
  surface?: string; // Card/box background
  border?: string; // Border color
  text?: string; // Primary text
  textSecondary?: string; // Secondary text
}

interface SidebarProps {
  widget: SidebarWidget;
  settings: SiteSettings;
  posts?: Post[];
  onPostClick?: (id: string) => void;
  currentPostId?: string | number;
  themeColors?: ThemeColors; // Optional theme color overrides
}

const formatSidebarFreshness = (dateValue?: string | null): string | null => {
  if (!dateValue) return null;

  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const ageMs = Date.now() - timestamp;

  if (ageMs < 0) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (ageMs < hourMs) {
    const minutesOld = Math.max(1, Math.floor(ageMs / minuteMs));
    return `${minutesOld} min ago`;
  }

  if (ageMs < dayMs) {
    const hoursOld = Math.max(1, Math.floor(ageMs / hourMs));
    return `${hoursOld}h ago`;
  }

  const daysOld = Math.floor(ageMs / dayMs);
  if (daysOld === 1) return 'Yesterday';
  if (daysOld <= 2) return `${daysOld} days ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizeSidebarPost = (post: any): Post => ({
  ...post,
  image: post.image || post.image_url || '',
  imageSrcSet: post.imageSrcSet || post.image_srcset || '',
  createdAt: post.created_at || post.createdAt || '',
  updatedAt: post.updated_at || post.updatedAt || post.created_at || '',
  scheduledAt: post.scheduled_at || post.scheduledAt || '',
  author_data: post.author_data || { username: post.author || '', avatar: '' },
  readTime: post.readTime || '',
});

export const VpSidebarWidget: React.FC<SidebarProps> = ({
  widget,
  settings,
  posts = [],
  onPostClick,
  currentPostId,
  themeColors,
}) => {
  const [fetchedPosts, setFetchedPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (widget.type !== 'trending' || widget.isVisible === false) {
      setFetchedPosts([]);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    params.set('public', '1');
    params.set('includeTotal', 'false');
    params.set('limit', String(Math.max(1, Math.min(20, widget.itemCount || 5))));

    void vonFetch(`${API.getPosts}?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const rawPosts = Array.isArray(data) ? data : data?.posts || [];
        setFetchedPosts(rawPosts.map(normalizeSidebarPost));
      })
      .catch(() => {
        if (!cancelled) setFetchedPosts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [widget.isVisible, widget.itemCount, widget.type]);

  if (!widget.isVisible) return null;

  // Premium Card Style for Sidebar - use themeColors if provided
  const boxStyle = {
    borderRadius: 'var(--border-radius)',
    ...(themeColors
      ? { backgroundColor: themeColors.surface, borderColor: themeColors.border }
      : {}),
  };
  const boxClass = themeColors
    ? 'p-8 border animate-fade-in shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
    : 'bg-white dark:bg-slate-900 p-8 border border-gray-100 dark:border-gray-800 animate-fade-in shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';

  switch (widget.type) {
    case 'trending':
      // Get configurable number of published posts as "Trending" (default 5)
      const limit = widget.itemCount || 5;
      const sidebarPosts = fetchedPosts.length > 0 ? fetchedPosts : posts;
      const trendingPosts = sidebarPosts.filter((p) => p.status === 'published').slice(0, limit);

      if (trendingPosts.length === 0) return null;

      return (
        <div className={boxClass} style={boxStyle}>
          <h4
            className="font-black text-slate-900 dark:text-white mb-8 border-b pb-4 flex items-center justify-between group/title"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.1)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-red-500 animate-pulse">🔥</span> {widget.title}
            </div>
            <div className="h-1 w-12 bg-red-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 w-0 group-hover/title:w-full transition-all duration-700"></div>
            </div>
          </h4>
          <ul className="space-y-6">
            {trendingPosts.map((post, index) => {
              const isCurrentPost =
                currentPostId !== undefined && String(post.id) === String(currentPostId);

              return (
                <li key={post.id} className="group cursor-pointer relative">
                  <a
                    href={getPermalink(post, settings, true)}
                    onClick={(event) => {
                      if (!onPostClick) return;
                      handleCrawlableLinkClick(event, () => onPostClick(post.id));
                    }}
                    aria-current={isCurrentPost ? 'page' : undefined}
                    className={`flex gap-4 items-start rounded-md px-3 py-2 -mx-3 transition-colors ${
                      isCurrentPost ? '' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className={`text-4xl font-black transition-all duration-500 select-none leading-none ${
                        isCurrentPost
                          ? 'text-[var(--color-primary)]'
                          : 'text-slate-300 dark:text-slate-800/50 group-hover:text-[var(--color-primary)]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 pt-1">
                      {(() => {
                        const sourceDate =
                          post.scheduledAt ||
                          post.scheduled_at ||
                          post.createdAt ||
                          post.created_at ||
                          '';
                        const freshnessLabel = formatSidebarFreshness(sourceDate);

                        return freshnessLabel ? (
                          <span className="text-[10px] uppercase font-bold tracking-wide text-slate-400 dark:text-slate-500 mb-1 block">
                            {freshnessLabel}
                          </span>
                        ) : null;
                      })()}
                      <p
                        className={`text-sm font-bold transition-colors leading-relaxed line-clamp-2 ${
                          isCurrentPost
                            ? 'text-[var(--color-primary)]'
                            : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                        }`}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
                      />
                      <div
                        className={`mt-2 h-0.5 bg-[var(--color-primary)] transition-all duration-500 opacity-50 ${
                          isCurrentPost ? 'w-full' : 'w-0 group-hover:w-full'
                        }`}
                      ></div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      );

    case 'custom':
      return (
        <div className={boxClass} style={boxStyle}>
          <h4
            className="font-bold text-slate-900 dark:text-white mb-6 border-b pb-4 text-center"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.1)' }}
          >
            {widget.title}
          </h4>
          <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-light flex flex-col items-center text-center">
            <AdBlock
              content={widget.content || ''}
              className="w-full"
              slotId={`sidebar-${widget.id}`}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};
