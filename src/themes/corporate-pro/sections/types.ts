import type { Page, Post, SiteSettings } from '../../../types';

export interface CorporateSectionProps {
  settings: SiteSettings;
  posts: Post[];
  pages: Page[];
  onNavigate: (url: string | undefined) => void;
}
