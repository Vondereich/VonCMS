import { Post } from '../../../../../../types';
import { ScoredPost, RelatedPostsConfig } from './types';

/**
 * Find related posts based on category and keywords
 */
export function findRelatedPosts(
  currentPost: Post,
  allPosts: Post[],
  config: RelatedPostsConfig
): Post[] {
  // Filter out current post and non-published posts
  const candidates = allPosts.filter((p) => p.id !== currentPost.id && p.status === 'published');

  // Score each post
  const scored: ScoredPost[] = candidates.map((post) => {
    let score = 0;

    // Category match (highest priority)
    if (post.category === currentPost.category) {
      score += 10;
    }

    // Keywords/tags match (if available)
    if (currentPost.keywords && post.keywords) {
      const currentKeywords = currentPost.keywords
        .toLowerCase()
        .split(',')
        .map((k) => k.trim());
      const postKeywords = post.keywords
        .toLowerCase()
        .split(',')
        .map((k) => k.trim());

      const matches = currentKeywords.filter((k) => postKeywords.includes(k));
      score += matches.length * 2;
    }

    // Recent post bonus (published within 30 days)
    const daysSincePublished = Math.floor(
      (Date.now() - new Date(post.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePublished <= 30) {
      score += 1;
    }

    return {
      ...post,
      relevanceScore: score,
    };
  });

  // Sort based on config
  let sorted: ScoredPost[] = [];

  switch (config.orderBy) {
    case 'relevance':
      sorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
      break;
    case 'date':
      sorted = scored.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      break;
    case 'views':
      sorted = scored.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
    case 'random': {
      sorted = [...scored];
      for (let index = sorted.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [sorted[index], sorted[randomIndex]] = [sorted[randomIndex], sorted[index]];
      }
      break;
    }
    default:
      sorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Return top N posts
  return sorted.slice(0, config.count);
}
