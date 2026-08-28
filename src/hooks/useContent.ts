/**
 * VonCMS Content Hook
 * Handles posts and pages CRUD operations
 */
import { useState, useCallback, useRef } from 'react';
import { Post, Page, SiteSettings, User } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { getAuthHeader } from '../config/auth.config';
import { extractVideoThumbnail } from '../utils/siteUtils';

// Data imports
import contentSeed from '../data/content.json';
const getInitialPosts = (): Post[] => {
  // Try to use PHP-injected hydration data if available (Soft 404 / FOUC fix)
  const injected = window.__INITIAL_DATA__;
  if (Array.isArray(injected) && injected.length > 0) {
    return injected.map((p) => ({
      id: String(p.id || ''),
      title: p.title || '',
      slug: p.slug || '',
      content: p.content || '',
      excerpt: p.excerpt || '',
      status: 'published' as const,
      category: p.category || 'Uncategorized',
      image: p.image || p.image_url || '',
      imageSrcSet: p.imageSrcSet || p.image_srcset || '',
      author: p.author || '',
      author_data: p.author_data || { username: p.author || '', avatar: '' },
      author_id: p.author_id ?? null,
      createdAt: p.created_at || '',
      updatedAt: p.updated_at || p.created_at || '',
      scheduledAt: p.scheduled_at || p.scheduledAt || '',
      publishedAt: p.published_at || p.publishedAt || '',
      published_at: p.published_at || p.publishedAt || '',
      keywords: p.keywords || '',
      metaDescription: p.meta_description || '',
      readTime: p.readTime || '',
    }));
  }
  return contentSeed.posts as Post[];
};

const normalizePage = (p: any): Page => ({
  ...p,
  createdAt: p.created_at || p.createdAt || '',
  updatedAt: p.updated_at || p.updatedAt || p.created_at || '',
  publishedAt: p.published_at || p.publishedAt || '',
  published_at: p.published_at || p.publishedAt || '',
  metaDescription: p.metaDescription || p.meta_description || '',
  meta_description: p.meta_description || p.metaDescription || '',
});

const INITIAL_POSTS: Post[] = getInitialPosts();
const INITIAL_PAGES: Page[] = contentSeed.pages.map(normalizePage);
const MAX_ADMIN_CONTENT_LIMIT = 200;

const normalizeAdminContentLimit = (requestedLimit: number): number => {
  const numericLimit = Number(requestedLimit);
  if (!Number.isFinite(numericLimit)) return MAX_ADMIN_CONTENT_LIMIT;
  return Math.max(1, Math.min(MAX_ADMIN_CONTENT_LIMIT, Math.floor(numericLimit)));
};

export const createEmptyEditorItem = (
  isPage: boolean,
  currentUser: Pick<User, 'username' | 'avatar'> | null
): Post | Page => {
  const timestamp = new Date().toISOString();
  const authorData = currentUser
    ? { username: currentUser.username, avatar: currentUser.avatar || '' }
    : { username: '', avatar: '' };
  const draft = {
    id: '',
    title: '',
    content: '',
    excerpt: '',
    status: 'draft' as const,
    author: currentUser?.username || '',
    author_data: authorData,
    created_at: timestamp,
    updatedAt: timestamp,
    updated_at: timestamp,
    slug: '',
  };

  return isPage
    ? ({ ...draft, category: 'Page' } as Page)
    : ({ ...draft, category: 'Uncategorized' } as Post);
};

export function useContent() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [pages, setPages] = useState<Page[]>(INITIAL_PAGES);
  const [editingItem, setEditingItem] = useState<Post | Page | null>(null);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const postLoadCoverageRef = useRef(0);
  const pageLoadCoverageRef = useRef(0);
  const postLoadInFlightRef = useRef<Promise<boolean> | null>(null);
  const pageLoadInFlightRef = useRef<Promise<boolean> | null>(null);
  const postLoadGenerationRef = useRef(0);
  const pageLoadGenerationRef = useRef(0);

  const loadPosts = useCallback(async (requestedLimit: number = MAX_ADMIN_CONTENT_LIMIT) => {
    const limit = normalizeAdminContentLimit(requestedLimit);
    const generation = postLoadGenerationRef.current;
    if (postLoadCoverageRef.current >= limit) return true;

    while (postLoadInFlightRef.current) {
      await postLoadInFlightRef.current;
      if (postLoadGenerationRef.current !== generation) return false;
      if (postLoadCoverageRef.current >= limit) return true;
    }

    let request: Promise<boolean>;
    request = (async () => {
      try {
        const res = await vonFetch(`${API.getPosts}?limit=${limit}`);
        if (!res.ok) return false;

        const data = await res.json();
        // Handle new envelope format { posts, meta } OR legacy array format
        const rawPosts = Array.isArray(data) ? data : data.posts || [];
        const normalizedPosts = rawPosts.map((p: any) => ({
          ...p,
          image: p.image || p.image_url || '',
          imageSrcSet: p.imageSrcSet || p.image_srcset || '',
          createdAt: p.created_at || p.createdAt || '',
          updatedAt: p.updated_at || p.updatedAt || p.created_at || '',
          scheduledAt: p.scheduled_at || p.scheduledAt || '',
          publishedAt: p.published_at || p.publishedAt || '',
          published_at: p.published_at || p.publishedAt || '',
          author_data: p.author_data || { username: p.author || '', avatar: '' },
          readTime: p.readTime || '',
        }));
        if (postLoadGenerationRef.current !== generation) return false;

        setPosts(normalizedPosts);
        postLoadCoverageRef.current = Math.max(postLoadCoverageRef.current, limit);
        return true;
      } catch (e) {
        if (postLoadGenerationRef.current === generation) {
          console.warn('Failed to load posts from API, using seed data:', e);
        }
        return false;
      }
    })().finally(() => {
      if (postLoadInFlightRef.current === request) {
        postLoadInFlightRef.current = null;
      }
    });

    postLoadInFlightRef.current = request;
    return request;
  }, []);

  const loadPages = useCallback(async (requestedLimit: number = MAX_ADMIN_CONTENT_LIMIT) => {
    const limit = normalizeAdminContentLimit(requestedLimit);
    const generation = pageLoadGenerationRef.current;
    if (pageLoadCoverageRef.current >= limit) return true;

    while (pageLoadInFlightRef.current) {
      await pageLoadInFlightRef.current;
      if (pageLoadGenerationRef.current !== generation) return false;
      if (pageLoadCoverageRef.current >= limit) return true;
    }

    let request: Promise<boolean>;
    request = (async () => {
      try {
        const res = await vonFetch(`${API.getPages}?limit=${limit}`);
        if (!res.ok) return false;

        const data = await res.json();
        // Handle envelope or array format
        let normalizedPages: Page[] | null = null;
        if (Array.isArray(data)) {
          normalizedPages = data.map(normalizePage);
        } else if (data.pages && Array.isArray(data.pages)) {
          normalizedPages = data.pages.map(normalizePage);
        }
        if (!normalizedPages || pageLoadGenerationRef.current !== generation) return false;

        setPages(normalizedPages);
        pageLoadCoverageRef.current = Math.max(pageLoadCoverageRef.current, limit);
        return true;
      } catch (e) {
        if (pageLoadGenerationRef.current === generation) {
          console.warn('Failed to load pages from API, using seed data:', e);
        }
        return false;
      }
    })().finally(() => {
      if (pageLoadInFlightRef.current === request) {
        pageLoadInFlightRef.current = null;
      }
    });

    pageLoadInFlightRef.current = request;
    return request;
  }, []);

  const resetContentLoadCoverage = useCallback(() => {
    postLoadGenerationRef.current += 1;
    pageLoadGenerationRef.current += 1;
    postLoadCoverageRef.current = 0;
    pageLoadCoverageRef.current = 0;
    postLoadInFlightRef.current = null;
    pageLoadInFlightRef.current = null;
    setPosts(INITIAL_POSTS);
    setPages(INITIAL_PAGES);
    setEditingItem(null);
    setIsEditingPage(false);
  }, []);

  const invalidateContentLoadCoverage = useCallback((contentType: 'post' | 'page') => {
    if (contentType === 'page') {
      pageLoadGenerationRef.current += 1;
      pageLoadCoverageRef.current = 0;
      pageLoadInFlightRef.current = null;
    } else {
      postLoadGenerationRef.current += 1;
      postLoadCoverageRef.current = 0;
      postLoadInFlightRef.current = null;
    }
  }, []);

  // Handle edit - prepare item for editor
  const handleEdit = useCallback(
    (
      id: string | null,
      isPage: boolean = false,
      navigate: any,
      currentUser: Pick<User, 'username' | 'avatar'> | null
    ) => {
      setIsEditingPage(isPage);
      if (id) {
        const item = isPage ? pages.find((p) => p.id === id) : posts.find((p) => p.id === id);
        setEditingItem(item || null);
      } else {
        setEditingItem(createEmptyEditorItem(isPage, currentUser));
      }
      // Include type/id so hard refresh can recover the active editor item.
      const editorParams = new URLSearchParams();
      editorParams.set('type', isPage ? 'page' : 'post');
      if (id) {
        editorParams.set('id', id);
      }
      navigate(`/admin/editor?${editorParams.toString()}`);
    },
    [posts, pages]
  );

  // Handle save content
  const handleSaveContent = useCallback(
    async (
      item: Post | Page,
      addToMenu: boolean,
      navigate: any,
      settings: SiteSettings,
      onUpdateSettings: (settings: SiteSettings) => boolean | Promise<boolean>,
      skipNavigate: boolean = false,
      isPageOverride?: boolean
    ) => {
      const effectiveIsPage = typeof isPageOverride === 'boolean' ? isPageOverride : isEditingPage;
      const now = new Date().toISOString();
      const wasNewItem = !item.id;
      const baseUpdatedAt = item.updated_at || item.updatedAt || '';
      const newItem = { ...item, baseUpdatedAt, updatedAt: now };
      const normalizedCategory =
        !effectiveIsPage && 'category' in newItem
          ? String((newItem as Post).category || '')
              .trim()
              .replace(/\s+/g, ' ')
          : '';

      if (!effectiveIsPage && 'category' in newItem) {
        (newItem as Post).category = normalizedCategory || 'Uncategorized';
      }

      // Clean slug
      if (newItem.slug) {
        newItem.slug = newItem.slug
          .toLowerCase()
          .replace(/[^a-z0-9\-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
      } else {
        newItem.slug = newItem.title
          .toLowerCase()
          .replace(/[^a-z0-9\-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Auto-generate video thumbnail for posts
      if (!effectiveIsPage && !(newItem as Post).image && newItem.content) {
        const videoThumb = extractVideoThumbnail(newItem.content);
        if (videoThumb) {
          (newItem as Post).image = videoThumb;
        }
      }

      const endpoint = effectiveIsPage ? API.savePage : API.savePost;
      const stableTempId = item.id || `temp-${Date.now()}`;
      if (!newItem.id) {
        newItem.id = stableTempId;
      }

      // NOTE: Navigation logic moved to AFTER API response to prevent temp ID issues

      // API Call
      try {
        const res = await vonFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
          body: JSON.stringify(newItem),
        });

        // Handle Session Expiry (401)
        if (res.status === 401) {
          throw new Error('Session expired. Please login again.');
        }

        // Handle API Errors
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));

          // Check for Session/CSRF issues
          if (
            res.status === 401 ||
            (res.status === 403 && errData.error === 'Invalid CSRF token')
          ) {
            window.dispatchEvent(new Event('von:session-expired'));
            throw new Error('Session paused. Please login in the popup to continue.');
          }

          const error = Object.assign(
            new Error(errData.message || errData.error || 'Failed to save content'),
            { status: res.status }
          );
          throw error;
        }

        const data = await res.json();

        if (data && data.id) {
          // SUCCESS: Update State with Real Data
          const realId = data.id;

          if (effectiveIsPage) {
            invalidateContentLoadCoverage('page');
            setPages((prev) => {
              const exists = prev.find((p) => p.id === realId || p.id === newItem.id); // Check both real and temp/old ID
              if (exists) {
                return prev.map((p) =>
                  p.id === realId || p.id === newItem.id
                    ? ({ ...p, ...newItem, ...data, id: realId } as Page)
                    : p
                );
              }
              return [...prev, { ...newItem, ...data, id: realId } as Page];
            });

            // Update Navigation Settings (if needed)
            if (addToMenu) {
              // Navigation logic using realId...
              // (Simplified for robustness: Check by label mostly or update if url matches)
              const navUrl = `page:${realId}`;
              const existingNav = settings.navigation.find(
                (n) => n.url === navUrl || (n.type === 'internal' && n.label === newItem.title)
              );

              let newNav = settings.navigation;
              if (!existingNav) {
                newNav = [
                  ...settings.navigation,
                  { id: `nav-${Date.now()}`, label: newItem.title, url: navUrl, type: 'internal' },
                ];
              } else {
                // Update existing
                newNav = settings.navigation.map((n) =>
                  n.id === existingNav.id ? { ...n, label: newItem.title, url: navUrl } : n
                );
              }
              onUpdateSettings({ ...settings, navigation: newNav });
            }
          } else {
            invalidateContentLoadCoverage('post');
            setPosts((prev) => {
              const exists = prev.find((p) => p.id === realId || p.id === newItem.id);
              if (exists) {
                return prev.map((p) =>
                  p.id === realId || p.id === newItem.id
                    ? ({ ...p, ...newItem, ...data, id: realId } as Post)
                    : p
                );
              }
              return [...prev, { ...newItem, ...data, id: realId } as Post];
            });

            if (normalizedCategory) {
              const knownCategories = (settings.categories || []).map((category) =>
                String(category).trim().toLowerCase()
              );
              if (!knownCategories.includes(normalizedCategory.toLowerCase())) {
                onUpdateSettings({
                  ...settings,
                  categories: [...(settings.categories || []), normalizedCategory],
                });
              }
            }

            const previousCategory = String((item as Post).category || 'Uncategorized')
              .trim()
              .replace(/\s+/g, ' ');
            const previousStatus = String((item as Post).status || '');
            const savedStatus = String(data.status || (newItem as Post).status || '');
            const publicCategoriesChanged =
              typeof data.public_categories_changed === 'boolean'
                ? data.public_categories_changed
                : wasNewItem ||
                  normalizedCategory !== previousCategory ||
                  savedStatus !== previousStatus;
            if (publicCategoriesChanged) {
              window.dispatchEvent(new Event('voncms:public-categories-invalidated'));
            }
          }

          // ONLY Navigate on Success if not auto-saving
          if (!skipNavigate) {
            navigate(effectiveIsPage ? '/admin/pages' : '/admin/posts');
          }

          return data; // Return the saved data so the caller can update its ID
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err: any) {
        console.error('Failed to save content:', err);
        // Re-throw to let caller (PostEditor) know it failed
        throw err;
      }
    },
    [invalidateContentLoadCoverage, isEditingPage]
  );

  return {
    posts,
    setPosts,
    pages,
    setPages,
    editingItem,
    setEditingItem,
    isEditingPage,
    setIsEditingPage,
    loadPosts,
    loadPages,
    resetContentLoadCoverage,
    invalidateContentLoadCoverage,
    handleEdit,
    handleSaveContent,
  };
}
