import React, { useState, useEffect } from 'react';
import notify from '../utils/toast';
import { Post, Page, MediaItem, ContentAuditLog } from '../types';
import Editor from './Editor';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { getAuthHeader } from '../config/auth.config';
import {
  Globe,
  ArrowLeft,
  Sparkles,
  X,
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Upload,
  Images,
  ChevronLeft,
  ChevronRight,
  History,
  Clock3,
  User,
} from 'lucide-react';
import { sanitizeHTML, trimTrailingHtml } from '../utils/colorSanitizer';
import { htmlToPlainText, sanitizeEditorHtml } from '../utils/security';
import { analyzeSEO, SEOAnalysisResult, extractKeywords } from '../utils/seoAnalyzer';
import { normalizeImageSource } from '../utils/siteUtils';
import AiWritingPanel from './editor/AiWritingPanel';
import { useAiWriting } from '../hooks/useAiWriting';
import {
  AUTOSAVE_INTERVAL_MS,
  SAVE_CONFLICT_MESSAGE,
  buildAutoSaveCandidate,
  buildSaveStatusLabel,
  buildSavedSnapshot,
  formatScheduledTarget,
  getSaveStatusClassName,
  normalizeScheduledAtForSave,
  normalizeScheduledInputValue,
  type SaveStatus,
} from './editor/postEditorSaveHelpers';

interface PostEditorProps {
  initialItem: Post | Page | null;
  isPage: boolean;
  navigation: { url: string }[];
  posts?: Post[];
  onSave: (item: Post | Page, addToMenu: boolean, isAutoSave?: boolean) => Promise<any>;
  onBack: () => void;
  settings?: any; // Added settings prop
}

const PostEditor: React.FC<PostEditorProps> = ({
  initialItem,
  isPage,
  navigation = [],
  posts = [],
  onSave,
  onBack,
  settings,
}) => {
  const [item, setItem] = useState<Post | Page | null>(initialItem);
  const [editorContentRevision, setEditorContentRevision] = useState(0);
  const [addToMenu, setAddToMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seoResult, setSeoResult] = useState<SEOAnalysisResult | null>(null);
  const [isSeoRestoring, setIsSeoRestoring] = useState(
    Boolean(initialItem?.id && !isPage && !initialItem.content)
  );
  const [isFeaturedLibraryOpen, setIsFeaturedLibraryOpen] = useState(false);
  const [featuredMediaFiles, setFeaturedMediaFiles] = useState<MediaItem[]>([]);
  const [isFeaturedLibraryLoading, setIsFeaturedLibraryLoading] = useState(false);
  const [featuredMediaPage, setFeaturedMediaPage] = useState(1);
  const [featuredMediaTotalPages, setFeaturedMediaTotalPages] = useState(1);
  const [auditLogs, setAuditLogs] = useState<ContentAuditLog[]>([]);
  const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);
  const featuredImageInputRef = React.useRef<HTMLInputElement>(null);

  const availableCategories: string[] = [];
  for (const rawCategory of [
    'Uncategorized',
    ...((settings?.categories as string[] | undefined) || []),
    ...posts.map((post) => post.category || ''),
    ...(!isPage && item && 'category' in item ? [(item as Post).category || ''] : []),
  ]) {
    const category = rawCategory.trim();
    if (category && !availableCategories.includes(category)) {
      availableCategories.push(category);
    }
  }

  // SEO Analysis Effect
  useEffect(() => {
    if (!item || isSeoRestoring) {
      setSeoResult(null);
      return;
    }

    const result = analyzeSEO(
      item.title || '',
      item.metaDescription || item.excerpt || '',
      item.content || '',
      item.keywords || ''
    );
    setSeoResult(result);
  }, [
    isSeoRestoring,
    item?.title,
    item?.content,
    item?.metaDescription,
    item?.excerpt,
    item?.keywords,
  ]);

  // Keep editor content ownership tied to the item only; navigation changes must not reset full SEO data.
  useEffect(() => {
    let cancelled = false;

    setItem(initialItem);
    setEditorContentRevision((revision) => revision + 1);

    const needsFullContentRestore = Boolean(initialItem?.id && !isPage);
    const restoreItemId = initialItem?.id;
    setIsSeoRestoring(needsFullContentRestore);

    if (!needsFullContentRestore || !restoreItemId) {
      return () => {
        cancelled = true;
      };
    }

    const fetchFullContent = async () => {
      try {
        const res = await vonFetch(`${API.getPost}?id=${restoreItemId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (!cancelled && data.success && data.post) {
          setItem((prev) => {
            if (!prev || String(prev.id || '') !== String(restoreItemId)) return prev;
            const restoredSnapshot = {
              ...prev,
              content: data.post.content || '',
              // Restore other fields missing from list view.
              metaDescription: data.post.meta_description || prev.metaDescription || '',
              keywords: data.post.keywords || prev.keywords || '',
              excerpt: data.post.excerpt || prev.excerpt || '',
              title: data.post.title || prev.title,
              slug: data.post.slug || prev.slug,
              status: data.post.status || prev.status,
              scheduledAt:
                data.post.scheduled_at || ('scheduledAt' in prev ? prev.scheduledAt || '' : ''),
              updatedAt: data.post.updated_at || data.post.updatedAt || prev.updatedAt || '',
              updated_at: data.post.updated_at || data.post.updatedAt || prev.updated_at || '',
            };
            initialItemRef.current = restoredSnapshot;
            itemRef.current = restoredSnapshot;
            return restoredSnapshot;
          });
          contentRef.current = data.post.content || '';
          setEditorContentRevision((revision) => revision + 1);
          notify.success('Restored full content & SEO data');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch full content:', err);
        }
      } finally {
        if (!cancelled) {
          setIsSeoRestoring(false);
        }
      }
    };

    void fetchFullContent();

    return () => {
      cancelled = true;
    };
  }, [initialItem, isPage]);

  useEffect(() => {
    if (!initialItem?.id) {
      setAddToMenu(false);
      return;
    }

    const typePrefix = isPage ? 'page:' : 'post:';
    const url = `${typePrefix}${initialItem.id}`;
    setAddToMenu(navigation.some((n) => n.url === url));
  }, [initialItem?.id, isPage, navigation]);

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [autoSaveCountdown, setAutoSaveCountdown] = useState(
    Math.ceil(AUTOSAVE_INTERVAL_MS / 1000)
  );
  const contentRef = React.useRef<string>('');
  const isSavingRef = React.useRef(false);
  const itemRef = React.useRef(item);
  const initialItemRef = React.useRef(initialItem);
  const nextAutoSaveAtRef = React.useRef(Date.now() + AUTOSAVE_INTERVAL_MS);
  const saveStatusResetRef = React.useRef<number | null>(null);

  // Keep refs in sync (no re-render)
  useEffect(() => {
    itemRef.current = item;
  }, [item]);
  useEffect(() => {
    initialItemRef.current = initialItem;
  }, [initialItem]);

  // Update ref when content changes
  useEffect(() => {
    contentRef.current = item?.content || '';
  }, [item?.content]);

  // Sync isSaving state to ref
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const refreshAutoSaveCountdown = React.useCallback(() => {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((nextAutoSaveAtRef.current - Date.now()) / 1000)
    );
    setAutoSaveCountdown(remainingSeconds);
    return remainingSeconds;
  }, []);

  const scheduleNextAutoSave = React.useCallback(() => {
    nextAutoSaveAtRef.current = Date.now() + AUTOSAVE_INTERVAL_MS;
    setAutoSaveCountdown(Math.ceil(AUTOSAVE_INTERVAL_MS / 1000));
  }, []);

  const getAutoSaveCandidate = React.useCallback(() => {
    const currentItem = itemRef.current;
    const currentInitial = initialItemRef.current;
    const currentContent = contentRef.current;
    return buildAutoSaveCandidate(currentItem, currentInitial, currentContent);
  }, []);

  // Autosave Timer — uses refs to avoid timer reset on every keystroke
  useEffect(() => {
    refreshAutoSaveCountdown();

    const timer = setInterval(() => {
      const secondsUntilSave = refreshAutoSaveCountdown();
      if (secondsUntilSave > 0) {
        return;
      }

      const { currentItem, isChanged, hasMeaningfulData, canAutoSave } = getAutoSaveCandidate();
      if (currentItem && isChanged && hasMeaningfulData && canAutoSave && !isSavingRef.current) {
        void handleSave(undefined, true, currentItem).finally(() => {
          scheduleNextAutoSave();
        });
        return;
      }

      scheduleNextAutoSave();
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAutoSaveCountdown();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getAutoSaveCandidate, refreshAutoSaveCountdown, scheduleNextAutoSave]); // Uses refs for item data

  const handleEditorChange = React.useCallback((html: string) => {
    contentRef.current = html;
    setItem((prev) => (prev ? { ...prev, content: html } : null));
  }, []);

  const handleEditorImmediateChange = React.useCallback((html: string) => {
    contentRef.current = html;
    if (itemRef.current) {
      itemRef.current = { ...itemRef.current, content: html };
    }
  }, []);

  const handleTitleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setItem((prev) => (prev ? { ...prev, title: value } : null));
  }, []);

  const handleEditorImageClick = React.useCallback(
    (src: string) => {
      if (!isPage) {
        setItem((prev) => (prev ? { ...prev, image: src } : null));
        notify.success('Featured image updated!');
      }
    },
    [isPage]
  );

  const handleSave = async (
    statusOverride?: string,
    isAutoSave: boolean = false,
    itemOverride?: Post | Page | null
  ) => {
    const itemForSaveBase = itemOverride || item;
    if (!itemForSaveBase || isSavingRef.current) return;

    const liveContent = contentRef.current;
    const itemForSave = { ...itemForSaveBase, content: liveContent };

    const status = statusOverride || itemForSave.status || 'draft';

    // Validate: Require title and content for publish/schedule (not draft)
    if (status !== 'draft') {
      const plainText = htmlToPlainText(itemForSave.content);
      if (!itemForSave.title?.trim()) {
        if (!isAutoSave) notify.error('Please enter a title before publishing.');
        return;
      }
      if (!plainText) {
        if (!isAutoSave) notify.error('Please add some content before publishing.');
        return;
      }
    }

    // Safety: Prevent rescheduling already published posts
    if (initialItem && initialItem.status === 'published' && status === 'scheduled') {
      if (!isAutoSave) notify.error('Cannot schedule an already published post.');
      return;
    }

    isSavingRef.current = true;
    if (!isAutoSave) setIsSaving(true);
    setSaveStatus(isAutoSave ? 'auto-saving' : 'manual-saving');
    const manualSaveToastId = !isAutoSave
      ? notify.loading(status === 'draft' ? 'Saving draft...' : 'Saving changes...')
      : undefined;

    try {
      // Sanitize content colors (Clean "dirty" blacks/whites for Dark Mode)
      let contentToSave = itemForSave.content
        ? sanitizeEditorHtml(sanitizeHTML(itemForSave.content).cleanedHTML)
        : '';

      // Auto-Trimmer: Remove ghost spaces at the end
      if (contentToSave) {
        contentToSave = trimTrailingHtml(contentToSave);
      }

      const itemToSave = normalizeScheduledAtForSave(
        { ...itemForSave, content: contentToSave },
        status
      );

      const savedData = await onSave(itemToSave as Post | Page, addToMenu, isAutoSave);
      const savedSnapshot = buildSavedSnapshot(itemToSave as Post | Page, savedData);
      initialItemRef.current = savedSnapshot;
      itemRef.current = savedSnapshot;
      contentRef.current = savedSnapshot.content || '';
      setItem((prev) => (prev ? { ...prev, ...savedSnapshot } : savedSnapshot));

      if (savedData && savedData.id) {
        void loadAuditLogs(String(savedData.id), isPage);
      }

      // Auto Save Behavior Customization
      if (!isAutoSave) {
        // Success feedback for manual saves
        const isUpdate = !!initialItem?.id;
        const contentType = isPage ? 'Page' : 'Post';
        if (manualSaveToastId) notify.dismiss(manualSaveToastId);
        if (status === 'draft') {
          notify.success(`${contentType} draft saved!`);
        } else if (status === 'scheduled') {
          notify.success(`${contentType} scheduled successfully!`);
        } else {
          notify.success(isUpdate ? `${contentType} updated!` : `${contentType} published!`);
        }
      }

      setLastSaved(new Date());
      setSaveStatus('saved');
      if (saveStatusResetRef.current !== null) {
        window.clearTimeout(saveStatusResetRef.current);
      }
      saveStatusResetRef.current = window.setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle');
      }, 6000);
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      if (manualSaveToastId) notify.dismiss(manualSaveToastId);
      if (
        err?.status === 409 ||
        String(err?.message || '').includes('Content changed in another tab')
      ) {
        notify.error(SAVE_CONFLICT_MESSAGE);
      } else if (!isAutoSave) {
        notify.error('Save failed: ' + err.message);
      }
    } finally {
      isSavingRef.current = false;
      if (mountedRef.current && !isAutoSave) setIsSaving(false);
    }
  };

  // Track mount status
  const mountedRef = React.useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (saveStatusResetRef.current !== null) {
        window.clearTimeout(saveStatusResetRef.current);
      }
    };
  }, []);

  const parseJsonResponse = React.useCallback(async (res: Response, actionLabel: string) => {
    const rawText = await res.text();

    if (!rawText) {
      throw new Error(`${actionLabel} failed: empty server response (HTTP ${res.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      const preview = rawText
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140);
      const detail = preview ? `: ${preview}` : '';

      throw new Error(
        `${actionLabel} failed: server returned non-JSON response (HTTP ${res.status})${detail}`
      );
    }

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || data?.message || `${actionLabel} failed (HTTP ${res.status})`);
    }

    return data;
  }, []);

  const aiAssistant = useAiWriting({
    settings,
    parseJsonResponse,
  });

  const handleAiGenerate = React.useCallback(() => {
    if (!item) return;
    void aiAssistant.onGenerate({
      title: item.title || '',
      content: item.content || '',
    });
  }, [aiAssistant.onGenerate, item]);

  const handleAiCheckRequest = React.useCallback(() => {
    if (!item) return;
    void aiAssistant.onCheck({
      content: item.content || '',
    });
  }, [aiAssistant.onCheck, item]);

  const handleApplyAiAppend = React.useCallback(() => {
    if (!aiAssistant.pendingResult) return;

    setItem((prev) => {
      if (!prev) return null;
      const currentContent = prev.content || '';
      const nextContent =
        currentContent.trim() && aiAssistant.pendingResult?.html.trim()
          ? `${currentContent}\n${aiAssistant.pendingResult.html}`
          : `${currentContent}${aiAssistant.pendingResult?.html || ''}`;
      return { ...prev, content: nextContent };
    });

    aiAssistant.clearPendingResult();
    setEditorContentRevision((revision) => revision + 1);
    notify.success('AI draft appended to the article.');
  }, [aiAssistant.clearPendingResult, aiAssistant.pendingResult]);

  const handleApplyAiReplace = React.useCallback(() => {
    if (!aiAssistant.pendingResult) return;

    setItem((prev) =>
      prev ? { ...prev, content: aiAssistant.pendingResult?.html || prev.content } : null
    );
    setEditorContentRevision((revision) => revision + 1);
    notify.success(
      aiAssistant.pendingResult.mode === 'check'
        ? 'AI-reviewed copy applied.'
        : 'AI draft replaced the current article body.'
    );
    aiAssistant.clearPendingResult();
  }, [aiAssistant.clearPendingResult, aiAssistant.pendingResult]);

  const handleDiscardAiResult = React.useCallback(() => {
    aiAssistant.clearPendingResult();
    notify.success('AI draft discarded.');
  }, [aiAssistant.clearPendingResult]);

  const loadAuditLogs = React.useCallback(
    async (contentId: string, pageMode: boolean) => {
      if (!contentId) {
        setAuditLogs([]);
        return;
      }

      setIsAuditLogsLoading(true);
      try {
        const params = new URLSearchParams({
          id: String(contentId),
          type: pageMode ? 'page' : 'post',
        });
        const res = await vonFetch(`${API.contentAuditLogs}?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
        });

        const data = await parseJsonResponse(res, 'Edit history');
        setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch (err) {
        console.error('Failed to load edit history:', err);
        setAuditLogs([]);
      } finally {
        setIsAuditLogsLoading(false);
      }
    },
    [parseJsonResponse]
  );

  useEffect(() => {
    if (!item?.id) {
      setAuditLogs([]);
      setIsAuditLogsLoading(false);
      return;
    }

    void loadAuditLogs(String(item.id), isPage);
  }, [item?.id, isPage, loadAuditLogs]);

  // Helper for Robust Text Extraction (Double Decode)
  const getCleanText = (html: string, limit?: number) => {
    if (!html) return '';
    // 1. Spacing Fixes
    const rawHtml = html.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|h\d|li|tr|ul|ol)>/gi, ' ');

    // 2. Decode Entities (Pass 1)
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    let text = doc.body.textContent || '';

    // 3. Double Decode (Pass 2) - Catches stubborn double-encoded entities like &amp;#039;
    if (text.match(/&[#a-zA-Z0-9]+;/)) {
      const doc2 = new DOMParser().parseFromString(text, 'text/html');
      text = doc2.body.textContent || text;
    }

    // 4. Cleanup Whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // 5. Truncate if needed (account for ellipsis)
    if (limit && text.length > limit) {
      return text.slice(0, limit - 3) + '...';
    }
    return text;
  };

  const formatAuditActor = (log: ContentAuditLog) => {
    const actorName = (log.actorUsername || '').trim() || 'System';
    const actorRole = (log.actorRole || '').trim();
    return actorRole ? `${actorName} (${actorRole})` : actorName;
  };

  const formatAuditTimestamp = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  const loadFeaturedMedia = async (page = 1) => {
    setIsFeaturedLibraryLoading(true);
    try {
      const res = await vonFetch(`${API.listMedia}?page=${page}&limit=18`);
      const data = await res.json();

      if (data.success) {
        setFeaturedMediaFiles(data.files || []);
        setFeaturedMediaPage(data.currentPage || page);
        setFeaturedMediaTotalPages(data.totalPages || 1);
      } else {
        notify.error(data.message || 'Failed to load media library');
      }
    } catch (error: any) {
      notify.error('Failed to load media library');
    } finally {
      setIsFeaturedLibraryLoading(false);
    }
  };

  const openFeaturedLibrary = () => {
    setIsFeaturedLibraryOpen(true);
    void loadFeaturedMedia(1);
  };

  const applyFeaturedImage = (url?: string) => {
    if (!url) return;
    setItem((prev) => (prev ? { ...prev, image: url } : null));
    setIsFeaturedLibraryOpen(false);
    notify.success('Featured image updated!');
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await vonFetch(API.uploadFile, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success && (data.webpUrl || data.url)) {
        applyFeaturedImage(data.webpUrl || data.url);
      } else {
        notify.error('Upload failed: ' + (data.error || data.message || 'Unknown error'));
      }
    } catch (error: any) {
      notify.error('Upload failed: ' + (error?.message || 'Unknown error'));
    } finally {
      e.target.value = '';
    }
  };

  if (!item) return null;

  const latestAuditLog = auditLogs[0] || null;
  const recentAuditLogs = auditLogs.slice(0, 3);
  const saveStatusLabel = buildSaveStatusLabel(saveStatus, lastSaved, autoSaveCountdown);
  const saveStatusClassName = getSaveStatusClassName(saveStatus);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {item.id ? 'Edit' : 'Create'} {isPage ? 'Page' : 'Post'}
            </h2>
            <p className={saveStatusClassName}>{saveStatusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg transition-all shadow-md font-medium disabled:opacity-50"
          >
            <CheckCircle size={16} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'Saving draft...' : 'Save Draft'}</span>
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="sm:hidden p-2 bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg transition-all shadow-md font-medium disabled:opacity-50"
            title={isSaving ? 'Saving draft...' : 'Save Draft'}
          >
            <CheckCircle size={18} className={isSaving ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              const finalStatus = item.status === 'scheduled' ? 'scheduled' : 'published';
              handleSave(finalStatus);
            }}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2 ${item.status === 'scheduled' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'} text-white rounded-lg transition-colors shadow-lg font-medium disabled:opacity-70`}
          >
            <Globe size={18} className={isSaving ? 'animate-spin' : ''} />
            <span>
              {isSaving
                ? 'Saving...'
                : item.status === 'scheduled'
                  ? 'Schedule'
                  : item.status === 'published'
                    ? 'Update'
                    : 'Publish'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36]">
            <input
              id="post-title"
              name="title"
              aria-label={isPage ? 'Page title' : 'Post title'}
              type="text"
              placeholder="Enter title here..."
              className="w-full text-3xl font-bold bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-300 dark:placeholder-slate-600 text-slate-900 dark:text-white rounded-lg px-2 py-1 -mx-2 -my-1 transition-all duration-200"
              value={item.title || ''}
              onChange={handleTitleChange}
            />
          </div>
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-md border border-slate-200 dark:border-[#2a2b36] flex flex-col">
            <Editor
              key={item.id || 'new-post'}
              initialContent={item.content || ''}
              contentRevision={editorContentRevision}
              onChange={handleEditorChange}
              onImmediateChange={handleEditorImmediateChange}
              onImageClick={handleEditorImageClick}
            />
          </div>
        </div>

        <div className="space-y-6">
          <AiWritingPanel
            title={item.title || ''}
            hasContent={Boolean(getCleanText(item.content || ''))}
            mode={aiAssistant.mode}
            writePrompt={aiAssistant.writePrompt}
            pendingResult={aiAssistant.pendingResult}
            isGenerating={aiAssistant.isGenerating}
            isChecking={aiAssistant.isChecking}
            isSaving={isSaving}
            onModeChange={aiAssistant.setMode}
            onWritePromptChange={aiAssistant.setWritePrompt}
            onGenerate={handleAiGenerate}
            onCheck={handleAiCheckRequest}
            onApplyAppend={handleApplyAiAppend}
            onApplyReplace={handleApplyAiReplace}
            onDiscard={handleDiscardAiResult}
          />
          <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-xl border border-slate-200 dark:border-[#2a2b36] shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Publishing</h3>
            <div>
              <label
                htmlFor="post-status"
                className="block text-xs font-medium text-slate-500 mb-1.5"
              >
                Status
              </label>
              <select
                id="post-status"
                name="status"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                value={item.status || 'draft'}
                onChange={(e) => {
                  const newStatus = e.target.value as any;
                  // Safety: Prevent rescheduling already published posts to protect SEO
                  if (
                    initialItem &&
                    initialItem.status === 'published' &&
                    newStatus === 'scheduled'
                  ) {
                    notify.error('Cannot schedule an already published post (SEO Safety).');
                    return;
                  }
                  setItem((prev) => (prev ? { ...prev, status: newStatus } : null));
                }}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                {!isPage && <option value="scheduled">Scheduled</option>}
              </select>
            </div>
            {!isPage && item.status === 'scheduled' && (
              <div className="space-y-2">
                <label
                  htmlFor="post-publish-date"
                  className="block text-sm font-medium text-slate-500"
                >
                  Publish Date & Time
                </label>
                <input
                  id="post-publish-date"
                  name="scheduledAt"
                  type="datetime-local"
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                  value={normalizeScheduledInputValue((item as Post).scheduledAt)}
                  onChange={(e) =>
                    setItem((prev) => (prev ? { ...prev, scheduledAt: e.target.value } : null))
                  }
                />
                <button
                  onClick={() => {
                    if (!(item as Post).scheduledAt) {
                      notify.info('Please pick a date and time first.');
                      return;
                    }
                    handleSave('scheduled');
                  }}
                  disabled={isSaving}
                  className="w-full py-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-lg font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Activity size={16} />
                  <span>{isSaving ? 'Locking...' : 'Set Schedule Now'}</span>
                </button>
                {(item as Post).scheduledAt && (
                  <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      Target: {formatScheduledTarget((item as Post).scheduledAt)}
                    </span>
                    <button
                      onClick={() =>
                        setItem((prev) =>
                          prev ? { ...prev, status: 'draft', scheduledAt: '' } : null
                        )
                      }
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400">Post will auto-publish at this time</p>
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="post-slug" className="block text-sm font-medium text-slate-500">
                  Slug
                </label>
                <button
                  onClick={() => {
                    if (!item.title) {
                      notify.info('Enter a title first');
                      return;
                    }
                    // Use helper for clean text
                    const cleanTitle = getCleanText(item.title);
                    const slug = cleanTitle
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                      .replace(/\s+/g, '-') // Spaces to hyphens
                      .replace(/-+/g, '-') // Multiple hyphens to single
                      .replace(/^-|-$/g, ''); // Trim hyphens
                    setItem((prev) => (prev ? { ...prev, slug } : null));
                  }}
                  className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 font-bold bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full transition-colors"
                >
                  <Sparkles size={12} /> Auto Generate
                </button>
              </div>
              <input
                id="post-slug"
                name="slug"
                type="text"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                placeholder="url-friendly-slug"
                value={item.slug || ''}
                onChange={(e) =>
                  setItem((prev) => (prev ? { ...prev, slug: e.target.value } : null))
                }
              />
            </div>
            {!isPage && (
              <div>
                <label
                  htmlFor="post-category-select"
                  className="block text-sm font-medium text-slate-500 mb-1"
                >
                  Category
                </label>
                <div className="space-y-2">
                  <select
                    id="post-category-select"
                    name="categoryPreset"
                    aria-label="Choose existing category"
                    value={
                      availableCategories.includes((item as Post).category || '')
                        ? (item as Post).category || 'Uncategorized'
                        : '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value === '__custom__') return;
                      setItem((prev) => (prev ? { ...prev, category: e.target.value } : null));
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-900 dark:text-slate-100 text-sm"
                  >
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="__custom__">Custom category...</option>
                  </select>
                  <input
                    id="post-category"
                    name="category"
                    aria-label="Custom category"
                    type="text"
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                    value={(item as Post).category || ''}
                    placeholder="Uncategorized"
                    onChange={(e) =>
                      setItem((prev) => (prev ? { ...prev, category: e.target.value } : null))
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Pick an existing category or type a new one. Empty values still save as{' '}
                  Uncategorized.
                </p>
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="post-excerpt" className="block text-sm font-medium text-slate-500">
                  Excerpt
                </label>
                <button
                  onClick={() => {
                    if (item.content) {
                      // Robust Auto Fill with Double Decoding (Excerpt can be longer for UI feeds)
                      const excerpt = getCleanText(item.content, 250);
                      setItem((prev) => (prev ? { ...prev, excerpt } : null));
                    } else {
                      notify.info('Add content first');
                    }
                  }}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full transition-colors"
                >
                  <Sparkles size={12} /> Auto Fill
                </button>
              </div>
              <textarea
                id="post-excerpt"
                name="excerpt"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 h-24"
                value={item.excerpt || ''}
                onChange={(e) =>
                  setItem((prev) => (prev ? { ...prev, excerpt: e.target.value } : null))
                }
                placeholder="Short summary of the post..."
              />
            </div>

            {/* Featured Image - For Posts Only */}
            {!isPage && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="post-image" className="block text-sm font-medium text-slate-500">
                    Featured Image
                  </label>
                  <button
                    onClick={() => {
                      // Clear image so backend auto-detects from content
                      setItem((prev) => (prev ? { ...prev, image: '' } : null));
                      notify.success('Featured image cleared. Will auto-detect on save.');
                    }}
                    className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-700 font-bold bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full transition-colors"
                  >
                    <Sparkles size={12} /> Refresh from Content
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => featuredImageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Upload size={16} />
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={openFeaturedLibrary}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#242633] transition-colors text-sm font-medium"
                  >
                    <Images size={16} />
                    Browse Media Gallery
                  </button>
                  <input
                    ref={featuredImageInputRef}
                    id="featured-image-upload"
                    name="featuredImageUpload"
                    aria-label="Upload featured image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFeaturedImageUpload}
                  />
                </div>
                <input
                  id="post-image"
                  name="image"
                  aria-label="Featured image URL"
                  type="text"
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                  placeholder="Paste image URL if needed..."
                  value={(item as Post).image || ''}
                  onChange={(e) =>
                    setItem((prev) => (prev ? { ...prev, image: e.target.value } : null))
                  }
                />
                {(item as Post).image && (
                  <div className="mt-2 relative group">
                    <img
                      src={normalizeImageSource((item as Post).image)}
                      alt="Featured"
                      className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-[#2a2b36]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      onClick={() => setItem((prev) => (prev ? { ...prev, image: '' } : null))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Toggle */}
            {isPage && (
              <div className="pt-4 border-t border-slate-100 dark:border-[#2a2b36]">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${addToMenu ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-[#16161e] border-slate-300 dark:border-[#333544]'}`}
                  >
                    {addToMenu && <Globe size={12} />}
                  </div>
                  <input
                    id="post-add-menu"
                    name="addToMenu"
                    type="checkbox"
                    checked={addToMenu}
                    onChange={(e) => setAddToMenu(e.target.checked)}
                    className="hidden"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-600 transition-colors">
                    Add to Navigation Menu
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="bg-slate-50/50 dark:bg-[#1a1b26]/50 p-5 rounded-xl border border-slate-200 dark:border-[#2a2b36] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                Edit Log
              </h3>
              {!!item.id && auditLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAuditHistoryOpen(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View Recent History
                </button>
              )}
            </div>

            {!item.id ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Edit history will start after the first successful save.
              </p>
            ) : isAuditLogsLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading edit history...</p>
            ) : latestAuditLog ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/60 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {latestAuditLog.summary || 'Content updated'}
                  </p>
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p className="flex items-center gap-2">
                      <User size={14} />
                      <span>{formatAuditActor(latestAuditLog)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 size={14} />
                      <span>{formatAuditTimestamp(latestAuditLog.createdAt)}</span>
                    </p>
                  </div>
                </div>

                {recentAuditLogs.length > 1 && (
                  <div className="space-y-2">
                    {recentAuditLogs.slice(1).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-200 dark:border-[#2a2b36] p-3"
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {log.summary || 'Content updated'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatAuditActor(log)} - {formatAuditTimestamp(log.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No edit history found yet for this item.
              </p>
            )}
          </div>

          {/* SEO Settings */}
          <div className="bg-white dark:bg-[#1a1b26] p-5 rounded-xl border border-slate-200 dark:border-[#2a2b36] shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-500">●</span> SEO Settings
            </h3>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="post-meta-desc"
                  className="block text-sm font-medium text-slate-500"
                >
                  Meta Description
                </label>
                <button
                  onClick={() => {
                    // Always extract directly from content for accurate 160-char SEO limits, avoiding the longer excerpt
                    const description = item.content ? getCleanText(item.content, 160) : '';
                    if (description) {
                      setItem((prev) => (prev ? { ...prev, metaDescription: description } : null));
                    } else {
                      notify.info('Add content first');
                    }
                  }}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full transition-colors"
                >
                  <Sparkles size={12} /> Auto Fill
                </button>
              </div>
              <textarea
                id="post-meta-desc"
                name="metaDescription"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 h-24 text-sm"
                placeholder="Brief summary for search engines (max 160 chars)..."
                value={item.metaDescription || ''}
                onChange={(e) =>
                  setItem((prev) => (prev ? { ...prev, metaDescription: e.target.value } : null))
                }
                maxLength={160}
              />
              <p className="text-xs text-slate-400 mt-1">
                {(item.metaDescription || '').length}/160 characters
              </p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="post-keywords" className="block text-sm font-medium text-slate-500">
                  Keywords
                </label>
                <button
                  onClick={() => {
                    if (!item.content && !item.title) return;
                    // Improved keyword extraction from utility (Prioritizes Title)
                    const plainText = htmlToPlainText(item.content);
                    const sorted = extractKeywords(plainText, item.title || '').join(', ');
                    setItem((prev) => (prev ? { ...prev, keywords: sorted } : null));
                  }}
                  className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-bold bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full transition-colors"
                >
                  <Sparkles size={12} />
                  Auto-Generate
                </button>
              </div>
              <input
                id="post-keywords"
                name="keywords"
                type="text"
                placeholder="comma, separated, keywords"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm"
                value={item.keywords || ''}
                onChange={(e) =>
                  setItem((prev) => (prev ? { ...prev, keywords: e.target.value } : null))
                }
              />
            </div>

            {/* Real-time SEO Analysis Panel */}
            {isSeoRestoring && (
              <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden animate-fade-in mt-6">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2a2b36] flex items-center gap-2">
                  <Activity size={16} className="text-blue-500 animate-pulse" />
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">SEO Health</h3>
                </div>
                <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
                  Restoring SEO data from the full post content...
                </div>
              </div>
            )}
            {seoResult && !isSeoRestoring && (
              <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] overflow-hidden animate-fade-in mt-6">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                    <Activity size={16} className="text-blue-500" />
                    SEO Health
                  </h3>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                      seoResult.score >= 80
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : seoResult.score >= 50
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                    }`}
                  >
                    <span className="text-lg">{seoResult.score}</span>
                    <span className="opacity-60 text-xs font-medium">/ 100</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Optimization</span>
                      <span>{seoResult.score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-[#242633] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          seoResult.score >= 80
                            ? 'bg-green-500'
                            : seoResult.score >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${seoResult.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {Object.entries(seoResult.checks).map(([key, check]: [string, any]) => (
                      <div key={key} className="flex items-start gap-2.5 py-1.5">
                        <div className="mt-0.5 flex-shrink-0">
                          {check.status === 'good' ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : check.status === 'warning' ? (
                            <AlertTriangle size={14} className="text-amber-500" />
                          ) : (
                            <AlertCircle size={14} className="text-red-500" />
                          )}
                        </div>
                        <p
                          className={`text-xs leading-snug ${
                            check.status === 'good'
                              ? 'text-slate-600 dark:text-slate-400'
                              : check.status === 'warning'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {check.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAuditHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2a2b36] px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent Edit History
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Latest 50 create, update, and delete entries for this {isPage ? 'page' : 'post'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditHistoryOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {isAuditLogsLoading ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  Loading edit history...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  No edit history found for this item.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 dark:border-[#2a2b36] p-4"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {log.summary || 'Content updated'}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <p className="flex items-center gap-2">
                          <User size={14} />
                          <span>{formatAuditActor(log)}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock3 size={14} />
                          <span>{formatAuditTimestamp(log.createdAt)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isPage && isFeaturedLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-[#2a2b36] bg-white dark:bg-[#16161e] shadow-2xl overflow-hidden">
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
                onClick={() => setIsFeaturedLibraryOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a1b26]"
                aria-label="Close media gallery"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {isFeaturedLibraryLoading ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  Loading media library...
                </div>
              ) : featuredMediaFiles.length === 0 ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  No media files found.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {featuredMediaFiles.map((file) => {
                    const previewUrl = file.webpUrl || file.url;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => applyFeaturedImage(previewUrl)}
                        className="group overflow-hidden rounded-xl border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#1a1b26] text-left transition-all hover:border-blue-500 hover:shadow-lg"
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-[#16161e]">
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
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {file.size}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-[#2a2b36] px-5 py-4">
              <button
                type="button"
                onClick={() => void loadFeaturedMedia(featuredMediaPage - 1)}
                disabled={isFeaturedLibraryLoading || featuredMediaPage <= 1}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {featuredMediaPage} of {featuredMediaTotalPages}
              </span>
              <button
                type="button"
                onClick={() => void loadFeaturedMedia(featuredMediaPage + 1)}
                disabled={isFeaturedLibraryLoading || featuredMediaPage >= featuredMediaTotalPages}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostEditor;
