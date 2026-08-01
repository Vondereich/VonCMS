import React from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { MediaItem } from '../../types';
import AdminModal from '../admin/AdminModal';

interface FeaturedMediaLibraryModalProps {
  isOpen: boolean;
  files: MediaItem[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  onSelect: (url?: string) => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

const FeaturedMediaLibraryModal: React.FC<FeaturedMediaLibraryModalProps> = ({
  isOpen,
  files,
  isLoading,
  page,
  totalPages,
  searchInput,
  onSearchInputChange,
  onSearch,
  onSelect,
  onPageChange,
  onClose,
}) => {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Select featured image"
      className="w-full max-w-5xl"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#16161e] sm:max-h-[90dvh]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2a2b36] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Select Featured Image
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pick an existing media item from the gallery.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
            aria-label="Close media gallery"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={onSearch}
          className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-[#2a2b36] sm:flex-row sm:px-5"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="featured-media-search"
              name="featuredMediaSearch"
              type="search"
              value={searchInput}
              maxLength={120}
              aria-label="Search featured images"
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="Search featured images..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-[#2a2b36] dark:bg-[#1a1b26] dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading media library...
            </div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              No media files found.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {files.map((file) => {
                const previewUrl = file.webpUrl || file.url;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelect(previewUrl)}
                    className="group overflow-hidden rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#1a1b26] text-left transition-all hover:border-blue-500 hover:shadow-lg"
                  >
                    <div className="aspect-4/3 overflow-hidden bg-slate-100 dark:bg-[#16161e]">
                      <img
                        src={previewUrl}
                        alt={file.altText || file.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {file.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{file.size}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="admin-safe-bottom flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-4 dark:border-[#2a2b36] sm:px-5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={isLoading || page <= 1}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-[#2a2b36] dark:text-slate-200 sm:gap-2"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={isLoading || page >= totalPages}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-[#2a2b36] dark:text-slate-200 sm:gap-2"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

export default FeaturedMediaLibraryModal;
