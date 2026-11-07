'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import { buttonClass } from './ui';

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('secondary')}>
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
