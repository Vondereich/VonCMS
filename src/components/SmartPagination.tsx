import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

const SmartPagination: React.FC<SmartPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}) => {
  if (totalPages <= 1) return null;

  // Defensive: clamp page within valid range
  const safePage = (p: number) => onPageChange(Math.max(1, Math.min(totalPages, p)));

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show neighbors of current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if at start/end to keep count consistent
      let adjustedStart = start;
      let adjustedEnd = end;

      if (currentPage <= 3) adjustedEnd = 4;
      if (currentPage >= totalPages - 2) adjustedStart = totalPages - 3;

      for (let i = Math.max(2, adjustedStart); i <= Math.min(totalPages - 1, adjustedEnd); i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200 dark:border-admin-border">
      {itemsPerPage !== undefined && totalItems !== undefined && (
        <div className="text-sm text-slate-500 dark:text-gray-400 order-2 sm:order-1">
          Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
          <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </div>
      )}
      <div
        className={`flex items-center gap-1 order-1 sm:order-2 ${itemsPerPage === undefined ? 'w-full justify-center' : ''}`}
      >
        <button
          onClick={() => safePage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-slate-200 dark:border-admin-border bg-white dark:bg-admin-hover text-slate-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-admin-hover-strong transition-colors"
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-gray-400">
                  <MoreHorizontal size={14} />
                </span>
              ) : (
                <button
                  onClick={() => safePage(page as number)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-primary-600 text-white shadow-xs shadow-primary-500/30 dark:bg-gray-200 dark:text-gray-900 dark:shadow-none'
                      : 'bg-white dark:bg-admin-hover text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-admin-border hover:bg-slate-50 dark:hover:bg-admin-hover-strong'
                  }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => safePage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-slate-200 dark:border-admin-border bg-white dark:bg-admin-hover text-slate-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-admin-hover-strong transition-colors"
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default SmartPagination;
