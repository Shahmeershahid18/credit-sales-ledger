'use client';

import React, { useMemo, useState } from 'react';
import { PartyLedgerRow } from '@/lib/types';
import { formatMonth, formatQuantity, quantityKey, unitGroup } from '@/lib/format';
import { Segmented, cardClass } from './ui';

interface PartyQuantityHistoryProps {
  rows: PartyLedgerRow[]; // the party's ledger
  roles: { customer: boolean; vendor: boolean };
}

type Side = 'sale' | 'purchase';
type Column = { key: string; name: string; unit: string; entries: number; total: number };
type MonthRow = { month: string; qty: Map<string, number> };
type Total = { key: string; unit: string; members: { key: string; factor: number }[]; total: number };

const SHOWN_MONTHS = 12;

/** Months (newest first) by materials, with the quantity moved, for one side of the party */
function tabulate(rows: PartyLedgerRow[], side: Side) {
  const columns = new Map<string, Column>();
  const months = new Map<string, MonthRow>();
  for (const r of rows) {
    if (r.type !== side || !r.material || !(Number(r.quantity) > 0)) continue;
    const key = quantityKey(r.material, r.unit);
    const qty = Number(r.quantity);
    const col = columns.get(key) ?? { key, name: r.material.trim(), unit: (r.unit ?? '').trim() || 'units', entries: 0, total: 0 };
    col.entries += 1;
    col.total += qty;
    columns.set(key, col);
    const month = r.date.slice(0, 7);
    const row = months.get(month) ?? { month, qty: new Map() };
    row.qty.set(key, (row.qty.get(key) ?? 0) + qty);
    months.set(month, row);
  }
  const sorted = [...columns.values()].sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));

  // Combined totals: materials that can be added up (kg + ton as tons; same unit otherwise)
  const groups = new Map<string, Total>();
  for (const c of sorted) {
    const g = unitGroup(c.unit);
    const total = groups.get(g.key) ?? { key: `all|${g.key}`, unit: g.unit, members: [], total: 0 };
    total.members.push({ key: c.key, factor: g.factor });
    total.total += c.total * g.factor;
    groups.set(g.key, total);
  }

  return {
    columns: sorted,
    totals: [...groups.values()].filter((t) => t.members.length > 1),
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
  };
}

/** A month's combined quantity for one total column */
const monthTotal = (m: MonthRow, t: Total) => t.members.reduce((s, x) => s + (m.qty.get(x.key) ?? 0) * x.factor, 0);

/**
 * A party's monthly quantity history: how much of each material was sold to it (or
 * bought from it) each month, each material in its own unit
 */
export function PartyQuantityHistory({ rows, roles }: PartyQuantityHistoryProps) {
  const sales = useMemo(() => tabulate(rows, 'sale'), [rows]);
  const purchases = useMemo(() => tabulate(rows, 'purchase'), [rows]);
  const sides: Side[] = [
    ...(roles.customer && sales.months.length ? (['sale'] as const) : []),
    ...(roles.vendor && purchases.months.length ? (['purchase'] as const) : []),
  ];
  const [chosen, setChosen] = useState<Side>(sides[0] ?? 'sale');
  const [showAll, setShowAll] = useState(false);
  if (sides.length === 0) return null;

  const side = sides.includes(chosen) ? chosen : sides[0];
  const { columns, totals, months } = side === 'sale' ? sales : purchases;
  const visible = showAll ? months : months.slice(0, SHOWN_MONTHS);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Monthly quantity</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {side === 'sale' ? 'Sold to them' : 'Bought from them'} each month, each material in its own unit
            {totals.length > 0 && ', with the combined total (kg added as tons)'}
          </p>
        </div>
        {sides.length > 1 && (
          <div className="w-56">
            <Segmented<Side>
              ariaLabel="Quantity side"
              value={side}
              onChange={(s) => {
                setChosen(s);
                setShowAll(false);
              }}
              options={[
                { label: 'Sales', value: 'sale' },
                { label: 'Purchases', value: 'purchase' },
              ]}
            />
          </div>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {/* Mobile: one line per month */}
        <ul className="md:hidden divide-y divide-zinc-100">
          {visible.map((m) => (
            <li key={m.month} className="px-4 py-3">
              <p className="text-sm font-medium text-zinc-900">{formatMonth(m.month)}</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {columns
                  .filter((c) => m.qty.get(c.key))
                  .map((c) => (
                    <span key={c.key} className="px-2 py-0.5 rounded-md bg-zinc-100 text-xs text-zinc-700">
                      {c.name}: <span className="font-medium text-zinc-900 tabular-nums">{formatQuantity(m.qty.get(c.key)!)}</span> {c.unit}
                    </span>
                  ))}
                {totals
                  .filter((t) => monthTotal(m, t) > 0)
                  .map((t) => (
                    <span key={t.key} className="px-2 py-0.5 rounded-md bg-emerald-50 text-xs font-medium text-emerald-800">
                      Total: <span className="tabular-nums">{formatQuantity(monthTotal(m, t))}</span> {t.unit}
                    </span>
                  ))}
              </p>
            </li>
          ))}
        </ul>

        {/* Desktop: months down, materials across */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="py-2 px-4 text-left sticky left-0 bg-zinc-50">Month</th>
                {columns.map((c) => (
                  <th key={c.key} className="py-2 px-4 text-right font-medium">
                    <span className="block text-zinc-700 whitespace-nowrap">{c.name}</span>
                    <span className="block text-[10px] text-zinc-400">{c.unit}</span>
                  </th>
                ))}
                {totals.map((t) => (
                  <th key={t.key} className="py-2 px-4 text-right font-medium bg-emerald-50/60">
                    <span className="block text-zinc-900 whitespace-nowrap">Total</span>
                    <span className="block text-[10px] text-zinc-500">{t.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((m) => (
                <tr key={m.month} className="group hover:bg-zinc-50/70">
                  <td className="py-2.5 px-4 whitespace-nowrap text-zinc-700 sticky left-0 bg-white group-hover:bg-zinc-50">{formatMonth(m.month)}</td>
                  {columns.map((c) => {
                    const q = m.qty.get(c.key) ?? 0;
                    return (
                      <td key={c.key} className={`py-2.5 px-4 text-right tabular-nums ${q > 0 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                        {q > 0 ? formatQuantity(q) : '—'}
                      </td>
                    );
                  })}
                  {totals.map((t) => {
                    const q = monthTotal(m, t);
                    return (
                      <td
                        key={t.key}
                        className={`py-2.5 px-4 text-right tabular-nums font-semibold bg-emerald-50/40 ${q > 0 ? 'text-zinc-900' : 'text-zinc-300'}`}
                      >
                        {q > 0 ? formatQuantity(q) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
                <td className="py-2.5 px-4 sticky left-0 bg-zinc-50">All time</td>
                {columns.map((c) => (
                  <td key={c.key} className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                    {formatQuantity(c.total)}
                  </td>
                ))}
                {totals.map((t) => (
                  <td key={t.key} className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap bg-emerald-50">
                    {formatQuantity(t.total)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {months.length > SHOWN_MONTHS && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full px-4 py-2.5 border-t border-zinc-100 text-sm font-medium text-emerald-700 hover:bg-zinc-50"
          >
            {showAll ? `Show the last ${SHOWN_MONTHS} months` : `Show all ${months.length} months`}
          </button>
        )}
      </div>
    </section>
  );
}
