import type { SiteSettings, ThemeAppearance } from '../../types';
import { mergeSettingsDraft } from '../../utils/settingsDraft';

export const THEME_SETTINGS_KEYS = {
  'theme-default': 'default',
  'theme-prism': 'prism',
  'theme-techpress': 'techpress',
  'theme-portfolio': 'portfolio',
  'theme-digest': 'digest',
  'theme-corporate-pro': 'corporatePro',
} as const;

export type ThemeSettingsKey = (typeof THEME_SETTINGS_KEYS)[keyof typeof THEME_SETTINGS_KEYS];
type ThemeDraft<K extends ThemeSettingsKey> = NonNullable<SiteSettings['theme'][K]>;

export const getThemeAppearance = (
  settings: SiteSettings,
  key: ThemeSettingsKey
): Required<ThemeAppearance> => {
  const config = settings.theme[key];
  const legacyPrimary = settings.theme.primaryColor;
  const defaults: Record<ThemeSettingsKey, string> = {
    default: legacyPrimary || '#0ea5ff',
    corporatePro: legacyPrimary || '#2563eb',
    techpress: legacyPrimary || '#0066cc',
    portfolio: settings.theme.portfolio?.accentColor || '#8B5CF6',
    digest: settings.theme.digest?.accentColor || '#00D1D1',
    prism:
      settings.theme.prism?.colorScheme === 'purple'
        ? '#a855f7'
        : settings.theme.prism?.colorScheme === 'green'
          ? '#22c55e'
          : '#06b6d4',
  };
  const usesAccentSetting = key === 'portfolio' || key === 'digest' || key === 'prism';
  return {
    primaryColor: usesAccentSetting ? defaults[key] : config?.primaryColor || defaults[key],
    fontFamily: config?.fontFamily || settings.theme.fontFamily || 'Inter, sans-serif',
    borderRadius: config?.borderRadius || settings.theme.borderRadius || '0.5rem',
  };
};

// Pin legacy appearance values on the first theme save without altering existing copy or options.
// The old top-level fields remain compatibility defaults, not controls owned by Default.
export const initializeThemeAppearance = (settings: SiteSettings): SiteSettings['theme'] => {
  const theme = { ...settings.theme };
  for (const key of Object.values(THEME_SETTINGS_KEYS)) {
    const appearance = getThemeAppearance(settings, key);
    const usesAccentSetting = key === 'portfolio' || key === 'digest' || key === 'prism';
    const config = {
      ...(key === 'prism' && !settings.theme.prism
        ? { neonEffects: true, colorScheme: 'cyan' as const, fontSize: 'md' as const }
        : {}),
      fontFamily: appearance.fontFamily,
      borderRadius: appearance.borderRadius,
      ...(!usesAccentSetting ? { primaryColor: appearance.primaryColor } : {}),
      ...settings.theme[key],
    };
    Object.assign(theme, { [key]: config });
  }
  return theme;
};

export const buildThemeSettingsUpdate = <K extends ThemeSettingsKey>(
  settings: SiteSettings,
  key: K,
  baseline: ThemeDraft<K>,
  draft: ThemeDraft<K>
): SiteSettings => {
  const theme = initializeThemeAppearance(settings);
  return {
    ...settings,
    theme: {
      ...theme,
      [key]: mergeSettingsDraft(theme[key] as ThemeDraft<K>, baseline, draft),
    },
  };
};

// Project only the active appearance into shared public components; never persist this projection.
export const resolvePublicThemeSettings = (
  settings: SiteSettings,
  themeId: string
): SiteSettings => {
  if (!Object.hasOwn(THEME_SETTINGS_KEYS, themeId)) return settings;
  const key = THEME_SETTINGS_KEYS[themeId as keyof typeof THEME_SETTINGS_KEYS];
  return { ...settings, theme: { ...settings.theme, ...getThemeAppearance(settings, key) } };
};
