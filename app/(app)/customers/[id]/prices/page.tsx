import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { customerPricesAvailable, getCustomerById, getCustomerPriceList, getMaterials } from '@/lib/queries';
import { CustomerPriceEditor } from '@/components/CustomerPriceEditor';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customer prices' };

/** /customers/[id]/prices: the customer's own sale rates and cost prices */
export default async function CustomerPricesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id, 'customer');
  if (!customer) notFound();
  const [rows, { materials }, available] = await Promise.all([getCustomerPriceList(id), getMaterials(), customerPricesAvailable()]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Prices · ${customer.name}`} description="This customer's own sale rates and cost prices" backHref={`/customers/${id}`} />

      {!available && (
        <p className={`${cardClass} px-4 py-3 text-sm text-amber-800`}>
          Customer prices need a database update: run{' '}
          <code className="font-mono text-xs">supabase/migrations/20261123000000_customer_prices.sql</code> in the Supabase SQL Editor.
        </p>
      )}

      <section className={`${cardClass} p-4 sm:p-5 text-sm text-zinc-600 space-y-1.5`}>
        <p>
          Leave a field empty to use the general rate or cost price. A sale rate set here is filled in on this customer&apos;s sale form;
          without one, the form uses the last rate they were charged.
        </p>
        <p>
          A cost price set here is used for this customer&apos;s sales in the profit estimate and in the item-wise and customer-wise
          margins, for example when their version of a product uses different material.
        </p>
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        <CustomerPriceEditor customerId={id} customerName={customer.name} rows={rows} materials={materials} />
      </section>
    </div>
  );
}
