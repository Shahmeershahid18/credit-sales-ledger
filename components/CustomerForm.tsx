'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addCustomerAction, updateCustomerAction } from '@/app/actions/customers';
import { Customer } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { Field, FormError, inputClass } from './ui';
import { FormFooter } from './SaleForm';

interface CustomerFormProps {
  kind: ContactKind;
  customer?: Customer; // when set, the form edits this customer or vendor
  cancelHref: string;
}

export function CustomerForm({ kind, customer, cancelHref }: CustomerFormProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      return setErrorMsg('Name must be at least 2 characters.');
    }
    if (!isCustomer && !isVendor) {
      return setErrorMsg('Choose customer, vendor or both.');
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('is_customer', String(isCustomer));
    formData.append('is_vendor', String(isVendor));
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('address', address);

    const result = customer
      ? await updateCustomerAction(customer.id, formData)
      : await addCustomerAction(formData);

    if (result.success && result.customer) {
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
