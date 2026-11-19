import { normalizeSchemaDateTime } from '../../../../../../utils/dateFormat';

/** Interpret legacy wall-clock values in the CMS zone, never the visitor's zone. */
export const campaignTimestamp = (value: string | undefined, timeZone = 'UTC'): number | null => {
  const raw = value?.trim();
  if (!raw) return null;
  const parts =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      raw
    );
  if (!parts) throw new Error('Use a valid announcement date and time.');
  const wallClock = `${parts[1]}T${parts[2]}:${parts[3] || '00'}`;
  const calendar = new Date(`${wallClock}Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== wallClock) {
    throw new Error('Use a valid announcement date and time.');
  }
  const canonical = normalizeSchemaDateTime(raw, timeZone);
  if (!parts[5] && canonical === raw) throw new Error('The announcement timezone is invalid.');
  const timestamp = Date.parse(canonical || '');
  if (!Number.isFinite(timestamp)) throw new Error('Use a valid announcement date and time.');
  if (!parts[5] && campaignWallClock(timestamp, timeZone) !== wallClock) {
    throw new Error('This local announcement time does not exist in the site timezone.');
  }
  return timestamp;
};

export const normalizeCampaignSchedule = <T extends { startsAt?: string; endsAt?: string }>(
  config: T,
  timeZone = 'UTC'
): T => {
  const start = campaignTimestamp(config.startsAt, timeZone);
  const end = campaignTimestamp(config.endsAt, timeZone);
  if (start !== null && end !== null && end <= start) {
    throw new Error('The announcement end must be after its start.');
  }
  return {
    ...config,
    startsAt: start === null ? '' : new Date(start).toISOString(),
    endsAt: end === null ? '' : new Date(end).toISOString(),
  };
};

const campaignWallClock = (timestamp: number, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
};

export const campaignDateTimeInput = (value: string, timeZone = 'UTC'): string => {
  const timestamp = campaignTimestamp(value, timeZone);
  return timestamp === null ? '' : campaignWallClock(timestamp, timeZone);
};
