import type { Metadata } from 'next';
import { ContactLedgerView, contactMetadata } from '@/components/views/ContactLedgerView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return contactMetadata('customer', (await params).id);
}

export default async function CustomerLedgerPage({ params }: Props) {
  return <ContactLedgerView kind="customer" id={(await params).id} />;
}
