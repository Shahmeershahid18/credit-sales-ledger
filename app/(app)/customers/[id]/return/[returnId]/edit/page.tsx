import type { Metadata } from 'next';
import { EditReturnView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit customer return' };

export default async function EditCustomerReturnPage({ params }: { params: Promise<{ id: string; returnId: string }> }) {
  const { id, returnId } = await params;
  return <EditReturnView kind="customer" id={id} returnId={returnId} />;
}
