import Link from 'next/link';
import type { Metadata } from 'next';
import { getCustomers, getCustomersWithPrices, getMaterials, getQuantityHistory } from '@/lib/queries';
import { getCurrentMonthStr, shiftMonth } from '@/lib/format';
import { convertQuantity } from '@/lib/profit';
import { CostPriceEditor } from '@/components/CostPriceEditor';
import { CustomerPicker } from '@/components/CustomerPicker';
import { EmptyState, PageHeader, buttonClass, cardClass } from '@/components/ui';
import { Tags } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cost prices' };

/** Item-wise cost price: what one unit of each product costs you to make */
export default async function CostPricesPage() {
  const thisMonth = getCurrentMonthStr();
  const [{ materials, available }, history, priced, customers] = await Promise.all([
    getMaterials(),
    getQuantityHistory('customer', shiftMonth(thisMonth, -2), thisMonth),
    getCustomersWithPrices(),
    getCustomers('customer'),
  ]);

  // Quantity sold in the last 3 months, in each saved product's own unit
  const units = new Map(materials.map((m) => [m.name.trim().toLowerCase(), m.unit]));
  const sold: Record<string, number> = {};
  for (const q of history.materials) {
    const key = q.name.trim().toLowerCase();
    const unit = units.get(key);
    const qty = unit ? convertQuantity(q.total, q.unit, unit) : null;
    if (qty !== null) sold[key] = (sold[key] ?? 0) + qty;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost prices"
        description="What one unit of each product costs you to make: raw material, labour, power and other direct costs"
        backHref="/profit"
      />

      <section className={`${cardClass} p-4 sm:p-5 text-sm text-zinc-600`}>
        Cost prices give the <span className="font-medium text-zinc-900">item-wise margin</span> on the Profit page, and estimate the
        cost of what you sold in a month until that month&apos;s closing stock is counted. Sales in kg are costed with a per-ton cost
        price and the other way round. These are the <span className="font-medium text-zinc-900">general</span> cost prices; a
        customer whose product is made differently can have their own (below).
        <span className="block mt-1.5">
          Each sale saves its own rate and cost when it is recorded, so changing a price here affects new sales only; past months
          keep their profit. To correct one sale, edit it. Sales recorded before costs were saved with sales use the current cost
          price until they are edited.
        </span>
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        {!available || materials.length === 0 ? (
          <EmptyState
            icon={<Tags className="w-5 h-5" />}
            title="No saved products yet"
            description="Products are saved automatically when you record a sale. Then set their cost prices here."
            action={
              <Link href="/sales/new" className={buttonClass('primary')}>
                New sale
              </Link>
            }
          />
        ) : (
          <CostPriceEditor materials={materials} sold={sold} />
        )}
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Customer-specific prices</h2>
            <p className="text-xs text-zinc-500 mt-0.5">A customer&apos;s own sale rate and cost price win over the general ones</p>
          </div>
          <div className="sm:w-64">
            <CustomerPicker customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </div>
        {priced.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500 text-center">No customer has their own prices yet. Pick a customer to set them.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {priced.map((c) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}/prices`} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50">
                  <span className="text-sm font-medium text-zinc-900">{c.name}</span>
                  <span className="text-xs text-zinc-500">
                    {c.count} {c.count === 1 ? 'product' : 'products'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
