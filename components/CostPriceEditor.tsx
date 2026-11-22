'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { Material } from '@/lib/types';
import { formatQuantity, formatRs } from '@/lib/format';
import { saveCostPriceAction } from '@/app/actions/profit';
import { FormError, buttonClass, inputClass } from './ui';

interface CostPriceEditorProps {
  materials: Material[];
  sold: Record<string, number>; // quantity sold recently, by material name (lower case), in its own unit
}

const asText = (v: number | null) => (v === null ? '' : String(v));

/** Cost price per product: what one unit costs you to make, with the margin at the sale rate */
export function CostPriceEditor({ materials, sold }: CostPriceEditorProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(materials.map((m) => [m.id, asText(m.cost_price)])));
  const [saved, setSaved] = useState<Record<string, string>>(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const soldOf = (m: Material) => sold[m.name.trim().toLowerCase()] ?? 0;
  const ordered = [...materials].sort((a, b) => Number(soldOf(b) > 0) - Number(soldOf(a) > 0) || a.name.localeCompare(b.name));
  const dirty = materials.filter((m) => (values[m.id] ?? '').trim() !== (saved[m.id] ?? '').trim());

  const save = async () => {
    setError(null);
    setDone(false);
    setBusy(true);
    for (const m of dirty) {
      const result = await saveCostPriceAction(m.id, values[m.id].trim() || null);
      if (!result.success) {
        setBusy(false);
        return setError(`${m.name}: ${result.error}`);
      }
      setSaved((prev) => ({ ...prev, [m.id]: values[m.id] }));
    }
    setBusy(false);
    setDone(true);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <FormError message={error} />

      <div className="hidden md:grid grid-cols-[1.6fr_1fr_1fr_1fr_8rem_1fr] gap-3 px-4 py-2.5 bg-zinc-50 border-y border-zinc-200 text-xs font-medium text-zinc-500">
        <span>Product</span>
        <span className="text-right">Sold (3 months)</span>
        <span className="text-right">Sale rate</span>
        <span className="text-right">Purchase rate</span>
        <span>Cost price</span>
        <span className="text-right">Margin per unit</span>
      </div>
      <ul className="divide-y divide-zinc-100 md:-mt-4">
        {ordered.map((m) => {
          const cost = values[m.id]?.trim() === '' ? null : Number(values[m.id]);
          const margin = cost !== null && m.rate !== null && !Number.isNaN(cost) ? m.rate - cost : null;
          const pct = margin !== null && m.rate ? Math.round((margin / m.rate) * 100) : null;
          const qty = soldOf(m);
          return (
            <li key={m.id} className="px-4 py-3 grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr_8rem_1fr] gap-x-3 gap-y-1 items-center">
              <div className="min-w-0 col-span-2 md:col-span-1">
                <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                <p className="text-xs text-zinc-500">per {m.unit}</p>
              </div>
              <p className="hidden md:block text-right text-sm tabular-nums text-zinc-700">{qty > 0 ? `${formatQuantity(qty)} ${m.unit}` : <span className="text-zinc-300">—</span>}</p>
              <p className="hidden md:block text-right text-sm tabular-nums text-zinc-700">{m.rate !== null ? formatRs(m.rate) : <span className="text-zinc-300">—</span>}</p>
              <p className="hidden md:block text-right text-sm tabular-nums text-zinc-700">
                {m.purchase_rate !== null ? formatRs(m.purchase_rate) : <span className="text-zinc-300">—</span>}
              </p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">Rs.</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  aria-label={`Cost price of ${m.name} per ${m.unit}`}
                  placeholder="Not set"
                  value={values[m.id] ?? ''}
                  onChange={(e) => {
                    setDone(false);
                    setValues((prev) => ({ ...prev, [m.id]: e.target.value }));
                  }}
                  className={`${inputClass} h-9 pl-9`}
                />
              </div>
              <p className={`text-right text-sm tabular-nums ${margin === null ? 'text-zinc-300' : margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {margin === null ? (m.rate === null ? 'No sale rate' : '—') : `${formatRs(margin)}${pct !== null ? ` (${pct}%)` : ''}`}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-16 lg:bottom-0 px-4 py-3 border-t border-zinc-200 bg-white/95 backdrop-blur flex items-center justify-end gap-3 rounded-b-xl">
        {done && dirty.length === 0 && (
          <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
        <button type="button" onClick={save} disabled={busy || dirty.length === 0} className={buttonClass('primary', 'h-10 px-5')}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {dirty.length > 1 ? `Save ${dirty.length} cost prices` : 'Save cost price'}
        </button>
      </div>
    </div>
  );
}
