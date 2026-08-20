import type { SiteSettings } from '../../types';

interface SidebarContentOptions {
  includeNewsletter?: boolean;
}

const renderableSidebarWidgetTypes = new Set(['trending', 'profile', 'custom']);

export const hasVisibleSidebarWidgets = (
  settings: Pick<SiteSettings, 'sidebarLayout' | 'publicCategories'>
): boolean =>
  (settings.sidebarLayout || []).some(
    (widget) =>
      widget.isVisible !== false &&
      (renderableSidebarWidgetTypes.has(widget.type as string) ||
        (widget.type === 'categories' &&
          (settings.publicCategories || []).some(
            (category) => typeof category === 'string' && category.trim() !== ''
          )))
  );

export const hasSidebarNewsletter = (settings: Pick<SiteSettings, 'newsletter'>): boolean =>
  Boolean(
    settings.newsletter?.enabled &&
    (settings.newsletter.position === 'sidebar' || settings.newsletter.position === 'both')
  );

export const hasActiveSidebarContent = (
  settings: Pick<SiteSettings, 'newsletter' | 'sidebarLayout' | 'publicCategories'>,
  { includeNewsletter = true }: SidebarContentOptions = {}
): boolean =>
  hasVisibleSidebarWidgets(settings) || (includeNewsletter && hasSidebarNewsletter(settings));
