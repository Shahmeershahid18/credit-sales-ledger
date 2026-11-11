import type { Metadata } from 'next';
import { EditEntryView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit sale' };

export default async function EditSalePage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  return <EditEntryView kind="customer" id={id} entryId={entryId} />;
}
