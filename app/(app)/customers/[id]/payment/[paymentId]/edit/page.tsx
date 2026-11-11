import type { Metadata } from 'next';
import { EditPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit payment received' };

export default async function EditPaymentReceivedPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  return <EditPaymentView kind="customer" id={id} paymentId={paymentId} />;
}
