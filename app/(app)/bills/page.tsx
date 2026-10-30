import type { Metadata } from 'next';
import { OverdueView } from '@/components/views/OverdueView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bills to pay' };

export default async function BillstopayPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  return <OverdueView kind="vendor" days={(await searchParams).days} />;
}
