import type { Metadata } from 'next';
import { NewPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pay vendor' };

export default async function VendorPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewPaymentView kind="vendor" id={(await params).id} />;
}
