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

/** Groups quantities by material and unit: "Cement / bag" and "cement / Bag" are one, bags and tons never mix */
export function quantityKey(material: string, unit: string | null | undefined): string {
  return `${material.trim().toLowerCase()}|${(unit ?? '').trim().toLowerCase()}`;
}

/** A quantity: thousands separators, up to 3 decimals (1,250 or 0.25 or 0.075) */
export function formatQuantity(qty: number): string {
  return (Math.round(qty * 1000) / 1000).toLocaleString('en-PK', { maximumFractionDigits: 3 });
}

// Weight units, as a fraction of a ton
const TON_FACTOR: Record<string, number> = {
  ton: 1,
  tons: 1,
  tonne: 1,
  tonnes: 1,
  mt: 1,
  kg: 0.001,
  kgs: 0.001,
  kilogram: 0.001,
  kilograms: 0.001,
};

/**
 * Which quantities can be added together: kg and tons combine as tons (factor converts
 * to tons); any other unit (bag, truck, pcs…) only with the same unit.
 */
export function unitGroup(unit: string | null | undefined): { key: string; unit: string; factor: number } {
  const name = (unit ?? '').trim();
  const factor = TON_FACTOR[name.toLowerCase()];
  if (factor !== undefined) return { key: 'weight', unit: 'ton', factor };
  return { key: name.toLowerCase() || 'units', unit: name || 'units', factor: 1 };
}

/**
 * A party balance as an amount with its side: Dr when they owe you (receivable),
 * Cr when you owe them (payable). Zero has no side.
 */
export function formatBalance(balance: number): string {
  const rounded = Math.round(balance);
  if (rounded === 0) return 'Rs. 0';
  return `${formatRs(Math.abs(rounded))} ${rounded > 0 ? 'Dr' : 'Cr'}`;
}

/** "Receivable" or "Payable" for a party balance (+ they owe you, − you owe them) */
export function balanceLabel(balance: number): 'Receivable' | 'Payable' | 'Settled' {
  const rounded = Math.round(balance);
  return rounded > 0 ? 'Receivable' : rounded < 0 ? 'Payable' : 'Settled';
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
 * The month `delta` months before (negative) or after `monthStr` (YYYY-MM)
 */
export function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * Every month from `from` to `to` (YYYY-MM), oldest first
 */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/**
 * Short month name for chart axes: "Oct"
 */
export function formatMonthShort(monthStr: string): string {
  const d = parseISO(`${monthStr}-01`);
  return isValid(d) ? format(d, 'MMM') : monthStr;
}

/**
 * Compute due date given sale date and credit days
 */
export function calculateDueDate(saleDate: string, creditDays: number): string {
  if (!isValidDateStr(saleDate)) return saleDate;
  return addDays(saleDate, Number(creditDays) || 0);
}

/**
 * Display name for a user: full name, or the email when no name is set
 */
export function displayName(p: { full_name: string; email: string }): string {
  return p.full_name.trim() || p.email;
}

/**
 * Initials for printed reports: first letters of the first and last name ("Azmat Karim" → "AK"),
 * one letter for a single name, or the email's first letter when no name is set
 */
export function initials(p: { full_name: string; email: string }): string {
  const words = p.full_name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return (p.email.trim()[0] ?? '?').toUpperCase();
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}
