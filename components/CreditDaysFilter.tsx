import React from 'react';
import Link from 'next/link';

interface CreditDaysFilterProps {
  currentFilter?: number;
  basePath: string; // /overdue or /bills
}

const OPTIONS = [
  { label: 'All terms', value: undefined },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

export function CreditDaysFilter({ currentFilter, basePath }: CreditDaysFilterProps) {
  return (
    <nav aria-label="Credit term" className="flex gap-1 p-1 rounded-lg bg-zinc-100 overflow-x-auto self-start">
      {OPTIONS.map((opt) => {
        const active = currentFilter === opt.value;
        return (
          <Link
            key={opt.label}
            href={opt.value ? `${basePath}?days=${opt.value}` : basePath}
            aria-current={active ? 'page' : undefined}
            className={`h-8 px-3 rounded-md text-sm font-medium whitespace-nowrap flex items-center ${
              active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
}
