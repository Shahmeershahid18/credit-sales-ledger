import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomerById } from '@/lib/queries';
import { CustomerForm } from '@/components/CustomerForm';
import { ArrowLeft, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/customers/${id}`}
          className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Pencil className="w-5 h-5 text-emerald-600" />
            Edit Customer
          </h1>
          <p className="text-xs text-zinc-500">Update name, phone or address for {customer.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200/90 p-6 sm:p-8 shadow-xs">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
