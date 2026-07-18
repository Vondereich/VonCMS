import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import Gravatar from 'react-gravatar';
import { Comment, Post } from '../../../../types';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';

interface DiscussionManagerProps {
  comments: Comment[];
  posts: Post[];
  onUpdateCommentStatus: (commentId: string, status: 'approved' | 'pending' | 'spam') => void;
  onDeleteComment: (commentId: string) => void;
}

interface FetchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

type ModerationTab = 'pending' | 'spam' | 'approved';

interface DiscussionState {
  activeTab: ModerationTab;
  pageItems: Comment[];
  meta: FetchMeta;
  counts: Record<ModerationTab, number>;
  loading: boolean;
  currentPage: number;
  searchQuery: string;
  searchInput: string;
  isDeleting: string | null;
  deleteConfirmComment: Comment | null;
}

type DiscussionAction =
  | { type: 'setTab'; tab: ModerationTab }
  | { type: 'setCounts'; counts: Record<ModerationTab, number> }
  | { type: 'setLoading'; loading: boolean }
  | { type: 'setPage'; pageItems: Comment[]; meta: FetchMeta; currentPage: number }
  | { type: 'resetPage' }
  | { type: 'setSearchInput'; searchInput: string }
  | { type: 'setSearchQuery'; searchQuery: string }
  | { type: 'clearSearch' }
  | { type: 'setDeleting'; commentId: string | null }
  | { type: 'setDeleteConfirm'; comment: Comment | null };

const itemsPerPage = 20;

const emptyMeta: FetchMeta = {
  page: 1,
  limit: itemsPerPage,
  total: 0,
  totalPages: 1,
  hasMore: false,
};

const emptyCounts: Record<ModerationTab, number> = {
  pending: 0,
  approved: 0,
  spam: 0,
};

const initialState: DiscussionState = {
  activeTab: 'pending',
  pageItems: [],
  meta: emptyMeta,
  counts: emptyCounts,
  loading: true,
  currentPage: 1,
  searchQuery: '',
  searchInput: '',
  isDeleting: null,
  deleteConfirmComment: null,
};

const decodeHtml = (content: string) => {
  if (typeof document === 'undefined') {
    return content;
  }

  const doc = new DOMParser().parseFromString(`<textarea>${content}</textarea>`, 'text/html');
  return doc.querySelector('textarea')?.value ?? content;
};

const getCommentStatus = (comment: Comment): ModerationTab => {
  if (comment.status === 'pending' || comment.status === 'spam' || comment.status === 'approved') {
    return comment.status;
  }

  return 'approved';
};

const getStatusLabel = (status: ModerationTab) => {
  if (status === 'pending') return 'Pending';
  if (status === 'spam') return 'Spam';
  return 'Approved';
};

const getStatusBadgeClass = (status: ModerationTab) => {
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }

  if (status === 'spam') {
    return 'bg-slate-200 text-slate-700 dark:bg-[#242633] dark:text-slate-200';
  }

  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
};

const getActiveTabLabel = (activeTab: ModerationTab) =>
  activeTab === 'pending'
    ? 'Pending Approval'
    : activeTab === 'approved'
      ? 'Approved'
      : 'Spam / Banned';

const discussionReducer = (state: DiscussionState, action: DiscussionAction): DiscussionState => {
  switch (action.type) {
    case 'setTab':
      return { ...state, activeTab: action.tab };
    case 'setCounts':
      return { ...state, counts: action.counts };
    case 'setLoading':
      return { ...state, loading: action.loading };
    case 'setPage':
      return {
        ...state,
        pageItems: action.pageItems,
        meta: action.meta,
        currentPage: action.currentPage,
      };
    case 'resetPage':
      return { ...state, pageItems: [], meta: emptyMeta, currentPage: 1 };
    case 'setSearchInput':
      return { ...state, searchInput: action.searchInput };
    case 'setSearchQuery':
      return state.searchQuery === action.searchQuery
        ? state
        : { ...state, searchQuery: action.searchQuery };
    case 'clearSearch':
      return { ...state, searchInput: '', searchQuery: '' };
    case 'setDeleting':
      return { ...state, isDeleting: action.commentId };
    case 'setDeleteConfirm':
      return { ...state, deleteConfirmComment: action.comment };
    default:
      return state;
  }
};

interface HeaderProps {
  searchQuery: string;
  totalComments: number;
  onClearSearch: () => void;
}

const DiscussionHeader: React.FC<HeaderProps> = ({ searchQuery, totalComments, onClearSearch }) => (
  <div className="flex items-center justify-between">
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Discussion Moderation</h2>
        <p className="text-sm text-slate-500">
          Manage user comments and discussions ({totalComments} total).
        </p>
      </div>
      {searchQuery && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Filters:</span>
          <button
            onClick={onClearSearch}
            className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
          >
            <Search size={12} />
            <span>Search: "{searchQuery}"</span>
            <span className="font-bold">x</span>
          </button>
        </div>
      )}
    </div>
  </div>
);

interface SearchBarProps {
  searchInput: string;
  searchQuery: string;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;
}

const DiscussionSearchBar: React.FC<SearchBarProps> = ({
  searchInput,
  searchQuery,
  onSearchInputChange,
  onClearSearch,
}) => (
  <div className="flex gap-2">
    <div className="relative max-w-md flex-1">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        id="discussionmanager-293"
        name="discussionmanager293"
        aria-label="Search comments"
        type="text"
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        placeholder="Search comments across all statuses..."
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-[#2a2b36] dark:bg-[#1a1b26] dark:text-white"
      />
    </div>
    {(searchInput || searchQuery) && (
      <button
        type="button"
        onClick={onClearSearch}
        className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        Clear
      </button>
    )}
  </div>
);

interface TabsProps {
  activeTab: ModerationTab;
  counts: Record<ModerationTab, number>;
  isSearchMode: boolean;
  onTabChange: (tab: ModerationTab) => void;
}

const DiscussionTabs: React.FC<TabsProps> = ({ activeTab, counts, isSearchMode, onTabChange }) => {
  const tabs: Array<{ id: ModerationTab; label: string; countClass: string }> = [
    {
      id: 'pending',
      label: 'Pending Approval',
      countClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
    },
    {
      id: 'approved',
      label: 'Approved',
      countClass: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    },
    {
      id: 'spam',
      label: 'Spam / Banned',
      countClass: 'bg-slate-100 text-slate-500 dark:bg-[#242633]',
    },
  ];

  return (
    <div className="flex border-b border-slate-200 dark:border-[#2a2b36]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (!isSearchMode) onTabChange(tab.id);
          }}
          disabled={isSearchMode}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-colors ${isSearchMode ? 'cursor-default border-transparent text-slate-500' : activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {tab.label}
          {!isSearchMode && counts[tab.id] > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tab.countClass}`}>
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

interface CommentRowProps {
  comment: Comment;
  isDeleting: string | null;
  getPostTitle: (postId: string) => string;
  onStatusChange: (commentId: string, status: ModerationTab) => void;
  onDeleteClick: (comment: Comment) => void;
}

const CommentRow: React.FC<CommentRowProps> = ({
  comment,
  isDeleting,
  getPostTitle,
  onStatusChange,
  onDeleteClick,
}) => {
  const commentStatus = getCommentStatus(comment);

  return (
    <div className="flex gap-4 p-6">
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-[#242633]">
          {comment.userAvatar ? (
            <img
              src={comment.userAvatar}
              alt={comment.username}
              className="h-full w-full object-cover"
            />
          ) : (
            <Gravatar
              email={comment.username}
              md5={comment.emailHash}
              size={80}
              default="identicon"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>
      <div className="flex-grow">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">{comment.username}</span>
            <span className="text-xs text-slate-500">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(commentStatus)}`}
            >
              {getStatusLabel(commentStatus)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {commentStatus === 'pending' && (
              <>
                <button
                  onClick={() => onStatusChange(comment.id, 'approved')}
                  className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50"
                  title="Approve"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => onStatusChange(comment.id, 'spam')}
                  className="rounded-lg p-2 text-orange-500 transition-colors hover:bg-orange-50"
                  title="Mark as Spam"
                >
                  <AlertTriangle size={18} />
                </button>
              </>
            )}
            {commentStatus === 'approved' && (
              <button
                onClick={() => onStatusChange(comment.id, 'spam')}
                className="rounded-lg p-2 text-orange-500 transition-colors hover:bg-orange-50"
                title="Mark as Spam"
              >
                <AlertTriangle size={18} />
              </button>
            )}
            {commentStatus === 'spam' && (
              <button
                onClick={() => onStatusChange(comment.id, 'approved')}
                className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50"
                title="Approve"
              >
                <Check size={18} />
              </button>
            )}
            <button
              onClick={() => onDeleteClick(comment)}
              disabled={isDeleting === comment.id}
              className={`rounded-lg p-2 transition-colors ${isDeleting === comment.id ? 'cursor-wait opacity-50' : 'text-red-500 hover:bg-red-50'}`}
              title="Delete"
            >
              {isDeleting === comment.id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300">{decodeHtml(comment.content)}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <span>From:</span>
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {getPostTitle(comment.postId)}
          </span>
          <ExternalLink size={12} className="opacity-50" />
        </div>
      </div>
    </div>
  );
};

interface CommentsPanelProps {
  loading: boolean;
  pageItems: Comment[];
  currentPage: number;
  meta: FetchMeta;
  isDeleting: string | null;
  searchQuery: string;
  activeTabLabel: string;
  getPostTitle: (postId: string) => string;
  onPageChange: (page: number) => void;
  onStatusChange: (commentId: string, status: ModerationTab) => void;
  onDeleteClick: (comment: Comment) => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  loading,
  pageItems,
  currentPage,
  meta,
  isDeleting,
  searchQuery,
  activeTabLabel,
  getPostTitle,
  onPageChange,
  onStatusChange,
  onDeleteClick,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-12 shadow-sm dark:border-[#2a2b36] dark:bg-[#1a1b26]">
        <Loader2 size={20} className="animate-spin text-primary-600" />
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
      {pageItems.length > 0 ? (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pageItems.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                isDeleting={isDeleting}
                getPostTitle={getPostTitle}
                onStatusChange={onStatusChange}
                onDeleteClick={onDeleteClick}
              />
            ))}
          </div>

          <div className="px-6 pb-6">
            <SmartPagination
              currentPage={currentPage}
              totalPages={meta.totalPages}
              onPageChange={onPageChange}
              itemsPerPage={itemsPerPage}
              totalItems={meta.total}
            />
          </div>
        </>
      ) : (
        <div className="p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-[#242633]">
            <MessageSquare size={32} className="text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
            No comments found
          </h3>
          <p className="text-slate-500">
            {searchQuery
              ? 'No comments matched this search across Pending, Approved, or Spam.'
              : `There are no comments in ${activeTabLabel}.`}
          </p>
        </div>
      )}
    </div>
  );
};

interface DeleteModalProps {
  comment: Comment;
  getPostTitle: (postId: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteCommentModal: React.FC<DeleteModalProps> = ({
  comment,
  getPostTitle,
  onCancel,
  onConfirm,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101018]/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#16161e]">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-300">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Delete this comment?
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This will permanently remove the comment from{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {comment.username}
            </span>{' '}
            on <span className="font-medium">{getPostTitle(comment.postId)}</span>.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-[#1a1b26] dark:text-slate-300">
        {decodeHtml(comment.content)}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Delete Comment
        </button>
      </div>
    </div>
  </div>
);

const DiscussionManager: React.FC<DiscussionManagerProps> = ({
  comments: _comments,
  posts,
  onUpdateCommentStatus,
  onDeleteComment,
}) => {
  const [state, dispatch] = useReducer(discussionReducer, initialState);
  const commentsRequestId = useRef(0);
  const {
    activeTab,
    pageItems,
    meta,
    counts,
    loading,
    currentPage,
    searchQuery,
    searchInput,
    isDeleting,
    deleteConfirmComment,
  } = state;
  const isSearchMode = searchQuery !== '';

  const fetchCounts = useCallback(async (search?: string) => {
    try {
      const tabs: ModerationTab[] = ['pending', 'approved', 'spam'];
      const entries = await Promise.all(
        tabs.map(async (status) => {
          const params = new URLSearchParams({
            flat: 'true',
            page: '1',
            limit: '1',
          });
          params.set('status', status);
          if (search) params.set('search', search);

          const res = await vonFetch(`${API.getComments}?${params.toString()}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch ${status} count`);
          }

          const data = await res.json();
          return [status, Number(data?.meta?.total || 0)] as const;
        })
      );

      dispatch({
        type: 'setCounts',
        counts: entries.reduce(
          (acc, [status, total]) => {
            acc[status] = total;
            return acc;
          },
          { ...emptyCounts }
        ),
      });
    } catch (error) {
      console.warn('Failed to fetch comment counts:', error);
    }
  }, []);

  const fetchCommentsPage = useCallback(
    async (page: number, filters?: { search?: string }) => {
      const requestId = ++commentsRequestId.current;
      dispatch({ type: 'setLoading', loading: true });

      const params = new URLSearchParams({
        flat: 'true',
        page: String(page),
        limit: String(itemsPerPage),
      });
      if (!filters?.search) params.set('status', activeTab);
      if (filters?.search) params.set('search', filters.search);

      try {
        const res = await vonFetch(`${API.getComments}?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch comments');
        }

        const data = await res.json();
        if (requestId !== commentsRequestId.current) return;

        const resolvedPage = Number(data?.meta?.page || page);
        dispatch({
          type: 'setPage',
          pageItems: Array.isArray(data?.comments) ? data.comments : [],
          meta: {
            page: resolvedPage,
            limit: Number(data?.meta?.limit || itemsPerPage),
            total: Number(data?.meta?.total || 0),
            totalPages: Math.max(1, Number(data?.meta?.totalPages || 1)),
            hasMore: Boolean(data?.meta?.hasMore),
          },
          currentPage: resolvedPage,
        });
      } catch (error) {
        if (requestId === commentsRequestId.current) {
          console.warn('Failed to fetch comments page:', error);
          dispatch({ type: 'resetPage' });
        }
      } finally {
        if (requestId === commentsRequestId.current) {
          dispatch({ type: 'setLoading', loading: false });
        }
      }
    },
    [activeTab]
  );

  const refreshComments = useCallback(async () => {
    await Promise.all([
      fetchCounts(searchQuery || undefined),
      fetchCommentsPage(currentPage, { search: searchQuery || undefined }),
    ]);
  }, [currentPage, fetchCommentsPage, fetchCounts, searchQuery]);

  useEffect(() => {
    const trimmedQuery = searchInput.trim();
    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'setSearchQuery', searchQuery: trimmedQuery });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    void fetchCounts(searchQuery || undefined);
  }, [fetchCounts, searchQuery]);

  useEffect(() => {
    void fetchCommentsPage(1, { search: searchQuery || undefined });
  }, [activeTab, fetchCommentsPage, searchQuery]);

  useEffect(
    () => () => {
      commentsRequestId.current += 1;
    },
    []
  );

  const clearSearch = () => {
    dispatch({ type: 'clearSearch' });
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > meta.totalPages) {
      return;
    }

    void fetchCommentsPage(page, { search: searchQuery || undefined });
  };

  const handleDelete = async (commentId: string) => {
    dispatch({ type: 'setDeleting', commentId });
    try {
      await Promise.resolve(onDeleteComment(commentId));
      await refreshComments();
    } finally {
      dispatch({ type: 'setDeleting', commentId: null });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmComment) {
      return;
    }

    const commentId = deleteConfirmComment.id;
    dispatch({ type: 'setDeleteConfirm', comment: null });
    await handleDelete(commentId);
  };

  const handleStatusChange = async (commentId: string, status: ModerationTab) => {
    await Promise.resolve(onUpdateCommentStatus(commentId, status));
    await refreshComments();
  };

  const getPostTitle = (postId: string): string => {
    const post = posts.find((p) => p.id === postId || p.id === `post-${postId}`);
    return post?.title || `Post #${postId}`;
  };

  const totalComments = counts.pending + counts.approved + counts.spam;
  const activeTabLabel = getActiveTabLabel(activeTab);

  return (
    <div className="space-y-6">
      <DiscussionHeader
        searchQuery={searchQuery}
        totalComments={totalComments}
        onClearSearch={clearSearch}
      />

      <DiscussionSearchBar
        searchInput={searchInput}
        searchQuery={searchQuery}
        onSearchInputChange={(value) => dispatch({ type: 'setSearchInput', searchInput: value })}
        onClearSearch={clearSearch}
      />

      {isSearchMode && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-[#2a2b36] dark:bg-[#1a1b26]/60 dark:text-slate-300">
          Searching all statuses for{' '}
          <span className="font-semibold text-slate-900 dark:text-white">"{searchQuery}"</span>
          <span className="ml-2 text-slate-500 dark:text-slate-400">
            {meta.total} {meta.total === 1 ? 'match' : 'matches'}
          </span>
        </div>
      )}

      <DiscussionTabs
        activeTab={activeTab}
        counts={counts}
        isSearchMode={isSearchMode}
        onTabChange={(tab) => dispatch({ type: 'setTab', tab })}
      />

      {isSearchMode && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Search mode shows one combined result list. Clear the search to jump back into a single
          moderation queue.
        </p>
      )}

      <CommentsPanel
        loading={loading}
        pageItems={pageItems}
        currentPage={currentPage}
        meta={meta}
        isDeleting={isDeleting}
        searchQuery={searchQuery}
        activeTabLabel={activeTabLabel}
        getPostTitle={getPostTitle}
        onPageChange={handlePageChange}
        onStatusChange={(commentId, status) => void handleStatusChange(commentId, status)}
        onDeleteClick={(comment) => dispatch({ type: 'setDeleteConfirm', comment })}
      />

      {deleteConfirmComment && (
        <DeleteCommentModal
          comment={deleteConfirmComment}
          getPostTitle={getPostTitle}
          onCancel={() => dispatch({ type: 'setDeleteConfirm', comment: null })}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
};

export default DiscussionManager;
