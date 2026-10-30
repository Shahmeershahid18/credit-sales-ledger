import type { Metadata } from 'next';
import { ContactsView } from '@/components/views/ContactsView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vendors' };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  return <ContactsView kind="vendor" q={q} status={status} />;
}
