import React from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-zinc-900">
      {/* Desktop Sidebar and Mobile Navigation */}
      <Navigation isDemo={isDemo} email={email} />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
          {isDemo && (
            <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <span className="font-bold">Demo mode:</span> data is kept in server memory and is lost when the
                server restarts. Add your Supabase URL and anon key to <code>.env.local</code> to save data
                permanently.
              </p>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
