import React, { useEffect, useState } from 'react';
import { Post, SiteSettings } from '../types';
import { AISummaryComponent } from '../plugins/von-core/features/plugins/built-in/ai-summary/AISummaryComponent';
import { AISummaryConfig } from '../plugins/von-core/features/plugins/built-in/ai-summary/types';
import { RelatedPostsComponent } from '../plugins/von-core/features/plugins/built-in/related-posts/RelatedPostsComponent';
import { RelatedPostsConfig } from '../plugins/von-core/features/plugins/built-in/related-posts/types';
import { isSystemPluginActive } from '../utils/pluginRuntime';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

const RELATED_POSTS_FALLBACK_LIMIT = 24;
const RELATED_POST_COUNTS = [3, 4, 6, 8] as const;

const defaultRelatedPostsConfig: RelatedPostsConfig = {
  enabled: true,
  count: 6,
  orderBy: 'relevance',
  layout: 'grid',
  showExcerpt: true,
  showImage: true,
  showDate: true,
  titleText: 'Berita Berkaitan',
};

const getSafeRelatedCount = (count: unknown): RelatedPostsConfig['count'] => {
  const numericCount = Number(count);
  return (RELATED_POST_COUNTS as readonly number[]).includes(numericCount)
    ? (numericCount as RelatedPostsConfig['count'])
    : defaultRelatedPostsConfig.count;
};

const getRelatedCandidateLimit = (count: unknown): number => {
  const safeRelatedCount = getSafeRelatedCount(count);
  return Math.min(RELATED_POSTS_FALLBACK_LIMIT, Math.max(safeRelatedCount * 4, 12));
};

const normalizeRelatedPostCandidate = (post: any): Post => ({
  ...post,
  id: String(post.id || ''),
  title: post.title || '',
  excerpt: post.excerpt || '',
  content: post.content || '',
  image: post.image || post.image_url || '',
  imageSrcSet: post.imageSrcSet || post.image_srcset || '',
  status: post.status || 'published',
  category: post.category || 'Uncategorized',
  updatedAt: post.updatedAt || post.updated_at || '',
  updated_at: post.updated_at || post.updatedAt || '',
  createdAt: post.createdAt || post.created_at || '',
  created_at: post.created_at || post.createdAt || '',
  scheduledAt: post.scheduledAt || post.scheduled_at || '',
  scheduled_at: post.scheduled_at || post.scheduledAt || '',
  author: post.author || post.author_data?.username || '',
  author_data: post.author_data || { username: post.author || '', avatar: '' },
});

const fetchRelatedPostCandidates = async (
  currentPost: Post,
  config: RelatedPostsConfig,
  signal: AbortSignal
): Promise<Post[]> => {
  const limit = getRelatedCandidateLimit(config.count);

  const fetchBatch = async (category?: string): Promise<Post[]> => {
    const params = new URLSearchParams();
    params.set('public', '1');
    params.set('includeTotal', 'false');
    params.set('limit', String(limit));
    if (category) params.set('category', category);

    const response = await vonFetch(`${API.getPosts}?${params.toString()}`, { signal });
    if (!response.ok) throw new Error('Failed to fetch related post candidates');

    const data = await response.json();
    const rawPosts = Array.isArray(data) ? data : data.posts || [];
    return rawPosts.map(normalizeRelatedPostCandidate);
  };

  const batches = currentPost.category
    ? await Promise.all([fetchBatch(currentPost.category), fetchBatch()])
    : [await fetchBatch()];
  const merged = new Map<string, Post>();
  const currentPostId = String(currentPost.id || '');

  batches.flat().forEach((post) => {
    if (post.id && post.id !== currentPostId) {
      merged.set(post.id, post);
    }
  });

  return Array.from(merged.values());
};

/**
 * Hook to render AI Summary component if plugin is active
 */
export function useAISummary(
  settings: SiteSettings,
  postContent: string
): { component: React.ReactNode; position: 'top' | 'bottom' } | null {
  // Check if plugin is active
  if (!isSystemPluginActive(settings, 'vp_ai_summary')) return null;

  // Get config
  const config: AISummaryConfig = settings.pluginConfig?.['vp_ai_summary'] || {
    enabled: true,
    maxBullets: 5,
    extractMethod: 'hybrid',
    showLabel: true,
    labelText: 'AI Summary',
    position: 'top',
  };

  if (!config.enabled) return null;

  return {
    // Add key to force re-initialization when content changes (e.g. from empty to loaded)
    component: (
      <AISummaryComponent
        key={postContent?.substring(0, 64)}
        config={config}
        content={postContent}
      />
    ),
    position: config.position,
  };
}

/**
 * Hook to render Related Posts component if plugin is active
 */
export function useRelatedPosts(
  settings: SiteSettings,
  currentPost: Post | null,
  allPosts: Post[],
  onPostClick?: (post: Post) => void,
  themeColors?: any
): React.ReactNode | null {
  const isActive = isSystemPluginActive(settings, 'vp_related_posts');
  const savedConfig = settings.pluginConfig?.['vp_related_posts'] as
    Partial<RelatedPostsConfig> | undefined;
  const safeRelatedCount = getSafeRelatedCount(savedConfig?.count);
  const config: RelatedPostsConfig = {
    ...defaultRelatedPostsConfig,
    ...savedConfig,
    count: safeRelatedCount,
  };
  const candidateFetchLimit = getRelatedCandidateLimit(safeRelatedCount);
  const localPublishedCandidateCount =
    Array.isArray(allPosts) && currentPost
      ? allPosts.filter(
          (post) =>
            String(post.id || '') !== String(currentPost.id || '') && post.status === 'published'
        ).length
      : 0;
  const hasCompleteLocalCandidateSet = localPublishedCandidateCount >= candidateFetchLimit;
  const [fallbackCandidateState, setFallbackCandidateState] = useState<{
    postId: string;
    posts: Post[];
  }>({ postId: '', posts: [] });

  useEffect(() => {
    if (!isActive || !config.enabled || !currentPost || currentPost.status !== 'published') {
      setFallbackCandidateState((current) =>
        current.postId || current.posts.length ? { postId: '', posts: [] } : current
      );
      return;
    }

    if (hasCompleteLocalCandidateSet) return;

    const abortController = new AbortController();
    const fallbackPostId = String(currentPost.id || '');

    fetchRelatedPostCandidates(currentPost, config, abortController.signal)
      .then((posts) => {
        if (!abortController.signal.aborted) {
          setFallbackCandidateState({ postId: fallbackPostId, posts });
        }
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        console.warn('Related posts fallback fetch failed:', error);
        setFallbackCandidateState((current) =>
          current.postId === fallbackPostId ? { postId: '', posts: [] } : current
        );
      });

    return () => abortController.abort();
  }, [
    isActive,
    config.enabled,
    safeRelatedCount,
    currentPost?.id,
    currentPost?.category,
    currentPost?.status,
    hasCompleteLocalCandidateSet,
  ]);

  const currentPostId = String(currentPost?.id || '');
  const candidatePosts =
    fallbackCandidateState.postId === currentPostId
      ? fallbackCandidateState.posts
      : hasCompleteLocalCandidateSet
        ? allPosts
        : [];

  if (!isActive || !currentPost || !config.enabled || candidatePosts.length === 0) return null;

  return (
    <RelatedPostsComponent
      config={config}
      settings={settings}
      currentPost={currentPost}
      allPosts={candidatePosts}
      onPostClick={onPostClick}
      themeColors={themeColors}
    />
  );
}
