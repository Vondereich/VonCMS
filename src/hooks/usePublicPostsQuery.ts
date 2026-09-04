/**
 * Server-backed public post discovery.
 *
 * Keeps homepage/search/category browsing off the capped public preload while
 * preserving a lightweight initial render from the already-loaded posts array.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Post } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { normalizeSiteUrl } from '../utils/siteUtils';

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
  nextPageHref: string;
}

const publicPostCache = new Map<string, Post>();
export const PUBLIC_SEARCH_MAX_LENGTH = 120;
export const PUBLIC_LISTING_MAX_PAGE = 100000;

export const normalizePublicSearchInput = (value: string) =>
  value.slice(0, PUBLIC_SEARCH_MAX_LENGTH);

export const normalizePublicSearchQuery = (value: string) =>
  normalizePublicSearchInput(value).trim();

export const normalizePublicListingPage = (value: string | null): number => {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) return 1;
  return Math.max(1, Math.min(PUBLIC_LISTING_MAX_PAGE, Number(normalized)));
};

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
  publishedAt: p.published_at || p.publishedAt || '',
  published_at: p.published_at || p.publishedAt || '',
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

const selectFallbackPosts = (
  posts: Post[],
  category: string,
  search: string,
  limit: number
): Post[] =>
  posts
    .filter((post) => post.status === 'published')
    .filter((post) => !category || post.category === category)
    .filter((post) => matchesSearch(post, search))
    .slice(0, limit)
    .map(normalizePost);

export function usePublicPostsQuery({
  initialPosts,
  category,
  search = '',
  limit = 12,
  enabled = true,
}: UsePublicPostsQueryOptions): UsePublicPostsQueryResult {
  const [urlSearchParams] = useSearchParams();
  const requestedPage = useMemo(
    () => normalizePublicListingPage(urlSearchParams.get('page')),
    [urlSearchParams]
  );
  const normalizedCategory = (category || '').trim();
  const rawSearch = normalizePublicSearchInput(search);
  const [debouncedSearch, setDebouncedSearch] = useState(rawSearch);
  const rawSearchQuery = normalizePublicSearchQuery(rawSearch);
  const normalizedSearch = normalizePublicSearchQuery(debouncedSearch);
  const hasShortSearch = rawSearchQuery.length > 0 && rawSearchQuery.length < 2;
  const hasPendingSearchDebounce = rawSearchQuery !== normalizedSearch;
  const isDebouncingSearch = rawSearchQuery.length >= 2 && hasPendingSearchDebounce;
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (rawSearch === '') {
      setDebouncedSearch('');
      return;
    }
    const timeout = window.setTimeout(() => setDebouncedSearch(rawSearch), 300);
    return () => window.clearTimeout(timeout);
  }, [rawSearch]);

  const fallbackPosts = useMemo(
    () => selectFallbackPosts(initialPosts, normalizedCategory, rawSearchQuery, limit),
    [initialPosts, limit, normalizedCategory, rawSearchQuery]
  );
  const settledFallbackPosts = useMemo(
    () => selectFallbackPosts(initialPosts, normalizedCategory, normalizedSearch, limit),
    [initialPosts, limit, normalizedCategory, normalizedSearch]
  );
  const fallbackPostsRef = useRef(fallbackPosts);
  fallbackPostsRef.current = fallbackPosts;

  useEffect(() => {
    rememberPublicPosts(fallbackPosts);
  }, [fallbackPosts]);

  const preserveVisiblePostsDuringFetch =
    !hasShortSearch &&
    settledFallbackPosts.length === 0 &&
    (normalizedCategory.length > 0 || normalizedSearch.length >= 2);
  const startsWithPublicFetch = enabled && !hasShortSearch && settledFallbackPosts.length === 0;

  const [posts, setPosts] = useState<Post[]>(fallbackPosts);
  const [meta, setMeta] = useState<PublicPostsMeta | null>(null);
  const [page, setPage] = useState(requestedPage);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(startsWithPublicFetch);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!enabled || hasShortSearch) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        requestIdRef.current += 1;
        setPosts(fallbackPostsRef.current);
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
        params.set('includeTotal', !append && pageNum > 1 ? 'true' : 'false');
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
          setPosts(settledFallbackPosts);
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
    [category, enabled, hasShortSearch, limit, normalizedSearch, settledFallbackPosts]
  );

  useEffect(() => {
    if (!hasShortSearch && !hasPendingSearchDebounce) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
    setPosts(fallbackPosts);
    setMeta(null);
    setPage(requestedPage);
    setHasMore(false);
    setIsLoading(false);
    setLoadingMore(false);
    setError(null);
  }, [fallbackPosts, hasPendingSearchDebounce, hasShortSearch, requestedPage]);

  useEffect(() => {
    if (hasShortSearch || hasPendingSearchDebounce) return;
    if (!preserveVisiblePostsDuringFetch) {
      setPosts(settledFallbackPosts);
      setMeta(null);
      setPage(requestedPage);
      setHasMore(false);
    }
    void fetchPage(requestedPage, false);
  }, [
    fetchPage,
    hasPendingSearchDebounce,
    hasShortSearch,
    preserveVisiblePostsDuringFetch,
    requestedPage,
    settledFallbackPosts,
  ]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || isLoading || !hasMore || hasShortSearch || hasPendingSearchDebounce) return;
    await fetchPage(page + 1, true);
  }, [fetchPage, hasMore, hasPendingSearchDebounce, hasShortSearch, isLoading, loadingMore, page]);

  const nextPageHref = useMemo(() => {
    const nextSearchParams = new URLSearchParams(urlSearchParams);
    Array.from(nextSearchParams.keys()).forEach((key) => {
      if (key === 'page' || key.startsWith('page[')) nextSearchParams.delete(key);
    });
    nextSearchParams.set('page', String(page + 1));
    return normalizeSiteUrl(`/?${nextSearchParams.toString()}`);
  }, [page, urlSearchParams]);

  return {
    posts,
    meta,
    total: meta?.total ?? posts.length,
    hasMore,
    isLoading: isLoading || isDebouncingSearch,
    loadingMore,
    error,
    loadMore,
    nextPageHref,
  };
}

export default usePublicPostsQuery;
