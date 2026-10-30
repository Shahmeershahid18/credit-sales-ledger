import type { Metadata } from 'next';
import { NewEntryView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New credit sale' };

export default async function CustomerEntryPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewEntryView kind="customer" id={(await params).id} />;
}
