'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRs, getTodayDateStr, calculateDueDate, formatDate } from '@/lib/format';
import { addSaleAction } from '@/app/actions/sales';
import { Check, Loader2, UserPlus, Plus } from 'lucide-react';
import { Material } from '@/lib/types';
import { Field, FormError, Segmented, buttonClass, inputClass } from './ui';
import { MaterialPills } from './MaterialPills';

export type CustomerOption = { id: string; name: string; phone?: string | null };

interface SaleFormProps {
  customers: CustomerOption[];
  materials: Material[];
  materialsAvailable: boolean;
  preselectedCustomerId?: string;
  cancelHref: string;
}

const BASE_UNITS = ['bag', 'ton', 'kg', 'truck', 'pcs', 'ft', 'sqft', 'litre', 'can'];
type Term = 30 | 60 | 90 | 'custom';

export function SaleForm({ customers, materials, materialsAvailable, preselectedCustomerId, cancelHref }: SaleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [saleDate, setSaleDate] = useState(getTodayDateStr());
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('bag');
  const [rate, setRate] = useState('');
  const [term, setTerm] = useState<Term>(30);
  const [customDays, setCustomDays] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [materialList, setMaterialList] = useState(materials);

  const parsedQty = Number(quantity) || 0;
  const parsedRate = Number(rate) || 0;
  const amount = parsedQty * parsedRate;
  const creditDays = term === 'custom' ? Number(customDays) || 0 : term;
  const dueDate = calculateDueDate(saleDate, creditDays);
  const units = BASE_UNITS.includes(unit) ? BASE_UNITS : [...BASE_UNITS, unit];

  if (customers.length === 0) {
    return <NoCustomersYet />;
  }

  const isNewMaterial =
    materialsAvailable &&
    material.trim() !== '' &&
    !materialList.some((m) => m.name.toLowerCase() === material.trim().toLowerCase());

  const pickMaterial = (m: Material) => {
    setMaterial(m.name);
    setUnit(m.unit);
    if (m.rate !== null) setRate(String(m.rate));
  };

  const handleMaterialChange = (value: string) => {
    setMaterial(value);
    // Typing a saved material's full name fills its unit, and its rate if none is entered yet
    const match = materialList.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setUnit(match.unit);
      if (!rate && match.rate !== null) setRate(String(match.rate));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerId) return setErrorMsg('Please select a customer.');
    if (!material.trim()) return setErrorMsg('Please enter the material.');
    if (parsedQty <= 0) return setErrorMsg('Quantity must be greater than 0.');
    if (parsedRate <= 0) return setErrorMsg('Rate must be greater than 0.');
    if (term === 'custom' && (customDays.trim() === '' || !Number.isInteger(Number(customDays)) || Number(customDays) < 0)) {
      return setErrorMsg('Enter credit days as a whole number (0 or more).');
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('sale_date', saleDate);
    formData.append('material', material);
    formData.append('quantity', String(parsedQty));
    formData.append('unit', unit);
    formData.append('rate', String(parsedRate));
    formData.append('credit_days', String(creditDays));
    if (notes.trim()) formData.append('notes', notes);

    const result = await addSaleAction(formData);

    if (result.success) {
      router.push(`/customers/${customerId}`);
      router.refresh();
    } else {
      setIsSubmitting(false);
      setErrorMsg(result.error || 'Failed to save sale.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={errorMsg} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {!preselectedCustomerId && (
          <Field label="Customer" htmlFor="customer" className="col-span-2 sm:col-span-3">
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
        <Field
          label="Sale date"
          htmlFor="sale_date"
          className={preselectedCustomerId ? 'col-span-2 sm:col-span-4 sm:max-w-[13rem]' : 'col-span-2 sm:col-span-1'}
        >
          <input id="sale_date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={inputClass} required />
        </Field>

        <Field label="Material" htmlFor="material" className="col-span-2 sm:col-span-4">
          <MaterialPills
            materials={materialList}
            onMaterialsChange={setMaterialList}
            available={materialsAvailable}
            units={BASE_UNITS}
            selectedName={material}
            filterText={material}
            onPick={pickMaterial}
          />
          <input
            id="material"
            type="text"
            autoComplete="off"
            placeholder="Pick above or type a material"
            value={material}
            onChange={(e) => handleMaterialChange(e.target.value)}
            className={inputClass}
            required
          />
          {isNewMaterial && <p className="text-xs text-zinc-500">New material. It will be saved as a pill for next time.</p>}
        </Field>
        <Field label="Unit" htmlFor="unit">
          <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity" htmlFor="quantity">
          <input
            id="quantity"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Rate (Rs.)" htmlFor="rate" hint={unit ? `per ${unit}` : undefined}>
          <input
            id="rate"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Amount">
          <div className="h-10 px-3 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-semibold text-zinc-900 flex items-center tabular-nums">
            {formatRs(amount)}
          </div>
        </Field>
      </div>

      <Field label="Credit term" hint={<>Due <span className="font-medium text-zinc-900">{formatDate(dueDate)}</span></>}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:w-80">
            <Segmented<Term>
              ariaLabel="Credit term"
              value={term}
              onChange={setTerm}
              options={[
                { label: '30 days', value: 30 },
                { label: '60 days', value: 60 },
                { label: '90 days', value: 90 },
                { label: 'Custom', value: 'custom' },
              ]}
            />
          </div>
          {term === 'custom' && (
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="Days"
              aria-label="Custom credit days"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className={`${inputClass} sm:w-28`}
              autoFocus
            />
          )}
        </div>
      </Field>

      {showNotes ? (
        <Field label="Notes" htmlFor="notes" optional>
          <input
            id="notes"
            type="text"
            placeholder="Site, vehicle or bill reference"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
          <Plus className="w-4 h-4" />
          Add note
        </button>
      )}

      <FormFooter cancelHref={cancelHref} isSubmitting={isSubmitting} label={`Save sale · ${formatRs(amount)}`} />
    </form>
  );
}

export function FormFooter({
  cancelHref,
  isSubmitting,
  label,
  variant = 'primary',
}: {
  cancelHref: string;
  isSubmitting: boolean;
  label: string;
  variant?: 'primary' | 'success';
}) {
  return (
    <div className="pt-4 border-t border-zinc-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <Link href={cancelHref} className={buttonClass('secondary', 'h-10')}>
        Cancel
      </Link>
      <button type="submit" disabled={isSubmitting} className={buttonClass(variant, 'h-10 px-5')}>
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {isSubmitting ? 'Saving…' : label}
      </button>
    </div>
  );
}

export function NoCustomersYet() {
  return (
    <div className="text-center py-8">
      <p className="text-sm font-medium text-zinc-900">No customers yet</p>
      <p className="text-sm text-zinc-500 mt-1">Add a customer first, then record sales and payments.</p>
      <Link href="/customers/new" className={buttonClass('primary', 'mt-4')}>
        <UserPlus className="w-4 h-4" />
        Add customer
      </Link>
    </div>
  );
}
