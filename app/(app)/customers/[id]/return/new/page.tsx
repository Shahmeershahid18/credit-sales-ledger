import type { Metadata } from 'next';
import { NewReturnView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customer return' };

export default async function CustomerReturnPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewReturnView kind="customer" id={(await params).id} />;
}
