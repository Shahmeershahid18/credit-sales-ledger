import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomerById, getLedger } from '@/lib/queries';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { LedgerTable } from '@/components/LedgerTable';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import {
  ArrowLeft,
  PlusCircle,
  ArrowDownLeft,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  CreditCard,
  TrendingUp,
  Pencil,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface CustomerLedgerPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerLedgerPage({ params }: CustomerLedgerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const ledger = await getLedger(id);
  const customerStatus = ledger.status;

  const outstandingSubtext =
    ledger.overdue > 0
      ? `Overdue: ${formatRs(ledger.overdue)}`
      : ledger.advance > 0
      ? `Advance received: ${formatRs(ledger.advance)}`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Header with Navigation and Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80">
        <div className="flex items-start gap-3">
          <Link
            href="/customers"
            className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors shadow-xs mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
                {customer.name}
              </h1>
              <StatusBadge status={customerStatus} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 mt-1">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  {customer.phone}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {customer.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Reminder & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <WhatsAppButton
            customerName={customer.name}
            phone={customer.phone}
            outstanding={ledger.outstanding}
            dueDate={ledger.nextDueDate}
          />

          <Link
            href={`/customers/${id}/edit`}
            className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Link>

          <Link
            href={`/customers/${id}/sale/new`}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Sale</span>
          </Link>

          <Link
            href={`/customers/${id}/payment/new`}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Add Payment</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Cards (Exact screenshot specification) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Credit Sale"
          value={formatRs(ledger.totalSale)}
          icon={Receipt}
          variant="default"
        />
        <StatCard
          label="Payment Received"
          value={formatRs(ledger.totalReceived)}
          icon={CreditCard}
          variant="success"
        />
        <StatCard
          label="Outstanding"
          value={formatRs(ledger.outstanding)}
          icon={TrendingUp}
          variant={ledger.outstanding > 0 ? (ledger.overdue > 0 ? 'danger' : 'warning') : 'default'}
          subtext={outstandingSubtext}
        />
        <StatCard
          label="Credit Due Date"
          value={ledger.nextDueDate ? formatDate(ledger.nextDueDate) : 'No due sales'}
          icon={Calendar}
          variant={ledger.overdue > 0 ? 'danger' : 'default'}
          subtext={ledger.nextDueDate ? 'Oldest unpaid sale due' : undefined}
        />
      </div>

      {/* Date-wise Ledger Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">
              Date-Wise Account Ledger
            </h2>
            <p className="text-xs text-zinc-500">
              Chronological log of all materials delivered on credit and payments received with running balance
            </p>
          </div>
        </div>

        <LedgerTable rows={ledger.rows} />
      </div>
    </div>
  );
}
