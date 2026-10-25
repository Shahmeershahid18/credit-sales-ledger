import React from 'react';
import Link from 'next/link';
import { getMonthlyReportData } from '@/lib/queries';
import { formatRs, getCurrentMonthStr, isValidMonthStr } from '@/lib/format';
import { MonthPicker } from '@/components/MonthPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import {
  FileBarChart,
  ShoppingBag,
  CreditCard,
  CalendarClock,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface MonthlyReportPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const resolvedParams = await searchParams;
  const currentMonth = isValidMonthStr(resolvedParams.month) ? resolvedParams.month : getCurrentMonthStr();

  const report = await getMonthlyReportData(currentMonth);

  // Prepare CSV export data
  const csvHeaders = [
    'Customer',
    'Material Sold (PKR)',
    'Payment Received (PKR)',
    'Payment Due (PKR)',
    'Month Balance (PKR)',
  ];
  const csvRows = report.customerBreakdown.map((c) => [
    c.customerName,
    c.materialSold,
    c.paymentReceived,
    c.paymentDue,
    c.monthBalance,
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-emerald-600" />
            Monthly Monitoring Report
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Pick any month to inspect materials sold, payments collected, due dates and customer balance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker currentMonth={currentMonth} />
          <CsvExportButton
            filename={`Ledger_Report_${currentMonth}`}
            headers={csvHeaders}
            rows={csvRows}
            title="Export CSV"
          />
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Material Sold (${report.formattedMonth})`}
          value={formatRs(report.materialSold)}
          icon={ShoppingBag}
          variant="default"
          subtext="Total credit value given this month"
        />
        <StatCard
          label={`Payment Received (${report.formattedMonth})`}
          value={formatRs(report.paymentReceived)}
          icon={CreditCard}
          variant="success"
          subtext="Total cash & bank deposits collected"
        />
        <StatCard
          label={`Payment Due in Month`}
          value={formatRs(report.paymentDue)}
          icon={CalendarClock}
          variant="warning"
          subtext="Sales maturing within this month"
        />
        <StatCard
          label="Total Balance Remaining"
          value={formatRs(report.balanceRemaining)}
          icon={Wallet}
          variant="default"
          subtext="Unpaid across all customers, as of today"
        />
      </div>

      {/* Customer-Wise Breakdown Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
              Customer Breakdown for {report.formattedMonth}
            </h2>
            <p className="text-xs text-zinc-500">
              Customer activity and balance net changes during this calendar month
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-200/70 text-zinc-800">
            {report.customerBreakdown.length} Active Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-zinc-100/75 border-b border-zinc-200 text-zinc-600 font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4 text-right">Material Sold</th>
                <th className="py-3.5 px-4 text-right text-emerald-800">Payment Received</th>
                <th className="py-3.5 px-4 text-right text-amber-900">Payment Due</th>
                <th className="py-3.5 px-4 text-right">Month Net (Sold − Recv)</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {report.customerBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <FileBarChart className="w-8 h-8 opacity-40 mx-auto mb-2" />
                    <p className="font-bold text-zinc-700">No activity in {report.formattedMonth}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      No sales or payments were recorded during this month. Use the Month Picker to view other months.
                    </p>
                  </td>
                </tr>
              ) : (
                report.customerBreakdown.map((row) => {
                  const isNetDebit = row.monthBalance > 0;
                  return (
                    <tr key={row.customerId} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Customer Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="font-bold text-zinc-900 hover:text-emerald-700 flex items-center gap-1 group"
                        >
                          <span className="truncate max-w-[200px]">{row.customerName}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-600" />
                        </Link>
                      </td>

                      {/* Material Sold */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold text-zinc-900">
                        {row.materialSold > 0 ? formatRs(row.materialSold) : '—'}
                      </td>

                      {/* Payment Received */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-emerald-700">
                        {row.paymentReceived > 0 ? formatRs(row.paymentReceived) : '—'}
                      </td>

                      {/* Payment Due */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap text-amber-900 font-semibold">
                        {row.paymentDue > 0 ? formatRs(row.paymentDue) : '—'}
                      </td>

                      {/* Month Balance */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-extrabold">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                            isNetDebit
                              ? 'bg-rose-50 text-rose-700'
                              : row.monthBalance < 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {isNetDebit ? (
                            <TrendingUp className="w-3 h-3 text-rose-600" />
                          ) : row.monthBalance < 0 ? (
                            <TrendingDown className="w-3 h-3 text-emerald-600" />
                          ) : null}
                          {formatRs(Math.abs(row.monthBalance))}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs inline-flex items-center gap-1"
                        >
                          <span>Open Ledger</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
