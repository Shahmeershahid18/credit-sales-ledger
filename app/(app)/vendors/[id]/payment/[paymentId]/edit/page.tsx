import type { Metadata } from 'next';
import { EditPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit payment made' };

export default async function EditPaymentMadePage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  return <EditPaymentView kind="vendor" id={id} paymentId={paymentId} />;
}
