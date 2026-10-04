import React from 'react';
import type { CorporateSectionProps } from './types';
import {
  AdBlock,
  decodeEntities,
  getResponsiveImageAttributes,
  LoadMoreButton,
  PublicDiscoveryRefreshStatus,
  PublicDiscoverySkeleton,
} from '../../shared';
import type { usePublicPostsQuery } from '../../shared';
import ThemeImage from '../../shared/ThemeImage';
import PublicNavigationLink from '../../shared/components/PublicNavigationLink';
import { getPermalink, getPublicCategoryHref, getPublicHomeHref } from '../../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../../utils/linkEvents';

interface LatestPostsSectionProps extends CorporateSectionProps {
  publicPosts: ReturnType<typeof usePublicPostsQuery>;
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
  onPostClick: (id: string) => void;
  isInitialDiscoveryLoading: boolean;
  isCategoryRefreshing: boolean;
}

const LatestPostsSection = ({
  settings,
  posts,
  pages,
  onNavigate,
  publicPosts,
  selectedCategory,
  onCategoryClick,
  onPostClick,
  isInitialDiscoveryLoading,
  isCategoryRefreshing,
}: LatestPostsSectionProps) => {
  const visiblePosts = publicPosts.posts;
  const hasMore = publicPosts.hasMore;
  const loadingMore = publicPosts.loadingMore;
  const handleLoadMore = publicPosts.loadMore;

  return (
    <section
      className="py-20 bg-white dark:bg-neutral-950"
      aria-busy={isCategoryRefreshing || undefined}
    >
      <div className="max-w-7xl mx-auto px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end mb-12">
          <div>
            {selectedCategory ? (
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {selectedCategory}
              </h1>
            ) : (
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {settings.theme?.corporatePro?.postsTitle || 'Latest Insights'}
              </h2>
            )}
            <p className="text-slate-600 dark:text-neutral-400">
              {settings.theme?.corporatePro?.postsSubtitle || 'News and updates from our experts.'}
            </p>
          </div>
          {!selectedCategory &&
            settings.theme?.corporatePro?.newsLink?.trim() &&
            settings.theme.corporatePro.newsLink.trim() !== '#' && (
              <PublicNavigationLink
                nav={{
                  id: 'corporate-news-link',
                  label: 'View All Articles',
                  url: settings.theme.corporatePro.newsLink,
                  type: 'internal',
                }}
                settings={settings}
                posts={posts}
                pages={pages}
                onNavigate={() => onNavigate(settings.theme.corporatePro?.newsLink)}
                className="shrink-0 font-semibold text-(--corporate-link) dark:text-(--corporate-accent-light) hover:underline"
              >
                View All Articles
              </PublicNavigationLink>
            )}
        </div>
        {selectedCategory && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Category: <span className="text-(--corporate-link)">{selectedCategory}</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  Showing server-backed results beyond the homepage preload.
                </p>
                <PublicDiscoveryRefreshStatus
                  active={isCategoryRefreshing}
                  className="mt-3 text-(--corporate-link) dark:text-(--corporate-accent-light)"
                />
              </div>
              {onCategoryClick && (
                <a
                  href={getPublicHomeHref()}
                  onClick={(event) => handleCrawlableLinkClick(event, () => onCategoryClick(''))}
                  className="text-sm font-semibold text-(--corporate-link) transition-colors hover:text-(--corporate-link)"
                >
                  View All Articles
                </a>
              )}
            </div>
          </div>
        )}
        {isInitialDiscoveryLoading ? (
          <PublicDiscoverySkeleton />
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
                          <AdBlock content={settings.ads.inFeedAd} slotId={`infeed-${index}`} />
                        </div>
                      </div>
                    )}
                  <article className="group cursor-pointer" onClick={() => onPostClick(post.id)}>
                    <div className="aspect-16/10 overflow-hidden rounded-xl mb-6 bg-slate-100 dark:bg-neutral-800 relative">
                      <ThemeImage
                        {...getResponsiveImageAttributes(
                          post,
                          'gridThreeFromMd',
                          'https://via.placeholder.com/800x600'
                        )}
                        alt={decodeEntities(post.title)}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <a
                        href={getPublicCategoryHref(post.category)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCrawlableLinkClick(event, () => onCategoryClick?.(post.category));
                        }}
                        className="absolute top-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider text-slate-800 transition-colors hover:text-(--corporate-link) dark:text-neutral-200 dark:hover:text-(--corporate-accent-light)"
                      >
                        {post.category}
                      </a>
                    </div>
                    <h3 className="text-xl font-bold mb-3 group-hover:text-(--corporate-link) transition-colors line-clamp-2 text-slate-900 dark:text-white">
                      <a
                        href={getPermalink(post, settings)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCrawlableLinkClick(event, () => onPostClick(post.id));
                        }}
                      >
                        {decodeEntities(post.title)}
                      </a>
                    </h3>
                    <p className="text-slate-600 dark:text-neutral-400 mb-4 line-clamp-3 text-sm">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-400 dark:text-neutral-500 group-hover:text-(--corporate-link) transition-colors uppercase tracking-wide">
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
                href={publicPosts.nextPageHref}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default LatestPostsSection;
