'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Check, Loader2 } from 'lucide-react';
import { PartySide } from '@/lib/types';
import { formatRs, getTodayDateStr } from '@/lib/format';
import { settlePartyAction } from '@/app/actions/parties';
import { Field, FormError, buttonClass, cardClass, inputClass } from './ui';

interface PartySettlementProps {
  partyId: string;
  customer: PartySide;
  vendor: PartySide;
  net: number; // + they owe you, − you owe them
  settleable: number;
}

/**
 * Sales less purchases (and the money that moved) for a party that is both a
 * customer and a vendor, with a one-click adjustment that sets the two sides off
 */
export function PartySettlement({ partyId, customer, vendor, net, settleable }: PartySettlementProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(settleable * 100) / 100));
  const [date, setDate] = useState(getTodayDateStr());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rounded = Math.round(net);
  const receivable = rounded > 0;
  const settled = rounded === 0;
  const parsed = Number(amount) || 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await settlePartyAction(partyId, { amount, date, notes });
    setBusy(false);
    if (!result.success) return setError(result.error);
    setOpen(false);
    router.refresh();
  };

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Party settlement</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Sales less purchases, after payments both ways</p>
        </div>
        {settleable > 0 && !open && (
          <button
            type="button"
            onClick={() => {
              setAmount(String(Math.round(settleable * 100) / 100));
              setOpen(true);
            }}
            className={buttonClass('secondary', 'shrink-0')}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Adjust
          </button>
        )}
      </div>

      <dl className="mt-4 text-sm divide-y divide-zinc-100">
        <Line label="Total sale" value={customer.total} />
        <Line label="Less: total purchase" value={vendor.total} />
        {customer.paid > 0 && <Line label="Less: payments received" value={customer.paid} />}
        {vendor.paid > 0 && <Line label="Add: payments made" value={vendor.paid} />}
      </dl>

      <div className="mt-3 pt-3 border-t border-zinc-200 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {settled ? 'Fully settled' : receivable ? 'Remaining receivable' : 'Remaining payable'}
          </p>
          <span
            className={`mt-1.5 inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
              settled ? 'bg-zinc-100 text-zinc-600' : receivable ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {settled ? 'Nothing to pay either way' : receivable ? `They will pay ${formatRs(net)}` : `You will pay ${formatRs(-net)}`}
          </span>
        </div>
        <p
          className={`text-2xl sm:text-3xl font-semibold tabular-nums ${
            settled ? 'text-zinc-900' : receivable ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatRs(Math.abs(net))}
        </p>
      </div>

      {(customer.adjusted > 0 || settleable > 0) && !open && (
        <p className="mt-3 text-xs text-zinc-500">
          {customer.adjusted > 0 && <>{formatRs(customer.adjusted)} already set off. </>}
          {settleable > 0 && (
            <>
              Up to {formatRs(settleable)} of unpaid bills can still be set off with <span className="font-medium">Adjust</span>.
            </>
          )}
        </p>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 p-3 sm:p-4 rounded-lg border border-zinc-200 bg-zinc-50 space-y-3" noValidate>
          <div>
            <p className="text-sm font-medium text-zinc-900">Adjust purchases against sales</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Clears {formatRs(parsed)} of their unpaid sales and {formatRs(parsed)} of your unpaid purchases, oldest first. The net
              balance stays the same.
            </p>
          </div>
          <FormError message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3">
            <Field label="Amount" htmlFor="adjust_amount" hint={`Up to ${formatRs(settleable)}`}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">Rs.</span>
                <input
                  id="adjust_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${inputClass} pl-10 font-medium`}
                  autoFocus
                />
              </div>
            </Field>
            <Field label="Date" htmlFor="adjust_date">
              <input id="adjust_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Note" htmlFor="adjust_notes" optional>
            <input
              id="adjust_notes"
              type="text"
              placeholder="e.g. Set off agreed with Mr. Khan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost')}>
              Cancel
            </button>
            <button type="submit" disabled={busy || parsed <= 0} className={buttonClass('primary')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save adjustment
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-medium text-zinc-900 tabular-nums">{formatRs(value)}</dd>
    </div>
  );
}
