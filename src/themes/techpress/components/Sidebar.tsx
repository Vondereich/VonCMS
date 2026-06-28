import React from 'react';
import { SidebarWidget, SiteSettings, Post } from '../../../types';
import { AdBlock, sanitizeHtml } from '../../shared';
import { getPermalink } from '../../../utils/siteUtils';
import { handleCrawlableLinkClick } from '../../../utils/linkEvents';

// Theme colors for custom theme overrides
interface ThemeColors {
  surface?: string; // Card/box background
  border?: string; // Border color
  text?: string; // Primary text
  textSecondary?: string; // Secondary text
}

interface SidebarProps {
  widget: SidebarWidget;
  settings: SiteSettings;
  posts?: Post[];
  onPostClick?: (id: string) => void;
  themeColors?: ThemeColors; // Optional theme color overrides
}

export const VpSidebarWidget: React.FC<SidebarProps> = ({
  widget,
  settings,
  posts = [],
  onPostClick,
  themeColors,
}) => {
  if (!widget.isVisible) return null;

  // Premium Card Style for Sidebar - use themeColors if provided
  const boxStyle = {
    borderRadius: 'var(--border-radius)',
    ...(themeColors
      ? { backgroundColor: themeColors.surface, borderColor: themeColors.border }
      : {}),
  };

  // TechPress uses a more neutral gray/zinc palette
  const boxClass = themeColors
    ? 'p-8 border animate-fade-in shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]'
    : 'bg-white dark:bg-neutral-900 p-8 border border-neutral-100 dark:border-neutral-800 animate-fade-in shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';

  switch (widget.type) {
    case 'trending':
      const limit = widget.itemCount || 5;
      const trendingPosts = posts.filter((p) => p.status === 'published').slice(0, limit);

      if (trendingPosts.length === 0) return null;

      return (
        <div className={boxClass} style={boxStyle}>
          <h4
            className="font-black text-neutral-900 dark:text-white mb-6 border-b pb-4 flex items-center gap-2 uppercase tracking-tight text-lg"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.1)' }}
          >
            <span className="text-red-600">🔥</span> {widget.title}
          </h4>
          <ul className="space-y-5">
            {trendingPosts.map((post, index) => (
              <li
                key={post.id}
                className="group cursor-pointer border-b last:border-0 pb-4 last:pb-0"
                style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.05)' }}
              >
                <a
                  href={getPermalink(post, settings)}
                  onClick={(event) => {
                    if (!onPostClick) return;
                    handleCrawlableLinkClick(event, () => onPostClick(post.id));
                  }}
                  className="flex gap-4"
                >
                  <span className="text-2xl font-black opacity-10 group-hover:opacity-30 transition-opacity">
                    {index + 1}
                  </span>
                  <div>
                    <p
                      className="text-sm font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
                    />
                    <span className="text-[10px] uppercase font-bold opacity-50 mt-1 block">
                      {new Date(post.createdAt || '').toLocaleDateString()}
                    </span>
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
            className="font-black text-neutral-900 dark:text-white mb-6 border-b pb-4 text-center uppercase tracking-tight text-lg"
            style={{ borderColor: themeColors?.border || 'rgba(0,0,0,0.1)' }}
          >
            {widget.title}
          </h4>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium flex flex-col items-center text-center">
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
