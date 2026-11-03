import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getMonthFlows, getMonthlyReportData, getYearlyReportData } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatRs, getCurrentMonthStr, isValidMonthStr, shiftMonth } from '@/lib/format';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import { MonthlyHistory } from '@/components/MonthlyHistory';
import { EmptyState, PageHeader, cardClass } from '@/components/ui';
import { ShoppingBag, CreditCard, CalendarClock, Wallet, FileBarChart } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Report' };

interface ReportPageProps {
  // ?month=YYYY-MM for a monthly report (the default), ?year=YYYY for a yearly one
  searchParams: Promise<{ month?: string; year?: string; side?: string }>;
}

// Column wording for each side of the report
const LABELS = {
  customer: { tab: 'Sales', moved: 'Material sold', movedShort: 'Sold', paid: 'Payment received', paidShort: 'Received', net: 'sold − received', csvNet: 'sold - received', file: 'sales' },
  vendor: { tab: 'Purchases', moved: 'Material purchased', movedShort: 'Bought', paid: 'Payment made', paidShort: 'Paid', net: 'bought − paid', csvNet: 'bought - paid', file: 'purchases' },
} as const;

const FIRST_YEAR = 2000;
const amountOrDash = (value: number) => (value > 0 ? formatRs(value) : '—');

function netClass(value: number) {
  if (value > 0) return 'text-rose-700';
  if (value < 0) return 'text-emerald-700';
  return 'text-zinc-500';
}

function TabNav({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 p-1 rounded-lg bg-zinc-100 w-fit">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`h-8 px-4 rounded-md text-sm font-medium flex items-center ${
            item.active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { month, year, side } = await searchParams;
  const kind: ContactKind = side === 'vendor' ? 'vendor' : 'customer';
  const terms = SIDES[kind];
  const labels = LABELS[kind];
  const sideQuery = kind === 'vendor' ? 'side=vendor' : undefined;
  const withSide = (q: string, k: ContactKind = kind) => `/reports?${k === 'vendor' ? 'side=vendor&' : ''}${q}`;

  const thisMonth = getCurrentMonthStr();
  const thisYear = Number(thisMonth.slice(0, 4));

  // A valid ?year (and no ?month) opens the yearly report; future years show this year
  const yearly = !month && /^\d{4}$/.test(year ?? '');
  const reportYear = yearly ? Math.min(Math.max(Number(year), FIRST_YEAR), thisYear) : 0;
  const reportMonth = isValidMonthStr(month) ? month : thisMonth;

  // The months of the history table: the report's year, or the last 12 months
  const historyFrom = yearly ? `${reportYear}-01` : shiftMonth(thisMonth, -11);
  const historyTo = yearly ? (reportYear === thisYear ? thisMonth : `${reportYear}-12`) : thisMonth;

  const [report, history] = await Promise.all([
    yearly ? getYearlyReportData(kind, String(reportYear)) : getMonthlyReportData(kind, reportMonth),
    getMonthFlows(historyFrom, historyTo),
  ]);
  const rows = report.customerBreakdown;
  const periodName = yearly ? 'year' : 'month';

  const csvHeaders = [terms.One, labels.moved, labels.paid, 'Payment due', `Net (${labels.csvNet})`];
  const csvRows = rows.map((c) => [c.customerName, c.materialSold, c.paymentReceived, c.paymentDue, c.monthBalance]);

  // Switching between monthly and yearly keeps the same period where it can
  const reportMonthYear = Number(reportMonth.slice(0, 4));
  const monthForYear = reportYear === thisYear ? thisMonth : `${reportYear}-12`;
  const periodQuery = yearly ? `year=${reportYear}` : `month=${reportMonth}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report"
        description={yearly ? `Year ${reportYear}${reportYear === thisYear ? ' so far' : ''}` : report.formattedMonth}
        actions={
          <>
            {yearly ? (
              <YearPicker year={reportYear} thisYear={thisYear} query={sideQuery} />
            ) : (
              <MonthPicker currentMonth={reportMonth} query={sideQuery} />
            )}
            <CsvExportButton
              filename={`credit-ledger-${labels.file}-${yearly ? reportYear : reportMonth}`}
              headers={csvHeaders}
              rows={csvRows}
              disabled={csvRows.length === 0}
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <TabNav
          label="Report period"
          items={[
            { label: 'Monthly', href: withSide(`month=${yearly ? monthForYear : reportMonth}`), active: !yearly },
            { label: 'Yearly', href: withSide(`year=${yearly ? reportYear : Math.min(reportMonthYear, thisYear)}`), active: yearly },
          ]}
        />
        <TabNav
          label="Report side"
          items={(['customer', 'vendor'] as const).map((k) => ({ label: LABELS[k].tab, href: withSide(periodQuery, k), active: k === kind }))}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={labels.moved} value={formatRs(report.materialSold)} icon={ShoppingBag} />
        <StatCard label={labels.paid} value={formatRs(report.paymentReceived)} icon={CreditCard} variant="success" />
        <StatCard
          label="Payment due"
          value={formatRs(report.paymentDue)}
          icon={CalendarClock}
          variant="warning"
          subtext={`${terms.Entries} falling due this ${periodName}`}
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
            description={`No ${terms.entry}s, payments or due dates fall in this ${periodName}.`}
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

      {yearly ? (
        <MonthlyHistory
          flows={history}
          hrefFor={(m) => withSide(`month=${m}`)}
          title={`${reportYear} month by month`}
          description="Sales and purchases side by side. Open a month to see its report."
          newestFirst={false}
        />
      ) : (
        <MonthlyHistory flows={history} selected={reportMonth} hrefFor={(m) => withSide(`month=${m}`)} />
      )}
    </div>
  );
}
