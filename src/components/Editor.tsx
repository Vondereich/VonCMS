import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
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
  X, // Added X icon
  CheckCircle, // Added CheckCircle
  Sparkles, // Added Sparkles
  ChevronDown, // Added ChevronDown for dropdown
  Eye, // Added Eye for Preview
  Braces, // Added Braces for HTML source
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import ContentRenderer from './ContentRenderer';
import { DarkModeStyles } from '../styles/DarkModeStyles';
import SmartPagination from './SmartPagination';
import { sanitizeHTML } from '../utils/colorSanitizer';
import { sanitizeEditorHtml, sanitizePastedHtml } from '../utils/security';
import {
  DEFAULT_VIDEO_ALLOW,
  EDITOR_EXTENSIONS,
  EDITOR_SURFACE_CLASS,
  VIDEO_ASPECT_STYLES,
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
  type VideoAspectMode,
} from './editor/editorExtensions';
import { buildEditorLinkAttrs, normalizeEditorUrl } from './editor/editorLinkUtils';

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
  const { loadSettings } = useSettings();
  const editorShellRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarSentinelRef = useRef<HTMLDivElement>(null);

  // Load settings on mount to ensure we know active plugins
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isCodeView, setIsCodeView] = useState(false);
  const [htmlContent, setHtmlContent] = useState(initialContent || '');
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false); // Dropdown UI state
  const [isToolbarElevated, setIsToolbarElevated] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEditorChangeRef = useRef<string | null>(null);
  const isInitialized = useRef(false);
  const lastAppliedInitialContent = useRef<string | null>(null);
  const lastAppliedContentRevision = useRef(contentRevision);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null); // Ref for closing dropdown on outside click
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  // Close image dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imageMenuRef.current && !imageMenuRef.current.contains(event.target as Node)) {
        setIsImageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaPagination, setMediaPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 32,
  });

  // Modal State
  const [activeModal, setActiveModal] = useState<
    'link' | 'image' | 'video' | 'code' | 'table' | 'mediaLibrary' | null
  >(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');

  // Sanitize and clean content - now simplified since colorSanitizer handles on save
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
      // 1. Clean HTML via colorSanitizer (merges UX and baseline security)
      // This preserves alignment and colors while removing dangerous alien styles
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

    if (
      revisionChanged ||
      editor.isEmpty ||
      !getCurrentEditorHtml().trim() ||
      getCurrentEditorHtml() === '<p></p>'
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

    if (activeModal === 'link') {
      if (modalInput) {
        restoreSavedSelection();
        execCmd('createLink', modalInput);
      }
    } else if (activeModal === 'image') {
      if (modalInput) {
        insertEditorImages([{ url: modalInput, alt: 'Image' }]);
      }
    } else if (activeModal === 'code') {
      if (modalInput) {
        restoreSavedSelection();
        insertStructuredCodeBlock(modalInput);
      }
    } else if (activeModal === 'table') {
      const rows = parseInt(modalInput || '3');
      const cols = parseInt(modalInput2 || '3');
      if (rows > 0 && cols > 0 && editor) {
        restoreSavedSelection();
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
      }
    } else if (activeModal === 'video') {
      restoreSavedSelection();
      processVideoInput(modalInput);
    }

    closeModal();
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalInput('');
    setModalInput2('');
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
    setActiveModal(type);
    setModalInput('');
    setModalInput2('');

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

  const fetchMedia = async (page = 1) => {
    setLoadingMedia(true);
    try {
      const res = await vonFetch(`${API.listMedia}?page=${page}&limit=${mediaPagination.limit}`);
      const data = await res.json();
      if (data.success) {
        setMediaFiles(data.files || []);
        setMediaPagination({
          ...mediaPagination,
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalItems: data.totalItems || 0,
        });
      }
    } catch (error) {
      notify.error('Failed to load media library');
    } finally {
      setLoadingMedia(false);
    }
  };

  const escapeImageAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  const buildEditorImageHtml = (image: {
    url: string;
    alt?: string;
    id?: string | number | null;
  }) => {
    const alt = escapeImageAttr(image.alt || '');
    const dataId =
      image.id !== undefined && image.id !== null && image.id !== ''
        ? ` data-id="${escapeImageAttr(String(image.id))}"`
        : '';
    return `<img src="${escapeImageAttr(image.url)}" alt="${alt}"${dataId} class="rounded-lg shadow-sm" style="max-width: 100%; height: auto;" />`;
  };

  const insertEditorImages = (
    images: Array<{ url: string; alt?: string; id?: string | number | null }>
  ) => {
    const validImages = images.filter((image) => image.url);
    if (!validImages.length) return;

    restoreSavedSelection();
    const html = validImages.map((image) => buildEditorImageHtml(image)).join('<p><br/></p>');
    execCmd('insertHTML', html);
  };

  const handleMediaSelect = (file: any) => {
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
      return;
    }

    const rect = target.getBoundingClientRect();
    const shellRect = editorShellRef.current.getBoundingClientRect();
    setBubblePosition({
      top: rect.bottom - shellRect.top + 10,
      left: rect.left - shellRect.left + rect.width / 2 - 150,
    });
  }, []);

  useEffect(() => {
    if (!selectedImage && !selectedVideoEmbed) return;

    updateBubblePosition();
    window.addEventListener('scroll', updateBubblePosition, true);
    window.addEventListener('resize', updateBubblePosition);

    return () => {
      window.removeEventListener('scroll', updateBubblePosition, true);
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [selectedImage, selectedVideoEmbed, updateBubblePosition]);

  const onImageClickInternal = (img: HTMLImageElement) => {
    if (editorRef.current) {
      bubbleTargetRef.current = img;
      updateBubblePosition();
      setSelectedImage(img);
      setSelectedVideoEmbed(null);
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

      // Sync Back to Media Gallery if ID exists OR use Smart Lookup (Path)
      if ((mediaId && !isNaN(Number(mediaId))) || imageSrc) {
        try {
          const payload: Record<string, unknown> = { alt_text: bubbleAlt };
          if (mediaId) {
            payload['id'] = parseInt(mediaId, 10);
          } else {
            payload['path'] = imageSrc;
          }

          await vonFetch(API.updateMedia, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          console.error('Failed to sync alt text to gallery:', e);
        }
      }

      if (
        updateSelectedImageAttributes(selectedImage, () => ({ alt: bubbleAlt }), {
          closeImage: true,
        })
      ) {
        if (typeof notify !== 'undefined') notify.success('Image updated');
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

  const parseVideoUrl = (value: string): URL | null => {
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
    } catch {
      return null;
    }
  };

  const normalizeVideoHost = (value: string): string => value.toLowerCase().replace(/^www\./, '');
  const isVideoHost = (host: string, domain: string): boolean =>
    host === domain || host.endsWith(`.${domain}`);

  const inferVideoAspectMode = (iframe: HTMLIFrameElement): Exclude<VideoAspectMode, 'auto'> => {
    const src = iframe.getAttribute('src') || '';
    const parsed = parseVideoUrl(src);
    const host = parsed ? normalizeVideoHost(parsed.hostname) : '';
    const path = parsed?.pathname || '';
    if (parsed?.searchParams.get('von_vertical') === 'shorts') {
      return 'portrait';
    }
    if (isVideoHost(host, 'tiktok.com') && path.startsWith('/player/')) {
      return 'portrait';
    }
    if (isVideoHost(host, 'instagram.com') && path.startsWith('/reel/')) {
      return 'portrait';
    }
    if (
      isVideoHost(host, 'facebook.com') &&
      path === '/plugins/video.php' &&
      parsed?.searchParams.get('width') === '380'
    ) {
      return 'portrait';
    }
    return 'landscape';
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

  const insertHeading = (level: number) => {
    execCmd('formatBlock', `h${level}`);
  };

  const insertTable = () => openModal('table');

  const insertCodeBlock = () => openModal('code');

  const insertBlockquote = () => {
    if (!editor) return;
    editor.chain().focus().toggleBlockquote().run();
  };

  const insertVideo = () => openModal('video');

  const getVideoPathParts = (url: URL): string[] => url.pathname.split('/').filter(Boolean);

  const extractTikTokVideoId = (input: string) => {
    const parsed = parseVideoUrl(input);
    if (!parsed || !isVideoHost(normalizeVideoHost(parsed.hostname), 'tiktok.com')) return null;

    const parts = getVideoPathParts(parsed);
    if (parts[0] === 'player' && parts[1] === 'v1' && /^\d+$/.test(parts[2] || '')) {
      return parts[2];
    }

    const videoIndex = parts.indexOf('video');
    const candidate = videoIndex >= 0 ? parts[videoIndex + 1] : '';
    return /^\d+$/.test(candidate || '') ? candidate : null;
  };

  const extractInstagramReelId = (input: string) => {
    const parsed = parseVideoUrl(input);
    if (!parsed || !isVideoHost(normalizeVideoHost(parsed.hostname), 'instagram.com')) return null;

    const parts = getVideoPathParts(parsed);
    return (parts[0] === 'reel' || parts[0] === 'reels') && /^[a-zA-Z0-9_-]+$/.test(parts[1] || '')
      ? parts[1]
      : null;
  };

  const extractYouTubeVideo = (input: string): { id: string; isShorts: boolean } | null => {
    const parsed = parseVideoUrl(input);
    if (!parsed) return null;

    const host = normalizeVideoHost(parsed.hostname);
    const parts = getVideoPathParts(parsed);
    const isValidId = (value?: string | null) =>
      Boolean(value && /^[a-zA-Z0-9_-]{11}$/.test(value));

    if (host === 'youtu.be' && isValidId(parts[0])) {
      return { id: parts[0], isShorts: false };
    }

    if (!isVideoHost(host, 'youtube.com') && !isVideoHost(host, 'youtube-nocookie.com')) {
      return null;
    }

    if (parts[0] === 'shorts' && isValidId(parts[1])) {
      return { id: parts[1], isShorts: true };
    }

    const embeddedId =
      (parts[0] === 'embed' || parts[0] === 'v' || parts[0] === 'e') && isValidId(parts[1])
        ? parts[1]
        : null;
    if (embeddedId) {
      return { id: embeddedId, isShorts: false };
    }

    const watchId = parsed.searchParams.get('v');
    return isValidId(watchId) ? { id: watchId as string, isShorts: false } : null;
  };

  const isFacebookVideoUrl = (input: string): boolean => {
    const parsed = parseVideoUrl(input);
    if (!parsed) return false;
    const host = normalizeVideoHost(parsed.hostname);
    return isVideoHost(host, 'facebook.com') || host === 'fb.watch';
  };

  const isFacebookReelUrl = (input: string): boolean => {
    const parsed = parseVideoUrl(input);
    if (!parsed || !isVideoHost(normalizeVideoHost(parsed.hostname), 'facebook.com')) return false;
    return parsed.pathname.startsWith('/reel/') || parsed.pathname.startsWith('/reels/');
  };

  const processVideoInput = (input: string) => {
    if (!input) return;

    let embedHtml = '';
    const portraitVideoStyle = VIDEO_ASPECT_STYLES.portrait;
    const landscapeVideoStyle = VIDEO_ASPECT_STYLES.landscape;

    if (input.trim().startsWith('<')) {
      embedHtml = input;
    } else {
      const youtubeVideo = extractYouTubeVideo(input);
      if (youtubeVideo) {
        const src = `https://www.youtube.com/embed/${youtubeVideo.id}${youtubeVideo.isShorts ? '?playsinline=1&von_vertical=shorts' : ''}`;
        embedHtml = youtubeVideo.isShorts
          ? `<iframe width="100%" height="676" src="${src}" frameborder="0" allow="${DEFAULT_VIDEO_ALLOW}" allowfullscreen data-von-video-aspect="portrait" style="${portraitVideoStyle}" title="YouTube Shorts embed"></iframe>`
          : `<iframe width="100%" height="400" src="${src}" frameborder="0" allow="${DEFAULT_VIDEO_ALLOW}" allowfullscreen style="${landscapeVideoStyle}" title="YouTube video embed"></iframe>`;
      } else if (extractTikTokVideoId(input)) {
        const videoId = extractTikTokVideoId(input);
        if (videoId) {
          embedHtml = `<iframe width="100%" height="676" src="https://www.tiktok.com/player/v1/${videoId}" frameborder="0" scrolling="no" allowfullscreen title="TikTok video embed" data-von-video-aspect="portrait" style="${portraitVideoStyle}"></iframe>`;
        }
      } else if (extractInstagramReelId(input)) {
        const reelId = extractInstagramReelId(input);
        if (reelId) {
          embedHtml = `<iframe width="100%" height="676" src="https://www.instagram.com/reel/${reelId}/embed" frameborder="0" scrolling="no" allowfullscreen title="Instagram Reel embed" data-von-video-aspect="portrait" style="${portraitVideoStyle}"></iframe>`;
        }
      } else if (isFacebookVideoUrl(input)) {
        const encodedUrl = encodeURIComponent(input);
        const isFacebookReel = isFacebookReelUrl(input);
        embedHtml = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&width=${isFacebookReel ? '380' : '560'}" width="100%" height="${isFacebookReel ? '676' : '400'}" style="${isFacebookReel ? portraitVideoStyle : landscapeVideoStyle}" scrolling="no" frameborder="0" allowfullscreen="true" ${isFacebookReel ? 'data-von-video-aspect="portrait"' : ''} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true" title="Facebook video embed"></iframe>`;
      }
    }

    if (embedHtml) {
      execCmd('insertHTML', embedHtml);
    } else {
      notify.error('Could not recognize video URL');
    }
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

    setSelectedImage(null);
    setSelectedVideoEmbed(null);
  };

  const selectedImageAlignment = selectedImage ? inferImageAlignment(selectedImage) : null;
  const selectedImageSize = selectedImage ? inferImageSize(selectedImage) : null;
  const selectedVideoAlignment = selectedVideoEmbed
    ? inferVideoAlignment(selectedVideoEmbed)
    : null;

  return (
    <div
      ref={editorShellRef}
      onBlurCapture={flushPendingEditorChange}
      className="relative flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2a2b36] dark:bg-[#1a1b26]"
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
        className={`sticky top-0 z-20 flex flex-wrap items-center gap-1.5 border-b bg-white/95 px-3 py-2.5 backdrop-blur-md transition-[box-shadow,border-color,background-color] duration-200 dark:bg-[#16161e]/95 ${
          isToolbarElevated
            ? 'border-slate-300 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/70 dark:border-[#333544] dark:shadow-black/30 dark:ring-white/10'
            : 'border-slate-200 shadow-none ring-0 dark:border-[#2a2b36]'
        }`}
      >
        <ToolButton icon={<Undo size={16} />} onClick={() => execCmd('undo')} title="Undo" />
        <ToolButton icon={<Redo size={16} />} onClick={() => execCmd('redo')} title="Redo" />
        <Divider />

        {/* Headings - Icon Pills */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-[#1a1b26] rounded-lg border border-slate-200 dark:border-[#333544] p-0.5">
          {([1, 2, 3, 4, 5, 6] as const).map((level) => (
            <button
              key={level}
              onMouseDown={(e) => {
                e.preventDefault();
                insertHeading(level);
              }}
              className="px-2 py-1 text-xs font-bold rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#242633] transition-colors"
              title={`Heading ${level}`}
            >
              H{level}
            </button>
          ))}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              execCmd('formatBlock', 'p');
            }}
            className="px-2 py-1 text-xs font-medium rounded text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-[#242633] transition-colors"
            title="Normal paragraph"
          >
            ¶
          </button>
        </div>
        <ToolButton
          icon={<Bold size={16} />}
          onClick={() => execCmd('bold')}
          title="Bold (Ctrl+B)"
        />
        <ToolButton
          icon={<Italic size={16} />}
          onClick={() => execCmd('italic')}
          title="Italic (Ctrl+I)"
        />
        <ToolButton
          icon={<Underline size={16} />}
          onClick={() => execCmd('underline')}
          title="Underline (Ctrl+U)"
        />
        <div className="relative flex items-center">
          <ToolButton
            icon={<Palette size={16} className="text-rose-500" />}
            onClick={() => {
              const input = document.getElementById('editor-color-picker') as HTMLInputElement;
              if (input) input.click();
            }}
            title="Text Color"
          />
          <input
            aria-label="Editor Color Picker"
            id="editor-color-picker"
            type="color"
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer pointer-events-none"
            onChange={(e) => execCmd('foreColor', e.target.value)}
            style={{ width: '0px', height: '0px', padding: 0 }}
          />
        </div>
        <Divider />
        <ToolButton
          icon={<List size={16} />}
          onClick={() => execCmd('insertUnorderedList')}
          title="Bullet List"
        />
        <ToolButton
          icon={<ListOrdered size={16} />}
          onClick={() => execCmd('insertOrderedList')}
          title="Numbered List"
        />
        <ToolButton
          icon={<Quote size={16} className="text-blue-500" />}
          onClick={insertBlockquote}
          title="Blockquote"
        />
        <ToolButton
          icon={<Minus size={16} />}
          onClick={() => execCmd('insertHorizontalRule')}
          title="Horizontal Line"
        />
        <Divider />
        <ToolButton
          icon={<Link size={16} className="text-sky-500" />}
          onClick={() => openModal('link')}
          title="Insert Hyperlink"
        />

        {/* Insert Image Dropdown UI */}
        <div className="relative" ref={imageMenuRef}>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setIsImageMenuOpen(!isImageMenuOpen);
            }}
            className="flex h-9 cursor-pointer shadow-sm transition-colors duration-150 items-center overflow-hidden rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:shadow dark:border-[#2a2b36] dark:bg-[#1a1b26]/90 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-[#242633] dark:hover:text-white"
            title="Insert Image Options"
            type="button"
          >
            <span className="flex h-full items-center justify-center px-2.5">
              <Image size={16} className="text-emerald-500" />
            </span>
            <span className="h-5 w-px bg-slate-200 dark:bg-slate-600" />
            <span className="flex h-full items-center justify-center px-2">
              <ChevronDown size={13} className="text-slate-400" />
            </span>
          </button>
          {isImageMenuOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white dark:bg-[#1a1b26] rounded-lg shadow-xl border border-slate-200 dark:border-[#2a2b36] w-48 z-[60] overflow-hidden flex flex-col py-1 animate-fade-in">
              <button
                onClick={() => {
                  openModal('image');
                  setIsImageMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633]/50 transition-colors text-left"
              >
                <Image size={16} className="text-emerald-500" />
                Insert via URL
              </button>
              <button
                onClick={() => {
                  openModal('mediaLibrary');
                  setIsImageMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633]/50 transition-colors text-left"
              >
                <Images size={16} className="text-indigo-500" />
                Browse Library
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsImageMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#242633]/50 transition-colors text-left"
              >
                <Upload size={16} className="text-violet-500" />
                Upload from Device
              </button>
            </div>
          )}
        </div>

        <input
          id="editor-878"
          name="editor878"
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            // Save cursor position before async upload
            if (editor) {
              savedSelection.current = {
                from: editor.state.selection.from,
                to: editor.state.selection.to,
              };
            }

            e.target.value = '';
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
                  const res = await vonFetch(API.uploadFile, {
                    method: 'POST',
                    body: formData,
                  });
                  const data = await res.json();
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
                  uploadedImages.length > 1
                    ? `${uploadedImages.length} images inserted`
                    : 'Image inserted'
                );
              }

              if (failedCount > 0) {
                notify.error(
                  failedCount === files.length
                    ? 'Upload failed'
                    : `${failedCount} upload${failedCount > 1 ? 's' : ''} failed`
                );
              }
            } catch (err: any) {
              notify.error('Upload error: ' + err.message);
            } finally {
              notify.dismiss(toastId);
            }
          }}
        />
        <ToolButton
          icon={<Video size={16} className="text-red-500" />}
          onClick={insertVideo}
          title="Insert Video (YouTube/TikTok)"
        />
        <ToolButton
          icon={<Table size={16} className="text-teal-500" />}
          onClick={insertTable}
          title="Insert Data Table"
        />
        <Divider />
        <ToolButton
          icon={<AlignLeft size={16} />}
          onClick={() => alignImage('left')}
          title="Align Left"
        />
        <ToolButton
          icon={<AlignCenter size={16} />}
          onClick={() => alignImage('center')}
          title="Align Center"
        />
        <ToolButton
          icon={<AlignRight size={16} />}
          onClick={() => alignImage('right')}
          title="Align Right"
        />
        <ToolButton
          icon={<AlignJustify size={16} />}
          onClick={() => alignImage('justify')}
          title="Justify Text"
        />
        <Divider />
        <div className="flex items-center bg-white dark:bg-[#1a1b26] rounded-md border border-slate-200 dark:border-[#333544] p-0.5">
          <ToolButton
            icon={<Code size={15} className="text-amber-500" />}
            onClick={insertCodeBlock}
            title="Code Block"
          />
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600"></div>
          <ToolButton
            icon={<Braces size={15} className={isCodeView ? 'text-blue-600' : 'text-cyan-500'} />}
            onClick={toggleCodeView}
            title="HTML Source"
          />
        </div>
        <Divider />
        <ToolButton
          icon={<Eye size={16} className="text-violet-500" />}
          onClick={() => {
            setSelectedImage(null);
            setSelectedVideoEmbed(null);
            setPreviewHtml(buildPreviewHtml(isCodeView ? htmlContent : getCurrentEditorHtml()));
            setIsPreviewOpen(true);
          }}
          title="Live Preview"
        />
      </div>

      {/* HTML Code View */}
      <textarea
        id="editor-1011"
        name="editor1011"
        aria-label="Text Content"
        value={htmlContent}
        onChange={handleHtmlChange}
        className="flex-grow p-4 outline-none font-mono text-sm bg-[#101018] text-slate-300 resize-none rounded-b-lg"
        spellCheck={false}
        style={{ minHeight: '300px', display: isCodeView ? 'block' : 'none' }}
        placeholder="<p>Edit HTML here...</p>"
      />

      {/* WYSIWYG Visual Editor - TipTap owns the editing surface */}
      <div
        ref={editorRef}
        className="editor-content relative flex-grow overflow-y-auto bg-white focus-within:ring-2 focus-within:ring-sky-500/30 focus-within:ring-inset dark:bg-[#101018]/80 [&_iframe]:pointer-events-none"
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

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center backdrop-blur-xl p-4">
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] border border-slate-200 dark:border-[#2a2b36] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Eye size={18} className="text-blue-500" />
                Preview Content
              </h3>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-[#242633] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-grow">
              <ContentRenderer
                className="prose prose-lg dark:prose-invert max-w-none"
                html={previewHtml}
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor Input Modal (Link, Video, Code, Table) */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-[#2a2b36] overflow-hidden transform transition-all scale-100">
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
                onClick={closeModal}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {activeModal === 'table' ? (
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
                      min="1"
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                      min="1"
                      value={modalInput2}
                      onChange={(e) => setModalInput2(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
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
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
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
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-[#333544] rounded-lg bg-slate-50 dark:bg-[#16161e] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={
                      activeModal === 'video' ? 'https://youtube.com/...' : 'https://example.com'
                    }
                  />
                  {activeModal === 'video' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Supports YouTube, TikTok, Facebook or supported iframe embeds.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer with Quick Release Button */}
            <div className="p-4 bg-slate-50 dark:bg-[#16161e]/50 border-t border-slate-100 dark:border-[#2a2b36] flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#242633] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
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
        </div>
      )}

      {/* Media Library Modal */}
      {activeModal === 'mediaLibrary' && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] border border-slate-200 dark:border-[#2a2b36] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Images size={18} className="text-blue-500" />
                Media Library
              </h3>
              <button
                onClick={closeModal}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#242633] transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 bg-slate-100 dark:bg-[#16161e] custom-scrollbar">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {mediaFiles.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleMediaSelect(file)} // Pass full file object
                      className="group cursor-pointer bg-white dark:bg-[#1a1b26] rounded-lg border border-slate-200 dark:border-[#2a2b36] overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm"
                    >
                      <div className="aspect-square relative bg-slate-100 dark:bg-[#16161e]">
                        <img
                          src={file.webpUrl || file.url}
                          alt={file.filename}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                            Select
                          </span>
                        </div>
                      </div>
                      <div className="p-2 text-xs truncate text-slate-600 dark:text-slate-300 font-medium">
                        {file.filename}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50">
              <SmartPagination
                currentPage={mediaPagination.currentPage}
                totalPages={mediaPagination.totalPages}
                onPageChange={(page) => fetchMedia(page)}
                itemsPerPage={mediaPagination.limit}
                totalItems={mediaPagination.totalItems}
              />
              <div className="flex justify-end mt-4">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-white dark:bg-[#1a1b26] border border-slate-300 dark:border-[#333544] rounded-lg hover:bg-slate-50 dark:hover:bg-[#242633] transition-colors text-xs font-bold dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Bubble Menu */}
      {selectedImage && (
        <div
          className="absolute z-[70] bg-white dark:bg-[#1a1b26] shadow-xl border border-slate-200 dark:border-[#2a2b36] rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
          style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Image Tools</span>
            <button
              onClick={() => setSelectedImage(null)}
              className="ml-auto text-slate-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded p-1">
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

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded p-1">
            <span className="text-[10px] text-slate-500 font-semibold px-1">SIZE</span>
            {(['25', '50', '75', '100'] as const).map((size) => (
              <button
                key={size}
                onClick={() => resizeImage(size)}
                className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
                  selectedImageSize === size
                    ? 'bg-blue-600 text-white shadow-sm'
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
                className="flex-grow text-xs p-1.5 border border-slate-300 dark:border-[#333544] rounded bg-slate-50 dark:bg-[#16161e] dark:text-white"
                placeholder="Describe image..."
              />
              <button
                onClick={updateImageAlt}
                className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700"
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
                className="flex-grow text-xs p-1.5 border border-slate-300 dark:border-[#333544] rounded bg-slate-50 dark:bg-[#16161e] dark:text-white"
                placeholder="e.g. Bernama, Reuters, AP, AFP..."
              />
              <button
                onClick={updateImageCredit}
                className="bg-cyan-600 text-white p-1.5 rounded hover:bg-cyan-700"
                title="Save Credit"
              >
                <CheckCircle size={14} />
              </button>
            </div>
          </div>

          <button
            onClick={setAsFeaturedIndex}
            className="text-xs p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded hover:bg-amber-100 flex items-center justify-center gap-1 font-medium mt-1"
          >
            <Sparkles size={14} /> Set as Featured Image
          </button>
        </div>
      )}

      {/* Video Bubble Menu */}
      {selectedVideoEmbed && (
        <div
          className="absolute z-[70] bg-white dark:bg-[#1a1b26] shadow-xl border border-slate-200 dark:border-[#2a2b36] rounded-lg p-2 flex flex-col gap-2 w-72 animate-fade-in"
          style={{ top: bubblePosition.top, left: Math.max(10, bubblePosition.left) }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Video Tools</span>
            <button
              onClick={() => setSelectedVideoEmbed(null)}
              className="ml-auto text-slate-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded p-1">
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

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#16161e] rounded p-1">
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
                onClick={() => applyVideoAspectMode(mode)}
                className={`px-2 py-1 text-[11px] font-bold rounded transition-all ${
                  selectedVideoAspect === mode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1a1b26]'
                }`}
                title={`Set video aspect to ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ToolButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}> = ({ icon, onClick, title, active = false }) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={`flex h-9 w-9 cursor-pointer shadow-sm transition-colors duration-150 items-center justify-center rounded-lg border hover:shadow ${
      active
        ? 'border-blue-500 bg-blue-600 text-white shadow-blue-500/20 dark:border-blue-400 dark:bg-blue-500 dark:text-white'
        : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-[#2a2b36] dark:bg-[#1a1b26]/90 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-[#242633] dark:hover:text-white'
    }`}
    title={title}
  >
    {icon}
  </button>
);

const Divider = () => (
  <div className="mx-0.5 h-6 w-px rounded bg-slate-200 dark:bg-[#242633]"></div>
);

export default React.memo(Editor);
