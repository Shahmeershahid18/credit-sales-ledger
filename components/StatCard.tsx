import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  subtext?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  className?: string;
}

const variantStyles = {
  default: { value: 'text-zinc-900', icon: 'bg-zinc-100 text-zinc-600' },
  success: { value: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-600' },
  danger: { value: 'text-rose-700', icon: 'bg-rose-50 text-rose-600' },
  warning: { value: 'text-amber-700', icon: 'bg-amber-50 text-amber-600' },
};

export function StatCard({ label, value, icon: Icon, subtext, variant = 'default', className = '' }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`bg-white rounded-xl border border-zinc-200 shadow-xs p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-medium text-zinc-500">{label}</p>
        {Icon && (
          <span className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center shrink-0 ${styles.icon}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className={`mt-2 text-lg sm:text-2xl font-semibold tracking-tight tabular-nums break-words ${styles.value}`}>
        {value}
      </p>
      {subtext && <p className="mt-1 text-xs text-zinc-500">{subtext}</p>}
    </div>
  );
}
