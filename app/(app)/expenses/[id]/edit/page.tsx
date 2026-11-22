import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBusinessEntryById, getExpenseCategories } from '@/lib/queries';
import { ENTRY_TERMS } from '@/lib/profit';
import { BusinessEntryForm } from '@/components/BusinessEntryForm';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit entry' };

export default async function EditBusinessEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, categories] = await Promise.all([getBusinessEntryById(id), getExpenseCategories()]);
  if (!entry) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={`Edit ${ENTRY_TERMS[entry.kind].one}`}
        description="Correct the entry, or delete it"
        backHref={`/expenses?month=${entry.entry_date.slice(0, 7)}`}
      />
      <div className={`${cardClass} p-5 sm:p-6`}>
        <BusinessEntryForm kind={entry.kind} entry={entry} categories={categories} />
      </div>
    </div>
  );
}
