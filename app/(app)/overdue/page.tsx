import type { Metadata } from 'next';
import { OverdueView } from '@/components/views/OverdueView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overdue' };

export default async function OverduePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  return <OverdueView kind="customer" days={(await searchParams).days} />;
}
