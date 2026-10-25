import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/config';
import { LoginForm } from '@/components/LoginForm';
import { LogoMark } from '@/components/Logo';
import { buttonClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  const isLive = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <LogoMark className="w-12 h-12" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">Sign in to Credit Ledger</h1>
          <p className="mt-1 text-sm text-zinc-500">Credit sales, payments and overdue tracking</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6">
          {isLive ? (
            <LoginForm />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-zinc-600">
                Supabase is not configured, so the app is running in demo mode with sample data. Add your
                project URL and anon key to <code className="text-zinc-900">.env.local</code> to enable sign-in.
              </p>
              <Link href="/dashboard" className={buttonClass('primary', 'w-full h-10')}>
                Open demo
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
