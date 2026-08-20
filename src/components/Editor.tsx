import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import notify from '../utils/toast';
import {
  Bold,
  Italic,
  Underline,
  Link,
  List,
  Image,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Upload,
  Undo,
  Redo,
  Palette,
  ListOrdered,
  Minus,
  Table,
  Video,
  AlignJustify,
  Images,
  X,
  CheckCircle,
  Sparkles,
  ChevronDown,
  Eye,
  Braces,
  Search,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import type { MediaItem } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { DarkModeStyles } from '../styles/DarkModeStyles';
import SmartPagination from './SmartPagination';
import AdminModal from './admin/AdminModal';
import { sanitizeHTML } from '../utils/colorSanitizer';
import { sanitizeEditorHtml, sanitizePastedHtml } from '../utils/security';
import {
  EDITOR_EXTENSIONS,
  EDITOR_SURFACE_CLASS,
  buildFigureAlignmentStyle,
  buildImageAlignmentStyle,
  buildImageUpdateBaseStyle,
  buildImageWidthStyle,
  inferImageAlignment,
  inferImageSize,
  type ImageSize,
  type LegacyImageAttrs,
  type LegacyImageMatch,
  type MediaAlignment,
} from './editor/editorExtensions';
import { buildEditorLinkAttrs, normalizeEditorUrl } from './editor/editorLinkUtils';
import { normalizeImageSource } from '../utils/siteUtils';
import {
  TABLE_MAX_DIMENSION,
  TABLE_MIN_DIMENSION,
  canGrowEditorTableDimension,
  getEditorTableColumnCount,
  type TableCommand,
} from './editor/editorTableUtils';
import { Divider, ToolButton } from './editor/EditorToolbarPrimitives';
import { buildEditorImageHtml, type EditorImageInput } from './editor/editorImageUtils';
import { buildEditorVideoEmbedHtml, inferVideoAspectMode } from './editor/editorVideoUtils';
import type { VideoAspectMode } from './editor/editorVideoContracts';
import { EditorPreviewModal } from './editor/EditorPreviewModal';

interface EditorProps {
  initialContent: string;
  contentRevision?: number;
  onChange: (content: string) => void;
  onImmediateChange?: (content: string) => void;
  onImageClick?: (src: string) => void;
}

const Editor: React.FC<EditorProps> = ({
  initialContent,
  contentRevision = 0,
  onChange,
  onImmediateChange,
  onImageClick,
}) => {
  const editorShellRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarSentinelRef = useRef<HTMLDivElement>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isCodeView, setIsCodeView] = useState(false);
  const [htmlContent, setHtmlContent] = useState(initialContent || '');
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [compactToolbarPanel, setCompactToolbarPanel] = useState<'insert' | 'more' | null>(null);
  const [isToolbarElevated, setIsToolbarElevated] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEditorChangeRef = useRef<string | null>(null);
  const isInitialized = useRef(false);
  const lastAppliedInitialContent = useRef<string | null>(null);
  const lastAppliedContentRevision = useRef(contentRevision);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!isImageMenuOpen) return;

    const closeImageMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setIsImageMenuOpen(false);
        return;
      }

      if (imageMenuRef.current && !imageMenuRef.current.contains(event.target as Node)) {
        setIsImageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeImageMenu);
    document.addEventListener('keydown', closeImageMenu);
    return () => {
      document.removeEventListener('mousedown', closeImageMenu);
      document.removeEventListener('keydown', closeImageMenu);
    };
  }, [isImageMenuOpen]);

  useEffect(() => {
    const updateToolbarElevation = () => {
      const sentinel = toolbarSentinelRef.current;
      if (!sentinel) return;
      const nextElevated = sentinel.getBoundingClientRect().top < 1;
      setIsToolbarElevated((current) => (current === nextElevated ? current : nextElevated));
    };

    updateToolbarElevation();
    window.addEventListener('scroll', updateToolbarElevation, true);
    window.addEventListener('resize', updateToolbarElevation);

    return () => {
      window.removeEventListener('scroll', updateToolbarElevation, true);
      window.removeEventListener('resize', updateToolbarElevation);
    };
  }, []);

  // Media Library State
  const [mediaFiles, setMediaFiles] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaPagination, setMediaPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 32,
  });
  const [mediaSearchInput, setMediaSearchInput] = useState('');
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'link' | 'image' | 'video' | 'code' | 'table' | 'mediaLibrary' | null
  >(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');
  const [modalError, setModalError] = useState('');
  const mediaRequestIdRef = useRef(0);

  // Keep authored editor HTML inside the shared content allowlist.
  const cleanContent = (html: string) => {
    if (!html) return '';
    // SECURITY: Always sanitize content before it touches innerHTML
    return sanitizeEditorHtml(html);
  };

  const cancelPendingEditorChange = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingEditorChangeRef.current = null;
  };

  const flushPendingEditorChange = () => {
    const pendingContent = pendingEditorChangeRef.current;
    if (pendingContent === null) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pendingEditorChangeRef.current = null;
    onChange(pendingContent);
  };

  const queueChange = (content: string, syncHtmlMirror = true) => {
    if (syncHtmlMirror) {
      setHtmlContent(content);
    }

    onImmediateChange?.(content);
    pendingEditorChangeRef.current = content;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const pendingContent = pendingEditorChangeRef.current;
      timeoutRef.current = null;
      pendingEditorChangeRef.current = null;
      if (pendingContent !== null) {
        onChange(pendingContent);
      }
    }, 500);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: EDITOR_EXTENSIONS,
    content: cleanContent(initialContent || ''),
    editorProps: {
      attributes: {
        class: EDITOR_SURFACE_CLASS,
        spellcheck: 'true',
        'data-editor-surface': 'hourglass',
      },
      transformPastedHTML: (html) => sanitizePastedHtml(sanitizeHTML(html).cleanedHTML),
    },
    onUpdate: ({ editor: activeEditor }) => {
      const content = sanitizeEditorHtml(activeEditor.getHTML());
      queueChange(content);
    },
  });
  const activeBlockStyle =
    useEditorState({
      editor,
      selector: ({ editor: activeEditor }) => {
        if (!activeEditor) return 'p';

        const activeHeadingLevel = ([1, 2, 3, 4, 5, 6] as const).find((level) =>
          activeEditor.isActive('heading', { level })
        );
        return activeHeadingLevel ? `h${activeHeadingLevel}` : 'p';
      },
    }) ?? 'p';

  const getEditorRoot = () =>
    (editorRef.current?.querySelector('.tiptap, .ProseMirror') as HTMLDivElement | null) || null;

  const getCurrentEditorHtml = () => editor?.getHTML() || '';

  const insertSafeLink = (normalizedUrl: string) => {
    if (!editor) return;

    const linkAttrs = {
      ...buildEditorLinkAttrs(normalizedUrl),
      href: normalizedUrl,
    };
    const chain = editor.chain().focus();

    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: 'text',
          text: normalizedUrl,
          marks: [{ type: 'link', attrs: linkAttrs }],
        })
        .run();
      return;
    }

    chain.setLink(linkAttrs).run();
  };

  const refreshSelectedImage = (previousImage: HTMLImageElement | null) => {
    if (!previousImage) {
      setSelectedImage(null);
      return;
    }

    requestAnimationFrame(() => {
      const root = getEditorRoot();
      if (!root) {
        setSelectedImage(null);
        return;
      }

      const previousId = previousImage.getAttribute('data-id');
      const previousSrc = previousImage.getAttribute('src');
      const nextImage = Array.from(root.querySelectorAll('img')).find((candidate) => {
        const element = candidate as HTMLImageElement;
        if (previousId) {
          return element.getAttribute('data-id') === previousId;
        }

        return previousSrc ? element.getAttribute('src') === previousSrc : false;
      }) as HTMLImageElement | undefined;

      if (nextImage) {
        onImageClickInternal(nextImage);
      } else {
        setSelectedImage(null);
      }
    });
  };

  const getPrimaryVideoIframe = (embed: HTMLElement | null) =>
    !embed
      ? null
      : embed.tagName === 'IFRAME'
        ? (embed as HTMLIFrameElement)
        : (embed.querySelector('iframe') as HTMLIFrameElement | null);

  const refreshSelectedVideo = (previousEmbed: HTMLElement | null) => {
    const previousIframe = getPrimaryVideoIframe(previousEmbed);
    const previousSrc = previousIframe?.getAttribute('src');

    if (!previousSrc) {
      setSelectedVideoEmbed(null);
      return;
    }

    requestAnimationFrame(() => {
      const root = getEditorRoot();
      if (!root) {
        setSelectedVideoEmbed(null);
        return;
      }

      const nextIframe = Array.from(root.querySelectorAll('iframe')).find(
        (candidate) => candidate.getAttribute('src') === previousSrc
      ) as HTMLIFrameElement | undefined;

      if (nextIframe) {
        onVideoClickInternal(nextIframe);
      } else {
        setSelectedVideoEmbed(null);
      }
    });
  };

  const syncEditorFromDom = (options?: {
    refreshImage?: HTMLImageElement | null;
    refreshVideo?: HTMLElement | null;
    closeImage?: boolean;
    closeVideo?: boolean;
  }) => {
    if (!editor) return;

    const root = getEditorRoot();
    const domHtml = root?.innerHTML || getCurrentEditorHtml();
    const sanitized = sanitizeEditorHtml(domHtml);
    editor.commands.setContent(sanitized, { emitUpdate: false });
    queueChange(sanitized);

    if (options?.closeImage) {
      setSelectedImage(null);
    } else if (options?.refreshImage) {
      refreshSelectedImage(options.refreshImage);
    }

    if (options?.closeVideo) {
      setSelectedVideoEmbed(null);
    } else if (options?.refreshVideo) {
      refreshSelectedVideo(options.refreshVideo);
    }
  };

  const findLegacyImageMatch = (img: HTMLImageElement): LegacyImageMatch | null => {
    if (!editor) return null;

    const dataId = img.getAttribute('data-id') || '';
    const src = img.getAttribute('src') || '';
    const root = getEditorRoot();
    const targetOccurrence =
      root && root.contains(img)
        ? Array.from(root.querySelectorAll('img'))
            .filter((candidate) =>
              dataId
                ? candidate.getAttribute('data-id') === dataId
                : candidate.getAttribute('src') === src
            )
            .indexOf(img)
        : 0;
    const normalizedTargetOccurrence = Math.max(0, targetOccurrence);
    let seenOccurrence = 0;
    let match: LegacyImageMatch | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (match) return false;
      if (node.type.name !== 'legacyImage') return true;

      const attrs = node.attrs as LegacyImageAttrs;
      const matchesDataId = dataId && String(attrs['data-id'] || '') === dataId;
      const matchesSrc = !dataId && src && attrs.src === src;

      if (matchesDataId || matchesSrc) {
        if (seenOccurrence !== normalizedTargetOccurrence) {
          seenOccurrence += 1;
          return true;
        }

        match = { pos, attrs };
        return false;
      }

      return true;
    });

    return match;
  };

  const updateSelectedImageAttributes = (
    img: HTMLImageElement | null,
    buildAttrs: (attrs: LegacyImageAttrs) => Partial<LegacyImageAttrs>,
    options?: { closeImage?: boolean }
  ) => {
    if (!editor || !img) return false;

    const match = findLegacyImageMatch(img);
    if (!match) {
      setSelectedImage(null);
      return false;
    }

    const nextAttrs = buildAttrs(match.attrs);
    editor.chain().setNodeSelection(match.pos).updateAttributes('legacyImage', nextAttrs).run();

    if (options?.closeImage) {
      setSelectedImage(null);
    } else {
      refreshSelectedImage(img);
    }

    return true;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isCodeView) return;
    if (e.defaultPrevented) return;
    e.preventDefault();

    // Try to get HTML content first (preserves images, links, formatting)
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      // Clean foreign paste colors and background residue before the stricter paste allowlist.
      const pastedHtml = sanitizePastedHtml(sanitizeHTML(html).cleanedHTML);
      execCmd('insertHTML', pastedHtml);
    } else if (text) {
      execCmd('insertText', text);
    }
  };

  useEffect(() => {
    if (!editor) return;

    if (!isInitialized.current) {
      isInitialized.current = true;
      const initialCleanContent = cleanContent(initialContent || '');
      lastAppliedInitialContent.current = initialCleanContent;
      lastAppliedContentRevision.current = contentRevision;
      setHtmlContent(initialCleanContent);
      return;
    }

    const nextInitialContent = cleanContent(initialContent || '');
    const revisionChanged = contentRevision !== lastAppliedContentRevision.current;
    if (nextInitialContent === lastAppliedInitialContent.current && !revisionChanged) return;

    const currentEditorHtml = getCurrentEditorHtml();
    const currentCleanContent = cleanContent(currentEditorHtml);
    if (!revisionChanged && nextInitialContent === currentCleanContent) {
      lastAppliedInitialContent.current = nextInitialContent;
      return;
    }

    if (
      revisionChanged ||
      editor.isEmpty ||
      !currentEditorHtml.trim() ||
      currentEditorHtml === '<p></p>'
    ) {
      cancelPendingEditorChange();
      editor.commands.setContent(nextInitialContent, { emitUpdate: false });
      setHtmlContent(nextInitialContent);
      lastAppliedInitialContent.current = nextInitialContent;
      lastAppliedContentRevision.current = contentRevision;
    }
  }, [editor, initialContent, contentRevision]);

  useEffect(() => {
    return () => {
      cancelPendingEditorChange();
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isCodeView);
    if (isCodeView) {
      setSelectedImage(null);
      setSelectedVideoEmbed(null);
      setSelectedTable(null);
    }
  }, [editor, isCodeView]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (!editor) return;

    const chain = editor.chain().focus();
    const finalValue = value || '';

    switch (command) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'underline':
        chain.toggleUnderline().run();
        break;
      case 'insertUnorderedList':
        chain.toggleBulletList().run();
        break;
      case 'insertOrderedList':
        chain.toggleOrderedList().run();
        break;
      case 'insertHorizontalRule':
        chain.setHorizontalRule().run();
        break;
      case 'undo':
        chain.undo().run();
        break;
      case 'redo':
        chain.redo().run();
        break;
      case 'foreColor':
        chain.setColor(finalValue).run();
        break;
      case 'justifyLeft':
        chain.setTextAlign('left').run();
        break;
      case 'justifyCenter':
        chain.setTextAlign('center').run();
        break;
      case 'justifyRight':
        chain.setTextAlign('right').run();
        break;
      case 'justifyFull':
        chain.setTextAlign('justify').run();
        break;
      case 'formatBlock':
        if (finalValue === 'p') {
          chain.setParagraph().run();
        } else if (/^h[1-6]$/.test(finalValue)) {
          chain
            .setHeading({ level: Number(finalValue.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6 })
            .run();
        }
        break;
      case 'createLink':
        if (!finalValue) break;
        const normalizedUrl = normalizeEditorUrl(finalValue);
        if (!normalizedUrl) break;
        insertSafeLink(normalizedUrl);
        break;
      case 'insertText':
        chain.insertContent(finalValue).run();
        break;
      case 'insertHTML':
        chain.insertContent(sanitizeEditorHtml(finalValue)).run();
        break;
      default:
        break;
    }
  };

  const buildPreviewHtml = (html: string) =>
    html.replace(/<iframe\s+(?![^>]*loading=)/gi, '<iframe loading="eager" ');

  const openContentPreview = () => {
    setSelectedImage(null);
    setSelectedVideoEmbed(null);
    setPreviewHtml(buildPreviewHtml(isCodeView ? htmlContent : getCurrentEditorHtml()));
    setIsPreviewOpen(true);
  };

  const restoreSavedSelection = () => {
    if (!editor) return;

    if (savedSelection.current) {
      editor.chain().focus().setTextSelection(savedSelection.current).run();
    } else {
      editor.commands.focus();
    }
  };

  const insertStructuredCodeBlock = (code: string) => {
    if (!editor || !code) return;

    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'codeBlock',
          content: [
            {
              type: 'text',
              text: code,
            },
          ],
        },
        { type: 'paragraph' },
      ])
      .run();
  };

  const handleModalConfirm = () => {
    if (!activeModal) return;

    setModalError('');

    if (activeModal === 'link') {
      const normalizedUrl = normalizeEditorUrl(modalInput);
      if (!normalizedUrl) {
        setModalError('Enter a valid HTTP(S), email, phone, anchor, or site URL.');
        return;
      }
      restoreSavedSelection();
      insertSafeLink(normalizedUrl);
    } else if (activeModal === 'image') {
      const normalizedImageUrl = normalizeImageSource(modalInput);
      if (!normalizedImageUrl) {
        setModalError('Enter a valid image URL or managed site path.');
        return;
      }
      insertEditorImages([{ url: normalizedImageUrl, alt: 'Image' }]);
    } else if (activeModal === 'code') {
      if (!modalInput.trim()) {
        setModalError('Enter code before inserting the block.');
        return;
      }
      restoreSavedSelection();
      insertStructuredCodeBlock(modalInput);
    } else if (activeModal === 'table') {
      const rows = Number(modalInput);
      const cols = Number(modalInput2);
      const validDimensions =
        Number.isInteger(rows) &&
        Number.isInteger(cols) &&
        rows >= TABLE_MIN_DIMENSION &&
        rows <= TABLE_MAX_DIMENSION &&
        cols >= TABLE_MIN_DIMENSION &&
        cols <= TABLE_MAX_DIMENSION;
      if (!validDimensions || !editor) {
        setModalError(
          `Rows and columns must be whole numbers from ${TABLE_MIN_DIMENSION} to ${TABLE_MAX_DIMENSION}.`
        );
        return;
      }
      restoreSavedSelection();
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    } else if (activeModal === 'video') {
      if (!processVideoInput(modalInput)) {
        setModalError('Enter a supported YouTube, TikTok, Instagram, or Facebook video.');
        return;
      }
    }

    closeModal();
  };

  const removeSelectedLink = () => {
    if (!editor) return;
    restoreSavedSelection();
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    closeModal();
  };

  const closeModal = () => {
    mediaRequestIdRef.current += 1;
    setActiveModal(null);
    setModalInput('');
    setModalInput2('');
    setModalError('');
  };

  const openModal = (type: 'link' | 'image' | 'video' | 'code' | 'table' | 'mediaLibrary') => {
    if (editor) {
      savedSelection.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
    }

    setSelectedImage(null);
    setSelectedVideoEmbed(null);
    setSelectedTable(null);
    setActiveModal(type);
    setModalInput(type === 'link' ? String(editor?.getAttributes('link')['href'] || '') : '');
    setModalInput2('');
    setModalError('');

    // Fetch media if opening library
    if (type === 'mediaLibrary') {
      fetchMedia();
    }

    // For table, set defaults
    if (type === 'table') {
      setModalInput('3');
      setModalInput2('3');
    }
  };

  const fetchMedia = async (page = 1, search = mediaSearchQuery) => {
    const requestId = ++mediaRequestIdRef.current;
    setLoadingMedia(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(mediaPagination.limit),
      });
      if (search) params.set('search', search);
      const res = await vonFetch(`${API.listMedia}?${params.toString()}`);
      const data = await res.json();
      if (requestId === mediaRequestIdRef.current && data.success) {
        setMediaFiles(data.files || []);
        setMediaPagination((current) => ({
          ...current,
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalItems: data.totalItems || 0,
        }));
      }
    } catch (error) {
      if (requestId === mediaRequestIdRef.current) {
        notify.error('Failed to load media library');
      }
    } finally {
      if (requestId === mediaRequestIdRef.current) {
        setLoadingMedia(false);
      }
    }
  };

  const handleMediaSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSearch = mediaSearchInput.trim().slice(0, 120);
    setMediaSearchQuery(normalizedSearch);
    void fetchMedia(1, normalizedSearch);
  };

  const insertEditorImages = (images: EditorImageInput[]) => {
    const validImages = images.filter((image) => image.url);
    if (!validImages.length) return;

    restoreSavedSelection();
    const html = validImages.map((image) => buildEditorImageHtml(image)).join('<p><br/></p>');
    execCmd('insertHTML', html);
  };

  const handleImageFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (editor) {
      savedSelection.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
    }

    event.target.value = '';
    const toastId = notify.loading(
      files.length > 1 ? `Uploading ${files.length} images...` : 'Uploading image...'
    );
    const uploadedImages: Array<{
      url: string;
      alt?: string;
      id?: string | number | null;
    }> = [];
    let failedCount = 0;

    try {
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await vonFetch(API.uploadFile, {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (data.success && data.url) {
            uploadedImages.push({
              url: data.webpUrl || data.url,
              alt: data.filename || file.name,
              id: data.id || '',
            });
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      if (uploadedImages.length) {
        insertEditorImages(uploadedImages);
        notify.success(
          uploadedImages.length > 1 ? `${uploadedImages.length} images inserted` : 'Image inserted'
        );
      }

      if (failedCount > 0) {
        notify.error(
          failedCount === files.length
            ? 'Upload failed'
            : `${failedCount} upload${failedCount > 1 ? 's' : ''} failed`
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      notify.error('Upload error: ' + message);
    } finally {
      notify.dismiss(toastId);
    }
  };

  const handleMediaSelect = (file: MediaItem) => {
    const url = file.webpUrl || file.url; // Prefer WebP URL if available
    if (!url) return;
    insertEditorImages([{ url, alt: file.altText || file.name || '', id: file.id }]);
    closeModal();
  };

  // Toggle between WYSIWYG and HTML Code view
  const toggleCodeView = () => {
    if (isCodeView) {
      if (editor) {
        const sanitized = sanitizeEditorHtml(htmlContent);
        editor.commands.setContent(sanitized, { emitUpdate: false });
        queueChange(sanitized);
      }
    } else {
      setHtmlContent(sanitizeEditorHtml(getCurrentEditorHtml()));
    }
    setIsCodeView(!isCodeView);
  };

  // Handle HTML textarea changes
  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setHtmlContent(value);
    queueChange(value, false);
  };
  // Align image using CSS

  // Bubble Menu State
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [selectedVideoEmbed, setSelectedVideoEmbed] = useState<HTMLElement | null>(null);
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null);
  const [selectedVideoAspect, setSelectedVideoAspect] = useState<VideoAspectMode>('auto');
  const [bubblePosition, setBubblePosition] = useState({ top: 0, left: 0 });
  const [bubbleAlt, setBubbleAlt] = useState('');
  const [bubbleCredit, setBubbleCredit] = useState('');
  const bubbleTargetRef = useRef<HTMLElement | null>(null);

  const updateBubblePosition = React.useCallback(() => {
    const target = bubbleTargetRef.current;
    if (!target || !editorRef.current || !editorShellRef.current) return;

    if (!editorRef.current.contains(target)) {
      bubbleTargetRef.current = null;
      setSelectedImage(null);
      setSelectedVideoEmbed(null);
      setSelectedTable(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const shellRect = editorShellRef.current.getBoundingClientRect();
    const bubbleWidth = 288;
    const horizontalMargin = 10;
    const idealLeft = rect.left - shellRect.left + rect.width / 2 - bubbleWidth / 2;
    setBubblePosition({
      top: rect.bottom - shellRect.top + 10,
      left: Math.min(
        Math.max(horizontalMargin, idealLeft),
        Math.max(horizontalMargin, shellRect.width - bubbleWidth - horizontalMargin)
      ),
    });
  }, []);

  useEffect(() => {
    if (!selectedImage && !selectedVideoEmbed && !selectedTable) return;

    updateBubblePosition();
    window.addEventListener('scroll', updateBubblePosition, true);
    window.addEventListener('resize', updateBubblePosition);

    return () => {
      window.removeEventListener('scroll', updateBubblePosition, true);
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [selectedImage, selectedTable, selectedVideoEmbed, updateBubblePosition]);

  const onImageClickInternal = (img: HTMLImageElement) => {
    if (editorRef.current) {
      bubbleTargetRef.current = img;
      updateBubblePosition();
      setSelectedImage(img);
      setSelectedVideoEmbed(null);
      setSelectedTable(null);
      setBubbleAlt(img.alt || '');

      // Extract existing credit from figcaption if present
      const figure = img.closest('figure');
      const figcaption = figure?.querySelector('figcaption');
      setBubbleCredit(figcaption?.textContent?.trim() || '');
    }
  };

  const updateImageAlt = async () => {
    if (selectedImage) {
      const mediaId = selectedImage.dataset['id'];
      const imageSrc = selectedImage.src;
      let gallerySyncFailed = false;

      // Sync Back to Media Gallery if ID exists OR use Smart Lookup (Path)
      if ((mediaId && !isNaN(Number(mediaId))) || imageSrc) {
        try {
          const payload: Record<string, unknown> = { alt_text: bubbleAlt };
          if (mediaId) {
            payload['id'] = parseInt(mediaId, 10);
          } else {
            payload['path'] = imageSrc;
          }

          const response = await vonFetch(API.updateMedia, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || `HTTP ${response.status}`);
          }
        } catch (e) {
          gallerySyncFailed = true;
          console.error('Failed to sync alt text to gallery:', e);
        }
      }

      if (
        updateSelectedImageAttributes(selectedImage, () => ({ alt: bubbleAlt }), {
          closeImage: true,
        })
      ) {
        if (typeof notify !== 'undefined') {
          if (gallerySyncFailed) {
            notify.error('Image updated in the post, but gallery alt text was not synced');
          } else {
            notify.success('Image updated');
          }
        }
      }
    }
  };

  const updateImageCredit = () => {
    if (!selectedImage) return;
    const credit = bubbleCredit.trim();
    const imageAlignment = inferImageAlignment(selectedImage);

    if (
      updateSelectedImageAttributes(
        selectedImage,
        (attrs) => ({
          credit,
          figureStyle: buildFigureAlignmentStyle(attrs.figureStyle, imageAlignment),
        }),
        { closeImage: true }
      )
    ) {
      if (typeof notify !== 'undefined') notify.success('Image credit updated');
    }
  };

  const setAsFeaturedIndex = () => {
    if (selectedImage && onImageClick) {
      onImageClick(selectedImage.src);
      setSelectedImage(null);
    }
  };

  const getVideoIframes = (embed: HTMLElement): HTMLIFrameElement[] =>
    embed.tagName === 'IFRAME'
      ? [embed as HTMLIFrameElement]
      : Array.from(embed.querySelectorAll('iframe'));

  const getManualVideoAspectMode = (embed: HTMLElement): VideoAspectMode => {
    const iframe = getVideoIframes(embed)[0];
    const mode = iframe?.getAttribute('data-von-video-aspect');
    return mode === 'portrait' || mode === 'landscape' ? mode : 'auto';
  };

  const applyIframeAspectStyles = (
    iframe: HTMLIFrameElement,
    mode: Exclude<VideoAspectMode, 'auto'>
  ) => {
    iframe.style.width = '100%';
    iframe.style.maxWidth = mode === 'portrait' ? '380px' : '100%';
    iframe.style.aspectRatio = mode === 'portrait' ? '9 / 16' : '16 / 9';
    iframe.style.height = 'auto';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
  };

  const getVideoEmbedTarget = (target: HTMLElement): HTMLElement | null => {
    if (!editorRef.current) return null;
    if (target === editorRef.current) return null;

    const iframe =
      target.tagName === 'IFRAME'
        ? (target as HTMLIFrameElement)
        : target.querySelector('iframe') || target.closest('iframe');

    if (!iframe || !editorRef.current.contains(iframe)) {
      return null;
    }

    return iframe as HTMLElement;
  };

  const onVideoClickInternal = (embed: HTMLElement) => {
    if (!editorRef.current) return;

    bubbleTargetRef.current = embed;
    updateBubblePosition();
    setSelectedImage(null);
    setSelectedVideoEmbed(embed);
    setSelectedTable(null);
    setSelectedVideoAspect(getManualVideoAspectMode(embed));
  };

  const alignVideoEmbed = (embed: HTMLElement, alignment: MediaAlignment) => {
    const iframes = getVideoIframes(embed);

    if (iframes.length === 0) return false;

    iframes.forEach((iframe) => {
      iframe.style.display = 'block';
      iframe.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0';
      iframe.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0';
    });

    if (embed.tagName !== 'IFRAME') {
      embed.style.display = 'block';
      embed.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0';
      embed.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0';
    }

    syncEditorFromDom({ refreshVideo: embed });
    requestAnimationFrame(updateBubblePosition);
    return true;
  };

  const inferVideoAlignment = (embed: HTMLElement): Exclude<MediaAlignment, 'justify'> => {
    const target = getVideoIframes(embed)[0] || embed;
    if (target.style.marginLeft === 'auto' && target.style.marginRight === '0px') return 'right';
    if (target.style.marginLeft === 'auto' && target.style.marginRight === '0') return 'right';
    if (target.style.marginLeft === '0px' && target.style.marginRight === 'auto') return 'left';
    if (target.style.marginLeft === '0' && target.style.marginRight === 'auto') return 'left';
    return 'center';
  };

  const applyVideoAspectMode = (mode: VideoAspectMode) => {
    const videoEmbed = selectedVideoEmbed;
    if (!videoEmbed) return;

    const iframes = getVideoIframes(videoEmbed);
    if (iframes.length === 0) return;

    iframes.forEach((iframe) => {
      const resolvedMode = mode === 'auto' ? inferVideoAspectMode(iframe) : mode;

      if (mode === 'auto') {
        iframe.removeAttribute('data-von-video-aspect');
      } else {
        iframe.setAttribute('data-von-video-aspect', mode);
      }

      applyIframeAspectStyles(iframe, resolvedMode);
    });

    videoEmbed.style.maxWidth =
      (mode === 'auto' ? inferVideoAspectMode(iframes[0]) : mode) === 'portrait' ? '380px' : '100%';
    setSelectedVideoAspect(mode);
    syncEditorFromDom({ refreshVideo: videoEmbed });
    requestAnimationFrame(updateBubblePosition);
  };

  const alignImage = (alignment: MediaAlignment) => {
    const img = selectedImage;

    if (img) {
      // Bubble Menu Image Alignment
      updateSelectedImageAttributes(img, (attrs) => ({
        style: buildImageAlignmentStyle(
          buildImageUpdateBaseStyle(attrs.style, img.getAttribute('style')),
          alignment
        ),
        figureStyle: buildFigureAlignmentStyle(
          attrs.figureStyle || img.closest('figure')?.getAttribute('style'),
          alignment
        ),
        'data-von-image-align': alignment === 'justify' ? 'center' : alignment,
      }));
      return;
    }

    if (selectedVideoEmbed && alignVideoEmbed(selectedVideoEmbed, alignment)) {
      return;
    }

    // Fallback: Text Alignment (execCmd)
    const cmd =
      alignment === 'left'
        ? 'justifyLeft'
        : alignment === 'center'
          ? 'justifyCenter'
          : alignment === 'right'
            ? 'justifyRight'
            : 'justifyFull';
    execCmd(cmd);
  };

  const resizeImage = (size: ImageSize) => {
    if (!selectedImage) return;
    updateSelectedImageAttributes(selectedImage, (attrs) => ({
      style: buildImageWidthStyle(
        buildImageUpdateBaseStyle(attrs.style, selectedImage.getAttribute('style')),
        size
      ),
      'data-von-image-size': size,
    }));
  };

  const removeSelectedImage = () => {
    if (!editor || !selectedImage) return;
    const match = findLegacyImageMatch(selectedImage);
    if (!match) {
      setSelectedImage(null);
      return;
    }

    editor.chain().focus().setNodeSelection(match.pos).deleteSelection().run();
    bubbleTargetRef.current = null;
    setSelectedImage(null);
  };

  const removeSelectedVideo = () => {
    if (!selectedVideoEmbed) return;
    selectedVideoEmbed.remove();
    bubbleTargetRef.current = null;
    syncEditorFromDom({ closeVideo: true });
  };

  const runTableCommand = (command: TableCommand) => {
    if (!editor || !selectedTable) return;

    const isRowGrowth = command === 'addRowBefore' || command === 'addRowAfter';
    const isColumnGrowth = command === 'addColumnBefore' || command === 'addColumnAfter';
    const currentDimension = isRowGrowth
      ? selectedTable.rows.length
      : isColumnGrowth
        ? getEditorTableColumnCount(selectedTable)
        : 0;
    if ((isRowGrowth || isColumnGrowth) && !canGrowEditorTableDimension(currentDimension)) {
      notify.error(`Tables are limited to ${TABLE_MAX_DIMENSION} rows and columns`);
      return;
    }

    let succeeded = false;
    switch (command) {
      case 'addRowBefore':
        succeeded = editor.chain().focus().addRowBefore().run();
        break;
      case 'addRowAfter':
        succeeded = editor.chain().focus().addRowAfter().run();
        break;
      case 'deleteRow':
        succeeded = editor.chain().focus().deleteRow().run();
        break;
      case 'addColumnBefore':
        succeeded = editor.chain().focus().addColumnBefore().run();
        break;
      case 'addColumnAfter':
        succeeded = editor.chain().focus().addColumnAfter().run();
        break;
      case 'deleteColumn':
        succeeded = editor.chain().focus().deleteColumn().run();
        break;
      case 'deleteTable':
        succeeded = editor.chain().focus().deleteTable().run();
        break;
    }

    if (!succeeded) {
      notify.error('Place the cursor inside a table cell and try again');
      return;
    }

    if (command === 'deleteTable') {
      bubbleTargetRef.current = null;
      setSelectedTable(null);
      return;
    }

    requestAnimationFrame(updateBubblePosition);
  };

  const insertTable = () => openModal('table');

  const insertCodeBlock = () => openModal('code');

  const insertBlockquote = () => {
    if (!editor) return;
    editor.chain().focus().toggleBlockquote().run();
  };

  const insertVideo = () => openModal('video');

  const processVideoInput = (input: string): boolean => {
    const embedHtml = buildEditorVideoEmbedHtml(input);
    const sanitizedEmbed = embedHtml ? sanitizeEditorHtml(embedHtml) : '';
    if (!sanitizedEmbed || !/<iframe\b/i.test(sanitizedEmbed)) return false;

    execCmd('insertHTML', sanitizedEmbed);
    return true;
  };

  const handleEditorSurfaceMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCodeView || !editor) return;

    const target = event.target as HTMLElement | null;
    const root = getEditorRoot();
    if (!target || !root) return;

    if (target === event.currentTarget || target === root) {
      if (editor.isEmpty) {
        event.preventDefault();
        editor.commands.focus('end');
      }
    }
  };

  const handleEditorSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCodeView) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.tagName === 'IMG') {
      onImageClickInternal(target as HTMLImageElement);
      return;
    }

    const videoEmbed = getVideoEmbedTarget(target);
    if (videoEmbed) {
      onVideoClickInternal(videoEmbed);
      return;
    }

    const table = target.closest('table');
    if (table && editorRef.current?.contains(table)) {
      bubbleTargetRef.current = table;
      updateBubblePosition();
      setSelectedImage(null);
      setSelectedVideoEmbed(null);
      setSelectedTable(table);
      return;
    }

    setSelectedImage(null);
    setSelectedVideoEmbed(null);
    setSelectedTable(null);
  };

  const selectedImageAlignment = selectedImage ? inferImageAlignment(selectedImage) : null;
  const selectedImageSize = selectedImage ? inferImageSize(selectedImage) : null;
  const selectedVideoAlignment = selectedVideoEmbed
    ? inferVideoAlignment(selectedVideoEmbed)
    : null;
  const tableRowsDraft = Number(modalInput);
  const tableColumnsDraft = Number(modalInput2);
  const tableDimensionsAreValid =
    Number.isInteger(tableRowsDraft) &&
    Number.isInteger(tableColumnsDraft) &&
    tableRowsDraft >= TABLE_MIN_DIMENSION &&
    tableRowsDraft <= TABLE_MAX_DIMENSION &&
    tableColumnsDraft >= TABLE_MIN_DIMENSION &&
    tableColumnsDraft <= TABLE_MAX_DIMENSION;
  const modalCanSubmit =
    activeModal === 'table' ? tableDimensionsAreValid : Boolean(modalInput.trim());
  const selectedLinkIsActive = activeModal === 'link' && Boolean(editor?.isActive('link'));
  return (
    <div
      ref={editorShellRef}
      onBlurCapture={flushPendingEditorChange}
      className="relative flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-xs dark:border-[#2a2b36] dark:bg-[#1a1b26]"
    >
      <DarkModeStyles prefix="editor" />
      <style>{`
        .editor-content .${EDITOR_SURFACE_CLASS} {
          min-height: 320px;
          padding: 1.5rem 1.25rem 4rem;
          outline: none;
          color: #0f172a;
          line-height: 1.75;
          caret-color: #2563eb;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > *:first-child { margin-top: 0; }
        .editor-content .${EDITOR_SURFACE_CLASS} > *:last-child { margin-bottom: 0; }
        .editor-content .${EDITOR_SURFACE_CLASS} p { margin-bottom: 1rem; }
        .editor-content .${EDITOR_SURFACE_CLASS} a {
          color: #0284c7;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} ul {
          list-style: disc;
          list-style-position: outside;
          margin: 1rem 0 1rem 1.5rem;
          padding-left: 1.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} ol {
          list-style: decimal;
          list-style-position: outside;
          margin: 1rem 0 1rem 1.5rem;
          padding-left: 1.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} li {
          margin: 0.35rem 0;
          padding-left: 0.25rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} blockquote {
          border-left: 4px solid #3b82f6;
          background: #eff6ff;
          color: #475569;
          font-style: italic;
          margin: 1.25rem 0;
          padding: 0.85rem 1rem;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} pre {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          margin: 1.25rem 0;
          overflow-x: auto;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', monospace;
          font-size: 0.875rem;
          line-height: 1.65;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} code {
          background: #f1f5f9;
          color: #b45309;
          border-radius: 0.375rem;
          padding: 0.15rem 0.35rem;
          font-family: 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', monospace;
          font-size: 0.9em;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} pre code {
          background: transparent;
          color: inherit;
          border-radius: 0;
          padding: 0;
          font-size: inherit;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > figure,
        .editor-content .${EDITOR_SURFACE_CLASS} > img,
        .editor-content .${EDITOR_SURFACE_CLASS} > iframe {
          margin: 1.5rem 0;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} figure {
          max-width: 100%;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} figure img {
          margin-top: 0;
          margin-bottom: 0;
          width: revert-layer;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          overflow: hidden;
          border-radius: 0.75rem;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} th,
        .editor-content .${EDITOR_SURFACE_CLASS} td {
          border: 1px solid #cbd5e1;
          padding: 0.75rem;
          vertical-align: top;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} th {
          background: #f8fafc;
          font-weight: 700;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} > p:first-child:last-child:has(> br.ProseMirror-trailingBreak)::before {
          content: 'Start Writing';
          color: #cbd5e1;
          float: left;
          height: 0;
          pointer-events: none;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: inherit;
        }
        .editor-content .${EDITOR_SURFACE_CLASS} img { cursor: pointer; }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} {
          color: #e2e8f0;
          caret-color: #60a5fa;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} a { color: #38bdf8; }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} blockquote {
          background: #0f172a;
          color: #cbd5e1;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} pre {
          background: #020617;
          color: #e2e8f0;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} code {
          background: #1e293b;
          color: #fbbf24;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} pre code {
          background: transparent;
          color: inherit;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} th,
        .dark .editor-content .${EDITOR_SURFACE_CLASS} td {
          border-color: #334155;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} th {
          background: #1e293b;
        }
        .dark .editor-content .${EDITOR_SURFACE_CLASS} > p:first-child:last-child:has(> br.ProseMirror-trailingBreak)::before {
          color: #475569;
        }
        @media (min-width: 640px) {
          .editor-content .${EDITOR_SURFACE_CLASS} {
            padding: 1.75rem 1.5rem 4rem;
          }
        }
        .editor-content h1 { font-size: 2.25rem !important; font-weight: 800; line-height: 1.2; margin-bottom: 0.8em; }
        .editor-content h2 { font-size: 1.875rem !important; font-weight: 700; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.6em; }
        .editor-content h3 { font-size: 1.5rem !important; font-weight: 600; line-height: 1.4; margin-top: 1.2em; margin-bottom: 0.5em; }
        .editor-content h4 { font-size: 1.25rem !important; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
        .editor-content h5 { font-size: 1.125rem !important; font-weight: 600; text-transform: uppercase; color: #64748b; margin-top: 1em; margin-bottom: 0.4em; }
        .editor-content h6 { font-size: 1rem !important; font-weight: 700; letter-spacing: 0.05em; color: #475569; margin-top: 1em; }
        .dark .editor-content h5 { color: #94a3b8; }
        .dark .editor-content h6 { color: #cbd5e1; }
      `}</style>
      {/* Main Toolbar - Sticky */}
      <div ref={toolbarSentinelRef} className="h-px" aria-hidden="true" />
      <div
        className={`editor-toolbar sticky top-[3.875rem] z-20 flex flex-wrap items-center gap-0 overflow-visible border-b bg-slate-100/95 px-0.5 py-2 backdrop-blur-md transition-[box-shadow,border-color,background-color] duration-200 dark:bg-[#20212b]/95 sm:gap-0.5 sm:px-3 xl:top-0 xl:flex-wrap xl:px-2 ${
          isToolbarElevated
            ? 'border-slate-300 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/70 dark:border-[#333544] dark:shadow-black/30 dark:ring-white/10'
            : 'border-slate-300/80 shadow-none ring-0 dark:border-[#333544]'
        }`}
      >
        <ToolButton icon={<Undo size={18} />} onClick={() => execCmd('undo')} title="Undo" />
        <ToolButton icon={<Redo size={18} />} onClick={() => execCmd('redo')} title="Redo" />
        <Divider />

        <label htmlFor="editor-block-style" className="sr-only">
          Text style
        </label>
        <select
          id="editor-block-style"
          aria-label="Text style"
          value={activeBlockStyle}
          onChange={(event) => execCmd('formatBlock', event.target.value)}
          className="h-11 w-auto min-w-max shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-xs outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#333544] dark:bg-[#1a1b26] dark:text-slate-200 xl:h-8"
        >
          <option value="p">Body</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="h5">H5</option>
          <option value="h6">H6</option>
        </select>
        <ToolButton
          icon={<Bold size={18} />}
          onClick={() => execCmd('bold')}
          title="Bold (Ctrl+B)"
        />
        <ToolButton
          icon={<Italic size={18} />}
          onClick={() => execCmd('italic')}
          title="Italic (Ctrl+I)"
        />
        <div className="hidden xl:block">
          <ToolButton
            icon={<Underline size={18} />}
            onClick={() => execCmd('underline')}
            title="Underline (Ctrl+U)"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Palette size={18} className="text-rose-500" />}
            onClick={() => {
              const input = document.getElementById('editor-color-picker') as HTMLInputElement;
              input?.click();
            }}
            title="Text Color"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<List size={18} />}
            onClick={() => execCmd('insertUnorderedList')}
            title="Bullet List"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<ListOrdered size={18} />}
            onClick={() => execCmd('insertOrderedList')}
            title="Numbered List"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Quote size={18} className="text-blue-500" />}
            onClick={insertBlockquote}
            title="Blockquote"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<AlignLeft size={18} />}
            onClick={() => alignImage('left')}
            title="Align Left"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<AlignCenter size={18} />}
            onClick={() => alignImage('center')}
            title="Align Center"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<AlignRight size={18} />}
            onClick={() => alignImage('right')}
            title="Align Right"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<AlignJustify size={18} />}
            onClick={() => alignImage('justify')}
            title="Justify"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Link size={18} className="text-sky-500" />}
            onClick={() => openModal('link')}
            title="Insert Hyperlink"
          />
        </div>
        <div ref={imageMenuRef} className="relative hidden xl:block">
          <button
            type="button"
            aria-label="Insert Image Options"
            aria-haspopup="menu"
            aria-expanded={isImageMenuOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsImageMenuOpen((open) => !open)}
            className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 bg-white px-2 text-slate-600 shadow-xs transition-colors duration-150 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm dark:border-[#2a2b36] dark:bg-[#1a1b26]/90 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-[#242633] dark:hover:text-white"
            title="Insert Image Options"
          >
            <Image size={18} className="text-emerald-500" />
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={`transition-transform ${isImageMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {isImageMenuOpen && (
            <div
              role="menu"
              aria-label="Image insertion options"
              className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-[#333544] dark:bg-[#1a1b26]"
            >
              <button
                type="button"
                role="menuitem"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setIsImageMenuOpen(false);
                  openModal('image');
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-900/20"
              >
                <Image size={16} className="text-emerald-500" />
                Image URL
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setIsImageMenuOpen(false);
                  openModal('mediaLibrary');
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-900/20"
              >
                <Images size={16} className="text-indigo-500" />
                Media Library
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setIsImageMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-violet-900/20"
              >
                <Upload size={16} className="text-violet-500" />
                Upload Device
              </button>
            </div>
          )}
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Video size={18} className="text-red-500" />}
            onClick={insertVideo}
            title="Insert Video (YouTube/TikTok/Instagram/Facebook)"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Table size={18} className="text-teal-500" />}
            onClick={insertTable}
            title="Insert Data Table"
          />
        </div>
        <div className="hidden xl:block">
          <ToolButton
            icon={<Minus size={18} />}
            onClick={() => execCmd('insertHorizontalRule')}
            title="Horizontal Line"
          />
        </div>
        <Divider />
        <div className="xl:hidden">
          <ToolButton
            icon={<Plus size={18} className="text-emerald-500" />}
            onClick={() => setCompactToolbarPanel('insert')}
            title="Insert content"
          />
        </div>
        <ToolButton
          icon={<Eye size={18} className="text-violet-500" />}
          onClick={openContentPreview}
          title="Preview content"
        />
        <ToolButton
          icon={<MoreHorizontal size={18} />}
          onClick={() => setCompactToolbarPanel('more')}
          title="More formatting"
        />
        <input
          id="editor-878"
          name="editor878"
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageFiles}
        />
        <input
          aria-label="Editor Color Picker"
          id="editor-color-picker"
          type="color"
          className="pointer-events-none absolute h-px w-px opacity-0"
          onChange={(event) => {
            const selectedColor = event.target.value;
            execCmd('foreColor', selectedColor);
            event.target.value = selectedColor.toLowerCase() === '#000000' ? '#ffffff' : '#000000';
          }}
        />
      </div>

      <AdminModal
        isOpen={compactToolbarPanel !== null}
        onClose={() => setCompactToolbarPanel(null)}
        ariaLabel={compactToolbarPanel === 'insert' ? 'Insert content' : 'More formatting'}
        className="mx-auto w-[min(92vw,32rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#1a1b26]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {compactToolbarPanel === 'insert' ? 'Insert content' : 'More formatting'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {compactToolbarPanel === 'insert' ? 'Add links, media, tables, or dividers.' : null}
              {compactToolbarPanel === 'more' && (
                <>
                  <span className="xl:hidden">Formatting, alignment, and code tools.</span>
                  <span className="hidden xl:inline">HTML source and code block tools.</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompactToolbarPanel(null)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close editor tools"
            title="Close editor tools"
          >
            <X size={20} />
          </button>
        </div>

        {compactToolbarPanel === 'insert' ? (
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                openModal('link');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-sky-900/20"
            >
              <Link size={18} className="text-sky-500" />
              Link
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                openModal('image');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20"
            >
              <Image size={18} className="text-emerald-500" />
              Image URL
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                openModal('mediaLibrary');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
            >
              <Images size={18} className="text-indigo-500" />
              Library
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
                setCompactToolbarPanel(null);
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
            >
              <Upload size={18} className="text-violet-500" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                insertVideo();
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-red-700 dark:hover:bg-red-900/20"
            >
              <Video size={18} className="text-red-500" />
              Video
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                insertTable();
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:bg-teal-900/20"
            >
              <Table size={18} className="text-teal-500" />
              Table
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                execCmd('insertHorizontalRule');
              }}
              className="col-span-2 flex min-h-12 items-center justify-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 sm:col-span-3"
            >
              <Minus size={18} />
              Horizontal line
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                execCmd('underline');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <Underline size={18} />
              Underline
            </button>
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById('editor-color-picker') as HTMLInputElement;
                input?.click();
                setCompactToolbarPanel(null);
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <Palette size={18} className="text-rose-500" />
              Text color
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                execCmd('insertUnorderedList');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <List size={18} />
              Bullet list
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                execCmd('insertOrderedList');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <ListOrdered size={18} />
              Numbered list
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                insertBlockquote();
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <Quote size={18} className="text-blue-500" />
              Blockquote
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                alignImage('left');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <AlignLeft size={18} />
              Align left
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                alignImage('center');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <AlignCenter size={18} />
              Align center
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                alignImage('right');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <AlignRight size={18} />
              Align right
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                alignImage('justify');
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5 xl:hidden"
            >
              <AlignJustify size={18} />
              Justify
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                insertCodeBlock();
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <Code size={18} className="text-amber-500" />
              Code block
            </button>
            <button
              type="button"
              onClick={() => {
                setCompactToolbarPanel(null);
                toggleCodeView();
              }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <Braces size={18} className={isCodeView ? 'text-blue-600' : 'text-cyan-500'} />
              HTML source
            </button>
          </div>
        )}
      </AdminModal>

      {/* HTML Code View */}
      <textarea
        id="editor-1011"
        name="editor1011"
        aria-label="Text Content"
        value={htmlContent}
        onChange={handleHtmlChange}
        className="grow p-4 outline-hidden font-mono text-sm bg-[#101018] text-slate-300 resize-none rounded-b-lg"
        spellCheck={false}
        style={{ minHeight: '300px', display: isCodeView ? 'block' : 'none' }}
        placeholder="<p>Edit HTML here...</p>"
      />

      {/* WYSIWYG Visual Editor - TipTap owns the editing surface */}
      <div
        ref={editorRef}
        className="editor-content relative grow overflow-y-auto bg-white focus-within:ring-2 focus-within:ring-sky-500/30 focus-within:ring-inset dark:bg-[#101018]/80 [&_iframe]:pointer-events-none"
        onMouseDown={handleEditorSurfaceMouseDown}
        onPaste={handlePaste}
        onClick={handleEditorSurfaceClick}
        style={{ minHeight: '320px', display: isCodeView ? 'none' : 'block' }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-[#2a2b36] dark:bg-[#16161e] dark:text-slate-400">
        <span>{isCodeView ? 'HTML Source' : 'Visual Editor'}</span>
        <span>
          Words:{' '}
          {editor
            ?.getText()
            .split(/\s+/)
            .filter((w) => w.length > 0).length || 0}
        </span>
      </div>

      <EditorPreviewModal
        isOpen={isPreviewOpen}
        html={previewHtml}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* Editor Input Modal (Link, Video, Code, Table) */}
      <AdminModal
        isOpen={Boolean(activeModal && activeModal !== 'mediaLibrary')}
        onClose={closeModal}
        ariaLabel={`Insert ${activeModal || 'content'}`}
        className="w-full max-w-md"
      >
        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-[#2a2b36] dark:bg-[#1a1b26]">
          <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-slate-50 dark:bg-[#16161e]/50">
            <h3 className="font-bold text-slate-800 dark:text-white capitalize flex items-center gap-2">
              {activeModal === 'link' && <Link size={18} className="text-blue-500" />}
              {activeModal === 'image' && <Image size={18} className="text-green-500" />}
              {activeModal === 'video' && <Video size={18} className="text-red-500" />}
              {activeModal === 'code' && <Code size={18} className="text-amber-500" />}
              {activeModal === 'table' && <Table size={18} className="text-indigo-500" />}
              Insert {activeModal}
            </h3>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242633] dark:hover:text-slate-300"
              aria-label="Close insert dialog"
              title="Close insert dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {activeModal === 'table' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Rows
                    </span>
                    <input
                      aria-label="Rows"
                      id="editor-1288"
                      name="editor1288"
                      type="number"
                      min={TABLE_MIN_DIMENSION}
                      max={TABLE_MAX_DIMENSION}
                      required
                      value={modalInput}
                      onChange={(e) => {
                        setModalInput(e.target.value);
                        setModalError('');
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Columns
                    </span>
                    <input
                      id="editor-1300"
                      name="editor1300"
                      aria-label="Columns"
                      type="number"
                      min={TABLE_MIN_DIMENSION}
                      max={TABLE_MAX_DIMENSION}
                      required
                      value={modalInput2}
                      onChange={(e) => {
                        setModalInput2(e.target.value);
                        setModalError('');
                      }}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use {TABLE_MIN_DIMENSION} to {TABLE_MAX_DIMENSION} rows and columns.
                </p>
              </div>
            ) : activeModal === 'code' ? (
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Code Content
                </span>
                <textarea
                  aria-label="Code Content"
                  id="editor-1314"
                  name="editor1314"
                  autoFocus
                  rows={6}
                  required
                  maxLength={100000}
                  value={modalInput}
                  onChange={(e) => {
                    setModalInput(e.target.value);
                    setModalError('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden font-mono text-sm"
                  placeholder="Paste your code here..."
                />
              </div>
            ) : (
              <div>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {activeModal === 'link'
                    ? 'URL'
                    : activeModal === 'image'
                      ? 'Image URL'
                      : 'Video URL or Embed Code'}
                </span>
                <input
                  id="editor-1332"
                  name="editor1332"
                  aria-label={
                    activeModal === 'link'
                      ? 'Link URL'
                      : activeModal === 'image'
                        ? 'Image URL'
                        : 'Video URL or embed code'
                  }
                  autoFocus
                  type="text"
                  required
                  maxLength={activeModal === 'video' ? 12000 : 2048}
                  value={modalInput}
                  onChange={(e) => {
                    setModalInput(e.target.value);
                    setModalError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  placeholder={
                    activeModal === 'video' ? 'https://youtube.com/...' : 'https://example.com'
                  }
                />
                {activeModal === 'video' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Supports YouTube, TikTok, Instagram, Facebook or supported iframe embeds.
                  </p>
                )}
              </div>
            )}
            {modalError && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {modalError}
              </p>
            )}
          </div>

          {/* Modal Footer with Quick Release Button */}
          <div className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-[#2a2b36] dark:bg-[#16161e]/50 sm:flex-row">
            <button
              type="button"
              onClick={closeModal}
              className="min-h-11 w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#242633] rounded-lg transition-colors sm:w-auto"
            >
              Cancel
            </button>
            {selectedLinkIsActive && (
              <button
                type="button"
                onClick={removeSelectedLink}
                className="min-h-11 w-full rounded-lg px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 sm:w-auto"
              >
                Remove link
              </button>
            )}
            <button
              type="button"
              onClick={handleModalConfirm}
              disabled={!modalCanSubmit}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <CheckCircle size={16} />
              {activeModal === 'link' || activeModal === 'image' || activeModal === 'video'
                ? 'Insert Object'
                : activeModal === 'code'
                  ? 'Insert Code'
                  : 'Generate Table'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Media Library Modal */}
      <AdminModal
        isOpen={activeModal === 'mediaLibrary'}
        onClose={closeModal}
        ariaLabel="Media library"
        className="w-full max-w-4xl"
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:max-h-[85dvh]">
          <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Images size={18} className="text-blue-500" />
              Media Library
            </h3>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#242633] dark:hover:text-slate-300"
              title="Close"
              aria-label="Close media library"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={handleMediaSearch}
            className="flex flex-col gap-2 border-b border-slate-100 bg-white p-3 dark:border-[#2a2b36] dark:bg-[#1a1b26] sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="editor-media-search"
                name="editorMediaSearch"
                type="search"
                value={mediaSearchInput}
                maxLength={120}
                aria-label="Search media library"
                onChange={(event) => setMediaSearchInput(event.target.value)}
                placeholder="Search filename, alt text or caption..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-[#2a2b36] dark:bg-[#16161e] dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          <div className="grow overflow-y-auto p-4 bg-slate-100 dark:bg-[#16161e] custom-scrollbar">
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
                    onClick={() => handleMediaSelect(file)}
                    aria-label={`Insert ${file.altText || file.name || 'image'}`}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-xs transition-all hover:ring-2 hover:ring-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-[#2a2b36] dark:bg-[#1a1b26]"
                  >
                    <div className="aspect-square relative bg-slate-100 dark:bg-[#16161e]">
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

          <div className="p-4 border-t border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50">
            <SmartPagination
              currentPage={mediaPagination.currentPage}
              totalPages={mediaPagination.totalPages}
              onPageChange={(page) => fetchMedia(page, mediaSearchQuery)}
              itemsPerPage={mediaPagination.limit}
              totalItems={mediaPagination.totalItems}
            />
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 px-4 py-2 bg-white dark:bg-[#1a1b26] border border-slate-300 dark:border-[#333544] rounded-lg hover:bg-slate-50 dark:hover:bg-[#242633] transition-colors text-xs font-bold dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </AdminModal>

      {/* Image Bubble Menu */}
      {selectedImage && (
        <div
          className="absolute z-70 bg-white dark:bg-[#1a1b26] shadow-xl border border-slate-200 dark:border-[#2a2b36] rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
          style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Image Tools</span>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
              aria-label="Close image tools"
              title="Close image tools"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded-sm p-1">
            <ToolButton
              icon={<AlignLeft size={14} />}
              onClick={() => alignImage('left')}
              title="Align Left"
              active={selectedImageAlignment === 'left'}
            />
            <ToolButton
              icon={<AlignCenter size={14} />}
              onClick={() => alignImage('center')}
              title="Align Center"
              active={selectedImageAlignment === 'center'}
            />
            <ToolButton
              icon={<AlignRight size={14} />}
              onClick={() => alignImage('right')}
              title="Align Right"
              active={selectedImageAlignment === 'right'}
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded-sm p-1">
            <span className="text-[10px] text-slate-500 font-semibold px-1">SIZE</span>
            {(['25', '50', '75', '100'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => resizeImage(size)}
                className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
                  selectedImageSize === size
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1a1b26]'
                }`}
                title={`Resize to ${size}%`}
              >
                {size === '25' ? 'S' : size === '50' ? 'M' : size === '75' ? 'L' : 'Full'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold">ALT TEXT (SEO)</span>
            <div className="flex gap-1">
              <input
                aria-label="ALT TEXT (SEO)"
                id="editor-1513"
                name="editor1513"
                value={bubbleAlt}
                onChange={(e) => setBubbleAlt(e.target.value)}
                className="grow text-xs p-1.5 border border-slate-300 dark:border-[#333544] rounded-sm bg-slate-50 dark:bg-[#16161e] dark:text-white"
                placeholder="Describe image..."
              />
              <button
                type="button"
                onClick={updateImageAlt}
                className="bg-blue-600 text-white p-1.5 rounded-sm hover:bg-blue-700"
                title="Save Alt Text"
              >
                <CheckCircle size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold">CREDIT / ATTRIBUTION</span>
            <div className="flex gap-1">
              <input
                id="editor-1532"
                name="editor1532"
                aria-label="CREDIT / ATTRIBUTION"
                value={bubbleCredit}
                onChange={(e) => setBubbleCredit(e.target.value)}
                className="grow text-xs p-1.5 border border-slate-300 dark:border-[#333544] rounded-sm bg-slate-50 dark:bg-[#16161e] dark:text-white"
                placeholder="e.g. Bernama, Reuters, AP, AFP..."
              />
              <button
                type="button"
                onClick={updateImageCredit}
                className="bg-cyan-600 text-white p-1.5 rounded-sm hover:bg-cyan-700"
                title="Save Credit"
              >
                <CheckCircle size={14} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={setAsFeaturedIndex}
            className="text-xs p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-sm hover:bg-amber-100 flex items-center justify-center gap-1 font-medium mt-1"
          >
            <Sparkles size={14} /> Set as Featured Image
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeSelectedImage}
            className="flex min-h-10 items-center justify-center rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
          >
            Remove image
          </button>
        </div>
      )}

      {/* Video Bubble Menu */}
      {selectedVideoEmbed && (
        <div
          className="absolute z-70 bg-white dark:bg-[#1a1b26] shadow-xl border border-slate-200 dark:border-[#2a2b36] rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
          style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Video Tools</span>
            <button
              type="button"
              onClick={() => setSelectedVideoEmbed(null)}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
              aria-label="Close video tools"
              title="Close video tools"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded-sm p-1">
            <ToolButton
              icon={<AlignLeft size={14} />}
              onClick={() => alignImage('left')}
              title="Align Left"
              active={selectedVideoAlignment === 'left'}
            />
            <ToolButton
              icon={<AlignCenter size={14} />}
              onClick={() => alignImage('center')}
              title="Align Center"
              active={selectedVideoAlignment === 'center'}
            />
            <ToolButton
              icon={<AlignRight size={14} />}
              onClick={() => alignImage('right')}
              title="Align Right"
              active={selectedVideoAlignment === 'right'}
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded-sm p-1">
            <span className="text-[10px] text-slate-500 font-semibold px-1">ASPECT</span>
            {(
              [
                ['auto', 'Auto'],
                ['portrait', '9:16'],
                ['landscape', '16:9'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyVideoAspectMode(mode)}
                className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
                  selectedVideoAspect === mode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1a1b26]'
                }`}
                title={`Set video aspect to ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeSelectedVideo}
            className="flex min-h-10 items-center justify-center rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
          >
            Remove video
          </button>
        </div>
      )}

      {/* Table Bubble Menu */}
      {selectedTable && (
        <div
          className="absolute z-70 flex w-72 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-xl animate-fade-in dark:border-[#2a2b36] dark:bg-[#1a1b26]"
          style={{ top: bubblePosition.top, left: bubblePosition.left }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500">Table Tools</span>
            <button
              type="button"
              onClick={() => setSelectedTable(null)}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-white/10"
              aria-label="Close table tools"
              title="Close table tools"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['addRowBefore', 'Add row above'],
                ['addRowAfter', 'Add row below'],
                ['deleteRow', 'Delete row'],
                ['addColumnBefore', 'Add column left'],
                ['addColumnAfter', 'Add column right'],
                ['deleteColumn', 'Delete column'],
              ] as const
            ).map(([command, label]) => (
              <button
                key={command}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableCommand(command)}
                className="min-h-10 rounded-lg bg-slate-100 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-[#16161e] dark:text-slate-200 dark:hover:bg-white/10"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runTableCommand('deleteTable')}
            className="min-h-10 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/35"
          >
            Delete table
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(Editor);
