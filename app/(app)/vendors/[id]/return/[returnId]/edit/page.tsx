import type { Metadata } from 'next';
import { EditReturnView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit vendor return' };

export default async function EditVendorReturnPage({ params }: { params: Promise<{ id: string; returnId: string }> }) {
  const { id, returnId } = await params;
  return <EditReturnView kind="vendor" id={id} returnId={returnId} />;
}
