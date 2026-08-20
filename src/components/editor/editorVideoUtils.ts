import {
  DEFAULT_VIDEO_ALLOW,
  VIDEO_ASPECT_STYLES,
  type VideoAspectMode,
} from './editorVideoContracts';

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
  const isValidId = (value?: string | null) => Boolean(value && /^[a-zA-Z0-9_-]{11}$/.test(value));

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

export const inferVideoAspectMode = (
  iframe: HTMLIFrameElement
): Exclude<VideoAspectMode, 'auto'> => {
  const src = iframe.getAttribute('src') || '';
  const parsed = parseVideoUrl(src);
  const host = parsed ? normalizeVideoHost(parsed.hostname) : '';
  const path = parsed?.pathname || '';
  if (parsed?.searchParams.get('von_vertical') === 'shorts') return 'portrait';
  if (isVideoHost(host, 'tiktok.com') && path.startsWith('/player/')) return 'portrait';
  if (isVideoHost(host, 'instagram.com') && path.startsWith('/reel/')) return 'portrait';
  if (
    isVideoHost(host, 'facebook.com') &&
    path === '/plugins/video.php' &&
    parsed?.searchParams.get('width') === '380'
  ) {
    return 'portrait';
  }
  return 'landscape';
};

export const buildEditorVideoEmbedHtml = (input: string): string => {
  if (!input.trim()) return '';
  if (input.trim().startsWith('<')) return input;

  const portraitVideoStyle = VIDEO_ASPECT_STYLES.portrait;
  const landscapeVideoStyle = VIDEO_ASPECT_STYLES.landscape;
  const youtubeVideo = extractYouTubeVideo(input);
  if (youtubeVideo) {
    const src = `https://www.youtube.com/embed/${youtubeVideo.id}${youtubeVideo.isShorts ? '?playsinline=1&von_vertical=shorts' : ''}`;
    return youtubeVideo.isShorts
      ? `<iframe width="100%" height="676" src="${src}" frameborder="0" allow="${DEFAULT_VIDEO_ALLOW}" allowfullscreen data-von-video-aspect="portrait" style="${portraitVideoStyle}" title="YouTube Shorts embed"></iframe>`
      : `<iframe width="100%" height="400" src="${src}" frameborder="0" allow="${DEFAULT_VIDEO_ALLOW}" allowfullscreen style="${landscapeVideoStyle}" title="YouTube video embed"></iframe>`;
  }

  const tiktokVideoId = extractTikTokVideoId(input);
  if (tiktokVideoId) {
    return `<iframe width="100%" height="676" src="https://www.tiktok.com/player/v1/${tiktokVideoId}" frameborder="0" scrolling="no" allowfullscreen title="TikTok video embed" data-von-video-aspect="portrait" style="${portraitVideoStyle}"></iframe>`;
  }

  const instagramReelId = extractInstagramReelId(input);
  if (instagramReelId) {
    return `<iframe width="100%" height="676" src="https://www.instagram.com/reel/${instagramReelId}/embed" frameborder="0" scrolling="no" allowfullscreen title="Instagram Reel embed" data-von-video-aspect="portrait" style="${portraitVideoStyle}"></iframe>`;
  }

  if (isFacebookVideoUrl(input)) {
    const encodedUrl = encodeURIComponent(input);
    const isFacebookReel = isFacebookReelUrl(input);
    return `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&width=${isFacebookReel ? '380' : '560'}" width="100%" height="${isFacebookReel ? '676' : '400'}" style="${isFacebookReel ? portraitVideoStyle : landscapeVideoStyle}" scrolling="no" frameborder="0" allowfullscreen="true" ${isFacebookReel ? 'data-von-video-aspect="portrait"' : ''} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true" title="Facebook video embed"></iframe>`;
  }

  return '';
};
