import type { SiteDateFormat } from '../types';

export const DEFAULT_SITE_DATE_FORMAT: SiteDateFormat = 'month_day_year_long';

export const SITE_DATE_FORMAT_OPTIONS: ReadonlyArray<{
  value: SiteDateFormat;
  label: string;
}> = [
  { value: 'month_day_year_long', label: 'July 29, 2026' },
  { value: 'month_day_year_short', label: 'Jul 29, 2026' },
  { value: 'day_month_year_long', label: '29 July 2026' },
  { value: 'day_month_year_short', label: '29 Jul 2026' },
  { value: 'day_month_year_numeric', label: '29/07/2026' },
  { value: 'month_day_year_numeric', label: '07/29/2026' },
  { value: 'iso', label: '2026-07-29' },
];

export const normalizeSiteDateFormat = (value?: string | null): SiteDateFormat =>
  SITE_DATE_FORMAT_OPTIONS.some((option) => option.value === value)
    ? (value as SiteDateFormat)
    : DEFAULT_SITE_DATE_FORMAT;

type PostPublishTimestampSource = {
  scheduledAt?: string;
  scheduled_at?: string;
  createdAt?: string;
  created_at?: string;
};

export const getPostPublishTimestamp = (post: PostPublishTimestampSource): string =>
  post.scheduledAt || post.scheduled_at || post.createdAt || post.created_at || '';

const SQL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

const resolveDateTimeInput = (
  dateString: string,
  timeZone?: string
): { date: Date; displayTimeZone?: string } => {
  const sqlDateTime = SQL_DATETIME_PATTERN.exec(dateString.trim());
  if (!sqlDateTime) {
    return { date: new Date(dateString), displayTimeZone: timeZone || undefined };
  }

  const [, year, month, day, hour, minute, second = '0'] = sqlDateTime;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
  const isValidWallClock =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second);

  return isValidWallClock
    ? { date, displayTimeZone: 'UTC' }
    : { date: new Date(Number.NaN), displayTimeZone: timeZone || undefined };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const zonedTime = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  );

  return zonedTime - Math.floor(date.getTime() / 1000) * 1000;
};

export const normalizeSchemaDateTime = (value?: string, timeZone?: string): string | undefined => {
  const rawValue = value?.trim();
  if (!rawValue) return undefined;
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(rawValue)) return rawValue;

  const sqlDateTime = SQL_DATETIME_PATTERN.exec(rawValue);
  if (!sqlDateTime) {
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? rawValue : parsed.toISOString();
  }

  const [, year, month, day, hour, minute, second = '0'] = sqlDateTime;
  const wallClockMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const { date: validatedWallClock } = resolveDateTimeInput(rawValue, timeZone);
  if (Number.isNaN(validatedWallClock.getTime())) return rawValue;

  try {
    const effectiveTimeZone = timeZone?.trim() || 'UTC';
    let instant = new Date(wallClockMs);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      instant = new Date(wallClockMs - getTimeZoneOffsetMs(instant, effectiveTimeZone));
    }
    return instant.toISOString();
  } catch {
    return rawValue;
  }
};

export const formatDate = (
  dateString: string,
  timeZone?: string,
  dateFormat?: SiteDateFormat
): string => {
  if (!dateString) return '';

  try {
    const { date, displayTimeZone } = resolveDateTimeInput(dateString, timeZone);
    if (Number.isNaN(date.getTime())) return dateString;

    const normalizedFormat = normalizeSiteDateFormat(dateFormat);
    if (normalizedFormat === 'iso') {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: displayTimeZone,
      }).formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((item) => item.type === type)?.value || '';
      return `${part('year')}-${part('month')}-${part('day')}`;
    }

    const isDayFirst = normalizedFormat.startsWith('day_month');
    const isNumeric = normalizedFormat.endsWith('_numeric');
    const isShort = normalizedFormat.endsWith('_short');
    return new Intl.DateTimeFormat(isDayFirst ? 'en-GB' : 'en-US', {
      year: 'numeric',
      month: isNumeric ? '2-digit' : isShort ? 'short' : 'long',
      day: isNumeric ? '2-digit' : 'numeric',
      timeZone: displayTimeZone,
    }).format(date);
  } catch {
    return dateString;
  }
};

export const formatDateTime = (
  dateString: string,
  timeZone?: string,
  dateFormat?: SiteDateFormat
): string => {
  if (!dateString) return '';

  try {
    const { date, displayTimeZone } = resolveDateTimeInput(dateString, timeZone);
    if (Number.isNaN(date.getTime())) return dateString;

    const formattedDate = formatDate(date.toISOString(), displayTimeZone, dateFormat);

    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: displayTimeZone,
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || '';
    const hour = part('hour');
    const minute = part('minute');
    const dayPeriod = part('dayPeriod');

    return hour && minute && dayPeriod
      ? `${formattedDate}, ${hour}:${minute} ${dayPeriod}`
      : formattedDate;
  } catch {
    return formatDate(dateString, timeZone, dateFormat);
  }
};
