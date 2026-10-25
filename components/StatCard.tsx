import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  subtext?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  variant = 'default',
  className = '',
}: StatCardProps) {
  // Color accents based on variant
  const variantStyles = {
    default: {
      bg: 'bg-zinc-100/90 hover:bg-zinc-100',
      border: 'border-zinc-200/80',
      valueColor: 'text-zinc-900',
      iconBg: 'bg-zinc-200/70 text-zinc-700',
    },
    success: {
      bg: 'bg-emerald-50/80 hover:bg-emerald-50',
      border: 'border-emerald-200/70',
      valueColor: 'text-emerald-800',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    danger: {
      bg: 'bg-rose-50/80 hover:bg-rose-50',
      border: 'border-rose-200/70',
      valueColor: 'text-rose-700',
      iconBg: 'bg-rose-100 text-rose-700',
    },
    warning: {
      bg: 'bg-amber-50/80 hover:bg-amber-50',
      border: 'border-amber-200/70',
      valueColor: 'text-amber-800',
      iconBg: 'bg-amber-100 text-amber-700',
    },
    primary: {
      bg: 'bg-sky-50/80 hover:bg-sky-50',
      border: 'border-sky-200/70',
      valueColor: 'text-sky-900',
      iconBg: 'bg-sky-100 text-sky-700',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <div
      className={`relative p-5 rounded-2xl border transition-all duration-200 shadow-xs ${currentVariant.bg} ${currentVariant.border} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wider uppercase text-zinc-500">
            {label}
          </p>
          <p className={`text-2xl md:text-3xl font-extrabold tracking-tight ${currentVariant.valueColor}`}>
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-zinc-500 font-medium pt-0.5">
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl shrink-0 ${currentVariant.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
