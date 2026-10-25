'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Customer } from '@/lib/types';
import { formatRs, getTodayDateStr, calculateDueDate, formatDate } from '@/lib/format';
import { addSaleAction } from '@/app/actions/sales';
import { Calculator, Calendar, Tag, Check, Loader2, UserPlus } from 'lucide-react';

interface SaleFormProps {
  customers: Customer[];
  preselectedCustomerId?: string;
  onSuccess?: () => void;
}

export function SaleForm({ customers, preselectedCustomerId, onSuccess }: SaleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(preselectedCustomerId || (customers[0]?.id || ''));
  const [saleDate, setSaleDate] = useState(getTodayDateStr());
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unit, setUnit] = useState('bag');
  const [rate, setRate] = useState<number | string>('');
  const [creditDays, setCreditDays] = useState<number>(30);
  const [customDays, setCustomDays] = useState<string>('');
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [notes, setNotes] = useState('');

  // Auto calculate Amount and Due Date
  const parsedQty = Number(quantity) || 0;
  const parsedRate = Number(rate) || 0;
  const calculatedAmount = parsedQty * parsedRate;
  const activeDays = isCustomDays ? Number(customDays) || 0 : creditDays;
  const calculatedDueDate = calculateDueDate(saleDate, activeDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerId) {
      setErrorMsg('Please select a customer');
      return;
    }
    if (!material.trim()) {
      setErrorMsg('Please enter the material or item name');
      return;
    }
    if (parsedQty <= 0) {
      setErrorMsg('Quantity must be greater than 0');
      return;
    }
    if (parsedRate <= 0) {
      setErrorMsg('Rate must be greater than 0');
      return;
    }
    if (isCustomDays && (customDays.trim() === '' || !Number.isInteger(Number(customDays)) || Number(customDays) < 0)) {
      setErrorMsg('Enter custom credit days as a whole number (0 or more)');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('sale_date', saleDate);
    formData.append('material', material);
    formData.append('quantity', parsedQty.toString());
    formData.append('unit', unit);
    formData.append('rate', parsedRate.toString());
    formData.append('credit_days', activeDays.toString());
    if (notes) formData.append('notes', notes);

    const result = await addSaleAction(formData);
    setIsSubmitting(false);

    if (result.success) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/customers/${customerId}`);
        router.refresh();
      }
    } else {
      setErrorMsg(result.error || 'Failed to save sale');
    }
  };

  const commonMaterials = [
    { name: 'DG Cement', unit: 'bag', defaultRate: 1500 },
    { name: 'Bestway Cement', unit: 'bag', defaultRate: 1350 },
    { name: 'Steel 60-Grade (TMT)', unit: 'ton', defaultRate: 260000 },
    { name: 'Sand (Ravi)', unit: 'truck', defaultRate: 25000 },
    { name: 'Crush (Margalla)', unit: 'truck', defaultRate: 65000 },
    { name: 'Red Bricks', unit: 'pcs', defaultRate: 15 },
  ];

  if (customers.length === 0) {
    return <NoCustomersYet />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Customer Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Customer <span className="text-rose-500">*</span>
        </label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          required
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `(${c.phone})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          Sale Date <span className="text-rose-500">*</span>
        </label>
        <input
          type="date"
          value={saleDate}
          onChange={(e) => setSaleDate(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          required
        />
      </div>

      {/* Quick Material Presets */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-zinc-400" />
          Material / Item <span className="text-rose-500">*</span>
        </label>

        {/* Quick Suggestions Chips */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {commonMaterials.map((mat) => (
            <button
              type="button"
              key={mat.name}
              onClick={() => {
                setMaterial(mat.name);
                setUnit(mat.unit);
                if (!rate) setRate(mat.defaultRate);
              }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
            >
              + {mat.name}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="e.g. DG Cement Bags, Steel 60 Grade..."
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          required
        />
      </div>

      {/* Quantity, Unit & Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Quantity */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Quantity <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            min="0.01"
            placeholder="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            required
          />
        </div>

        {/* Unit */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Unit
          </label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="bag">Bag</option>
            <option value="ton">Ton</option>
            <option value="truck">Truck / Dumper</option>
            <option value="kg">Kg</option>
            <option value="pcs">Pcs</option>
            <option value="ft">Feet</option>
            <option value="sqft">Sq. Ft</option>
          </select>
        </div>

        {/* Rate */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Rate per unit <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="1500"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            required
          />
        </div>
      </div>

      {/* Auto-calculated Total Amount Display */}
      <div className="bg-zinc-100 rounded-2xl p-4 border border-zinc-200/80 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Total Sale Amount (Qty × Rate)
          </p>
          <p className="text-2xl font-extrabold text-zinc-900 mt-0.5">
            {formatRs(calculatedAmount)}
          </p>
        </div>
        <div className="p-3 bg-zinc-200/70 rounded-xl text-zinc-700">
          <Calculator className="w-5 h-5" />
        </div>
      </div>

      {/* Credit Terms (30 / 60 / 90 quick buttons) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
          <span>Credit Days (Payment Term)</span>
          <span className="text-emerald-700 font-bold normal-case">
            Due on: {formatDate(calculatedDueDate)}
          </span>
        </label>

        <div className="grid grid-cols-4 gap-2">
          {[30, 60, 90].map((days) => (
            <button
              type="button"
              key={days}
              onClick={() => {
                setCreditDays(days);
                setIsCustomDays(false);
              }}
              className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                !isCustomDays && creditDays === days
                  ? 'bg-zinc-900 text-white shadow-xs ring-2 ring-zinc-900 ring-offset-1'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              {days} Days
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsCustomDays(true)}
            className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
              isCustomDays
                ? 'bg-zinc-900 text-white shadow-xs ring-2 ring-zinc-900 ring-offset-1'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            Custom
          </button>
        </div>

        {isCustomDays && (
          <div className="pt-2">
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Enter custom days (e.g. 15, 45, 120)..."
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Notes / Site Reference (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Site B second floor delivery, Truck # LES-491"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
            <span>Recording Sale...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>Record Credit Sale ({formatRs(calculatedAmount)})</span>
          </>
        )}
      </button>
    </form>
  );
}

export function NoCustomersYet() {
  return (
    <div className="text-center space-y-3 py-6">
      <p className="text-sm font-bold text-zinc-800">No customers yet</p>
      <p className="text-xs text-zinc-500">Add a customer first, then record sales and payments for them.</p>
      <Link
        href="/customers/new"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span>Add First Customer</span>
      </Link>
    </div>
  );
}
