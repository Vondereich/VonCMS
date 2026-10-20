import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ChevronDown,
  Eye,
  Braces,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import type { MediaItem } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { DarkModeStyles } from '../styles/DarkModeStyles';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
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
import {
  buildEditorLinkAttrs,
  editorLinkRelationshipFromRel,
  normalizeEditorUrl,
  type EditorLinkRelationship,
} from './editor/editorLinkUtils';
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
import { EditorSurfaceStyles } from './editor/EditorSurfaceStyles';
import { EditorInsertModal } from './editor/EditorInsertModal';
import { EditorMediaLibraryModal } from './editor/EditorMediaLibraryModal';
import {
  EditorImageBubble,
  EditorVideoBubble,
  EditorTableBubble,
} from './editor/EditorBubbleMenus';

interface EditorProps {
  initialContent: string;
  contentRevision?: number;
  onChange: (content: string) => void;
  onImmediateChange?: (content: string) => void;
  onImageClick?: (src: string) => void;
  readOnly?: boolean;
}

const Editor: React.FC<EditorProps> = ({
  initialContent,
  contentRevision = 0,
  onChange,
  onImmediateChange,
  onImageClick,
  readOnly = false,
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
  const { query: mediaSearchQuery, commit: commitMediaSearch } =
    useDebouncedSearchQuery(mediaSearchInput);

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'link' | 'image' | 'video' | 'code' | 'table' | 'mediaLibrary' | null
  >(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');
  const [modalError, setModalError] = useState('');
  const [linkRelationship, setLinkRelationship] = useState<EditorLinkRelationship>('normal');
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
    editable: !readOnly,
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

  const insertSafeLink = (
    normalizedUrl: string,
    relationship: EditorLinkRelationship = 'normal'
  ) => {
    if (!editor) return;

    const linkAttrs = {
      ...buildEditorLinkAttrs(normalizedUrl, relationship),
      href: normalizedUrl,
    };
    const chain = editor.chain().focus();

    if (editor.isActive('link')) {
      chain.extendMarkRange('link').setLink(linkAttrs).run();
      return;
    }

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

  const refreshSelectedImage = (previousImage: HTMLImageElement | null, nodePosition?: number) => {
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
      const nodeDom = nodePosition === undefined ? null : editor?.view.nodeDOM(nodePosition);
      const positionedImage =
        nodeDom instanceof HTMLElement
          ? ((nodeDom.matches('img')
              ? nodeDom
              : nodeDom.querySelector('img')) as HTMLImageElement | null)
          : null;
      const nextImage =
        nodePosition !== undefined
          ? positionedImage
          : (Array.from(root.querySelectorAll('img')).find((candidate) => {
              const element = candidate as HTMLImageElement;
              if (previousId) {
                return element.getAttribute('data-id') === previousId;
              }

              return previousSrc ? element.getAttribute('src') === previousSrc : false;
            }) as HTMLImageElement | undefined);

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
    // ProseMirror's view-only breaks/separators are not authored document content.
    const contentDom = root?.cloneNode(true) as HTMLElement | undefined;
    contentDom
      ?.querySelectorAll('br.ProseMirror-trailingBreak, img.ProseMirror-separator')
      .forEach((placeholder) => placeholder.remove());
    const domHtml = contentDom?.innerHTML ?? getCurrentEditorHtml();
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
      refreshSelectedImage(img, match.pos);
    }

    return true;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
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
    editor.setEditable(!isCodeView && !readOnly);
    if (isCodeView || readOnly) {
      setSelectedImage(null);
      setSelectedVideoEmbed(null);
      setSelectedTable(null);
    }
    if (readOnly && isCodeView) {
      setIsCodeView(false);
    }
  }, [editor, isCodeView, readOnly]);

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
      insertSafeLink(normalizedUrl, linkRelationship);
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
    setLinkRelationship('normal');
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
    setLinkRelationship(
      type === 'link'
        ? editorLinkRelationshipFromRel(String(editor?.getAttributes('link')['rel'] || ''))
        : 'normal'
    );
    setModalInput2('');
    setModalError('');

    // For table, set defaults
    if (type === 'table') {
      setModalInput('3');
      setModalInput2('3');
    }
  };

  const fetchMedia = useCallback(
    async (page = 1, search = mediaSearchQuery) => {
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
    },
    [mediaPagination.limit, mediaSearchQuery]
  );

  useEffect(() => {
    if (activeModal === 'mediaLibrary') {
      void fetchMedia(1, mediaSearchQuery);
    }
  }, [activeModal, fetchMedia, mediaSearchQuery]);

  const handleMediaSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSearch = commitMediaSearch();
    if (normalizedSearch === mediaSearchQuery) {
      void fetchMedia(1, normalizedSearch);
    }
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
      className="relative flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-xs dark:border-admin-border dark:bg-admin-panel"
    >
      <DarkModeStyles prefix="editor" />
      <EditorSurfaceStyles />
      {/* Main Toolbar - Sticky */}
      <div ref={toolbarSentinelRef} className="h-px" aria-hidden="true" />
      <div
        className={`editor-toolbar sticky top-[3.875rem] z-20 flex flex-wrap items-center gap-0 overflow-visible border-b bg-slate-200/80 px-0.5 py-2 backdrop-blur-md transition-[box-shadow,border-color,background-color] duration-200 dark:bg-admin-toolbar/95 sm:gap-0.5 sm:px-3 xl:top-0 xl:flex-wrap xl:px-2 ${
          isToolbarElevated
            ? 'border-slate-300 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/70 dark:border-admin-border-strong dark:shadow-black/30 dark:ring-white/10'
            : 'border-slate-300/80 shadow-none ring-0 dark:border-admin-border-strong'
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
          className="h-11 w-auto min-w-max shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-xs outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-admin-border-strong dark:bg-admin-panel dark:text-slate-200 xl:h-8"
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
            className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 bg-white px-2 text-slate-600 shadow-xs transition-colors duration-150 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm dark:border-admin-border dark:bg-admin-panel/90 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-admin-hover dark:hover:text-white"
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
              className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-admin-border-strong dark:bg-admin-panel"
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
        className="mx-auto w-[min(92vw,32rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-admin-border dark:bg-admin-panel"
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
        disabled={readOnly}
        className="grow p-4 outline-hidden font-mono text-sm bg-admin-inset text-slate-300 resize-none rounded-b-lg"
        spellCheck={false}
        style={{ minHeight: '300px', display: isCodeView ? 'block' : 'none' }}
        placeholder="<p>Edit HTML here...</p>"
      />

      {/* WYSIWYG Visual Editor - TipTap owns the editing surface */}
      <div
        ref={editorRef}
        className="editor-content relative grow overflow-y-auto bg-white focus-within:ring-2 focus-within:ring-sky-500/30 focus-within:ring-inset dark:bg-admin-inset/80 [&_iframe]:pointer-events-none"
        onMouseDown={handleEditorSurfaceMouseDown}
        onPaste={handlePaste}
        onClick={handleEditorSurfaceClick}
        aria-readonly={readOnly}
        style={{ minHeight: '320px', display: isCodeView ? 'none' : 'block' }}
      >
        {editor && <EditorContent editor={editor} />}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-admin-border dark:bg-admin-canvas dark:text-slate-400">
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
      <EditorInsertModal
        activeModal={activeModal}
        modalInput={modalInput}
        modalInput2={modalInput2}
        modalError={modalError}
        linkRelationship={linkRelationship}
        modalCanSubmit={modalCanSubmit}
        selectedLinkIsActive={selectedLinkIsActive}
        onInputChange={(value) => {
          setModalInput(value);
          setModalError('');
        }}
        onSecondInputChange={(value) => {
          setModalInput2(value);
          setModalError('');
        }}
        onRelationshipChange={setLinkRelationship}
        onConfirm={handleModalConfirm}
        onRemoveLink={removeSelectedLink}
        onClose={closeModal}
      />

      {/* Media Library Modal */}
      <EditorMediaLibraryModal
        isOpen={activeModal === 'mediaLibrary'}
        mediaFiles={mediaFiles}
        loadingMedia={loadingMedia}
        mediaPagination={mediaPagination}
        mediaSearchInput={mediaSearchInput}
        onSearchInputChange={setMediaSearchInput}
        onSearch={handleMediaSearch}
        onSelect={handleMediaSelect}
        onPageChange={(page) => fetchMedia(page, mediaSearchQuery)}
        onClose={closeModal}
      />

      {/* Image Bubble Menu */}
      {selectedImage && (
        <EditorImageBubble
          bubblePosition={bubblePosition}
          selectedImageAlignment={selectedImageAlignment}
          selectedImageSize={selectedImageSize}
          bubbleAlt={bubbleAlt}
          bubbleCredit={bubbleCredit}
          alignImage={alignImage}
          resizeImage={resizeImage}
          setBubbleAlt={setBubbleAlt}
          setBubbleCredit={setBubbleCredit}
          updateImageAlt={updateImageAlt}
          updateImageCredit={updateImageCredit}
          setAsFeaturedIndex={setAsFeaturedIndex}
          removeSelectedImage={removeSelectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Video Bubble Menu */}
      {selectedVideoEmbed && (
        <EditorVideoBubble
          bubblePosition={bubblePosition}
          selectedVideoAlignment={selectedVideoAlignment}
          selectedVideoAspect={selectedVideoAspect}
          alignImage={alignImage}
          applyVideoAspectMode={applyVideoAspectMode}
          removeSelectedVideo={removeSelectedVideo}
          onClose={() => setSelectedVideoEmbed(null)}
        />
      )}

      {/* Table Bubble Menu */}
      {selectedTable && (
        <EditorTableBubble
          bubblePosition={bubblePosition}
          runTableCommand={runTableCommand}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
};

export default React.memo(Editor);
