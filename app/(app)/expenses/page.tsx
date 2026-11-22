import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBusinessEntries } from '@/lib/queries';
import { formatDate, formatMonth, formatRs, nextMonthStart } from '@/lib/format';
import { ENTRY_TERMS, expensesByCategory } from '@/lib/profit';
import { parseReportParams } from '@/lib/report-params';
import { BusinessEntryKind } from '@/lib/types';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { StatCard } from '@/components/StatCard';
import { CsvExportButton } from '@/components/CsvExportButton';
import { TabNav } from '@/components/TabNav';
import { EmptyState, PageHeader, buttonClass, cardClass } from '@/components/ui';
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Receipt, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Expenses' };

interface ExpensesPageProps {
  // ?month=YYYY-MM (default) or ?year=YYYY, ?type=expense|investment|withdrawal
  searchParams: Promise<{ month?: string; year?: string; type?: string }>;
}

const TYPES = ['expense', 'investment', 'withdrawal'] as const;
const TYPE_TABS: { value: BusinessEntryKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'investment', label: 'Investment' },
  { value: 'withdrawal', label: 'Withdrawals' },
];

const KIND_STYLE: Record<BusinessEntryKind, string> = {
  expense: 'bg-rose-50 text-rose-700',
  investment: 'bg-emerald-50 text-emerald-700',
  withdrawal: 'bg-amber-50 text-amber-700',
};

/** Expenses, money the owner put in and money the owner took out, by month or year */
export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const raw = await searchParams;
  const { yearly, year, month, thisMonth, thisYear } = parseReportParams({ month: raw.month, year: raw.year });
  const type = (TYPES as readonly string[]).includes(raw.type ?? '') ? (raw.type as BusinessEntryKind) : 'all';

  const start = yearly ? `${year}-01-01` : `${month}-01`;
  const end = yearly ? `${year + 1}-01-01` : nextMonthStart(month);
  const all = await getBusinessEntries(start, end);
  const entries = type === 'all' ? all : all.filter((e) => e.kind === type);

  const sumOf = (kind: BusinessEntryKind) => all.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  const expenses = sumOf('expense');
  const invested = sumOf('investment');
  const withdrawn = sumOf('withdrawal');
  // Every month of the period has the same "YYYY" or "YYYY-MM" prefix, so one call covers a year too
  const categories = expensesByCategory(yearly ? String(year) : month, all);
  const shownTotal = entries.reduce((s, e) => s + e.amount, 0);

  const periodParam = yearly ? `year=${year}` : `month=${month}`;
  const href = (o: { type?: string; period?: string }) => {
    const q = new URLSearchParams();
    const [k, v] = (o.period ?? periodParam).split('=');
    q.set(k, v);
    const t = o.type ?? type;
    if (t !== 'all') q.set('type', t);
    return `/expenses?${q.toString()}`;
  };
  const typeQuery = type === 'all' ? undefined : `type=${type}`;
  const periodName = yearly ? `${year}${year === thisYear ? ' so far' : ''}` : formatMonth(month);
  const newHref = (k: BusinessEntryKind) => `/expenses/new${k === 'expense' ? '' : `?type=${k}`}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses and capital"
        description={`Running costs, and money you put in or took out · ${periodName}`}
        actions={
          <>
            {yearly ? (
              <YearPicker year={year} thisYear={thisYear} query={typeQuery} basePath="/expenses" />
            ) : (
              <MonthPicker currentMonth={month} query={typeQuery} basePath="/expenses" />
            )}
            <CsvExportButton
              filename={`expenses-${yearly ? year : month}${type === 'all' ? '' : `-${type}`}`}
              headers={['Date', 'Type', 'Category', 'Note', 'Amount']}
              rows={entries.map((e) => [e.entry_date, ENTRY_TERMS[e.kind].label, e.category ?? '', e.notes ?? '', e.amount])}
              disabled={entries.length === 0}
            />
            <Link href={newHref(type === 'all' ? 'expense' : type)} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              {type === 'investment' ? 'Add investment' : type === 'withdrawal' ? 'Add withdrawal' : 'Add expense'}
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <TabNav label="Entry type" items={TYPE_TABS.map((t) => ({ label: t.label, href: href({ type: t.value }), active: t.value === type }))} />
        <TabNav
          label="Period"
          items={[
            { label: 'Monthly', href: href({ period: `month=${yearly ? (year === thisYear ? thisMonth : `${year}-12`) : month}` }), active: !yearly },
            { label: 'Yearly', href: href({ period: `year=${year}` }), active: yearly },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Expenses" value={formatRs(expenses)} icon={Receipt} variant={expenses > 0 ? 'danger' : 'default'} subtext="Taken off your profit" />
        <StatCard label="Owner investment" value={formatRs(invested)} icon={ArrowDownToLine} subtext="Money you put in (not income)" />
        <StatCard
          label="Owner withdrawals"
          value={formatRs(withdrawn)}
          icon={ArrowUpFromLine}
          className="col-span-2 xl:col-span-1"
          subtext="Money you took out (not an expense)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <section className={`${cardClass} overflow-hidden lg:col-span-2`}>
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">{type === 'all' ? 'All entries' : TYPE_TABS.find((t) => t.value === type)!.label}</h2>
            <span className="text-xs text-zinc-500">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title={`Nothing recorded in ${periodName}`}
              description="Record rent, salaries, bills and other costs as expenses, and money you put in or take out as investment or withdrawal."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {TYPES.map((k) => (
                    <Link key={k} href={newHref(k)} className={buttonClass(k === 'expense' ? 'primary' : 'secondary')}>
                      <Plus className="w-4 h-4" />
                      {ENTRY_TERMS[k].label}
                    </Link>
                  ))}
                </div>
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {entries.map((e) => (
                <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${KIND_STYLE[e.kind]}`}>{ENTRY_TERMS[e.kind].label}</span>
                      <span className="text-sm font-medium text-zinc-900">{e.category ?? (e.kind === 'investment' ? 'Money put in' : 'Money taken out')}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">
                      {formatDate(e.entry_date)}
                      {e.notes && ` · ${e.notes}`}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                      e.kind === 'expense' ? 'text-rose-700' : e.kind === 'investment' ? 'text-emerald-700' : 'text-zinc-900'
                    }`}
                  >
                    {formatRs(e.amount)}
                  </span>
                  <Link
                    href={`/expenses/${e.id}/edit`}
                    aria-label={`Edit ${ENTRY_TERMS[e.kind].one} of ${formatRs(e.amount)} on ${formatDate(e.entry_date)}`}
                    className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </li>
              ))}
              {type !== 'all' && (
                <li className="px-4 py-3 flex justify-between bg-zinc-50 text-sm font-semibold text-zinc-900">
                  <span>Total</span>
                  <span className="tabular-nums mr-11">{formatRs(shownTotal)}</span>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className={`${cardClass} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Expenses by category</h2>
          </div>
          {categories.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">No expenses in {periodName}.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <li key={c.category} className="px-4 py-2.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-zinc-700 truncate">{c.category}</span>
                    <span className="font-medium text-zinc-900 tabular-nums">{formatRs(c.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(2, (c.amount / expenses) * 100)}%` }} />
                  </div>
                </li>
              ))}
              <li className="px-4 py-2.5 flex justify-between bg-zinc-50 text-sm font-semibold text-zinc-900">
                <span>Total</span>
                <span className="tabular-nums">{formatRs(expenses)}</span>
              </li>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
