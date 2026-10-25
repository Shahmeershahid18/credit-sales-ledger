import React from 'react';
import Link from 'next/link';
import { getDashboardTotals, getCustomerCards } from '@/lib/queries';
import { formatRs } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { AgingChart } from '@/components/AgingChart';
import { TopCustomersChart } from '@/components/TopCustomersChart';
import { CustomerCard } from '@/components/CustomerCard';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Receipt,
  PlusCircle,
  ArrowDownLeft,
  UserPlus,
  ArrowRight,
  CalendarCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = await getDashboardTotals();
  const customerCards = await getCustomerCards();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
            Credit Sale Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Real-time monitoring of credit given, payments received, and overdue accounts
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/sales/new"
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Sale</span>
          </Link>
          <Link
            href="/payments/new"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Add Payment</span>
          </Link>
          <Link
            href="/customers/new"
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
            <span>New Customer</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Cards (Exact screenshot layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Credit Sale"
          value={formatRs(stats.totalCreditSale)}
          icon={Receipt}
          variant="default"
          subtext="Cumulative credit given to all clients"
        />
        <StatCard
          label="Payment Received"
          value={formatRs(stats.totalReceived)}
          icon={CreditCard}
          variant="success"
          subtext="Total collected payments to date"
        />
        <StatCard
          label="Outstanding Balance"
          value={formatRs(stats.totalOutstanding)}
          icon={TrendingUp}
          variant={stats.totalOutstanding > 0 ? 'warning' : 'default'}
          subtext={
            stats.totalAdvance > 0
              ? `Unpaid sales · Advance held: ${formatRs(stats.totalAdvance)}`
              : 'Unpaid sales across all customers'
          }
        />
        <StatCard
          label="Overdue Amount"
          value={formatRs(stats.totalOverdue)}
          icon={AlertTriangle}
          variant={stats.totalOverdue > 0 ? 'danger' : 'default'}
          subtext="Unpaid sales past credit term"
        />
      </div>

      {/* Current Month Mini Report Banner */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Current Month Report
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                {stats.currentMonth.name}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Summary of billing and recovery performance for this calendar month
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs sm:text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Sold</p>
            <p className="font-extrabold text-zinc-900">{formatRs(stats.currentMonth.sold)}</p>
          </div>
          <div className="h-8 w-px bg-zinc-200" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Received</p>
            <p className="font-extrabold text-emerald-700">{formatRs(stats.currentMonth.received)}</p>
          </div>
          <div className="h-8 w-px bg-zinc-200" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Net (Sold − Received)</p>
            <p className="font-extrabold text-zinc-900">{formatRs(stats.currentMonth.net)}</p>
          </div>

          <Link
            href="/reports/monthly"
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            <span>Full Month Report</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Visual Analytics: Aging Chart + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgingChart data={stats.agingSummary} />
        <TopCustomersChart customers={stats.topCustomers} />
      </div>

      {/* Customer Directory Preview */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
              Customer Accounts ({customerCards.length})
            </h2>
            <p className="text-xs text-zinc-500">
              Each customer has a dedicated date-wise ledger and WhatsApp reminder link
            </p>
          </div>
          <Link
            href="/customers"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>View All Accounts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customerCards.slice(0, 6).map((c) => (
            <CustomerCard key={c.customer_id} customer={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
