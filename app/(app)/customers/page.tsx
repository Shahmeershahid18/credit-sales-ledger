import type { Metadata } from 'next';
import { ContactsView } from '@/components/views/ContactsView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  return <ContactsView kind="customer" q={q} status={status} />;
}
