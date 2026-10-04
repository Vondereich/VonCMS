import type { SiteSettings } from '../../types';
import { buildThemeSettingsUpdate } from '../shared/themeSettings';

export type CorporateHomeSectionId = 'hero' | 'services' | 'about' | 'posts' | 'cta';
export type CorporateProConfig = NonNullable<SiteSettings['theme']['corporatePro']>;

export const CORPORATE_HOME_SECTIONS = [
  { id: 'hero', label: 'Hero', visibilityKey: 'showHero' },
  { id: 'services', label: 'Services', visibilityKey: 'showServices' },
  { id: 'about', label: 'About & Stats', visibilityKey: 'showAbout' },
  { id: 'posts', label: 'Latest Posts', visibilityKey: 'showPosts' },
  { id: 'cta', label: 'Call to Action', visibilityKey: 'showCta' },
] as const;

export const normalizeCorporateSectionOrder = (value: unknown): CorporateHomeSectionId[] => {
  const known = CORPORATE_HOME_SECTIONS.map((section) => section.id);
  const supplied = Array.isArray(value) ? value.slice(0, 50) : [];
  const order: CorporateHomeSectionId[] = [];
  for (const id of supplied) {
    const section = CORPORATE_HOME_SECTIONS.find((item) => item.id === id);
    if (section && !order.includes(section.id)) order.push(section.id);
  }
  return [...order, ...known.filter((id) => !order.includes(id))];
};

export const getCorporateHomeSections = (config: CorporateProConfig = {}) =>
  normalizeCorporateSectionOrder(config.sectionOrder).filter((id) => {
    const section = CORPORATE_HOME_SECTIONS.find((item) => item.id === id)!;
    return config[section.visibilityKey] !== false;
  });

export const moveCorporateSection = (
  order: unknown,
  id: CorporateHomeSectionId,
  direction: -1 | 1
): CorporateHomeSectionId[] => {
  const next = normalizeCorporateSectionOrder(order);
  const from = next.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

export const createCorporateSettingsDraft = (
  config: CorporateProConfig = {}
): CorporateProConfig => ({
  ...config,
  sectionOrder: normalizeCorporateSectionOrder(config.sectionOrder),
  ...Object.fromEntries(
    CORPORATE_HOME_SECTIONS.map((section) => [
      section.visibilityKey,
      config[section.visibilityKey] !== false,
    ])
  ),
});

export const buildCorporateSettingsUpdate = (
  settings: SiteSettings,
  baseline: CorporateProConfig,
  draft: CorporateProConfig
): SiteSettings => buildThemeSettingsUpdate(settings, 'corporatePro', baseline, draft);
