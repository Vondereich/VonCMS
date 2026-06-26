import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';

export type MediaAlignment = 'left' | 'center' | 'right' | 'justify';
export type VideoAspectMode = 'auto' | 'portrait' | 'landscape';
export type ImageSize = '25' | '50' | '75' | '100';
export type LegacyImageAttrs = {
  src?: string | null;
  alt?: string;
  title?: string | null;
  style?: string;
  figureStyle?: string;
  'data-id'?: string | null;
  'data-von-image-size'?: ImageSize | null;
  'data-von-image-align'?: Exclude<MediaAlignment, 'justify'> | null;
  credit?: string;
};
export type LegacyImageMatch = { pos: number; attrs: LegacyImageAttrs };

const DEFAULT_IMAGE_STYLE = 'max-width: 100%; height: auto;';
const DEFAULT_FIGURE_STYLE = 'margin: 1rem 0; text-align: center;';
const DEFAULT_FIGCAPTION_STYLE =
  'font-size: 0.75rem; color: #94a3b8; font-style: italic; margin-top: 0.25rem;';
export const DEFAULT_VIDEO_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
export const EDITOR_SURFACE_CLASS = 'hourglass-editor-surface';

export const VIDEO_ASPECT_STYLES: Record<Exclude<VideoAspectMode, 'auto'>, string> = {
  portrait:
    'width:100%; max-width:380px; aspect-ratio: 9 / 16; height:auto; border:none; overflow:hidden; margin-left:auto; margin-right:auto; display:block;',
  landscape:
    'width:100%; max-width:100%; aspect-ratio: 16 / 9; height:auto; border:none; overflow:hidden; margin-left:auto; margin-right:auto; display:block;',
};

const readHtmlAttr = (value: string | null) => {
  const normalized = value?.trim() || '';
  return normalized.length > 0 ? normalized : null;
};

const readImageSize = (value: string | null): ImageSize | null =>
  value === '25' || value === '50' || value === '75' || value === '100' ? value : null;

const resolveImageAlignment = (alignment: MediaAlignment) =>
  alignment === 'right' ? 'right' : alignment === 'left' ? 'left' : 'center';

const readImageAlignment = (value: string | null): Exclude<MediaAlignment, 'justify'> | null =>
  value === 'left' || value === 'center' || value === 'right' ? value : null;

const applyImageStyleDefaults = (scratch: HTMLElement) => {
  if (!scratch.style.maxWidth) scratch.style.maxWidth = '100%';
  if (!scratch.style.height) scratch.style.height = 'auto';
};

const applyImageAlignmentMargins = (
  scratch: HTMLElement,
  alignment: Exclude<MediaAlignment, 'justify'>
) => {
  scratch.style.display = 'block';
  scratch.style.marginLeft = alignment === 'center' || alignment === 'right' ? 'auto' : '0';
  scratch.style.marginRight = alignment === 'center' || alignment === 'left' ? 'auto' : '0';
};

const hasDefaultHorizontalImageMargins = (scratch: HTMLElement) =>
  (!scratch.style.marginLeft && !scratch.style.marginRight) ||
  ((scratch.style.marginLeft === '0px' || scratch.style.marginLeft === '0') &&
    (scratch.style.marginRight === '0px' || scratch.style.marginRight === '0'));

const normalizeImageStyle = (styleValue: string | null | undefined) => {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', styleValue || DEFAULT_IMAGE_STYLE);
  applyImageStyleDefaults(scratch);

  const textAlignment = readImageAlignment(scratch.style.textAlign) || 'center';
  if (scratch.style.textAlign && hasDefaultHorizontalImageMargins(scratch)) {
    applyImageAlignmentMargins(scratch, textAlignment);
  }

  return scratch.getAttribute('style') || DEFAULT_IMAGE_STYLE;
};

const inferImageSizeFromStyle = (styleValue: string | null | undefined): ImageSize => {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', normalizeImageStyle(styleValue));
  const width = scratch.style.width.replace(/\s+/g, '');
  if (width === '25%') return '25';
  if (width === '50%') return '50';
  if (width === '75%') return '75';
  return '100';
};

const buildLegacyImageAttrsFromElement = (image: HTMLElement, credit = '') => {
  const src = readHtmlAttr(image.getAttribute('src'));
  if (!src) return false;
  const figure = image.closest('figure') as HTMLElement | null;
  const figureStyle = figure
    ? figure.getAttribute('style') || DEFAULT_FIGURE_STYLE
    : DEFAULT_FIGURE_STYLE;

  const style = normalizeImageStyle(image.getAttribute('style'));
  const explicitAlignment = readImageAlignment(image.getAttribute('data-von-image-align'));
  const explicitSize = readImageSize(image.getAttribute('data-von-image-size'));
  const resolvedSize = explicitSize || inferImageSizeFromStyle(style);
  const resolvedAlignment = explicitAlignment || inferImageAlignment(image as HTMLImageElement);
  let resolvedStyle = buildImageWidthStyle(style, resolvedSize);
  resolvedStyle = buildImageAlignmentStyle(resolvedStyle, resolvedAlignment);

  return {
    src,
    alt: image.getAttribute('alt') || '',
    title: readHtmlAttr(image.getAttribute('title')),
    style: resolvedStyle,
    figureStyle,
    'data-id': readHtmlAttr(image.getAttribute('data-id')),
    'data-von-image-size': resolvedSize,
    'data-von-image-align': resolvedAlignment,
    credit,
  };
};

export const inferImageAlignment = (img: HTMLImageElement): MediaAlignment => {
  const explicitAlignment = readImageAlignment(img.getAttribute('data-von-image-align'));
  if (explicitAlignment) return explicitAlignment;
  if (img.style.marginLeft === 'auto' && img.style.marginRight === '0px') return 'right';
  if (img.style.marginLeft === 'auto' && img.style.marginRight === '0') return 'right';
  if (img.style.marginLeft === '0px' && img.style.marginRight === 'auto') return 'left';
  if (img.style.marginLeft === '0' && img.style.marginRight === 'auto') return 'left';
  return 'center';
};

export const inferImageSize = (img: HTMLImageElement): ImageSize =>
  readImageSize(img.getAttribute('data-von-image-size')) ||
  inferImageSizeFromStyle(img.getAttribute('style'));

export const buildImageUpdateBaseStyle = (
  nodeStyle: string | null | undefined,
  domStyle: string | null | undefined
) => {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', normalizeImageStyle(domStyle || nodeStyle));

  if (nodeStyle) {
    const nodeScratch = document.createElement('span');
    nodeScratch.setAttribute('style', normalizeImageStyle(nodeStyle));
    for (let i = 0; i < nodeScratch.style.length; i += 1) {
      const property = nodeScratch.style.item(i);
      scratch.style.setProperty(
        property,
        nodeScratch.style.getPropertyValue(property),
        nodeScratch.style.getPropertyPriority(property)
      );
    }
  }

  applyImageStyleDefaults(scratch);
  return scratch.getAttribute('style') || DEFAULT_IMAGE_STYLE;
};

export const buildImageAlignmentStyle = (
  styleValue: string | null | undefined,
  alignment: MediaAlignment
) => {
  const resolvedAlignment = resolveImageAlignment(alignment);
  const scratch = document.createElement('span');
  scratch.setAttribute('style', normalizeImageStyle(styleValue));
  applyImageAlignmentMargins(scratch, resolvedAlignment);
  applyImageStyleDefaults(scratch);
  return scratch.getAttribute('style') || DEFAULT_IMAGE_STYLE;
};

export const buildFigureAlignmentStyle = (
  styleValue: string | null | undefined,
  alignment: MediaAlignment
) => {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', styleValue || DEFAULT_FIGURE_STYLE);
  scratch.style.textAlign = resolveImageAlignment(alignment);
  return scratch.getAttribute('style') || DEFAULT_FIGURE_STYLE;
};

export const buildImageWidthStyle = (styleValue: string | null | undefined, size: ImageSize) => {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', normalizeImageStyle(styleValue));
  scratch.style.width = size === '100' ? '100%' : `${size}%`;
  scratch.style.height = 'auto';
  applyImageStyleDefaults(scratch);
  return scratch.getAttribute('style') || DEFAULT_IMAGE_STYLE;
};

const buildVideoEmbedAttrs = (iframe: HTMLElement) => {
  const src = readHtmlAttr(iframe.getAttribute('src'));
  if (!src) return false;

  return {
    src,
    title: iframe.getAttribute('title') || 'Embedded video',
    width: iframe.getAttribute('width') || '100%',
    height: iframe.getAttribute('height') || '400',
    frameborder: iframe.getAttribute('frameborder') || '0',
    allow: iframe.getAttribute('allow') || DEFAULT_VIDEO_ALLOW,
    allowfullscreen:
      iframe.getAttribute('allowfullscreen') || iframe.getAttribute('allowFullScreen') || 'true',
    scrolling: readHtmlAttr(iframe.getAttribute('scrolling')),
    style: iframe.getAttribute('style') || VIDEO_ASPECT_STYLES.landscape,
    'data-von-video-aspect': readHtmlAttr(iframe.getAttribute('data-von-video-aspect')),
  };
};

const LegacyImage = TiptapNode.create({
  name: 'legacyImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      title: { default: null },
      style: { default: DEFAULT_IMAGE_STYLE },
      figureStyle: { default: DEFAULT_FIGURE_STYLE },
      'data-id': { default: null },
      'data-von-image-size': { default: null },
      'data-von-image-align': { default: null },
      credit: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (node) => {
          const figure = node as HTMLElement;
          const image = figure.querySelector('img');
          if (!image) return false;

          const credit = figure.querySelector('figcaption')?.textContent?.trim() || '';
          return buildLegacyImageAttrsFromElement(image, credit);
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (node) => buildLegacyImageAttrsFromElement(node as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const renderImageSize = readImageSize(HTMLAttributes['data-von-image-size']);
    const renderImageAlignment = readImageAlignment(HTMLAttributes['data-von-image-align']);
    let imageStyle = normalizeImageStyle(HTMLAttributes['style'] || DEFAULT_IMAGE_STYLE);
    if (renderImageSize) {
      imageStyle = buildImageWidthStyle(imageStyle, renderImageSize);
    }
    if (renderImageAlignment) {
      imageStyle = buildImageAlignmentStyle(imageStyle, renderImageAlignment);
    }

    const imageAttrs = mergeAttributes({
      src: HTMLAttributes['src'],
      alt: HTMLAttributes['alt'] || '',
      style: imageStyle,
    });

    if (HTMLAttributes['title']) {
      imageAttrs['title'] = HTMLAttributes['title'];
    }

    if (HTMLAttributes['data-id']) {
      imageAttrs['data-id'] = HTMLAttributes['data-id'];
    }

    if (HTMLAttributes['data-von-image-size']) {
      imageAttrs['data-von-image-size'] = HTMLAttributes['data-von-image-size'];
    }

    if (HTMLAttributes['data-von-image-align']) {
      imageAttrs['data-von-image-align'] = HTMLAttributes['data-von-image-align'];
    }

    const credit =
      typeof HTMLAttributes['credit'] === 'string' ? HTMLAttributes['credit'].trim() : '';
    if (credit) {
      return [
        'figure',
        { style: HTMLAttributes['figureStyle'] || DEFAULT_FIGURE_STYLE },
        ['img', imageAttrs],
        ['figcaption', { style: DEFAULT_FIGCAPTION_STYLE }, credit],
      ];
    }

    return [
      'figure',
      { style: HTMLAttributes['figureStyle'] || DEFAULT_FIGURE_STYLE },
      ['img', imageAttrs],
    ];
  },
});

const VideoEmbed = TiptapNode.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: 'Embedded video' },
      width: { default: '100%' },
      height: { default: '400' },
      frameborder: { default: '0' },
      allow: { default: DEFAULT_VIDEO_ALLOW },
      allowfullscreen: { default: 'true' },
      scrolling: { default: null },
      style: { default: VIDEO_ASPECT_STYLES.landscape },
      'data-von-video-aspect': { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
        getAttrs: (node) => buildVideoEmbedAttrs(node as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const iframeAttrs = mergeAttributes({
      src: HTMLAttributes['src'],
      title: HTMLAttributes['title'] || 'Embedded video',
      width: HTMLAttributes['width'] || '100%',
      height: HTMLAttributes['height'] || '400',
      frameborder: HTMLAttributes['frameborder'] || '0',
      allow: HTMLAttributes['allow'] || DEFAULT_VIDEO_ALLOW,
      allowfullscreen: HTMLAttributes['allowfullscreen'] || 'true',
      style: HTMLAttributes['style'] || VIDEO_ASPECT_STYLES.landscape,
    });

    if (HTMLAttributes['scrolling']) {
      iframeAttrs['scrolling'] = HTMLAttributes['scrolling'];
    }

    if (HTMLAttributes['data-von-video-aspect']) {
      iframeAttrs['data-von-video-aspect'] = HTMLAttributes['data-von-video-aspect'];
    }

    return ['iframe', iframeAttrs];
  },
});

export const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
    link: false,
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  TextStyleKit,
  TiptapLink.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  TableKit,
  LegacyImage,
  VideoEmbed,
];
