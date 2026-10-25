import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getOverdue, getCustomerCards } from '@/lib/queries';
import { formatRs } from '@/lib/format';
import { CreditDaysFilter } from '@/components/CreditDaysFilter';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { StatCard } from '@/components/StatCard';
import { EmptyState, PageHeader, cardClass } from '@/components/ui';
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldAlert, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overdue' };

interface OverduePageProps {
  searchParams: Promise<{ days?: string }>;
}

const BUCKETS = [
  { key: 'd1_30', label: '1–30 days' },
  { key: 'd31_60', label: '31–60 days' },
  { key: 'd61_90', label: '61–90 days' },
  { key: 'd90_plus', label: '90+ days' },
] as const;

const amountOrDash = (value: number) => (value > 0 ? formatRs(value) : '—');

export default async function OverduePage({ searchParams }: OverduePageProps) {
  const { days } = await searchParams;
  const parsedDays = Number(days);
  const filterDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : undefined;
  const termLabel = filterDays ? ` on ${filterDays}-day terms` : '';

  const [overdueList, allCustomers] = await Promise.all([getOverdue(filterDays), getCustomerCards()]);
  const phoneMap = new Map(allCustomers.map((c) => [c.customer_id, c.phone]));

  const totalOverdue = overdueList.reduce((sum, item) => sum + item.total_overdue, 0);
  const totalOutstanding = overdueList.reduce((sum, item) => sum + item.total_outstanding, 0);
  const total90Plus = overdueList.reduce((sum, item) => sum + item.d90_plus, 0);
  const overdueCount = overdueList.filter((item) => item.total_overdue > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Overdue" description="Unpaid balances by customer and age" />

      <CreditDaysFilter currentFilter={filterDays} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Overdue"
          value={formatRs(totalOverdue)}
          icon={AlertTriangle}
          variant={totalOverdue > 0 ? 'danger' : 'default'}
          subtext={`${overdueCount} ${overdueCount === 1 ? 'customer' : 'customers'}`}
        />
        <StatCard label="Outstanding" value={formatRs(totalOutstanding)} icon={Wallet} variant="warning" subtext="Overdue and not yet due" />
        <StatCard
          label="90+ days overdue"
          value={formatRs(total90Plus)}
          icon={ShieldAlert}
          variant={total90Plus > 0 ? 'danger' : 'default'}
        />
      </div>

      {overdueList.length > 0 && totalOverdue === 0 && (
        <p className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          Nothing is overdue{termLabel}. All balances below are within their credit term.
        </p>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        {overdueList.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-5 h-5" />}
            title={`No outstanding balances${termLabel}`}
            description="Every sale has been paid in full."
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-zinc-100">
              {overdueList.map((item) => (
                <li key={item.customer_id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/customers/${item.customer_id}`} className="font-medium text-zinc-900 truncate hover:text-emerald-700">
                      {item.customer_name}
                    </Link>
                    <WhatsAppButton
                      compact
                      customerName={item.customer_name}
                      phone={phoneMap.get(item.customer_id)}
                      outstanding={item.total_overdue || item.total_outstanding}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-zinc-500">
                      Outstanding <span className="font-medium text-zinc-900 tabular-nums">{formatRs(item.total_outstanding)}</span>
                    </span>
                    <span className="font-semibold text-rose-700 tabular-nums">{amountOrDash(item.total_overdue)}</span>
                  </div>
                  {item.total_overdue > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      {BUCKETS.map((b) => (
                        <div key={b.key}>
                          <p className="text-zinc-400">{b.label}</p>
                          <p className="font-medium text-zinc-800 tabular-nums">{amountOrDash(item[b.key])}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Outstanding</th>
                    <th className="py-2.5 px-4 text-right">Overdue</th>
                    {BUCKETS.map((b) => (
                      <th key={b.key} className="py-2.5 px-3 text-right">
                        {b.label}
                      </th>
                    ))}
                    <th className="py-2.5 px-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {overdueList.map((item) => (
                    <tr key={item.customer_id} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4">
                        <Link href={`/customers/${item.customer_id}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                          {item.customer_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-900">{formatRs(item.total_outstanding)}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-rose-700">{amountOrDash(item.total_overdue)}</td>
                      {BUCKETS.map((b) => (
                        <td key={b.key} className="py-3 px-3 text-right tabular-nums text-zinc-700">
                          {amountOrDash(item[b.key])}
                        </td>
                      ))}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <WhatsAppButton
                            compact
                            customerName={item.customer_name}
                            phone={phoneMap.get(item.customer_id)}
                            outstanding={item.total_overdue || item.total_outstanding}
                          />
                          <Link
                            href={`/customers/${item.customer_id}`}
                            aria-label={`Open ledger for ${item.customer_name}`}
                            className="w-8 h-8 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 flex items-center justify-center"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
