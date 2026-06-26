/**
 * VonCMS Content Hook
 * Handles posts and pages CRUD operations
 */
import { useState, useCallback } from 'react';
import { Post, Page, SiteSettings } from '../types';
import { API } from '../config/site.config';
import { vonFetch } from '../utils/api';
import { getAuthHeader } from '../config/auth.config';
import { extractVideoThumbnail } from '../utils/siteUtils';

// Data imports
import contentSeed from '../data/content.json';
const getInitialPosts = (): Post[] => {
  // Try to use PHP-injected hydration data if available (Soft 404 / FOUC fix)
  const injected = (window as any).__INITIAL_DATA__;
  if (Array.isArray(injected) && injected.length > 0) {
    return injected.map((p: any) => ({
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
      keywords: p.keywords || '',
      metaDescription: p.meta_description || '',
      readTime: p.readTime || '',
    }));
  }
  return (contentSeed as any).posts || [];
};

const normalizePage = (p: any): Page => ({
  ...p,
  createdAt: p.created_at || p.createdAt || '',
  updatedAt: p.updated_at || p.updatedAt || p.created_at || '',
  metaDescription: p.metaDescription || p.meta_description || '',
  meta_description: p.meta_description || p.metaDescription || '',
});

const INITIAL_POSTS: Post[] = getInitialPosts();
const INITIAL_PAGES: Page[] = ((contentSeed as any).pages || []).map(normalizePage);

export function useContent() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [pages, setPages] = useState<Page[]>(INITIAL_PAGES);
  const [editingItem, setEditingItem] = useState<Post | Page | null>(null);
  const [isEditingPage, setIsEditingPage] = useState(false);

  // Load content from API
  const loadContent = useCallback(async () => {
    // Posts — backend caps at 200, so match it (no point asking for more)
    try {
      const res = await vonFetch(`${API.getPosts}?limit=200`);
      if (res.ok) {
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
          author_data: p.author_data || { username: p.author || '', avatar: '' },
          readTime: p.readTime || '',
        }));
        setPosts(normalizedPosts);
      }
    } catch (e) {
      console.warn('Failed to load posts from API, using seed data:', e);
    }

    // Pages — backend caps at 200, match it
    try {
      const res = await vonFetch(`${API.getPages}?limit=200`);
      if (res.ok) {
        const data = await res.json();
        // Handle envelope or array format
        if (Array.isArray(data)) {
          const normalizedPages = data.map(normalizePage);
          setPages(normalizedPages);
        } else if (data.pages && Array.isArray(data.pages)) {
          const normalizedPages = data.pages.map(normalizePage);
          setPages(normalizedPages);
        }
      }
    } catch (e) {
      console.warn('Failed to load pages from API, using seed data:', e);
    }
  }, []);

  // Handle edit - prepare item for editor
  const handleEdit = useCallback(
    (
      id: string | null,
      isPage: boolean = false,
      navigate: any,
      currentUser: { username: string } | null
    ) => {
      setIsEditingPage(isPage);
      if (id) {
        const item = isPage ? pages.find((p) => p.id === id) : posts.find((p) => p.id === id);
        setEditingItem(item || null);
      } else {
        // Create new
        setEditingItem({
          id: '',
          title: '',
          content: '',
          excerpt: '',
          status: 'draft',
          author: currentUser?.username || '',
          author_data: currentUser
            ? { username: currentUser.username, avatar: (currentUser as any).avatar || '' }
            : { username: '', avatar: '' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category: isPage ? 'Page' : 'Uncategorized',
          slug: '',
        } as any);
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
      onUpdateSettings: (settings: SiteSettings) => void,
      skipNavigate: boolean = false,
      isPageOverride?: boolean
    ) => {
      const effectiveIsPage = typeof isPageOverride === 'boolean' ? isPageOverride : isEditingPage;
      const now = new Date().toISOString();
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
        (newItem as any).id = stableTempId;
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

          const error = new Error(errData.message || errData.error || 'Failed to save content');
          (error as any).status = res.status;
          throw error;
        }

        const data = await res.json();

        if (data && data.id) {
          // SUCCESS: Update State with Real Data
          const realId = data.id;

          if (effectiveIsPage) {
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
    [isEditingPage]
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
    loadContent,
    handleEdit,
    handleSaveContent,
  };
}
