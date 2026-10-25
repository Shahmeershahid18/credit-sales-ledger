import React from 'react';
import { CustomerStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: CustomerStatus | 'Paid' | 'Pending' | 'Overdue' | '—';
  className?: string;
}

const styles = {
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', className: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  pending: { label: 'Payment Pending', className: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = styles[status.toLowerCase() as keyof typeof styles];

  if (!style) {
    return <span className={`text-xs text-zinc-400 ${className}`}>—</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset whitespace-nowrap ${style.className} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
