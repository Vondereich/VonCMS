import { Post, Page, User, Comment, SiteSettings } from '../types';

export interface ThemeLayoutProps {
  posts: Post[];
  pages?: Page[];
  user: User | null;
  comments: Comment[];
  allUsers: User[];
  settings: SiteSettings;

  // Actions
  onAddComment: (postId: string, content: string) => void;
  onLikeComment: (commentId: string) => void;
  onReplyComment: (commentId: string, content: string) => void;
  onNavigateAdmin: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onUpdateUser?: (user: Partial<User>) => void;

  // State
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Navigation State
  currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category';
  selectedPost: Post | null;
  selectedPage?: Page | null;
  selectedProfile: string | null;

  // Navigation Actions
  onPostClick: (postId: string) => void;
  onPageClick?: (slug: string) => void;
  onViewProfile: (username: string) => void;
  onBackToHome: () => void;

  // Category Navigation
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
  onClearSearch?: () => void;
}
