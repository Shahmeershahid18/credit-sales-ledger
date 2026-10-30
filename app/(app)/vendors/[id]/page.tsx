import type { Metadata } from 'next';
import { ContactLedgerView, contactMetadata } from '@/components/views/ContactLedgerView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return contactMetadata('vendor', (await params).id);
}

export default async function VendorLedgerPage({ params }: Props) {
  return <ContactLedgerView kind="vendor" id={(await params).id} />;
}
