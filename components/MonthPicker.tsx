'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getCurrentMonthStr } from '@/lib/format';

interface MonthPickerProps {
  currentMonth: string; // YYYY-MM
}

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDate = parseISO(`${currentMonth}-01`);

  const setMonth = (newMonthStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', newMonthStr);
    router.push(`/reports/monthly?${params.toString()}`);
  };

  const handlePrev = () => {
    const prev = subMonths(currentDate, 1);
    setMonth(format(prev, 'yyyy-MM'));
  };

  const handleNext = () => {
    const next = addMonths(currentDate, 1);
    setMonth(format(next, 'yyyy-MM'));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setMonth(e.target.value);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-white border border-zinc-200/90 rounded-2xl p-1 shadow-xs">
        <button
          onClick={handlePrev}
          className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="relative flex items-center px-3 py-1 gap-2">
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-zinc-900 whitespace-nowrap min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <input
            type="month"
            value={currentMonth}
            onChange={handleChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            title="Pick a specific month"
          />
        </div>

        <button
          onClick={handleNext}
          className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={() => setMonth(getCurrentMonthStr())}
        className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors hidden sm:inline-block"
      >
        Current Month
      </button>
    </div>
  );
}
