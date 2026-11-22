import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStockCounts } from '@/lib/queries';
import { formatDate, formatMonth, formatRs, getCurrentMonthStr, getTodayDateStr, monthRange, shiftMonth } from '@/lib/format';
import { StockCount } from '@/lib/types';
import { PageHeader, buttonClass, cardClass } from '@/components/ui';
import { ClipboardList, Pencil, Plus, Tags } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Stock' };

const SHOWN_MONTHS = 12;

const valueOf = (c: StockCount, kind: 'raw' | 'finished') => c.items.filter((i) => i.kind === kind).reduce((s, i) => s + i.amount, 0);

/** Month-end stock counts: the closing stock of each month, used for the exact profit */
export default async function StockPage() {
  const counts = await getStockCounts();
  const thisMonth = getCurrentMonthStr();
  const lastMonth = shiftMonth(thisMonth, -1);
  const byMonth = new Map(counts.map((c) => [c.month, c]));

  // Early in a month, the count still to do is usually last month's closing stock
  const dueMonth = Number(getTodayDateStr().slice(8, 10)) <= 10 && !byMonth.has(lastMonth) ? lastMonth : thisMonth;
  const months = [
    ...new Set([...monthRange(shiftMonth(thisMonth, -(SHOWN_MONTHS - 1)), thisMonth), ...counts.map((c) => c.month)]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Closing stock at the end of each month"
        actions={
          <>
            <Link href="/profit/cost-prices" className={buttonClass('secondary')}>
              <Tags className="w-4 h-4" />
              Cost prices
            </Link>
            <Link href={`/stock/${dueMonth}`} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              {byMonth.has(dueMonth) ? `Update ${formatMonth(dueMonth)}` : `Count stock · ${formatMonth(dueMonth)}`}
            </Link>
          </>
        }
      />

      <section className={`${cardClass} p-4 sm:p-5 text-sm text-zinc-600 space-y-2`}>
        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-500" />
          How stock gives the exact profit
        </h2>
        <p>
          At the end of each month, count the raw material and finished goods you have and enter them here. The cost of what you
          sold that month is then <span className="font-medium text-zinc-900">opening stock + purchases − closing stock</span>,
          which includes waste, labour in stock and every rate change.
        </p>
        <p>
          A month&apos;s opening stock is the month before&apos;s closing stock. To start, also count the month before the first
          month you want exact (for example {formatMonth(shiftMonth(lastMonth, -1))} for {formatMonth(lastMonth)}). Until a month
          and the month before are both counted, its profit is estimated from your{' '}
          <Link href="/profit/cost-prices" className="font-medium text-emerald-700 hover:text-emerald-800">
            cost prices
          </Link>
          .
        </p>
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="hidden md:grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_2.5rem] gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500">
          <span>End of month</span>
          <span className="text-right">Raw material</span>
          <span className="text-right">Finished goods</span>
          <span className="text-right">Closing stock</span>
          <span className="text-right">Change</span>
          <span />
        </div>
        <ul className="divide-y divide-zinc-100">
          {months.map((m) => {
            const c = byMonth.get(m);
            const prev = byMonth.get(shiftMonth(m, -1));
            const change = c && prev ? c.total - prev.total : null;
            return (
              <li key={m} className="px-4 py-3 md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_2.5rem] md:gap-3 md:items-center flex items-center gap-3">
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="text-sm font-medium text-zinc-900">{formatMonth(m)}</p>
                  <p className="text-xs text-zinc-500">
                    {c ? `${c.items.length} ${c.items.length === 1 ? 'line' : 'lines'} · saved ${formatDate(c.updated_at.slice(0, 10))}` : m === thisMonth ? 'Month in progress' : 'Not counted'}
                  </p>
                </div>
                {c ? (
                  <>
                    <span className="hidden md:block text-right text-sm tabular-nums text-zinc-700">{formatRs(valueOf(c, 'raw'))}</span>
                    <span className="hidden md:block text-right text-sm tabular-nums text-zinc-700">{formatRs(valueOf(c, 'finished'))}</span>
                    <span className="text-right text-sm font-semibold tabular-nums text-zinc-900">{formatRs(c.total)}</span>
                    <span className={`hidden md:block text-right text-xs tabular-nums ${change === null ? 'text-zinc-300' : change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {change === null ? '—' : `${change >= 0 ? '▲ +' : '▼ −'}${formatRs(Math.abs(change))}`}
                    </span>
                    <Link
                      href={`/stock/${m}`}
                      aria-label={`Edit the stock count for ${formatMonth(m)}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 justify-self-end"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                  </>
                ) : (
                  <Link href={`/stock/${m}`} className="md:col-start-4 md:col-span-3 justify-self-end text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">
                    Enter stock
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
