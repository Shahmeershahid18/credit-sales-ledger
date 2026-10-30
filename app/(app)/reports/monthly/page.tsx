import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getMonthlyReportData } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatRs, getCurrentMonthStr, isValidMonthStr } from '@/lib/format';
import { MonthPicker } from '@/components/MonthPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import { EmptyState, PageHeader, cardClass } from '@/components/ui';
import { ShoppingBag, CreditCard, CalendarClock, Wallet, FileBarChart } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Monthly report' };

interface MonthlyReportPageProps {
  searchParams: Promise<{ month?: string; side?: string }>;
}

// Column wording for each side of the report
const LABELS = {
  customer: { tab: 'Sales', moved: 'Material sold', movedShort: 'Sold', paid: 'Payment received', paidShort: 'Received', net: 'sold − received', csvNet: 'sold - received', file: 'sales' },
  vendor: { tab: 'Purchases', moved: 'Material purchased', movedShort: 'Bought', paid: 'Payment made', paidShort: 'Paid', net: 'bought − paid', csvNet: 'bought - paid', file: 'purchases' },
} as const;

const amountOrDash = (value: number) => (value > 0 ? formatRs(value) : '—');

function netClass(value: number) {
  if (value > 0) return 'text-rose-700';
  if (value < 0) return 'text-emerald-700';
  return 'text-zinc-500';
}

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const { month, side } = await searchParams;
  const kind: ContactKind = side === 'vendor' ? 'vendor' : 'customer';
  const terms = SIDES[kind];
  const labels = LABELS[kind];
  const currentMonth = isValidMonthStr(month) ? month : getCurrentMonthStr();
  const report = await getMonthlyReportData(kind, currentMonth);
  const rows = report.customerBreakdown;

  const csvHeaders = [terms.One, labels.moved, labels.paid, 'Payment due', `Net (${labels.csvNet})`];
  const csvRows = rows.map((c) => [c.customerName, c.materialSold, c.paymentReceived, c.paymentDue, c.monthBalance]);

  const tabHref = (k: ContactKind) => `/reports/monthly?${k === 'vendor' ? 'side=vendor&' : ''}month=${currentMonth}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly report"
        description={report.formattedMonth}
        actions={
          <>
            <MonthPicker currentMonth={currentMonth} query={kind === 'vendor' ? 'side=vendor' : undefined} />
            <CsvExportButton
              filename={`credit-ledger-${labels.file}-${currentMonth}`}
              headers={csvHeaders}
              rows={csvRows}
              disabled={csvRows.length === 0}
            />
          </>
        }
      />

      <nav aria-label="Report side" className="flex gap-1 p-1 rounded-lg bg-zinc-100 self-start w-fit">
        {(['customer', 'vendor'] as const).map((k) => {
          const active = k === kind;
          return (
            <Link
              key={k}
              href={tabHref(k)}
              aria-current={active ? 'page' : undefined}
              className={`h-8 px-4 rounded-md text-sm font-medium flex items-center ${
                active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {LABELS[k].tab}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={labels.moved} value={formatRs(report.materialSold)} icon={ShoppingBag} />
        <StatCard label={labels.paid} value={formatRs(report.paymentReceived)} icon={CreditCard} variant="success" />
        <StatCard
          label="Payment due"
          value={formatRs(report.paymentDue)}
          icon={CalendarClock}
          variant="warning"
          subtext={`${terms.Entries} falling due this month`}
        />
        <StatCard
          label={kind === 'vendor' ? 'Payable remaining' : 'Balance remaining'}
          value={formatRs(report.balanceRemaining)}
          icon={Wallet}
          subtext={`All ${terms.many}, as of today`}
        />
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">By {terms.one}</h2>
          <span className="text-xs text-zinc-500">
            {rows.length} {rows.length === 1 ? terms.one : terms.many}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="w-5 h-5" />}
            title={`No activity in ${report.formattedMonth}`}
            description={`No ${terms.entry}s, payments or due dates fall in this month.`}
          />
        ) : (
          <>
            {/* Mobile: list */}
            <ul className="md:hidden divide-y divide-zinc-100">
              {rows.map((row) => (
                <li key={row.customerId} className="px-4 py-3">
                  <Link href={`${terms.base}/${row.customerId}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                    {row.customerName}
                  </Link>
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <dt className="text-zinc-400">{labels.movedShort}</dt>
                      <dd className="font-medium text-zinc-900 tabular-nums">{amountOrDash(row.materialSold)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">{labels.paidShort}</dt>
                      <dd className="font-medium text-emerald-700 tabular-nums">{amountOrDash(row.paymentReceived)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Due</dt>
                      <dd className="font-medium text-zinc-900 tabular-nums">{amountOrDash(row.paymentDue)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Net</dt>
                      <dd className={`font-medium tabular-nums ${netClass(row.monthBalance)}`}>{formatRs(row.monthBalance)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2.5 px-4">{terms.One}</th>
                    <th className="py-2.5 px-4 text-right">{labels.moved}</th>
                    <th className="py-2.5 px-4 text-right">{labels.paid}</th>
                    <th className="py-2.5 px-4 text-right">Payment due</th>
                    <th className="py-2.5 px-4 text-right">Net ({labels.net})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row) => (
                    <tr key={row.customerId} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4">
                        <Link href={`${terms.base}/${row.customerId}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                          {row.customerName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-900">{amountOrDash(row.materialSold)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-700">{amountOrDash(row.paymentReceived)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-900">{amountOrDash(row.paymentDue)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums font-medium ${netClass(row.monthBalance)}`}>
                        {formatRs(row.monthBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatRs(report.materialSold)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-700">{formatRs(report.paymentReceived)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatRs(report.paymentDue)}</td>
                    <td className={`py-3 px-4 text-right tabular-nums ${netClass(report.materialSold - report.paymentReceived)}`}>
                      {formatRs(report.materialSold - report.paymentReceived)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
