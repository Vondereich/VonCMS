/// <reference types="vite/client" />

import type { Page, Post, SiteSettings } from './types';

type InitialPostPayload = Partial<Post> & {
  id?: string | number;
  image_url?: string;
  image_srcset?: string;
  meta_description?: string;
  created_at?: string;
  updated_at?: string;
  scheduled_at?: string;
};

interface InitialContentState {
  status?: string;
  contentType?: 'post' | 'page';
  slug?: string;
  post?: InitialPostPayload | null;
  page?: Page | null;
}

declare global {
  interface Window {
    VON_BASE?: string;
    a2a?: unknown;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __INITIAL_STATE__?: InitialContentState;
    __INITIAL_SETTINGS__?: Partial<SiteSettings>;
    __INITIAL_DATA__?: InitialPostPayload[];
    __site_settings?: SiteSettings;
    __current_post?: Post;
    __all_posts?: Post[];
    __navigate_to_post?: (postId: string) => void;
    __current_post_content?: string;
  }
}

export {};
