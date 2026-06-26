import React from 'react';
import { Post, SiteSettings } from '../types';
import { AISummaryComponent } from '../plugins/von-core/features/plugins/built-in/ai-summary/AISummaryComponent';
import { AISummaryConfig } from '../plugins/von-core/features/plugins/built-in/ai-summary/types';
import { RelatedPostsComponent } from '../plugins/von-core/features/plugins/built-in/related-posts/RelatedPostsComponent';
import { RelatedPostsConfig } from '../plugins/von-core/features/plugins/built-in/related-posts/types';
import { isSystemPluginActive } from '../utils/pluginRuntime';

/**
 * Hook to render AI Summary component if plugin is active
 */
export function useAISummary(
  settings: SiteSettings,
  postContent: string
): { component: React.ReactNode; position: 'top' | 'bottom' } | null {
  // Check if plugin is active
  if (!isSystemPluginActive(settings, 'vp_ai_summary')) return null;

  // Get config
  const config: AISummaryConfig = settings.pluginConfig?.['vp_ai_summary'] || {
    enabled: true,
    maxBullets: 5,
    extractMethod: 'hybrid',
    showLabel: true,
    labelText: 'AI Summary',
    position: 'top',
  };

  if (!config.enabled) return null;

  return {
    // Add key to force re-initialization when content changes (e.g. from empty to loaded)
    component: (
      <AISummaryComponent
        key={postContent?.substring(0, 64)}
        config={config}
        content={postContent}
      />
    ),
    position: config.position,
  };
}

/**
 * Hook to render Related Posts component if plugin is active
 */
export function useRelatedPosts(
  settings: SiteSettings,
  currentPost: Post,
  allPosts: Post[],
  onPostClick?: (post: Post) => void,
  themeColors?: any
): React.ReactNode | null {
  // Check if plugin is active
  if (!isSystemPluginActive(settings, 'vp_related_posts')) return null;
  if (!currentPost || !Array.isArray(allPosts) || allPosts.length === 0) return null;

  // Get config
  const config: RelatedPostsConfig = settings.pluginConfig?.['vp_related_posts'] || {
    enabled: true,
    count: 6,
    orderBy: 'relevance',
    layout: 'grid',
    showExcerpt: true,
    showImage: true,
    showDate: true,
    titleText: 'Berita Berkaitan',
  };

  if (!config.enabled) return null;

  return (
    <RelatedPostsComponent
      config={config}
      currentPost={currentPost}
      allPosts={allPosts}
      onPostClick={onPostClick}
      themeColors={themeColors}
    />
  );
}
