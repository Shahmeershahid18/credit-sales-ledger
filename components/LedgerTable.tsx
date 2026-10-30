'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LedgerRow } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { EmptyState, Segmented, buttonClass } from './ui';
import { Search, FileSpreadsheet, ArrowDownUp, Plus } from 'lucide-react';

interface LedgerTableProps {
  rows: LedgerRow[]; // chronological order, as computed with the running balance
  customerId: string;
  kind: ContactKind;
}

type TypeFilter = 'all' | 'sale' | 'payment';

function describe(row: LedgerRow) {
  return row.type === 'sale' ? row.material : `${row.method ? row.method[0].toUpperCase() + row.method.slice(1) : 'Cash'} payment`;
}

export function LedgerTable({ rows, customerId, kind }: LedgerTableProps) {
  const terms = SIDES[kind];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [newestFirst, setNewestFirst] = useState(true);

  const term = searchTerm.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (!term) return true;
    return [r.material, r.notes, r.method, r.date, formatDate(r.date)].some((v) => v?.toLowerCase().includes(term));
  });

  // Rows are already chronological; reversing keeps same-day rows in a consistent order
  const visible = newestFirst ? [...filtered].reverse() : filtered;

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs">
        <EmptyState
          icon={<FileSpreadsheet className="w-5 h-5" />}
          title="No transactions yet"
          description={`${terms.Entries} and payments for this ${terms.one} will appear here with a running balance.`}
          action={
            <Link href={`${terms.base}/${customerId}/${terms.entrySegment}/new`} className={buttonClass('primary')}>
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
      <div className="p-3 border-b border-zinc-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
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
        <div className="flex items-center gap-2">
          <div className="flex-1 sm:w-64">
            <Segmented<TypeFilter>
              ariaLabel="Transaction type"
              value={filterType}
              onChange={setFilterType}
              options={[
                { label: 'All', value: 'all' },
                { label: terms.Entries, value: 'sale' },
                { label: 'Payments', value: 'payment' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => setNewestFirst(!newestFirst)}
            className={buttonClass('secondary', 'shrink-0')}
            title="Change sort order"
          >
            <ArrowDownUp className="w-4 h-4" />
            <span className="hidden sm:inline">{newestFirst ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No transactions match your search.</p>
      ) : (
        <>
          {/* Mobile: stacked list */}
          <ul className="md:hidden divide-y divide-zinc-100">
            {visible.map((row) => {
              const isSale = row.type === 'sale';
              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{describe(row)}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(row.date)}
                        {isSale && row.quantity ? ` · ${row.quantity} ${row.unit ?? ''} × ${formatRs(row.rate)}` : ''}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${isSale ? 'text-zinc-900' : 'text-emerald-700'}`}>
                      {isSale ? formatRs(row.debit) : `−${formatRs(row.credit)}`}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {isSale && row.status && <StatusBadge status={row.status} />}
                      {isSale && row.due_date && <span>Due {formatDate(row.due_date)}</span>}
                    </span>
                    <span className="tabular-nums whitespace-nowrap ml-auto">
                      Balance <span className="font-medium text-zinc-900">{formatRs(row.balance)}</span>
                    </span>
                  </div>
                  {row.against && <p className="mt-1.5 text-xs text-zinc-500">For {row.against}</p>}
                  {row.notes && <p className="mt-1.5 text-xs text-zinc-500">{row.notes}</p>}
                </li>
              );
            })}
          </ul>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-4 text-right">{terms.Entry}</th>
                  <th className="py-2.5 px-4 text-right">{terms.paidShort}</th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Credit days</th>
                  <th className="py-2.5 px-4">Due date</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map((row) => {
                  const isSale = row.type === 'sale';
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-700">{formatDate(row.date)}</td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <p className={`font-medium truncate ${isSale ? 'text-zinc-900' : 'text-emerald-700'}`}>{describe(row)}</p>
                        {row.against && <p className="text-xs text-zinc-500 truncate">For {row.against}</p>}
                        {row.notes && (
                          <p className="text-xs text-zinc-500 truncate" title={row.notes}>
                            {row.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap text-zinc-600 tabular-nums">
                        {isSale && row.quantity ? `${row.quantity} ${row.unit ?? ''}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap text-zinc-600 tabular-nums">
                        {isSale && row.rate ? formatRs(row.rate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-zinc-900 tabular-nums">
                        {row.debit > 0 ? formatRs(row.debit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-emerald-700 tabular-nums">
                        {row.credit > 0 ? formatRs(row.credit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-zinc-900 tabular-nums">
                        {formatRs(row.balance)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap text-zinc-600">
                        {isSale && row.credit_days !== undefined ? row.credit_days : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-700">
                        {isSale && row.due_date ? formatDate(row.due_date) : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSale && row.status ? <StatusBadge status={row.status} /> : <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
