import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getMonthlyReportData } from '@/lib/queries';
import { formatRs, getCurrentMonthStr, isValidMonthStr } from '@/lib/format';
import { MonthPicker } from '@/components/MonthPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import { EmptyState, PageHeader, cardClass } from '@/components/ui';
import { ShoppingBag, CreditCard, CalendarClock, Wallet, FileBarChart } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Monthly report' };

interface MonthlyReportPageProps {
  searchParams: Promise<{ month?: string }>;
}

const amountOrDash = (value: number) => (value > 0 ? formatRs(value) : '—');

function netClass(value: number) {
  if (value > 0) return 'text-rose-700';
  if (value < 0) return 'text-emerald-700';
  return 'text-zinc-500';
}

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const { month } = await searchParams;
  const currentMonth = isValidMonthStr(month) ? month : getCurrentMonthStr();
  const report = await getMonthlyReportData(currentMonth);

  const csvHeaders = ['Customer', 'Material sold', 'Payment received', 'Payment due', 'Net (sold - received)'];
  const csvRows = report.customerBreakdown.map((c) => [
    c.customerName,
    c.materialSold,
    c.paymentReceived,
    c.paymentDue,
    c.monthBalance,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly report"
        description={report.formattedMonth}
        actions={
          <>
            <MonthPicker currentMonth={currentMonth} />
            <CsvExportButton
              filename={`credit-ledger-${currentMonth}`}
              headers={csvHeaders}
              rows={csvRows}
              disabled={csvRows.length === 0}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Material sold" value={formatRs(report.materialSold)} icon={ShoppingBag} />
        <StatCard label="Payment received" value={formatRs(report.paymentReceived)} icon={CreditCard} variant="success" />
        <StatCard label="Payment due" value={formatRs(report.paymentDue)} icon={CalendarClock} variant="warning" subtext="Sales falling due this month" />
        <StatCard label="Balance remaining" value={formatRs(report.balanceRemaining)} icon={Wallet} subtext="All customers, as of today" />
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">By customer</h2>
          <span className="text-xs text-zinc-500">
            {report.customerBreakdown.length} {report.customerBreakdown.length === 1 ? 'customer' : 'customers'}
          </span>
        </div>

        {report.customerBreakdown.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="w-5 h-5" />}
            title={`No activity in ${report.formattedMonth}`}
            description="No sales, payments or due dates fall in this month."
          />
        ) : (
          <>
            {/* Mobile: list */}
            <ul className="md:hidden divide-y divide-zinc-100">
              {report.customerBreakdown.map((row) => (
                <li key={row.customerId} className="px-4 py-3">
                  <Link href={`/customers/${row.customerId}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                    {row.customerName}
                  </Link>
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <dt className="text-zinc-400">Sold</dt>
                      <dd className="font-medium text-zinc-900 tabular-nums">{amountOrDash(row.materialSold)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Received</dt>
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
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Material sold</th>
                    <th className="py-2.5 px-4 text-right">Payment received</th>
                    <th className="py-2.5 px-4 text-right">Payment due</th>
                    <th className="py-2.5 px-4 text-right">Net (sold − received)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {report.customerBreakdown.map((row) => (
                    <tr key={row.customerId} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4">
                        <Link href={`/customers/${row.customerId}`} className="font-medium text-zinc-900 hover:text-emerald-700">
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
