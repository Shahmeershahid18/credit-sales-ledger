import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById, getLedger } from '@/lib/queries';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { LedgerTable } from '@/components/LedgerTable';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { PageHeader, buttonClass } from '@/components/ui';
import { Plus, ArrowDownLeft, Phone, MapPin, Calendar, Receipt, CreditCard, Wallet, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface CustomerLedgerPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CustomerLedgerPageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);
  return { title: customer?.name ?? 'Customer' };
}

export default async function CustomerLedgerPage({ params }: CustomerLedgerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const ledger = await getLedger(id);

  const outstandingSubtext =
    ledger.overdue > 0
      ? `${formatRs(ledger.overdue)} overdue`
      : ledger.advance > 0
      ? `${formatRs(ledger.advance)} advance received`
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/customers"
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer.name}
            <StatusBadge status={ledger.status} />
          </span>
        }
        description={
          (customer.phone || customer.address) && (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {customer.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.phone}
                </span>
              )}
              {customer.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {customer.address}
                </span>
              )}
            </span>
          )
        }
        actions={
          <>
            <WhatsAppButton
              customerName={customer.name}
              phone={customer.phone}
              outstanding={ledger.outstanding}
              dueDate={ledger.nextDueDate}
            />
            <Link href={`/customers/${id}/edit`} className={buttonClass('secondary')} aria-label="Edit customer">
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
            <Link href={`/customers/${id}/sale/new`} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span> Sale
            </Link>
            <Link href={`/customers/${id}/payment/new`} className={buttonClass('success')}>
              <ArrowDownLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span> Payment
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total credit sale" value={formatRs(ledger.totalSale)} icon={Receipt} />
        <StatCard label="Payment received" value={formatRs(ledger.totalReceived)} icon={CreditCard} variant="success" />
        <StatCard
          label="Outstanding"
          value={formatRs(ledger.outstanding)}
          icon={Wallet}
          variant={ledger.outstanding > 0 ? (ledger.overdue > 0 ? 'danger' : 'warning') : 'default'}
          subtext={outstandingSubtext}
        />
        <StatCard
          label="Next due date"
          value={ledger.nextDueDate ? formatDate(ledger.nextDueDate) : '—'}
          icon={Calendar}
          variant={ledger.overdue > 0 ? 'danger' : 'default'}
          subtext={ledger.nextDueDate ? 'Oldest unpaid sale' : 'No unpaid sales'}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Ledger</h2>
        <LedgerTable rows={ledger.rows} customerId={id} />
      </section>
    </div>
  );
}
