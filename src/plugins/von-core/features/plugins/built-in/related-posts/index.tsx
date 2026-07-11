import { PluginDefinition } from '../../../../../../types';
import { RelatedPostsComponent } from './RelatedPostsComponent';
import { RelatedPostsConfig } from './types';

export const RelatedPostsPlugin: PluginDefinition = {
  id: 'vp_related_posts',
  name: 'Related Posts',
  version: '1.25',
  author: 'VonCMS Team',
  description: 'Show related articles based on category and tags',

  render: (_location: any, config?: any) => {
    if (_location !== 'post_after') return null;

    const relatedConfig: RelatedPostsConfig = config || {
      enabled: true,
      count: 6,
      orderBy: 'relevance',
      layout: 'grid',
      showExcerpt: true,
      showImage: true,
      showDate: true,
      titleText: 'Related Posts',
    };
    if (!relatedConfig.enabled) return null;

    // Get current post and all posts from context
    const currentPost = (window as any).__current_post;
    const allPosts = (window as any).__all_posts || [];

    if (!currentPost || allPosts.length === 0) return null;

    return (
      <RelatedPostsComponent
        config={relatedConfig}
        currentPost={currentPost}
        allPosts={allPosts}
        onPostClick={(post) => {
          // Navigate to post (will be handled by theme)
          if ((window as any).__navigate_to_post) {
            (window as any).__navigate_to_post(post.id);
          }
        }}
      />
    );
  },
};
