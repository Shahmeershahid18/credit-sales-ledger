import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMaterials, getStockCount, getStockCounts } from '@/lib/queries';
import { formatMonth, getCurrentMonthStr, isValidMonthStr, shiftMonth } from '@/lib/format';
import { StockCountForm } from '@/components/StockCountForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Stock count' };

/** /stock/2026-11: the stock in hand at the end of that month */
export default async function StockCountPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!isValidMonthStr(month) || month > getCurrentMonthStr()) notFound();

  const [count, counts, { materials }] = await Promise.all([getStockCount(month), getStockCounts(), getMaterials()]);
  // A new count starts from the latest earlier count's items and rates
  const earlier = count ? null : counts.find((c) => c.month < month) ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`Closing stock · ${formatMonth(month)}`}
        description={`Stock in hand at the end of ${formatMonth(month)}. It is also the opening stock of ${formatMonth(shiftMonth(month, 1))}.`}
        backHref="/stock"
      />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <StockCountForm
          month={month}
          count={count}
          template={earlier?.items ?? []}
          templateMonth={earlier?.month ?? null}
          materials={materials.map(({ name, unit, rate, purchase_rate, cost_price }) => ({ name, unit, rate, purchase_rate, cost_price }))}
        />
      </div>
    </div>
  );
}
