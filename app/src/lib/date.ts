export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getTaipeiDateParts(date: Date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  ) as DateParts;
}

export function formatTaipeiDate(date: Date): string {
  const parts = getTaipeiDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatLedgerDate(date: Date): string {
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function ledgerDatePartsFromValue(value: string): DateParts | null {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function ledgerDateInputValue(
  item: { dateISO?: string; date?: string },
  now: Date = new Date(),
): string {
  if (item.dateISO) return item.dateISO;
  const raw = String(item.date || '');
  const match = raw.match(
    /(\d{1,2})\/(\d{1,2})(?:\s*(上午|下午|AM|PM))?\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i,
  );
  if (!match) return toDateTimeLocalValue(now);
  const period = match[3] || match[6] || '';
  let hour = Number(match[4]);
  if ((period === '下午' || period.toUpperCase() === 'PM') && hour < 12) hour += 12;
  if ((period === '上午' || period.toUpperCase() === 'AM') && hour === 12) hour = 0;
  const date = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]), hour, Number(match[5]));
  if (date.getTime() > now.getTime() + 86400000) date.setFullYear(now.getFullYear() - 1);
  return toDateTimeLocalValue(date);
}
