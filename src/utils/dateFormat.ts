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

export const formatDate = (
  dateString: string,
  timeZone?: string,
  dateFormat?: SiteDateFormat
): string => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    const normalizedFormat = normalizeSiteDateFormat(dateFormat);
    if (normalizedFormat === 'iso') {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timeZone || undefined,
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
      timeZone: timeZone || undefined,
    }).format(date);
  } catch {
    return dateString;
  }
};
