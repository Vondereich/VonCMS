/**
 * VonCMS - useSinglePost Hook
 * Fetches full post content for single post view (Slim Query optimization)
 */
import { useState, useEffect, useRef } from 'react';
import { Post } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';

interface UseSinglePostResult {
  fullPost: Post | null;
  isLoading: boolean;
}

export const useSinglePost = (
  postId: string | null,
  postSlug: string | null,
  enabled: boolean
): UseSinglePostResult => {
  // ── 1. Check PHP injection first (Hydration Bridge) ─────────────────────────
  const injected = window.__INITIAL_STATE__;
  const slugMatch = injected?.slug === postSlug || injected?.post?.slug === postSlug;
  const idMatch = injected?.post?.id && String(injected.post.id) === postId;
  const hasInjectedPost = injected?.status === 'loaded' && injected?.post && (slugMatch || idMatch);
  const requestedPostKey = enabled
    ? postId
      ? `id:${postId}`
      : postSlug
        ? `slug:${postSlug}`
        : ''
    : '';

  const buildPostFromInjected = (): Post | null => {
    if (!hasInjectedPost || !injected?.post) return null;
    const p = injected.post;
    return {
      id: String(p.id || ''),
      title: p.title || '',
      slug: p.slug || '',
      content: p.content || '',
      excerpt: p.excerpt || '',
      status: 'published' as const,
      category: p.category || 'Uncategorized',
      image: p.image_url || p.image || '',
      imageSrcSet: p.imageSrcSet || p.image_srcset || '',
      author: p.author || '',
      author_data: p.author_data || { username: p.author || '', avatar: '' },
      author_id: p.author_id ?? null,
      createdAt: p.created_at || '',
      updatedAt: p.updated_at || p.created_at || '',
      keywords: p.keywords || '',
      metaDescription: p.meta_description || '',
      readTime: p.readTime || '',
    };
  };

  const [fullPost, setFullPost] = useState<Post | null>(
    hasInjectedPost ? buildPostFromInjected() : null
  );

  // START true only if enabled AND we don't have injected data yet
  const [isLoading, setIsLoading] = useState(enabled && !hasInjectedPost);
  const [settledRequestKey, setSettledRequestKey] = useState(
    hasInjectedPost ? requestedPostKey : ''
  );
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullPostMatchesRequest = Boolean(
    fullPost && ((postId && fullPost.id === postId) || (postSlug && fullPost.slug === postSlug))
  );
  const hasSettledCurrentRequest = settledRequestKey === requestedPostKey;
  const isPendingCurrentRequest = Boolean(
    requestedPostKey && !hasInjectedPost && !fullPostMatchesRequest && !hasSettledCurrentRequest
  );

  useEffect(() => {
    if (!enabled || (!postId && !postSlug)) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setFullPost(null);
      setIsLoading(false);
      setSettledRequestKey('');
      return;
    }

    // If PHP already injected this data, skip the first fetch
    if (hasInjectedPost) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (!fullPost) {
        setFullPost(buildPostFromInjected());
      }
      setIsLoading(false);
      setSettledRequestKey(requestedPostKey);
      // Cleanup: Remove hydration data after consuming to prevent stale matches on SPA navigation
      delete window.__INITIAL_STATE__;
      return;
    }

    // Skip if already fetched
    if (fullPostMatchesRequest) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setSettledRequestKey(requestedPostKey);
      return;
    }

    const fetchFullPost = async () => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsLoading(true);
      try {
        const endpoint = postId ? `${API.getPost}?id=${postId}` : `${API.getPost}?slug=${postSlug}`;

        const res = await vonFetch(endpoint, { signal: abortController.signal });
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;

        if (data.success && data.post) {
          setFullPost({
            id: String(data.post.id),
            title: data.post.title,
            slug: data.post.slug || '',
            content: data.post.content || '',
            excerpt: data.post.excerpt || '',
            status: data.post.status || 'published',
            category: data.post.category || 'Uncategorized',
            image: data.post.image || data.post.image_url || '',
            imageSrcSet: data.post.imageSrcSet || data.post.image_srcset || '',
            author: data.post.author || '',
            author_data: data.post.author_data || { username: data.post.author || '', avatar: '' },
            author_id: data.post.author_id ?? null,
            createdAt: data.post.created_at,
            updatedAt: data.post.updated_at || data.post.created_at,
            scheduledAt: data.post.scheduled_at,
            keywords: data.post.keywords || '',
            metaDescription: data.post.meta_description || '',
            readTime: data.post.readTime || '',
          });
        } else {
          // Fix: Reset state if post not found (Gold Standard)
          setFullPost(null);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        console.error('Failed to fetch post content:', err);
        // Fix: Reset state on network/parse error (Gold Standard)
        setFullPost(null);
      } finally {
        if (requestId === requestIdRef.current) {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          setSettledRequestKey(requestedPostKey);
          setIsLoading(false);
        }
      }
    };

    fetchFullPost();

    return () => {
      if (abortControllerRef.current) {
        requestIdRef.current += 1;
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [postId, postSlug, enabled, requestedPostKey]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setFullPost(null);
      setSettledRequestKey('');
    }
  }, [enabled]);

  return { fullPost, isLoading: isLoading || isPendingCurrentRequest };
};

export default useSinglePost;
