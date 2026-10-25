import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerById, getMaterials } from '@/lib/queries';
import { SaleForm } from '@/components/SaleForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New credit sale' };

interface CustomerSalePageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerSalePage({ params }: CustomerSalePageProps) {
  const { id } = await params;
  const [customer, { materials, available }] = await Promise.all([getCustomerById(id), getMaterials()]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="New credit sale" description={customer.name} backHref={`/customers/${id}`} />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <SaleForm
          customers={[{ id: customer.id, name: customer.name }]}
          materials={materials}
          materialsAvailable={available}
          preselectedCustomerId={id}
          cancelHref={`/customers/${id}`}
        />
      </div>
    </div>
  );
}
