import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileBarChart } from 'lucide-react';
import { MonthFlow } from '@/lib/types';
import { formatMonth, formatMonthShort, formatRs } from '@/lib/format';
import { cardClass } from './ui';

interface MonthlySummaryProps {
  flow: MonthFlow;
  previous: MonthFlow;
  isCurrentMonth: boolean;
  prevHref: string;
  nextHref: string | null; // null on the current month
  reportHref: string;
  children?: React.ReactNode; // shown at the bottom of the card, e.g. the last months
}

/**
 * One month's money in and out, with the change from the month before
 */
export function MonthlySummary({ flow, previous, isCurrentMonth, prevHref, nextHref, reportHref, children }: MonthlySummaryProps) {
  const net = flow.received - flow.paid;
  const prevNet = previous.received - previous.paid;
  const vs = formatMonthShort(previous.month);

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Monthly summary</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{isCurrentMonth ? 'This month so far' : `Compared with ${formatMonth(previous.month)}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={reportHref}
            aria-label={`Full report for ${formatMonth(flow.month)}`}
            title={`Full report for ${formatMonth(flow.month)}`}
            className="h-9 px-2.5 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1.5"
          >
            <FileBarChart className="w-4 h-4" />
            <span className="hidden sm:inline">Full report</span>
          </Link>
          <nav aria-label="Summary month" className="flex items-center h-9 rounded-lg border border-zinc-200 bg-white">
            <Link href={prevHref} scroll={false} aria-label="Previous month" className="w-9 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-900">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="px-2 min-w-[8.5rem] text-center text-sm font-medium text-zinc-900">{formatMonth(flow.month)}</span>
            {nextHref ? (
              <Link href={nextHref} scroll={false} aria-label="Next month" className="w-9 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-900">
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className="w-9 h-full flex items-center justify-center text-zinc-300">
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </nav>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
        <Figure label="Sold" value={flow.sold} change={<PctChange value={flow.sold} prev={previous.sold} vs={vs} upIsGood />} />
        <Figure
          label="Received"
          value={flow.received}
          className="text-emerald-700"
          change={<PctChange value={flow.received} prev={previous.received} vs={vs} upIsGood />}
        />
        <Figure label="Purchased" value={flow.purchased} change={<PctChange value={flow.purchased} prev={previous.purchased} vs={vs} />} />
        <Figure label="Paid" value={flow.paid} className="text-rose-700" change={<PctChange value={flow.paid} prev={previous.paid} vs={vs} />} />
        <Figure
          label="Net cash"
          hint="received − paid"
          value={net}
          className={net < 0 ? 'text-rose-700' : 'text-zinc-900'}
          change={<AmountChange value={net} prev={prevNet} vs={vs} />}
          wide
        />
      </dl>

      {children && <div className="mt-5 pt-4 border-t border-zinc-100">{children}</div>}
    </section>
  );
}

function Figure({
  label,
  hint,
  value,
  change,
  className = 'text-zinc-900',
  wide = false,
}: {
  label: string;
  hint?: string;
  value: number;
  change: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-1' : ''}>
      <dt className="text-xs text-zinc-500">
        {label}
        {hint && <span className="text-zinc-400"> ({hint})</span>}
      </dt>
      <dd className={`mt-0.5 text-base sm:text-lg font-semibold tabular-nums ${className}`}>{formatRs(value)}</dd>
      <dd className="mt-0.5 text-xs">{change}</dd>
    </div>
  );
}

/**
 * "▲ 12% vs Sep". Rises in sales and collections are green and falls red; for
 * purchases and payments made the arrow stays neutral.
 */
function PctChange({ value, prev, vs, upIsGood = false }: { value: number; prev: number; vs: string; upIsGood?: boolean }) {
  if (prev === 0) {
    return <span className="text-zinc-400">{value > 0 ? `New vs ${vs}` : `No change vs ${vs}`}</span>;
  }
  const pct = Math.round(((value - prev) / prev) * 100);
  if (pct === 0) return <span className="text-zinc-400">Same as {vs}</span>;

  const up = pct > 0;
  const tone = upIsGood ? (up ? 'text-emerald-700' : 'text-rose-700') : 'text-zinc-500';
  return (
    <span className={tone}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% <span className="text-zinc-400">vs {vs}</span>
    </span>
  );
}

/** "+Rs. 50,000 vs Sep": net cash can be negative, so the change is shown as an amount */
function AmountChange({ value, prev, vs }: { value: number; prev: number; vs: string }) {
  const diff = value - prev;
  if (diff === 0) return <span className="text-zinc-400">Same as {vs}</span>;
  return (
    <span className={diff > 0 ? 'text-emerald-700' : 'text-rose-700'}>
      {diff > 0 ? '▲ +' : '▼ −'}
      {formatRs(Math.abs(diff))} <span className="text-zinc-400">vs {vs}</span>
    </span>
  );
}
