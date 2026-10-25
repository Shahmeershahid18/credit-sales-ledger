import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomerById, getCustomers } from '@/lib/queries';
import { SaleForm } from '@/components/SaleForm';
import { ArrowLeft, PlusCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface CustomerAddSalePageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerAddSalePage({ params }: CustomerAddSalePageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const rawCustomers = await getCustomers();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/customers/${id}`}
          className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-zinc-900" />
            Add Credit Sale for {customer.name}
          </h1>
          <p className="text-xs text-zinc-500">
            Record material delivered on credit with auto-calculated due date
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
        <SaleForm customers={rawCustomers} preselectedCustomerId={id} />
      </div>
    </div>
  );
}
