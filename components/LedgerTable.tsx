'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PartyLedgerRow } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatBalance, formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { EmptyState, Segmented, buttonClass } from './ui';
import { Search, FileSpreadsheet, ArrowDownUp, Plus } from 'lucide-react';

interface LedgerTableProps {
  rows: PartyLedgerRow[]; // chronological order, with the running balance
  partyId: string;
  kind: ContactKind; // the side the page was opened from
  roles: { customer: boolean; vendor: boolean };
}

type TypeFilter = 'all' | 'sale' | 'purchase' | 'payment';

const METHOD: Record<string, string> = { cash: 'Cash', bank: 'Bank', cheque: 'Cheque' };

function title(row: PartyLedgerRow) {
  switch (row.type) {
    case 'sale':
    case 'purchase':
      return row.material ?? '';
    case 'received':
      return 'Payment received';
    case 'paid':
      return 'Payment made';
    case 'adjustment':
      return 'Adjustment';
  }
}

function subtitle(row: PartyLedgerRow) {
  switch (row.type) {
    case 'sale':
    case 'purchase': {
      const what = row.type === 'sale' ? 'Sale' : 'Purchase';
      return row.quantity ? `${what} · ${row.quantity} ${row.unit ?? ''} × ${formatRs(row.rate)}` : what;
    }
    case 'received':
    case 'paid':
      return [METHOD[row.method ?? 'cash'], row.against ? `for ${row.against}` : ''].filter(Boolean).join(' · ');
    case 'adjustment':
      return `${formatRs(row.amount)} of purchases set off against sales`;
  }
}

const isBill = (row: PartyLedgerRow) => row.type === 'sale' || row.type === 'purchase';

export function LedgerTable({ rows, partyId, kind, roles }: LedgerTableProps) {
  const terms = SIDES[kind];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [newestFirst, setNewestFirst] = useState(true);

  const term = searchTerm.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filterType === 'payment' && isBill(r)) return false;
    if ((filterType === 'sale' || filterType === 'purchase') && r.type !== filterType) return false;
    if (!term) return true;
    return [title(r), subtitle(r), r.notes, r.date, formatDate(r.date)].some((v) => v?.toLowerCase().includes(term));
  });

  // Rows are already chronological; reversing keeps same-day rows in a consistent order
  const visible = newestFirst ? [...filtered].reverse() : filtered;

  const filters: { label: string; value: TypeFilter }[] = [
    { label: 'All', value: 'all' },
    ...(roles.customer ? [{ label: 'Sales', value: 'sale' as const }] : []),
    ...(roles.vendor ? [{ label: 'Purchases', value: 'purchase' as const }] : []),
    { label: 'Payments', value: 'payment' },
  ];

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs">
        <EmptyState
          icon={<FileSpreadsheet className="w-5 h-5" />}
          title="No transactions yet"
          description={`${terms.Entries} and payments for this ${terms.one} will appear here with a running balance.`}
          action={
            <Link href={`${terms.base}/${partyId}/${terms.entrySegment}/new`} className={buttonClass('primary')}>
              <Plus className="w-4 h-4" />
              Add first {terms.entry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-zinc-100 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 lg:flex-1">
          <div className="relative flex-1 lg:max-w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search material, notes, date"
              aria-label="Search ledger"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setNewestFirst(!newestFirst)}
            className={buttonClass('secondary', 'shrink-0 lg:order-last')}
            title="Change sort order"
          >
            <ArrowDownUp className="w-4 h-4" />
            <span className="hidden sm:inline">{newestFirst ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
        <div className={filters.length > 3 ? 'lg:w-96' : 'lg:w-64'}>
          <Segmented<TypeFilter> ariaLabel="Transaction type" value={filterType} onChange={setFilterType} options={filters} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No transactions match your search.</p>
      ) : (
        <>
          {/* Mobile: stacked list */}
          <ul className="md:hidden divide-y divide-zinc-100">
            {visible.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isBill(row) ? 'text-zinc-900' : 'text-zinc-700'}`}>{title(row)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDate(row.date)} · {subtitle(row)}
                    </p>
                  </div>
                  <AmountCell row={row} className="text-sm shrink-0 text-right" />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {row.status && <StatusBadge status={row.status} />}
                    {row.due_date && <span>Due {formatDate(row.due_date)}</span>}
                  </span>
                  <span className="tabular-nums whitespace-nowrap ml-auto">
                    Balance <span className="font-medium text-zinc-900">{formatBalance(row.balance)}</span>
                  </span>
                </div>
                {row.notes && <p className="mt-1.5 text-xs text-zinc-500">{row.notes}</p>}
              </li>
            ))}
          </ul>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4 text-right" title="Sales, and payments you made: they owe you more">
                    Debit
                  </th>
                  <th className="py-2.5 px-4 text-right" title="Purchases, and payments you received: you owe them more">
                    Credit
                  </th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                  <th className="py-2.5 px-4">Due date</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map((row) => (
                  <tr key={row.id} className={`hover:bg-zinc-50/70 ${row.type === 'adjustment' ? 'bg-sky-50/40' : ''}`}>
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-700">{formatDate(row.date)}</td>
                    <td className="py-3 px-4 max-w-[260px]">
                      <p className={`font-medium truncate ${isBill(row) ? 'text-zinc-900' : 'text-zinc-700'}`}>{title(row)}</p>
                      <p className="text-xs text-zinc-500 truncate">{subtitle(row)}</p>
                      {row.notes && (
                        <p className="text-xs text-zinc-500 truncate" title={row.notes}>
                          {row.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-zinc-900 tabular-nums">
                      {row.debit > 0 ? formatRs(row.debit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-emerald-700 tabular-nums">
                      {row.credit > 0 ? formatRs(row.credit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-zinc-900 tabular-nums">
                      {formatBalance(row.balance)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-700">{row.due_date ? formatDate(row.due_date) : '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {row.status ? <StatusBadge status={row.status} /> : <span className="text-zinc-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-4 py-2.5 border-t border-zinc-100 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">Debit</span>: sales and payments you made ·{' '}
            <span className="font-medium text-zinc-700">Credit</span>: purchases and payments you received · Balance{' '}
            <span className="font-medium text-zinc-700">Dr</span> = receivable, <span className="font-medium text-zinc-700">Cr</span> = payable
          </p>
        </>
      )}
    </div>
  );
}

function AmountCell({ row, className = '' }: { row: PartyLedgerRow; className?: string }) {
  if (row.type === 'adjustment') {
    return <p className={`font-semibold tabular-nums text-sky-700 ${className}`}>Set off</p>;
  }
  const debit = row.debit > 0;
  return (
    <p className={`font-semibold tabular-nums ${debit ? 'text-zinc-900' : 'text-emerald-700'} ${className}`}>
      {formatRs(debit ? row.debit : row.credit)}
      <span className="ml-1 text-[11px] font-medium text-zinc-400">{debit ? 'Dr' : 'Cr'}</span>
    </p>
  );
}
