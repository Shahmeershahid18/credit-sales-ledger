import type { Metadata } from 'next';
import { NewPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Record payment' };

export default function NewPaymentPage() {
  return <NewPaymentView kind="customer" />;
}
