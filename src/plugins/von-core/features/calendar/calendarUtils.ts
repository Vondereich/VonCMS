export interface CalendarItem {
  id: string | number;
  kind: 'event' | 'post' | 'page';
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: number | string;
  notes: string;
  version: number | string;
  author_id: string | number | null;
  author_name: string;
  status: string;
  can_edit: number | string;
}

export interface CalendarData {
  success: boolean;
  items: CalendarItem[];
  authors: { author_id: string | number; author_name: string }[];
  meta: { page: number; hasMore: boolean; authorsTruncated: boolean };
  today: string;
  now?: string;
  timeZone: string;
}

export const calendarKey = (item: CalendarItem) => `${item.kind}:${item.id}`;
export const calendarRequestKey = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const shiftDay = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
};
export const shiftMonth = (month: string, amount: number) => {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const next = dateKey(date).slice(0, 7);
  return next < '1001-01' || next > '9997-12' ? month : next;
};
export const calendarRange = (month: string) => {
  const first = `${month}-01`;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const from = shiftDay(first, -((weekday + 6) % 7));
  return {
    from,
    to: shiftDay(from, 42),
    days: Array.from({ length: 42 }, (_, i) => shiftDay(from, i)),
  };
};
export const calendarItemOnDay = (item: CalendarItem, day: string) =>
  item.kind !== 'event'
    ? item.starts_at.slice(0, 10) === day
    : item.starts_at < `${shiftDay(day, 1)} 00:00:00` && item.ends_at > `${day} 00:00:00`;

export const calendarToday = (timeZone?: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return dateKey(new Date());
  }
};
