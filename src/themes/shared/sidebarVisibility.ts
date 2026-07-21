import { SiteSettings } from '../../types';

interface SidebarContentOptions {
  includeNewsletter?: boolean;
}

export const hasVisibleSidebarWidgets = (settings: Pick<SiteSettings, 'sidebarLayout'>): boolean =>
  (settings.sidebarLayout || []).some((widget) => widget.isVisible !== false);

export const hasSidebarNewsletter = (settings: Pick<SiteSettings, 'newsletter'>): boolean =>
  Boolean(
    settings.newsletter?.enabled &&
    (settings.newsletter.position === 'sidebar' || settings.newsletter.position === 'both')
  );

export const hasActiveSidebarContent = (
  settings: Pick<SiteSettings, 'newsletter' | 'sidebarLayout'>,
  { includeNewsletter = true }: SidebarContentOptions = {}
): boolean =>
  hasVisibleSidebarWidgets(settings) || (includeNewsletter && hasSidebarNewsletter(settings));
