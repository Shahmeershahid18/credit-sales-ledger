import type { Metadata } from 'next';
import { EditEntryView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit purchase' };

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  return <EditEntryView kind="vendor" id={id} entryId={entryId} />;
}
