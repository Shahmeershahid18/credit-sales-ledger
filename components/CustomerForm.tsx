'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addCustomerAction, updateCustomerAction } from '@/app/actions/customers';
import { Customer } from '@/lib/types';
import { User, Phone, MapPin, Loader2, Check } from 'lucide-react';

interface CustomerFormProps {
  customer?: Customer; // when set, the form edits this customer
  onSuccess?: () => void;
}

export function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Customer or business name is required');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('address', address);

    const result = customer
      ? await updateCustomerAction(customer.id, formData)
      : await addCustomerAction(formData);
    setIsSubmitting(false);

    if (result.success && result.customer) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/customers/${result.customer.id}`);
        router.refresh();
      }
    } else {
      setErrorMsg(result.error || (isEdit ? 'Failed to update customer' : 'Failed to add customer'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Customer Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          Customer / Business Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Ali Traders, Metro Builders"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          required
        />
      </div>

      {/* Phone Number */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-zinc-400" />
          Phone / WhatsApp Number
        </label>
        <input
          type="text"
          placeholder="e.g. +92 300 1234567 or 03001234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <p className="text-[11px] text-zinc-400">Used for sending 1-click WhatsApp payment reminders</p>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
          Shop / Site Address
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Shop #14, Main Timber Market, Lahore"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isEdit ? 'Saving Changes...' : 'Adding Customer...'}</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>{isEdit ? 'Save Changes' : 'Add Customer'}</span>
          </>
        )}
      </button>
    </form>
  );
}
