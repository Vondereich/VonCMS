import { Post } from '../../../../../../types';
import {
  getPostPublishTimestamp,
  normalizeSchemaDateTime,
} from '../../../../../../utils/dateFormat';
import { ScoredPost, RelatedPostsConfig } from './types';

const normalizeTaxonomyValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';

const getKeywordSet = (keywords: unknown): Set<string> =>
  new Set(
    (typeof keywords === 'string' ? keywords : '')
      .split(',')
      .map(normalizeTaxonomyValue)
      .filter(Boolean)
  );

/**
 * Find related posts based on category and keywords
 */
export function findRelatedPosts(
  currentPost: Post,
  allPosts: Post[],
  config: RelatedPostsConfig,
  timeZone?: string
): Post[] {
  const getPublishTime = (post: Post): number => {
    const normalized = normalizeSchemaDateTime(getPostPublishTimestamp(post), timeZone);
    return normalized ? new Date(normalized).getTime() : Number.NaN;
  };

  // Filter out current post and non-published posts
  const candidates = allPosts.filter((p) => p.id !== currentPost.id && p.status === 'published');

  // Score each post
  const scored: ScoredPost[] = candidates.map((post) => {
    let score = 0;

    // Category match (highest priority)
    if (
      normalizeTaxonomyValue(post.category) !== '' &&
      normalizeTaxonomyValue(post.category) === normalizeTaxonomyValue(currentPost.category)
    ) {
      score += 10;
    }

    // Keywords/tags match (if available)
    const currentKeywords = getKeywordSet(currentPost.keywords);
    const postKeywords = getKeywordSet(post.keywords);
    const keywordMatches = [...currentKeywords].filter((keyword) => postKeywords.has(keyword));
    score += keywordMatches.length * 2;

    // Recent post bonus (published within 30 days)
    const publishedAt = getPublishTime(post);
    const daysSincePublished = Math.floor((Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(publishedAt) && daysSincePublished >= 0 && daysSincePublished <= 30) {
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
        const dateA = getPublishTime(a);
        const dateB = getPublishTime(b);
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
