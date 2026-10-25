'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CreditDaysFilterProps {
  currentFilter?: number;
}

export function CreditDaysFilter({ currentFilter }: CreditDaysFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (days?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (days) {
      params.set('days', days.toString());
    } else {
      params.delete('days');
    }
    router.push(`/overdue?${params.toString()}`);
  };

  const options = [
    { label: 'All Terms', value: undefined },
    { label: '30 Days Term', value: 30 },
    { label: '60 Days Term', value: 60 },
    { label: '90 Days Term', value: 90 },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-semibold text-zinc-500 mr-1">Credit Terms:</span>
      {options.map((opt) => {
        const isSelected = currentFilter === opt.value || (!currentFilter && opt.value === undefined);
        return (
          <button
            key={opt.label}
            onClick={() => handleSelect(opt.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
              isSelected
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
