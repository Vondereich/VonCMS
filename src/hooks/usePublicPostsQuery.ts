/**
 * Server-backed public post discovery.
 *
 * Keeps homepage/search/category browsing off the capped public preload while
 * preserving a lightweight initial render from the already-loaded posts array.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Post } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface PublicPostsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  totalIsExact?: boolean;
}

interface UsePublicPostsQueryOptions {
  initialPosts: Post[];
  category?: string | null;
  search?: string;
  limit?: number;
  enabled?: boolean;
}

interface UsePublicPostsQueryResult {
  posts: Post[];
  meta: PublicPostsMeta | null;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
}

const publicPostCache = new Map<string, Post>();
export const PUBLIC_SEARCH_MAX_LENGTH = 120;

export const normalizePublicSearchInput = (value: string) =>
  value.slice(0, PUBLIC_SEARCH_MAX_LENGTH);

export const normalizePublicSearchQuery = (value: string) =>
  normalizePublicSearchInput(value).trim();

export const rememberPublicPosts = (posts: Post[]) => {
  posts.forEach((post) => {
    if (post.id) publicPostCache.set(String(post.id), post);
  });
};

export const getCachedPublicPost = (postId: string): Post | null => {
  return publicPostCache.get(String(postId)) || null;
};

const normalizePost = (p: any): Post => ({
  ...p,
  image: p.image || p.image_url || '',
  imageSrcSet: p.imageSrcSet || p.image_srcset || '',
  createdAt: p.created_at || p.createdAt || '',
  updatedAt: p.updated_at || p.updatedAt || p.created_at || '',
  scheduledAt: p.scheduled_at || p.scheduledAt || '',
  author_data: p.author_data || { username: p.author || '', avatar: '' },
  readTime: p.readTime || '',
});

const matchesSearch = (post: Post, search: string) => {
  if (!search) return true;
  const q = search.toLowerCase();
  const safeLower = (value: unknown) => String(value || '').toLowerCase();

  // Keep the local fallback aligned with the server contract in get_posts.php.
  return safeLower(post.title).includes(q) || safeLower(post.content).includes(q);
};

export function usePublicPostsQuery({
  initialPosts,
  category,
  search = '',
  limit = 12,
  enabled = true,
}: UsePublicPostsQueryOptions): UsePublicPostsQueryResult {
  const normalizedCategory = (category || '').trim();
  const rawSearch = normalizePublicSearchInput(search);
  const [debouncedSearch, setDebouncedSearch] = useState(rawSearch);
  const rawSearchQuery = normalizePublicSearchQuery(rawSearch);
  const normalizedSearch = normalizePublicSearchQuery(debouncedSearch);
  const hasShortSearch = rawSearchQuery.length > 0 && rawSearchQuery.length < 2;
  const isDebouncingSearch = rawSearchQuery.length >= 2 && rawSearch !== debouncedSearch;
  const effectiveFallbackSearch = rawSearchQuery;
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(rawSearch), 300);
    return () => window.clearTimeout(timeout);
  }, [rawSearch]);

  const fallbackPosts = useMemo(() => {
    return initialPosts
      .filter((post) => post.status === 'published')
      .filter((post) => !normalizedCategory || post.category === normalizedCategory)
      .filter((post) => matchesSearch(post, effectiveFallbackSearch))
      .slice(0, limit)
      .map(normalizePost);
  }, [initialPosts, limit, normalizedCategory, effectiveFallbackSearch]);

  useEffect(() => {
    rememberPublicPosts(fallbackPosts);
  }, [fallbackPosts]);

  const preserveVisiblePostsDuringFetch =
    !hasShortSearch &&
    fallbackPosts.length === 0 &&
    (normalizedCategory.length > 0 || normalizedSearch.length >= 2 || rawSearchQuery.length >= 2);

  const [posts, setPosts] = useState<Post[]>(fallbackPosts);
  const [meta, setMeta] = useState<PublicPostsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(preserveVisiblePostsDuringFetch);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!enabled || hasShortSearch) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        requestIdRef.current += 1;
        setPosts(fallbackPosts);
        setMeta(null);
        setHasMore(false);
        setIsLoading(false);
        setLoadingMore(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      append ? setLoadingMore(true) : setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('limit', String(limit));
        params.set('includeTotal', 'false');
        params.set('public', '1');
        if (category && category.trim()) params.set('category', category.trim());
        if (normalizedSearch.length >= 2) params.set('search', normalizedSearch);

        const res = await vonFetch(`${API.getPosts}?${params.toString()}`, {
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error('Failed to fetch public posts');

        const data = await res.json();
        if (requestId !== requestIdRef.current) return;

        const rawPosts: any[] = Array.isArray(data) ? data : data.posts || [];
        const fetchedPosts = rawPosts.map(normalizePost);
        rememberPublicPosts(fetchedPosts);
        const fetchedMeta: PublicPostsMeta | null = data.meta || null;

        setPosts((current) => {
          if (!append) return fetchedPosts;
          const existingIds = new Set(current.map((post) => post.id));
          return [...current, ...fetchedPosts.filter((post) => !existingIds.has(post.id))];
        });
        setMeta(fetchedMeta);
        setPage(pageNum);
        setHasMore(fetchedMeta ? fetchedMeta.hasMore : fetchedPosts.length >= limit);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        console.error('usePublicPostsQuery error:', err);
        setError('Failed to load posts. Please try again.');
        if (!append) {
          setPosts(fallbackPosts);
          setMeta(null);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          append ? setLoadingMore(false) : setIsLoading(false);
        }
      }
    },
    [category, enabled, fallbackPosts, hasShortSearch, limit, normalizedSearch]
  );

  useEffect(() => {
    if (!preserveVisiblePostsDuringFetch) {
      setPosts(fallbackPosts);
      setMeta(null);
      setPage(1);
      setHasMore(false);
    }
    void fetchPage(1, false);
  }, [fallbackPosts, fetchPage, preserveVisiblePostsDuringFetch]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || isLoading || !hasMore || hasShortSearch) return;
    await fetchPage(page + 1, true);
  }, [fetchPage, hasMore, hasShortSearch, isLoading, loadingMore, page]);

  return {
    posts,
    meta,
    total: meta?.total ?? posts.length,
    hasMore,
    isLoading: isLoading || isDebouncingSearch,
    loadingMore,
    error,
    loadMore,
  };
}

export default usePublicPostsQuery;
