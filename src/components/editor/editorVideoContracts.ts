export type VideoAspectMode = 'auto' | 'portrait' | 'landscape';

export const DEFAULT_VIDEO_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

export const VIDEO_ASPECT_STYLES: Record<Exclude<VideoAspectMode, 'auto'>, string> = {
  portrait:
    'width:100%; max-width:380px; aspect-ratio: 9 / 16; height:auto; border:none; overflow:hidden; margin-left:auto; margin-right:auto; display:block;',
  landscape:
    'width:100%; max-width:100%; aspect-ratio: 16 / 9; height:auto; border:none; overflow:hidden; margin-left:auto; margin-right:auto; display:block;',
};
