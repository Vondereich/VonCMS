/**
 * VonCMS - Load More Hook
 * Handles server-side pagination with "Load More" pattern
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Post } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface UseLoadMoreOptions {
  initialLimit?: number;
  category?: string;
  search?: string;
  authorId?: string;
}

interface UseLoadMoreReturn {
  posts: Post[];
  loading: boolean;
  initialLoading: boolean;
  hasMore: boolean;
  error: string | null;
  meta: PaginationMeta | null;
  loadMore: () => Promise<void>;
  reset: () => void;
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}

export function useLoadMore(options: UseLoadMoreOptions = {}): UseLoadMoreReturn {
  const { initialLimit = 20, category, search, authorId } = options;

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const loadingRef = useRef(false); // Ref mirror for race-condition guard

  // Build endpoint URL with params
  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: initialLimit.toString(),
      });
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      // Support author filtering (the option might be passed as 'author' or 'authorId')
      if (authorId) params.append('author', authorId);

      return `${API.getPosts}?${params.toString()}`;
    },
    [initialLimit, category, search, authorId]
  );

  // Fetch a specific page — used internally by loadMore() and the initial effect
  const fetchPage = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);
      try {
        const res = await vonFetch(buildUrl(pageNum));
        if (!res.ok) throw new Error('Failed to fetch posts');

        const data = await res.json();

        // Handle new envelope format { posts, meta }
        const rawPosts: any[] = Array.isArray(data) ? data : data.posts || [];
        const fetchedPosts: Post[] = rawPosts.map((p: any) => ({
          ...p,
          image: p.image || p.image_url || '',
          imageSrcSet: p.imageSrcSet || p.image_srcset || '',
          createdAt: p.created_at || p.createdAt || '',
          updatedAt: p.updated_at || p.updatedAt || p.created_at || '',
          author_data: p.author_data || { username: p.author || '', avatar: '' },
        }));
        const fetchedMeta: PaginationMeta | null = data.meta || null;

        if (append) {
          setPosts((prev) => [...prev, ...fetchedPosts]);
        } else {
          setPosts(fetchedPosts);
        }

        if (fetchedMeta) {
          setMeta(fetchedMeta);
          setHasMore(fetchedMeta.hasMore);
        } else {
          // Fallback for old response format (array)
          setHasMore(fetchedPosts.length >= initialLimit);
        }

        setPage(pageNum);
      } catch (err) {
        console.error('useLoadMore error:', err);
        setError(
          append
            ? 'Failed to load more items. Please try again.'
            : 'Failed to load items. Please try again.'
        );
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [buildUrl, loading, initialLimit]
  );

  // Initial load
  useEffect(() => {
    setInitialLoading(true);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, authorId]);

  // Load more function — uses ref guard to prevent double-click race condition
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    try {
      await fetchPage(page + 1, true);
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore, page, fetchPage]);

  // Reset function (for filter/search changes)
  const reset = useCallback(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setMeta(null);
    setInitialLoading(true);
    fetchPage(1, false);
  }, [fetchPage]);

  return {
    posts,
    loading,
    initialLoading,
    hasMore,
    error,
    meta,
    loadMore,
    reset,
    setPosts,
  };
}
