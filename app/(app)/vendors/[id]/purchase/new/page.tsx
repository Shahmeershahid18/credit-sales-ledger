import type { Metadata } from 'next';
import { NewEntryView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New credit purchase' };

export default async function VendorEntryPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewEntryView kind="vendor" id={(await params).id} />;
}
