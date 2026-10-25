import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById, getLedger } from '@/lib/queries';
import { PaymentForm } from '@/components/PaymentForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Record payment' };

interface CustomerPaymentPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerPaymentPage({ params }: CustomerPaymentPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const ledger = await getLedger(id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Record payment" description={customer.name} backHref={`/customers/${id}`} />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <PaymentForm
          customers={[{ id: customer.id, name: customer.name, outstanding: ledger.outstanding, overdue: ledger.overdue }]}
          preselectedCustomerId={id}
          cancelHref={`/customers/${id}`}
        />
      </div>
    </div>
  );
}
