import React from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight, Info } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/config';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const isLive = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6 text-white">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-zinc-950 mx-auto flex items-center justify-center font-black shadow-lg">
            <BookOpen className="w-7 h-7 text-zinc-950" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Credit Sale Monitoring
          </h1>
          <p className="text-xs text-zinc-400">
            Owner Ledger & Monthly Overdue Tracking
          </p>
        </div>

        {isLive ? (
          <LoginForm />
        ) : (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Info className="w-4 h-4" />
              <span>Demo mode</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Supabase is not configured, so there is no login and the app runs on sample data kept in
              server memory. Anything you add is lost when the server restarts. Set
              <code className="mx-1 text-amber-300">NEXT_PUBLIC_SUPABASE_URL</code>and
              <code className="mx-1 text-amber-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              in <code className="text-amber-300">.env.local</code> to save data and enable sign-in.
            </p>
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Open Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
