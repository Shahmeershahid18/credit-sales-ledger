import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { getAuthState } from '@/lib/auth';
import { getCustomerById, getPartyLedger } from '@/lib/queries';
import { buildPartyStatement } from '@/lib/store';
import { ContactKind, SIDES } from '@/lib/contacts';
import { balanceLabel, displayName, formatBalance, formatDate, formatRs, getTodayDateStr } from '@/lib/format';
import { statementDetails, statementPresets, statementQuery, statementRange } from '@/lib/statement';
import { LogoMark } from '@/components/Logo';
import { PrintButton } from '@/components/PrintButton';
import { PageHeader, buttonClass, cardClass, inputClass } from '@/components/ui';

export async function statementMetadata(kind: ContactKind, id: string): Promise<Metadata> {
  const contact = await getCustomerById(id, kind);
  return { title: contact ? `Statement · ${contact.name}` : 'Statement' };
}

/**
 * A party's statement for any period (/customers/[id]/statement, /vendors/[id]/statement):
 * opening balance, every entry with debit, credit and balance, and the closing balance.
 * Prints cleanly and downloads as PDF.
 */
export async function StatementView({ kind, id, from, to }: { kind: ContactKind; id: string; from?: string; to?: string }) {
  const terms = SIDES[kind];
  const [contact, auth] = await Promise.all([getCustomerById(id, kind), getAuthState()]);
  if (!contact) notFound();

  const range = statementRange({ from, to });
  const ledger = await getPartyLedger(id);
  const statement = buildPartyStatement(ledger, range.from, range.to);
  const href = `${terms.base}/${id}`;
  const presets = statementPresets(ledger.rows[0]?.date ?? null);
  const ledgerName = auth.mode === 'live' ? displayName(auth.owner) : 'Demo ledger';
  const closingLabel = balanceLabel(statement.closing);

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="print:hidden space-y-4">
        <PageHeader
          title="Statement"
          description={contact.name}
          backHref={href}
          actions={
            <>
              <PrintButton />
              <a href={`${href}/statement/pdf?${statementQuery(range)}`} className={buttonClass('primary')}>
                <FileDown className="w-4 h-4" />
                Download PDF
              </a>
            </>
          }
        />

        <div className={`${cardClass} p-3 sm:p-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between`}>
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium text-zinc-600">From</span>
              <input type="date" name="from" defaultValue={range.from} className={`${inputClass} h-9 w-40`} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-zinc-600">To</span>
              <input type="date" name="to" defaultValue={range.to} className={`${inputClass} h-9 w-40`} />
            </label>
            <button type="submit" className={buttonClass('primary', 'h-9')}>
              Show
            </button>
          </form>
          <nav aria-label="Quick periods" className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 self-start lg:self-auto">
            {presets.map((p) => {
              const active = p.from === range.from && p.to === range.to;
              return (
                <Link
                  key={p.label}
                  href={`${href}/statement?${statementQuery(p)}`}
                  aria-current={active ? 'page' : undefined}
                  className={`h-7 px-3 rounded-md text-xs font-medium flex items-center ${
                    active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* The statement sheet: what is printed */}
      <article className={`${cardClass} p-5 sm:p-8 print:border-0 print:shadow-none print:p-0`}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark className="w-7 h-7" />
              <span className="text-sm font-semibold text-zinc-900">{ledgerName}</span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">Account statement</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {formatDate(range.from)} – {formatDate(range.to)}
            </p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold text-zinc-900">{contact.name}</p>
            {contact.phone && <p className="text-zinc-600">{contact.phone}</p>}
            {contact.address && <p className="text-zinc-600">{contact.address}</p>}
            <p className="text-xs text-zinc-400 mt-1">Generated {formatDate(getTodayDateStr())}</p>
          </div>
        </header>

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Figure label="Opening balance" value={formatBalance(statement.opening)} />
          <Figure label="Total debit" value={formatRs(statement.totalDebit)} />
          <Figure label="Total credit" value={formatRs(statement.totalCredit)} />
          <Figure
            label={closingLabel === 'Settled' ? 'Closing balance' : `Closing balance (${closingLabel.toLowerCase()})`}
            value={formatBalance(statement.closing)}
            strong
          />
        </dl>

        {/* Phones: one entry per row */}
        <ul className="mt-6 md:hidden print:hidden divide-y divide-zinc-100 border-y border-zinc-200 text-sm">
          <li className="py-2.5 flex items-baseline justify-between gap-3">
            <span className="font-medium text-zinc-700">Opening balance · {formatDate(range.from)}</span>
            <span className="tabular-nums font-medium text-zinc-900 whitespace-nowrap">{formatBalance(statement.opening)}</span>
          </li>
          {statement.rows.map((row) => (
            <li key={row.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-zinc-900 min-w-0">{statementDetails(row)}</p>
                <p className="tabular-nums font-medium whitespace-nowrap text-zinc-900">
                  {row.debit > 0 ? `${formatRs(row.debit)} Dr` : row.credit > 0 ? `${formatRs(row.credit)} Cr` : '—'}
                </p>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-zinc-500">
                <span>
                  {formatDate(row.date)}
                  {row.due_date && ` · due ${formatDate(row.due_date)}`}
                  {row.notes && ` · ${row.notes}`}
                </span>
                <span className="whitespace-nowrap">
                  Balance <span className="font-medium text-zinc-900 tabular-nums">{formatBalance(row.balance)}</span>
                </span>
              </div>
            </li>
          ))}
          {statement.rows.length === 0 && <li className="py-6 text-center text-zinc-500">No entries in this period.</li>}
          <li className="py-3 flex items-baseline justify-between gap-3 font-semibold text-zinc-900">
            <span>Closing balance</span>
            <span className="tabular-nums whitespace-nowrap">{formatBalance(statement.closing)}</span>
          </li>
        </ul>

        {/* Wider screens and print: full table */}
        <div className="mt-6 overflow-x-auto hidden md:block print:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-xs font-medium text-zinc-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Details</th>
                <th className="py-2 px-3 text-right">Debit</th>
                <th className="py-2 px-3 text-right">Credit</th>
                <th className="py-2 pl-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr className="text-zinc-600">
                <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(range.from)}</td>
                <td className="py-2.5 pr-3 font-medium">Opening balance</td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3" />
                <td className="py-2.5 pl-3 text-right whitespace-nowrap tabular-nums font-medium text-zinc-900">
                  {formatBalance(statement.opening)}
                </td>
              </tr>
              {statement.rows.map((row) => (
                <tr key={row.id} className="break-inside-avoid">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-zinc-700 align-top">{formatDate(row.date)}</td>
                  <td className="py-2.5 pr-3 text-zinc-900 align-top">
                    {statementDetails(row)}
                    {row.due_date && <span className="block text-xs text-zinc-500">Due {formatDate(row.due_date)}</span>}
                    {row.notes && <span className="block text-xs text-zinc-500">{row.notes}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums align-top">{row.debit > 0 ? formatRs(row.debit) : '—'}</td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums align-top">{row.credit > 0 ? formatRs(row.credit) : '—'}</td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap tabular-nums font-medium text-zinc-900 align-top">
                    {formatBalance(row.balance)}
                  </td>
                </tr>
              ))}
              {statement.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500">
                    No entries in this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-300 font-semibold text-zinc-900">
                <td className="py-3 pr-3" colSpan={2}>
                  Closing balance
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">{formatRs(statement.totalDebit)}</td>
                <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">{formatRs(statement.totalCredit)}</td>
                <td className="py-3 pl-3 text-right whitespace-nowrap tabular-nums">{formatBalance(statement.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p
          className={`mt-6 px-4 py-3 rounded-lg text-sm font-medium ${
            closingLabel === 'Receivable'
              ? 'bg-emerald-50 text-emerald-800'
              : closingLabel === 'Payable'
              ? 'bg-rose-50 text-rose-800'
              : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          {closingLabel === 'Receivable'
            ? `${contact.name} owes ${formatRs(statement.closing)} as of ${formatDate(range.to)}.`
            : closingLabel === 'Payable'
            ? `${formatRs(-statement.closing)} is payable to ${contact.name} as of ${formatDate(range.to)}.`
            : `Nothing is owed either way as of ${formatDate(range.to)}.`}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Debit: sales, and payments made to the party. Credit: purchases, and payments received from the party. Dr balance =
          receivable, Cr balance = payable.
        </p>
      </article>
    </div>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? 'border-zinc-900' : 'border-zinc-200'}`}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? 'text-base font-semibold text-zinc-900' : 'text-sm font-medium text-zinc-900'}`}>{value}</dd>
    </div>
  );
}
