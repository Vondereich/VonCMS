import React, { useState } from 'react';
import { PluginDefinition, PluginLocation } from '../../../../../../types';
import { Megaphone, X } from 'lucide-react';
import { normalizeSiteUrl } from '../../../../../../utils/siteUtils';
import { usePlugin } from '../../../../providers/VonProviders';
import { campaignTimestamp } from './schedule';

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

const isWithinCampaignWindow = (startsAt?: string, endsAt?: string, timeZone = 'UTC'): boolean => {
  const now = Date.now();
  try {
    const startTime = campaignTimestamp(startsAt, timeZone);
    const endTime = campaignTimestamp(endsAt, timeZone);
    if (startTime !== null && endTime !== null && endTime <= startTime) return false;
    return (startTime === null || now >= startTime) && (endTime === null || now < endTime);
  } catch {
    return false;
  }
};

// Check if dismissed (persists for the configured campaign window)
const isDismissed = (campaignId: string, dismissHours: number): boolean => {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) return false;
    const record = JSON.parse(dismissed);
    if (
      !record ||
      typeof record !== 'object' ||
      record.campaign !== campaignId ||
      typeof record.at !== 'number' ||
      !Number.isFinite(record.at)
    )
      return false;
    const dismissedTime = record.at;
    const now = Date.now();
    if (dismissedTime <= now && now - dismissedTime < getDismissMs(dismissHours)) return true;
    // Expired, remove
    localStorage.removeItem(DISMISSED_KEY);
    return false;
  } catch {
    return false;
  }
};

// Set dismissed state
const setDismissed = (campaignId: string) => {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify({ campaign: campaignId, at: Date.now() }));
  } catch {
    // Ignore storage errors
  }
};

// Promo Bar Component (internal)
const PromoBarComponent: React.FC<{
  campaignId: string;
  text: string;
  linkUrl: string;
  linkText: string;
  backgroundColor: string;
  allowDismiss: boolean;
  dismissHours: number;
  startsAt?: string;
  endsAt?: string;
  targetBlank: boolean;
}> = ({
  campaignId,
  text,
  linkUrl,
  linkText,
  backgroundColor,
  allowDismiss,
  dismissHours,
  startsAt,
  endsAt,
  targetBlank,
}) => {
  const { timeZone } = usePlugin();
  const [dismissed, setDismissedState] = useState(
    () => allowDismiss && isDismissed(campaignId, dismissHours)
  );
  const textColor = getReadableTextColor(backgroundColor);

  // Don't render if dismissed
  if (dismissed) return null;
  if (!isWithinCampaignWindow(startsAt, endsAt, timeZone)) return null;

  const destination = normalizeSiteUrl(linkUrl);

  const handleDismiss = () => {
    setDismissed(campaignId);
    setDismissedState(true);
  };

  return (
    <div
      className="text-xs md:text-sm font-bold py-2 px-4 text-center relative animate-fade-in z-60"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto flex justify-center items-center gap-2">
        <Megaphone size={16} className="animate-pulse" />
        <span>{text}</span>
        {destination !== '#' && (
          <a
            href={destination}
            target={targetBlank ? '_blank' : undefined}
            rel={targetBlank ? 'noopener noreferrer' : undefined}
            className="underline hover:opacity-80 ml-2"
            style={{ color: textColor }}
          >
            {linkText}
          </a>
        )}
      </div>
      {allowDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-sm transition-colors"
          aria-label="Dismiss announcement"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export const PromoBarPlugin: PluginDefinition<import('../../../../../../types').PromoBarConfig> = {
  id: 'vp_promo_bar',
  name: 'Top Announcement Bar',
  description: 'Displays a high-visibility notification bar above the main menu.',
  version: '1.28',
  author: 'VonCMS Team',
  render: (location: PluginLocation, props) => {
    if (location !== 'header_top') return null;

    // Use props (pluginConfig) or fallback to defaults
    const text =
      props?.text || '🚀 SPECIAL OFFER: Upgrade your experience today - Limited Time Offer!';
    const linkUrl = props?.linkUrl || '#';
    const linkText = props?.linkText || 'Click Here';
    const backgroundColor = props?.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    const allowDismiss = props?.allowDismiss !== false;
    const dismissHours = Number(props?.dismissHours || 24);
    const startsAt = props?.startsAt || '';
    const endsAt = props?.endsAt || '';
    const targetBlank = props?.targetBlank !== false && props?.targetBlank !== 'false';
    const campaignId = JSON.stringify([text, linkUrl, linkText, startsAt, endsAt]);

    return (
      <PromoBarComponent
        key={`${allowDismiss ? 'dismissible' : 'persistent'}:${campaignId}`}
        campaignId={campaignId}
        text={text}
        linkUrl={linkUrl}
        linkText={linkText}
        backgroundColor={backgroundColor}
        allowDismiss={allowDismiss}
        dismissHours={dismissHours}
        startsAt={startsAt}
        endsAt={endsAt}
        targetBlank={targetBlank}
      />
    );
  },
};
