import { useCallback, useEffect, useRef, useState } from 'react';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { Comment, Post, User } from '../types';

interface ProfileActivityMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface ProfileActivityState<T> {
  items: T[];
  meta: ProfileActivityMeta;
  loading: boolean;
  error: string | null;
}

const emptyMeta = (limit: number): ProfileActivityMeta => ({
  page: 1,
  limit,
  total: 0,
  hasMore: false,
});

const normalizePost = (post: any): Post => ({
  ...post,
  image: post.image || post.image_url || '',
  imageSrcSet: post.imageSrcSet || post.image_srcset || '',
  createdAt: post.created_at || post.createdAt || '',
  updatedAt: post.updated_at || post.updatedAt || post.created_at || '',
  scheduledAt: post.scheduled_at || post.scheduledAt || '',
  author_data: post.author_data || { username: post.author || '', avatar: '' },
  readTime: post.readTime || '',
});

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export function useProfileActivity(targetUser: User, limit: number = 6) {
  const articleRequestIdRef = useRef(0);
  const commentRequestIdRef = useRef(0);

  const [articles, setArticles] = useState<ProfileActivityState<Post>>({
    items: [],
    meta: emptyMeta(limit),
    loading: true,
    error: null,
  });
  const [profileComments, setProfileComments] = useState<ProfileActivityState<Comment>>({
    items: [],
    meta: emptyMeta(limit),
    loading: true,
    error: null,
  });

  const fetchArticles = useCallback(
    async (page: number, append = false) => {
      const requestId = ++articleRequestIdRef.current;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        author: targetUser.username,
      });

      setArticles((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await vonFetch(`${API.getPosts}?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch profile articles');
        const data = await res.json();
        const nextItems = (data.posts || []).map(normalizePost);
        const meta = data.meta || emptyMeta(limit);

        if (requestId !== articleRequestIdRef.current) return;

        setArticles((prev) => ({
          items: uniqueById(append ? [...prev.items, ...nextItems] : nextItems),
          meta: {
            page: Number(meta.page || page),
            limit: Number(meta.limit || limit),
            total: Number(meta.total || 0),
            hasMore: Boolean(meta.hasMore),
          },
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (requestId !== articleRequestIdRef.current) return;
        console.error('useProfileActivity articles error:', error);
        setArticles((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load profile articles.',
        }));
      }
    },
    [limit, targetUser.username]
  );

  const fetchComments = useCallback(
    async (page: number, append = false) => {
      const requestId = ++commentRequestIdRef.current;
      const params = new URLSearchParams({
        flat: 'true',
        page: String(page),
        limit: String(limit),
        user: targetUser.username,
      });
      if (targetUser.id && /^\d+$/.test(String(targetUser.id))) {
        params.set('user_id', String(targetUser.id));
      }

      setProfileComments((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await vonFetch(`${API.getComments}?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch profile comments');
        const data = await res.json();
        const nextItems = data.comments || [];
        const meta = data.meta || emptyMeta(limit);

        if (requestId !== commentRequestIdRef.current) return;

        setProfileComments((prev) => ({
          items: uniqueById(append ? [...prev.items, ...nextItems] : nextItems),
          meta: {
            page: Number(meta.page || page),
            limit: Number(meta.limit || limit),
            total: Number(meta.total || 0),
            hasMore: Boolean(meta.hasMore),
          },
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (requestId !== commentRequestIdRef.current) return;
        console.error('useProfileActivity comments error:', error);
        setProfileComments((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load profile comments.',
        }));
      }
    },
    [limit, targetUser.id, targetUser.username]
  );

  useEffect(() => {
    setArticles({ items: [], meta: emptyMeta(limit), loading: true, error: null });
    setProfileComments({ items: [], meta: emptyMeta(limit), loading: true, error: null });
    void fetchArticles(1, false);
    void fetchComments(1, false);

    return () => {
      articleRequestIdRef.current += 1;
      commentRequestIdRef.current += 1;
    };
  }, [fetchArticles, fetchComments, limit, targetUser.id, targetUser.username]);

  const loadMoreArticles = useCallback(async () => {
    if (articles.loading || !articles.meta.hasMore) return;
    await fetchArticles(articles.meta.page + 1, true);
  }, [articles.loading, articles.meta.hasMore, articles.meta.page, fetchArticles]);

  const loadMoreComments = useCallback(async () => {
    if (profileComments.loading || !profileComments.meta.hasMore) return;
    await fetchComments(profileComments.meta.page + 1, true);
  }, [
    fetchComments,
    profileComments.loading,
    profileComments.meta.hasMore,
    profileComments.meta.page,
  ]);

  return {
    articlePosts: articles.items,
    articleTotal: articles.meta.total,
    articleHasMore: articles.meta.hasMore,
    articlesLoading: articles.loading,
    articlesError: articles.error,
    commentItems: profileComments.items,
    commentTotal: profileComments.meta.total,
    commentHasMore: profileComments.meta.hasMore,
    commentsLoading: profileComments.loading,
    commentsError: profileComments.error,
    loadMoreArticles,
    loadMoreComments,
  };
}
