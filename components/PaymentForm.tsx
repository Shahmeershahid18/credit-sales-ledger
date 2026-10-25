'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRs, getTodayDateStr } from '@/lib/format';
import { addPaymentAction } from '@/app/actions/payments';
import { PaymentMethod } from '@/lib/types';
import { Field, FormError, Segmented, inputClass } from './ui';
import { FormFooter, NoCustomersYet } from './SaleForm';

export type PaymentCustomerOption = { id: string; name: string; outstanding: number; overdue: number };

interface PaymentFormProps {
  customers: PaymentCustomerOption[];
  preselectedCustomerId?: string;
  cancelHref: string;
}

export function PaymentForm({ customers, preselectedCustomerId, cancelHref }: PaymentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [paymentDate, setPaymentDate] = useState(getTodayDateStr());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  const parsedAmount = Number(amount) || 0;
  const selected = customers.find((c) => c.id === customerId);

  if (customers.length === 0) {
    return <NoCustomersYet />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerId) return setErrorMsg('Please select a customer.');
    if (parsedAmount <= 0) return setErrorMsg('Payment amount must be greater than 0.');

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('payment_date', paymentDate);
    formData.append('amount', String(parsedAmount));
    formData.append('method', method);
    if (notes.trim()) formData.append('notes', notes);

    const result = await addPaymentAction(formData);

    if (result.success) {
      router.push(`/customers/${customerId}`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setErrorMsg(result.error || 'Failed to record payment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={errorMsg} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {!preselectedCustomerId && (
          <Field label="Customer" htmlFor="customer" className="sm:col-span-2">
            <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass} required>
              <option value="" disabled>
                Select customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Payment date" htmlFor="payment_date" className={preselectedCustomerId ? 'sm:col-span-3 sm:max-w-[13rem]' : ''}>
          <input
            id="payment_date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm">
          <span className="text-zinc-600">
            Outstanding <span className="font-semibold text-zinc-900 tabular-nums">{formatRs(selected.outstanding)}</span>
            {selected.overdue > 0 && (
              <>
                {' · '}Overdue <span className="font-semibold text-rose-700 tabular-nums">{formatRs(selected.overdue)}</span>
              </>
            )}
          </span>
          {selected.outstanding > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(selected.outstanding))}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Pay full balance
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Amount received" htmlFor="amount">
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
        <Field label="Method">
          <Segmented<PaymentMethod>
            ariaLabel="Payment method"
            value={method}
            onChange={setMethod}
            options={[
              { label: 'Cash', value: 'cash' },
              { label: 'Bank', value: 'bank' },
              { label: 'Cheque', value: 'cheque' },
            ]}
          />
        </Field>
      </div>

      <Field label="Reference" htmlFor="notes" optional>
        <input
          id="notes"
          type="text"
          placeholder={method === 'cheque' ? 'Cheque number and bank' : method === 'bank' ? 'Transaction ID' : 'Received by, receipt no.'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      <p className="text-xs text-zinc-500">Payments are applied to the oldest unpaid sales first.</p>

      <FormFooter
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        variant="success"
        label={`Save payment · ${formatRs(parsedAmount)}`}
      />
    </form>
  );
}
