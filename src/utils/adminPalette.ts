import type { AdminPaletteId } from '../types';
import { BASE_PATH } from '../config/site.config';

export const ADMIN_PALETTE_STORAGE_PREFIX = 'von_admin_palette:';
export const DEFAULT_ADMIN_PALETTE: AdminPaletteId = 'charcoal-blue';

export interface AdminPaletteOption {
  id: AdminPaletteId;
  label: string;
  description: string;
  swatches: readonly string[];
}

export const ADMIN_PALETTES: readonly AdminPaletteOption[] = [
  {
    id: 'charcoal-blue',
    label: 'Von Blue',
    description: 'The familiar VonCMS blue accent with a charcoal navigation shell.',
    swatches: ['#17181b', '#2563eb', '#60a5fa', '#e2e8f0'],
  },
  {
    id: 'meadow-gold',
    label: 'Meadow Gold',
    description: 'A grounded green interface with warm cream and gold highlights.',
    swatches: ['#4e7a27', '#7ab13f', '#a6ca69', '#ffcf00'],
  },
  {
    id: 'harbour-amber',
    label: 'Harbour Amber',
    description: 'Deep harbour navy paired with warm amber and soft cream.',
    swatches: ['#001b2e', '#294c60', '#ffb236', '#ff9633'],
  },
] as const;

const ADMIN_PALETTE_IDS = new Set<AdminPaletteId>(ADMIN_PALETTES.map((palette) => palette.id));

export const normalizeAdminPalette = (value: unknown): AdminPaletteId =>
  typeof value === 'string' && ADMIN_PALETTE_IDS.has(value as AdminPaletteId)
    ? (value as AdminPaletteId)
    : DEFAULT_ADMIN_PALETTE;

const normalizeStorageScope = (basePath: string): string => {
  const path = basePath.trim().replace(/^\/+|\/+$/g, '');
  return path === '' ? '/' : `/${path}/`;
};

export const getAdminPaletteStorageKey = (): string =>
  `${ADMIN_PALETTE_STORAGE_PREFIX}${normalizeStorageScope(BASE_PATH || '/')}`;

export const readStoredAdminPalette = (): AdminPaletteId => {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_PALETTE;

  try {
    return normalizeAdminPalette(window.localStorage.getItem(getAdminPaletteStorageKey()));
  } catch {
    return DEFAULT_ADMIN_PALETTE;
  }
};

export const applyAdminPalette = (value: unknown, persist = true): AdminPaletteId => {
  const palette = normalizeAdminPalette(value);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset['adminPalette'] = palette;
  }

  if (persist && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getAdminPaletteStorageKey(), palette);
    } catch {
      // Local storage is optional; the database setting remains canonical.
    }
  }

  return palette;
};
