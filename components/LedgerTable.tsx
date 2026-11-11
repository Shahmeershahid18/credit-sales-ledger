'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteEntryAction } from '@/app/actions/entries';
import { PartyLedgerRow } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatBalance, formatRs, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { EmptyState, Segmented, buttonClass } from './ui';
import { Search, FileSpreadsheet, ArrowDownUp, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

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

/** Where a row is corrected; adjustments cannot be edited, only deleted */
function editHref(row: PartyLedgerRow, partyId: string): string | null {
  switch (row.type) {
    case 'sale':
      return `/customers/${partyId}/sale/${row.id}/edit`;
    case 'purchase':
      return `/vendors/${partyId}/purchase/${row.id}/edit`;
    case 'received':
      return `/customers/${partyId}/payment/${row.id}/edit`;
    case 'paid':
      return `/vendors/${partyId}/payment/${row.id}/edit`;
    case 'adjustment':
      return null;
  }
}

function deleteQuestion(row: PartyLedgerRow, hasAdjustments: boolean): string {
  const when = formatDate(row.date);
  const lines: string[] = [];
  if (isBill(row)) {
    const what = row.type === 'sale' ? 'sale' : 'purchase';
    lines.push(`Delete this ${what} of ${formatRs(row.amount)} (${row.material}, ${when})?`);
    if (row.linked) {
      const payments = row.linked === 1 ? 'The payment' : `The ${row.linked} payments`;
      lines.push(`${payments} recorded against it will stay and go to the oldest unpaid ${what}s.`);
    }
    if (hasAdjustments) lines.push('If this bill was cleared with Adjust, delete that adjustment too and adjust again.');
  } else if (row.type === 'adjustment') {
    lines.push(`Delete the adjustment of ${formatRs(row.amount)} on ${when}?`);
    lines.push(`This undoes the settlement: ${formatRs(row.amount)} goes back to both what they owe you and what you owe them.`);
  } else {
    lines.push(`Delete this payment ${row.type === 'paid' ? 'made' : 'received'} of ${formatRs(row.amount)} on ${when}?`);
  }
  lines.push('This cannot be undone.');
  return lines.join('\n\n');
}

export function LedgerTable({ rows, partyId, kind, roles }: LedgerTableProps) {
  const terms = SIDES[kind];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [newestFirst, setNewestFirst] = useState(true);
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasAdjustments = rows.some((r) => r.type === 'adjustment');

  const remove = async (row: PartyLedgerRow) => {
    if (!window.confirm(deleteQuestion(row, hasAdjustments))) return;
    setDeletingId(row.id);
    setActionError(null);
    const result = await deleteEntryAction(partyId, row.type, row.id);
    if (!result.success) {
      setDeletingId(null);
      return setActionError(result.error);
    }
    router.refresh(); // the row disappears once the page reloads
  };

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

      {actionError && (
        <p role="alert" className="px-4 py-2.5 border-b border-rose-100 bg-rose-50 text-sm text-rose-700">
          {actionError}
        </p>
      )}

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
                <RowActions row={row} partyId={partyId} busy={deletingId === row.id} onDelete={() => remove(row)} labelled />
              </li>
            ))}
          </ul>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3 text-right" title="Sales, and payments you made: they owe you more">
                    Debit
                  </th>
                  <th className="py-2.5 px-3 text-right" title="Purchases, and payments you received: you owe them more">
                    Credit
                  </th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3">Due date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-1 pr-2 sticky right-0 bg-zinc-50">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map((row) => (
                  <tr key={row.id} className={`group hover:bg-zinc-50/70 ${row.type === 'adjustment' ? 'bg-sky-50/40' : ''}`}>
                    <td className="py-3 px-3 whitespace-nowrap text-zinc-700">{formatDate(row.date)}</td>
                    <td className="py-3 px-3 max-w-[260px]">
                      <p className={`font-medium truncate ${isBill(row) ? 'text-zinc-900' : 'text-zinc-700'}`}>{title(row)}</p>
                      <p className="text-xs text-zinc-500 truncate">{subtitle(row)}</p>
                      {row.notes && (
                        <p className="text-xs text-zinc-500 truncate" title={row.notes}>
                          {row.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-zinc-900 tabular-nums">
                      {row.debit > 0 ? formatRs(row.debit) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-emerald-700 tabular-nums">
                      {row.credit > 0 ? formatRs(row.credit) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-semibold text-zinc-900 tabular-nums">
                      {formatBalance(row.balance)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-zinc-700">{row.due_date ? formatDate(row.due_date) : '—'}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {row.status ? <StatusBadge status={row.status} /> : <span className="text-zinc-300">—</span>}
                    </td>
                    {/* Stays in view when the table scrolls sideways */}
                    <td className="py-2 pl-1 pr-2 sticky right-0 bg-white group-hover:bg-zinc-50">
                      <RowActions row={row} partyId={partyId} busy={deletingId === row.id} onDelete={() => remove(row)} />
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

function RowActions({
  row,
  partyId,
  busy,
  onDelete,
  labelled = false,
}: {
  row: PartyLedgerRow;
  partyId: string;
  busy: boolean;
  onDelete: () => void;
  labelled?: boolean; // phones: words next to the icons
}) {
  const href = editHref(row, partyId);
  const base = labelled
    ? 'h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-xs font-medium border border-zinc-200'
    : 'w-7 h-7 rounded-md inline-flex items-center justify-center';
  const what = row.type === 'adjustment' ? 'adjustment' : isBill(row) ? row.type : 'payment';
  return (
    <div className={`flex items-center ${labelled ? 'mt-2.5 gap-1.5' : 'justify-end gap-0.5'}`}>
      {href && (
        <Link href={href} className={`${base} text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100`} aria-label={`Edit ${what}`} title="Edit">
          <Pencil className="w-3.5 h-3.5" />
          {labelled && 'Edit'}
        </Link>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className={`${base} text-zinc-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50`}
        aria-label={`Delete ${what}`}
        title="Delete"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        {labelled && (busy ? 'Deleting…' : 'Delete')}
      </button>
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
