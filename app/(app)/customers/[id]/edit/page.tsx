import type { Metadata } from 'next';
import { EditContactView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit customer' };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditContactView kind="customer" id={(await params).id} />;
}
