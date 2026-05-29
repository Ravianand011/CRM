import { formatInTimeZone } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

/** Format an ISO string in IST, e.g. "29 May 2026, 2:30 PM". */
export function formatIST(iso?: string): string {
  if (!iso) return '';
  try {
    return formatInTimeZone(new Date(iso), IST, 'dd MMM yyyy, h:mm a');
  } catch {
    return '';
  }
}

/** Format only the date portion in IST, e.g. "29 May 2026". */
export function formatDateIST(iso?: string): string {
  if (!iso) return '';
  try {
    return formatInTimeZone(new Date(iso), IST, 'dd MMM yyyy');
  } catch {
    return '';
  }
}

/** Convert an ISO string to the value expected by <input type="datetime-local">. */
export function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local input value to an ISO string. */
export function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
