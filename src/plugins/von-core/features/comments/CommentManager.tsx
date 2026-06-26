/**
 * Legacy component kept for reference only.
 * Live admin moderation uses DiscussionManager.
 */
import React, { useState } from 'react';
import { Comment } from '../../../../types';
import { MessageSquare, Trash2, Check, Search, RefreshCw, CornerDownRight } from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';
import { flattenComments } from '../../../../utils/siteUtils';

interface CommentManagerProps {
  comments: Comment[];
  onDeleteComment: (commentId: string) => void;
  onApproveComment?: (commentId: string) => void;
}

const CommentManager: React.FC<CommentManagerProps> = ({
  comments,
  onDeleteComment,
  onApproveComment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Flatten comments with replies for easier display
  const flattenedComments = flattenComments(comments);

  // Filter by search
  const filteredComments = flattenedComments.filter(
    (c: Comment) =>
      c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredComments.length / itemsPerPage);
  const paginatedComments = filteredComments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDelete = (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      onDeleteComment(commentId);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Comment Management</h2>
          <p className="text-slate-500 text-sm">
            Manage and moderate user comments ({flattenedComments.length} total)
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#242633] dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          id="search-by-username-or-content"
          name="searchByUsernameOrContent"
          aria-label="Search by username or content..."
          type="text"
          placeholder="Search by username or content..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
        />
      </div>

      {/* Comments Table */}
      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-[#16161e]/50 text-xs uppercase text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Comment</th>
              <th className="px-6 py-4">Post</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {paginatedComments.length > 0 ? (
              paginatedComments.map((comment: any) => (
                <tr
                  key={comment.id}
                  className={`hover:bg-slate-50 dark:hover:bg-[#1a1b26]/50 ${comment.isReply ? 'bg-slate-50/50 dark:bg-[#16161e]/30' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {comment.isReply && <CornerDownRight size={14} className="text-slate-400" />}
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#242633] overflow-hidden flex-shrink-0">
                        {comment.userAvatar ? (
                          <img
                            src={comment.userAvatar}
                            alt={comment.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-sm">
                            {comment.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white text-sm">
                        {comment.username}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2 max-w-md">
                      {comment.content}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-[#242633] px-2 py-1 rounded">
                      {comment.postId || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500">{comment.createdAt || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {onApproveComment && (
                        <button
                          onClick={() => onApproveComment(comment.id)}
                          className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <MessageSquare className="mx-auto mb-3 text-slate-300" size={32} />
                  <p className="text-slate-400">No comments found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Smart Pagination Controls */}
      <SmartPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        totalItems={filteredComments.length}
      />
    </div>
  );
};

export default CommentManager;
