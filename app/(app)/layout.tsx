import React from 'react';
import { redirect } from 'next/navigation';
import { Eye, Info, Lock } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { LogoMark } from '@/components/Logo';
import { buttonClass, cardClass } from '@/components/ui';
import { signOutAction } from '@/app/actions/auth';
import { openLedgerAction } from '@/app/actions/users';
import { getAuthState } from '@/lib/auth';
import { displayName } from '@/lib/format';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthState();
  if (auth.mode === 'signed-out') {
    redirect('/login');
  }

  if (auth.mode === 'blocked') {
    return <BlockedScreen email={auth.email} reason={auth.reason} />;
  }

  const isDemo = auth.mode === 'demo';
  const user = auth.mode === 'live' ? auth.user : null;
  const viewing = auth.mode === 'live' && auth.owner.id !== auth.user.id ? auth.owner : null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-zinc-50 text-zinc-900">
      <Navigation
        isDemo={isDemo}
        account={user ? { name: displayName(user), email: user.email, isAdmin: user.role === 'admin' } : null}
      />

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-10">
          {isDemo && (
            <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>Demo mode. Sample data only; changes are not saved. Add your Supabase keys to save data.</p>
            </div>
          )}
          {viewing && (
            <div className="mb-6 px-3.5 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-sm flex flex-wrap items-center gap-x-3 gap-y-2">
              <Eye className="w-4 h-4 text-sky-600 shrink-0" />
              <p className="flex-1 min-w-[12rem]">
                You are viewing <span className="font-semibold">{displayName(viewing)}</span>&apos;s ledger. Anything you add
                is saved to their account.
              </p>
              <form action={openLedgerAction.bind(null, null)}>
                <button type="submit" className="h-8 px-3 rounded-md bg-white border border-sky-200 text-sky-800 text-sm font-medium hover:bg-sky-100">
                  Back to my ledger
                </button>
              </form>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function BlockedScreen({ email, reason }: { email: string | null; reason: 'disabled' | 'no-profile' }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className={`${cardClass} w-full max-w-sm p-6 text-center`}>
        <LogoMark className="w-10 h-10 mx-auto" />
        <div className="mt-5 mx-auto w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-zinc-900">
          {reason === 'disabled' ? 'Account disabled' : 'Account not set up'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {reason === 'disabled'
            ? 'Your account has been disabled. Contact your administrator to get access again.'
            : 'Your account has no profile yet. Ask your administrator to set it up.'}
        </p>
        {email && <p className="mt-3 text-xs text-zinc-400">{email}</p>}
        <form action={signOutAction} className="mt-5">
          <button type="submit" className={buttonClass('primary', 'w-full h-10')}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
