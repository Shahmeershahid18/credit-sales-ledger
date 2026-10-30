import type { Metadata } from 'next';
import { EditContactView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit vendor' };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditContactView kind="vendor" id={(await params).id} />;
}
