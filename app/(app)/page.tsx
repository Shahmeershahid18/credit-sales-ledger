import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDashboardTotals } from '@/lib/queries';
import { formatDate, formatRs, getTodayDateStr } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { AgingChart } from '@/components/AgingChart';
import { TopCustomersChart } from '@/components/TopCustomersChart';
import { PageHeader, buttonClass, cardClass } from '@/components/ui';
import { Receipt, CreditCard, Wallet, AlertTriangle, UserPlus, ArrowRight, Plus, ArrowDownLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default async function DashboardPage() {
  const stats = await getDashboardTotals();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={formatDate(getTodayDateStr())}
        actions={
          <Link href="/customers/new" className={buttonClass('secondary')}>
            <UserPlus className="w-4 h-4" />
            New Customer
          </Link>
        }
      />

      {stats.customerCount === 0 ? (
        <GettingStarted />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Total credit sale" value={formatRs(stats.totalCreditSale)} icon={Receipt} />
            <StatCard
              label="Payment received"
              value={formatRs(stats.totalReceived)}
              icon={CreditCard}
              variant="success"
              subtext={stats.totalAdvance > 0 ? `Includes ${formatRs(stats.totalAdvance)} advance` : undefined}
            />
            <StatCard
              label="Outstanding"
              value={formatRs(stats.totalOutstanding)}
              icon={Wallet}
              variant={stats.totalOutstanding > 0 ? 'warning' : 'default'}
              subtext={plural(stats.customersWithBalance, 'customer') + ' with a balance'}
            />
            <StatCard
              label="Overdue"
              value={formatRs(stats.totalOverdue)}
              icon={AlertTriangle}
              variant={stats.totalOverdue > 0 ? 'danger' : 'default'}
              subtext={stats.customersOverdue > 0 ? plural(stats.customersOverdue, 'customer') + ' past due' : 'Nothing past due'}
            />
          </div>

          <div className={`${cardClass} p-4 sm:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">This month</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{stats.currentMonth.name}</p>
            </div>
            <dl className="grid grid-cols-3 gap-4 md:gap-10 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Sold</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">{formatRs(stats.currentMonth.sold)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Received</dt>
                <dd className="font-semibold text-emerald-700 tabular-nums">{formatRs(stats.currentMonth.received)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Net</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">{formatRs(stats.currentMonth.net)}</dd>
              </div>
            </dl>
            <Link
              href="/reports/monthly"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 self-start md:self-auto"
            >
              Monthly report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AgingChart data={stats.agingSummary} />
            <TopCustomersChart customers={stats.topCustomers} />
          </div>
        </>
      )}
    </div>
  );
}

function GettingStarted() {
  const steps = [
    { title: 'Add a customer', text: 'Name, phone and address.', href: '/customers/new', cta: 'Add customer', icon: UserPlus },
    { title: 'Record a credit sale', text: 'Material, quantity, rate and credit days.', href: '/sales/new', cta: 'New sale', icon: Plus },
    { title: 'Record payments', text: 'Applied to the oldest unpaid sale first.', href: '/payments/new', cta: 'Record payment', icon: ArrowDownLeft },
  ];

  return (
    <div className={`${cardClass} p-5 sm:p-6`}>
      <h2 className="text-base font-semibold text-zinc-900">Get started</h2>
      <p className="text-sm text-zinc-500 mt-1">Your ledger is empty. Three steps to your first report:</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="rounded-lg border border-zinc-200 p-4 flex flex-col">
              <span className="text-xs font-medium text-zinc-400">Step {i + 1}</span>
              <p className="mt-1 font-medium text-zinc-900">{step.title}</p>
              <p className="text-sm text-zinc-500 mt-0.5 flex-1">{step.text}</p>
              <Link href={step.href} className={buttonClass(i === 0 ? 'primary' : 'secondary', 'mt-4 self-start')}>
                <Icon className="w-4 h-4" />
                {step.cta}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
