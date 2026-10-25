import React from 'react';
import type { Metadata } from 'next';
import { getCustomers, getMaterialSuggestions } from '@/lib/queries';
import { SaleForm } from '@/components/SaleForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New credit sale' };

export default async function NewSalePage() {
  const [customers, materials] = await Promise.all([getCustomers(), getMaterialSuggestions()]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="New credit sale" backHref="/" />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <SaleForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          materials={materials}
          cancelHref="/"
        />
      </div>
    </div>
  );
}
