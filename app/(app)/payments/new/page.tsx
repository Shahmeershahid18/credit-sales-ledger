import React from 'react';
import Link from 'next/link';
import { getCustomers } from '@/lib/queries';
import { PaymentForm } from '@/components/PaymentForm';
import { ArrowLeft, ArrowDownLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GlobalAddPaymentPage() {
  const rawCustomers = await getCustomers();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
            Record Payment Received
          </h1>
          <p className="text-xs text-zinc-500">
            Apply received funds to customer account (FIFO oldest sale settlement)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
        <PaymentForm customers={rawCustomers} />
      </div>
    </div>
  );
}
