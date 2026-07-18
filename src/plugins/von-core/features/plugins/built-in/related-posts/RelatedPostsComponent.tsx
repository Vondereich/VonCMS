import React, { useMemo } from 'react';
import { Post, SiteSettings } from '../../../../../../types';
import { RelatedPostsConfig } from './types';
import { findRelatedPosts } from './matcher';
import { getPermalink, getResponsiveImageAttributes } from '../../../../../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../../../../../utils/linkEvents';

// Theme colors for custom theme overrides
interface ThemeColors {
  surface?: string;
  surfaceAlt?: string;
  border?: string;
  text?: string;
  textSecondary?: string;
  primary?: string;
}

type RelatedPostCardStyle = React.CSSProperties & {
  '--hover-border': string;
};

interface RelatedPostsComponentProps {
  config: RelatedPostsConfig;
  settings?: SiteSettings;
  currentPost: Post;
  allPosts: Post[];
  onPostClick?: (post: Post) => void;
  themeColors?: ThemeColors;
}

export const RelatedPostsComponent: React.FC<RelatedPostsComponentProps> = ({
  config,
  settings,
  currentPost,
  allPosts,
  onPostClick,
  themeColors,
}) => {
  const permalinkSettings =
    settings ||
    ((typeof window !== 'undefined' ? window.__site_settings : null) as SiteSettings | null) ||
    ({ permalinkStructure: 'slug' } as SiteSettings);

  const relatedPostsSignature = allPosts
    .map((post) => {
      const postWithViews = post as Post & { views?: number };
      return [
        post.id,
        post.status,
        post.category,
        post.keywords,
        post.createdAt || post.created_at,
        post.updatedAt || post.updated_at,
        postWithViews.views || 0,
      ].join(':');
    })
    .join('|');

  // Find related posts
  const relatedPosts = useMemo(
    () => findRelatedPosts(currentPost, allPosts, config),
    [
      currentPost.id,
      currentPost.category,
      currentPost.keywords,
      config.orderBy,
      config.count,
      relatedPostsSignature,
    ]
  );

  // Don't render if no related posts
  if (relatedPosts.length === 0) return null;

  const gridColumnClass = [4, 8].includes(relatedPosts.length)
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'
    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6';

  return (
    <div
      className="related-posts mt-16 pt-8 border-t"
      style={{ borderColor: themeColors?.border || undefined }}
    >
      <h3 className="text-2xl font-bold mb-6" style={{ color: themeColors?.text || undefined }}>
        {config.titleText}
      </h3>

      {/* Grid Layout */}
      {config.layout === 'grid' && (
        <div className={gridColumnClass}>
          {relatedPosts.map((post) => (
            <a
              key={post.id}
              href={getPermalink(post, permalinkSettings)}
              onClick={(event) => {
                if (!onPostClick) return;
                handleCrawlableLinkClick(event, () => {
                  onPostClick(post);
                });
              }}
              className="group cursor-pointer rounded-xl overflow-hidden border hover:shadow-xl transition-all"
              style={
                {
                  backgroundColor: themeColors?.surface || undefined,
                  borderColor: themeColors?.border || undefined,
                  '--hover-border': themeColors?.primary || 'var(--color-primary, #3b82f6)',
                } as RelatedPostCardStyle
              }
            >
              {config.showImage && post.image && (
                <div
                  className="aspect-[16/9] overflow-hidden"
                  style={{ backgroundColor: themeColors?.surfaceAlt || undefined }}
                >
                  <img
                    {...getResponsiveImageAttributes(post, 'card')}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-4">
                <h4
                  className="font-bold transition-colors line-clamp-2 mb-2"
                  style={{ color: themeColors?.text || 'inherit' }}
                >
                  {post.title}
                </h4>
                {config.showExcerpt && post.excerpt && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                    {post.excerpt}
                  </p>
                )}
                {config.showDate && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {new Date(post.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* List Layout */}
      {config.layout === 'list' && (
        <div className="space-y-4">
          {relatedPosts.map((post) => (
            <a
              key={post.id}
              href={getPermalink(post, permalinkSettings)}
              onClick={(event) => {
                if (!onPostClick) return;
                handleCrawlableLinkClick(event, () => {
                  onPostClick(post);
                });
              }}
              className="group cursor-pointer flex gap-4 p-4 rounded-lg border hover:shadow-lg transition-all"
              style={
                {
                  backgroundColor: themeColors?.surface || undefined,
                  borderColor: themeColors?.border || undefined,
                  '--hover-border': themeColors?.primary || 'var(--color-primary, #3b82f6)',
                } as RelatedPostCardStyle
              }
            >
              {config.showImage && post.image && (
                <div
                  className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ backgroundColor: themeColors?.surfaceAlt || undefined }}
                >
                  <img
                    {...getResponsiveImageAttributes(post, 'card')}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4
                  className="font-bold transition-colors line-clamp-1 mb-1"
                  style={{ color: themeColors?.text || 'inherit' }}
                >
                  {post.title}
                </h4>
                {config.showDate && (
                  <p className="text-xs text-slate-500">
                    {new Date(post.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Cards Layout */}
      {config.layout === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedPosts.map((post) => (
            <a
              key={post.id}
              href={getPermalink(post, permalinkSettings)}
              onClick={(event) => {
                if (!onPostClick) return;
                handleCrawlableLinkClick(event, () => {
                  onPostClick(post);
                });
              }}
              className="group cursor-pointer flex gap-4 p-5 rounded-xl border hover:shadow-xl transition-all"
              style={
                {
                  background: themeColors
                    ? `linear-gradient(to bottom right, ${themeColors.surface}, ${themeColors.surfaceAlt || themeColors.surface})`
                    : undefined,
                  borderColor: themeColors?.border || undefined,
                  '--hover-border': themeColors?.primary || 'var(--color-primary, #3b82f6)',
                } as RelatedPostCardStyle
              }
            >
              {config.showImage && post.image && (
                <div
                  className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden shadow-md"
                  style={{ backgroundColor: themeColors?.surfaceAlt || undefined }}
                >
                  <img
                    {...getResponsiveImageAttributes(post, 'card')}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4
                  className="font-bold text-lg transition-colors line-clamp-2 mb-2"
                  style={{ color: themeColors?.text || 'inherit' }}
                >
                  {post.title}
                </h4>
                {config.showDate && (
                  <p className="text-xs text-zinc-500 font-medium">
                    {new Date(post.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
