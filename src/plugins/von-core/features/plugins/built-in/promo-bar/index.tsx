import React, { useState } from 'react';
import { PluginDefinition, PluginLocation } from '../../../../../../types';
import { Megaphone, X } from 'lucide-react';
import { normalizeSiteUrl } from '../../../../../../utils/siteUtils';

// Storage key for dismissed state
const DISMISSED_KEY = 'voncms_promo_bar_dismissed';
const DEFAULT_BACKGROUND_COLOR = '#db2777';

const getReadableTextColor = (backgroundColor: string) => {
  const hex = backgroundColor.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? '#111827' : '#ffffff';
};

const getDismissMs = (dismissHours: number) => Math.max(1, dismissHours || 24) * 60 * 60 * 1000;

const isWithinCampaignWindow = (startsAt?: string, endsAt?: string): boolean => {
  const now = Date.now();
  const startTime = startsAt ? Date.parse(startsAt) : NaN;
  const endTime = endsAt ? Date.parse(endsAt) : NaN;

  if (!Number.isNaN(startTime) && now < startTime) return false;
  if (!Number.isNaN(endTime) && now > endTime) return false;

  return true;
};

// Check if dismissed (persists for the configured campaign window)
const isDismissed = (dismissHours: number): boolean => {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) return false;
    const dismissedTime = parseInt(dismissed, 10);
    const now = Date.now();
    if (now - dismissedTime < getDismissMs(dismissHours)) return true;
    // Expired, remove
    localStorage.removeItem(DISMISSED_KEY);
    return false;
  } catch {
    return false;
  }
};

// Set dismissed state
const setDismissed = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
};

// Promo Bar Component (internal)
const PromoBarComponent: React.FC<{
  text: string;
  linkUrl: string;
  linkText: string;
  backgroundColor: string;
  dismissHours: number;
  startsAt?: string;
  endsAt?: string;
  targetBlank: boolean;
}> = ({
  text,
  linkUrl,
  linkText,
  backgroundColor,
  dismissHours,
  startsAt,
  endsAt,
  targetBlank,
}) => {
  const [dismissed, setDismissedState] = useState(() => isDismissed(dismissHours));
  const textColor = getReadableTextColor(backgroundColor);

  // Don't render if dismissed
  if (dismissed) return null;
  if (!isWithinCampaignWindow(startsAt, endsAt)) return null;

  const handleDismiss = () => {
    setDismissed();
    setDismissedState(true);
  };

  return (
    <div
      className="text-xs md:text-sm font-bold py-2 px-4 text-center relative animate-fade-in z-[60]"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto flex justify-center items-center gap-2">
        <Megaphone size={16} className="animate-pulse" />
        <span>{text}</span>
        <a
          href={normalizeSiteUrl(linkUrl)}
          target={targetBlank ? '_blank' : undefined}
          rel={targetBlank ? 'noopener noreferrer' : undefined}
          className="underline hover:opacity-80 ml-2"
          style={{ color: textColor }}
        >
          {linkText}
        </a>
      </div>
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Dismiss announcement"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const PromoBarPlugin: PluginDefinition = {
  id: 'vp_promo_bar',
  name: 'Top Announcement Bar',
  description: 'Displays a high-visibility notification bar above the main menu.',
  version: '1.25',
  author: 'VonCMS Team',
  render: (location: PluginLocation, props?: any) => {
    if (location !== 'header_top') return null;

    // Use props (pluginConfig) or fallback to defaults
    const text =
      props?.text || '🚀 SPECIAL OFFER: Upgrade your experience today - Limited Time Offer!';
    const linkUrl = props?.linkUrl || '#';
    const linkText = props?.linkText || 'Click Here';
    const backgroundColor = props?.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    const dismissHours = Number(props?.dismissHours || 24);
    const startsAt = props?.startsAt || '';
    const endsAt = props?.endsAt || '';
    const targetBlank = props?.targetBlank !== false && props?.targetBlank !== 'false';

    return (
      <PromoBarComponent
        text={text}
        linkUrl={linkUrl}
        linkText={linkText}
        backgroundColor={backgroundColor}
        dismissHours={dismissHours}
        startsAt={startsAt}
        endsAt={endsAt}
        targetBlank={targetBlank}
      />
    );
  },
};
