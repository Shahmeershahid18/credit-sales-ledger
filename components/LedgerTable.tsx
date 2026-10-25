'use client';

import React, { useState } from 'react';
import { LedgerRow } from '@/lib/types';
import { formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { ArrowDownLeft, ArrowUpRight, Search, FileSpreadsheet } from 'lucide-react';

interface LedgerTableProps {
  rows: LedgerRow[]; // chronological order, as computed with the running balance
}

export function LedgerTable({ rows }: LedgerTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'payment'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filtered = rows.filter((r) => {
    const matchesType = filterType === 'all' || r.type === filterType;
    const matchesSearch =
      searchTerm === '' ||
      (r.material && r.material.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.date.includes(searchTerm) ||
      (r.method && r.method.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Rows are already chronological; reversing keeps same-day rows in a consistent order
  const sortedRows = sortOrder === 'desc' ? [...filtered].reverse() : filtered;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in ledger (material, notes)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-56 sm:w-64"
            />
          </div>

          <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All ({rows.length})
            </button>
            <button
              onClick={() => setFilterType('sale')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'sale'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setFilterType('payment')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterType === 'payment'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Payments
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <span>Sort:</span>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold transition-colors"
          >
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-zinc-100/75 border-b border-zinc-200 text-zinc-600 font-semibold tracking-wider uppercase text-[11px]">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Material / Description</th>
              <th className="py-3 px-3 text-right">Qty</th>
              <th className="py-3 px-3 text-right">Rate</th>
              <th className="py-3 px-4 text-right">Debit (Sale)</th>
              <th className="py-3 px-4 text-right">Credit (Paid)</th>
              <th className="py-3 px-4 text-right">Running Balance</th>
              <th className="py-3 px-3 text-center">Credit Days</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-zinc-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">No ledger transactions found</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Record a sale or payment to see the chronological ledger
                  </p>
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isSale = row.type === 'sale';
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-zinc-50/80 transition-colors ${
                      isSale ? '' : 'bg-emerald-50/20'
                    }`}
                  >
                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {formatDate(row.date)}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isSale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-200/70 text-zinc-800">
                          <ArrowUpRight className="w-3 h-3 text-zinc-600" />
                          Sale
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                          Payment
                        </span>
                      )}
                    </td>

                    {/* Material / Description */}
                    <td className="py-3 px-4 font-medium text-zinc-900 max-w-[220px]">
                      {isSale ? (
                        <div>
                          <p className="font-semibold text-zinc-900 truncate">
                            {row.material}
                          </p>
                          {row.notes && (
                            <p className="text-[11px] text-zinc-500 truncate" title={row.notes}>
                              {row.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="font-medium text-emerald-800 capitalize">
                            {row.method || 'Cash'} Payment
                          </span>
                          {row.notes && (
                            <p className="text-[11px] text-zinc-500 truncate" title={row.notes}>
                              {row.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="py-3 px-3 text-right whitespace-nowrap text-zinc-600">
                      {isSale && row.quantity ? `${row.quantity} ${row.unit || ''}` : '—'}
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-3 text-right whitespace-nowrap text-zinc-600">
                      {isSale && row.rate ? formatRs(row.rate) : '—'}
                    </td>

                    {/* Debit (Sale) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-zinc-900">
                      {row.debit > 0 ? formatRs(row.debit) : '—'}
                    </td>

                    {/* Credit (Paid) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-700">
                      {row.credit > 0 ? `−${formatRs(row.credit)}` : '—'}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-extrabold text-zinc-900 bg-zinc-50/50">
                      {formatRs(row.balance)}
                    </td>

                    {/* Credit Days */}
                    <td className="py-3 px-3 text-center whitespace-nowrap text-zinc-600">
                      {isSale && row.credit_days !== undefined ? `${row.credit_days} days` : '—'}
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-700">
                      {isSale && row.due_date ? formatDate(row.due_date) : '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isSale && row.status ? (
                        <StatusBadge status={row.status} />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
