import { addDays, formatRs, getTodayDateStr, isValidDateStr, nextMonthStart, shiftMonth } from './format';
import type { PartyLedgerRow } from './types';

export type StatementRange = { from: string; to: string }; // YYYY-MM-DD, inclusive

/**
 * The statement period from the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD). Defaults to
 * this month up to today; dates given the wrong way round are swapped.
 */
export function statementRange(params: { from?: string; to?: string }): StatementRange {
  const today = getTodayDateStr();
  const from = params.from && isValidDateStr(params.from) ? params.from : `${today.slice(0, 7)}-01`;
  const to = params.to && isValidDateStr(params.to) ? params.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Quick periods offered above the statement. `firstDate` is the party's first entry. */
export function statementPresets(firstDate: string | null): (StatementRange & { label: string })[] {
  const today = getTodayDateStr();
  const month = today.slice(0, 7);
  const lastMonth = shiftMonth(month, -1);
  return [
    { label: 'This month', from: `${month}-01`, to: today },
    { label: 'Last month', from: `${lastMonth}-01`, to: addDays(nextMonthStart(lastMonth), -1) },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
    { label: 'All time', from: firstDate && firstDate < today ? firstDate : today, to: today },
  ];
}

export function statementQuery(r: StatementRange): string {
  return `from=${r.from}&to=${r.to}`;
}

const METHOD: Record<string, string> = { cash: 'cash', bank: 'bank', cheque: 'cheque' };

/** The wording of a ledger line on a statement */
export function statementDetails(row: PartyLedgerRow): string {
  switch (row.type) {
    case 'sale':
      return `Sale: ${row.material}${row.quantity ? ` (${row.quantity} ${row.unit ?? ''} × ${formatRs(row.rate)})` : ''}`;
    case 'purchase':
      return `Purchase: ${row.material}${row.quantity ? ` (${row.quantity} ${row.unit ?? ''} × ${formatRs(row.rate)})` : ''}`;
    case 'received':
      return `Payment received (${METHOD[row.method ?? 'cash'] ?? 'cash'})${row.against ? ` for ${row.against}` : ''}`;
    case 'paid':
      return `Payment made (${METHOD[row.method ?? 'cash'] ?? 'cash'})${row.against ? ` for ${row.against}` : ''}`;
    case 'adjustment':
      return `Adjustment: ${formatRs(row.amount)} of purchases set off against sales`;
  }
}
