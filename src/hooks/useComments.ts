/**
 * VonCMS Comments Hook
 * Handles comment CRUD operations
 */
import { useState, useCallback, useRef } from 'react';
import { Comment, User } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import toast from 'react-hot-toast';

const getCommentNumericId = (comment: Pick<Comment, 'id' | 'dbId'>): string =>
  String(comment.dbId || comment.id || '').replace(/[^0-9]/g, '');

const buildCommentTree = (flatComments: Comment[]): Comment[] => {
  const byNumericId = new Map<string, Comment>();
  const roots: Comment[] = [];

  flatComments.forEach((comment) => {
    const numericId = getCommentNumericId(comment);
    byNumericId.set(numericId, { ...comment, replies: [] });
  });

  byNumericId.forEach((comment) => {
    const parentKey = String(comment.parentId || '').replace(/[^0-9]/g, '');
    const parent = parentKey ? byNumericId.get(parentKey) : null;

    if (parent && String(parent.postId) === String(comment.postId)) {
      parent.replies = [...(parent.replies || []), comment];
    } else {
      roots.push(comment);
    }
  });

  return roots;
};

const flattenCommentTree = (comments: Comment[]): Comment[] => {
  const flattened: Comment[] = [];

  const visit = (comment: Comment) => {
    flattened.push({ ...comment, replies: [] });
    (comment.replies || []).forEach(visit);
  };

  comments.forEach(visit);
  return flattened;
};

const mergeCommentPages = (existing: Comment[], incoming: Comment[]): Comment[] => {
  const byNumericId = new Map<string, Comment>();

  existing.forEach((comment) => byNumericId.set(getCommentNumericId(comment), comment));
  incoming.forEach((comment) => byNumericId.set(getCommentNumericId(comment), comment));

  return Array.from(byNumericId.values());
};

interface PublicCommentPagination {
  postId: string;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY_PUBLIC_COMMENT_PAGINATION: PublicCommentPagination = {
  postId: '',
  page: 0,
  hasMore: false,
  loading: false,
  error: null,
};

const PUBLIC_COMMENT_PAGE_SIZE = 50;

export function useComments(initialComments: Comment[] = []) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [publicCommentPagination, setPublicCommentPagination] = useState<PublicCommentPagination>(
    EMPTY_PUBLIC_COMMENT_PAGINATION
  );
  const publicCommentPaginationRef = useRef<PublicCommentPagination>(
    EMPTY_PUBLIC_COMMENT_PAGINATION
  );
  const publicCommentRequestIdRef = useRef(0);

  const updatePublicCommentPagination = useCallback((next: PublicCommentPagination) => {
    publicCommentPaginationRef.current = next;
    setPublicCommentPagination(next);
  }, []);

  // Helper to save comment to database
  const saveCommentToDb = async (action: string, data: any) => {
    try {
      const res = await vonFetch(API.saveComments, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const result = await res.json();
      return result;
    } catch (e) {
      console.error('Comment API error:', e);
      return { success: false };
    }
  };

  // Add new comment
  const handleAddComment = useCallback(
    async (postId: string, content: string, user: User | null, onRequireAuth: () => void) => {
      if (!user) return onRequireAuth();

      // Generate proper avatar URL
      // If user has a custom avatar URL, use it.
      // Otherwise leave it empty/null so the frontend components can handle Gravatar rendering
      const avatarUrl = user.avatar || '';

      const tempId = `c-${Date.now()}`;
      const newComment: Comment = {
        id: tempId,
        postId,
        userId: user.id,
        username: user.username,
        userAvatar: avatarUrl,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        replies: [],
      };

      setComments((prev) => [...prev, newComment]);

      const result = await saveCommentToDb('add', {
        postId,
        userId: user.id,
        username: user.username,
        userAvatar: avatarUrl,
        content,
      });

      if (result.success && result.id) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: result.id } : c)));
      } else {
        // Rollback optimistic update
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        toast.error(result.error || result.message || 'Failed to post comment');
      }
    },
    []
  );

  // Reply to comment — uses functional state update to avoid stale closure
  const handleReplyComment = useCallback(
    async (commentId: string, content: string, user: User | null, onRequireAuth: () => void) => {
      if (!user) return onRequireAuth();

      const parentIdNum = commentId.replace(/[^0-9]/g, '');
      const tempId = `r-${Date.now()}`;

      // Avatar is derived from user, not from stale comments state
      const avatarUrl = user.avatar || '';

      // Find parent comment to get postId BEFORE the optimistic update —
      // ensures the API save path always has the correct postId even if
      // the functional updater runs before comments are fully loaded.
      const parentComment = comments.find((c) => c.id === commentId);
      if (!parentComment) return;

      // Optimistic update using fresh parent data
      setComments((prev) => {
        const prevParent = prev.find((c) => c.id === commentId);
        if (!prevParent) return prev;

        const newReply = {
          id: tempId,
          postId: prevParent.postId,
          userId: user.id,
          username: user.username,
          userAvatar: avatarUrl,
          content,
          createdAt: new Date().toISOString(),
          likes: 0,
        };

        return prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, replies: [...(c.replies || []), newReply] };
          }
          return c;
        });
      });

      const result = await saveCommentToDb('add', {
        postId: parentComment.postId,
        parentId: parentIdNum,
        userId: user.id,
        username: user.username,
        userAvatar: avatarUrl,
        content,
      });

      if (result.success && result.id) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId && c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) => (r.id === tempId ? { ...r, id: result.id } : r)),
              };
            }
            return c;
          })
        );
      } else {
        // Rollback reply
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId && c.replies) {
              return { ...c, replies: c.replies.filter((r) => r.id !== tempId) };
            }
            return c;
          })
        );
        toast.error(result.error || result.message || 'Failed to post reply');
      }
    },
    [comments]
  );

  // Like comment
  const handleLikeComment = useCallback(
    async (commentId: string) => {
      const originalComments = comments;
      let likedComments: Set<string>;
      try {
        const stored = localStorage.getItem('voncms_liked_comments');
        likedComments = stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        likedComments = new Set();
      }

      const wasJustLiked = likedComments.has(commentId);
      const delta = wasJustLiked ? -1 : 1;

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, likes: Math.max(0, c.likes + delta) };
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, likes: Math.max(0, r.likes + delta) } : r
              ),
            };
          }
          return c;
        })
      );

      const commentIdNum = commentId.replace(/[^0-9]/g, '');
      const result = await saveCommentToDb('like', { commentId: commentIdNum, delta });
      if (!result.success) {
        setComments(originalComments);
        toast.error(result.error || result.message || 'Failed to update like');
        return false;
      }

      return true;
    },
    [comments]
  );

  // Update comment status
  const handleUpdateCommentStatus = useCallback(
    async (commentId: string, status: 'approved' | 'pending' | 'spam') => {
      const updateRecursive = (items: Comment[]): Comment[] => {
        return items.map((c) => {
          if (c.id === commentId) {
            return { ...c, status };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updateRecursive(c.replies) };
          }
          return c;
        });
      };

      setComments((prev) => updateRecursive(prev));

      const commentIdNum = commentId.replace(/[^0-9]/g, '');
      const loadingToast = toast.loading('Updating status...');

      try {
        const result = await saveCommentToDb('updateStatus', { commentId: commentIdNum, status });
        if (result.success) {
          toast.success(`Comment marked as ${status}`, { id: loadingToast });
        } else {
          toast.error('Failed to update status on server', { id: loadingToast });
        }
      } catch (e) {
        toast.error('Server error occurred', { id: loadingToast });
      }
    },
    []
  );

  // Delete comment
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const deleteRecursive = (items: Comment[]): Comment[] => {
        return items
          .filter((c) => c.id !== commentId)
          .map((c) => {
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: deleteRecursive(c.replies) };
            }
            return c;
          });
      };

      const originalComments = [...comments];
      setComments((prev) => deleteRecursive(prev));

      const commentIdNum = commentId.replace(/[^0-9]/g, '');
      const loadingToast = toast.loading('Deleting comment...');

      try {
        const result = await saveCommentToDb('delete', { commentId: commentIdNum });
        if (result.success) {
          toast.success('Comment deleted successfully', { id: loadingToast });
        } else {
          setComments(originalComments);
          toast.error('Failed to delete on server', { id: loadingToast });
        }
      } catch (e) {
        setComments(originalComments);
        toast.error('Server error occurred', { id: loadingToast });
      }
    },
    [comments]
  );

  const loadPublicComments = useCallback(
    async (postId: string, append = false) => {
      const normalizedPostId = String(postId || '').trim();
      if (!/^\d+$/.test(normalizedPostId)) return;

      const current = publicCommentPaginationRef.current;
      if (
        (append && (current.loading || current.postId !== normalizedPostId || !current.hasMore)) ||
        (!append && current.loading && current.postId === normalizedPostId)
      ) {
        return;
      }

      const nextPage = append ? current.page + 1 : 1;
      const requestId = ++publicCommentRequestIdRef.current;
      updatePublicCommentPagination({
        postId: normalizedPostId,
        page: append ? current.page : 0,
        hasMore: append ? current.hasMore : false,
        loading: true,
        error: null,
      });

      if (!append) {
        setComments([]);
      }

      try {
        const params = new URLSearchParams({
          post_id: normalizedPostId,
          flat: 'true',
          limit: String(PUBLIC_COMMENT_PAGE_SIZE),
          page: String(nextPage),
        });
        const response = await vonFetch(`${API.getComments}?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || !data?.success || !Array.isArray(data.comments)) {
          throw new Error(data?.error || data?.message || 'Failed to load comments');
        }
        if (requestId !== publicCommentRequestIdRef.current) return;

        const incoming = data.comments as Comment[];
        setComments((previous) => {
          const existing = append ? flattenCommentTree(previous) : [];
          return buildCommentTree(mergeCommentPages(existing, incoming));
        });

        updatePublicCommentPagination({
          postId: normalizedPostId,
          page: Number(data.meta?.page) || nextPage,
          hasMore: Boolean(data.meta?.hasMore),
          loading: false,
          error: null,
        });
      } catch (error) {
        if (requestId !== publicCommentRequestIdRef.current) return;

        console.warn('Failed to load public comments:', error);
        updatePublicCommentPagination({
          postId: normalizedPostId,
          page: append ? current.page : 0,
          hasMore: append ? current.hasMore : true,
          loading: false,
          error: 'Failed to load comments. Please try again.',
        });
      }
    },
    [updatePublicCommentPagination]
  );

  const loadMorePublicComments = useCallback(async () => {
    const current = publicCommentPaginationRef.current;
    if (!current.postId || current.loading || !current.hasMore) return;

    await loadPublicComments(current.postId, true);
  }, [loadPublicComments]);

  return {
    comments,
    setComments,
    handleAddComment,
    handleReplyComment,
    handleLikeComment,
    handleUpdateCommentStatus,
    handleDeleteComment,
    loadPublicComments,
    loadMorePublicComments,
    publicCommentPagination,
  };
}
