import React from 'react';
import { CustomerStatus } from '@/lib/types';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: CustomerStatus | 'Paid' | 'Pending' | 'Overdue' | '—';
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className = '', showIcon = true }: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  if (normalized === 'paid') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs ${className}`}
      >
        {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        <span>Paid</span>
      </span>
    );
  }

  if (normalized === 'overdue') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs animate-pulse ${className}`}
      >
        {showIcon && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
        <span>Overdue</span>
      </span>
    );
  }

  if (normalized === 'pending' || normalized === 'payment pending') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-amber-50 text-amber-800 border border-amber-200/90 shadow-xs ${className}`}
      >
        {showIcon && <Clock className="w-3.5 h-3.5 text-amber-600" />}
        <span>Payment Pending</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs text-slate-400 font-medium ${className}`}>
      —
    </span>
  );
}
