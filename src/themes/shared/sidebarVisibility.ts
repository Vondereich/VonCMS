import type { SiteSettings } from '../../types';

interface SidebarContentOptions {
  includeNewsletter?: boolean;
}

const renderableSidebarWidgetTypes = new Set(['trending', 'profile', 'custom']);

export const hasVisibleSidebarWidgets = (settings: Pick<SiteSettings, 'sidebarLayout'>): boolean =>
  (settings.sidebarLayout || []).some(
    (widget) =>
      widget.isVisible !== false && renderableSidebarWidgetTypes.has(widget.type as string)
  );

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
