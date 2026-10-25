import React from 'react';
import type { Metadata } from 'next';
import { CustomerForm } from '@/components/CustomerForm';
import { PageHeader, cardClass } from '@/components/ui';

export const metadata: Metadata = { title: 'New customer' };

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="New customer" backHref="/customers" />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <CustomerForm cancelHref="/customers" />
      </div>
    </div>
  );
}
