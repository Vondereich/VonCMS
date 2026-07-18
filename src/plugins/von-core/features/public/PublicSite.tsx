import React, { lazy, useEffect } from 'react';
import { Post, User, Comment, SiteSettings, Page } from '../../../../types';
import { useTheme } from '../themes/ThemeContext';
import { PluginSlot } from '../plugins/registry';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { GlobalLightbox } from '../../../../components/GlobalLightbox';
import { CookieBanner } from '../../../../components/CookieBanner';
import { isSystemPluginActive } from '../../../../utils/pluginRuntime';

interface PublicSiteProps {
  posts: Post[];
  pages?: Page[];
  user: User | null;
  comments: Comment[];
  allUsers: User[];
  settings: SiteSettings;
  onAddComment: (postId: string, content: string) => void;
  onLikeComment: (commentId: string) => boolean | Promise<boolean>;
  onReplyComment: (commentId: string, content: string) => void;
  onNavigateAdmin: () => void;
  onLogin: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  // New Props for Controlled Navigation
  currentView: 'home' | 'single-post' | 'page' | 'profile' | 'category';
  selectedPost: Post | null;
  selectedPage?: Page | null;
  selectedProfile: string | null;
  resolvedProfile?: User | null;
  onPostClick: (postId: string) => void;
  onViewProfile: (username: string) => void;
  onBackToHome: () => void;
  onUpdateUser?: (user: Partial<User>) => void;
  // Category Navigation
  selectedCategory?: string | null;
  onCategoryClick?: (category: string) => void;
  onPageClick?: (slug: string) => void;
}

const themeLayouts: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'theme-default': lazy(() => import('../../../../themes/default/Layout')),
  'theme-prism': lazy(() => import('../../../../themes/prism/Layout')),
  'theme-techpress': lazy(() => import('../../../../themes/techpress/Layout')),
  'theme-portfolio': lazy(() => import('../../../../themes/portfolio/Layout')),
  'theme-digest': lazy(() => import('../../../../themes/digest/Layout')),
  'theme-corporate-pro': lazy(() => import('../../../../themes/corporate-pro/Layout')),
};

const PublicSite: React.FC<PublicSiteProps> = (props) => {
  const { activeTheme } = useTheme();
  const analyticsPluginActive = isSystemPluginActive(props.settings, 'vp_analytics');

  // Fallback Title Sync: Fixes "stuck" tab titles when VonSEO is disabled
  useEffect(() => {
    if (isSystemPluginActive(props.settings, 'vp_von_seo')) return;
    const profileTitle =
      props.currentView === 'profile'
        ? props.resolvedProfile?.display_name || props.resolvedProfile?.username
        : null;
    const sub =
      props.selectedPost?.title ||
      props.selectedPage?.title ||
      props.selectedCategory ||
      profileTitle;
    const siteTitle = props.settings.siteName || 'VonCMS';
    document.title = sub ? `${sub} | ${siteTitle}` : siteTitle;
  }, [
    props.currentView,
    props.selectedPost?.title,
    props.selectedPage?.title,
    props.selectedCategory,
    props.resolvedProfile?.display_name,
    props.resolvedProfile?.username,
    props.settings,
  ]);

  const LayoutComponent = themeLayouts[activeTheme.id] || themeLayouts['theme-default'];

  // Track page views (Monolithic Tracking)
  useEffect(() => {
    if (!isSystemPluginActive(props.settings, 'vp_analytics')) return;

    const payload: any = {
      url: window.location.pathname,
      referrer: document.referrer,
    };

    if (props.currentView === 'single-post' && props.selectedPost) {
      payload.postId = props.selectedPost.id;
    } else if (props.currentView === 'page' && props.selectedPage) {
      payload.pageId = props.selectedPage.id;
    }

    vonFetch(API.trackMonolithic, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [props.currentView, props.selectedPost?.id, props.selectedPage?.id, props.settings]);

  // Note: Shortcode support (e.g., [von-contact]) is now handled directly by
  // ContentRenderer in each theme. This is more reliable than DOM scanning.

  // Render the selected layout with all props
  return (
    <>
      {/* Global Plugin Slot: Header Top (Automatic for all themes) */}
      <PluginSlot
        location="header_top"
        activePlugins={props.settings.activePlugins}
        customPlugins={props.settings.customPlugins}
        pluginConfig={props.settings.pluginConfig}
      />

      <React.Suspense fallback={<div className="min-h-screen bg-white dark:bg-slate-950" />}>
        <LayoutComponent {...props} onPageClick={props.onPageClick || (() => {})} />
      </React.Suspense>

      {/* Global Plugin Slot: Footer Bottom (Automatic for all themes) */}
      <PluginSlot
        location="footer_bottom"
        activePlugins={props.settings.activePlugins}
        customPlugins={props.settings.customPlugins}
        pluginConfig={props.settings.pluginConfig}
      />
      {/* Image Lightbox - Auto-detects images in content */}
      <GlobalLightbox />

      {/* Cookie Banner - Frontend Only */}
      <CookieBanner
        cookieConsentRequired={
          analyticsPluginActive && (props.settings.analytics?.cookieConsent || false)
        }
      />
    </>
  );
};

export default PublicSite;
