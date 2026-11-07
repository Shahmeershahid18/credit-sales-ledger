import type { NextRequest } from 'next/server';
import { statementPdfResponse } from '@/lib/pdf/statement-response';

export const dynamic = 'force-dynamic';

/** GET /customers/[id]/statement/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return statementPdfResponse('customer', (await params).id, request.nextUrl.searchParams);
}
