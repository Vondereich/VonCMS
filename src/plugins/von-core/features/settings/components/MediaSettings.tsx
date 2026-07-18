import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SiteSettings, MediaConfig } from '../../../../../types';
import { API } from '../../../../../config/site.config';
import { vonFetch } from '../../../../../utils/api';
import {
  Image,
  HardDrive,
  Zap,
  Wrench,
  Trash2,
  RefreshCw,
  Grid,
  List as ListIcon,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';

interface MediaSettingsProps {
  settings: SiteSettings;
  onChange: (key: string, value: any) => void;
}

interface MediaCleanupEntry {
  path: string;
  size: number;
  sizeFormatted?: string;
  modified: string;
}

const formatMediaToolSize = (bytes?: number) => {
  const safeBytes = Number(bytes || 0);
  if (safeBytes >= 1048576) {
    return `${(safeBytes / 1048576).toFixed(2)} MB`;
  }
  return `${(safeBytes / 1024).toFixed(2)} KB`;
};

export const MediaSettings: React.FC<MediaSettingsProps> = ({ settings, onChange }) => {
  const [activeTab, setActiveTab] = useState<
    'optimization' | 'sizes' | 'storage' | 'performance' | 'tools' | 'gallery'
  >('optimization');

  // Tools state
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncingMedia, setIsSyncingMedia] = useState(false);
  const [isCleaningVariantRows, setIsCleaningVariantRows] = useState(false);
  const [isRebuildingVariants, setIsRebuildingVariants] = useState(false);
  const [isManagingVariants, setIsManagingVariants] = useState(false);
  const [toolResult, setToolResult] = useState<{
    type: string;
    message: string;
    stats?: any;
    previewToken?: string | null;
    orphaned?: MediaCleanupEntry[];
    failedDeletions?: string[];
  } | null>(null);
  const media = {
    optimization: settings.media?.optimization || {
      enabled: false,
      compressionLevel: 'medium',
      convertToWebP: false,
      maxWidth: 1920,
      maxHeight: 1080,
    },
    storage: settings.media?.storage || { location: 'local', folderStructure: 'year_month' },
    performance: settings.media?.performance || { lazyLoadImages: true, lazyLoadIframes: true },
    defaultView: settings.media?.defaultView,
  };

  const updateMedia = (
    section: Exclude<keyof MediaConfig, 'defaultView'>,
    key: string,
    value: any
  ) => {
    const updatedMedia = {
      ...media,
      [section]: {
        ...media[section],
        [key]: value,
      },
    };
    onChange('media', updatedMedia);
  };

  const handleRebuildResponsiveVariants = async () => {
    setIsRebuildingVariants(true);
    setToolResult(null);
    try {
      const formData = new FormData();
      formData.append('action', 'rebuild_responsive_variants');
      const res = await vonFetch(API.mediaTools, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setToolResult({ type: 'rebuild', message: data.message, stats: data.stats });
      } else {
        toast.error(data.error || 'Failed to rebuild responsive variants');
        setToolResult({ type: 'error', message: data.error });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsRebuildingVariants(false);
    }
  };
  const handleSyncMedia = async () => {
    setIsSyncingMedia(true);
    setToolResult(null);
    try {
      const res = await vonFetch(API.syncMedia, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Media sync completed');
        setToolResult({
          type: 'sync',
          message: data.message || 'Media sync completed',
          stats: {
            processed: data.synced ?? 0,
            skipped: data.skipped ?? 0,
            skippedVariants: data.skippedVariants ?? 0,
            errors: Array.isArray(data.errors) ? data.errors.length : 0,
          },
        });
      } else {
        toast.error(data.error || 'Failed to sync media library');
        setToolResult({ type: 'error', message: data.error || 'Failed to sync media library' });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsSyncingMedia(false);
    }
  };
  const handlePreviewResponsiveVariants = async () => {
    setIsManagingVariants(true);
    setToolResult(null);
    try {
      const formData = new FormData();
      formData.append('action', 'preview_responsive_variants');
      const res = await vonFetch(API.mediaTools, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setToolResult({ type: 'variants-preview', message: data.message, stats: data.stats });
      } else {
        toast.error(data.error || 'Failed to preview responsive variants');
        setToolResult({ type: 'error', message: data.error });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsManagingVariants(false);
    }
  };

  const handleCleanupVariantRows = async () => {
    if (
      !window.confirm(
        'Remove generated variant rows from the media library database? Original files and original media rows will stay untouched.'
      )
    ) {
      return;
    }

    setIsCleaningVariantRows(true);
    setToolResult(null);
    try {
      const res = await vonFetch(API.cleanupMediaVariantRows, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Generated variant rows cleaned');
        setToolResult({
          type: 'cleanup-variant-rows',
          message: data.message || 'Generated variant rows cleaned',
          stats: {
            deleted: data.deleted ?? 0,
            scanned: data.scanned ?? 0,
          },
        });
      } else {
        toast.error(data.error || 'Failed to clean generated variant rows');
        setToolResult({
          type: 'error',
          message: data.error || 'Failed to clean generated variant rows',
        });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsCleaningVariantRows(false);
    }
  };

  const handlePurgeResponsiveVariants = async (executeDelete: boolean = false) => {
    if (
      executeDelete &&
      !window.confirm(
        'Delete generated responsive variants only? Original uploads will not be removed, but current srcset candidates can disappear until variants are rebuilt again. WebP-heavy imports may not rebuild those variants automatically.'
      )
    ) {
      return;
    }

    setIsManagingVariants(true);
    setToolResult(null);
    try {
      const formData = new FormData();
      formData.append(
        'action',
        executeDelete ? 'purge_responsive_variants' : 'preview_responsive_variants'
      );
      const res = await vonFetch(API.mediaTools, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setToolResult({
          type: executeDelete ? 'variants-purge' : 'variants-preview',
          message: data.message,
          stats: data.stats,
        });
      } else {
        toast.error(data.error || 'Failed to manage responsive variants');
        setToolResult({ type: 'error', message: data.error });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsManagingVariants(false);
    }
  };
  const handleCleanupUnused = async (executeDelete: boolean = false) => {
    const reviewedPreviewToken = toolResult?.previewToken ?? '';
    if (executeDelete) {
      if (!reviewedPreviewToken) {
        toast.error('Scan untracked files first before deleting.');
        return;
      }
      if (
        !window.confirm(
          'Delete the reviewed untracked files from this scan result? This cannot be undone.'
        )
      ) {
        return;
      }
    }
    setIsScanning(true);
    setToolResult(null);
    try {
      const formData = new FormData();
      formData.append('action', 'cleanup_unused');
      if (executeDelete) {
        formData.append('execute_cleanup', 'true');
        formData.append('preview_token', reviewedPreviewToken);
      }
      const res = await vonFetch(API.mediaTools, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setToolResult({
          type: 'cleanup',
          message: data.message,
          stats: data.stats,
          previewToken: data.previewToken ?? null,
          orphaned: Array.isArray(data.orphaned) ? data.orphaned : [],
          failedDeletions: Array.isArray(data.failedDeletions) ? data.failedDeletions : [],
        });
      } else {
        toast.error(data.error || 'Failed to scan files');
        setToolResult({ type: 'error', message: data.error });
      }
    } catch (err: any) {
      toast.error('Error: ' + (err?.message || 'Unknown error'));
      setToolResult({ type: 'error', message: err?.message || 'Unknown error' });
    } finally {
      setIsScanning(false);
    }
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
          <Image size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Media Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage image optimization, sizes, and storage.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-[#2a2b36] overflow-x-auto">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'gallery' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <Grid size={16} /> Gallery
          </button>
          <button
            onClick={() => setActiveTab('optimization')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'optimization' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <Zap size={16} /> Optimization
          </button>
          <button
            onClick={() => setActiveTab('sizes')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'sizes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <Image size={16} /> Sizes
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'storage' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <HardDrive size={16} /> Storage
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'performance' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <Zap size={16} /> Performance
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'tools' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            <Wrench size={16} /> Tools
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'optimization' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white block">
                    Enable Image Optimization
                  </span>
                  <p className="text-xs text-slate-500">Automatically compress images on upload.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="mediasettings-365"
                    name="mediasettings365"
                    type="checkbox"
                    className="sr-only peer"
                    checked={media.optimization.enabled}
                    onChange={(e) => updateMedia('optimization', 'enabled', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Compression Level
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      onClick={() => updateMedia('optimization', 'compressionLevel', level)}
                      className={`py-2 px-4 rounded-lg border text-sm font-medium capitalize transition-all ${media.optimization.compressionLevel === level ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#1a1b26] dark:border-[#2a2b36] dark:text-slate-400'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white block">
                    Convert to WebP
                  </span>
                  <p className="text-xs text-slate-500">
                    Serve images in next-gen format for better performance.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="mediasettings-402"
                    name="mediasettings402"
                    type="checkbox"
                    className="sr-only peer"
                    checked={media.optimization.convertToWebP}
                    onChange={(e) => updateMedia('optimization', 'convertToWebP', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'sizes' && (
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Width (px)
                  </span>
                  <input
                    aria-label="Max Width (px)"
                    id="mediasettings-421"
                    name="mediasettings421"
                    type="number"
                    value={media.optimization.maxWidth}
                    onChange={(e) =>
                      updateMedia('optimization', 'maxWidth', parseInt(e.target.value))
                    }
                    className="w-full p-2.5 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Height (px)
                  </span>
                  <input
                    id="mediasettings-434"
                    name="mediasettings434"
                    aria-label="Max Height (px)"
                    type="number"
                    value={media.optimization.maxHeight}
                    onChange={(e) =>
                      updateMedia('optimization', 'maxHeight', parseInt(e.target.value))
                    }
                    className="w-full p-2.5 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  These limits control how large uploaded images can be after processing.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
              <div className="space-y-6">
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Storage Location
                  </span>
                  <select
                    aria-label="Storage Location"
                    id="mediasettings-459"
                    name="mediasettings459"
                    value={media.storage.location}
                    onChange={(e) => updateMedia('storage', 'location', e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  >
                    <option value="local">Local Server</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Files are stored locally. Use CDN URL below to serve via CDN.
                  </p>
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Folder Structure
                  </span>
                  <select
                    id="mediasettings-474"
                    name="mediasettings474"
                    aria-label="Folder Structure"
                    value={media.storage.folderStructure}
                    onChange={(e) => updateMedia('storage', 'folderStructure', e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  >
                    <option value="year_month">Year / Month (e.g. 2025/12/image.jpg)</option>
                    <option value="flat">Flat (All in one folder)</option>
                  </select>
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    CDN Base URL (Optional)
                  </span>
                  <input
                    id="mediasettings-487"
                    name="mediasettings487"
                    aria-label="CDN Base URL (Optional)"
                    type="url"
                    value={media.storage.cdnUrl || ''}
                    onChange={(e) => updateMedia('storage', 'cdnUrl', e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#16161e] border border-slate-200 dark:border-[#2a2b36] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    placeholder="https://cdn.example.com or https://cdn.example.com/uploads"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Files still upload to this site. Leave blank unless your CDN is already pointed
                    at the VonCMS uploads folder.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-4 dark:border-white/10 dark:bg-[#16161e]/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Info size={14} className="text-blue-500" />
                  <span>CDN URL guide</span>
                </div>
                <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-3">
                  <li className="flex gap-3 items-start">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                        When to use
                      </strong>
                      Fill this only after a CDN or custom media domain is already serving the
                      VonCMS uploads folder.
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                        Benefit
                      </strong>
                      Visitors load images from the CDN domain while uploads still stay managed by
                      this site.
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 whitespace-nowrap">
                        Accepted format
                      </strong>
                      Use a CDN root URL or a CDN /uploads URL.
                    </div>
                  </li>
                </ul>
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Leave blank for normal local uploads or if the CDN is not configured yet.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white block">
                    Lazy Load Images
                  </span>
                  <p className="text-xs text-slate-500">Defer loading of off-screen images.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="mediasettings-511"
                    name="mediasettings511"
                    type="checkbox"
                    className="sr-only peer"
                    checked={media.performance.lazyLoadImages}
                    onChange={(e) => updateMedia('performance', 'lazyLoadImages', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white block">
                    Lazy Load Iframes
                  </span>
                  <p className="text-xs text-slate-500">
                    Defer loading of embedded content (YouTube, Maps).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="mediasettings-530"
                    name="mediasettings530"
                    type="checkbox"
                    className="sr-only peer"
                    checked={media.performance.lazyLoadIframes}
                    onChange={(e) =>
                      updateMedia('performance', 'lazyLoadIframes', e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-[#242633] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-4 max-w-2xl">
              {toolResult && (
                <div
                  className={`p-4 rounded-lg border flex items-start gap-3 ${
                    toolResult.type === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  }`}
                >
                  {toolResult.type === 'error' ? (
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="w-full">
                    <p
                      className={`font-medium ${toolResult.type === 'error' ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}
                    >
                      {toolResult.message}
                    </p>
                    {toolResult.stats && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 space-y-1">
                        {(toolResult.stats.processed !== undefined ||
                          toolResult.stats.skipped !== undefined ||
                          toolResult.stats.skippedWebP !== undefined ||
                          toolResult.stats.skippedVariants !== undefined ||
                          toolResult.stats.errors !== undefined) && (
                          <div>
                            {toolResult.stats.processed !== undefined &&
                              `Processed: ${toolResult.stats.processed}`}
                            {toolResult.stats.skippedWebP !== undefined &&
                              ` | WebP skipped (already compressed): ${toolResult.stats.skippedWebP}`}
                            {toolResult.stats.skipped !== undefined &&
                              ` | Skipped: ${toolResult.stats.skipped}`}
                            {toolResult.stats.skippedVariants !== undefined &&
                              ` | Generated variants ignored: ${toolResult.stats.skippedVariants}`}
                            {toolResult.stats.errors !== undefined &&
                              ` | Errors: ${toolResult.stats.errors}`}
                          </div>
                        )}
                        {toolResult.stats.count !== undefined && (
                          <div>
                            Found: {toolResult.stats.count}{' '}
                            {toolResult.type === 'cleanup'
                              ? 'untracked files'
                              : 'generated variants'}
                            {toolResult.stats.totalSizeFormatted &&
                              ` (${toolResult.stats.totalSizeFormatted})`}
                          </div>
                        )}
                        {toolResult.stats.sourceCount !== undefined && (
                          <div>Referenced source images: {toolResult.stats.sourceCount}</div>
                        )}
                        {(toolResult.stats.deleted !== undefined ||
                          toolResult.stats.scanned !== undefined) && (
                          <div>
                            {toolResult.stats.deleted !== undefined &&
                              `Removed variant rows: ${toolResult.stats.deleted}`}
                            {toolResult.stats.scanned !== undefined &&
                              ` | Rows scanned: ${toolResult.stats.scanned}`}
                          </div>
                        )}
                        {toolResult.stats.deletedCount !== undefined &&
                          toolResult.stats.isExecuted && (
                            <div className="font-bold text-green-600 dark:text-green-400">
                              Deleted: {toolResult.stats.deletedCount}
                              {toolResult.stats.deletedSizeFormatted &&
                                ` (${toolResult.stats.deletedSizeFormatted})`}
                            </div>
                          )}
                        {toolResult.stats.failedCount > 0 && (
                          <div className="font-bold text-red-600 dark:text-red-400">
                            Failed to delete: {toolResult.stats.failedCount}
                          </div>
                        )}
                      </div>
                    )}
                    {toolResult.type === 'variants-preview' && toolResult.stats?.count > 0 && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="text-sm text-orange-800 dark:text-orange-300 font-medium mb-3">
                          Warning: deleting generated responsive variants does not remove original
                          uploads, but it can remove current srcset candidates until you rebuild
                          them again. For WebP-heavy imports, some variants may not come back
                          automatically with the current rebuild rules.
                        </p>
                        <button
                          onClick={() => handlePurgeResponsiveVariants(true)}
                          disabled={isManagingVariants}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                          Delete {toolResult.stats.count} Generated Variants Anyway
                        </button>
                      </div>
                    )}
                    {toolResult.type === 'cleanup' &&
                      toolResult.stats?.count > 0 &&
                      !toolResult.stats?.isExecuted && (
                        <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <p className="text-sm text-orange-800 dark:text-orange-300 font-medium mb-3">
                            Scanning does not delete anything. Review the exact untracked-file list
                            below before removing anything from this snapshot.
                          </p>
                          {toolResult.orphaned && toolResult.orphaned.length > 0 && (
                            <div className="max-h-64 overflow-auto rounded-lg border border-orange-200 dark:border-orange-800 bg-white/80 dark:bg-[#101018]/40">
                              {toolResult.orphaned.map((file) => (
                                <div
                                  key={file.path}
                                  className="px-3 py-2 text-sm border-b border-orange-100 dark:border-orange-900/40 last:border-b-0"
                                >
                                  <div className="font-medium text-slate-800 dark:text-slate-100 break-all">
                                    {file.path}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {file.sizeFormatted || formatMediaToolSize(file.size)} | Last
                                    modified: {file.modified}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => handleCleanupUnused(true)}
                            disabled={isScanning}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            Delete Reviewed Files
                          </button>
                        </div>
                      )}
                    {toolResult.type === 'cleanup' &&
                      toolResult.failedDeletions &&
                      toolResult.failedDeletions.length > 0 && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-3">
                            Some files could not be removed:
                          </p>
                          <div className="max-h-48 overflow-auto rounded-lg border border-red-200 dark:border-red-800 bg-white/80 dark:bg-[#101018]/40">
                            {toolResult.failedDeletions.map((path) => (
                              <div
                                key={path}
                                className="px-3 py-2 text-sm border-b border-red-100 dark:border-red-900/40 last:border-b-0 text-slate-700 dark:text-slate-200 break-all"
                              >
                                {path}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
              <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Sync Media Library
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  Scan `uploads/` for files added by FTP or file manager and index any missing media
                  records into the dashboard library. Generated responsive variants and legacy
                  thumbnail files are ignored automatically.
                </p>
                <button
                  onClick={handleSyncMedia}
                  disabled={
                    isSyncingMedia ||
                    isCleaningVariantRows ||
                    isScanning ||
                    isManagingVariants ||
                    isRebuildingVariants
                  }
                  className={`px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-all ${isSyncingMedia || isCleaningVariantRows || isScanning || isManagingVariants || isRebuildingVariants ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw size={16} className={isSyncingMedia ? 'animate-spin' : ''} />
                  {isSyncingMedia ? 'Syncing...' : 'Start Media Sync'}
                </button>
                <button
                  onClick={handleCleanupVariantRows}
                  disabled={
                    isCleaningVariantRows ||
                    isSyncingMedia ||
                    isScanning ||
                    isManagingVariants ||
                    isRebuildingVariants
                  }
                  className={`mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2 transition-all ${isCleaningVariantRows || isSyncingMedia || isScanning || isManagingVariants || isRebuildingVariants ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={16} className={isCleaningVariantRows ? 'animate-pulse' : ''} />
                  {isCleaningVariantRows ? 'Cleaning Variant Rows...' : 'Clean Old Variant Rows'}
                </button>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Rebuild Responsive Variants
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  Generate or refresh responsive width variants for featured images referenced by
                  posts.
                </p>
                <button
                  onClick={handleRebuildResponsiveVariants}
                  disabled={isRebuildingVariants || isManagingVariants}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-all ${isRebuildingVariants || isManagingVariants ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <RefreshCw size={16} className={isRebuildingVariants ? 'animate-spin' : ''} />
                  {isRebuildingVariants ? 'Processing...' : 'Start Rebuild'}
                </button>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Responsive Variant Rollback
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  Review generated responsive variants carefully before deleting anything. Original
                  uploads stay untouched, but deleting generated variants can remove active srcset
                  candidates until a rebuild restores them. WebP-heavy imports may not regenerate
                  every deleted variant automatically.
                </p>
                <button
                  onClick={handlePreviewResponsiveVariants}
                  disabled={isManagingVariants || isRebuildingVariants}
                  className={`px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2 transition-all ${isManagingVariants || isRebuildingVariants ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={16} className={isManagingVariants ? 'animate-pulse' : ''} />
                  {isManagingVariants ? 'Scanning...' : 'Preview Generated Variants Only'}
                </button>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 rounded-lg border border-slate-200 dark:border-[#2a2b36]">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Review Untracked Files
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  Scan storage for files that are neither indexed in the Media Library nor
                  referenced by a post or page. Indexed library items stay protected, and scanning
                  does not delete anything.
                </p>
                <button
                  onClick={() => handleCleanupUnused(false)}
                  disabled={isScanning || isManagingVariants || isRebuildingVariants}
                  className={`px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2 transition-all ${isScanning || isManagingVariants || isRebuildingVariants ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={16} className={isScanning ? 'animate-pulse' : ''} />
                  {isScanning ? 'Scanning...' : 'Scan Untracked Files'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'gallery' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Default Gallery View
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onChange('media', { ...media, defaultView: 'grid' })}
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border text-sm font-medium transition-all ${media.defaultView !== 'list' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#1a1b26] dark:border-[#2a2b36] dark:text-slate-400'}`}
                  >
                    <Grid size={18} /> Grid View
                  </button>
                  <button
                    onClick={() => onChange('media', { ...media, defaultView: 'list' })}
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border text-sm font-medium transition-all ${media.defaultView === 'list' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#1a1b26] dark:border-[#2a2b36] dark:text-slate-400'}`}
                  >
                    <ListIcon size={18} /> List View
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Choose how the Gallery (Media Manager) displays files by default.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
