import { format, parseISO, isValid } from 'date-fns';
import { APP_TIMEZONE } from './config';

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Format numbers into Pakistani / South Asian or standard formatted Rupees: Rs. 300,000
 */
export function formatRs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rs. 0';
  }
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded).toLocaleString('en-PK');
  return rounded < 0 ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
}

/**
 * Format date string into "31 Oct 2026" or fallback
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr);
  return isValid(d) ? format(d, 'dd MMM yyyy') : dateStr;
}

/**
 * Format a YYYY-MM month string into "October 2026"
 */
export function formatMonth(monthStr: string): string {
  const d = parseISO(`${monthStr}-01`);
  return isValid(d) ? format(d, 'MMMM yyyy') : monthStr;
}

// ---------------------------------------------------------------------------
// Calendar-date helpers. Dates are plain YYYY-MM-DD strings and all arithmetic
// is done in UTC, so results never shift by a day because of the machine's
// timezone.
// ---------------------------------------------------------------------------

function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return new Date(toUtcMs(value)).toISOString().slice(0, 10) === value;
}

export function isValidMonthStr(value: string | null | undefined): value is string {
  return Boolean(value && MONTH_RE.test(value));
}

/**
 * Today's date (YYYY-MM-DD) in the business timezone
 */
export function getTodayDateStr(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Current month (YYYY-MM) in the business timezone
 */
export function getCurrentMonthStr(): string {
  return getTodayDateStr().slice(0, 7);
}

export function addDays(dateStr: string, days: number): string {
  return new Date(toUtcMs(dateStr) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Whole days from `from` to `to` (positive when `to` is later)
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/**
 * First day of the month after `monthStr` (YYYY-MM) as YYYY-MM-DD
 */
export function nextMonthStart(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/**
 * Compute due date given sale date and credit days
 */
export function calculateDueDate(saleDate: string, creditDays: number): string {
  if (!isValidDateStr(saleDate)) return saleDate;
  return addDays(saleDate, Number(creditDays) || 0);
}
