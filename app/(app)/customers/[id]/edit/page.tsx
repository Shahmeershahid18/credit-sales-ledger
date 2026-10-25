import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById } from '@/lib/queries';
import { CustomerForm } from '@/components/CustomerForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit customer' };

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Edit customer" description={customer.name} backHref={`/customers/${id}`} />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <CustomerForm customer={customer} cancelHref={`/customers/${id}`} />
      </div>
    </div>
  );
}
