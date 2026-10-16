import type { FormEvent } from 'react';
import { Images, Search, X } from 'lucide-react';
import type { MediaItem } from '../../types';
import AdminModal from '../admin/AdminModal';
import SmartPagination from '../SmartPagination';

interface EditorMediaLibraryModalProps {
  isOpen: boolean;
  mediaFiles: readonly MediaItem[];
  loadingMedia: boolean;
  mediaPagination: { currentPage: number; totalPages: number; totalItems: number; limit: number };
  mediaSearchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (file: MediaItem) => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

export const EditorMediaLibraryModal = ({
  isOpen,
  mediaFiles,
  loadingMedia,
  mediaPagination,
  mediaSearchInput,
  onSearchInputChange,
  onSearch,
  onSelect,
  onPageChange,
  onClose,
}: EditorMediaLibraryModalProps) => (
  <AdminModal
    isOpen={isOpen}
    onClose={onClose}
    ariaLabel="Media library"
    className="w-full max-w-4xl"
  >
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-admin-border dark:bg-admin-panel sm:max-h-[85dvh]">
      <div className="p-4 border-b border-slate-100 dark:border-admin-border bg-slate-50 dark:bg-admin-canvas/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Images size={18} className="text-blue-500" />
          Media Library
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-admin-hover dark:hover:text-slate-300"
          title="Close"
          aria-label="Close media library"
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 border-b border-slate-100 bg-white p-3 dark:border-admin-border dark:bg-admin-panel sm:flex-row"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="editor-media-search"
            name="editorMediaSearch"
            type="text"
            inputMode="search"
            value={mediaSearchInput}
            maxLength={120}
            aria-label="Search media library"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search filename, alt text or caption..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-admin-border dark:bg-admin-canvas dark:text-white"
          />
          {mediaSearchInput !== '' && (
            <button
              type="button"
              onClick={() => onSearchInputChange('')}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-sm p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-admin-border dark:hover:text-white"
              title="Clear search"
              aria-label="Clear media library search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      <div className="grow overflow-y-auto p-4 bg-slate-100 dark:bg-admin-canvas custom-scrollbar">
        {loadingMedia ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            Loading library...
          </div>
        ) : mediaFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Images size={48} className="opacity-20 mb-2" />
            <p>No images found in library</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 lg:gap-4">
            {mediaFiles.map((file, idx) => (
              <button
                type="button"
                key={file.id || file.url || idx}
                onClick={() => onSelect(file)}
                aria-label={`Insert ${file.altText || file.name || 'image'}`}
                className="group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-xs transition-all hover:ring-2 hover:ring-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-admin-border dark:bg-admin-panel"
              >
                <div className="aspect-square relative bg-slate-100 dark:bg-admin-canvas">
                  <img
                    src={file.webpUrl || file.url}
                    alt={file.altText || file.name || ''}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/20 group-hover:opacity-100 group-focus-visible:bg-black/20 group-focus-visible:opacity-100">
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                      Select
                    </span>
                  </div>
                </div>
                <div className="p-2 text-xs truncate text-slate-600 dark:text-slate-300 font-medium">
                  {file.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-admin-border bg-slate-50 dark:bg-admin-canvas/50">
        <SmartPagination
          currentPage={mediaPagination.currentPage}
          totalPages={mediaPagination.totalPages}
          onPageChange={onPageChange}
          itemsPerPage={mediaPagination.limit}
          totalItems={mediaPagination.totalItems}
        />
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 py-2 bg-white dark:bg-admin-panel border border-slate-300 dark:border-admin-border-strong rounded-lg hover:bg-slate-50 dark:hover:bg-admin-hover transition-colors text-xs font-bold dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </AdminModal>
);
