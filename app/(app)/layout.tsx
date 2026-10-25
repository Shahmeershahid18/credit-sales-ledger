import React from 'react';
import { redirect } from 'next/navigation';
import { Info } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { getAuthState } from '@/lib/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthState();
  if (auth.mode === 'signed-out') {
    redirect('/login');
  }

  const isDemo = auth.mode === 'demo';
  const email = auth.mode === 'live' ? auth.email : null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-zinc-50 text-zinc-900">
      <Navigation isDemo={isDemo} email={email} />

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-10">
          {isDemo && (
            <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>Demo mode. Sample data only; changes are not saved. Add your Supabase keys to save data.</p>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
