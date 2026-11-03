import { ContactKind } from './contacts';
import { getCurrentMonthStr, isValidMonthStr } from './format';

const FIRST_YEAR = 2000;

export type ReportSearchParams = { month?: string; year?: string; side?: string };

export type ReportParams = {
  kind: ContactKind;
  yearly: boolean;
  year: number; // the report's year (also set for a monthly report)
  month: string; // YYYY-MM of a monthly report; the current month for a yearly one
  period: string; // YYYY-MM or YYYY, as the report queries take it
  thisMonth: string;
  thisYear: number;
};

/**
 * Reads the report's period and side from the URL: ?month=YYYY-MM (the default) or
 * ?year=YYYY, plus ?side=vendor. A future year falls back to this year.
 * Used by the report page and its PDF, so both always show the same figures.
 */
export function parseReportParams({ month, year, side }: ReportSearchParams): ReportParams {
  const kind: ContactKind = side === 'vendor' ? 'vendor' : 'customer';
  const thisMonth = getCurrentMonthStr();
  const thisYear = Number(thisMonth.slice(0, 4));

  const yearly = !month && /^\d{4}$/.test(year ?? '');
  const reportMonth = isValidMonthStr(month) ? month : thisMonth;
  const reportYear = yearly ? Math.min(Math.max(Number(year), FIRST_YEAR), thisYear) : Number(reportMonth.slice(0, 4));

  return {
    kind,
    yearly,
    year: reportYear,
    month: reportMonth,
    period: yearly ? String(reportYear) : reportMonth,
    thisMonth,
    thisYear,
  };
}

/** Query string for the same report, e.g. "side=vendor&year=2026" */
export function reportQuery(p: Pick<ReportParams, 'kind' | 'yearly' | 'year' | 'month'>): string {
  return `${p.kind === 'vendor' ? 'side=vendor&' : ''}${p.yearly ? `year=${p.year}` : `month=${p.month}`}`;
}
