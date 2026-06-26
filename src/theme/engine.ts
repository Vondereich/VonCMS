import { SiteSettings } from '../types';

/**
 * Theme Engine Utils
 * Converts JSON settings into actionable CSS variables and styles.
 * This separates the "Design Logic" from the "View Logic".
 */

export const generateThemeStyles = (settings: SiteSettings): React.CSSProperties => {
  return {
    '--primary-color': settings.theme.primaryColor,
    '--border-radius': settings.theme.borderRadius,
    '--font-family': settings.theme.fontFamily,
  } as React.CSSProperties;
};

export const injectCustomCss = (settings: SiteSettings) => {
  return settings.theme.customCss || '';
};
