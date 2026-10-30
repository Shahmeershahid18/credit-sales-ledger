import type { Metadata } from 'next';
import { NewPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Record payment' };

export default async function CustomerPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewPaymentView kind="customer" id={(await params).id} />;
}
