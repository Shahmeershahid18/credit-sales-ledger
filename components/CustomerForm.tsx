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
  const terms = SIDES[customer?.kind ?? kind];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      return setErrorMsg(`${terms.One} name must be at least 2 characters.`);
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('kind', terms.kind);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('address', address);

    const result = customer
      ? await updateCustomerAction(customer.id, formData)
      : await addCustomerAction(formData);

    if (result.success && result.customer) {
      router.push(`${terms.base}/${result.customer.id}`);
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

      <FormFooter cancelHref={cancelHref} isSubmitting={isSubmitting} label={isEdit ? 'Save changes' : `Add ${terms.one}`} />
    </form>
  );
}
