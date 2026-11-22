'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { CustomerPriceRow, Material } from '@/lib/types';
import { formatDate, formatQuantity, formatRs } from '@/lib/format';
import { saveCustomerPricesAction } from '@/app/actions/profit';
import { FormError, buttonClass, inputClass } from './ui';
import { Select } from './Select';

interface CustomerPriceEditorProps {
  customerId: string;
  customerName: string;
  rows: CustomerPriceRow[];
  materials: Material[]; // saved products that can be added to the list
}

type Values = { sale: string; cost: string };

const asText = (v: number | null) => (v === null ? '' : String(v));
const parse = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * One customer's own sale rate and cost price for each product. An empty field means
 * the general rate or cost price is used.
 */
export function CustomerPriceEditor({ customerId, customerName, rows: initialRows, materials }: CustomerPriceEditorProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [values, setValues] = useState<Record<string, Values>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.key, { sale: asText(r.sale_rate), cost: asText(r.cost_price) }]))
  );
  const [saved, setSaved] = useState(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const listed = new Set(rows.map((r) => r.key));
  const addable = materials.filter((m) => !listed.has(m.name.trim().toLowerCase()));
  const dirty = rows.filter((r) => values[r.key].sale.trim() !== saved[r.key]?.sale.trim() || values[r.key].cost.trim() !== saved[r.key]?.cost.trim());

  const set = (key: string, patch: Partial<Values>) => {
    setDone(false);
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const addProduct = (id: string) => {
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    const key = m.name.trim().toLowerCase();
    setRows((prev) => [
      ...prev,
      {
        key,
        material: m.name,
        unit: m.unit,
        sale_rate: null,
        cost_price: null,
        default_rate: m.rate,
        default_cost: m.cost_price,
        last_rate: null,
        last_date: null,
        last_unit: null,
        last_cost: null,
        last_cost_unit: null,
        last_cost_date: null,
        quantity: 0,
      },
    ]);
    setValues((prev) => ({ ...prev, [key]: { sale: '', cost: '' } }));
    setSaved((prev) => ({ ...prev, [key]: { sale: '', cost: '' } }));
  };

  const save = async () => {
    setError(null);
    setDone(false);
    if (dirty.some((r) => [values[r.key].sale, values[r.key].cost].some((v) => v.trim() !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)))) {
      return setError('Rates and cost prices must be 0 or more.');
    }
    setBusy(true);
    const result = await saveCustomerPricesAction(
      customerId,
      dirty.map((r) => ({ material: r.material, unit: r.unit, sale_rate: parse(values[r.key].sale), cost_price: parse(values[r.key].cost) }))
    );
    setBusy(false);
    if (!result.success) return setError(result.error);
    setSaved(values);
    setDone(true);
    router.refresh();
  };

  return (
    <div>
      {error && (
        <div className="p-4 pb-0">
          <FormError message={error} />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-zinc-500 text-center">
          {customerName} has no sales yet. Add a product below to give them their own price.
        </p>
      ) : (
        <>
          <div className="hidden lg:grid grid-cols-[1.4fr_1.1fr_10.5rem_10.5rem_1fr] gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500">
            <span>Product</span>
            <span>Last charged</span>
            <span>Their sale rate</span>
            <span>Their cost price</span>
            <span className="text-right">Margin per unit</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const v = values[r.key];
              const saleOwn = parse(v.sale);
              const costOwn = parse(v.cost);
              const sale = saleOwn ?? (r.last_unit === r.unit ? r.last_rate : null) ?? r.default_rate;
              const cost = costOwn ?? r.default_cost;
              const margin = sale !== null && cost !== null && !Number.isNaN(sale) && !Number.isNaN(cost) ? sale - cost : null;
              return (
                <li key={r.key} className="px-4 py-3 grid grid-cols-2 lg:grid-cols-[1.4fr_1.1fr_10.5rem_10.5rem_1fr] gap-x-3 gap-y-2 items-center">
                  <div className="min-w-0 col-span-2 lg:col-span-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">{r.material}</p>
                    <p className="text-xs text-zinc-500">
                      per {r.unit}
                      {r.quantity > 0 && ` · ${formatQuantity(r.quantity)} ${r.unit} in 12 months`}
                    </p>
                  </div>
                  <p className="col-span-2 lg:col-span-1 text-xs text-zinc-500">
                    {r.last_rate !== null ? (
                      <>
                        <span className="lg:hidden">Last charged </span>
                        <span className="text-sm font-medium text-zinc-800 tabular-nums">{formatRs(r.last_rate)}</span>
                        {r.last_unit && r.last_unit !== r.unit && ` per ${r.last_unit}`} · {formatDate(r.last_date)}
                      </>
                    ) : (
                      'Not sold yet'
                    )}
                  </p>
                  <label className="block">
                    <span className="lg:hidden text-[11px] font-medium text-zinc-500">Their sale rate</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      aria-label={`${customerName}'s sale rate for ${r.material}`}
                      placeholder={r.default_rate !== null ? `General ${formatRs(r.default_rate)}` : 'Not set'}
                      value={v.sale}
                      onChange={(e) => set(r.key, { sale: e.target.value })}
                      className={`${inputClass} h-9`}
                    />
                  </label>
                  <label className="block">
                    <span className="lg:hidden text-[11px] font-medium text-zinc-500">Their cost price</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      aria-label={`Cost price of ${r.material} for ${customerName}`}
                      placeholder={r.default_cost !== null ? `General ${formatRs(r.default_cost)}` : 'Not set'}
                      value={v.cost}
                      onChange={(e) => set(r.key, { cost: e.target.value })}
                      className={`${inputClass} h-9`}
                    />
                  </label>
                  <p
                    className={`col-span-2 lg:col-span-1 text-right text-sm tabular-nums ${
                      margin === null ? 'text-zinc-400' : margin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {margin === null
                      ? cost === null
                        ? 'No cost price'
                        : 'No sale rate'
                      : `${formatRs(margin)}${sale ? ` (${Math.round((margin / sale) * 100)}%)` : ''}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="px-4 py-3 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="sm:w-72">
          <Select
            ariaLabel="Add a product"
            value=""
            onChange={addProduct}
            disabled={addable.length === 0}
            placeholder={addable.length ? 'Add a product…' : 'All saved products are listed'}
            searchPlaceholder="Search products…"
            options={addable.map((m) => ({ value: m.id, label: m.name, description: `per ${m.unit}` }))}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          {done && dirty.length === 0 && (
            <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
              <Check className="w-4 h-4" />
              Saved
            </span>
          )}
          <button type="button" onClick={save} disabled={busy || dirty.length === 0} className={buttonClass('primary', 'h-10 px-5')}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save prices
          </button>
        </div>
      </div>
    </div>
  );
}
