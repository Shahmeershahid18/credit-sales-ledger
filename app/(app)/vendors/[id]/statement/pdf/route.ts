import type { NextRequest } from 'next/server';
import { statementPdfResponse } from '@/lib/pdf/statement-response';

export const dynamic = 'force-dynamic';

/** GET /vendors/[id]/statement/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return statementPdfResponse('vendor', (await params).id, request.nextUrl.searchParams);
}
