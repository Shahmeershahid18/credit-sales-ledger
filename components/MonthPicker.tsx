'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, getCurrentMonthStr } from '@/lib/format';

interface MonthPickerProps {
  currentMonth: string; // YYYY-MM
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const thisMonth = getCurrentMonthStr();
  const go = (month: string) => router.push(`/reports/monthly?month=${month}`);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center h-9 rounded-lg border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => go(shiftMonth(currentMonth, -1))}
          className="w-9 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-900"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <label className="relative h-full px-2 flex items-center text-sm font-medium text-zinc-900 min-w-[8.5rem] justify-center cursor-pointer">
          {formatMonth(currentMonth)}
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick a month"
          />
        </label>
        <button
          type="button"
          onClick={() => go(shiftMonth(currentMonth, 1))}
          className="w-9 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-900"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {currentMonth !== thisMonth && (
        <button
          type="button"
          onClick={() => go(thisMonth)}
          className="h-9 px-3 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
        >
          This month
        </button>
      )}
    </div>
  );
}
