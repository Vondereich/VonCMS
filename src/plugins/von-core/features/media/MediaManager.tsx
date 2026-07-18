import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Upload,
  Trash2,
  Folder,
  Image,
  FileText,
  Grid,
  List as ListIcon,
  Search,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  Copy, // Added Copy icon
  Save,
  Check,
} from 'lucide-react';
import { MediaItem, SiteSettings } from '../../../../types';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import SmartPagination from '../../../../components/SmartPagination';

interface MediaManagerProps {
  settings?: SiteSettings;
}

export const MediaManager: React.FC<MediaManagerProps> = ({ settings }) => {
  const canManageMediaDestructiveActions = Boolean(settings?._canManageSecrets);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(settings?.media?.defaultView || 'grid');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRequestIdRef = useRef(0);

  const [metaLoading, setMetaLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pagination State
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 32,
  });
  // Local state for editing metadata
  const [editMeta, setEditMeta] = useState<{
    id: string;
    alt: string;
    caption: string;
    desc: string;
  }>({
    id: '',
    alt: '',
    caption: '',
    desc: '',
  });

  // Update view mode if settings change
  useEffect(() => {
    if (settings?.media?.defaultView) {
      setViewMode(settings.media.defaultView);
    }
  }, [settings?.media?.defaultView]);

  // Fetch media on component mount
  useEffect(() => {
    fetchMedia(1);
  }, []);

  // Sync edit state when a single item is selected
  useEffect(() => {
    if (selectedItems.size === 1) {
      const id = Array.from(selectedItems)[0];
      const item = media.find((i) => i.id === id);
      if (item) {
        setEditMeta({
          id: item.id,
          alt: item.altText || '',
          caption: item.caption || '',
          desc: item.description || '',
        });
      }
    } else {
      setEditMeta({ id: '', alt: '', caption: '', desc: '' }); // Clear editMeta if multiple or no items selected
    }
  }, [selectedItems, media]);

  const fetchMedia = async (page = 1, search = searchQuery) => {
    const requestId = ++mediaRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });
      if (search) params.set('search', search);
      const res = await vonFetch(`${API.listMedia}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();
      if (requestId !== mediaRequestIdRef.current) return;
      if (data.success) {
        setMedia(data.files || []);
        setSelectedItems(new Set());
        setPagination((current) => ({
          ...current,
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalItems: data.totalItems || 0,
        }));
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load media');
      console.error('Fetch media error:', err);
    } finally {
      if (requestId === mediaRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    setError(null);

    const folderStructure = settings?.media?.storage?.folderStructure || 'year_month';

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderStructure', folderStructure);

        const res = await vonFetch(API.uploadFile, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');
        if (data.success) {
          toast.success(`Uploaded: ${data.filename}`);
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (err: any) {
        setError(err.message || 'Upload failed');
        console.error('Upload error:', err);
      }
    }

    setIsUploading(false);
    await fetchMedia(1, searchQuery);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
    }
  };

  // Batch delete handler
  const handleDelete = async (itemsToDelete: string[]) => {
    if (itemsToDelete.length === 0) return;
    if (!canManageMediaDestructiveActions) {
      toast.error('Only the primary admin can delete media files.');
      return;
    }

    const count = itemsToDelete.length;
    if (!confirm(`Are you sure you want to delete ${count} selected file(s)?`)) return;

    setIsDeleting(true);
    let deleted = 0;
    let failed = 0;

    for (const itemId of itemsToDelete) {
      const item = media.find((m) => m.id === itemId);
      if (!item) continue;

      try {
        const res = await vonFetch(API.deleteMedia, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.path || item.name }),
        });

        const data = await res.json();
        if (data.success) {
          deleted++;
        } else {
          throw new Error(data.error || 'Delete failed'); // Throw to catch in outer block
        }
      } catch {
        failed++;
      }
    }

    // Refresh media list
    await fetchMedia(pagination.currentPage, searchQuery);
    setSelectedItems(new Set());
    setIsDeleting(false);

    if (deleted > 0) {
      toast.success(`Deleted ${deleted} file(s)`);
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} file(s)`);
    }
  };

  // Toggle selection
  const toggleSelection = (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredMedia.length && filteredMedia.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMedia.map((m) => m.id)));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleUpdateMeta = async () => {
    if (!editMeta.id) return;
    setMetaLoading(true);
    try {
      const res = await vonFetch(API.updateMedia, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editMeta.id,
          alt_text: editMeta.alt,
          caption: editMeta.caption,
          description: editMeta.desc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File details saved');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        // Update local state
        setMedia((prev) =>
          prev.map((m) =>
            m.id === editMeta.id
              ? {
                  ...m,
                  altText: editMeta.alt,
                  caption: editMeta.caption,
                  description: editMeta.desc,
                }
              : m
          )
        );
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (e) {
      toast.error('Failed to save details');
      console.error('Update meta error:', e);
    } finally {
      setMetaLoading(false);
    }
  };

  const filteredMedia = media;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSearch = searchInput.trim().slice(0, 120);
    setSearchQuery(normalizedSearch);
    void fetchMedia(1, normalizedSearch);
  };

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    // Sync editMeta to the lightbox item immediately
    const item = filteredMedia[lightboxIndex];
    if (item) {
      setEditMeta({
        id: item.id,
        alt: item.altText || '',
        caption: item.caption || '',
        desc: item.description || '',
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft')
        setLightboxIndex((prev) =>
          prev !== null ? (prev - 1 + filteredMedia.length) % filteredMedia.length : null
        );
      if (e.key === 'ArrowRight')
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % filteredMedia.length : null));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredMedia.length]);

  const handleDoubleClick = (item: MediaItem) => {
    if (item.type !== 'image') return;
    const index = filteredMedia.findIndex((m) => m.id === item.id);
    if (index !== -1) setLightboxIndex(index);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Lightbox Overlay */}
      {lightboxIndex !== null &&
        filteredMedia[lightboxIndex] &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in p-4 md:p-8">
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all z-[100] bg-black/20"
            >
              <X size={32} />
            </button>

            {/* Navigation Buttons removed from here to be moved inside Image Column */}

            <div
              className="w-full h-full max-w-7xl bg-white dark:bg-[#16161e] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* IMAGE COLUMN (70%) */}
              <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col items-center justify-center p-4 relative min-h-0">
                {/* Desktop Navigation Buttons INSIDE Image Column to prevent overlap */}
                {filteredMedia.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(
                          (lightboxIndex - 1 + filteredMedia.length) % filteredMedia.length
                        );
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 p-4 hover:bg-white/10 dark:hover:bg-[#1a1b26] rounded-full transition-all z-50 hidden md:block"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex((lightboxIndex + 1) % filteredMedia.length);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 p-4 hover:bg-white/10 dark:hover:bg-[#1a1b26] rounded-full transition-all z-50 hidden md:block"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </>
                )}

                <img
                  src={filteredMedia[lightboxIndex].webpUrl || filteredMedia[lightboxIndex].url}
                  alt={filteredMedia[lightboxIndex].name}
                  className="max-w-full max-h-full object-contain select-none shadow-lg"
                />

                {/* Mobile Navigation */}
                <div className="flex md:hidden gap-8 mt-4">
                  <button
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + filteredMedia.length) % filteredMedia.length
                      )
                    }
                    className="p-2 bg-slate-200 dark:bg-[#1a1b26] rounded-full text-slate-600 dark:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="rotate-180"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % filteredMedia.length)}
                    className="p-2 bg-slate-200 dark:bg-[#1a1b26] rounded-full text-slate-600 dark:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                  <div className="text-slate-600 dark:text-white/70 text-sm font-medium bg-white/80 dark:bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                    {lightboxIndex + 1} / {filteredMedia.length}
                  </div>
                </div>
              </div>

              {/* EDITOR COLUMN (30%) */}
              <div className="w-full md:w-[350px] lg:w-[400px] bg-white dark:bg-[#16161e] border-l border-slate-200 dark:border-white/10 flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/5">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="text-blue-500" size={20} />
                    Edit Media
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Filename Info */}
                  <div className="pb-4 border-b border-slate-100 dark:border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1 block">
                      Main File Information
                    </span>
                    <p className="text-sm text-slate-800 dark:text-white font-medium break-all">
                      {filteredMedia[lightboxIndex].name}
                    </p>
                    <div className="mt-2 flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{filteredMedia[lightboxIndex].extension?.toUpperCase()}</span>
                      <span>
                        {(() => {
                          const size = parseFloat(String(filteredMedia[lightboxIndex].size || 0));
                          return isNaN(size) ? '0.00' : (size / 1024).toFixed(2);
                        })()}{' '}
                        KB
                      </span>
                    </div>
                  </div>

                  {/* Alt Text */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      ALT TEXT
                      <span className="text-[10px] text-blue-500 font-bold">SEO FOCUS</span>
                    </span>
                    <input
                      aria-label="SEO FOCUS"
                      id="mediamanager-510"
                      name="mediamanager510"
                      type="text"
                      value={editMeta.alt}
                      onChange={(e) => setEditMeta({ ...editMeta, alt: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                      placeholder="Alternative text..."
                    />
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      CAPTION
                    </span>
                    <textarea
                      id="mediamanager-524"
                      name="mediamanager524"
                      aria-label="CAPTION"
                      rows={3}
                      value={editMeta.caption}
                      onChange={(e) => setEditMeta({ ...editMeta, caption: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none placeholder:text-slate-400"
                      placeholder="Brief description underneath..."
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      DESCRIPTION
                    </span>
                    <textarea
                      aria-label="DESCRIPTION"
                      id="mediamanager-538"
                      name="mediamanager538"
                      rows={4}
                      value={editMeta.desc}
                      onChange={(e) => setEditMeta({ ...editMeta, desc: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none placeholder:text-slate-400"
                      placeholder="Long notes or details..."
                    />
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={handleUpdateMeta}
                    disabled={metaLoading || saveSuccess}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      saveSuccess
                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 scale-[0.98]'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                    }`}
                  >
                    {metaLoading ? (
                      <RefreshCw className="animate-spin" size={20} />
                    ) : saveSuccess ? (
                      <Check size={20} className="animate-in zoom-in" />
                    ) : (
                      <Save size={20} />
                    )}
                    {saveSuccess ? 'Changes Saved!' : 'Save Details'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-3 lowercase">
                    Syncs to Gallery and Search Engines
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 -z-10" onClick={() => setLightboxIndex(null)}></div>
          </div>,
          document.body
        )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Media Gallery</h2>
          <p className="text-slate-500 text-sm">
            Manage your site's images and files. Double-click an image to view in Lightbox.{' '}
            {pagination.totalItems} files
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMedia(pagination.currentPage, searchQuery)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#242633] text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <input
            id="mediamanager-596"
            name="mediamanager596"
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Upload size={18} /> {isUploading ? 'Uploading...' : 'Upload Media'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white dark:bg-[#1a1b26] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Select All Checkbox */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] rounded-lg transition"
            title={
              selectedItems.size === filteredMedia.length && filteredMedia.length > 0
                ? 'Deselect All'
                : 'Select All'
            }
          >
            {selectedItems.size === filteredMedia.length && filteredMedia.length > 0 ? (
              <CheckSquare size={18} className="text-blue-500" />
            ) : (
              <Square size={18} />
            )}
            <span className="hidden sm:inline">
              {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select All'}
            </span>
          </button>

          {/* Batch Delete Button */}
          {selectedItems.size > 0 && canManageMediaDestructiveActions && (
            <button
              onClick={() => handleDelete(Array.from(selectedItems))}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              <Trash2 size={18} />
              {isDeleting ? 'Deleting...' : `Delete (${selectedItems.size})`}
            </button>
          )}

          <form onSubmit={handleSearch} className="relative flex flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="search-files"
              name="searchFiles"
              aria-label="Search files..."
              type="text"
              placeholder="Search files..."
              maxLength={120}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-20 py-2 border rounded-lg bg-slate-50 dark:bg-[#16161e] border-slate-200 dark:border-[#2a2b36] text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#242633] p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* Drop Zone + Content */}
      <div
        className="grid grid-cols-1 lg:grid-cols-4 gap-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* File Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-[#16161e]/50 rounded-xl border border-dashed border-slate-300 dark:border-[#2a2b36]">
              <RefreshCw size={32} className="text-slate-400 animate-spin" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-[#16161e]/50 rounded-xl border border-dashed border-slate-300 dark:border-[#2a2b36] cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-500 text-sm">
                No files found. Click or drag files to upload.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    // If item is already selected, deselect it. Otherwise, select it.
                    if (selectedItems.has(item.id) && selectedItems.size === 1) {
                      toggleSelection(item.id);
                    } else {
                      setSelectedItems(new Set([item.id]));
                    }
                  }}
                  onDoubleClick={() => handleDoubleClick(item)}
                  className={`group relative aspect-square bg-slate-100 dark:bg-[#16161e] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedItems.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleSelection(item.id, e)}
                    className={`absolute top-2 left-2 z-10 p-1 rounded ${selectedItems.has(item.id) ? 'bg-blue-500 text-white' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'} transition-all`}
                  >
                    {selectedItems.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>

                  {item.type === 'image' ? (
                    <img
                      src={item.webpUrl || item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <Folder size={48} className="mb-2 text-yellow-500" />
                      <span className="text-xs font-medium px-2 text-center">{item.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-medium truncate px-2">
                      {item.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-[#16161e] border-b border-slate-200 dark:border-[#2a2b36] font-medium text-slate-500">
                  <tr>
                    <th className="p-4 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-blue-500"
                      >
                        {selectedItems.size === filteredMedia.length && filteredMedia.length > 0 ? (
                          <CheckSquare size={18} className="text-blue-500" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Uploaded</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedia.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        toggleSelection(item.id);
                      }}
                      onDoubleClick={() => handleDoubleClick(item)}
                      className={`border-b last:border-0 border-slate-100 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#242633]/50 ${selectedItems.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="p-4">
                        <button
                          onClick={(e) => toggleSelection(item.id, e)}
                          className="text-slate-400 hover:text-blue-500"
                        >
                          {selectedItems.has(item.id) ? (
                            <CheckSquare size={18} className="text-blue-500" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="p-4 flex items-center gap-3 dark:text-white">
                        {item.type === 'image' ? (
                          <Image size={16} className="text-blue-500" />
                        ) : (
                          <Folder size={16} className="text-yellow-500" />
                        )}
                        <span className="truncate max-w-[200px]">{item.name}</span>
                      </td>
                      <td className="p-4 text-slate-500">{item.size}</td>
                      <td className="p-4 text-slate-500">{item.uploadedAt}</td>
                      <td className="p-4 text-right">
                        {canManageMediaDestructiveActions && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete([item.id]);
                            }}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition mr-2"
                            title="Delete Selected"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <SmartPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={(page) => fetchMedia(page, searchQuery)}
            itemsPerPage={pagination.limit}
            totalItems={pagination.totalItems}
          />
        </div>

        {/* Sidebar Details */}
        {/* Details Sidebar */}
        {selectedItems.size > 0 ? (
          <div className="lg:col-span-1 bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 sticky top-6">
            <h3 className="font-bold text-lg mb-4 dark:text-white">File Details</h3>
            {selectedItems.size === 1 ? (
              (() => {
                const id = Array.from(selectedItems)[0];
                const item = media.find((m) => m.id === id);
                if (!item) return null;
                return (
                  <div className="space-y-4">
                    <div className="aspect-video bg-slate-100 dark:bg-[#16161e] rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-[#2a2b36]">
                      {item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <FileText size={48} className="text-slate-400" />
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Alt Text
                      </span>
                      <input
                        aria-label="Alternative text for accessibility"
                        id="alternative-text-for-accessibility"
                        name="alternativeTextForAccessibility"
                        type="text"
                        className="w-full text-sm p-2 border border-slate-300 dark:border-[#333544] rounded bg-slate-50 dark:bg-[#16161e] text-slate-800 dark:text-slate-200"
                        placeholder="Alternative text for accessibility"
                        maxLength={255}
                        value={editMeta.alt}
                        onChange={(e) => setEditMeta((prev) => ({ ...prev, alt: e.target.value }))}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Crucial for SEO and Screen Readers
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Caption
                      </span>
                      <textarea
                        id="image-caption"
                        name="imageCaption"
                        aria-label="Image caption..."
                        rows={2}
                        className="w-full text-sm p-2 border border-slate-300 dark:border-[#333544] rounded bg-slate-50 dark:bg-[#16161e] text-slate-800 dark:text-slate-200"
                        placeholder="Image caption..."
                        maxLength={5000}
                        value={editMeta.caption}
                        onChange={(e) =>
                          setEditMeta((prev) => ({ ...prev, caption: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Description
                      </span>
                      <textarea
                        aria-label="Long description..."
                        id="long-description"
                        name="longDescription"
                        rows={3}
                        className="w-full text-sm p-2 border border-slate-300 dark:border-[#333544] rounded bg-slate-50 dark:bg-[#16161e] text-slate-800 dark:text-slate-200"
                        placeholder="Long description..."
                        maxLength={10000}
                        value={editMeta.desc}
                        onChange={(e) => setEditMeta((prev) => ({ ...prev, desc: e.target.value }))}
                      />
                    </div>

                    <button
                      onClick={handleUpdateMeta}
                      disabled={metaLoading}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                    >
                      {metaLoading ? 'Saving...' : 'Save Meta Info'}
                    </button>

                    <hr className="border-slate-200 dark:border-[#2a2b36] my-4" />

                    <div className="space-y-3 text-xs text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="font-semibold block text-slate-700 dark:text-slate-300">
                          Filename
                        </span>
                        <span className="break-all">{item.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold block text-slate-700 dark:text-slate-300">
                            Size
                          </span>
                          {item.size}
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-700 dark:text-slate-300">
                            Format
                          </span>
                          {item.extension?.toUpperCase() || item.type?.toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold block text-slate-700 dark:text-slate-300">
                          Uploaded
                        </span>
                        {item.uploadedAt}
                      </div>
                      <div>
                        <span className="font-semibold block text-slate-700 dark:text-slate-300">
                          URL
                        </span>
                        <div className="flex gap-2 mt-1">
                          <input
                            id="mediamanager-947"
                            name="mediamanager947"
                            aria-label="Media URL"
                            readOnly
                            value={item.url}
                            className="flex-1 bg-slate-100 dark:bg-[#16161e] border border-slate-300 dark:border-[#333544] rounded px-2 py-1 select-all text-slate-600 dark:text-slate-300"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.url);
                              toast.success('Copied!');
                            }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-[#242633] rounded text-slate-600 dark:text-slate-300"
                            title="Copy URL"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {canManageMediaDestructiveActions && (
                      <div className="mt-8 pt-4 border-t border-slate-100 dark:border-[#2a2b36]">
                        <button
                          onClick={() => handleDelete([item.id])} // Fixed: Pass array
                          className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 font-medium flex items-center justify-center gap-2 transition"
                        >
                          <Trash2 size={16} /> Delete File
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8">
                <div className="bg-slate-100 dark:bg-[#242633] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-slate-500 dark:text-slate-300">
                    {selectedItems.size}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">Items selected</p>
                {canManageMediaDestructiveActions && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => handleDelete(Array.from(selectedItems))} // Fixed: Use handleDelete with array
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} /> Delete Selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-1 bg-slate-50 dark:bg-[#16161e]/50 rounded-xl border border-dashed border-slate-300 dark:border-[#2a2b36] p-8 text-center text-slate-400 sticky top-6">
            <Image size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a file to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};
