'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Customer } from '@/lib/types';
import { formatRs, getTodayDateStr } from '@/lib/format';
import { addPaymentAction } from '@/app/actions/payments';
import { NoCustomersYet } from './SaleForm';
import { Calendar, Wallet, Landmark, CheckSquare, Loader2, Check } from 'lucide-react';

interface PaymentFormProps {
  customers: Customer[];
  preselectedCustomerId?: string;
  onSuccess?: () => void;
}

export function PaymentForm({ customers, preselectedCustomerId, onSuccess }: PaymentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(preselectedCustomerId || (customers[0]?.id || ''));
  const [paymentDate, setPaymentDate] = useState(getTodayDateStr());
  const [amount, setAmount] = useState<number | string>('');
  const [method, setMethod] = useState<'cash' | 'bank' | 'cheque'>('bank');
  const [notes, setNotes] = useState('');

  const parsedAmount = Number(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerId) {
      setErrorMsg('Please select a customer');
      return;
    }
    if (parsedAmount <= 0) {
      setErrorMsg('Payment amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('payment_date', paymentDate);
    formData.append('amount', parsedAmount.toString());
    formData.append('method', method);
    if (notes) formData.append('notes', notes);

    const result = await addPaymentAction(formData);
    setIsSubmitting(false);

    if (result.success) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/customers/${customerId}`);
        router.refresh();
      }
    } else {
      setErrorMsg(result.error || 'Failed to record payment');
    }
  };

  const quickAmounts = [25000, 50000, 100000, 200000, 500000];

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
          Payment Date <span className="text-rose-500">*</span>
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          required
        />
      </div>

      {/* Payment Amount */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Amount Received (PKR) <span className="text-rose-500">*</span>
        </label>

        {/* Quick Amount Buttons */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {quickAmounts.map((amt) => (
            <button
              type="button"
              key={amt}
              onClick={() => setAmount(amt)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
            >
              + {formatRs(amt)}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">
            Rs.
          </span>
          <input
            type="number"
            step="any"
            min="1"
            placeholder="e.g. 100000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-12 pr-3.5 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            required
          />
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Payment Method <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
              method === 'bank'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Landmark className="w-4 h-4 text-emerald-600" />
            <span>Bank Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('cash')}
            className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
              method === 'cash'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Cash Collection</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('cheque')}
            className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
              method === 'cheque'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>Cheque / Pay Order</span>
          </button>
        </div>
      </div>

      {/* Notes / Reference */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
          Bank / Cheque Details / Notes (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Meezan Bank ref #78902, or Habib Bank Cheque #44102"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      {/* FIFO Info Note */}
      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs text-zinc-600">
        <span className="font-bold text-zinc-900">FIFO Automatic Settlement: </span>
        This payment will automatically settle the customer&apos;s oldest unpaid sales first, keeping overdue calculations accurate without manual allocation.
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Recording Payment...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>Record Payment ({formatRs(parsedAmount)})</span>
          </>
        )}
      </button>
    </form>
  );
}
