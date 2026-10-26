import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, LogOut, UserCog } from 'lucide-react';
import { getAuthState } from '@/lib/auth';
import { displayName, formatDate } from '@/lib/format';
import { signOutAction } from '@/app/actions/auth';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { PageHeader, buttonClass, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const auth = await getAuthState();

  if (auth.mode !== 'live') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader title="Account" />
        <div className={`${cardClass} p-5 sm:p-6 text-sm text-zinc-600`}>
          Accounts and passwords are available once Supabase is connected. The app is running in demo mode.
        </div>
      </div>
    );
  }

  const { user } = auth;
  const isAdmin = user.role === 'admin';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Account" description="Your sign-in details and password" />

      <section className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-full bg-zinc-900 text-white text-lg font-semibold flex items-center justify-center shrink-0">
            {displayName(user)[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{displayName(user)}</p>
            <p className="text-sm text-zinc-500 truncate">{user.email}</p>
          </div>
          {isAdmin && (
            <span className="ml-auto shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset bg-violet-50 text-violet-700 ring-violet-600/20">
              Admin
            </span>
          )}
        </div>
        <p className="mt-4 pt-4 border-t border-zinc-100 text-xs text-zinc-500">Member since {formatDate(user.created_at.slice(0, 10))}</p>
      </section>

      {isAdmin && (
        <Link href="/users" className={`${cardClass} p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors`}>
          <span className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
            <UserCog className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-zinc-900">Manage users</span>
            <span className="block text-xs text-zinc-500">Add users, reset passwords and open their ledgers</span>
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </Link>
      )}

      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-zinc-900">Change password</h2>
        <p className="text-sm text-zinc-500 mt-0.5 mb-5">Enter your current password, then choose a new one.</p>
        <ChangePasswordForm />
      </section>

      <form action={signOutAction}>
        <button type="submit" className={buttonClass('secondary', 'w-full h-10 sm:w-auto')}>
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
