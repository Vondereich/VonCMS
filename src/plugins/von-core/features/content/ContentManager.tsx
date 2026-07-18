import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Post, Page } from '../../../../types';
import { sanitizeHtml } from '../../../../utils/security';
import { vonFetch } from '../../../../utils/api';
import { API } from '../../../../config/site.config';
import { Plus, CheckSquare, Square, Trash2, Search } from 'lucide-react';
import SmartPagination from '../../../../components/SmartPagination';
import {
  PUBLIC_SEARCH_MAX_LENGTH,
  normalizePublicSearchInput,
} from '../../../../hooks/usePublicPostsQuery';

interface NavItem {
  id: string;
  label: string;
  url: string;
  type: string;
}
interface ContentManagerProps {
  type: 'post' | 'page';
  posts: Post[];
  pages?: Page[];
  navigation?: NavItem[];
  onEdit: (id: string | null, isPage?: boolean) => void;
  onDelete?: (id: string, isPage?: boolean, skipConfirm?: boolean) => void;
  onToggleNav?: (pageId: string) => void;
  refreshKey?: number; // External trigger to re-fetch current page (after delete/save)
}

interface FetchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const formatScheduledDateTime = (value?: string) => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCreatedDateTime = (value?: string) => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getAuthorName = (item: Post | Page) =>
  (item.author || item.author_data?.username || '').trim();

const ContentManager: React.FC<ContentManagerProps> = ({
  type,
  posts: _posts,
  pages: _pages = [],
  onEdit,
  onDelete,
  navigation = [],
  onToggleNav,
  refreshKey = 0,
}) => {
  const itemsPerPage = 20;

  // Own local state for displayed items — independent of useContent().posts/pages
  const [pageItems, setPageItems] = useState<(Post | Page)[]>([]);
  const [meta, setMeta] = useState<FetchMeta>({
    page: 1,
    limit: itemsPerPage,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);

  // Filter/search state — triggers server fetch
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selection state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const pageRequestId = useRef(0);

  // Fetch page data from server
  const fetchPage = useCallback(
    async (
      page: number,
      filters?: { search?: string; category?: string | null; status?: string | null }
    ) => {
      const requestId = ++pageRequestId.current;
      setLoading(true);
      const endpoint = type === 'post' ? API.getPosts : API.getPages;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(itemsPerPage),
      });
      const supportsSearch = type === 'post' || type === 'page';
      if (supportsSearch && filters?.search) params.set('search', filters.search);
      if (type === 'post' && filters?.category) params.set('category', filters.category);
      if (type === 'post' && filters?.status) params.set('status', filters.status);

      try {
        const res = await vonFetch(`${endpoint}?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (requestId !== pageRequestId.current) return;

          const items = type === 'post' ? data.posts || [] : data.pages || [];
          setPageItems(items);
          if (data.meta) {
            setMeta({
              page: data.meta.page,
              limit: data.meta.limit,
              total: data.meta.total,
              totalPages: data.meta.totalPages,
              hasMore: data.meta.hasMore,
            });
          }
        }
      } catch (e) {
        if (requestId === pageRequestId.current) {
          console.warn('Failed to fetch page:', e);
        }
      } finally {
        if (requestId === pageRequestId.current) {
          setLoading(false);
        }
      }
    },
    [type]
  );

  // Fetch on mount, when page changes, when filters change, or when refreshKey changes
  useEffect(() => {
    setCurrentPage(1);
    fetchPage(1, {
      search: searchQuery || undefined,
      category: selectedCategory,
      status: selectedStatus,
    });
  }, [type, searchQuery, selectedCategory, selectedStatus, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedStatus, searchQuery, type]);

  useEffect(() => {
    if (type === 'page') {
      setSelectedCategory(null);
      setSelectedStatus(null);
    }
  }, [type]);

  useEffect(
    () => () => {
      pageRequestId.current += 1;
    },
    []
  );

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= meta.totalPages) {
      setCurrentPage(page);
      fetchPage(page, {
        search: searchQuery || undefined,
        category: selectedCategory,
        status: selectedStatus,
      });
    }
  };

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedSearch = searchInput.trim();
    setSearchQuery(normalizedSearch.length >= 2 ? normalizedSearch : '');
  };

  // Clear search
  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // Toggle Selection Logic
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // Select All Logic
  const toggleSelectAll = () => {
    if (selectedItems.size === pageItems.length) {
      setSelectedItems(new Set());
    } else {
      const newSelected = new Set(pageItems.map((item) => item.id));
      setSelectedItems(newSelected);
    }
  };

  // Bulk Delete Logic
  const handleBulkDelete = async () => {
    if (!onDelete || isProcessing) return;

    if (confirm(`Are you sure you want to delete ${selectedItems.size} items?`)) {
      setIsProcessing(true);
      const itemsToDelete = Array.from(selectedItems);

      try {
        for (const id of itemsToDelete) {
          await onDelete(id, type === 'page', true);
          await new Promise((r) => setTimeout(r, 100));
        }
        setSelectedItems(new Set());
        // Re-fetch current page after bulk delete
        fetchPage(currentPage, {
          search: searchQuery || undefined,
          category: selectedCategory,
          status: selectedStatus,
        });
      } catch (e) {
        console.error('Bulk delete interrupted', e);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedStatus(null);
    clearSearch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
              {type === 'post' ? 'Article' : 'Page'} Manager
            </h2>
            {selectedItems.size > 0 && onDelete && (
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium animate-fade-in disabled:opacity-50 disabled:cursor-wait"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Trash2 size={16} />
                )}
                <span>{isProcessing ? 'Processing...' : `Delete (${selectedItems.size})`}</span>
              </button>
            )}
          </div>
          {/* Active Filters Display */}
          {(selectedCategory || selectedStatus || searchQuery) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Filters:</span>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Search size={12} />
                  <span>Search: "{searchQuery}"</span>
                  <span className="font-bold">×</span>
                </button>
              )}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <span>Cat: {selectedCategory}</span>
                  <span className="font-bold">×</span>
                </button>
              )}
              {selectedStatus && (
                <button
                  onClick={() => setSelectedStatus(null)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <span>Status: {selectedStatus}</span>
                  <span className="font-bold">×</span>
                </button>
              )}
              <button
                onClick={clearFilters}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline text-xs"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => onEdit(null, type === 'page')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Plus size={18} />
          <span>Add New</span>
        </button>
      </div>

      {(type === 'post' || type === 'page') && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="contentmanager-318"
              name="contentmanager318"
              aria-label={type === 'post' ? 'Search articles' : 'Search pages'}
              type="text"
              value={searchInput}
              maxLength={PUBLIC_SEARCH_MAX_LENGTH}
              onChange={(e) => setSearchInput(normalizePublicSearchInput(e.target.value))}
              placeholder={type === 'post' ? 'Search articles...' : 'Search pages...'}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#1a1b26] border border-slate-200 dark:border-[#2a2b36] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
            {searchInput.length >= PUBLIC_SEARCH_MAX_LENGTH && (
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Search is limited to {PUBLIC_SEARCH_MAX_LENGTH} characters.
              </p>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-slate-100 dark:bg-[#242633] text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </form>
      )}

      {loading && pageItems.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading...</span>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-x-auto">
            <table
              className={`w-full ${
                type === 'post' ? 'min-w-[1120px]' : 'min-w-[900px]'
              } table-fixed text-left border-collapse`}
            >
              <colgroup>
                <col className="w-12" />
                <col className={type === 'post' ? 'w-[34%]' : 'w-[34%]'} />
                {type === 'post' && <col className="w-[10%]" />}
                <col className={type === 'post' ? 'w-[10%]' : 'w-[12%]'} />
                <col className={type === 'post' ? 'w-[10%]' : 'w-[10%]'} />
                <col className={type === 'post' ? 'w-[12%]' : 'w-[12%]'} />
                {type === 'post' && <col className="w-[14%]" />}
                <col className={type === 'post' ? 'w-[10%]' : 'w-[28%]'} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 dark:bg-[#16161e]/50 border-b border-slate-200 dark:border-[#2a2b36] text-xs uppercase text-slate-500 font-medium">
                  <th className="px-4 py-4 w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {pageItems.length > 0 && selectedItems.size === pageItems.length ? (
                        <CheckSquare size={18} className="text-primary-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-4 pr-8">Title</th>
                  {type === 'post' && <th className="px-4 py-4">Category</th>}
                  <th className="px-4 py-4">Author</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Created</th>
                  {type === 'post' && <th className="px-4 py-4">Publish At</th>}
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={type === 'post' ? 8 : 6}
                      className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                    >
                      {searchQuery
                        ? `No results found for "${searchQuery}"`
                        : `No ${type === 'post' ? 'articles' : 'pages'} found.`}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 dark:hover:bg-[#242633]/50 transition-colors ${selectedItems.has(item.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {selectedItems.has(item.id) ? (
                            <CheckSquare size={18} className="text-primary-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 pr-8 min-w-0">
                        <p
                          className="font-semibold text-slate-900 dark:text-white truncate max-w-full leading-snug"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.title) }}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full mt-1">
                          {(() => {
                            const html = 'excerpt' in item ? item.excerpt || '' : '';
                            const doc = new DOMParser().parseFromString(html, 'text/html');
                            return doc.body.textContent || '';
                          })()}
                        </p>
                      </td>
                      {type === 'post' && (
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {'category' in item && item.category && (
                            <button
                              onClick={() => setSelectedCategory(item.category as string)}
                              className="max-w-full truncate hover:text-primary-500 hover:underline decoration-dashed underline-offset-4"
                              title="Filter by this category"
                            >
                              {item.category}
                            </button>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <span
                          className="block max-w-full truncate"
                          title={getAuthorName(item) || '-'}
                        >
                          {getAuthorName(item) || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {type === 'post' ? (
                          <button
                            onClick={() => setSelectedStatus(item.status)}
                            title="Filter by this status"
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-transform hover:scale-105 ${
                              item.status === 'published'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                          >
                            {item.status === 'published'
                              ? 'Published'
                              : item.status === 'scheduled'
                                ? 'Scheduled'
                                : 'Draft'}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'published'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                          >
                            {item.status === 'published'
                              ? 'Published'
                              : item.status === 'scheduled'
                                ? 'Scheduled'
                                : 'Draft'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatCreatedDateTime(item.createdAt || item.created_at)}
                      </td>
                      {type === 'post' && (
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.status === 'draft'
                            ? '-'
                            : formatScheduledDateTime(
                                (item as Post).scheduledAt ||
                                  (item as Post).scheduled_at ||
                                  item.createdAt ||
                                  item.created_at
                              )}
                        </td>
                      )}
                      <td className="px-4 py-4 text-right">
                        <div
                          className={`flex items-center justify-end ${
                            type === 'page' ? 'gap-2' : 'gap-3'
                          } whitespace-nowrap`}
                        >
                          <button
                            onClick={() => onEdit(item.id, type === 'page')}
                            className="text-primary-600 hover:text-primary-800 dark:hover:text-primary-400 font-medium text-sm"
                          >
                            Edit
                          </button>
                          {type === 'page' && onToggleNav && (
                            <button
                              onClick={() => onToggleNav(item.id)}
                              className="text-sm px-3 py-1 rounded-lg border border-slate-200 dark:border-[#2a2b36] hover:bg-slate-50 dark:hover:bg-[#242633]"
                            >
                              {navigation &&
                              navigation.find((n: NavItem) => n.url === `page:${item.id}`)
                                ? 'Remove from Nav'
                                : 'Add to Nav'}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => {
                                if (confirm('Delete this item?'))
                                  onDelete(item.id, type === 'page');
                              }}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <SmartPagination
              currentPage={currentPage}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              totalItems={meta.total}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ContentManager;
