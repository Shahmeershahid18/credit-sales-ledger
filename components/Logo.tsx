import React from 'react';

interface LogoMarkProps {
  className?: string;
}

/**
 * Brand mark: three ledger lines with a settled entry. Same artwork as app/icon.svg.
 */
export function LogoMark({ className = 'w-9 h-9' }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-emerald-600" />
      <path
        d="M9 10.5h14M9 16h10M9 21.5h6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <circle cx="22" cy="21.5" r="2.25" fill="#a7f3d0" />
    </svg>
  );
}

interface LogoProps {
  markClassName?: string;
  textClassName?: string;
}

export function Logo({ markClassName = 'w-9 h-9', textClassName = 'text-zinc-900' }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <span className={`font-semibold tracking-tight text-[17px] ${textClassName}`}>Credit Ledger</span>
    </span>
  );
}
