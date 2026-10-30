import type { Metadata } from 'next';
import { NewContactView } from '@/components/views/ContactFormViews';

export const metadata: Metadata = { title: 'New vendor' };

export default function NewVendorPage() {
  return <NewContactView kind="vendor" />;
}
