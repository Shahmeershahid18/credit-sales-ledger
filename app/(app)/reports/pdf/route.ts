import React from 'react';
import type { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getAuthState } from '@/lib/auth';
import { SIDES } from '@/lib/contacts';
import { displayName, formatDate, getTodayDateStr, monthRange, shiftMonth } from '@/lib/format';
import { getMonthFlows, getMonthlyReportData, getYearlyReportData } from '@/lib/queries';
import { parseReportParams } from '@/lib/report-params';
import { ReportDocument, type ReportPdfData } from '@/lib/pdf/ReportDocument';

export const dynamic = 'force-dynamic';

const TREND_MONTHS = 6; // months shown in a monthly report's chart

/**
 * GET /reports/pdf?month=YYYY-MM | ?year=YYYY [&side=vendor]
 * The report page's figures as a downloadable PDF, for the ledger currently open.
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthState();
  if (auth.mode === 'signed-out' || auth.mode === 'blocked') {
    return new Response('Please sign in to download reports.', { status: 401 });
  }

  const q = request.nextUrl.searchParams;
  const p = parseReportParams({ month: q.get('month') ?? undefined, year: q.get('year') ?? undefined, side: q.get('side') ?? undefined });
  const terms = SIDES[p.kind];
  const vendor = p.kind === 'vendor';

  const months = p.yearly
    ? monthRange(`${p.year}-01`, p.year === p.thisYear ? p.thisMonth : `${p.year}-12`)
    : monthRange(shiftMonth(p.month, -(TREND_MONTHS - 1)), p.month);

  const [report, flows] = await Promise.all([
    p.yearly ? getYearlyReportData(p.kind, String(p.year)) : getMonthlyReportData(p.kind, p.month),
    getMonthFlows(months[0], months[months.length - 1]),
  ]);

  const today = getTodayDateStr();
  const data: ReportPdfData = {
    side: p.kind,
    yearly: p.yearly,
    title: vendor ? 'Purchases report' : 'Sales report',
    periodLabel: p.yearly ? `Year ${p.year}${p.year === p.thisYear ? ` (to ${formatDate(today)})` : ''}` : report.formattedMonth,
    ledgerName: auth.mode === 'live' ? displayName(auth.owner) : 'Demo ledger',
    generatedOn: formatDate(today),
    report,
    trend: flows.map((f) => ({ month: f.month, billed: vendor ? f.purchased : f.sold, cash: vendor ? f.paid : f.received })),
    highlightMonth: p.yearly ? undefined : p.month,
    labels: vendor
      ? { one: terms.One, many: terms.many, entries: 'purchases', billed: 'Purchased', billedLong: 'Material purchased', cash: 'Paid', cashLong: 'Payment made', remaining: 'Payable remaining', net: 'Net' }
      : { one: terms.One, many: terms.many, entries: 'sales', billed: 'Sold', billedLong: 'Material sold', cash: 'Received', cashLong: 'Payment received', remaining: 'Balance remaining', net: 'Net' },
  };

  const pdf = await renderToBuffer(React.createElement(ReportDocument, data) as Parameters<typeof renderToBuffer>[0]);
  const filename = `credit-ledger-${vendor ? 'purchases' : 'sales'}-report-${p.period}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
