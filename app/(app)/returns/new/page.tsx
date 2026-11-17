import type { Metadata } from 'next';
import { NewReturnView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New return' };

/** /returns/new (customer return) and /returns/new?side=vendor (vendor return) */
export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ side?: string }> }) {
  const kind = (await searchParams).side === 'vendor' ? 'vendor' : 'customer';
  return <NewReturnView kind={kind} backHref={kind === 'vendor' ? '/returns?side=vendor' : '/returns'} />;
}
