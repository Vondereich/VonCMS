/**
 * VonCMS Settings Hook
 * Handles site settings and navigation management
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { SiteSettings, Page } from '../types';
import { API, BASE_PATH } from '../config/site.config';
import { getAuthHeader } from '../config/auth.config';
import { vonFetch } from '../utils/api';
import toast from 'react-hot-toast';

// Initial Settings
// Initial Settings -- Hydrated from PHP injection to prevent early-load thrashing / default fallback on bots
const _s = typeof window !== 'undefined' ? window.__INITIAL_SETTINGS__ : null;

const INITIAL_SETTINGS: SiteSettings = {
  siteName: _s?.siteName || 'My Website',
  siteUrl: _s?.siteUrl || '',
  domainUrl: _s?.domainUrl || '',
  siteDescription: _s?.siteDescription || 'A modern content management system',
  ...(_s?.activeThemeId ? { activeThemeId: _s.activeThemeId } : {}),
  ...(_s?.permalinkStructure ? { permalinkStructure: _s.permalinkStructure } : {}),
  postsPerPage: 6,
  maintenanceMode: false,
  emailSmtp: '',
  ads: { headerAd: '', inFeedAd: '', inFeedFrequency: 6, popupAd: '', popupEnabled: false },
  theme: {
    primaryColor: '#0ea5ff',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.5rem',
    customCss: '',
  },
  api: { mapsApiKey: '' },
  media: {
    optimization: {
      enabled: false,
      compressionLevel: 'medium',
      convertToWebP: false,
      maxWidth: 1920,
      maxHeight: 1080,
    },
    storage: { location: 'local', folderStructure: 'year_month', cdnUrl: '' },
    performance: { lazyLoadImages: true, lazyLoadIframes: true },
  },
  sidebarLayout: [{ id: 'w1', type: 'trending', title: 'Latest Stories', isVisible: true }],
  navigation: [{ id: 'nav1', label: 'Home', url: 'home', type: 'internal' }],
  categories: ['Uncategorized', 'News', 'Updates'],
  activePlugins: [],
  customPlugins: [],
  pluginConfig: {
    vp_promo_bar: {
      text: '',
      linkUrl: '#',
      linkText: 'Learn More',
    },
    vp_gift_widget: {
      targetUrl: '',
      tooltipText: '',
    },
  },
  discussionEnabled: _s?.discussionEnabled ?? true,
  logoUrl: _s?.logoUrl || '',
  invertLogoInDarkMode: _s?.invertLogoInDarkMode ?? false,
  faviconUrl: _s?.faviconUrl || '',
  footerLinks: [],
  footerCopyright: '',
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_SETTINGS);
  const settingsRef = useRef<SiteSettings>(INITIAL_SETTINGS);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleCategoriesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (!Array.isArray(detail)) {
        return;
      }
      setSettings((prev) => ({ ...prev, categories: detail }));
    };

    window.addEventListener('voncms:categories-updated', handleCategoriesUpdated as EventListener);
    return () => {
      window.removeEventListener(
        'voncms:categories-updated',
        handleCategoriesUpdated as EventListener
      );
    };
  }, []);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    try {
      const res = await vonFetch(API.settings);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);

          // Check installation status
          if (data && data.installed === false) {
            console.warn('System not installed. Redirecting to installer...');
            const currentPath = window.location.pathname;
            if (!currentPath.endsWith('/install')) {
              window.location.href = `${BASE_PATH}install`;
              return;
            }
          }

          if (data) {
            setSettings((prev) => ({ ...prev, ...data }));
          }
        } catch (e) {
          console.error('Failed to parse settings JSON:', e);
        }
      } else {
        console.warn('Failed to load settings from database, status:', res.status);
      }
    } catch (e) {
      console.error('Failed to load settings from database:', e);
    }
  }, []);

  // Update settings
  const handleUpdateSettings = useCallback(
    async (newSettings: SiteSettings, options: { optimistic?: boolean } = {}): Promise<boolean> => {
      const optimistic = options.optimistic !== false;
      const previousSettings: SiteSettings = settingsRef.current;
      const restorePreviousSettings = () => {
        if (optimistic) {
          settingsRef.current = previousSettings;
          setSettings(previousSettings);
        }
      };

      if (optimistic) {
        settingsRef.current = newSettings;
        setSettings(newSettings);
      }

      try {
        const res = await vonFetch(API.saveSettings, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
          body: JSON.stringify(newSettings),
        });

        if (!res.ok) {
          // Check for Session/CSRF issues
          const data = await res.json().catch(() => ({}));

          if (res.status === 401 || (res.status === 403 && data.error === 'Invalid CSRF token')) {
            // Soft Error Handling: Dispatch event to open Login Modal
            window.dispatchEvent(new Event('von:session-expired'));
            console.warn('Session expired or invalid CSRF token during settings save.');
            restorePreviousSettings();
            return false; // Stop here, don't show scary error
          }

          console.error('Failed to save settings:', res.status, data);
          toast.error('Failed to save settings: ' + (data.message || 'Database error'));
          restorePreviousSettings();
          return false;
        } else {
          const data = await res.json();
          if (!data.success) {
            console.error('Settings save failed:', data.message);
            toast.error('Settings save failed: ' + (data.message || 'Unknown error'));
            restorePreviousSettings();
            return false;
          }
        }

        if (!optimistic) {
          settingsRef.current = newSettings;
          setSettings(newSettings);
        }

        return true;
      } catch (e) {
        console.error('Settings save error:', e);
        toast.error('Failed to save settings. Changes may be lost on refresh.');
        restorePreviousSettings();
        return false;
      }
    },
    []
  );

  // Toggle navigation item
  const onToggleNav = useCallback(async (pageId: string, pages: Page[]) => {
    // Compute new navigation state once — shared between UI and server save
    const computeNavigation = (currentNav: any[]) => {
      const exists = currentNav.find((n: any) => n.url === `page:${pageId}`);
      if (exists) {
        return currentNav.filter((n: any) => n.url !== `page:${pageId}`);
      }
      const pg = pages.find((p: any) => p.id === pageId);
      const label = pg ? pg.title : `Page ${pageId}`;
      return [
        ...currentNav,
        {
          id: `nav-${Date.now()}`,
          label,
          url: `page:${pageId}`,
          type: 'internal' as const,
        },
      ];
    };

    // Capture the computed settings from the latest state via setSettings callback,
    // then reuse the exact same object for the server save — no double computation.
    const currentSettings = settingsRef.current;
    const newNav = computeNavigation(currentSettings.navigation || []);
    const nextSettings = { ...currentSettings, navigation: newNav };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);

    let saved = false;
    try {
      const res = await vonFetch(API.saveSettings, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
        body: JSON.stringify(nextSettings),
      });
      const data = await res.json().catch(() => ({}));
      saved = res.ok && data.success !== false;
    } catch (e) {
      saved = false;
    }

    if (!saved) {
      toast.error('Failed to persist navigation change. It will be lost on refresh.');
    }
  }, []);

  return {
    settings,
    setSettings,
    loadSettings,
    handleUpdateSettings,
    onToggleNav,
    INITIAL_SETTINGS,
  };
}
