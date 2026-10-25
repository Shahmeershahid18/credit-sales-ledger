'use client';

import React, { useActionState } from 'react';
import { Lock, Mail, ShieldCheck, Loader2 } from 'lucide-react';
import { signInAction, type SignInState } from '@/app/actions/auth';

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p
          aria-live="polite"
          className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs font-semibold"
        >
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5 text-zinc-500" />
          Owner Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="owner@store.com"
          defaultValue={state.email}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
        >
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          required
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        <span>{pending ? 'Signing In...' : 'Sign In'}</span>
      </button>
    </form>
  );
}
