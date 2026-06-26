import { Post } from '../../../../../../types';

export interface RelatedPostsConfig {
  enabled: boolean;
  count: 3 | 4 | 6 | 8;
  orderBy: 'relevance' | 'date' | 'views' | 'random';
  layout: 'grid' | 'list' | 'cards';
  showExcerpt: boolean;
  showImage: boolean;
  showDate: boolean;
  titleText: string;
}

export interface ScoredPost extends Post {
  relevanceScore: number;
  views?: number;
  createdAt?: string;
}
