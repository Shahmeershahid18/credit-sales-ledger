import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface YearPickerProps {
  year: number;
  thisYear: number;
  query?: string; // other report parameters to keep, e.g. "side=vendor"
}

/**
 * Previous / next year for the yearly report. There is no year after the current one.
 */
export function YearPicker({ year, thisYear, query }: YearPickerProps) {
  const href = (y: number) => `/reports?${query ? `${query}&` : ''}year=${y}`;
  const arrow = 'w-9 h-full flex items-center justify-center';

  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Report year" className="flex items-center h-9 rounded-lg border border-zinc-200 bg-white">
        <Link href={href(year - 1)} aria-label="Previous year" className={`${arrow} text-zinc-500 hover:text-zinc-900`}>
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="px-2 min-w-[6rem] text-center text-sm font-medium text-zinc-900 tabular-nums">{year}</span>
        {year < thisYear ? (
          <Link href={href(year + 1)} aria-label="Next year" className={`${arrow} text-zinc-500 hover:text-zinc-900`}>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span aria-hidden="true" className={`${arrow} text-zinc-300`}>
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </nav>
      {year !== thisYear && (
        <Link href={href(thisYear)} className="h-9 px-3 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 flex items-center">
          This year
        </Link>
      )}
    </div>
  );
}
