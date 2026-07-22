import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Post, Page } from './types';
import { VonProviders } from './plugins/von-core/providers/VonProviders';
import { getPermalink } from './utils/siteUtils';
import { vonFetch } from './utils/api';
import { BASE_PATH, API } from './config/site.config';
import { getCachedPublicPost } from './hooks/usePublicPostsQuery';

const SESSION_VISIBILITY_CHECK_COOLDOWN = 60 * 1000;

// Hooks
import {
  useAuth,
  useComments,
  useContent,
  useSettings,
  useUsers,
  useSinglePage,
  useSinglePost,
  usePublicProfile,
} from './hooks';

// Import Features
import Login from './plugins/von-core/features/auth/Login';
import PublicSite from './plugins/von-core/features/public/PublicSite';
import InstallWizard from './plugins/von-core/features/setup/InstallWizard';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy Load Admin Features
const Dashboard = lazy(() => import('./plugins/von-core/features/dashboard/Dashboard'));
const SettingsManager = lazy(() => import('./plugins/von-core/features/settings/SettingsManager'));
const DatabaseManager = lazy(() => import('./plugins/von-core/features/database/DatabaseManager'));
const UserManager = lazy(() => import('./plugins/von-core/features/users/UserManager'));
const ContentManager = lazy(() => import('./plugins/von-core/features/content/ContentManager'));
const ExtensionsManager = lazy(
  () => import('./plugins/von-core/features/extensions/ExtensionsManager')
);
const DiscussionManager = lazy(
  () => import('./plugins/von-core/features/discussion/DiscussionManager')
);
const ContactManager = lazy(() => import('./pages/admin/ContactManager'));
const NewsletterManager = lazy(
  () => import('./plugins/von-core/features/newsletter/NewsletterManager')
);
const WidgetsManager = lazy(() => import('./plugins/von-core/features/widgets/WidgetsManager'));
const PostEditor = lazy(() => import('./components/PostEditor'));
const AdminLayout = lazy(() => import('./components/layouts/AdminLayout'));
const MediaManager = lazy(() =>
  import('./plugins/von-core/features/media/MediaManager').then((module) => ({
    default: module.MediaManager,
  }))
);

// Lazy Load Security Dashboard (Preserved)
const SecurityDashboard = lazy(
  () => import('./plugins/von-core/features/security/SecurityDashboard')
);

import NotFoundPage from './components/NotFoundPage';
import MaintenancePage from './components/MaintenancePage';
import SkeletonLoader from './components/SkeletonLoader';

// Icons
import { X, Pencil, LayoutDashboard } from 'lucide-react';

import ScrollToTop from './components/ScrollToTop';

// Public Site Wrapper to handle Params
const PublicSiteWrapper: React.FC<any> = ({ posts, pages, ...props }) => {
  const { id, username, slug, category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [editedPostOverride, setEditedPostOverride] = useState<Post | null>(null);
  const [editedPageOverride, setEditedPageOverride] = useState<Page | null>(null);

  const categoryParam = searchParams.get('category');

  let currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category' = 'home';
  let selectedPost = null;
  let selectedPage = null;
  let selectedProfile = null;
  let selectedCategory = null;
  let isNotFound = false;
  let postIdToFetch: string | null = null;
  let postSlugToFetch: string | null = null;
  let pageSlugToFetch: string | null = null;
  let isAmbiguousSlugRoute = false;
  const injectedState = window.__INITIAL_STATE__;
  const injectedPage =
    injectedState?.status === 'loaded' && injectedState?.contentType === 'page'
      ? (injectedState.page as Page | null)
      : null;

  if (id) {
    currentView = 'single-post';
    postIdToFetch = id;
  } else if (slug) {
    const postFromList = posts.find((p: Post) => p.slug === slug);
    if (postFromList) {
      currentView = 'single-post';
      postSlugToFetch = slug;
    } else if (category) {
      // If category is present in URL, assume it's a post permalink
      // and try to fetch it even if not in local list
      currentView = 'single-post';
      postSlugToFetch = slug;
    } else {
      selectedPage = pages?.find((p: Page) => p.slug === slug);
      if (selectedPage) {
        currentView = 'page';
      } else if (injectedPage?.slug === slug) {
        selectedPage = injectedPage;
        currentView = 'page';
      } else {
        // Hydration Logic: Don't assume 404. Check if PHP confirmed Not Found.
        const injectedStatus = injectedState?.status;
        if (injectedStatus === 'not_found') {
          isNotFound = true;
        } else {
          // Try both page and post lookups before deciding this slug is missing.
          currentView = 'single-post';
          isAmbiguousSlugRoute = true;
          postSlugToFetch = slug;
          pageSlugToFetch = slug;
        }
      }
    }
  } else if (username) {
    currentView = 'profile';
    selectedProfile = username;
  } else if (categoryParam) {
    currentView = 'category';
    selectedCategory = categoryParam;
  }

  // Fetch full post content via hook (Slim Query fix)
  const { fullPost, isLoading: isLoadingPost } = useSinglePost(
    postIdToFetch,
    postSlugToFetch,
    currentView === 'single-post' || isAmbiguousSlugRoute
  );
  const { fullPage, isLoading: isLoadingPage } = useSinglePage(
    null,
    pageSlugToFetch,
    Boolean(pageSlugToFetch && !selectedPage)
  );
  const { targetProfile: resolvedPublicProfile, isLoading: isLoadingProfile } = usePublicProfile(
    selectedProfile,
    props.allUsers || [],
    props.settings?.adminProfile
  );
  const fullPostMatchesCurrentRoute = Boolean(
    fullPost && ((id && fullPost.id === id) || (slug && fullPost.slug === slug))
  );
  const fullPageMatchesCurrentRoute = Boolean(fullPage && slug && fullPage.slug === slug);

  useEffect(() => {
    setIsQuickEditOpen(false);
    setEditedPostOverride(null);
    setEditedPageOverride(null);
  }, [id, slug, username, category, categoryParam]);

  useEffect(() => {
    if (!id || !fullPost || !props.settings || fullPost.id !== id) return;

    const canonicalPostPath = getPermalink(fullPost, props.settings, false, true);
    if (canonicalPostPath && canonicalPostPath !== `/post/${encodeURIComponent(id)}`) {
      navigate(canonicalPostPath, { replace: true });
    }
  }, [fullPost, id, navigate, props.settings]);

  const publicCommentPost =
    currentView === 'single-post'
      ? editedPostOverride ||
        (fullPostMatchesCurrentRoute ? fullPost : null) ||
        (!isLoadingPost
          ? posts.find((post: Post) => post.id === id || post.slug === slug) || null
          : null)
      : null;
  const publicCommentPostId = publicCommentPost?.id ? String(publicCommentPost.id) : '';

  useEffect(() => {
    if (!publicCommentPostId || typeof props.loadPublicComments !== 'function') return;

    void props.loadPublicComments(publicCommentPostId);
  }, [props.loadPublicComments, publicCommentPostId]);

  if (isAmbiguousSlugRoute) {
    if (fullPageMatchesCurrentRoute) {
      currentView = 'page';
      selectedPage = fullPage;
    } else if (fullPostMatchesCurrentRoute) {
      currentView = 'single-post';
    } else if (isLoadingPage || isLoadingPost) {
      return <SkeletonLoader />;
    } else {
      isNotFound = true;
    }
  }

  if (currentView === 'single-post') {
    const fallbackPost = posts.find((p: Post) => p.id === id || p.slug === slug) || null;
    selectedPost =
      editedPostOverride ||
      (fullPostMatchesCurrentRoute ? fullPost : null) ||
      (!isLoadingPost ? fallbackPost : null);
    if (!selectedPost && !isLoadingPost) isNotFound = true;
  }

  if (currentView === 'page') {
    const fallbackPage = selectedPage || pages?.find((p: Page) => p.slug === slug) || null;
    selectedPage =
      editedPageOverride || (fullPageMatchesCurrentRoute ? fullPage : null) || fallbackPage;
    if (!selectedPage && !isLoadingPage) isNotFound = true;
  }

  if (currentView === 'profile' && selectedProfile) {
    if (isLoadingProfile) {
      return <SkeletonLoader />;
    }
    if (!resolvedPublicProfile) {
      return <NotFoundPage isDarkMode={props.isDarkMode} />;
    }
  }

  if (currentView === 'single-post' && !selectedPost && isLoadingPost) {
    return <SkeletonLoader />;
  }

  if (currentView === 'page' && !selectedPage && isLoadingPage) {
    return <SkeletonLoader />;
  }

  if (isNotFound) {
    return <NotFoundPage isDarkMode={props.isDarkMode} />;
  }

  const currentUserRole = String(props.user?.role || '').toLowerCase();
  const normalizedFrontendRole = currentUserRole === 'root' ? 'admin' : currentUserRole;
  const isFrontendAdmin = normalizedFrontendRole === 'admin';
  const canFrontendEditCurrentView =
    currentView === 'page'
      ? isFrontendAdmin || normalizedFrontendRole === 'moderator'
      : isFrontendAdmin || ['moderator', 'writer'].includes(normalizedFrontendRole);
  const canFrontendEdit =
    !!props.user &&
    ((currentView === 'single-post' && !!selectedPost?.id) ||
      (currentView === 'page' && !!selectedPage?.id)) &&
    canFrontendEditCurrentView;

  const quickEditItem = currentView === 'page' ? selectedPage : selectedPost;
  const quickEditIsPage = currentView === 'page';

  const openDashboardEditor = () => {
    if (!props.handleEditContent || !props.user) return;

    if (currentView === 'page' && selectedPage?.id) {
      props.handleEditContent(selectedPage.id, true, navigate, props.user);
      return;
    }

    if (currentView === 'single-post' && selectedPost?.id) {
      props.handleEditContent(selectedPost.id, false, navigate, props.user);
    }
  };

  const handleQuickEditSave = async (
    item: Post | Page,
    addToMenu: boolean,
    isAutoSave?: boolean
  ) => {
    const saved = await props.handleSaveContent(
      item,
      addToMenu,
      navigate,
      props.settings,
      props.handleUpdateSettings,
      true,
      quickEditIsPage
    );

    if (quickEditIsPage) {
      const savedPage = {
        ...(item as Page),
        ...(saved || {}),
        id: String(saved?.id || item.id || ''),
        slug: saved?.slug || item.slug,
      } as Page;

      setEditedPageOverride(savedPage);

      if (!isAutoSave) {
        setIsQuickEditOpen(false);
        navigate(`/${savedPage.slug}`, { replace: true });
      }
    } else {
      const savedPost = {
        ...(item as Post),
        ...(saved || {}),
        id: String(saved?.id || item.id || ''),
        slug: saved?.slug || item.slug,
        image: saved?.image || (item as Post).image || '',
      } as Post;

      setEditedPostOverride(savedPost);

      if (!isAutoSave) {
        setIsQuickEditOpen(false);
        navigate(getPermalink(savedPost, props.settings, false, true), { replace: true });
      }
    }

    return saved;
  };

  const isCurrentHomePath = () =>
    window.location.pathname === '/' || window.location.pathname === BASE_PATH;

  const handleCategoryNavigation = (cat: string) => {
    if (isCurrentHomePath()) {
      setSearchParams(cat ? { category: cat } : {}, { state: location.state });
      return;
    }

    navigate(cat ? `/?category=${encodeURIComponent(cat)}` : '/', {
      state: cat
        ? {
            publicDiscoveryResetKey: `category-from-${location.key}`,
          }
        : null,
    });
  };

  const handleBackToHome = () => {
    window.scrollTo(0, 0);
    if (isCurrentHomePath()) {
      setSearchParams({});
      return;
    }

    navigate('/');
  };

  return (
    <>
      <PublicSite
        key={
          currentView === 'category' && location.state?.publicDiscoveryResetKey
            ? location.state.publicDiscoveryResetKey
            : 'public-site'
        }
        {...props}
        posts={posts}
        pages={pages}
        currentView={currentView}
        selectedPost={selectedPost}
        selectedPage={selectedPage}
        selectedProfile={selectedProfile}
        resolvedProfile={resolvedPublicProfile}
        selectedCategory={selectedCategory}
        onPostClick={(pid) => {
          const targetPost = posts.find((x: Post) => x.id === pid) || getCachedPublicPost(pid);
          if (targetPost && props.settings) {
            // Internal navigation: pass noBase=true because navigate() prepends basename
            navigate(getPermalink(targetPost, props.settings, false, true));
            return;
          }

          navigate(`/post/${encodeURIComponent(pid)}`);
        }}
        onPageClick={(pageRef: string) => {
          const resolveAndNavigatePage = async () => {
            const normalizedRef = String(pageRef || '').replace(/^\/+|\/+$/g, '');
            let targetPage =
              pages.find(
                (page: Page) => page.slug === normalizedRef || page.id === normalizedRef
              ) || null;

            if (!targetPage) {
              try {
                const queryKey = /^\d+$/.test(normalizedRef) ? 'id' : 'slug';
                const res = await vonFetch(
                  `${API.getPages}?${queryKey}=${encodeURIComponent(normalizedRef)}&limit=1`
                );
                const data = await res.json();
                const rawPage = Array.isArray(data) ? data[0] : data?.pages?.[0];

                if (res.ok && rawPage?.slug) {
                  targetPage = {
                    id: String(rawPage.id || normalizedRef),
                    slug: rawPage.slug,
                  } as Page;
                }
              } catch (error) {
                // Fall through to the user-facing error below.
              }
            }

            if (targetPage?.slug) {
              navigate(`/${targetPage.slug}`);
              return;
            }

            toast.error('Unable to resolve this page link.');
          };

          void resolveAndNavigatePage();
        }}
        onViewProfile={(u) => navigate(`/profile/${u}`)}
        onCategoryClick={handleCategoryNavigation}
        onBackToHome={handleBackToHome}
        onNavigateAdmin={() => navigate('/admin/dashboard')}
        onUpdateUser={props.onUpdateUser}
      />

      {canFrontendEdit && quickEditItem && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsQuickEditOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-blue-500/30 transition-colors hover:bg-blue-700"
          >
            <Pencil size={16} />
            Quick Edit
          </button>
          <button
            type="button"
            onClick={openDashboardEditor}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <LayoutDashboard size={16} />
            Dashboard Editor
          </button>
        </div>
      )}

      {isQuickEditOpen && quickEditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="flex h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quick Edit {quickEditIsPage ? 'Page' : 'Post'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Save quick fixes without leaving the current page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDashboardEditor}
                  className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:inline-flex sm:items-center sm:gap-2"
                >
                  <LayoutDashboard size={16} />
                  Open Dashboard Editor
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickEditOpen(false)}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close quick editor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <Suspense fallback={<SkeletonLoader />}>
                <PostEditor
                  initialItem={quickEditItem}
                  isPage={quickEditIsPage}
                  navigation={props.settings.navigation}
                  posts={posts}
                  settings={props.settings}
                  onSave={handleQuickEditSave}
                  onBack={() => setIsQuickEditOpen(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import ErrorBoundary from './components/ErrorBoundary';
import RouteProgressBar from './components/RouteProgressBar';

const App: React.FC = () => {
  const routerBasename = import.meta.env['PROD'] && BASE_PATH !== '/' ? BASE_PATH : undefined;

  // Use custom hooks - Refactored from Inline Logic
  const { user, isAuthLoading, handleLogin, handleLogout, handleUpdateUser } = useAuth();
  const { settings, loadSettings, handleUpdateSettings, onToggleNav } = useSettings();
  const {
    posts,
    setPosts,
    pages,
    setPages,
    editingItem,
    isEditingPage,
    loadContent,
    handleEdit,
    handleSaveContent,
  } = useContent();
  const {
    comments,
    handleAddComment,
    handleReplyComment,
    handleLikeComment,
    handleUpdateCommentStatus,
    handleDeleteComment,
    loadPublicComments,
    loadMorePublicComments,
    publicCommentPagination,
  } = useComments();
  const { users, loadUsers, handleAddUser, handleDeleteUser, handleUpdateUserInList } = useUsers();
  const isPrimaryAdmin =
    String(user?.role || '').toLowerCase() === 'root' || String(user?.id || '') === '1';

  // UI State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('von_dark_mode') === 'true';
    }
    return false;
  });

  // Persist Dark Mode
  useEffect(() => {
    localStorage.setItem('von_dark_mode', isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const lastSessionVisibilityCheckRef = useRef(0);
  const sessionVisibilityCheckInFlightRef = useRef(false);

  // Update Favicon (only if changed to prevent redundant requests)
  useEffect(() => {
    if (settings.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        // Robust comparison: check base URL without query parameters (?v=...)
        const currentBase = link.href.split('?')[0];
        const newBase = new URL(settings.faviconUrl, window.location.origin).href.split('?')[0];

        if (currentBase !== newBase) {
          link.href = settings.faviconUrl;
        }
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = settings.faviconUrl;
        document.head.appendChild(newLink);
      }
    }
  }, [settings.faviconUrl]);

  // CSRF Token Initialization
  useEffect(() => {
    import('./utils/security').then(({ getCsrfToken }) => {
      getCsrfToken().catch((err) => console.warn('Failed to initialize CSRF token:', err));
    });
  }, []);

  // Global Session Expiry Listener
  useEffect(() => {
    const handleSessionExpiry = () => {
      if (!showAuthModal) {
        setShowAuthModal(true);
        toast('Session paused due to inactivity. Please sign in to resume.', {
          icon: '\uD83D\uDD12',
          duration: 5000,
        });
      }
    };

    window.addEventListener('von:session-expired', handleSessionExpiry);
    return () => window.removeEventListener('von:session-expired', handleSessionExpiry);
  }, [showAuthModal]);

  // Load only the public settings needed to unlock the first render.
  useEffect(() => {
    const initData = async () => {
      try {
        await loadSettings();
      } catch (e) {
        console.error('Initial data load failed', e);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initData();
  }, []);

  // Smart Session Check (Visibility API) - Option Auto-Kick + Message
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only check when user COMES BACK to the tab (Visible) AND is theoretically logged in
      if (!document.hidden && user) {
        const now = Date.now();
        if (
          sessionVisibilityCheckInFlightRef.current ||
          now - lastSessionVisibilityCheckRef.current < SESSION_VISIBILITY_CHECK_COOLDOWN
        ) {
          return;
        }

        sessionVisibilityCheckInFlightRef.current = true;
        lastSessionVisibilityCheckRef.current = now;
        try {
          // 1. Lightweight Ping
          const res = await vonFetch(API.checkAuth);
          const data = await res.json();

          if (data?.authenticated && data.csrf_token) {
            const { setCsrfToken } = await import('./utils/security');
            setCsrfToken(data.csrf_token);
          }

          // 2. If Session Invalid -> KICK TO HOME
          if (data && data.authenticated === false) {
            // FIX: If already on login page, do nothing (prevent loop)
            if (window.location.pathname.includes('/login')) return;
            // Just redirect to Home, no scary messages
            window.location.href = BASE_PATH;
          }
        } catch (e) {
          // Ignore network errors (offline, etc)
        } finally {
          sessionVisibilityCheckInFlightRef.current = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Re-fetch protected data when user logs in
  useEffect(() => {
    if (user) {
      // Only the primary admin needs the full user list (dashboard admin stats and UserManager).
      if (isPrimaryAdmin) {
        loadUsers();
      }
      loadContent();
      loadSettings();
    }
  }, [user]);

  // Notification helper
  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (type === 'success') {
      toast.success(msg);
    } else if (type === 'error') {
      toast.error(msg);
    } else {
      toast(msg);
    }
  };

  // Shared props for PublicSiteWrapper
  const publicSiteProps = {
    settings,
    posts,
    pages,
    user,
    comments,
    loadPublicComments,
    loadMorePublicComments,
    hasMoreComments: publicCommentPagination.hasMore,
    commentsLoading: publicCommentPagination.loading,
    commentsError: publicCommentPagination.error,
    allUsers: users,
    onLogin: () => setShowAuthModal(true),
    onLogout: handleLogout,
    onAddComment: (postId: string, content: string) =>
      handleAddComment(postId, content, user, () => setShowAuthModal(true)),
    onLikeComment: handleLikeComment,
    onReplyComment: (commentId: string, content: string) =>
      handleReplyComment(commentId, content, user, () => setShowAuthModal(true)),
    isDarkMode,
    toggleDarkMode: () => setIsDarkMode(!isDarkMode),
    onUpdateUser: handleUpdateUser,
    handleEditContent: handleEdit,
    handleSaveContent,
    handleUpdateSettings,
  };

  // Public routes configuration
  const publicRoutes = [
    '/',
    '/post/:id',
    '/profile/:username',
    '/:year/:month/:day/:slug',
    '/:year/:month/:slug',
    '/:category/:slug',
    '/:slug',
  ];

  if (isInitialLoading) {
    return <SkeletonLoader />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <RouteProgressBar />
        <ScrollToTop />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#333', color: '#fff' },
            success: { duration: 3000, iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <VonProviders settings={settings}>
          {/* Maintenance Mode Check */}
          {settings.maintenanceMode &&
          (!user || !['admin', 'root'].includes(user.role?.toLowerCase() || '')) &&
          !window.location.pathname.includes('/login') &&
          !window.location.pathname.includes('/install') &&
          !window.location.pathname.includes('/admin') ? (
            <MaintenancePage
              siteName={settings.siteName}
              onAdminLogin={() => (window.location.href = BASE_PATH + 'login')}
            />
          ) : (
            <Routes>
              {/* Public Routes - Consolidated */}
              {publicRoutes.map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={<PublicSiteWrapper {...publicSiteProps} />}
                />
              ))}

              {/* Auth Routes */}
              <Route
                path="/login"
                element={
                  user ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Login
                      settings={settings}
                      onLogin={(u) => {
                        handleLogin(u);
                        setShowAuthModal(false);
                        window.location.href = BASE_PATH;
                      }}
                    />
                  )
                }
              />
              <Route path="/install" element={<InstallWizard />} />

              {/* Admin Routes - Protected */}
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<SkeletonLoader />}>
                    <ProtectedRoute
                      user={user}
                      isAuthLoading={isAuthLoading}
                      allowedRoles={['Admin', 'Moderator', 'Writer']}
                    >
                      <AdminLayout
                        settings={settings}
                        onLogout={handleLogout}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                        user={user}
                      >
                        <Routes>
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route
                            path="dashboard"
                            element={
                              <Dashboard
                                posts={posts}
                                users={users}
                                comments={comments}
                                pages={pages}
                                currentUser={user}
                                serverInfo={settings._serverInfo}
                              />
                            }
                          />
                          {/* Security Dashboard Route - PRESERVED */}
                          <Route
                            path="security"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <SecurityDashboard isPrimaryAdmin={isPrimaryAdmin} />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="posts"
                            element={
                              <ContentManagerWrapper
                                type="post"
                                posts={posts}
                                setPosts={setPosts}
                                handleEdit={handleEdit}
                                user={user}
                              />
                            }
                          />
                          <Route
                            path="pages"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin', 'Moderator']}>
                                <ContentManagerWrapper
                                  type="page"
                                  pages={pages}
                                  setPages={setPages}
                                  navigation={settings.navigation}
                                  onToggleNav={(pageId: string) => onToggleNav(pageId, pages)}
                                  handleEdit={handleEdit}
                                  user={user}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="editor"
                            element={
                              <PostEditorWrapper
                                editingItem={editingItem}
                                isPage={isEditingPage}
                                navigation={settings.navigation}
                                posts={posts}
                                pages={pages}
                                handleSaveContent={handleSaveContent}
                                settings={settings}
                                handleUpdateSettings={handleUpdateSettings}
                                user={user}
                              />
                            }
                          />
                          <Route
                            path="gallery"
                            element={
                              isPrimaryAdmin ? (
                                <MediaManager settings={settings} />
                              ) : (
                                <Navigate to="/admin" replace />
                              )
                            }
                          />
                          <Route
                            path="contact"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <ContactManager />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="newsletter"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <NewsletterManager
                                  settings={settings}
                                  onUpdateSettings={handleUpdateSettings}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="discussion"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin', 'Moderator']}>
                                <DiscussionManager
                                  comments={comments}
                                  posts={posts}
                                  onUpdateCommentStatus={handleUpdateCommentStatus}
                                  onDeleteComment={handleDeleteComment}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="users"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <UserManager
                                  users={users}
                                  onAddUser={handleAddUser}
                                  onDeleteUser={handleDeleteUser}
                                  onUpdateUser={handleUpdateUserInList}
                                  currentUser={user}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="widgets"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                {isPrimaryAdmin ? (
                                  <WidgetsManager
                                    settings={settings}
                                    onUpdateSettings={handleUpdateSettings}
                                  />
                                ) : (
                                  <Navigate to="/admin" replace />
                                )}
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="extensions"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <ExtensionsManager
                                  settings={settings}
                                  onUpdateSettings={handleUpdateSettings}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="settings"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                <SettingsManager
                                  settings={settings}
                                  onUpdate={handleUpdateSettings}
                                  notify={notify}
                                />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="database"
                            element={
                              <ProtectedRoute user={user} allowedRoles={['Admin']}>
                                {isPrimaryAdmin ? (
                                  <DatabaseManager />
                                ) : (
                                  <Navigate to="/admin" replace />
                                )}
                              </ProtectedRoute>
                            }
                          />
                        </Routes>
                      </AdminLayout>
                    </ProtectedRoute>
                  </Suspense>
                }
              />

              {/* 404 Catch-all Route */}
              <Route path="*" element={<NotFoundPage isDarkMode={isDarkMode} />} />
            </Routes>
          )}
          {/* Auth Modal */}
          {showAuthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
              <div className="relative w-full max-w-lg">
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="absolute -top-12 right-0 text-white transition-colors hover:text-slate-300"
                >
                  <X size={24} />
                </button>
                <Login
                  settings={settings}
                  onLogin={(u) => {
                    handleLogin(u);
                    setShowAuthModal(false);
                  }}
                  isModal={true}
                />
              </div>
            </div>
          )}{' '}
        </VonProviders>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

// Helper Wrappers to use Hooks
const ContentManagerWrapper: React.FC<any> = ({
  type,
  posts,
  pages,
  setPosts,
  setPages,
  handleEdit,
  navigation,
  onToggleNav,
  user,
}) => {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <ContentManager
      type={type}
      posts={posts}
      pages={pages}
      navigation={navigation}
      onToggleNav={onToggleNav}
      refreshKey={refreshKey}
      onEdit={(id, isPage) => handleEdit(id, isPage, navigate, user)}
      onDelete={async (id, isPage, skipConfirm = false) => {
        if (
          !skipConfirm &&
          !confirm('Are you sure you want to delete this ' + (isPage ? 'page' : 'post') + '?')
        )
          return;

        try {
          const endpoint = isPage ? API.deletePage : API.deletePost;
          const res = await vonFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const data = await res.json();

          if (data.success) {
            if (isPage) {
              setPages((prev: any) => prev.filter((p: any) => p.id !== id));
            } else {
              setPosts((prev: any) => prev.filter((p: any) => p.id !== id));
            }
            triggerRefresh(); // Re-fetch current page in ContentManager
          } else {
            toast.error('Failed to delete: ' + (data.message || data.error));
          }
        } catch (e) {
          console.error('Delete error:', e);
          toast.error('Failed to delete. Check console for details.');
        }
      }}
    />
  );
};

const PostEditorWrapper: React.FC<any> = ({
  editingItem,
  isPage,
  navigation,
  posts = [],
  pages = [],
  handleSaveContent,
  settings,
  handleUpdateSettings,
  user,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read from URL query param - this persists across hard refresh
  const editorType = searchParams.get('type');
  const editorItemId = searchParams.get('id') || '';
  const hasEditorType = editorType === 'post' || editorType === 'page';
  const effectiveIsPage = hasEditorType ? editorType === 'page' : isPage;
  const [recoveredEditorItem, setRecoveredEditorItem] = useState<Post | Page | null>(null);
  const [isRecoveringEditorItem, setIsRecoveringEditorItem] = useState(false);
  const [hasTriedEditorRecovery, setHasTriedEditorRecovery] = useState(false);
  const effectiveEditingItem = editingItem || recoveredEditorItem;
  const normalizedUserRole = String(user?.role || '').toLowerCase();
  const canManagePages = ['admin', 'root', 'moderator'].includes(normalizedUserRole);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [editorType, editorItemId]);

  useEffect(() => {
    let cancelled = false;

    if (editingItem) {
      setRecoveredEditorItem(null);
      setIsRecoveringEditorItem(false);
      setHasTriedEditorRecovery(false);
      return;
    }

    if (!editorItemId) {
      setRecoveredEditorItem(null);
      setIsRecoveringEditorItem(false);
      setHasTriedEditorRecovery(false);
      return;
    }

    const localEditorSource = effectiveIsPage ? pages : posts;
    const localMatch = localEditorSource.find(
      (item: Post | Page) => String(item.id) === editorItemId
    );
    if (localMatch) {
      setRecoveredEditorItem(localMatch as Post | Page);
      setIsRecoveringEditorItem(false);
      setHasTriedEditorRecovery(true);
      return;
    }

    const recoverEditorItem = async () => {
      setIsRecoveringEditorItem(true);
      setHasTriedEditorRecovery(false);

      try {
        if (effectiveIsPage) {
          const res = await vonFetch(`${API.getPages}?id=${encodeURIComponent(editorItemId)}`);
          const data = await res.json();
          const page = data?.pages?.[0];

          if (!cancelled && data?.success && page) {
            setRecoveredEditorItem({
              id: String(page.id || ''),
              title: page.title || '',
              content: page.content || '',
              status: page.status || 'draft',
              updatedAt: page.updatedAt || page.updated_at || '',
              updated_at: page.updated_at,
              slug: page.slug || '',
              excerpt: page.excerpt || '',
              category: 'Page',
              author: page.author || '',
              author_id: page.author_id || null,
              createdAt: page.createdAt || page.created_at || '',
              created_at: page.created_at,
              metaDescription: page.metaDescription || page.meta_description || '',
              keywords: page.keywords || '',
            } as Page);
          }
          return;
        }

        const res = await vonFetch(`${API.getPost}?id=${encodeURIComponent(editorItemId)}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        const post = data?.post;

        if (!cancelled && data?.success && post) {
          setRecoveredEditorItem({
            id: String(post.id || ''),
            title: post.title || '',
            excerpt: post.excerpt || '',
            content: post.content || '',
            image: post.image || '',
            imageSrcSet: post.imageSrcSet || post.image_srcset || '',
            status: post.status || 'draft',
            category: post.category || 'Uncategorized',
            updatedAt: post.updatedAt || post.updated_at || '',
            updated_at: post.updated_at,
            author: post.author || '',
            author_data: post.author_data,
            author_id: post.author_id || null,
            readTime: post.readTime || post.read_time || '',
            metaDescription: post.metaDescription || post.meta_description || '',
            keywords: post.keywords || '',
            slug: post.slug || '',
            scheduledAt: post.scheduledAt || post.scheduled_at || '',
            scheduled_at: post.scheduled_at,
            createdAt: post.createdAt || post.created_at || '',
            created_at: post.created_at,
          } as Post);
        }
      } catch (error) {
        console.error('Failed to recover editor item:', error);
      } finally {
        if (!cancelled) {
          setIsRecoveringEditorItem(false);
          setHasTriedEditorRecovery(true);
        }
      }
    };

    void recoverEditorItem();

    return () => {
      cancelled = true;
    };
  }, [editingItem, editorItemId, effectiveIsPage, pages, posts]);

  useEffect(() => {
    if (
      !effectiveEditingItem &&
      !isRecoveringEditorItem &&
      (!editorItemId || hasTriedEditorRecovery)
    ) {
      navigate(effectiveIsPage ? '/admin/pages' : '/admin/posts', { replace: true });
    }
  }, [
    effectiveEditingItem,
    editorItemId,
    effectiveIsPage,
    hasTriedEditorRecovery,
    isRecoveringEditorItem,
    navigate,
  ]);

  if (effectiveIsPage && !canManagePages) {
    return <Navigate to="/admin/posts" replace />;
  }

  if (!effectiveEditingItem || isRecoveringEditorItem) {
    return null;
  }

  return (
    <PostEditor
      initialItem={effectiveEditingItem}
      isPage={effectiveIsPage}
      navigation={navigation}
      posts={posts}
      settings={settings}
      onSave={(item, addToMenu, isAutoSave) =>
        handleSaveContent(
          item,
          addToMenu,
          navigate,
          settings,
          handleUpdateSettings,
          isAutoSave,
          effectiveIsPage
        )
      }
      onBack={() => navigate(effectiveIsPage ? '/admin/pages' : '/admin/posts')}
    />
  );
};

export default App;
