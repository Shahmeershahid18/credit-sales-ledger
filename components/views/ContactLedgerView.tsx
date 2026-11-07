import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById, getPartyLedger } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { PartySide } from '@/lib/types';
import { balanceLabel, formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { LedgerTable } from '@/components/LedgerTable';
import { PartySettlement } from '@/components/PartySettlement';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { PageHeader, buttonClass } from '@/components/ui';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  Pencil,
  Scale,
  FileText,
  ShoppingCart,
} from 'lucide-react';

export async function contactMetadata(kind: ContactKind, id: string): Promise<Metadata> {
  const contact = await getCustomerById(id, kind);
  return { title: contact?.name ?? SIDES[kind].One };
}

/**
 * One party's page (/customers/[id], /vendors/[id]): its sales and purchases in one
 * combined ledger, with the net balance and settlement when it is both
 */
export async function ContactLedgerView({ kind, id }: { kind: ContactKind; id: string }) {
  const terms = SIDES[kind];
  const contact = await getCustomerById(id, kind);

  if (!contact) {
    notFound();
  }

  const ledger = await getPartyLedger(id);
  const both = contact.is_customer && contact.is_vendor;
  const side = ledger[kind];
  const href = `${terms.base}/${id}`;
  const customerHref = `${SIDES.customer.base}/${id}`;
  const vendorHref = `${SIDES.vendor.base}/${id}`;
  const reminderAmount = both ? Math.max(0, ledger.net) : ledger.customer.outstanding;
  const nextDue = [ledger.customer.nextDueDate, ledger.vendor.nextDueDate].filter(Boolean).sort()[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={terms.base}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {contact.name}
            {both ? (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                Customer · Vendor
              </span>
            ) : (
              <StatusBadge status={side.status} />
            )}
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
            {contact.is_customer && reminderAmount > 0 && (
              <WhatsAppButton
                customerName={contact.name}
                phone={contact.phone}
                outstanding={reminderAmount}
                dueDate={ledger.customer.nextDueDate}
              />
            )}
            <Link href={`${href}/statement`} className={buttonClass('secondary')} aria-label="Statement">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Statement</span>
            </Link>
            <Link href={`${href}/edit`} className={buttonClass('secondary')} aria-label={`Edit ${terms.one}`}>
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
            {contact.is_customer && (
              <>
                <Link href={`${customerHref}/sale/new`} className={buttonClass('primary')}>
                  <Plus className="w-4 h-4" />
                  Sale
                </Link>
                <Link href={`${customerHref}/payment/new`} className={buttonClass('success')}>
                  <ArrowDownLeft className="w-4 h-4" />
                  Receive
                </Link>
              </>
            )}
            {contact.is_vendor && (
              <>
                <Link href={`${vendorHref}/purchase/new`} className={buttonClass(both ? 'secondary' : 'primary')}>
                  <ShoppingCart className="w-4 h-4" />
                  Purchase
                </Link>
                <Link href={`${vendorHref}/payment/new`} className={buttonClass(both ? 'secondary' : 'success')}>
                  <ArrowUpRight className="w-4 h-4" />
                  Pay
                </Link>
              </>
            )}
          </>
        }
      />

      {both ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <BalanceCard label="Receivable" sub="Their unpaid sales" side={ledger.customer} icon={ArrowDownLeft} />
            <BalanceCard label="Payable" sub="Your unpaid purchases" side={ledger.vendor} icon={ArrowUpRight} />
            <StatCard
              label="Net balance"
              value={formatRs(Math.abs(ledger.net))}
              icon={Scale}
              variant={Math.round(ledger.net) > 0 ? 'success' : Math.round(ledger.net) < 0 ? 'danger' : 'default'}
              subtext={balanceLabel(ledger.net) === 'Settled' ? 'Nothing owed either way' : `${balanceLabel(ledger.net)} after netting`}
            />
            <StatCard
              label="Next due date"
              value={nextDue ? formatDate(nextDue) : '—'}
              icon={Calendar}
              variant={ledger.customer.overdue + ledger.vendor.overdue > 0 ? 'danger' : 'default'}
              subtext={nextDue ? 'Oldest unpaid bill' : 'No unpaid bills'}
            />
          </div>
          <PartySettlement
            partyId={id}
            customer={ledger.customer}
            vendor={ledger.vendor}
            net={ledger.net}
            settleable={ledger.settleable}
          />
        </>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label={terms.totalLabel} value={formatRs(side.total)} icon={Receipt} />
          <StatCard label={terms.paidLabel} value={formatRs(side.paid)} icon={CreditCard} variant="success" />
          <StatCard
            label={terms.balanceLabel}
            value={formatRs(side.outstanding)}
            icon={Wallet}
            variant={side.outstanding > 0 ? (side.overdue > 0 ? 'danger' : 'warning') : 'default'}
            subtext={
              side.overdue > 0
                ? `${formatRs(side.overdue)} overdue`
                : side.advance > 0
                ? `${formatRs(side.advance)} ${terms.advanceLabel}`
                : undefined
            }
          />
          <StatCard
            label="Next due date"
            value={side.nextDueDate ? formatDate(side.nextDueDate) : '—'}
            icon={Calendar}
            variant={side.overdue > 0 ? 'danger' : 'default'}
            subtext={side.nextDueDate ? `Oldest unpaid ${terms.entry}` : `No unpaid ${terms.entry}s`}
          />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Ledger</h2>
        <LedgerTable rows={ledger.rows} partyId={id} kind={kind} roles={{ customer: contact.is_customer, vendor: contact.is_vendor }} />
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  sub,
  side,
  icon,
}: {
  label: string;
  sub: string;
  side: PartySide;
  icon: React.ComponentProps<typeof StatCard>['icon'];
}) {
  return (
    <StatCard
      label={label}
      value={formatRs(side.outstanding)}
      icon={icon}
      variant={side.outstanding > 0 ? (side.overdue > 0 ? 'danger' : 'warning') : 'default'}
      subtext={side.overdue > 0 ? `${formatRs(side.overdue)} overdue` : sub}
    />
  );
}
