import React from 'react';
import type { Metadata } from 'next';
import { getCustomerCards } from '@/lib/queries';
import { PaymentForm } from '@/components/PaymentForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Record payment' };

export default async function NewPaymentPage() {
  const customers = await getCustomerCards();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Record payment" backHref="/" />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <PaymentForm
          customers={customers.map((c) => ({
            id: c.customer_id,
            name: c.name,
            outstanding: c.outstanding,
            overdue: c.overdue,
          }))}
          cancelHref="/"
        />
      </div>
    </div>
  );
}
