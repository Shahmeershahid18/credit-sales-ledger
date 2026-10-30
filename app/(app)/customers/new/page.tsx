import type { Metadata } from 'next';
import { NewContactView } from '@/components/views/ContactFormViews';

export const metadata: Metadata = { title: 'New customer' };

export default function NewCustomerPage() {
  return <NewContactView kind="customer" />;
}
