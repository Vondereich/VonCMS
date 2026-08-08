import React, { useState, useEffect } from 'react';
import notify from '../utils/toast';
import { Post, Page, MediaItem, ContentAuditLog } from '../types';
import Editor from './Editor';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { getAuthHeader } from '../config/auth.config';
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  FileText,
  Globe,
  Images,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { sanitizeHTML, trimTrailingHtml } from '../utils/colorSanitizer';
import { htmlToPlainText, sanitizeEditorHtml } from '../utils/security';
import { analyzeSEO, SEOAnalysisResult } from '../utils/seoAnalyzer';
import { SafeImage } from './SafeImage';
import AiWritingPanel from './editor/AiWritingPanel';
import FeaturedMediaLibraryModal from './editor/FeaturedMediaLibraryModal';
import { PostEditorAuditHistoryModal, PostEditorAuditSummary } from './editor/PostEditorAudit';
import PostEditorSeoPanel from './editor/PostEditorSeoPanel';
import { getPostEditorCleanText } from './editor/postEditorTextHelpers';
import { useAiWriting } from '../hooks/useAiWriting';
import {
  AUTOSAVE_INTERVAL_MS,
  SAVE_CONFLICT_MESSAGE,
  buildAutoSaveCandidate,
  hasUnsavedEditorChanges,
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
  onDirtyChange?: (isDirty: boolean) => void;
  settings?: any; // Added settings prop
}

const TITLE_MAX_LENGTH = 255;
const EXCERPT_RECOMMENDED_MAX_LENGTH = 200;
const EXCERPT_WARNING_LENGTH = 220;
type MobileEditorPanel = 'write' | 'publish' | 'ai';

const PostEditor: React.FC<PostEditorProps> = ({
  initialItem,
  isPage,
  navigation = [],
  posts = [],
  onSave,
  onBack,
  onDirtyChange,
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
  const [featuredMediaSearchInput, setFeaturedMediaSearchInput] = useState('');
  const [featuredMediaSearchQuery, setFeaturedMediaSearchQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState<ContentAuditLog[]>([]);
  const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobileEditorPanel>('write');
  const featuredImageInputRef = React.useRef<HTMLInputElement>(null);
  const initialAddToMenuRef = React.useRef(false);
  const titleLength = item?.title?.length || 0;
  const titleLimitHelpText = `Title is limited to ${TITLE_MAX_LENGTH} characters.`;
  const excerptLength = item?.excerpt?.length || 0;

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
    const isInNavigation = navigation.some((n) => n.url === url);
    initialAddToMenuRef.current = isInNavigation;
    setAddToMenu(isInNavigation);
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

  useEffect(() => {
    onDirtyChange?.(
      hasUnsavedEditorChanges(
        item,
        initialItemRef.current,
        contentRef.current,
        addToMenu,
        initialAddToMenuRef.current
      )
    );
  }, [addToMenu, item, onDirtyChange]);

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

  const handleEditorImmediateChange = React.useCallback(
    (html: string) => {
      contentRef.current = html;
      const liveItem = itemRef.current ? { ...itemRef.current, content: html } : null;
      itemRef.current = liveItem;
      onDirtyChange?.(
        hasUnsavedEditorChanges(
          liveItem,
          initialItemRef.current,
          html,
          addToMenu,
          initialAddToMenuRef.current
        )
      );
    },
    [addToMenu, onDirtyChange]
  );

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
      initialAddToMenuRef.current = addToMenu;
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
      onDirtyChange?.(false);
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

  const loadFeaturedMedia = async (page = 1, search = featuredMediaSearchQuery) => {
    setIsFeaturedLibraryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '18' });
      if (search) params.set('search', search);
      const res = await vonFetch(`${API.listMedia}?${params.toString()}`);
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
    void loadFeaturedMedia(1, featuredMediaSearchQuery);
  };

  const handleFeaturedMediaSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSearch = featuredMediaSearchInput.trim().slice(0, 120);
    setFeaturedMediaSearchQuery(normalizedSearch);
    void loadFeaturedMedia(1, normalizedSearch);
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

  const saveStatusLabel = buildSaveStatusLabel(saveStatus, lastSaved, autoSaveCountdown);
  const saveStatusClassName = getSaveStatusClassName(saveStatus);
  const publishingChecks = [
    { label: 'Title', ready: Boolean(item.title?.trim()) },
    { label: 'Content', ready: Boolean(getPostEditorCleanText(item.content || '')) },
    ...(!isPage
      ? [
          {
            label: 'Schedule',
            ready: item.status !== 'scheduled' || Boolean((item as Post).scheduledAt),
          },
        ]
      : []),
  ];
  const completedPublishingChecks = publishingChecks.filter((check) => check.ready).length;
  const publishActionLabel =
    item.status === 'scheduled' ? 'Schedule' : item.status === 'published' ? 'Update' : 'Publish';
  const handlePrimaryPublish = () => {
    const finalStatus = item.status === 'scheduled' ? 'scheduled' : 'published';
    void handleSave(finalStatus);
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in sm:space-y-6 xl:pb-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-[#1a1b26]"
            aria-label={`Back to ${isPage ? 'pages' : 'posts'}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">
              {item.id ? 'Edit' : 'Create'} {isPage ? 'Page' : 'Post'}
            </h2>
            <p className={`${saveStatusClassName} truncate`}>{saveStatusLabel}</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 xl:flex">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg transition-all shadow-md font-medium disabled:opacity-50"
          >
            <CheckCircle size={16} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'Saving draft...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSave('draft')}
            disabled={isSaving}
            className="sm:hidden p-2 bg-white dark:bg-[#1a1b26] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633] rounded-lg transition-all shadow-md font-medium disabled:opacity-50"
            title={isSaving ? 'Saving draft...' : 'Save Draft'}
          >
            <CheckCircle size={18} className={isSaving ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handlePrimaryPublish}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2 ${item.status === 'scheduled' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'} text-white rounded-lg transition-colors shadow-lg font-medium disabled:opacity-70`}
          >
            <Globe size={18} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'Saving...' : publishActionLabel}</span>
          </button>
        </div>
      </div>

      <div
        className="sticky top-0 z-30 -mx-3 flex overflow-x-auto border-y border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-xl dark:border-[#2a2b36] dark:bg-[#16161e]/95 sm:-mx-4 sm:px-4 xl:hidden"
        aria-label="Editor sections"
      >
        {(
          [
            { id: 'write', label: 'Write', icon: <FileText size={17} /> },
            {
              id: 'publish',
              label: 'Publish & SEO',
              icon: <Globe size={17} />,
              badge:
                completedPublishingChecks < publishingChecks.length
                  ? publishingChecks.length - completedPublishingChecks
                  : undefined,
            },
            { id: 'ai', label: 'AI', icon: <Sparkles size={17} /> },
          ] as const
        ).map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => setMobilePanel(panel.id)}
            aria-pressed={mobilePanel === panel.id}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
              mobilePanel === panel.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#242633]'
            }`}
          >
            {panel.icon}
            {panel.label}
            {'badge' in panel && panel.badge ? (
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                  mobilePanel === panel.id
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {panel.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3 xl:gap-8">
        <div
          className={`${mobilePanel === 'write' ? 'block' : 'hidden'} min-w-0 space-y-4 sm:space-y-6 xl:col-span-2 xl:block`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:p-6">
            <input
              id="post-title"
              name="title"
              aria-label={isPage ? 'Page title' : 'Post title'}
              type="text"
              maxLength={TITLE_MAX_LENGTH}
              placeholder="Enter title here..."
              className="w-full rounded-lg border-none bg-transparent px-2 py-1 -mx-2 -my-1 text-2xl font-bold text-slate-900 placeholder-slate-300 transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white dark:placeholder-slate-600 sm:text-3xl"
              value={item.title || ''}
              onChange={handleTitleChange}
            />
            <p
              className={`mt-2 text-xs ${
                titleLength >= TITLE_MAX_LENGTH
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {titleLength}/{TITLE_MAX_LENGTH} characters. {titleLimitHelpText}
            </p>
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

        <div className="min-w-0 space-y-6">
          <div className={`${mobilePanel === 'ai' ? 'block' : 'hidden'} xl:block`}>
            <AiWritingPanel
              title={item.title || ''}
              hasContent={Boolean(getPostEditorCleanText(item.content || ''))}
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
          </div>
          <div
            className={`${mobilePanel === 'publish' ? 'space-y-6' : 'hidden'} xl:block xl:space-y-6`}
          >
            <div className="bg-white dark:bg-[#1a1b26] p-6 rounded-xl border border-slate-200 dark:border-[#2a2b36] shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Publishing</h3>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2b36] dark:bg-[#16161e]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Publish readiness
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {completedPublishingChecks}/{publishingChecks.length}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {publishingChecks.map((check) => (
                    <span
                      key={check.label}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        check.ready
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}
                    >
                      {check.ready ? 'Ready' : 'Needs'} {check.label}
                    </span>
                  ))}
                </div>
              </div>
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
                    const newStatus = e.target.value as Post['status'];
                    // Safety: Prevent rescheduling already published posts to protect SEO
                    if (
                      initialItem &&
                      initialItem.status === 'published' &&
                      newStatus === 'scheduled'
                    ) {
                      notify.error('Cannot schedule an already published post (SEO Safety).');
                      return;
                    }
                    setItem((prev) => {
                      if (!prev) return null;
                      return isPage
                        ? ({ ...prev, status: newStatus as Page['status'] } as Page)
                        : ({ ...prev, status: newStatus } as Post);
                    });
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
                      const cleanTitle = getPostEditorCleanText(item.title);
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
                  <label
                    htmlFor="post-excerpt"
                    className="block text-sm font-medium text-slate-500"
                  >
                    Excerpt
                  </label>
                  <button
                    onClick={() => {
                      if (item.content) {
                        const excerpt = getPostEditorCleanText(
                          item.content,
                          EXCERPT_RECOMMENDED_MAX_LENGTH
                        );
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
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 h-24 text-sm"
                  value={item.excerpt || ''}
                  onChange={(e) =>
                    setItem((prev) => (prev ? { ...prev, excerpt: e.target.value } : null))
                  }
                  placeholder="Short summary (recommended 160-200 characters)..."
                  aria-describedby="post-excerpt-help"
                />
                <p
                  id="post-excerpt-help"
                  className={`mt-1 text-xs ${
                    excerptLength > EXCERPT_WARNING_LENGTH
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {excerptLength}/{EXCERPT_WARNING_LENGTH} characters - recommended 160-200.
                  {excerptLength > EXCERPT_WARNING_LENGTH
                    ? ' Long excerpts may be shortened in cards and discovery metadata.'
                    : ''}
                </p>
              </div>

              {/* Featured Image - For Posts Only */}
              {!isPage && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label
                      htmlFor="post-image"
                      className="block text-sm font-medium text-slate-500"
                    >
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
                      <SafeImage
                        src={(item as Post).image}
                        alt="Featured"
                        className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-[#2a2b36]"
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
                      className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-colors ${addToMenu ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-[#16161e] border-slate-300 dark:border-[#333544]'}`}
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

            <PostEditorAuditSummary
              itemId={item.id}
              logs={auditLogs}
              isLoading={isAuditLogsLoading}
              onOpenHistory={() => setIsAuditHistoryOpen(true)}
            />

            <PostEditorSeoPanel
              item={item}
              setItem={setItem}
              isRestoring={isSeoRestoring}
              result={seoResult}
            />
          </div>
        </div>
      </div>

      <div className="admin-safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 pt-3 shadow-[0_-12px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-[#2a2b36] dark:bg-[#16161e]/95 xl:hidden">
        <button
          type="button"
          onClick={() => void handleSave('draft')}
          disabled={isSaving}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-[#2a2b36] dark:bg-[#1a1b26] dark:text-slate-200 dark:hover:bg-[#242633]"
        >
          <CheckCircle size={17} className={isSaving ? 'animate-spin' : ''} />
          Draft
        </button>
        <button
          type="button"
          onClick={handlePrimaryPublish}
          disabled={isSaving}
          className={`flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-lg transition-colors disabled:opacity-70 ${
            item.status === 'scheduled'
              ? 'bg-amber-500 shadow-amber-500/25 hover:bg-amber-600'
              : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-700'
          }`}
        >
          <Globe size={18} className={isSaving ? 'animate-spin' : ''} />
          {isSaving ? 'Saving...' : publishActionLabel}
        </button>
      </div>

      <PostEditorAuditHistoryModal
        isOpen={isAuditHistoryOpen}
        isPage={isPage}
        logs={auditLogs}
        isLoading={isAuditLogsLoading}
        onClose={() => setIsAuditHistoryOpen(false)}
      />

      {!isPage && (
        <FeaturedMediaLibraryModal
          isOpen={isFeaturedLibraryOpen}
          files={featuredMediaFiles}
          isLoading={isFeaturedLibraryLoading}
          page={featuredMediaPage}
          totalPages={featuredMediaTotalPages}
          searchInput={featuredMediaSearchInput}
          onSearchInputChange={setFeaturedMediaSearchInput}
          onSearch={handleFeaturedMediaSearch}
          onSelect={applyFeaturedImage}
          onPageChange={(page) => void loadFeaturedMedia(page, featuredMediaSearchQuery)}
          onClose={() => setIsFeaturedLibraryOpen(false)}
        />
      )}
    </div>
  );
};

export default PostEditor;
