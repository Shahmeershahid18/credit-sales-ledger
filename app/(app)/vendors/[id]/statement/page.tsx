import type { Metadata } from 'next';
import { StatementView, statementMetadata } from '@/components/views/StatementView';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return statementMetadata('vendor', (await params).id);
}

export default async function VendorStatementPage({ params, searchParams }: Props) {
  const [{ id }, { from, to }] = await Promise.all([params, searchParams]);
  return <StatementView kind="vendor" id={id} from={from} to={to} />;
}
