import React from 'react';
import Link from 'next/link';
import { ProfitMonth } from '@/lib/types';
import { formatMonth, formatMonthShort, formatRs, shiftMonth } from '@/lib/format';
import { AmountChange, PctChange } from './MonthlySummary';
import { cardClass } from './ui';

interface ProfitSummaryProps {
  month: ProfitMonth;
  previous: ProfitMonth;
  isCurrentMonth: boolean;
  title?: string;
  actions?: React.ReactNode; // links in the card header
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : null);

/**
 * One month's profit: sales, cost of the goods sold, gross profit, expenses and net
 * profit or loss, each compared with the month before, and how the cost was worked out
 */
export function ProfitSummary({ month: m, previous: p, isCurrentMonth, title = 'Profit and loss', actions }: ProfitSummaryProps) {
  const vs = formatMonthShort(p.month);
  const loss = m.netProfit < 0;
  const margin = pct(m.grossProfit, m.netSales);

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 flex flex-wrap items-center gap-2">
            {title}
            <MethodBadge month={m} />
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatMonth(m.month)}
            {isCurrentMonth ? ' so far' : ''} · compared with {formatMonth(p.month)}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
        <Figure
          label="Sales"
          hint={m.customerReturns > 0 ? `after ${formatRs(m.customerReturns)} returns` : undefined}
          value={m.netSales}
          change={<PctChange value={m.netSales} prev={p.netSales} vs={vs} upIsGood />}
        />
        <Figure
          label="Sold items cost"
          hint={m.method === 'stock' ? 'from stock' : 'estimate'}
          value={m.costOfSales}
          change={<PctChange value={m.costOfSales} prev={p.costOfSales} vs={vs} />}
        />
        <Figure
          label="Gross profit"
          hint={margin ? `${margin} of sales` : undefined}
          value={m.grossProfit}
          className={m.grossProfit < 0 ? 'text-rose-700' : 'text-zinc-900'}
          change={<AmountChange value={m.grossProfit} prev={p.grossProfit} vs={vs} />}
        />
        <Figure label="Expenses" value={m.expenses} className="text-rose-700" change={<PctChange value={m.expenses} prev={p.expenses} vs={vs} />} />
        <Figure
          label={loss ? 'Net loss' : 'Net profit'}
          value={m.netProfit}
          className={loss ? 'text-rose-700' : 'text-emerald-700'}
          change={<AmountChange value={m.netProfit} prev={p.netProfit} vs={vs} />}
          wide
          strong
        />
      </dl>

      <MethodNote month={m} isCurrentMonth={isCurrentMonth} />
    </section>
  );
}

export function MethodBadge({ month }: { month: ProfitMonth }) {
  return month.method === 'stock' ? (
    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">Stock counted</span>
  ) : (
    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium">Estimate</span>
  );
}

/** How the cost of sold items was worked out, and what is missing for the exact figure */
function MethodNote({ month: m, isCurrentMonth }: { month: ProfitMonth; isCurrentMonth: boolean }) {
  if (m.method === 'stock') {
    return (
      <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
        <p>
          Sold items cost = opening stock {formatRs(m.openingStock)} + purchases {formatRs(m.netPurchases)} − closing stock{' '}
          {formatRs(m.closingStock)}.
        </p>
        {m.costOfSales < 0 && (
          <p className="text-amber-700">
            The closing stock is more than the opening stock plus purchases, so the cost is below zero. Check the stock counts of{' '}
            <Link href={`/stock/${m.month}`} className="font-medium text-emerald-700 hover:text-emerald-800">
              {formatMonth(m.month)}
            </Link>{' '}
            and{' '}
            <Link href={`/stock/${shiftMonth(m.month, -1)}`} className="font-medium text-emerald-700 hover:text-emerald-800">
              {formatMonth(shiftMonth(m.month, -1))}
            </Link>
            , and that every purchase is recorded.
          </p>
        )}
      </div>
    );
  }

  const missing = [m.openingStock === null && 'opening', m.closingStock === null && 'closing'].filter(Boolean);
  const uncostedTotal = m.uncosted.reduce((s, u) => s + u.amount, 0);
  return (
    <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
      <p>
        Sold items cost is estimated from your cost prices
        {isCurrentMonth ? ' until the month ends and its closing stock is counted. ' : `: the ${missing.join(' and ')} stock is not counted. `}
        {!isCurrentMonth && (
          <Link href={`/stock/${m.closingStock === null ? m.month : shiftMonth(m.month, -1)}`} className="font-medium text-emerald-700 hover:text-emerald-800">
            Enter stock
          </Link>
        )}
      </p>
      {uncostedTotal > 0 && (
        <p className="text-amber-700">
          No cost price for {m.uncosted.slice(0, 3).map((u) => u.name).join(', ')}
          {m.uncosted.length > 3 ? ` and ${m.uncosted.length - 3} more` : ''} ({formatRs(uncostedTotal)} of sales), so their cost is
          left out.{' '}
          <Link href="/profit/cost-prices" className="font-medium text-emerald-700 hover:text-emerald-800">
            Set cost prices
          </Link>
        </p>
      )}
    </div>
  );
}

function Figure({
  label,
  hint,
  value,
  change,
  className = 'text-zinc-900',
  wide = false,
  strong = false,
}: {
  label: string;
  hint?: string;
  value: number;
  change: React.ReactNode;
  className?: string;
  wide?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`${wide ? 'col-span-2 sm:col-span-1' : ''} ${strong ? 'rounded-lg bg-zinc-50 -m-2 p-2' : ''}`}>
      <dt className="text-xs text-zinc-500">
        {label}
        {hint && <span className="text-zinc-400"> ({hint})</span>}
      </dt>
      <dd className={`mt-0.5 text-base sm:text-lg font-semibold tabular-nums ${className}`}>{formatRs(value)}</dd>
      <dd className="mt-0.5 text-xs">{change}</dd>
    </div>
  );
}
