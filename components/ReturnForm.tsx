'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatRs, getTodayDateStr } from '@/lib/format';
import { getCustomerSalesAction } from '@/app/actions/payments';
import { addReturnAction, updateReturnAction } from '@/app/actions/returns';
import { Payment, SaleOption } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { Field, FormError, inputClass } from './ui';
import { FormFooter, NoContactsYet } from './SaleForm';
import { Select, SelectOption } from './Select';
import type { PaymentCustomerOption } from './PaymentForm';

interface ReturnFormProps {
  kind: ContactKind; // customer: goods a customer returned; vendor: goods you returned to a vendor
  customers: PaymentCustomerOption[];
  preselectedCustomerId?: string;
  initialSales?: SaleOption[]; // bills of the preselected (or edited) party
  cancelHref: string;
  entry?: Payment; // editing this return
}

const REASONS = ['Damaged', 'Wrong item', 'Excess quantity', 'Quality issue', 'Rate difference'];

function billOption(s: SaleOption): SelectOption {
  const qty = s.quantity ? ` · ${s.quantity} ${s.unit}` : '';
  return {
    value: s.id,
    label: s.material,
    description: `${formatDate(s.sale_date)}${qty} · ${formatRs(s.amount)}`,
    meta: s.outstanding > 0 ? `${formatRs(s.outstanding)} due` : 'Paid',
  };
}

export function ReturnForm({ kind, customers, preselectedCustomerId, initialSales, cancelHref, entry }: ReturnFormProps) {
  const router = useRouter();
  const terms = SIDES[kind];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialCustomerId = entry?.customer_id ?? (preselectedCustomerId || '');
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [returnDate, setReturnDate] = useState(entry?.payment_date ?? getTodayDateStr());
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [reason, setReason] = useState(entry?.notes ?? '');
  const [saleId, setSaleId] = useState(entry?.sale_id ?? '');
  const [billsByParty, setBillsByParty] = useState<Record<string, SaleOption[]>>(
    initialCustomerId && initialSales ? { [initialCustomerId]: initialSales } : {}
  );
  const [loadingBills, setLoadingBills] = useState(false);
  const latestRequest = useRef('');

  const parsedAmount = Number(amount) || 0;
  const selected = customers.find((c) => c.id === customerId);
  const bills = customerId ? billsByParty[customerId] : undefined;

  const handlePartyChange = async (id: string) => {
    setCustomerId(id);
    setSaleId('');
    if (!id || billsByParty[id]) return;
    latestRequest.current = id;
    setLoadingBills(true);
    const result = await getCustomerSalesAction(id, kind);
    if (latestRequest.current !== id) return;
    setLoadingBills(false);
    if (result.success) setBillsByParty((prev) => ({ ...prev, [id]: result.sales }));
    else setErrorMsg(result.error);
  };

  if (customers.length === 0) return <NoContactsYet kind={kind} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!customerId) return setErrorMsg(`Please select a ${terms.one}.`);
    if (parsedAmount <= 0) return setErrorMsg('The return amount must be greater than 0.');
    if (reason.trim().length < 2) return setErrorMsg('Please enter the reason for the return.');

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('customer_id', customerId);
    formData.append('return_date', returnDate);
    formData.append('amount', String(parsedAmount));
    formData.append('reason', reason.trim());
    if (saleId) formData.append('sale_id', saleId);

    const result = entry ? await updateReturnAction(entry.id, formData) : await addReturnAction(formData);
    if (result.success) {
      router.push(`${terms.base}/${customerId}`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setErrorMsg(result.error || 'Failed to save the return.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={errorMsg} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {!preselectedCustomerId && (
          <Field label={terms.One} htmlFor="customer" className="sm:col-span-2">
            <Select
              id="customer"
              value={customerId}
              onChange={handlePartyChange}
              placeholder={`Select ${terms.one}…`}
              searchPlaceholder={`Search ${terms.many}…`}
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
                meta: c.outstanding > 0 ? `${formatRs(c.outstanding)} due` : 'No balance',
              }))}
            />
          </Field>
        )}
        <Field label="Return date" htmlFor="return_date" className={preselectedCustomerId ? 'sm:col-span-3 sm:max-w-[13rem]' : ''}>
          <input
            id="return_date"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
      </div>

      {customerId && (
        <Field
          label={`Returned from ${terms.entry}`}
          htmlFor="sale"
          optional
          hint={loadingBills ? `Loading ${terms.entry}s…` : bills?.length === 0 ? `No ${terms.entry}s yet` : undefined}
        >
          <Select
            id="sale"
            value={saleId}
            onChange={setSaleId}
            disabled={loadingBills || !bills?.length}
            searchPlaceholder="Search material or date…"
            options={[
              { value: '', label: `Not linked to a ${terms.entry}`, description: `Taken off the oldest unpaid ${terms.entry}s first` },
              ...(bills ?? []).map(billOption),
            ]}
          />
        </Field>
      )}

      <Field label="Amount returned" htmlFor="amount" hint="Value of the goods returned">
        <div className="relative sm:max-w-xs">
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

      <Field label="Reason" htmlFor="reason">
        <input
          id="reason"
          type="text"
          maxLength={200}
          placeholder="Why the goods were returned"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
          required
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`h-7 px-2.5 rounded-full border text-xs font-medium ${
                reason === r ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </Field>

      <p className="text-xs text-zinc-500">
        {kind === 'vendor'
          ? `Lowers what you owe ${selected?.name ?? 'the vendor'}. It is shown as a return, not as a payment made.`
          : `Lowers what ${selected?.name ?? 'the customer'} owes you. It is shown as a return, not as a payment received.`}
      </p>

      <FormFooter
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        label={entry ? `Save changes · ${formatRs(parsedAmount)}` : `Save return · ${formatRs(parsedAmount)}`}
      />
    </form>
  );
}
