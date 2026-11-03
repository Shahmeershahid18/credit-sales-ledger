import React from 'react';
import Link from 'next/link';
import { MonthFlow } from '@/lib/types';
import { formatMonth, formatRs } from '@/lib/format';
import { CsvExportButton } from './CsvExportButton';
import { cardClass } from './ui';

interface MonthlyHistoryProps {
  flows: MonthFlow[]; // oldest first
  selected: string; // month open in the report
  hrefFor: (month: string) => string;
}

const COLUMNS = [
  { key: 'sold', label: 'Sold', tone: 'text-zinc-900' },
  { key: 'received', label: 'Received', tone: 'text-emerald-700' },
  { key: 'purchased', label: 'Purchased', tone: 'text-zinc-900' },
  { key: 'paid', label: 'Paid', tone: 'text-rose-700' },
] as const;

const amountOrDash = (value: number) => (value !== 0 ? formatRs(value) : '—');
const toneFor = (value: number, tone: string) => (value !== 0 ? tone : 'text-zinc-300');

/**
 * Month-by-month totals for both sides, newest first. Each row opens that month's report.
 */
export function MonthlyHistory({ flows, selected, hrefFor }: MonthlyHistoryProps) {
  const rows = [...flows].reverse();
  const total = (key: (typeof COLUMNS)[number]['key']) => flows.reduce((sum, f) => sum + f[key], 0);
  const net = (f: Pick<MonthFlow, 'received' | 'paid'>) => f.received - f.paid;
  const totals = { sold: total('sold'), received: total('received'), purchased: total('purchased'), paid: total('paid') };

  const first = flows[0]?.month;
  const last = flows[flows.length - 1]?.month;

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Last {flows.length} months</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Sales and purchases side by side. Open a month to see it in detail.</p>
        </div>
        <CsvExportButton
          filename={`credit-ledger-months-${first}-to-${last}`}
          headers={['Month', 'Sold', 'Received', 'Purchased', 'Paid', 'Net cash (received - paid)']}
          rows={rows.map((f) => [formatMonth(f.month), f.sold, f.received, f.purchased, f.paid, net(f)])}
        />
      </div>

      {/* Mobile: list */}
      <ul className="md:hidden divide-y divide-zinc-100">
        {rows.map((f) => (
          <li key={f.month} className={f.month === selected ? 'bg-zinc-50' : ''}>
            <Link href={hrefFor(f.month)} className="block px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-zinc-900">{formatMonth(f.month)}</span>
                <span className="text-xs text-zinc-500">
                  Net cash <span className={`font-semibold tabular-nums ${net(f) < 0 ? 'text-rose-700' : 'text-zinc-900'}`}>{formatRs(net(f))}</span>
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                {COLUMNS.map((c) => (
                  <div key={c.key}>
                    <dt className="text-zinc-400">{c.label}</dt>
                    <dd className={`font-medium tabular-nums ${toneFor(f[c.key], c.tone)}`}>{amountOrDash(f[c.key])}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
              <th className="py-2.5 px-4">Month</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="py-2.5 px-4 text-right">
                  {c.label}
                </th>
              ))}
              <th className="py-2.5 px-4 text-right">Net cash (received − paid)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((f) => (
              <tr key={f.month} className={`hover:bg-zinc-50/70 ${f.month === selected ? 'bg-zinc-50' : ''}`}>
                <td className="py-3 px-4">
                  <Link href={hrefFor(f.month)} className="font-medium text-zinc-900 hover:text-emerald-700">
                    {formatMonth(f.month)}
                  </Link>
                  {f.month === selected && <span className="ml-2 text-xs text-zinc-400">open</span>}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`py-3 px-4 text-right tabular-nums ${toneFor(f[c.key], c.tone)}`}>
                    {amountOrDash(f[c.key])}
                  </td>
                ))}
                <td className={`py-3 px-4 text-right tabular-nums font-medium ${net(f) < 0 ? 'text-rose-700' : 'text-zinc-900'}`}>
                  {formatRs(net(f))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
              <td className="py-3 px-4">Total</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className={`py-3 px-4 text-right tabular-nums ${c.tone}`}>
                  {formatRs(totals[c.key])}
                </td>
              ))}
              <td className={`py-3 px-4 text-right tabular-nums ${net(totals) < 0 ? 'text-rose-700' : ''}`}>{formatRs(net(totals))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
