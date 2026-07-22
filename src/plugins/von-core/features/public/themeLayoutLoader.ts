import type React from 'react';

export type PublicThemeLayoutComponent = React.ComponentType<any>;

type PublicThemeLayoutModule = {
  default: PublicThemeLayoutComponent;
};

const DEFAULT_PUBLIC_THEME_ID = 'theme-default';

const publicThemeLayoutLoaders = {
  'theme-default': () => import('../../../../themes/default/Layout'),
  'theme-prism': () => import('../../../../themes/prism/Layout'),
  'theme-techpress': () => import('../../../../themes/techpress/Layout'),
  'theme-portfolio': () => import('../../../../themes/portfolio/Layout'),
  'theme-digest': () => import('../../../../themes/digest/Layout'),
  'theme-corporate-pro': () => import('../../../../themes/corporate-pro/Layout'),
} satisfies Record<string, () => Promise<PublicThemeLayoutModule>>;

const themeLayoutPromises = new Map<string, Promise<PublicThemeLayoutComponent>>();
const loadedThemeLayouts = new Map<string, PublicThemeLayoutComponent>();

export const resolvePublicThemeId = (themeId?: string | null): string =>
  themeId && Object.prototype.hasOwnProperty.call(publicThemeLayoutLoaders, themeId)
    ? themeId
    : DEFAULT_PUBLIC_THEME_ID;

export const getLoadedPublicThemeLayout = (
  themeId?: string | null
): PublicThemeLayoutComponent | null =>
  loadedThemeLayouts.get(resolvePublicThemeId(themeId)) || null;

export const loadPublicThemeLayout = (
  themeId?: string | null
): Promise<PublicThemeLayoutComponent> => {
  const resolvedThemeId = resolvePublicThemeId(themeId);
  const loadedLayout = loadedThemeLayouts.get(resolvedThemeId);
  if (loadedLayout) return Promise.resolve(loadedLayout);

  const pendingLayout = themeLayoutPromises.get(resolvedThemeId);
  if (pendingLayout) return pendingLayout;

  const loader = publicThemeLayoutLoaders[resolvedThemeId as keyof typeof publicThemeLayoutLoaders];
  const layoutPromise = loader().then((module) => {
    loadedThemeLayouts.set(resolvedThemeId, module.default);
    return module.default;
  });

  themeLayoutPromises.set(resolvedThemeId, layoutPromise);
  return layoutPromise;
};

export const preloadPublicThemeLayout = loadPublicThemeLayout;
