import type { Metadata } from 'next';
import { NewReturnView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vendor return' };

export default async function VendorReturnPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewReturnView kind="vendor" id={(await params).id} />;
}
