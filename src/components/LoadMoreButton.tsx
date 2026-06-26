/**
 * VonCMS - Load More Button Component
 * Reusable "Load More" button for pagination across themes
 */
import React from 'react';

interface LoadMoreButtonProps {
  loading: boolean;
  hasMore: boolean;
  error?: string | null;
  onLoadMore: () => void;
  label?: string;
  loadingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  loading,
  hasMore,
  error = null,
  onLoadMore,
  label = 'Load More',
  loadingLabel = 'Loading...',
  className = '',
  style,
}) => {
  if (!hasMore && !loading && !error) return null;

  return (
    <div className={`flex flex-col items-center py-8 ${className}`}>
      <button
        onClick={onLoadMore}
        disabled={loading}
        className={`
          px-8 py-3 rounded-lg font-semibold text-white
          transition-all duration-200 
          ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : error
                ? 'bg-red-600 hover:bg-red-700 hover:shadow-lg active:scale-95'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
          }
        `}
        style={style}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingLabel}
          </span>
        ) : error ? (
          'Try Again'
        ) : (
          label
        )}
      </button>
      {error && !loading && (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default LoadMoreButton;
