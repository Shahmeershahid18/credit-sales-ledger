import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getReturns } from '@/lib/queries';
import { SIDES } from '@/lib/contacts';
import { formatDate, formatMonth, formatRs, nextMonthStart } from '@/lib/format';
import { parseReportParams, type ReportSearchParams } from '@/lib/report-params';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import { EmptyState, PageHeader, buttonClass, cardClass } from '@/components/ui';
import { Plus, Undo2, Users, Hash } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Returns' };

interface ReturnsPageProps {
  // ?month=YYYY-MM (default) or ?year=YYYY, ?side=vendor, ?view=party
  searchParams: Promise<ReportSearchParams & { view?: string }>;
}

const SIDE_LABELS = { customer: 'Customer returns', vendor: 'Vendor returns' } as const;

function TabNav({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 p-1 rounded-lg bg-zinc-100 w-fit">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`h-8 px-3 sm:px-4 rounded-md text-sm font-medium flex items-center whitespace-nowrap ${
            item.active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Customer returns and vendor returns for a month or a year, date-wise (every return)
 * or party-wise (totals per customer or vendor)
 */
export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const raw = await searchParams;
  const params = parseReportParams(raw);
  const { kind, yearly, thisMonth, thisYear, year, month } = params;
  const byParty = raw.view === 'party';
  const terms = SIDES[kind];

  const start = yearly ? `${year}-01-01` : `${month}-01`;
  const end = yearly ? `${year + 1}-01-01` : nextMonthStart(month);
  const returns = await getReturns(kind, start, end);

  const total = returns.reduce((s, r) => s + r.amount, 0);
  const parties = [
    ...returns
      .reduce((map, r) => {
        const p = map.get(r.partyId) ?? { id: r.partyId, name: r.partyName, count: 0, total: 0, last: r.date };
        p.count += 1;
        p.total += r.amount;
        if (r.date > p.last) p.last = r.date;
        return map.set(r.partyId, p);
      }, new Map<string, { id: string; name: string; count: number; total: number; last: string }>())
      .values(),
  ].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Links keep the other choices
  const href = (o: { side?: string; period?: string; view?: string }) => {
    const q = new URLSearchParams();
    const side = o.side ?? kind;
    if (side === 'vendor') q.set('side', 'vendor');
    const [k, v] = (o.period ?? (yearly ? `year=${year}` : `month=${month}`)).split('=');
    q.set(k, v);
    if ((o.view ?? (byParty ? 'party' : 'date')) === 'party') q.set('view', 'party');
    return `/returns?${q.toString()}`;
  };
  const sideQuery = [kind === 'vendor' ? 'side=vendor' : '', byParty ? 'view=party' : ''].filter(Boolean).join('&') || undefined;
  const periodName = yearly ? `${year}${year === thisYear ? ' so far' : ''}` : formatMonth(month);
  const fileTag = `${kind === 'vendor' ? 'vendor' : 'customer'}-returns-${yearly ? year : month}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description={`${SIDE_LABELS[kind]} · ${periodName}`}
        actions={
          <>
            {yearly ? (
              <YearPicker year={year} thisYear={thisYear} query={sideQuery} basePath="/returns" />
            ) : (
              <MonthPicker currentMonth={month} query={sideQuery} basePath="/returns" />
            )}
            {byParty ? (
              <CsvExportButton
                filename={`${fileTag}-by-${terms.one}`}
                headers={[terms.One, 'Returns', 'Last return', 'Amount']}
                rows={parties.map((p) => [p.name, p.count, p.last, p.total])}
                disabled={parties.length === 0}
              />
            ) : (
              <CsvExportButton
                filename={`${fileTag}-by-date`}
                headers={['Date', terms.One, `Returned from ${terms.entry}`, 'Reason', 'Amount']}
                rows={returns.map((r) => [r.date, r.partyName, r.against ?? '', r.reason, r.amount])}
                disabled={returns.length === 0}
              />
            )}
            <Link href={kind === 'vendor' ? '/returns/new?side=vendor' : '/returns/new'} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              {kind === 'vendor' ? 'Vendor return' : 'Customer return'}
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <TabNav
          label="Return side"
          items={(['customer', 'vendor'] as const).map((k) => ({ label: SIDE_LABELS[k], href: href({ side: k }), active: k === kind }))}
        />
        <TabNav
          label="Report period"
          items={[
            { label: 'Monthly', href: href({ period: `month=${yearly ? (year === thisYear ? thisMonth : `${year}-12`) : month}` }), active: !yearly },
            { label: 'Yearly', href: href({ period: `year=${year}` }), active: yearly },
          ]}
        />
        <TabNav
          label="Report view"
          items={[
            { label: 'Date-wise', href: href({ view: 'date' }), active: !byParty },
            { label: `${terms.One}-wise`, href: href({ view: 'party' }), active: byParty },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total returned"
          value={formatRs(total)}
          icon={Undo2}
          subtext={kind === 'vendor' ? 'Taken off what you owe' : 'Taken off what customers owe'}
        />
        <StatCard label="Returns" value={String(returns.length)} icon={Hash} />
        <StatCard label={terms.Many} value={String(parties.length)} icon={Users} subtext={`With a return this ${yearly ? 'year' : 'month'}`} />
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{byParty ? `By ${terms.one}` : 'By date'}</h2>
          <span className="text-xs text-zinc-500">
            {byParty ? `${parties.length} ${parties.length === 1 ? terms.one : terms.many}` : `${returns.length} ${returns.length === 1 ? 'return' : 'returns'}`}
          </span>
        </div>

        {returns.length === 0 ? (
          <EmptyState
            icon={<Undo2 className="w-5 h-5" />}
            title={`No ${SIDE_LABELS[kind].toLowerCase()} in ${periodName}`}
            description={
              kind === 'vendor'
                ? 'Goods you send back to a vendor are recorded here and taken off what you owe them.'
                : 'Goods a customer sends back are recorded here and taken off what they owe you.'
            }
          />
        ) : byParty ? (
          <>
            <ul className="md:hidden divide-y divide-zinc-100">
              {parties.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`${terms.base}/${p.id}`} className="font-medium text-zinc-900 hover:text-emerald-700 block truncate">
                      {p.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {p.count} {p.count === 1 ? 'return' : 'returns'} · last {formatDate(p.last)}
                    </p>
                  </div>
                  <span className="font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{formatRs(p.total)}</span>
                </li>
              ))}
              <li className="px-4 py-3 flex justify-between bg-zinc-50 font-semibold text-zinc-900">
                <span>Total</span>
                <span className="tabular-nums">{formatRs(total)}</span>
              </li>
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2.5 px-4">{terms.One}</th>
                    <th className="py-2.5 px-4 text-right">Returns</th>
                    <th className="py-2.5 px-4">Last return</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {parties.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4">
                        <Link href={`${terms.base}/${p.id}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-zinc-700">{p.count}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-700">{formatDate(p.last)}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-zinc-900">{formatRs(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right tabular-nums">{returns.length}</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right tabular-nums">{formatRs(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-zinc-100">
              {returns.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`${terms.base}/${r.partyId}`} className="font-medium text-zinc-900 hover:text-emerald-700 block truncate">
                        {r.partyName}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {formatDate(r.date)}
                        {r.against && ` · from ${r.against}`}
                      </p>
                    </div>
                    <span className="font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{formatRs(r.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{r.reason}</p>
                </li>
              ))}
              <li className="px-4 py-3 flex justify-between bg-zinc-50 font-semibold text-zinc-900">
                <span>Total</span>
                <span className="tabular-nums">{formatRs(total)}</span>
              </li>
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">{terms.One}</th>
                    <th className="py-2.5 px-4">Returned from</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {returns.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-700">{formatDate(r.date)}</td>
                      <td className="py-3 px-4">
                        <Link href={`${terms.base}/${r.partyId}`} className="font-medium text-zinc-900 hover:text-emerald-700">
                          {r.partyName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-zinc-700">{r.against ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="py-3 px-4 text-zinc-700 max-w-[280px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-zinc-900">{formatRs(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
                    <td className="py-3 px-4" colSpan={4}>
                      Total
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatRs(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
