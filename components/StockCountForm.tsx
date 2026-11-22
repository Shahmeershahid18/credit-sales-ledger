'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { Material, StockCount, StockItem } from '@/lib/types';
import { formatMonth, formatRs, shiftMonth } from '@/lib/format';
import { deleteStockCountAction, saveStockCountAction } from '@/app/actions/profit';
import { Field, FormError, buttonClass, inputClass } from './ui';
import { FormFooter } from './SaleForm';

interface StockCountFormProps {
  month: string; // YYYY-MM: the stock in hand at the end of this month
  count: StockCount | null; // the saved count, when editing
  template: StockItem[]; // lines to start from (the last count's), when there is no count yet
  templateMonth: string | null;
  materials: Pick<Material, 'name' | 'unit' | 'rate' | 'purchase_rate' | 'cost_price'>[];
}

type Kind = StockItem['kind'];
type Row = { key: string; kind: Kind; name: string; quantity: string; unit: string; rate: string };

const UNITS = ['bag', 'ton', 'kg', 'truck', 'pcs', 'ft', 'sqft', 'litre', 'can', 'roll', 'drum'];
const SECTIONS: { kind: Kind; title: string; hint: string; add: string }[] = [
  { kind: 'raw', title: 'Raw material', hint: 'At purchase rate', add: 'Add raw material' },
  { kind: 'finished', title: 'Finished goods', hint: 'At cost price, not sale price', add: 'Add finished goods' },
];

let nextKey = 0;
const newKey = () => `row-${++nextKey}`;
const asText = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? '' : String(v));

/** The value of each line, and the totals */
function value(rows: Row[], kind?: Kind) {
  return rows.filter((r) => !kind || r.kind === kind).reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0), 0);
}

/**
 * The stock in hand at the end of a month, line by line: raw material and finished
 * goods with quantity × rate. It is this month's closing stock and next month's opening.
 */
export function StockCountForm({ month, count, template, templateMonth, materials }: StockCountFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    (count?.items ?? template).map((i) => ({
      key: newKey(),
      kind: i.kind,
      name: i.name,
      // A copied count keeps the items and rates; the quantities are counted again
      quantity: count ? String(i.quantity) : '',
      unit: i.unit,
      rate: asText(i.rate),
    }))
  );
  const [notes, setNotes] = useState(count?.notes ?? '');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byName = new Map(materials.map((m) => [m.name.trim().toLowerCase(), m]));
  const savedRate = (kind: Kind, name: string) => {
    const m = byName.get(name.trim().toLowerCase());
    if (!m) return null;
    return kind === 'raw' ? m.purchase_rate ?? m.cost_price : m.cost_price ?? m.purchase_rate;
  };

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const changeName = (row: Row, name: string) => {
    const m = byName.get(name.trim().toLowerCase());
    const rate = savedRate(row.kind, name);
    update(row.key, { name, ...(m && { unit: m.unit }), ...(m && rate !== null && !row.rate && { rate: String(rate) }) });
  };
  const add = (kind: Kind) => setRows((prev) => [...prev, { key: newKey(), kind, name: '', quantity: '', unit: 'bag', rate: '' }]);
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const total = value(rows);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const filled = rows.filter((r) => r.name.trim() || r.quantity || r.rate);
    if (filled.some((r) => !r.name.trim())) return setError('Every stock line needs an item name.');
    if (filled.some((r) => (Number(r.quantity) || 0) < 0 || (Number(r.rate) || 0) < 0)) return setError('Quantities and rates cannot be negative.');
    setBusy('save');
    const result = await saveStockCountAction(month, {
      items: filled.map((r) => ({ kind: r.kind, name: r.name, quantity: Number(r.quantity) || 0, unit: r.unit, rate: Number(r.rate) || 0 })),
      notes,
    });
    if (!result.success) {
      setBusy(null);
      return setError(result.error);
    }
    router.push('/stock');
    router.refresh();
  };

  const deleteCount = async () => {
    if (!window.confirm(`Delete the stock count for ${formatMonth(month)}? Profit for ${formatMonth(month)} and ${formatMonth(shiftMonth(month, 1))} goes back to the cost-price estimate.`)) return;
    setBusy('delete');
    setError(null);
    const result = await deleteStockCountAction(month);
    if (!result.success) {
      setBusy(null);
      return setError(result.error);
    }
    router.push('/stock');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      {!count && template.length > 0 && templateMonth && (
        <p className="px-3 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-sm">
          The items and rates are copied from {formatMonth(templateMonth)}. Enter the quantities you have now.
        </p>
      )}

      <datalist id="stock-items">
        {materials.map((m) => (
          <option key={m.name} value={m.name} />
        ))}
      </datalist>
      <datalist id="stock-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {SECTIONS.map((section) => {
        const lines = rows.filter((r) => r.kind === section.kind);
        return (
          <section key={section.kind} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                {section.title} <span className="font-normal text-zinc-500">· {section.hint}</span>
              </h2>
              <span className="text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{formatRs(value(rows, section.kind))}</span>
            </div>

            {lines.length > 0 && (
              <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
                <div className="hidden sm:grid grid-cols-[1fr_6rem_5.5rem_7.5rem_7.5rem_2rem] gap-2 px-3 py-2 text-[11px] font-medium text-zinc-500 bg-zinc-50 rounded-t-lg">
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Unit</span>
                  <span>Rate (Rs.)</span>
                  <span className="text-right">Value</span>
                  <span />
                </div>
                {lines.map((r) => (
                  <div key={r.key} className="grid grid-cols-[1fr_1fr_1fr_2rem] sm:grid-cols-[1fr_6rem_5.5rem_7.5rem_7.5rem_2rem] gap-2 p-3 items-center">
                    <input
                      type="text"
                      list="stock-items"
                      aria-label={`${section.title} item`}
                      placeholder="Item"
                      value={r.name}
                      onChange={(e) => changeName(r, e.target.value)}
                      className={`${inputClass} h-9 col-span-3 sm:col-span-1`}
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      aria-label={`Remove ${r.name || 'this line'}`}
                      className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      aria-label="Quantity"
                      placeholder="Qty"
                      value={r.quantity}
                      onChange={(e) => update(r.key, { quantity: e.target.value })}
                      className={`${inputClass} h-9`}
                    />
                    <input
                      type="text"
                      list="stock-units"
                      aria-label="Unit"
                      placeholder="Unit"
                      value={r.unit}
                      onChange={(e) => update(r.key, { unit: e.target.value })}
                      className={`${inputClass} h-9`}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      aria-label="Rate"
                      placeholder="Rate"
                      value={r.rate}
                      onChange={(e) => update(r.key, { rate: e.target.value })}
                      className={`${inputClass} h-9`}
                    />
                    <span className="col-span-3 sm:col-span-1 text-right text-sm font-medium text-zinc-900 tabular-nums">
                      {formatRs((Number(r.quantity) || 0) * (Number(r.rate) || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      aria-label={`Remove ${r.name || 'this line'}`}
                      className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => add(section.kind)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
              <Plus className="w-4 h-4" />
              {section.add}
            </button>
          </section>
        );
      })}

      <div className="flex items-baseline justify-between gap-3 px-4 py-3 rounded-lg bg-zinc-900 text-white">
        <span className="text-sm font-medium">Closing stock, {formatMonth(month)}</span>
        <span className="text-lg font-semibold tabular-nums">{formatRs(total)}</span>
      </div>

      <Field label="Note" htmlFor="notes" optional>
        <input
          id="notes"
          type="text"
          maxLength={200}
          placeholder="e.g. Counted on 30 Nov"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {count && (
        <button type="button" onClick={deleteCount} disabled={busy !== null} className={buttonClass('ghost', 'text-rose-700 hover:text-rose-800 hover:bg-rose-50')}>
          <Trash2 className="w-4 h-4" />
          {busy === 'delete' ? 'Deleting…' : 'Delete this count'}
        </button>
      )}

      <FormFooter cancelHref="/stock" isSubmitting={busy === 'save'} label={`Save stock · ${formatRs(total)}`} />
    </form>
  );
}
