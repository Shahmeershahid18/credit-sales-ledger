'use client';

import React, { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { signInAction, type SignInState } from '@/app/actions/auth';
import { Field, FormError, buttonClass, inputClass } from './ui';

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error ?? null} />

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={state.email}
          required
          autoFocus
          className={inputClass}
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass('primary', 'w-full h-10')}>
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
