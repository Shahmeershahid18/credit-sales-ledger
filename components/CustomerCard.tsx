import React from 'react';
import Link from 'next/link';
import { CustomerSummary } from '@/lib/types';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { Phone, MapPin, ChevronRight, PlusCircle, ArrowUpRight } from 'lucide-react';

interface CustomerCardProps {
  customer: CustomerSummary;
}

export function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 hover:border-zinc-300 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Top Header: Name + Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <Link
              href={`/customers/${customer.customer_id}`}
              className="text-lg font-bold text-zinc-900 hover:text-emerald-700 transition-colors flex items-center gap-1 group-hover:translate-x-0.5 transform duration-150"
            >
              <span className="truncate">{customer.name}</span>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 shrink-0" />
            </Link>

            {/* Contact details */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-500 mt-1">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-zinc-400" />
                  {customer.phone}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1 truncate max-w-[200px]" title={customer.address}>
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  {customer.address}
                </span>
              )}
            </div>
          </div>

          <StatusBadge status={customer.status} />
        </div>

        {/* 4 Metrics Grid (Matching screenshot layout) */}
        <div className="grid grid-cols-2 gap-2.5 my-3">
          {/* Total Credit Sale */}
          <div className="bg-zinc-100/80 rounded-xl p-3 border border-zinc-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Credit Sale
            </p>
            <p className="text-base font-bold text-zinc-900 mt-0.5">
              {formatRs(customer.total_credit_sale)}
            </p>
          </div>

          {/* Payment Received (Green) */}
          <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Payment Received
            </p>
            <p className="text-base font-bold text-emerald-700 mt-0.5">
              {formatRs(customer.payment_received)}
            </p>
          </div>

          {/* Outstanding */}
          <div
            className={`rounded-xl p-3 border ${
              customer.outstanding > 0
                ? customer.overdue > 0
                  ? 'bg-rose-50/70 border-rose-200/50'
                  : 'bg-amber-50/70 border-amber-200/50'
                : 'bg-zinc-100/80 border-zinc-200/50'
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                customer.outstanding > 0
                  ? customer.overdue > 0
                    ? 'text-rose-700'
                    : 'text-amber-800'
                  : 'text-zinc-500'
              }`}
            >
              Outstanding
            </p>
            <p
              className={`text-base font-bold mt-0.5 ${
                customer.outstanding > 0
                  ? customer.overdue > 0
                    ? 'text-rose-700'
                    : 'text-amber-900'
                  : 'text-zinc-800'
              }`}
            >
              {formatRs(customer.outstanding)}
            </p>
            {customer.advance > 0 && (
              <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                Advance: {formatRs(customer.advance)}
              </p>
            )}
          </div>

          {/* Credit Due Date */}
          <div className="bg-zinc-100/80 rounded-xl p-3 border border-zinc-200/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Due Date
            </p>
            <p className="text-sm font-bold text-zinc-800 mt-1 truncate">
              {customer.next_due_date ? formatDate(customer.next_due_date) : 'No due sales'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 text-xs font-semibold">
        <Link
          href={`/customers/${customer.customer_id}`}
          className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 font-medium py-1"
        >
          <span>Open Ledger</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/customers/${customer.customer_id}/sale/new`}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors flex items-center gap-1"
          >
            <PlusCircle className="w-3 h-3 text-zinc-600" />
            <span>Sale</span>
          </Link>
          <Link
            href={`/customers/${customer.customer_id}/payment/new`}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
          >
            <PlusCircle className="w-3 h-3 text-emerald-100" />
            <span>Payment</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
