'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { BusinessEntry, BusinessEntryKind } from '@/lib/types';
import { formatRs, getTodayDateStr } from '@/lib/format';
import { ENTRY_TERMS } from '@/lib/profit';
import { deleteBusinessEntryAction, saveBusinessEntryAction } from '@/app/actions/profit';
import { Field, FormError, Segmented, buttonClass, inputClass } from './ui';
import { FormFooter } from './SaleForm';

interface BusinessEntryFormProps {
  kind: BusinessEntryKind;
  entry?: BusinessEntry; // editing this entry
  categories: string[]; // categories used before, shown as quick picks
}

const DEFAULT_CATEGORIES = ['Salaries', 'Rent', 'Electricity', 'Gas', 'Fuel & transport', 'Labour', 'Repairs', 'Packing', 'Office'];

/** Adds or corrects an expense, an owner investment or an owner withdrawal */
export function BusinessEntryForm({ kind: initialKind, entry, categories }: BusinessEntryFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<BusinessEntryKind>(entry?.kind ?? initialKind);
  const [date, setDate] = useState(entry?.entry_date ?? getTodayDateStr());
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [category, setCategory] = useState(entry?.category ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terms = ENTRY_TERMS[kind];
  const parsedAmount = Number(amount) || 0;
  const picks = [...new Set([...categories, ...DEFAULT_CATEGORIES].map((c) => c.trim()).filter(Boolean))].slice(0, 14);
  const backHref = `/expenses?month=${date.slice(0, 7)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (parsedAmount <= 0) return setError('The amount must be greater than 0.');
    if (kind === 'expense' && !category.trim()) return setError('Please choose or type the expense category.');
    setBusy('save');
    const result = await saveBusinessEntryAction(entry?.id ?? null, {
      kind,
      entry_date: date,
      amount: parsedAmount,
      category: kind === 'expense' ? category : null,
      notes,
    });
    if (!result.success) {
      setBusy(null);
      return setError(result.error);
    }
    router.push(backHref);
    router.refresh();
  };

  const remove = async () => {
    if (!entry || !window.confirm(`Delete this ${ENTRY_TERMS[entry.kind].one} of ${formatRs(entry.amount)}? This cannot be undone.`)) return;
    setBusy('delete');
    setError(null);
    const result = await deleteBusinessEntryAction(entry.id);
    if (!result.success) {
      setBusy(null);
      return setError(result.error);
    }
    router.push(`/expenses?month=${entry.entry_date.slice(0, 7)}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={error} />

      <div className="sm:w-96">
        <Segmented<BusinessEntryKind>
          ariaLabel="Entry type"
          value={kind}
          onChange={setKind}
          options={(['expense', 'investment', 'withdrawal'] as const).map((k) => ({ label: ENTRY_TERMS[k].label, value: k }))}
        />
        <p className="mt-2 text-xs text-zinc-500">{terms.hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date" htmlFor="entry_date">
          <input id="entry_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Amount" htmlFor="amount">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">Rs.</span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} pl-10 font-medium`}
              required
            />
          </div>
        </Field>
      </div>

      {kind === 'expense' && (
        <Field label="Category" htmlFor="category">
          <input
            id="category"
            type="text"
            maxLength={60}
            placeholder="e.g. Rent"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            required
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {picks.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category.trim().toLowerCase() === c.toLowerCase()}
                className={`h-7 px-2.5 rounded-full border text-xs font-medium ${
                  category.trim().toLowerCase() === c.toLowerCase()
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Note" htmlFor="notes" optional>
        <input
          id="notes"
          type="text"
          maxLength={200}
          placeholder={kind === 'expense' ? 'e.g. October bill' : kind === 'investment' ? 'e.g. From personal savings' : 'e.g. Household'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {entry && (
        <button type="button" onClick={remove} disabled={busy !== null} className={buttonClass('ghost', 'text-rose-700 hover:text-rose-800 hover:bg-rose-50')}>
          <Trash2 className="w-4 h-4" />
          {busy === 'delete' ? 'Deleting…' : `Delete ${terms.one}`}
        </button>
      )}

      <FormFooter
        cancelHref={entry ? `/expenses?month=${entry.entry_date.slice(0, 7)}` : '/expenses'}
        isSubmitting={busy === 'save'}
        label={entry ? `Save changes · ${formatRs(parsedAmount)}` : `${terms.save} · ${formatRs(parsedAmount)}`}
      />
    </form>
  );
}
