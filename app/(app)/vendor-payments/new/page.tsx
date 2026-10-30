import type { Metadata } from 'next';
import { NewPaymentView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pay vendor' };

export default function NewPaymentPage() {
  return <NewPaymentView kind="vendor" />;
}
