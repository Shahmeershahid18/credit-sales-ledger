import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Shared building blocks so every page uses the same spacing, type and controls.

export const buttonStyles = {
  base: 'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
  size: 'h-9 px-3.5',
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
};

export type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost';

export function buttonClass(variant: ButtonVariant = 'primary', extra = '') {
  return `${buttonStyles.base} ${buttonStyles.size} ${buttonStyles[variant]} ${extra}`;
}

export const inputClass =
  'w-full h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50';

export const cardClass = 'bg-white rounded-xl border border-zinc-200 shadow-xs';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="mt-0.5 shrink-0 w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {description && <div className="text-sm text-zinc-500 mt-0.5">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, optional, className = '', children }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="flex items-center justify-between text-sm font-medium text-zinc-700">
        <span>
          {label}
          {optional && <span className="ml-1 font-normal text-zinc-400">(optional)</span>}
        </span>
        {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
      {message}
    </p>
  );
}

interface SegmentedProps<T extends string | number> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-lg bg-zinc-100">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`h-8 rounded-md text-sm font-medium transition-colors ${
              selected ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12 px-6 text-center">
      {icon && <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center">{icon}</div>}
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {description && <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
