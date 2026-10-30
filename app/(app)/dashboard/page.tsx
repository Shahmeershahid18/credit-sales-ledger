import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDashboard } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatDate, formatRs, getTodayDateStr } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { AgingChart } from '@/components/AgingChart';
import { TopCustomersChart } from '@/components/TopCustomersChart';
import { PageHeader, buttonClass, cardClass } from '@/components/ui';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, Plus, Scale, Truck, UserPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface DashboardPageProps {
  searchParams: Promise<{ side?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { side } = await searchParams;
  const data = await getDashboard();
  const receive = data.customer;
  const pay = data.vendor;

  const hasVendors = pay.customerCount > 0;
  const chartKind: ContactKind = side === 'vendor' ? 'vendor' : 'customer';
  const chartStats = data[chartKind];
  const chartTerms = SIDES[chartKind];
  const net = receive.totalOutstanding - pay.totalOutstanding;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={formatDate(getTodayDateStr())}
        actions={
          <>
            <Link href="/customers/new" className={buttonClass('secondary')}>
              <UserPlus className="w-4 h-4" />
              New Customer
            </Link>
            <Link href="/vendors/new" className={buttonClass('secondary')}>
              <Truck className="w-4 h-4" />
              New Vendor
            </Link>
          </>
        }
      />

      {receive.customerCount === 0 && !hasVendors ? (
        <GettingStarted />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="To receive"
              value={formatRs(receive.totalOutstanding)}
              icon={ArrowDownLeft}
              variant={receive.totalOverdue > 0 ? 'danger' : receive.totalOutstanding > 0 ? 'warning' : 'default'}
              subtext={
                receive.totalOverdue > 0
                  ? `${formatRs(receive.totalOverdue)} overdue`
                  : `${plural(receive.customersWithBalance, 'customer')} with a balance`
              }
            />
            <StatCard
              label="To pay"
              value={formatRs(pay.totalOutstanding)}
              icon={ArrowUpRight}
              variant={pay.totalOverdue > 0 ? 'danger' : pay.totalOutstanding > 0 ? 'warning' : 'default'}
              subtext={
                !hasVendors
                  ? 'No vendors yet'
                  : pay.totalOverdue > 0
                  ? `${formatRs(pay.totalOverdue)} overdue`
                  : `${plural(pay.customersWithBalance, 'vendor')} to pay`
              }
            />
            <StatCard
              label="Net position"
              value={formatRs(net)}
              icon={Scale}
              variant={net >= 0 ? 'success' : 'danger'}
              subtext={net >= 0 ? 'Owed to you, after what you owe' : 'You owe more than you are owed'}
            />
            <DueSoonCard receive={receive.dueThisWeek} pay={pay.dueThisWeek} />
          </div>

          <div className={`${cardClass} p-4 sm:p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">This month</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{receive.currentMonth.name}</p>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-10 text-sm">
              <MonthFigure label="Sold" value={receive.currentMonth.sold} />
              <MonthFigure label="Received" value={receive.currentMonth.received} className="text-emerald-700" />
              <MonthFigure label="Purchased" value={pay.currentMonth.sold} />
              <MonthFigure label="Paid" value={pay.currentMonth.received} className="text-rose-700" />
            </dl>
            <Link
              href="/reports/monthly"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 self-start lg:self-auto"
            >
              Monthly report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav aria-label="Dashboard side" className="flex gap-1 p-1 rounded-lg bg-zinc-100 self-start">
                {(['customer', 'vendor'] as const).map((k) => {
                  const active = k === chartKind;
                  return (
                    <Link
                      key={k}
                      href={k === 'vendor' ? '/dashboard?side=vendor' : '/dashboard'}
                      aria-current={active ? 'page' : undefined}
                      className={`h-8 px-4 rounded-md text-sm font-medium flex items-center ${
                        active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {k === 'vendor' ? 'Payables' : 'Receivables'}
                    </Link>
                  );
                })}
              </nav>
              <p className="text-xs text-zinc-500">
                {chartTerms.totalLabel} <span className="font-medium text-zinc-900 tabular-nums">{formatRs(chartStats.totalCreditSale)}</span>
                {' · '}
                {chartTerms.paidLabel} <span className="font-medium text-zinc-900 tabular-nums">{formatRs(chartStats.totalReceived)}</span>
                {chartStats.totalAdvance > 0 && (
                  <>
                    {' · '}Advance <span className="font-medium text-zinc-900 tabular-nums">{formatRs(chartStats.totalAdvance)}</span>
                  </>
                )}
              </p>
            </div>

            {chartKind === 'vendor' && !hasVendors ? (
              <div className={`${cardClass} p-6 text-center`}>
                <p className="text-sm font-medium text-zinc-900">No vendors yet</p>
                <p className="text-sm text-zinc-500 mt-1">Add the suppliers you buy from on credit to track what you owe them.</p>
                <Link href="/vendors/new" className={buttonClass('primary', 'mt-4')}>
                  <Truck className="w-4 h-4" />
                  Add vendor
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AgingChart
                  data={chartStats.agingSummary}
                  title={chartTerms.agingTitle}
                  totalLabel={chartKind === 'vendor' ? 'Payable' : 'Receivable'}
                />
                <TopCustomersChart kind={chartKind} customers={chartStats.topCustomers} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MonthFigure({ label, value, className = 'text-zinc-900' }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${className}`}>{formatRs(value)}</dd>
    </div>
  );
}

function DueSoonCard({ receive, pay }: { receive: number; pay: number }) {
  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-medium text-zinc-500">Due in 7 days</p>
        <span className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center shrink-0 bg-zinc-100 text-zinc-600">
          <CalendarClock className="w-4 h-4" />
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-zinc-500">Receive</dt>
          <dd className="font-semibold text-zinc-900 tabular-nums">{formatRs(receive)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-zinc-500">Pay</dt>
          <dd className="font-semibold text-zinc-900 tabular-nums">{formatRs(pay)}</dd>
        </div>
      </dl>
    </div>
  );
}

function GettingStarted() {
  const steps = [
    { title: 'Add customers and vendors', text: 'Who you sell to on credit, and who you buy from.', href: '/customers/new', cta: 'Add customer', icon: UserPlus },
    { title: 'Record sales and purchases', text: 'Material, quantity, rate and credit days.', href: '/sales/new', cta: 'New sale', icon: Plus },
    { title: 'Record payments', text: 'Received and paid, applied to the oldest bill first.', href: '/payments/new', cta: 'Record payment', icon: ArrowDownLeft },
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={step.href} className={buttonClass(i === 0 ? 'primary' : 'secondary')}>
                  <Icon className="w-4 h-4" />
                  {step.cta}
                </Link>
                {i === 0 && (
                  <Link href="/vendors/new" className={buttonClass('secondary')}>
                    <Truck className="w-4 h-4" />
                    Add vendor
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
