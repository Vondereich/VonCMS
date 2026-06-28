import React from 'react';
import { SidebarWidget, SiteSettings, Post } from '../../../types';
import { AdBlock, sanitizeHtml } from '../../shared';
import { getPermalink } from '../../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../../utils/linkEvents';

// Theme colors for custom theme overrides
interface ThemeColors {
  surface?: string;
  border?: string;
  text?: string;
  textSecondary?: string;
}

interface SidebarProps {
  widget: SidebarWidget;
  settings: SiteSettings;
  posts?: Post[];
  onPostClick?: (id: string) => void;
  themeColors?: ThemeColors;
}

export const VpSidebarWidget: React.FC<SidebarProps> = ({
  widget,
  settings,
  posts = [],
  onPostClick,
  themeColors,
}) => {
  if (!widget.isVisible) return null;

  const boxStyle = {
    borderRadius: '1.5rem', // Digest uses more rounded corners
    ...(themeColors
      ? { backgroundColor: themeColors.surface, borderColor: themeColors.border }
      : {}),
  };

  // Digest style: lighter, more vibrant
  const boxClass = themeColors
    ? 'p-8 border animate-fade-in shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
    : 'bg-white dark:bg-[#16161d] p-8 border border-zinc-100 dark:border-zinc-800 animate-fade-in shadow-[0_8px_30px_rgba(0,0,0,0.04)]';

  switch (widget.type) {
    case 'trending':
      const limit = widget.itemCount || 5;
      const trendingPosts = posts.filter((p) => p.status === 'published').slice(0, limit);

      if (trendingPosts.length === 0) return null;

      return (
        <div className={boxClass} style={boxStyle}>
          <h4
            className="font-black text-zinc-900 dark:text-white mb-8 border-b pb-4 flex items-center justify-between"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.08)' }}
          >
            <span className="flex items-center gap-2">
              <span className="text-cyan-500">✨</span> {widget.title}
            </span>
            <span className="text-[10px] font-black uppercase opacity-40">Top {limit}</span>
          </h4>
          <ul className="space-y-6">
            {trendingPosts.map((post, index) => (
              <li key={post.id} className="group cursor-pointer">
                <a
                  href={getPermalink(post, settings)}
                  onClick={(event) => {
                    if (!onPostClick) return;
                    handleCrawlableLinkClick(event, () => onPostClick(post.id));
                  }}
                  className="flex gap-4 items-start"
                >
                  <span
                    className="text-3xl font-black text-zinc-900/10 dark:text-white/10 group-hover:text-[var(--primary)] group-hover:opacity-100 transition-all duration-300"
                    style={{ '--primary': settings.theme.primaryColor } as any}
                  >
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div>
                    <p
                      className="text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-cyan-500 transition-colors leading-snug line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
                    />
                    <div className="flex items-center gap-2 mt-2 opacity-50 text-[10px] font-bold uppercase tracking-widest">
                      <span>{post.category}</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt || '').toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{post.readTime || '5 min read'}</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'custom':
      return (
        <div className={boxClass} style={boxStyle}>
          <h4
            className="font-black text-zinc-900 dark:text-white mb-6 border-b pb-4 text-center uppercase tracking-widest text-xs"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.08)' }}
          >
            {widget.title}
          </h4>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium flex flex-col items-center text-center">
            <AdBlock
              content={widget.content || ''}
              className="w-full"
              slotId={`sidebar-${widget.id}`}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};
