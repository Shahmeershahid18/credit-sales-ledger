import type { Metadata } from 'next';
import { getExpenseCategories } from '@/lib/queries';
import { ENTRY_TERMS } from '@/lib/profit';
import { BusinessEntryKind } from '@/lib/types';
import { BusinessEntryForm } from '@/components/BusinessEntryForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New expense' };

/** /expenses/new (expense), ?type=investment or ?type=withdrawal */
export default async function NewBusinessEntryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const kind: BusinessEntryKind = type === 'investment' || type === 'withdrawal' ? type : 'expense';
  const categories = await getExpenseCategories();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title={`New ${ENTRY_TERMS[kind].one}`} description="Expense, owner investment or owner withdrawal" backHref="/expenses" />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <BusinessEntryForm kind={kind} categories={categories} />
      </div>
    </div>
  );
}
