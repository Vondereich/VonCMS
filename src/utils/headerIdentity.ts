import type { HeaderIdentityMode, SiteSettings } from '../types';

export const HEADER_IDENTITY_MODES: readonly HeaderIdentityMode[] = [
  'logo_and_text',
  'logo_only',
  'text_only',
];

type HeaderIdentitySettings = Pick<
  SiteSettings,
  'headerIdentityMode' | 'logoUrl' | 'useLogoAsTitle'
>;

export const resolveHeaderIdentityMode = (
  settings?: Partial<HeaderIdentitySettings> | null
): HeaderIdentityMode => {
  const requestedMode = settings?.headerIdentityMode;
  if (requestedMode && HEADER_IDENTITY_MODES.includes(requestedMode)) {
    return requestedMode;
  }

  return settings?.useLogoAsTitle ? 'logo_only' : 'logo_and_text';
};

export const getHeaderIdentityState = (
  settings?: Partial<HeaderIdentitySettings> | null
): {
  mode: HeaderIdentityMode;
  showUploadedLogo: boolean;
  showFallbackMark: boolean;
  showTitle: boolean;
  logoUsesTitleSlot: boolean;
} => {
  const mode = resolveHeaderIdentityMode(settings);
  const hasUploadedLogo = Boolean(settings?.logoUrl?.trim());

  return {
    mode,
    showUploadedLogo: hasUploadedLogo && mode !== 'text_only',
    showFallbackMark: !hasUploadedLogo && mode === 'logo_and_text',
    showTitle: mode !== 'logo_only' || !hasUploadedLogo,
    logoUsesTitleSlot: hasUploadedLogo && mode === 'logo_only',
  };
};
