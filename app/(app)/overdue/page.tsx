import React from 'react';
import Link from 'next/link';
import { getOverdue, getCustomerCards } from '@/lib/queries';
import { formatRs } from '@/lib/format';
import { CreditDaysFilter } from '@/components/CreditDaysFilter';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { StatCard } from '@/components/StatCard';
import { AlertCircle, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface OverduePageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function OverduePage({ searchParams }: OverduePageProps) {
  const resolvedParams = await searchParams;
  const parsedDays = Number(resolvedParams.days);
  const filterDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : undefined;
  const termLabel = filterDays ? ` on ${filterDays}-day credit terms` : '';

  const overdueList = await getOverdue(filterDays);
  const allCustomers = await getCustomerCards();
  const phoneMap = new Map(allCustomers.map((c) => [c.customer_id, c.phone]));

  const totalOverdue = overdueList.reduce((sum, item) => sum + item.total_overdue, 0);
  const totalOutstanding = overdueList.reduce((sum, item) => sum + item.total_outstanding, 0);
  const total90Plus = overdueList.reduce((sum, item) => sum + item.d90_plus, 0);
  const countOverdueCustomers = overdueList.filter((item) => item.total_overdue > 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <AlertCircle className="w-7 h-7 text-rose-600" />
            Customer Overdue Report
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Aging analysis of overdue credit sales partitioned into 30, 60, and 90-day delay buckets
          </p>
        </div>

        {/* Credit Days Filter Chips */}
        <CreditDaysFilter currentFilter={filterDays} />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Overdue Amount"
          value={formatRs(totalOverdue)}
          icon={AlertTriangle}
          variant={totalOverdue > 0 ? 'danger' : 'default'}
          subtext={`${countOverdueCustomers} accounts have overdue payments`}
        />
        <StatCard
          label="Total Outstanding Under Term"
          value={formatRs(totalOutstanding)}
          icon={ShieldAlert}
          variant="warning"
          subtext="Includes both pending and overdue credit"
        />
        <StatCard
          label="High Risk (90+ Days Overdue)"
          value={formatRs(total90Plus)}
          icon={AlertCircle}
          variant={total90Plus > 0 ? 'danger' : 'default'}
          subtext="Critical follow-up required"
        />
      </div>

      {overdueList.length > 0 && totalOverdue === 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Nothing is overdue{termLabel}. The balances below are still within their credit term.
          </span>
        </div>
      )}

      {/* Overdue Aging Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
              Customer Aging Breakdown
            </h2>
            <p className="text-xs text-zinc-500">
              Customers with unpaid balances, highest overdue first. Click a name to open the ledger.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-200/70 text-zinc-800">
            {overdueList.length} Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-zinc-100/75 border-b border-zinc-200 text-zinc-600 font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4 text-right">Total Outstanding</th>
                <th className="py-3.5 px-4 text-right">Total Overdue</th>
                <th className="py-3.5 px-3 text-right bg-amber-50/50 text-amber-900">1–30 Days</th>
                <th className="py-3.5 px-3 text-right bg-orange-50/50 text-orange-900">31–60 Days</th>
                <th className="py-3.5 px-3 text-right bg-rose-50/50 text-rose-900">61–90 Days</th>
                <th className="py-3.5 px-3 text-right bg-rose-100/50 text-rose-950 font-bold">90+ Days</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {overdueList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-zinc-800">No outstanding balances{termLabel}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Every sale{termLabel} has been fully paid.
                    </p>
                  </td>
                </tr>
              ) : (
                overdueList.map((item) => {
                  const phone = phoneMap.get(item.customer_id);
                  const isHighRisk = item.d90_plus > 0;
                  return (
                    <tr
                      key={item.customer_id}
                      className={`hover:bg-zinc-50/80 transition-colors ${
                        isHighRisk ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Customer Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Link
                          href={`/customers/${item.customer_id}`}
                          className="font-bold text-zinc-900 hover:text-emerald-700 flex items-center gap-1 group"
                        >
                          <span className="truncate max-w-[180px]">{item.customer_name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-600" />
                        </Link>
                      </td>

                      {/* Total Outstanding */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-zinc-900">
                        {formatRs(item.total_outstanding)}
                      </td>

                      {/* Total Overdue */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-extrabold text-rose-700">
                        {item.total_overdue > 0 ? formatRs(item.total_overdue) : '—'}
                      </td>

                      {/* 1-30 Days */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-amber-800 font-semibold bg-amber-50/30">
                        {item.d1_30 > 0 ? formatRs(item.d1_30) : '—'}
                      </td>

                      {/* 31-60 Days */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-orange-800 font-semibold bg-orange-50/30">
                        {item.d31_60 > 0 ? formatRs(item.d31_60) : '—'}
                      </td>

                      {/* 61-90 Days */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-rose-800 font-semibold bg-rose-50/30">
                        {item.d61_90 > 0 ? formatRs(item.d61_90) : '—'}
                      </td>

                      {/* 90+ Days */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-rose-950 font-black bg-rose-100/30">
                        {item.d90_plus > 0 ? formatRs(item.d90_plus) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <WhatsAppButton
                            customerName={item.customer_name}
                            phone={phone}
                            outstanding={item.total_overdue || item.total_outstanding}
                            className="py-1 px-2.5 text-[11px]"
                          />
                          <Link
                            href={`/customers/${item.customer_id}`}
                            className="px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-xs"
                          >
                            Ledger
                          </Link>
                        </div>
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
