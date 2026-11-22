import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getProfitReport } from '@/lib/queries';
import { formatMonth, formatQuantity, formatRs, getCurrentMonthStr, isValidMonthStr } from '@/lib/format';
import { ProfitMonth, ProfitReport } from '@/lib/types';
import { MonthPicker } from '@/components/MonthPicker';
import { CsvExportButton } from '@/components/CsvExportButton';
import { MethodBadge, ProfitSummary } from '@/components/ProfitSummary';
import { PageHeader, buttonClass, cardClass } from '@/components/ui';
import { Boxes, Plus, Tags } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profit and loss' };

const MIGRATION = 'supabase/migrations/20261122000000_profit.sql';

const money = (v: number) => (v < 0 ? `(${formatRs(-v)})` : formatRs(v));
const tone = (v: number) => (v < 0 ? 'text-rose-700' : 'text-zinc-900');

/** Monthly profit and loss: /profit?month=YYYY-MM */
export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: param } = await searchParams;
  const thisMonth = getCurrentMonthStr();
  const month = isValidMonthStr(param) && param <= thisMonth ? param : thisMonth;
  const report = await getProfitReport(month, 12);

  if (!report) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profit and loss" />
        <p className={`${cardClass} p-5 text-sm text-amber-800`}>
          Profit needs a database update. Run <code className="font-mono text-xs">{MIGRATION}</code> in the Supabase SQL Editor, then
          reload this page.
        </p>
      </div>
    );
  }

  const { month: m, previous } = report;
  // Months before the ledger's first activity are left out of the comparison
  const first = report.history.findIndex((h) => h.month === month || hasActivity(h));
  const history = report.history.slice(Math.max(0, first));
  const rows = [...history].reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit and loss"
        description={`${formatMonth(month)}${month === thisMonth ? ' so far' : ''}`}
        actions={
          <>
            <MonthPicker currentMonth={month} basePath="/profit" />
            <CsvExportButton
              filename={`profit-${history[0].month}-to-${month}`}
              headers={['Month', 'Sales', 'Customer returns', 'Net sales', 'Sold items cost', 'Gross profit', 'Expenses', 'Net profit', 'Cost basis']}
              rows={history.map((h) => [
                h.month,
                round(h.sales),
                round(h.customerReturns),
                round(h.netSales),
                round(h.costOfSales),
                round(h.grossProfit),
                round(h.expenses),
                round(h.netProfit),
                h.method === 'stock' ? 'Stock count' : 'Estimate',
              ])}
            />
          </>
        }
      />

      <ProfitSummary
        month={m}
        previous={previous}
        isCurrentMonth={month === thisMonth}
        actions={
          <>
            <Link href="/expenses/new" className={buttonClass('secondary')}>
              <Plus className="w-4 h-4" />
              Expense
            </Link>
            <Link href={`/stock/${month}`} className={buttonClass('secondary')}>
              <Boxes className="w-4 h-4" />
              Stock
            </Link>
            <Link href="/profit/cost-prices" className={buttonClass('secondary')}>
              <Tags className="w-4 h-4" />
              Cost prices
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Statement report={report} />
        <div className="space-y-4">
          <ItemMargins report={report} />
          <CustomerMargins report={report} />
        </div>
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Monthly comparison</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {history.length === 1 ? 'This month' : `The last ${history.length} months`}. Click a month to open it.
          </p>
        </div>

        <ul className="md:hidden divide-y divide-zinc-100">
          {rows.map((h) => (
            <li key={h.month}>
              <Link href={`/profit?month=${h.month}`} className={`px-4 py-3 flex items-center justify-between gap-3 ${h.month === month ? 'bg-emerald-50/60' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                    {formatMonth(h.month)} <MethodBadge month={h} />
                  </p>
                  <p className="text-xs text-zinc-500">
                    Sales {formatRs(h.netSales)} · Gross {formatRs(h.grossProfit)} · Expenses {formatRs(h.expenses)}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${h.netProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {formatRs(h.netProfit)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="py-2.5 px-4 text-left">Month</th>
                <th className="py-2.5 px-4 text-right">Net sales</th>
                <th className="py-2.5 px-4 text-right">Sold items cost</th>
                <th className="py-2.5 px-4 text-right">Gross profit</th>
                <th className="py-2.5 px-4 text-right">Margin</th>
                <th className="py-2.5 px-4 text-right">Expenses</th>
                <th className="py-2.5 px-4 text-right">Net profit / loss</th>
                <th className="py-2.5 px-4 text-left">Cost basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((h) => (
                <tr key={h.month} className={h.month === month ? 'bg-emerald-50/60' : 'hover:bg-zinc-50/70'}>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <Link href={`/profit?month=${h.month}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                      {formatMonth(h.month)}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-zinc-700">{formatRs(h.netSales)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-zinc-700">{formatRs(h.costOfSales)}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums ${tone(h.grossProfit)}`}>{formatRs(h.grossProfit)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-zinc-500">{h.netSales > 0 ? `${Math.round((h.grossProfit / h.netSales) * 100)}%` : '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-zinc-700">{formatRs(h.expenses)}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${h.netProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatRs(h.netProfit)}
                  </td>
                  <td className="py-2.5 px-4">
                    <MethodBadge month={h} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotalsRow history={history} />
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

const round = (v: number) => Math.round(v);

const hasActivity = (h: ProfitMonth) =>
  h.sales > 0 || h.purchases > 0 || h.expenses > 0 || h.invested > 0 || h.withdrawn > 0 || h.closingStock !== null;

function TotalsRow({ history }: { history: ProfitMonth[] }) {
  const sum = (pick: (h: ProfitMonth) => number) => history.reduce((s, h) => s + pick(h), 0);
  const netSales = sum((h) => h.netSales);
  const gross = sum((h) => h.grossProfit);
  const net = sum((h) => h.netProfit);
  return (
    <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
      <td className="py-2.5 px-4">{history.length === 1 ? '1 month' : `${history.length} months`}</td>
      <td className="py-2.5 px-4 text-right tabular-nums">{formatRs(netSales)}</td>
      <td className="py-2.5 px-4 text-right tabular-nums">{formatRs(sum((h) => h.costOfSales))}</td>
      <td className={`py-2.5 px-4 text-right tabular-nums ${tone(gross)}`}>{formatRs(gross)}</td>
      <td className="py-2.5 px-4 text-right tabular-nums text-zinc-500">{netSales > 0 ? `${Math.round((gross / netSales) * 100)}%` : '—'}</td>
      <td className="py-2.5 px-4 text-right tabular-nums">{formatRs(sum((h) => h.expenses))}</td>
      <td className={`py-2.5 px-4 text-right tabular-nums ${net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRs(net)}</td>
      <td className="py-2.5 px-4" />
    </tr>
  );
}

/** The month's profit and loss statement, line by line */
function Statement({ report }: { report: ProfitReport }) {
  const { month: m, expensesByCategory } = report;
  const stock = m.method === 'stock';

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Profit and loss statement</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{formatMonth(m.month)}</p>
      </div>
      <dl className="text-sm">
        <Line label="Sales" value={m.sales} />
        {m.customerReturns > 0 && <Line label="Less: customer returns" value={-m.customerReturns} indent />}
        <Line label="Net sales" value={m.netSales} total />

        {stock ? (
          <>
            <Line label="Opening stock" value={m.openingStock ?? 0} />
            <Line label="Add: purchases" value={m.purchases} indent />
            {m.vendorReturns > 0 && <Line label="Less: vendor returns" value={-m.vendorReturns} indent />}
            <Line label="Less: closing stock" value={-(m.closingStock ?? 0)} indent />
          </>
        ) : null}
        <Line label="Sold items cost" value={-m.costOfSales} hint={stock ? undefined : 'estimate, at cost prices'} total />
        <Line label="Gross profit" value={m.grossProfit} strong />

        {expensesByCategory.map((e) => (
          <Line key={e.category} label={e.category} value={-e.amount} indent />
        ))}
        <Line label="Expenses" value={-m.expenses} total />
        <Line label={m.netProfit < 0 ? 'Net loss' : 'Net profit'} value={m.netProfit} strong final />
      </dl>

      <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/60 text-xs text-zinc-500 space-y-1">
        {!stock && (
          <p>
            Purchases this month: {formatRs(m.netPurchases)}. They go into stock, and count in the cost once the stock is counted.
          </p>
        )}
        <p>
          Owner&apos;s money (not profit): invested {formatRs(m.invested)}, withdrawn {formatRs(m.withdrawn)}.{' '}
          <Link href={`/expenses?month=${m.month}`} className="font-medium text-emerald-700 hover:text-emerald-800">
            Expenses and capital
          </Link>
        </p>
      </div>
    </section>
  );
}

function Line({
  label,
  value,
  hint,
  indent = false,
  total = false,
  strong = false,
  final = false,
}: {
  label: string;
  value: number;
  hint?: string;
  indent?: boolean;
  total?: boolean;
  strong?: boolean;
  final?: boolean;
}) {
  const color = final ? (value < 0 ? 'text-rose-700' : 'text-emerald-700') : tone(value);
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-4 py-2 ${total ? 'border-t border-zinc-200 font-medium' : ''} ${
        strong ? 'bg-zinc-50 font-semibold border-y border-zinc-200' : ''
      } ${final ? 'text-base' : ''}`}
    >
      <dt className={`${indent ? 'pl-4 text-zinc-500' : 'text-zinc-800'}`}>
        {label}
        {hint && <span className="text-zinc-400 font-normal"> ({hint})</span>}
      </dt>
      <dd className={`tabular-nums ${indent ? 'text-zinc-600' : color}`}>{money(value)}</dd>
    </div>
  );
}

/** Each product sold this month, at its cost price */
function ItemMargins({ report }: { report: ProfitReport }) {
  const { items } = report;
  const costed = items.filter((i) => i.cost !== null);
  const sales = costed.reduce((s, i) => s + i.sales, 0);
  const cost = costed.reduce((s, i) => s + (i.cost ?? 0), 0);

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Item-wise margin</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Products sold, at their cost prices (a customer&apos;s own first)</p>
        </div>
        <Link href="/profit/cost-prices" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">
          Cost prices
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-sm text-zinc-500 text-center">No sales in {formatMonth(report.month.month)}.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((i) => {
            const margin = i.cost === null ? null : i.sales - i.cost;
            return (
              <li key={i.key} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{i.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatQuantity(i.quantity)} {i.unit} · sold {formatRs(i.sales)}
                    {i.customerPriced ? ' · cost varies by customer' : i.costPrice !== null && ` · cost ${formatRs(i.costPrice)}/${i.unit}`}
                  </p>
                </div>
                {margin === null ? (
                  <Link href="/profit/cost-prices" className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap">
                    Set cost price
                  </Link>
                ) : (
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${margin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRs(margin)}</p>
                    <p className="text-xs text-zinc-500 tabular-nums">{i.sales > 0 ? `${Math.round((margin / i.sales) * 100)}%` : '—'}</p>
                  </div>
                )}
              </li>
            );
          })}
          {costed.length > 0 && (
            <li className="px-4 py-2.5 flex items-center justify-between gap-3 bg-zinc-50 text-sm font-semibold text-zinc-900">
              <span>Margin on costed items</span>
              <span className={`tabular-nums ${sales - cost < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatRs(sales - cost)}
                {sales > 0 && <span className="ml-1 text-xs font-normal text-zinc-500">({Math.round(((sales - cost) / sales) * 100)}%)</span>}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** Each customer's sales this month and the margin on them, at their cost prices */
function CustomerMargins({ report }: { report: ProfitReport }) {
  const { customers } = report;
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">Customer-wise margin</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Sales after returns, at each customer&apos;s cost prices</p>
      </div>
      {customers.length === 0 ? (
        <p className="px-4 py-8 text-sm text-zinc-500 text-center">No sales in {formatMonth(report.month.month)}.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {customers.map((c) => {
            const net = c.sales - c.returned;
            const costed = net - c.uncosted;
            const margin = costed - c.cost;
            return (
              <li key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/customers/${c.id}`} className="text-sm font-medium text-zinc-900 hover:text-emerald-700 truncate block">
                    {c.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    Sold {formatRs(net)}
                    {c.returned > 0 && ` (after ${formatRs(c.returned)} returns)`}
                    {c.uncosted > 0 && (
                      <>
                        {' · '}
                        <Link href={`/customers/${c.id}/prices`} className="text-amber-700 hover:text-amber-800">
                          {formatRs(c.uncosted)} without cost price
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {costed > 0 ? (
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${margin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRs(margin)}</p>
                    <p className="text-xs text-zinc-500 tabular-nums">{Math.round((margin / costed) * 100)}%</p>
                  </div>
                ) : (
                  <Link href={`/customers/${c.id}/prices`} className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap">
                    Set prices
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
