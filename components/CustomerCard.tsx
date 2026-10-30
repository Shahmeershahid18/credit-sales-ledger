import React from 'react';
import Link from 'next/link';
import { CustomerSummary } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { Phone, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CustomerCardProps {
  kind: ContactKind;
  customer: CustomerSummary;
}

export function CustomerCard({ kind, customer }: CustomerCardProps) {
  const terms = SIDES[kind];
  const href = `${terms.base}/${customer.customer_id}`;
  const PaymentIcon = kind === 'vendor' ? ArrowUpRight : ArrowDownLeft;
  const outstandingColor =
    customer.outstanding > 0 ? (customer.overdue > 0 ? 'text-rose-700' : 'text-amber-700') : 'text-zinc-900';

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition-colors flex flex-col">
      <Link href={href} className="p-4 sm:p-5 flex-1 group">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate group-hover:text-emerald-700">{customer.name}</p>
            {customer.phone && (
              <p className="mt-0.5 text-xs text-zinc-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {customer.phone}
              </p>
            )}
          </div>
          <StatusBadge status={customer.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">{terms.totalLabel}</dt>
            <dd className="font-medium text-zinc-900 tabular-nums">{formatRs(customer.total_credit_sale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{terms.paidLabel}</dt>
            <dd className="font-medium text-emerald-700 tabular-nums">{formatRs(customer.payment_received)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{terms.balanceLabel}</dt>
            <dd className={`font-semibold tabular-nums ${outstandingColor}`}>{formatRs(customer.outstanding)}</dd>
            {customer.advance > 0 && (
              <dd className="text-xs text-emerald-700">Advance {formatRs(customer.advance)}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Next due date</dt>
            <dd className="font-medium text-zinc-900">
              {customer.next_due_date ? formatDate(customer.next_due_date) : '—'}
            </dd>
          </div>
        </dl>
      </Link>

      <div className="px-4 sm:px-5 py-2.5 border-t border-zinc-100 flex items-center justify-end gap-1">
        <Link
          href={`${href}/${terms.entrySegment}/new`}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-zinc-700 hover:bg-zinc-100 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {terms.Entry}
        </Link>
        <Link
          href={`${href}/payment/new`}
          className="h-8 px-2.5 rounded-md text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
        >
          <PaymentIcon className="w-3.5 h-3.5" />
          {kind === 'vendor' ? 'Pay' : 'Payment'}
        </Link>
      </div>
    </div>
  );
}
