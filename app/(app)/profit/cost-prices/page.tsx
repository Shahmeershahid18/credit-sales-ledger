import Link from 'next/link';
import type { Metadata } from 'next';
import { getMaterials, getQuantityHistory } from '@/lib/queries';
import { getCurrentMonthStr, shiftMonth } from '@/lib/format';
import { convertQuantity } from '@/lib/profit';
import { CostPriceEditor } from '@/components/CostPriceEditor';
import { EmptyState, PageHeader, buttonClass, cardClass } from '@/components/ui';
import { Tags } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cost prices' };

/** Item-wise cost price: what one unit of each product costs you to make */
export default async function CostPricesPage() {
  const thisMonth = getCurrentMonthStr();
  const [{ materials, available }, history] = await Promise.all([
    getMaterials(),
    getQuantityHistory('customer', shiftMonth(thisMonth, -2), thisMonth),
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
        price and the other way round.
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
    </div>
  );
}
