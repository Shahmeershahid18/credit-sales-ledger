import type { Metadata } from 'next';
import { NewEntryView } from '@/components/views/ContactFormViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New credit sale' };

export default function NewEntryPage() {
  return <NewEntryView kind="customer" />;
}
