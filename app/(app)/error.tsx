'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { buttonClass, cardClass } from '@/components/ui';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`${cardClass} max-w-lg mx-auto mt-10 p-6 text-center`}>
      <div className="mx-auto w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h1 className="mt-3 text-base font-semibold text-zinc-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The page could not be loaded. Check your internet connection and try again.
      </p>
      <button type="button" onClick={() => retry()} className={buttonClass('primary', 'mt-5')}>
        <RotateCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
