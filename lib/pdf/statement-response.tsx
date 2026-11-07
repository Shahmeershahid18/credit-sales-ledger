import 'server-only';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { getAuthState } from '@/lib/auth';
import { ContactKind } from '@/lib/contacts';
import { displayName, formatDate, getTodayDateStr } from '@/lib/format';
import { getCustomerById, getPartyStatement } from '@/lib/queries';
import { statementRange } from '@/lib/statement';
import { StatementDocument } from './StatementDocument';

/**
 * The party statement for ?from=YYYY-MM-DD&to=YYYY-MM-DD as a downloadable PDF, for
 * the ledger currently open. Used by /customers/[id]/statement/pdf and /vendors/[id]/statement/pdf.
 */
export async function statementPdfResponse(kind: ContactKind, id: string, params: URLSearchParams): Promise<Response> {
  const auth = await getAuthState();
  if (auth.mode === 'signed-out' || auth.mode === 'blocked') {
    return new Response('Please sign in to download statements.', { status: 401 });
  }

  const party = await getCustomerById(id, kind);
  if (!party) return new Response('Not found', { status: 404 });

  const range = statementRange({ from: params.get('from') ?? undefined, to: params.get('to') ?? undefined });
  const statement = await getPartyStatement(id, range.from, range.to);

  const pdf = await renderToBuffer(
    React.createElement(StatementDocument, {
      ledgerName: auth.mode === 'live' ? displayName(auth.owner) : 'Demo ledger',
      party: { name: party.name, phone: party.phone, address: party.address },
      statement,
      generatedOn: formatDate(getTodayDateStr()),
    }) as Parameters<typeof renderToBuffer>[0]
  );

  const safeName = party.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'party';
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="statement-${safeName}-${range.from}-to-${range.to}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
