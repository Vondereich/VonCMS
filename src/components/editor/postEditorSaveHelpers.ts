import type { Page, Post } from '../../types';
import { htmlToPlainText } from '../../utils/security';

export const AUTOSAVE_INTERVAL_MS = 60000;
export const SAVE_CONFLICT_MESSAGE =
  'Content was updated elsewhere. Reload the editor before saving again.';

export type SaveStatus = 'idle' | 'manual-saving' | 'auto-saving' | 'saved' | 'error';

type ContentItem = Post | Page;

export const formatAutoSaveCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const isEffectivelyEmpty = (html: string | undefined) => {
  if (!html) return true;
  return htmlToPlainText(html) === '';
};

export const normalizeScheduledInputValue = (value?: string) => {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return normalized.slice(0, 16);
};

export const formatScheduledTarget = (value?: string) => {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

export const buildAutoSaveCandidate = (
  currentItem: ContentItem | null,
  currentInitial: ContentItem | null,
  currentContent: string
) => {
  const currentTitle = (currentItem?.title || '').trim();
  const initialTitle = (currentInitial?.title || '').trim();
  const initialContent = currentInitial?.content || '';
  const currentItemWithLiveContent = currentItem
    ? ({ ...currentItem, content: currentContent } as ContentItem)
    : currentItem;

  return {
    currentItem: currentItemWithLiveContent,
    isChanged: currentContent !== initialContent || currentTitle !== initialTitle,
    hasMeaningfulData: currentTitle !== '' || !isEffectivelyEmpty(currentContent),
    canAutoSave: (currentItem?.status || 'draft') === 'draft',
  };
};

export const normalizeScheduledAtForSave = <T extends ContentItem>(item: T, status: string) => {
  const itemToSave = { ...item, status } as T;
  const itemWithSchedule = item as T & { scheduledAt?: string };
  if (status === 'scheduled' && itemWithSchedule.scheduledAt) {
    // Keep the author's local selected time; do not shift it through UTC conversion.
    (itemToSave as T & { scheduledAt?: string }).scheduledAt =
      itemWithSchedule.scheduledAt.includes('T')
        ? itemWithSchedule.scheduledAt.replace('T', ' ')
        : itemWithSchedule.scheduledAt;
  }
  return itemToSave;
};

export const buildSavedSnapshot = (itemToSave: ContentItem, savedData: any): ContentItem => {
  return savedData && savedData.id
    ? ({
        ...itemToSave,
        ...savedData,
        id: String(savedData.id),
        updatedAt: savedData.updatedAt || savedData.updated_at || itemToSave.updatedAt,
        updated_at: savedData.updated_at || savedData.updatedAt || itemToSave.updated_at || '',
      } as ContentItem)
    : itemToSave;
};

export const buildSaveStatusLabel = (
  saveStatus: SaveStatus,
  lastSaved: Date | null,
  autoSaveCountdown: number
) => {
  if (saveStatus === 'manual-saving') return 'Saving changes...';
  if (saveStatus === 'auto-saving') return 'Autosaving draft...';
  if (saveStatus === 'error') return 'Save failed. Try again.';

  const countdownLabel = `Autosave in ${formatAutoSaveCountdown(autoSaveCountdown)}`;
  return lastSaved
    ? `Last saved: ${lastSaved.toLocaleTimeString()} | ${countdownLabel}`
    : countdownLabel;
};

export const getSaveStatusClassName = (saveStatus: SaveStatus) => {
  if (saveStatus === 'error') return 'text-xs text-red-500 dark:text-red-400';
  if (saveStatus === 'manual-saving' || saveStatus === 'auto-saving') {
    return 'text-xs text-blue-500 dark:text-blue-400';
  }
  return 'text-xs text-slate-400';
};
