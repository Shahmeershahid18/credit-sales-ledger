import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById, getLedger } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { LedgerTable } from '@/components/LedgerTable';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { PageHeader, buttonClass } from '@/components/ui';
import { Plus, ArrowDownLeft, ArrowUpRight, Phone, MapPin, Calendar, Receipt, CreditCard, Wallet, Pencil } from 'lucide-react';

export async function contactMetadata(kind: ContactKind, id: string): Promise<Metadata> {
  const contact = await getCustomerById(id, kind);
  return { title: contact?.name ?? SIDES[kind].One };
}

/**
 * One customer's or vendor's ledger (/customers/[id], /vendors/[id])
 */
export async function ContactLedgerView({ kind, id }: { kind: ContactKind; id: string }) {
  const terms = SIDES[kind];
  const contact = await getCustomerById(id, kind);

  if (!contact) {
    notFound();
  }

  const ledger = await getLedger(id);
  const href = `${terms.base}/${id}`;
  const PaymentIcon = kind === 'vendor' ? ArrowUpRight : ArrowDownLeft;

  const outstandingSubtext =
    ledger.overdue > 0
      ? `${formatRs(ledger.overdue)} overdue`
      : ledger.advance > 0
      ? `${formatRs(ledger.advance)} ${terms.advanceLabel}`
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={terms.base}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {contact.name}
            <StatusBadge status={ledger.status} />
          </span>
        }
        description={
          (contact.phone || contact.address) && (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {contact.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </span>
              )}
              {contact.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {contact.address}
                </span>
              )}
            </span>
          )
        }
        actions={
          <>
            {kind === 'customer' && (
              <WhatsAppButton
                customerName={contact.name}
                phone={contact.phone}
                outstanding={ledger.outstanding}
                dueDate={ledger.nextDueDate}
              />
            )}
            <Link href={`${href}/edit`} className={buttonClass('secondary')} aria-label={`Edit ${terms.one}`}>
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
            <Link href={`${href}/${terms.entrySegment}/new`} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span> {terms.Entry}
            </Link>
            <Link href={`${href}/payment/new`} className={buttonClass('success')}>
              <PaymentIcon className="w-4 h-4" />
              {kind === 'vendor' ? (
                'Pay'
              ) : (
                <>
                  <span className="hidden sm:inline">Add</span> Payment
                </>
              )}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={terms.totalLabel} value={formatRs(ledger.totalSale)} icon={Receipt} />
        <StatCard label={terms.paidLabel} value={formatRs(ledger.totalReceived)} icon={CreditCard} variant="success" />
        <StatCard
          label={terms.balanceLabel}
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
          subtext={ledger.nextDueDate ? `Oldest unpaid ${terms.entry}` : `No unpaid ${terms.entry}s`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Ledger</h2>
        <LedgerTable rows={ledger.rows} customerId={id} kind={kind} />
      </section>
    </div>
  );
}
