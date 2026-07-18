import React, { useState, useEffect, useMemo } from 'react';
import Gravatar from 'react-gravatar';
import toast from 'react-hot-toast';
import { Comment, User, SiteSettings } from '../../../../../types';
import { MessageCircle, CornerDownRight, ThumbsUp, ChevronLeft, ChevronRight } from 'lucide-react';

// Utility to render User Avatar locally within component
const UserAvatar: React.FC<{
  url?: string;
  name: string;
  email?: string;
  md5?: string;
  size?: string;
  className?: string;
  onClick?: () => void;
}> = ({ url, name, email, md5, size = 'w-10 h-10', className = '', onClick }) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`${size} rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 flex-shrink-0 ${className} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {url && !imageFailed ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Gravatar
          email={email || name}
          md5={md5}
          size={100}
          className="w-full h-full object-cover"
          default="identicon"
        />
      )}
    </div>
  );
};

// Theme colors for custom theme overrides (e.g., Digest theme)
interface ThemeColors {
  surface?: string; // Card/box background
  surfaceAlt?: string; // Alternative surface (textarea, reply box)
  border?: string; // Border color
  text?: string; // Primary text
  textSecondary?: string; // Secondary text
  primary?: string; // New: Allow theme to override button colors
}

interface CommentsProps {
  comments: Comment[];
  user: User | null;
  onAddComment: (content: string) => void;
  onLikeComment: (commentId: string) => boolean | Promise<boolean>;
  onReplyComment: (commentId: string, content: string) => void;
  onLoadMoreComments?: () => Promise<void>;
  hasMoreComments?: boolean;
  commentsLoading?: boolean;
  commentsError?: string | null;
  onLogin: () => void;
  settings: SiteSettings;
  onViewProfile?: (username: string) => void;
  themeColors?: ThemeColors; // Optional theme color overrides
  id?: string; // Optional unique ID for CSS targeting
}

export const VpComments: React.FC<CommentsProps> = ({
  comments,
  user,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onLoadMoreComments,
  hasMoreComments = false,
  commentsLoading = false,
  commentsError = null,
  onLogin,
  settings,
  onViewProfile,
  themeColors,
  id,
}) => {
  const discussionEnabled = settings.discussionEnabled !== false;
  const [newComment, setNewComment] = useState('');
  const commentsPerPage = 3;
  const [currentPage, setCurrentPage] = useState(1);

  // States for interaction
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Track liked comments in localStorage
  const [likedComments, setLikedComments] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('voncms_liked_comments');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist liked comments to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('voncms_liked_comments', JSON.stringify(Array.from(likedComments)));
    } catch (e) {
      console.error('Failed to save liked comments', e);
    }
  }, [likedComments]);

  const totalPages = Math.max(1, Math.ceil(comments.length / commentsPerPage));
  const displayedComments = comments.slice(
    (currentPage - 1) * commentsPerPage,
    currentPage * commentsPerPage
  );
  const hasPagination = totalPages > 1;
  const visiblePages = useMemo<(number | 'ellipsis-start' | 'ellipsis-end')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1];
    if (currentPage > 3) pages.push('ellipsis-start');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let page = start; page <= end; page += 1) pages.push(page);

    if (currentPage < totalPages - 2) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage((prev) => (comments.length === 0 ? 1 : Math.min(prev, totalPages)));
  }, [comments.length, totalPages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      try {
        await onAddComment(newComment);
        setNewComment('');
      } catch (err) {
        console.error('Failed to add comment', err);
        toast.error('Failed to post comment');
      }
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    if (replyContent.trim()) {
      try {
        await onReplyComment(commentId, replyContent);
        setReplyingTo(null);
        setReplyContent('');
      } catch (err) {
        console.error('Failed to post reply', err);
        toast.error('Failed to post reply');
      }
    }
  };

  const handleLikeToggle = async (commentId: string) => {
    if (!user) {
      toast.error('Please login to like comments');
      return;
    }

    const isLiked = likedComments.has(commentId);
    const rollbackLikedState = () => {
      setLikedComments((prev) => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });
    };

    if (isLiked) {
      setLikedComments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    } else {
      setLikedComments((prev) => new Set(prev).add(commentId));
    }

    try {
      const likeSaved = await onLikeComment(commentId);
      if (likeSaved === false) {
        rollbackLikedState();
      }
    } catch {
      rollbackLikedState();
      toast.error('Failed to update like');
    }
  };

  if (!discussionEnabled) {
    return (
      <div
        id={id}
        className={`mt-20 p-10 lg:p-14 border text-center ${themeColors ? '' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50'}`}
        style={{
          borderRadius: settings.theme.borderRadius,
          ...(themeColors
            ? { backgroundColor: themeColors.surface, borderColor: themeColors.border }
            : {}),
        }}
      >
        <p className="text-slate-500 dark:text-slate-400 italic">
          Comments are disabled for this site.
        </p>
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`mt-20 p-10 lg:p-14 border ${themeColors ? '' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50'}`}
      style={{
        borderRadius: settings.theme.borderRadius,
        ...(themeColors
          ? { backgroundColor: themeColors.surface, borderColor: themeColors.border }
          : {}),
      }}
    >
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-10 flex items-center gap-3">
        <MessageCircle size={28} className="text-slate-300" />
        Discussion <span className="text-slate-400 font-normal text-lg">({comments.length})</span>
      </h3>

      {/* Comment Form */}
      <div className="mb-12">
        {user ? (
          <form onSubmit={handleSubmit} className="flex gap-6">
            <UserAvatar
              url={user.avatar}
              name={user.username}
              email={user.email}
              size="w-14 h-14"
              className="shadow-sm"
            />

            <div className="flex-grow">
              <textarea
                aria-label="( )"
                id="comment-content"
                name="comment"
                autoComplete="off"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write your thoughts..."
                className={`w-full p-6 border-none focus:ring-0 min-h-[140px] resize-none shadow-sm text-lg placeholder:font-light ${themeColors ? '' : 'bg-white dark:bg-slate-800 dark:text-white'}`}
                style={{
                  borderRadius: settings.theme.borderRadius,
                  ...(themeColors
                    ? { backgroundColor: themeColors.surfaceAlt, color: themeColors.text }
                    : {}),
                }}
                required
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-6 py-2.5 text-white font-bold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  style={{
                    backgroundColor: themeColors?.primary || settings.theme.primaryColor,
                    boxShadow: `0 4px 14px 0 ${themeColors?.primary || settings.theme.primaryColor}40`,
                  }}
                >
                  POST
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div
            className={`text-center py-12 rounded-2xl border border-dashed ${themeColors ? '' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
            style={
              themeColors
                ? { backgroundColor: themeColors.surfaceAlt, borderColor: themeColors.border }
                : {}
            }
          >
            <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium text-lg">
              Join the community to share your thoughts.
            </p>
            <button
              onClick={onLogin}
              className="px-8 py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 shadow-xl"
              style={{
                backgroundColor: themeColors?.primary || settings.theme.primaryColor,
                boxShadow: `0 10px 20px -5px ${themeColors?.primary || settings.theme.primaryColor}40`,
              }}
            >
              Log In to Discuss
            </button>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-10">
        {comments.length > 0 ? (
          <>
            {displayedComments.map((comment) => {
              const isLiked = likedComments.has(comment.id);

              return (
                <div
                  key={comment.id}
                  className="flex flex-col gap-8 pb-8 border-b last:border-0 last:pb-0 animate-fade-in"
                  style={{ borderColor: themeColors?.border }}
                >
                  <div className="flex gap-6">
                    <UserAvatar
                      url={comment.userAvatar}
                      name={comment.username}
                      md5={comment.emailHash}
                      size="w-12 h-12"
                      onClick={() => onViewProfile && onViewProfile(comment.username)}
                    />

                    <div className="flex-grow">
                      <div className="flex items-baseline gap-3 mb-2">
                        <span
                          className="font-bold text-slate-900 dark:text-white text-lg cursor-pointer hover:text-primary-600 transition-colors"
                          onClick={() => onViewProfile && onViewProfile(comment.username)}
                        >
                          {comment.username}
                        </span>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                          {comment.createdAt}
                        </span>
                      </div>
                      <div
                        className="text-slate-600 dark:text-slate-300 text-base leading-relaxed font-light"
                        style={{ color: themeColors?.text }}
                      >
                        {comment.content}
                      </div>
                      <div className="flex items-center gap-6 mt-4">
                        <button
                          onClick={() => {
                            if (!user) {
                              toast.error('Please login to reply');
                              return;
                            }
                            setReplyingTo(replyingTo === comment.id ? null : comment.id);
                          }}
                          className="text-xs text-slate-400 hover:text-primary-600 font-bold uppercase tracking-wide transition-colors flex items-center gap-1"
                        >
                          <CornerDownRight size={14} /> Reply
                        </button>
                        <button
                          onClick={() => handleLikeToggle(comment.id)}
                          className={`text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-1 ${
                            isLiked ? 'text-primary-600' : 'text-slate-400 hover:text-primary-600'
                          }`}
                        >
                          <ThumbsUp size={14} className={isLiked ? 'fill-current' : ''} />
                          {comment.likes > 0 ? `${comment.likes} Likes` : 'Like'}
                        </button>
                      </div>

                      {/* Reply Box */}
                      {replyingTo === comment.id && user && (
                        <div className="mt-4 flex gap-4 animate-fade-in">
                          <input
                            aria-label="Reply"
                            id={`reply-${comment.id}`}
                            name="reply"
                            autoComplete="off"
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            className={`flex-grow p-2 text-sm border rounded-lg focus:outline-none focus:border-primary-500 ${themeColors ? '' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-white'}`}
                            style={
                              themeColors
                                ? {
                                    backgroundColor: themeColors.surfaceAlt,
                                    borderColor: themeColors.border,
                                    color: themeColors.text,
                                  }
                                : {}
                            }
                          />
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            disabled={!replyContent.trim()}
                            className="px-4 py-2 text-white text-xs font-bold rounded-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            style={{
                              backgroundColor: themeColors?.primary || settings.theme.primaryColor,
                              boxShadow: `0 4px 14px 0 ${themeColors?.primary || settings.theme.primaryColor}40`,
                            }}
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Render Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-16 space-y-6">
                      {comment.replies.map((reply) => {
                        const isReplyLiked = likedComments.has(reply.id);

                        return (
                          <div
                            key={reply.id}
                            className={`flex gap-4 p-4 rounded-xl border-l-4 ${themeColors ? '' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700'}`}
                            style={
                              themeColors
                                ? {
                                    backgroundColor: themeColors.surfaceAlt,
                                    borderLeftColor: themeColors.border,
                                  }
                                : {}
                            }
                          >
                            <UserAvatar
                              url={reply.userAvatar}
                              name={reply.username}
                              md5={reply.emailHash}
                              size="w-8 h-8"
                              onClick={() => onViewProfile && onViewProfile(reply.username)}
                            />
                            <div className="flex-grow">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span
                                  className="font-bold text-slate-800 dark:text-white text-sm cursor-pointer hover:text-primary-600"
                                  onClick={() => onViewProfile && onViewProfile(reply.username)}
                                >
                                  {reply.username}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase">
                                  {reply.createdAt}
                                </span>
                              </div>
                              <p
                                className="text-sm text-slate-600 dark:text-slate-300 font-light"
                                style={{ color: themeColors?.text }}
                              >
                                {reply.content}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <button
                                  onClick={() => handleLikeToggle(reply.id)}
                                  className={`text-[10px] font-bold uppercase transition-colors flex items-center gap-1 ${
                                    isReplyLiked
                                      ? 'text-primary-600'
                                      : 'text-slate-400 hover:text-primary-600'
                                  }`}
                                >
                                  <ThumbsUp
                                    size={10}
                                    className={isReplyLiked ? 'fill-current' : ''}
                                  />
                                  {reply.likes > 0 ? `${reply.likes}` : 'Like'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {hasPagination && (
              <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  {visiblePages.map((page) =>
                    typeof page === 'number' ? (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[2.5rem] px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                          currentPage === page
                            ? 'text-white shadow-lg'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        style={
                          currentPage === page
                            ? {
                                backgroundColor:
                                  themeColors?.primary || settings.theme.primaryColor,
                              }
                            : undefined
                        }
                      >
                        {page}
                      </button>
                    ) : (
                      <span
                        key={page}
                        className="inline-flex min-w-[2.5rem] items-center justify-center px-1 text-slate-400"
                      >
                        ...
                      </span>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
                <p className="mt-4 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
            )}

            {(hasMoreComments || commentsError) && onLoadMoreComments && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => void onLoadMoreComments()}
                  disabled={commentsLoading}
                  className="inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: themeColors?.primary || settings.theme.primaryColor }}
                >
                  {commentsLoading ? 'Loading comments...' : 'Load More Comments'}
                </button>
                {commentsError && <p className="mt-2 text-xs text-red-500">{commentsError}</p>}
              </div>
            )}
          </>
        ) : commentsLoading ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Loading comments...
            </p>
          </div>
        ) : commentsError ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-red-500">{commentsError}</p>
            {onLoadMoreComments && (
              <button
                type="button"
                onClick={() => void onLoadMoreComments()}
                className="mt-4 inline-flex items-center rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity"
                style={{ backgroundColor: themeColors?.primary || settings.theme.primaryColor }}
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-10 opacity-50">
            <p className="text-slate-400 italic">Be the first to comment.</p>
          </div>
        )}
      </div>
    </div>
  );
};
