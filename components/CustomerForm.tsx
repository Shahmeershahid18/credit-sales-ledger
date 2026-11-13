'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addCustomerAction, updateCustomerAction } from '@/app/actions/customers';
import { Plus, X } from 'lucide-react';
import { Customer, OpeningBalance } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatDate, getTodayDateStr } from '@/lib/format';
import { Field, FormError, Segmented, inputClass } from './ui';
import { FormFooter } from './SaleForm';

interface CustomerFormProps {
  kind: ContactKind;
  customer?: Customer; // when set, the form edits this customer or vendor
  opening?: OpeningBalance | null; // the party's current opening balance
  cancelHref: string;
}

type Direction = OpeningBalance['direction'];

export function CustomerForm({ kind, customer, opening, cancelHref }: CustomerFormProps) {
  const router = useRouter();
  const terms = SIDES[kind];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [isCustomer, setIsCustomer] = useState(customer ? customer.is_customer : kind === 'customer');
  const [isVendor, setIsVendor] = useState(customer ? customer.is_vendor : kind === 'vendor');

  // Opening balance: what was owed before this party's first entry in the app
  const [showOpening, setShowOpening] = useState(Boolean(opening));
  const [openingAmount, setOpeningAmount] = useState(opening ? String(opening.amount) : '');
  const [direction, setDirection] = useState<Direction>(opening?.direction ?? (kind === 'vendor' ? 'payable' : 'receivable'));
  const [openingDate, setOpeningDate] = useState(opening?.date ?? getTodayDateStr());
  const [openingDue, setOpeningDue] = useState(opening?.due_date && opening.due_date !== opening.date ? opening.due_date : '');
  // A balance on a side the party does not have is kept as an advance on its other side
  const isAdvance = direction === 'receivable' ? !isCustomer && isVendor : isCustomer && !isVendor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      return setErrorMsg('Name must be at least 2 characters.');
    }
    if (!isCustomer && !isVendor) {
      return setErrorMsg('Choose customer, vendor or both.');
    }
    const amount = showOpening ? Number(openingAmount || 0) : 0;
    if (showOpening && (!Number.isFinite(amount) || amount < 0)) {
      return setErrorMsg('Enter the opening balance as an amount (0 or more).');
    }
    if (showOpening && !isAdvance && openingDue && openingDue < openingDate) {
      return setErrorMsg('The due date cannot be before the opening balance date.');
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('is_customer', String(isCustomer));
    formData.append('is_vendor', String(isVendor));
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('address', address);
    // Sent when shown, or to remove an existing opening balance (amount 0)
    if (showOpening || opening) {
      formData.append('opening_amount', String(amount));
      formData.append('opening_direction', direction);
      formData.append('opening_date', openingDate);
      if (!isAdvance && openingDue) formData.append('opening_due_date', openingDue);
    }

    const result = customer
      ? await updateCustomerAction(customer.id, formData)
      : await addCustomerAction(formData);

    if (result.success && result.customer) {
      if ('warning' in result && result.warning) window.alert(result.warning);
      // Stay on this side when the party still has the role, otherwise open the other side
      const keepsRole = kind === 'vendor' ? result.customer.is_vendor : result.customer.is_customer;
      router.push(`${keepsRole ? terms.base : SIDES[kind === 'vendor' ? 'customer' : 'vendor'].base}/${result.customer.id}`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setErrorMsg(result.error || (isEdit ? 'Failed to save changes.' : `Failed to add ${terms.one}.`));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={errorMsg} />

      <Field label={terms.nameLabel} htmlFor="name">
        <input
          id="name"
          type="text"
          autoComplete="organization"
          placeholder={terms.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          required
          autoFocus={!isEdit}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone / WhatsApp" htmlFor="phone" optional>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="0300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Address" htmlFor="address" optional>
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            placeholder="Shop, market, city"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-700">This party is a</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <RoleOption
            checked={isCustomer}
            onChange={setIsCustomer}
            title="Customer"
            text="You sell to them on credit"
          />
          <RoleOption checked={isVendor} onChange={setIsVendor} title="Vendor" text="You buy from them on credit" />
        </div>
        <p className="text-xs text-zinc-500">
          Pick both for a business you sell to and buy from. Its sales and purchases share one ledger with a net balance.
        </p>
      </fieldset>

      {showOpening ? (
        <fieldset
          id="opening"
          aria-labelledby="opening-title"
          className="space-y-4 p-4 rounded-lg border border-zinc-200 bg-zinc-50/60 scroll-mt-24"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id="opening-title" className="text-sm font-medium text-zinc-900">
                Opening balance
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">What was owed before you started recording this party here.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowOpening(false)}
              className="shrink-0 text-xs font-medium text-zinc-500 hover:text-rose-700 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {opening ? 'Remove' : 'Cancel'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="opening_amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">Rs.</span>
                <input
                  id="opening_amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className={`${inputClass} pl-10 font-medium`}
                />
              </div>
            </Field>
            <Field label="Who owes whom">
              <Segmented<Direction>
                ariaLabel="Who owes whom"
                value={direction}
                onChange={setDirection}
                options={[
                  { label: 'They owe me', value: 'receivable' },
                  { label: 'I owe them', value: 'payable' },
                ]}
              />
            </Field>
            <Field label="As of" htmlFor="opening_date" hint="The date it was brought forward">
              <input
                id="opening_date"
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            {!isAdvance && (
              <Field label="Due date" htmlFor="opening_due_date" optional hint="Empty if already due">
                <input
                  id="opening_due_date"
                  type="date"
                  min={openingDate}
                  value={openingDue}
                  onChange={(e) => setOpeningDue(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            {isAdvance
              ? direction === 'payable'
                ? 'Kept as an advance they paid you: it is set against their next sales.'
                : 'Kept as an advance you paid them: it is set against their next purchases.'
              : `Shown as the first line of the ledger on ${formatDate(openingDate)} and paid off first. Reports do not count it as a ${
                  direction === 'payable' ? 'purchase' : 'sale'
                }.`}
          </p>
        </fieldset>
      ) : (
        <button
          type="button"
          onClick={() => setShowOpening(true)}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          {opening ? 'Keep the opening balance' : 'Add opening balance'}
        </button>
      )}

      <FormFooter cancelHref={cancelHref} isSubmitting={isSubmitting} label={isEdit ? 'Save changes' : `Add ${terms.one}`} />
    </form>
  );
}

function RoleOption({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked ? 'border-emerald-500 bg-emerald-50/60' : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
      />
      <span>
        <span className="block text-sm font-medium text-zinc-900">{title}</span>
        <span className="block text-xs text-zinc-500">{text}</span>
      </span>
    </label>
  );
}
